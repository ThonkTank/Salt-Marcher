//! Height authoring, indexed reads and transaction-local history. No cell payloads.
use super::AtlasApplication;
use crate::atlas::change::{Computed, SmallPatch};
use crate::atlas::errors::{ensure, storage_error};
use crate::atlas::geometry::{bounds, expand, world};
use crate::atlas::model::SceneObject;
use crate::atlas::terrain::{
    self, Grid, Platform, SurfaceTile, TerrainArgs, TerrainDelta, TerrainPreview, TerrainResponse,
    BASE, STEP,
};
use crate::atlas::{Bounds, Intent, Result};
use rusqlite::{params, Connection};

pub fn install(db: &Connection) -> Result<()> {
    db.execute_batch("CREATE TABLE terrain(x INTEGER NOT NULL,y INTEGER NOT NULL,z REAL NOT NULL,PRIMARY KEY(x,y)) WITHOUT ROWID; CREATE TABLE terrain_lod(level INTEGER NOT NULL,x INTEGER NOT NULL,y INTEGER NOT NULL,total REAL NOT NULL,PRIMARY KEY(level,x,y)) WITHOUT ROWID; CREATE TABLE terrain_settings(singleton INTEGER PRIMARY KEY,water REAL NOT NULL); INSERT INTO terrain_settings VALUES(1,0);").map_err(storage_error)
}
pub fn water(db: &Connection) -> Result<f64> {
    db.query_row(
        "SELECT water FROM terrain_settings WHERE singleton=1",
        [],
        |r| r.get(0),
    )
    .map_err(storage_error)
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
    rows.collect::<rusqlite::Result<Grid>>()
        .map_err(storage_error)
}
pub fn write_points(db: &Connection, points: &[(i32, i32, f64)]) -> Result<()> {
    let mut aggregates = std::collections::BTreeMap::<(i32, i32, i32), f64>::new();
    let mut read = db
        .prepare_cached("SELECT COALESCE((SELECT z FROM terrain WHERE x=?1 AND y=?2),10.0)")
        .map_err(storage_error)?;
    let mut delete = db
        .prepare_cached("DELETE FROM terrain WHERE x=? AND y=?")
        .map_err(storage_error)?;
    let mut write = db
        .prepare_cached(
            "INSERT INTO terrain VALUES(?,?,?) ON CONFLICT(x,y) DO UPDATE SET z=excluded.z",
        )
        .map_err(storage_error)?;
    for &(x, y, z) in points {
        let old: f64 = read
            .query_row(params![x, y], |r| r.get(0))
            .map_err(storage_error)?;
        if z == BASE {
            delete.execute(params![x, y]).map_err(storage_error)?;
        } else {
            write.execute(params![x, y, z]).map_err(storage_error)?;
        }
        for level in 1..=21 {
            let factor = 1i32 << level;
            *aggregates
                .entry((level, x.div_euclid(factor), y.div_euclid(factor)))
                .or_default() += z - old;
        }
    }
    let mut write_lod=db.prepare_cached("INSERT INTO terrain_lod VALUES(?,?,?,?) ON CONFLICT(level,x,y) DO UPDATE SET total=total+excluded.total").map_err(storage_error)?;
    for ((level, x, y), delta) in aggregates {
        write_lod
            .execute(params![level, x, y, delta])
            .map_err(storage_error)?;
    }
    Ok(())
}
impl AtlasApplication {
    pub(in crate::atlas) fn compute_terrain(&self, intent: &Intent) -> Result<Option<Computed>> {
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
            Intent::TerrainStroke { .. } | Intent::SetWaterLevel { .. }
        ) {
            return Ok(None);
        }
        let water_before = water(&self.db)?;
        let mut water_after = water_before;
        let mut before = vec![];
        let mut after = vec![];
        match intent {
            Intent::TerrainStroke { brush, .. } => {
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
                    let b = expand([p[0], p[1], p[0], p[1]], brush.radius + STEP);
                    for y in (b[1] / 160.0).floor() as i32..=(b[3] / 160.0).floor() as i32 {
                        for x in (b[0] / 160.0).floor() as i32..=(b[2] / 160.0).floor() as i32 {
                            regions.insert((x, y));
                            ensure(regions.len() <= 4096, "Pinselstrich zu groß")?;
                        }
                    }
                }
                for (x, y) in regions {
                    old.extend(grid(
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
                terrain::stroke(&mut next, brush)?;
                for (&(x, y), &z) in &next {
                    let prior = terrain::at(&old, x, y);
                    if prior != z {
                        before.push((x, y, prior));
                        after.push((x, y, z));
                    }
                }
            }
            Intent::SetWaterLevel { level, .. } => {
                ensure(
                    terrain::valid_height(*level),
                    "Wasserstand außerhalb ±100.000 Fuß",
                )?;
                water_after = *level;
            }
            _ => unreachable!(),
        }
        let view = match intent {
            Intent::TerrainStroke { view, .. } | Intent::SetWaterLevel { view, .. } => view.clone(),
            _ => None,
        };
        let mut surface = view
            .map(|v| self.terrain_tiles_with(v, &after))
            .transpose()?;
        if let Some(s) = surface.as_mut() {
            s.water_level = water_after;
        }
        let preview = TerrainPreview {
            surface,
            points: after.clone(),
            water_level: water_after,
        };
        Ok(Some(Computed::terrain(
            TerrainDelta {
                before,
                after,
                water_before,
                water_after,
            },
            preview,
        )))
    }

    pub(in crate::atlas) fn terrain_tiles(&self, args: TerrainArgs) -> Result<TerrainResponse> {
        self.terrain_tiles_with(args, &[])
    }
    fn terrain_tiles_with(
        &self,
        args: TerrainArgs,
        overrides: &[(i32, i32, f64)],
    ) -> Result<TerrainResponse> {
        ensure(
            args.level <= 21 && args.tiles.len() <= 64,
            "Ungültige Höhenkacheln",
        )?;
        let step = STEP * (1u32 << args.level) as f64;
        let width = 32.0 * step;
        let mut coarse_overrides = Grid::new();
        if args.level > 0 && !overrides.is_empty() {
            let factor = 1i32 << args.level;
            let mut read = self
                .db
                .prepare_cached("SELECT COALESCE((SELECT z FROM terrain WHERE x=?1 AND y=?2),10.0)")
                .map_err(storage_error)?;
            for &(x, y, z) in overrides {
                let prior: f64 = read
                    .query_row(params![x, y], |r| r.get(0))
                    .map_err(storage_error)?;
                *coarse_overrides
                    .entry((x.div_euclid(factor), y.div_euclid(factor)))
                    .or_default() += (z - prior) / (factor as f64).powi(2);
            }
        }
        let mut tiles = vec![];
        let mut platform_cache = std::collections::HashMap::<String, Platform>::new();
        for [x, y] in args.tiles {
            ensure(
                (x as f64 * width).abs() <= 5_000_000.0 + width
                    && (y as f64 * width).abs() <= 5_000_000.0 + width,
                "Höhenkachel außerhalb der Welt",
            )?;
            let b = [
                x as f64 * width,
                y as f64 * width,
                (x + 1) as f64 * width,
                (y + 1) as f64 * width,
            ];
            let mut platforms = vec![];
            let mut foundation_tops = vec![];
            if args.level <= 5 {
                for id in self.collision_header_ids(expand(b, 500.0))? {
                    if let Some(cached) = platform_cache.get(&id) {
                        foundation_tops.push((id.clone(), cached.level + cached.foundation.height));
                        platforms.push(cached.clone());
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
                        g.extend(
                            overrides
                                .iter()
                                .filter(|&&(x, y, _)| {
                                    x as f64 * STEP >= hb[0] - STEP
                                        && x as f64 * STEP <= hb[2] + STEP
                                        && y as f64 * STEP >= hb[1] - STEP
                                        && y as f64 * STEP <= hb[3] + STEP
                                })
                                .map(|&(x, y, z)| ((x, y), z)),
                        );
                        let platform = Platform::new(rings, &g, h.foundation);
                        foundation_tops
                            .push((id.clone(), platform.level + platform.foundation.height));
                        platform_cache.insert(id, platform.clone());
                        platforms.push(platform);
                    }
                }
            }
            let mut natural = if args.level == 0 {
                grid(&self.db, expand(b, STEP))?
            } else {
                let mut q=self.db.prepare("SELECT x,y,total FROM terrain_lod WHERE level=?1 AND x BETWEEN ?2 AND ?3 AND y BETWEEN ?4 AND ?5").map_err(storage_error)?;
                let rows = q
                    .query_map(
                        params![args.level, x * 32, x * 32 + 32, y * 32, y * 32 + 32],
                        |r| {
                            Ok((
                                (r.get(0)?, r.get(1)?),
                                BASE + r.get::<_, f64>(2)? / (1u64 << (2 * args.level)) as f64,
                            ))
                        },
                    )
                    .map_err(storage_error)?;
                rows.collect::<rusqlite::Result<Grid>>()
                    .map_err(storage_error)?
            };
            if args.level == 0 {
                natural.extend(
                    overrides
                        .iter()
                        .filter(|&&(gx, gy, _)| {
                            gx >= x * 32 && gx <= x * 32 + 32 && gy >= y * 32 && gy <= y * 32 + 32
                        })
                        .map(|&(x, y, z)| ((x, y), z)),
                );
            } else {
                for (&(gx, gy), &delta) in &coarse_overrides {
                    if gx >= x * 32 && gx <= x * 32 + 32 && gy >= y * 32 && gy <= y * 32 + 32 {
                        *natural.entry((gx, gy)).or_insert(BASE) += delta;
                    }
                }
            }
            let mut heights = Vec::with_capacity(1089);
            for dy in 0..=32 {
                for dx in 0..=32 {
                    let p = [b[0] + dx as f64 * step, b[1] + dy as f64 * step];
                    heights.push(terrain::surface(
                        terrain::at(&natural, x * 32 + dx, y * 32 + dy),
                        p,
                        &platforms,
                    ));
                }
            }
            tiles.push(SurfaceTile {
                x,
                y,
                heights,
                foundation_tops,
            });
        }
        Ok(TerrainResponse {
            status: self.status(),
            level: args.level,
            water_level: water(&self.db)?,
            tiles,
        })
    }
}
