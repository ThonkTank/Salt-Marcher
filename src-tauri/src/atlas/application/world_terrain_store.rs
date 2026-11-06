//! Sparse author resolutions. Missing samples inherit the coarser surface.
use super::AtlasApplication;
use crate::atlas::{
    change::Computed,
    errors::{ensure, storage_error},
    terrain::{self, Brush, Grid},
    Bounds, Result,
};
use rusqlite::{params, Connection, OptionalExtension};
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
            step + 500.,
        )
    }
}
pub fn install(db: &Connection) -> Result<()> {
    db.execute_batch("CREATE TABLE terrain_layers(level INTEGER NOT NULL,x INTEGER NOT NULL,y INTEGER NOT NULL,z REAL NOT NULL,PRIMARY KEY(level,x,y)) WITHOUT ROWID; CREATE TABLE terrain_layer_overview(source INTEGER NOT NULL,level INTEGER NOT NULL,x INTEGER NOT NULL,y INTEGER NOT NULL,total REAL NOT NULL,n INTEGER NOT NULL,PRIMARY KEY(level,x,y,source)) WITHOUT ROWID;").map_err(storage_error)
}
/// Rebuild disposable parents from each author resolution inside the caller's transaction.
pub fn rebuild_overview(db: &Connection) -> Result<()> {
    db.execute("DELETE FROM terrain_layer_overview", [])
        .map_err(storage_error)?;
    let mut read = db.prepare("SELECT x >> ?1 AS px, y >> ?1 AS py, x, y, z FROM terrain_layers WHERE level=?2 ORDER BY px, py, x, y").map_err(storage_error)?;
    let mut insert = db
        .prepare("INSERT INTO terrain_layer_overview(source,level,x,y,total,n) VALUES(?,?,?,?,?,?)")
        .map_err(storage_error)?;
    for source in 1..=20 {
        for level in source + 1..=21 {
            let mut rows = read
                .query(params![level - source, source])
                .map_err(storage_error)?;
            let mut parent: Option<(i32, i32, f64, i64)> = None;
            while let Some(row) = rows.next().map_err(storage_error)? {
                let (x, y, z): (i32, i32, f64) = (
                    row.get(0).map_err(storage_error)?,
                    row.get(1).map_err(storage_error)?,
                    row.get(4).map_err(storage_error)?,
                );
                let contribution = z - 0.0;
                match parent.as_mut() {
                    Some((px, py, total, n)) if (*px, *py) == (x, y) => {
                        *total += contribution;
                        *n += 1;
                    }
                    _ => {
                        if let Some((px, py, total, n)) = parent.take() {
                            insert
                                .execute(params![source, level, px, py, total, n])
                                .map_err(storage_error)?;
                        }
                        parent = Some((x, y, contribution, 1));
                    }
                }
            }
            if let Some((x, y, total, n)) = parent {
                insert
                    .execute(params![source, level, x, y, total, n])
                    .map_err(storage_error)?;
            }
        }
    }
    Ok(())
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
                    (b[0] / step).floor() as i32 - 1,
                    (b[2] / step).ceil() as i32 + 1,
                    (b[1] / step).floor() as i32 - 1,
                    (b[3] / step).ceil() as i32 + 1
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
    let mut read = db
        .prepare_cached("SELECT z FROM terrain_layers WHERE level=? AND x=? AND y=?")
        .map_err(storage_error)?;
    let mut write=db.prepare_cached("INSERT INTO terrain_layers VALUES(?,?,?,?) ON CONFLICT(level,x,y) DO UPDATE SET z=excluded.z").map_err(storage_error)?;
    let mut delete = db
        .prepare_cached("DELETE FROM terrain_layers WHERE level=? AND x=? AND y=?")
        .map_err(storage_error)?;
    let mut aggregate=db.prepare_cached("INSERT INTO terrain_layer_overview VALUES(?,?,?,?,?,?) ON CONFLICT(level,x,y,source) DO UPDATE SET total=total+excluded.total,n=n+excluded.n").map_err(storage_error)?;
    let mut remove = db
        .prepare_cached(
            "DELETE FROM terrain_layer_overview WHERE level=? AND x=? AND y=? AND source=? AND n=0",
        )
        .map_err(storage_error)?;
    for &(x, y, z) in if forward { &d.after } else { &d.before } {
        let old: Option<f64> = read
            .query_row(params![d.level, x, y], |r| r.get(0))
            .optional()
            .map_err(storage_error)?;
        if let Some(z) = z {
            write
                .execute(params![d.level, x, y, z])
                .map_err(storage_error)?;
        } else {
            delete
                .execute(params![d.level, x, y])
                .map_err(storage_error)?;
        }
        for level in d.level + 1..=21 {
            let factor = 1i32 << (level - d.level);
            let gx = x.div_euclid(factor);
            let gy = y.div_euclid(factor);
            aggregate
                .execute(params![
                    d.level,
                    level,
                    gx,
                    gy,
                    z.unwrap_or(0.) - old.unwrap_or(0.),
                    i32::from(z.is_some()) - i32::from(old.is_some())
                ])
                .map_err(storage_error)?;
            remove
                .execute(params![level, gx, gy, d.level])
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
        let centers = terrain::stroke_centers(&scaled)?;
        let mut g = Grid::new();
        let mut original = BTreeMap::new();
        for p in centers {
            let b = crate::atlas::geometry::expand(
                [p[0] * factor, p[1] * factor, p[0] * factor, p[1] * factor],
                brush.radius + terrain::STEP * factor * 2.,
            );
            let source = Grid {
                points: Default::default(),
                layers: read_from(&self.db, b, level)?,
            };
            if let Some(points) = source.layers.get(&level) {
                original.extend(points.iter().map(|(&p, &z)| (p, z)));
            }
            for y in ((p[1] - scaled.radius) / 5.).floor() as i32 - 1
                ..=((p[1] + scaled.radius) / 5.).ceil() as i32 + 1
            {
                for x in ((p[0] - scaled.radius) / 5.).floor() as i32 - 1
                    ..=((p[0] + scaled.radius) / 5.).ceil() as i32 + 1
                {
                    ensure(
                        g.len() < 400000 || g.contains_key(&(x, y)),
                        "Geländestrich zu groß",
                    )?;
                    g.entry((x, y)).or_insert_with(|| {
                        source.coarse_height([x as f64 * 5. * factor, y as f64 * 5. * factor])
                    });
                }
            }
        }
        let old = g.clone();
        terrain::stroke(&mut g, &scaled)?;
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

pub type OverviewSamples = BTreeMap<(i32, i32), Vec<(u8, f64, f64)>>;
pub fn overview(db: &Connection, b: Bounds, level: u8) -> Result<OverviewSamples> {
    let step = 5. * 2f64.powi(level as i32);
    let mut q=db.prepare_cached("SELECT x,y,source,total,n FROM terrain_layer_overview WHERE level=?1 AND x BETWEEN ?2 AND ?3 AND y BETWEEN ?4 AND ?5 ORDER BY source DESC").map_err(storage_error)?;
    let rows = q
        .query_map(
            params![
                level,
                (b[0] / step).floor() as i32,
                (b[2] / step).ceil() as i32,
                (b[1] / step).floor() as i32,
                (b[3] / step).ceil() as i32
            ],
            |r| {
                Ok((
                    r.get::<_, i32>(0)?,
                    r.get::<_, i32>(1)?,
                    r.get::<_, u8>(2)?,
                    r.get::<_, f64>(3)?,
                    r.get::<_, f64>(4)?,
                ))
            },
        )
        .map_err(storage_error)?;
    let mut out = BTreeMap::<_, Vec<_>>::new();
    for row in rows {
        let (x, y, source, total, n) = row.map_err(storage_error)?;
        out.entry((x, y)).or_default().push((
            source,
            total / n,
            (n / 4f64.powi((level - source) as i32)).min(1.),
        ));
    }
    Ok(out)
}
