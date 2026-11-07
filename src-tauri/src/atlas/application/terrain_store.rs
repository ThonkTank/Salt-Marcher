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
                let mut old = Grid::new();
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
                for (x, y) in regions {
                    old.merge(grid(
                        &self.db,
                        [
                            x as f64 * 160.0,
                            y as f64 * 160.0,
                            (x + 1) as f64 * 160.0,
                            (y + 1) as f64 * 160.0,
                        ],
                    )?);
                }
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
                    "Höchstens 100.000 Höhenpunkte je Aktion",
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
            let surface = self.surface_tiles(
                view,
                computed.change.rivers.as_ref(),
                computed.change.waters.as_ref(),
            )?;
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
        rivers: Option<&crate::atlas::rivers::RiverDelta>,
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
                let house_rivers = super::river_store::overlay(&self.db, expand(hb, STEP), rivers)?;
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
            let rivers = super::river_store::overlay(&self.db, b, None)?;
            let river = crate::atlas::rivers::RiverSurface::new(&rivers);
            let ids = self.surface_platform_ids(b, None, &mut cache)?;
            let mut platforms = PreparedPlatforms::new(ids.iter().map(|id| &cache[id]).collect());
            heights.push(platforms.at(river.at(p, sampler.height(p)?).0, p));
        }
        Ok(terrain::SurfacePointsResponse {
            status: self.status(),
            heights,
        })
    }
    pub(in crate::atlas) fn terrain_tiles(&self, args: TerrainArgs) -> Result<TerrainResponse> {
        self.surface_tiles(args, None, None)
    }
    fn surface_tiles(
        &self,
        args: TerrainArgs,
        rivers: Option<&crate::atlas::rivers::RiverDelta>,
        waters: Option<&crate::atlas::water::WaterDelta>,
    ) -> Result<TerrainResponse> {
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
            let river_views = if args.level > 5 && rivers.is_none() {
                super::river_store::overview(&self.db, expand(b, 2. * step), 8. / step)?
            } else {
                super::river_store::overlay(&self.db, expand(b, 2. * step), rivers)?
            };
            let river_surface = crate::atlas::rivers::RiverSurface::new(&river_views);
            let tile_platform_ids = if args.level <= 5 {
                self.surface_platform_ids(expand(b, 2. * step), rivers, &mut platform_cache)?
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
            let mut heights = Vec::with_capacity(1089);
            for dy in 0..=32 {
                for dx in 0..=32 {
                    let p = [b[0] + dx as f64 * step, b[1] + dy as f64 * step];
                    heights.push(platforms.at(river_surface.at(p, sampler.height(p)?).0, p));
                }
            }
            let waters = if args.level > 5 && waters.is_none() {
                super::water_store::overview(&self.db, expand(b, width / f64::from(pixels)), step)?
            } else {
                super::water_store::overlay(&self.db, expand(b, width / f64::from(pixels)), waters)?
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
                !river_views.is_empty() || !tile_platform_ids.is_empty(),
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
