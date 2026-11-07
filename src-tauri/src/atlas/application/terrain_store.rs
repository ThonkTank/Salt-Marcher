//! Height authoring, indexed reads and transaction-local history. No cell payloads.
use super::AtlasApplication;
use crate::atlas::change::{Computed, SmallPatch};
use crate::atlas::errors::{ensure, storage_error};
use crate::atlas::geometry::{bounds, expand, world};
use crate::atlas::model::SceneObject;
use crate::atlas::terrain::{
    self, Grid, Platform, PreparedPlatforms, SurfaceTile, TerrainArgs, TerrainDelta,
    TerrainPreview, TerrainResponse, STEP,
};
use crate::atlas::{Bounds, Intent, Result};
use rusqlite::{params, Connection};

pub fn install(db: &Connection) -> Result<()> {
    db.execute_batch("CREATE TABLE terrain(x INTEGER NOT NULL,y INTEGER NOT NULL,z REAL NOT NULL,PRIMARY KEY(x,y)) WITHOUT ROWID;").map_err(storage_error)
}
pub fn grid(db: &Connection, b: Bounds) -> Result<Grid> {
    let mut q = db
        .prepare("SELECT x,y,z FROM terrain WHERE x BETWEEN ?1 AND ?2 AND y BETWEEN ?3 AND ?4")
        .map_err(storage_error)?;
    let rows = q
        .query_map(
            params![
                (b[0] / STEP).floor() as i32 - 2,
                (b[2] / STEP).ceil() as i32 + 2,
                (b[1] / STEP).floor() as i32 - 2,
                (b[3] / STEP).ceil() as i32 + 2
            ],
            |r| Ok(((r.get(0)?, r.get(1)?), r.get(2)?)),
        )
        .map_err(storage_error)?;
    let mut g = rows
        .collect::<rusqlite::Result<Grid>>()
        .map_err(storage_error)?;
    g.layers = super::world_terrain_store::read(db, b)?;
    Ok(g)
}
// Brush and water follow-up use bounded author regions here. General view bounds
// may span the world and must not enumerate every empty block in that rectangle.
pub(super) fn brush_grid(db: &Connection, regions: &[Bounds], min: u8) -> Result<Grid> {
    use std::collections::BTreeMap;
    let mut result = Grid::new();
    for source in min..=21 {
        // Local authors and the level-zero layer remain distinct sources.
        for local in [true, false] {
            if local && source != 0 {
                continue;
            }
            let exists: bool = if local {
                db.query_row("SELECT EXISTS(SELECT 1 FROM terrain)", [], |r| r.get(0))
            } else {
                db.query_row(
                    "SELECT EXISTS(SELECT 1 FROM terrain_layers WHERE level=?1)",
                    [source],
                    |r| r.get(0),
                )
            }
            .map_err(storage_error)?;
            if !exists {
                continue;
            }
            let step = STEP * 2f64.powi(source as i32);
            // Sixteen row masks preserve the exact union of the old padded
            // rectangles, including holes, without reading any block twice.
            let mut blocks: BTreeMap<(i32, i32), [u16; 16]> = BTreeMap::new();
            for b in regions {
                let x0 = (b[0] / step).floor() as i32 - 2;
                let y0 = (b[1] / step).floor() as i32 - 2;
                let x1 = (b[2] / step).ceil() as i32 + 2;
                let y1 = (b[3] / step).ceil() as i32 + 2;
                for by in y0.div_euclid(16)..=y1.div_euclid(16) {
                    for bx in x0.div_euclid(16)..=x1.div_euclid(16) {
                        let rows = blocks.entry((bx, by)).or_default();
                        let lo = (x0 - bx * 16).max(0) as u32;
                        let hi = (x1 - bx * 16).min(15) as u32;
                        let mask = (((1u32 << (hi + 1)) - 1) & !((1u32 << lo) - 1)) as u16;
                        for y in (y0 - by * 16).max(0)..=(y1 - by * 16).min(15) {
                            rows[y as usize] |= mask;
                        }
                    }
                }
            }
            let mut q = db
                .prepare_cached(super::terrain_blocks::author_block_query(local))
                .map_err(storage_error)?;
            let mut points = BTreeMap::new();
            for ((bx, by), mask) in blocks {
                let mut rows = q.query(params![source, bx, by]).map_err(storage_error)?;
                while let Some(row) = rows.next().map_err(storage_error)? {
                    let x: i32 = row.get(0).map_err(storage_error)?;
                    let y: i32 = row.get(1).map_err(storage_error)?;
                    if mask[y.rem_euclid(16) as usize] & (1 << x.rem_euclid(16)) != 0 {
                        points.insert((x, y), row.get(2).map_err(storage_error)?);
                    }
                }
            }
            if local {
                result.points = points;
            } else if !points.is_empty() {
                result.layers.insert(source, points);
            }
        }
    }
    Ok(result)
}
pub fn write_points(db: &Connection, points: &[(i32, i32, f64)]) -> Result<()> {
    write_samples(
        db,
        &points
            .iter()
            .map(|&(x, y, z)| (x, y, Some(z)))
            .collect::<Vec<_>>(),
    )
}
pub fn write_samples(db: &Connection, points: &[(i32, i32, Option<f64>)]) -> Result<()> {
    let mut put = db
        .prepare_cached(
            "INSERT INTO terrain VALUES(?,?,?) ON CONFLICT(x,y) DO UPDATE SET z=excluded.z",
        )
        .map_err(storage_error)?;
    let mut remove = db
        .prepare_cached("DELETE FROM terrain WHERE x=? AND y=?")
        .map_err(storage_error)?;
    for &(x, y, z) in points {
        if let Some(z) = z {
            put.execute(params![x, y, z]).map_err(storage_error)?;
        } else {
            remove.execute(params![x, y]).map_err(storage_error)?;
        }
    }
    Ok(())
}
impl AtlasApplication {
    pub(in crate::atlas) fn compute_terrain(&self, intent: &Intent) -> Result<Option<Computed>> {
        if let Intent::TerrainStroke { brush, .. } = intent {
            let level = brush.resolution.unwrap_or(0);
            if level > 0 {
                return self.compute_world_terrain(brush, level).map(Some);
            }
        }
        if let Intent::SetFoundation { id, foundation } = intent {
            foundation.validate()?;
            let before = self.required_house_header(id)?;
            let mut after = before.clone();
            after.foundation = foundation.clone();
            return Ok(Some(Computed::fields(
                SmallPatch::Foundation {
                    id: id.clone(),
                    before: before.foundation.clone(),
                    after: foundation.clone(),
                },
                before,
                after,
            )));
        }
        if !matches!(
            intent,
            Intent::TerrainStroke { .. } | Intent::WaterStroke { .. }
        ) {
            return Ok(None);
        }
        let mut waters = None;
        let mut next_identity = None;
        let mut before = vec![];
        let mut after = vec![];
        match intent {
            Intent::TerrainStroke { brush, .. } | Intent::WaterStroke { brush, .. } => {
                ensure(
                    brush.radius.is_finite() && brush.points.len() <= terrain::LIMIT,
                    "Ungültiger Pinsel",
                )?;
                // Read only tiles along the stroke, never its potentially enormous bounding box.
                let mut regions = std::collections::BTreeSet::new();
                for p in &brush.points {
                    ensure(
                        crate::atlas::geometry::valid_point(*p),
                        "Ungültiger Pinselpunkt",
                    )?;
                }
                let samples = if matches!(intent, Intent::TerrainStroke { .. }) {
                    terrain::land_samples(brush)?
                } else {
                    None
                };
                if let Some(samples) = &samples {
                    regions.extend(
                        samples
                            .keys()
                            .map(|&(x, y)| (x.div_euclid(32), y.div_euclid(32))),
                    );
                } else {
                    let centers = terrain::stroke_centers_offset(brush, self.terrain_sampling)?;
                    for p in centers {
                        let b = expand([p[0], p[1], p[0], p[1]], brush.radius * 1.25 + STEP * 2.);
                        for y in (b[1] / 160.0).floor() as i32..=(b[3] / 160.0).floor() as i32 {
                            for x in (b[0] / 160.0).floor() as i32..=(b[2] / 160.0).floor() as i32 {
                                regions.insert((x, y));
                                ensure(regions.len() <= 4096, "Pinselstrich zu groß")?;
                            }
                        }
                    }
                }
                let regions: Vec<_> = regions
                    .into_iter()
                    .map(|(x, y)| {
                        [
                            x as f64 * 160.,
                            y as f64 * 160.,
                            (x + 1) as f64 * 160.,
                            (y + 1) as f64 * 160.,
                        ]
                    })
                    .collect();
                let mut old = brush_grid(&self.db, &regions, 0)?;
                let mut next = old.clone();
                if matches!(intent, Intent::WaterStroke { .. }) {
                    let (delta, identity) = self.water_stroke(brush, &mut old, &mut next)?;
                    if delta.before != delta.after {
                        waters = Some(delta);
                        next_identity = Some(identity);
                    }
                } else {
                    terrain::stroke_prepared(
                        &mut next,
                        brush,
                        self.terrain_sampling,
                        samples.as_ref(),
                    )?;
                }
                ensure(
                    next.iter()
                        .filter(|(&(x, y), &z)| terrain::at(&old, x, y) != z)
                        .count()
                        <= terrain::LIMIT,
                    "Höchstens 100.000 Höhenpunkte je Aktion. Pinsel verkleinern oder kürzere Striche malen.",
                )?;
                for (&(x, y), &z) in &next {
                    let prior = terrain::at(&old, x, y);
                    if prior != z {
                        before.push((x, y, prior));
                        after.push((x, y, z));
                    }
                }
            }
            _ => unreachable!(),
        }
        let preview = TerrainPreview {
            surface: None,
            points: after.clone(),
        };
        let mut missing_before = vec![];
        let mut query = self
            .db
            .prepare_cached("SELECT EXISTS(SELECT 1 FROM terrain WHERE x=? AND y=?)")
            .map_err(storage_error)?;
        for &(x, y, _) in &before {
            if !query
                .query_row(params![x, y], |r| r.get::<_, bool>(0))
                .map_err(storage_error)?
            {
                missing_before.push((x, y));
            }
        }
        let mut computed = Computed::terrain(
            TerrainDelta {
                before,
                after,
                missing_before,
            },
            preview,
        );
        computed.change.waters = waters;
        computed.next_identity = next_identity;
        Ok(Some(computed))
    }

    pub(super) fn prepare_surface_preview(
        &self,
        intent: &Intent,
        computed: &mut Computed,
        changed: Option<&[Bounds]>,
    ) -> Result<()> {
        let view = match intent {
            Intent::TerrainStroke { view, .. } | Intent::WaterStroke { view, .. } => view,
            Intent::RiverEdit { view, .. } if computed.change.rivers.is_some() => view,
            _ => return Ok(()),
        };
        if let Some(view) = view {
            let mut view = view.clone();
            if let Some(changed) = changed {
                let width = 160. * 2f64.powi(view.level as i32);
                view.tiles.retain(|&[x, y]| {
                    changed.iter().any(|b| {
                        // Relief gradients sample two 33-node grid steps beyond the edge.
                        let b = expand(*b, (width / 16.).max(10.));
                        x as f64 * width <= b[2]
                            && (x + 1) as f64 * width >= b[0]
                            && y as f64 * width <= b[3]
                            && (y + 1) as f64 * width >= b[1]
                    })
                });
            }
            let surface = self.terrain_tiles(view)?;
            computed
                .terrain_preview
                .get_or_insert_with(|| TerrainPreview {
                    surface: None,
                    points: vec![],
                })
                .surface = Some(surface);
        }
        Ok(())
    }
    fn surface_platform_ids(
        &self,
        b: Bounds,
        platform_cache: &mut std::collections::HashMap<String, Platform>,
    ) -> Result<Vec<String>> {
        let mut tile_platform_ids = vec![];
        for id in self.collision_header_ids(expand(b, 500.0))? {
            if platform_cache.contains_key(&id) {
                tile_platform_ids.push(id);
                continue;
            }
            if let Some(SceneObject::House(h)) = self.scene_header(&id)? {
                if h.contours.is_empty() {
                    continue;
                }
                let rings: Vec<Vec<_>> = h
                    .contours
                    .iter()
                    .map(|r| r.iter().map(|p| world(*p, &h.transform)).collect())
                    .collect();
                let hb = bounds(rings.iter().flatten().copied());
                let mut g = grid(&self.db, expand(hb, STEP))?;
                let house_rivers = super::river_store::local(&self.db, expand(hb, STEP))?;
                let house_surface = crate::atlas::rivers::RiverSurface::new(&house_rivers);
                if !house_rivers.is_empty() {
                    for y in ((hb[1] - STEP) / STEP).floor() as i32
                        ..=((hb[3] + STEP) / STEP).ceil() as i32
                    {
                        for x in ((hb[0] - STEP) / STEP).floor() as i32
                            ..=((hb[2] + STEP) / STEP).ceil() as i32
                        {
                            let p = [x as f64 * STEP, y as f64 * STEP];
                            let z = house_surface.at(p, terrain::at(&g, x, y)).0;
                            g.insert((x, y), z);
                        }
                    }
                }
                let platform = Platform::new(rings, &g, h.foundation);
                platform_cache.insert(id.clone(), platform);
                tile_platform_ids.push(id);
            }
        }
        Ok(tile_platform_ids)
    }
    pub(in crate::atlas) fn surface_points(
        &self,
        args: terrain::SurfacePointsArgs,
    ) -> Result<terrain::SurfacePointsResponse> {
        self.check(&args.version)?;
        ensure(
            args.points.len() <= 64
                && args
                    .points
                    .iter()
                    .all(|p| crate::atlas::geometry::valid_point(*p)),
            "Ungültige Oberflächenpunkte",
        )?;
        let mut sampler = super::terrain_blocks::Sampler::new(&self.db)?;
        let mut cache = std::collections::HashMap::new();
        let mut heights = vec![];
        for p in args.points {
            let b = [p[0] - STEP, p[1] - STEP, p[0] + STEP, p[1] + STEP];
            let rivers = super::river_store::local(&self.db, b)?;
            let river = crate::atlas::rivers::RiverSurface::new(&rivers);
            let ids = self.surface_platform_ids(b, &mut cache)?;
            let mut platforms = PreparedPlatforms::new(ids.iter().map(|id| &cache[id]).collect());
            heights.push(platforms.at(river.at(p, sampler.height(p)?).0, p));
        }
        Ok(terrain::SurfacePointsResponse {
            status: self.status(),
            heights,
        })
    }
    pub(in crate::atlas) fn terrain_tiles(&self, args: TerrainArgs) -> Result<TerrainResponse> {
        ensure(
            args.level <= 21 && args.tiles.len() <= 64,
            "Ungültige Höhenkacheln",
        )?;
        let pixels = args.pixels.unwrap_or(512);
        ensure(
            args.contour_interval
                .is_none_or(|v| v.is_finite() && (5. ..=1e12).contains(&v)),
            "Ungültiger Höhenlinienabstand",
        )?;
        ensure(
            (32..=1024).contains(&pixels)
                && pixels.is_power_of_two()
                && usize::from(pixels).pow(2) * args.tiles.len() <= 64 * 512 * 512,
            "Ungültiges Geländerasterbudget",
        )?;
        let mut sampler = super::terrain_blocks::Sampler::new(&self.db)?;
        let step = STEP * (1u32 << args.level) as f64;
        let width = 32.0 * step;
        let mut tiles = vec![];
        let mut water_points = 0;
        let mut platform_cache = std::collections::HashMap::<String, Platform>::new();
        for [x, y] in args.tiles {
            ensure(
                (x as f64 * width).abs() <= 100_000_000.0 + width
                    && (y as f64 * width).abs() <= 100_000_000.0 + width,
                "Höhenkachel außerhalb der Welt",
            )?;
            let b = [
                x as f64 * width,
                y as f64 * width,
                (x + 1) as f64 * width,
                (y + 1) as f64 * width,
            ];
            let river_views = if args.level > 5 {
                super::river_store::overview(&self.db, expand(b, 2. * step), 8. / step)?
            } else {
                super::river_store::local(&self.db, expand(b, 2. * step))?
            };
            let river_surface = crate::atlas::rivers::RiverSurface::new(&river_views);
            let tile_platform_ids = if args.level <= 5 {
                self.surface_platform_ids(expand(b, 2. * step), &mut platform_cache)?
            } else {
                vec![]
            };
            let foundation_tops = tile_platform_ids
                .iter()
                .map(|id| {
                    let platform = &platform_cache[id];
                    (id.clone(), platform.level + platform.foundation.height)
                })
                .collect();
            let mut platforms = PreparedPlatforms::new(
                tile_platform_ids
                    .iter()
                    .map(|id| &platform_cache[id])
                    .collect(),
            );
            let mut heights = super::terrain_raster::natural_grid(&mut sampler, b, 32)?;
            let influenced = !river_views.is_empty() || !tile_platform_ids.is_empty();
            if influenced {
                for (i, z) in heights.iter_mut().enumerate() {
                    let p = [b[0] + (i % 33) as f64 * step, b[1] + (i / 33) as f64 * step];
                    *z = platforms.at(river_surface.at(p, *z).0, p);
                }
            }
            let waters = if args.level > 5 {
                super::water_store::overview(&self.db, expand(b, width / f64::from(pixels)), step)?
            } else {
                super::water_store::local(&self.db, expand(b, width / f64::from(pixels)))?
            };
            for w in &waters {
                water_points += crate::atlas::water::point_count(w);
            }
            ensure(
                water_points <= crate::atlas::water::POINT_LIMIT,
                "Gewässeransicht überschreitet 200.000 Konturpunkte",
            )?;
            let mut prepared = super::terrain_raster::display(
                &mut sampler,
                b,
                pixels,
                &heights,
                &waters,
                |p, z| platforms.at(river_surface.at(p, z).0, p),
                influenced,
            )?;
            if let Some(interval) = args.contour_interval {
                prepared.contour_interval = interval;
                prepared.contours = super::terrain_raster::contours(b, &heights, interval);
            }
            let raster = Some(prepared);
            let mut tile = SurfaceTile {
                content_id: String::new(),
                raster,
                waters,
                x,
                y,
                heights,
                foundation_tops,
            };
            tile.identify().map_err(storage_error)?;
            tiles.push(tile);
        }
        Ok(TerrainResponse {
            status: self.status(),
            level: args.level,
            tiles,
        })
    }
}
