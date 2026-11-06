//! Height authoring, indexed reads and transaction-local history. No cell payloads.
use super::AtlasApplication;
use crate::atlas::change::{Computed, SmallPatch};
use crate::atlas::errors::{ensure, storage_error};
use crate::atlas::geometry::{bounds, expand, world};
use crate::atlas::model::SceneObject;
use crate::atlas::terrain::{
    self, Grid, Platform, PreparedPlatforms, SurfaceTile, TerrainArgs, TerrainDelta,
    TerrainPreview, TerrainResponse, BASE, STEP,
};
use crate::atlas::{Bounds, Intent, Result};
use rusqlite::{params, Connection, OptionalExtension};

pub fn install(db: &Connection) -> Result<()> {
    db.execute_batch("CREATE TABLE terrain(x INTEGER NOT NULL,y INTEGER NOT NULL,z REAL NOT NULL,PRIMARY KEY(x,y)) WITHOUT ROWID; CREATE TABLE terrain_lod(level INTEGER NOT NULL,x INTEGER NOT NULL,y INTEGER NOT NULL,total REAL NOT NULL,n INTEGER NOT NULL,PRIMARY KEY(level,x,y)) WITHOUT ROWID;").map_err(storage_error)
}
/// Rebuild disposable parents from author samples inside the caller's transaction.
pub fn rebuild_overview(db: &Connection) -> Result<()> {
    db.execute("DELETE FROM terrain_lod", [])
        .map_err(storage_error)?;
    let mut read = db
        .prepare("SELECT x >> ?1 AS px, y >> ?1 AS py, x, y, z FROM terrain ORDER BY px, py, x, y")
        .map_err(storage_error)?;
    let mut insert = db
        .prepare("INSERT INTO terrain_lod(level,x,y,total,n) VALUES(?,?,?,?,?)")
        .map_err(storage_error)?;
    for level in 1..=21 {
        let mut rows = read.query([level]).map_err(storage_error)?;
        let mut parent: Option<(i32, i32, f64, i64)> = None;
        while let Some(row) = rows.next().map_err(storage_error)? {
            let (x, y, z): (i32, i32, f64) = (
                row.get(0).map_err(storage_error)?,
                row.get(1).map_err(storage_error)?,
                row.get(4).map_err(storage_error)?,
            );
            let contribution = 0.0 + (z - BASE);
            match parent.as_mut() {
                Some((px, py, total, n)) if (*px, *py) == (x, y) => {
                    *total += contribution;
                    *n += 1;
                }
                _ => {
                    if let Some((px, py, total, n)) = parent.take() {
                        insert
                            .execute(params![level, px, py, total, n])
                            .map_err(storage_error)?;
                    }
                    parent = Some((x, y, contribution, 1));
                }
            }
        }
        if let Some((x, y, total, n)) = parent {
            insert
                .execute(params![level, x, y, total, n])
                .map_err(storage_error)?;
        }
    }
    Ok(())
}
pub fn grid(db: &Connection, b: Bounds) -> Result<Grid> {
    let mut q = db
        .prepare("SELECT x,y,z FROM terrain WHERE x BETWEEN ?1 AND ?2 AND y BETWEEN ?3 AND ?4")
        .map_err(storage_error)?;
    let rows = q
        .query_map(
            params![
                (b[0] / STEP).floor() as i32,
                (b[2] / STEP).ceil() as i32,
                (b[1] / STEP).floor() as i32,
                (b[3] / STEP).ceil() as i32
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
    let mut aggregates = std::collections::BTreeMap::<(i32, i32, i32), (f64, i64)>::new();
    let mut read = db
        .prepare_cached("SELECT z FROM terrain WHERE x=? AND y=?")
        .map_err(storage_error)?;
    let mut put = db
        .prepare_cached(
            "INSERT INTO terrain VALUES(?,?,?) ON CONFLICT(x,y) DO UPDATE SET z=excluded.z",
        )
        .map_err(storage_error)?;
    let mut remove = db
        .prepare_cached("DELETE FROM terrain WHERE x=? AND y=?")
        .map_err(storage_error)?;
    for &(x, y, z) in points {
        let old: Option<f64> = read
            .query_row(params![x, y], |r| r.get(0))
            .optional()
            .map_err(storage_error)?;
        if let Some(z) = z {
            put.execute(params![x, y, z]).map_err(storage_error)?;
        } else {
            remove.execute(params![x, y]).map_err(storage_error)?;
        }
        for level in 1..=21 {
            let factor = 1i32 << level;
            let entry = aggregates
                .entry((level, x.div_euclid(factor), y.div_euclid(factor)))
                .or_default();
            entry.0 += z.unwrap_or(BASE) - old.unwrap_or(BASE);
            entry.1 += i64::from(z.is_some()) - i64::from(old.is_some());
        }
    }
    let mut put=db.prepare_cached("INSERT INTO terrain_lod VALUES(?,?,?,?,?) ON CONFLICT(level,x,y) DO UPDATE SET total=total+excluded.total,n=n+excluded.n").map_err(storage_error)?;
    let mut remove = db
        .prepare_cached("DELETE FROM terrain_lod WHERE level=? AND x=? AND y=? AND n=0")
        .map_err(storage_error)?;
    for ((level, x, y), (delta, count)) in aggregates {
        put.execute(params![level, x, y, delta, count])
            .map_err(storage_error)?;
        remove
            .execute(params![level, x, y])
            .map_err(storage_error)?;
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
                let centers = terrain::stroke_centers(brush)?;
                for p in centers {
                    let b = expand([p[0], p[1], p[0], p[1]], brush.radius * 1.25 + STEP * 2.);
                    for y in (b[1] / 160.0).floor() as i32..=(b[3] / 160.0).floor() as i32 {
                        for x in (b[0] / 160.0).floor() as i32..=(b[2] / 160.0).floor() as i32 {
                            regions.insert((x, y));
                            ensure(regions.len() <= 4096, "Pinselstrich zu groß")?;
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
                    terrain::stroke(&mut next, brush)?;
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
    ) -> Result<()> {
        let view = match intent {
            Intent::TerrainStroke { view, .. } | Intent::WaterStroke { view, .. } => view,
            Intent::RiverEdit { view, .. } if computed.change.rivers.is_some() => view,
            _ => return Ok(()),
        };
        if let Some(view) = view {
            let surface = self.surface_tiles(
                view.clone(),
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
                super::river_store::overview(&self.db, expand(b, STEP), 8. / step)?
            } else {
                super::river_store::overlay(&self.db, expand(b, STEP), rivers)?
            };
            let river_surface = crate::atlas::rivers::RiverSurface::new(&river_views);
            let mut tile_platform_ids = vec![];
            if args.level <= 5 {
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
                        let house_rivers =
                            super::river_store::overlay(&self.db, expand(hb, STEP), rivers)?;
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
            }
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
            let coarse = if args.level > 0 {
                Some((
                    Grid {
                        points: Default::default(),
                        layers: super::world_terrain_store::read_from(
                            &self.db,
                            expand(b, step),
                            args.level,
                        )?,
                    },
                    super::world_terrain_store::overview(&self.db, b, args.level)?,
                ))
            } else {
                None
            };
            let mut coverage = std::collections::BTreeMap::<(i32, i32), f64>::new();
            let natural = if args.level == 0 {
                grid(&self.db, expand(b, STEP))?
            } else {
                let mut q=self.db.prepare("SELECT x,y,total,n FROM terrain_lod WHERE level=?1 AND x BETWEEN ?2 AND ?3 AND y BETWEEN ?4 AND ?5").map_err(storage_error)?;
                let rows = q
                    .query_map(
                        params![args.level, x * 32, x * 32 + 32, y * 32, y * 32 + 32],
                        |r| {
                            let key = (r.get(0)?, r.get(1)?);
                            let n = r.get::<_, f64>(3)?;
                            coverage.insert(key, n / (1u64 << (2 * args.level)) as f64);
                            Ok((key, BASE + r.get::<_, f64>(2)? / n))
                        },
                    )
                    .map_err(storage_error)?;
                rows.collect::<rusqlite::Result<Grid>>()
                    .map_err(storage_error)?
            };
            let mut heights = Vec::with_capacity(1089);
            for dy in 0..=32 {
                for dx in 0..=32 {
                    let p = [b[0] + dx as f64 * step, b[1] + dy as f64 * step];
                    heights.push(
                        platforms.at(
                            river_surface
                                .at(
                                    p,
                                    if args.level == 0 {
                                        terrain::at(&natural, x * 32 + dx, y * 32 + dy)
                                    } else {
                                        let (layered, overview) = coarse
                                            .as_ref()
                                            .expect("coarse surface for nonzero level");
                                        let mut base = layered.coarse_height(p);
                                        if let Some(samples) =
                                            overview.get(&(x * 32 + dx, y * 32 + dy))
                                        {
                                            for &(_, z, coverage) in samples {
                                                base += (z - base) * coverage;
                                            }
                                        }
                                        natural.get(&(x * 32 + dx, y * 32 + dy)).copied().map_or(
                                            base,
                                            |z| {
                                                base + (z - base)
                                                    * coverage
                                                        .get(&(x * 32 + dx, y * 32 + dy))
                                                        .copied()
                                                        .unwrap_or(0.)
                                            },
                                        )
                                    },
                                )
                                .0,
                            p,
                        ),
                    );
                }
            }
            let waters = if args.level > 5 && waters.is_none() {
                super::water_store::overview(&self.db, b, step)?
            } else {
                super::water_store::overlay(&self.db, b, waters)?
            };
            for w in &waters {
                water_points += crate::atlas::water::point_count(w);
            }
            ensure(
                water_points <= crate::atlas::water::POINT_LIMIT,
                "Gewässeransicht überschreitet 200.000 Konturpunkte",
            )?;
            tiles.push(SurfaceTile {
                waters,
                x,
                y,
                heights,
                foundation_tops,
            });
        }
        Ok(TerrainResponse {
            status: self.status(),
            level: args.level,
            tiles,
        })
    }
}
