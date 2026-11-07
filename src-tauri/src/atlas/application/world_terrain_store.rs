//! Sparse author resolutions. Missing samples inherit the coarser surface.
use super::AtlasApplication;
use crate::atlas::{
    change::Computed,
    errors::{ensure, storage_error},
    terrain::{self, Brush, Grid},
    Bounds, Result,
};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
pub type Layers = BTreeMap<u8, BTreeMap<(i32, i32), f64>>;
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct WorldTerrainDelta {
    pub level: u8,
    pub before: Vec<(i32, i32, Option<f64>)>,
    pub after: Vec<(i32, i32, Option<f64>)>,
}
impl WorldTerrainDelta {
    pub fn bounds(&self) -> Bounds {
        let step = terrain::STEP * 2f64.powi(self.level as i32);
        crate::atlas::geometry::expand(
            crate::atlas::geometry::bounds(
                self.after
                    .iter()
                    .map(|&(x, y, _)| [x as f64 * step, y as f64 * step]),
            ),
            step * 2. + 500.,
        )
    }
}
pub fn install(db: &Connection) -> Result<()> {
    db.execute_batch("CREATE TABLE terrain_layers(level INTEGER NOT NULL,x INTEGER NOT NULL,y INTEGER NOT NULL,z REAL NOT NULL,PRIMARY KEY(level,x,y)) WITHOUT ROWID;").map_err(storage_error)
}
pub fn read(db: &Connection, b: Bounds) -> Result<Layers> {
    read_from(db, b, 0)
}
pub fn read_from(db: &Connection, b: Bounds, min: u8) -> Result<Layers> {
    let mut layers = Layers::new();
    let mut q=db.prepare_cached("SELECT x,y,z FROM terrain_layers WHERE level=?1 AND x BETWEEN ?2 AND ?3 AND y BETWEEN ?4 AND ?5 LIMIT 100001").map_err(storage_error)?;
    for level in min..=21 {
        let step = terrain::STEP * 2f64.powi(level as i32);
        let rows = q
            .query_map(
                params![
                    level,
                    (b[0] / step).floor() as i32 - 2,
                    (b[2] / step).ceil() as i32 + 2,
                    (b[1] / step).floor() as i32 - 2,
                    (b[3] / step).ceil() as i32 + 2
                ],
                |r| Ok(((r.get(0)?, r.get(1)?), r.get(2)?)),
            )
            .map_err(storage_error)?;
        let points: BTreeMap<_, _> = rows
            .collect::<rusqlite::Result<_>>()
            .map_err(storage_error)?;
        ensure(
            points.len() <= 100000,
            "Geländeansicht zu groß; bitte hineinzoomen",
        )?;
        if !points.is_empty() {
            layers.insert(level, points);
        }
    }
    Ok(layers)
}
pub fn apply(db: &Connection, d: &WorldTerrainDelta, forward: bool) -> Result<()> {
    let mut write=db.prepare_cached("INSERT INTO terrain_layers VALUES(?,?,?,?) ON CONFLICT(level,x,y) DO UPDATE SET z=excluded.z").map_err(storage_error)?;
    let mut delete = db
        .prepare_cached("DELETE FROM terrain_layers WHERE level=? AND x=? AND y=?")
        .map_err(storage_error)?;
    for &(x, y, z) in if forward { &d.after } else { &d.before } {
        if let Some(z) = z {
            write
                .execute(params![d.level, x, y, z])
                .map_err(storage_error)?;
        } else {
            delete
                .execute(params![d.level, x, y])
                .map_err(storage_error)?;
        }
    }
    Ok(())
}
impl AtlasApplication {
    pub(super) fn compute_world_terrain(&self, brush: &Brush, level: u8) -> Result<Computed> {
        ensure(level <= 21, "Ungültige Geländeauflösung")?;
        ensure(
            !brush.points.is_empty()
                && brush.points.len() <= 4096
                && brush
                    .points
                    .iter()
                    .all(|p| crate::atlas::geometry::valid_point(*p)),
            "Ungültiger Geländepfad",
        )?;
        let factor = 2f64.powi(level as i32);
        let mut scaled = brush.clone();
        scaled.radius /= factor;
        scaled.points = brush
            .points
            .iter()
            .map(|p| [p[0] / factor, p[1] / factor])
            .collect();
        let offset = self.terrain_sampling.map(|v| v / factor);
        let samples = terrain::land_samples(&scaled)?;
        let mut g = Grid::new();
        let mut original = BTreeMap::new();
        let mut candidates = std::collections::BTreeSet::new();
        if let Some(samples) = &samples {
            candidates.extend(samples.keys().copied());
        } else {
            for p in terrain::stroke_centers_offset(&scaled, offset)? {
                for y in ((p[1] - scaled.radius) / 5.).floor() as i32 - 2
                    ..=((p[1] + scaled.radius) / 5.).ceil() as i32 + 2
                {
                    for x in ((p[0] - scaled.radius) / 5.).floor() as i32 - 2
                        ..=((p[0] + scaled.radius) / 5.).ceil() as i32 + 2
                    {
                        candidates.insert((x, y));
                        ensure(candidates.len() <= 400000, "Geländestrich zu groß")?;
                    }
                }
            }
        }
        let blocks: std::collections::BTreeSet<_> = candidates
            .iter()
            .map(|&(x, y)| (x.div_euclid(16), y.div_euclid(16)))
            .collect();
        ensure(blocks.len() <= 4096, "Geländestrich zu groß")?;
        let mut source = Grid::new();
        for (x, y) in blocks {
            source.merge(Grid {
                points: Default::default(),
                layers: read_from(
                    &self.db,
                    [
                        x as f64 * 80. * factor,
                        y as f64 * 80. * factor,
                        (x + 1) as f64 * 80. * factor,
                        (y + 1) as f64 * 80. * factor,
                    ],
                    level,
                )?,
            });
        }
        if let Some(points) = source.layers.get(&level) {
            original.extend(points.iter().map(|(&p, &z)| (p, z)));
        }
        for (x, y) in candidates {
            let z = source
                .layers
                .get(&level)
                .and_then(|layer| layer.get(&(x, y)))
                .copied()
                .unwrap_or_else(|| {
                    source.coarse_height([x as f64 * 5. * factor, y as f64 * 5. * factor])
                });
            g.insert((x, y), z);
        }
        let old = g.clone();
        terrain::stroke_prepared(&mut g, &scaled, offset, samples.as_ref())?;
        let mut delta = WorldTerrainDelta {
            level,
            before: vec![],
            after: vec![],
        };
        for (&(x, y), &z) in &g {
            if terrain::at(&old, x, y) != z {
                ensure(
                    crate::atlas::geometry::valid_point([
                        x as f64 * 5. * factor,
                        y as f64 * 5. * factor,
                    ]),
                    "Gelände außerhalb der Welt",
                )?;
                delta.before.push((x, y, original.get(&(x, y)).copied()));
                delta.after.push((x, y, Some(z)));
            }
        }
        let mut computed = Computed::default();
        if !delta.after.is_empty() {
            computed.change.world_terrain = Some(delta);
        }
        Ok(computed)
    }
}
