//! Derived city presentation. Never reads cells or exports editing geometry.
use super::AtlasApplication;
use crate::atlas::errors::{ensure, storage_error};
use crate::atlas::model::*;
use crate::atlas::Result;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(in crate::atlas) struct MapTilesArgs {
    pub level: u8,
    pub tiles: Vec<[i32; 2]>,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(in crate::atlas) struct MapFeature {
    pub id: String,
    pub kind: String,
    pub name: String,
    pub important: bool,
    pub paths: Vec<Vec<Point>>,
    pub color: String,
    pub width: f64,
    pub rank: f64,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(in crate::atlas) struct MapTile {
    pub x: i32,
    pub y: i32,
    /// Local cell x/y and fractional roof coverage; 32 cells per tile.
    pub density: Vec<[f64; 3]>,
    pub features: Vec<MapFeature>,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(in crate::atlas) struct MapTilesResponse {
    pub status: Status,
    pub level: u8,
    pub tiles: Vec<MapTile>,
}

/// Installed on the disposable working database. Transactional triggers also
/// cover import, field patches, history and rollback, without a second writer.
pub(super) fn install(db: &rusqlite::Connection) -> Result<()> {
    db.execute_batch("CREATE TABLE map_levels(level INTEGER PRIMARY KEY,size REAL NOT NULL);
        WITH RECURSIVE levels(n) AS (SELECT 0 UNION ALL SELECT n+1 FROM levels WHERE n<20)
        INSERT INTO map_levels SELECT n,16*(1<<n) FROM levels;
        CREATE TABLE map_density(level INTEGER,x INTEGER,y INTEGER,mass REAL NOT NULL,n INTEGER NOT NULL,PRIMARY KEY(level,x,y)) WITHOUT ROWID;
        CREATE INDEX objects_kind ON objects(kind);
        CREATE VIRTUAL TABLE map_houses USING rtree(
            key,min_x,max_x,min_y,max_y,min_size,max_size,
            +object_id,+important,+size,+rank);") .map_err(storage_error)?;
    // SQLite CAST truncates toward zero; floor must also work west/south of origin.
    let add = |row: &str| {
        format!("INSERT INTO map_density SELECT level,
        CAST(({row}.min_x+{row}.max_x)/2/size AS INTEGER)-(({row}.min_x+{row}.max_x)/2/size<CAST(({row}.min_x+{row}.max_x)/2/size AS INTEGER)),
        CAST(({row}.min_y+{row}.max_y)/2/size AS INTEGER)-(({row}.min_y+{row}.max_y)/2/size<CAST(({row}.min_y+{row}.max_y)/2/size AS INTEGER)),
        max(0,({row}.max_x-{row}.min_x)*({row}.max_y-{row}.min_y)),1
        FROM map_levels WHERE true ON CONFLICT(level,x,y) DO UPDATE SET mass=mass+excluded.mass,n=n+1;")
    };
    let remove = "UPDATE map_density SET mass=mass-max(0,(old.max_x-old.min_x)*(old.max_y-old.min_y)),n=n-1
        WHERE (level,x,y) IN (SELECT level,
        CAST((old.min_x+old.max_x)/2/size AS INTEGER)-((old.min_x+old.max_x)/2/size<CAST((old.min_x+old.max_x)/2/size AS INTEGER)),
        CAST((old.min_y+old.max_y)/2/size AS INTEGER)-((old.min_y+old.max_y)/2/size<CAST((old.min_y+old.max_y)/2/size AS INTEGER)) FROM map_levels);
        DELETE FROM map_density WHERE n=0;";
    // Restrict removal to these 21 cells rather than scanning empty cells globally.
    let remove = remove.replace("DELETE FROM map_density WHERE n=0;", "DELETE FROM map_density WHERE n=0 AND (level,x,y) IN (SELECT level, CAST((old.min_x+old.max_x)/2/size AS INTEGER)-((old.min_x+old.max_x)/2/size<CAST((old.min_x+old.max_x)/2/size AS INTEGER)), CAST((old.min_y+old.max_y)/2/size AS INTEGER)-((old.min_y+old.max_y)/2/size<CAST((old.min_y+old.max_y)/2/size AS INTEGER)) FROM map_levels);");
    db.execute_batch(&format!("
        CREATE TRIGGER map_insert AFTER INSERT ON objects WHEN new.kind='house' BEGIN {} END;
        CREATE TRIGGER map_delete BEFORE DELETE ON objects WHEN old.kind='house' BEGIN {remove} END;
        CREATE TRIGGER map_move BEFORE UPDATE OF min_x,min_y,max_x,max_y ON objects
        WHEN old.kind='house' AND (old.min_x!=new.min_x OR old.min_y!=new.min_y OR old.max_x!=new.max_x OR old.max_y!=new.max_y)
        BEGIN {remove} {} END;", add("new"), add("new"))).map_err(storage_error)?;
    // Index position and display eligibility together. Important places are
    // eligible at every supported map level; exact size stays in an auxiliary
    // column because RTree coordinates conservatively round to float32.
    let important = |row: &str| {
        format!("CASE WHEN json_valid({row}.body) THEN coalesce(json_extract({row}.body,'$.importantPlace'),0) ELSE 0 END")
    };
    let mark = important("new");
    let extent = "max(new.max_x-new.min_x,new.max_y-new.min_y)";
    let eligible = format!("CASE WHEN ({mark})=1 THEN 200000000.0 ELSE {extent} END");
    let insert = format!(
        "INSERT INTO map_houses SELECT new.rowid,new.min_x,new.max_x,new.min_y,new.max_y,
        {eligible},{eligible},new.id,{mark},{extent},(new.max_x-new.min_x)*(new.max_y-new.min_y)
        WHERE new.kind='house';"
    );
    db.execute_batch(&format!("
        CREATE TRIGGER map_house_insert AFTER INSERT ON objects WHEN new.kind='house' BEGIN {insert} END;
        CREATE TRIGGER map_house_delete AFTER DELETE ON objects WHEN old.kind='house'
        BEGIN DELETE FROM map_houses WHERE key=old.rowid; END;
        CREATE TRIGGER map_house_update AFTER UPDATE OF id,kind,body,min_x,max_x,min_y,max_y ON objects
        WHEN (old.kind='house' OR new.kind='house') AND (
            old.kind!=new.kind OR old.id!=new.id OR old.min_x!=new.min_x OR old.max_x!=new.max_x
            OR old.min_y!=new.min_y OR old.max_y!=new.max_y OR ({}) IS NOT ({mark}))
        BEGIN DELETE FROM map_houses WHERE key=old.rowid; {insert} END;",important("old"))).map_err(storage_error)?;
    Ok(())
}

fn sampled(points: &[Point], tolerance: f64, closed: bool) -> Vec<Point> {
    if points.len() <= 4 {
        return points.to_vec();
    }
    // Preserve turns with an iterative Douglas–Peucker pass (no recursion depth).
    let mut keep = vec![false; points.len()];
    keep[0] = true;
    keep[points.len() - 1] = true;
    let mut stack = vec![(0, points.len() - 1)];
    while let Some((a, b)) = stack.pop() {
        let p = points[a];
        let q = points[b];
        let dx = q[0] - p[0];
        let dy = q[1] - p[1];
        let d = dx * dx + dy * dy;
        let mut best = tolerance * tolerance;
        let mut index = None;
        for (i, r) in points.iter().enumerate().take(b).skip(a + 1) {
            let t = if d == 0.0 {
                0.0
            } else {
                (((r[0] - p[0]) * dx + (r[1] - p[1]) * dy) / d).clamp(0.0, 1.0)
            };
            let distance = (r[0] - p[0] - t * dx).powi(2) + (r[1] - p[1] - t * dy).powi(2);
            if distance > best {
                best = distance;
                index = Some(i);
            }
        }
        if let Some(i) = index {
            keep[i] = true;
            stack.push((a, i));
            stack.push((i, b));
        }
    }
    let result: Vec<_> = points
        .iter()
        .zip(keep)
        .filter_map(|(p, k)| k.then_some(*p))
        .collect();
    if closed && result.len() < 3 {
        points.to_vec()
    } else {
        result
    }
}

#[cfg(test)]
thread_local! {
    static PROJECTIONS: std::cell::Cell<usize> = const { std::cell::Cell::new(0) };
}

#[cfg(test)]
pub(super) fn projection_count(reset: bool) -> usize {
    PROJECTIONS.with(|count| {
        let value = count.get();
        if reset {
            count.set(0);
        }
        value
    })
}

pub(super) fn project_feature(object: SceneObject, cell_size: f64) -> Option<MapFeature> {
    #[cfg(test)]
    PROJECTIONS.with(|count| count.set(count.get() + 1));
    let b = object.bounds();
    let rank = (b[2] - b[0]) * (b[3] - b[1]);
    let mut feature = match object {
        SceneObject::House(h) => {
            let paths = h
                .contours
                .iter()
                .map(|ring| {
                    ring.iter()
                        .map(|p| {
                            let (sin, cos) = h.transform.angle.sin_cos();
                            [
                                h.transform.x + 5.0 * (p.0[0] * cos - p.0[1] * sin),
                                h.transform.y + 5.0 * (p.0[0] * sin + p.0[1] * cos),
                            ]
                        })
                        .collect::<Vec<_>>()
                })
                .collect();
            MapFeature {
                id: h.id,
                kind: "house".into(),
                name: h.name,
                important: h.important_place,
                paths,
                color: h.roof,
                width: 0.0,
                rank,
            }
        }
        SceneObject::Road(r) => MapFeature {
            id: r.id,
            kind: "road".into(),
            name: r.name,
            important: false,
            paths: vec![sampled(&r.path, cell_size / 8.0, false)],
            color: match r.material {
                RoadMaterial::Earth => "#c8b99b",
                RoadMaterial::Stone => "#aaa9a3",
            }
            .into(),
            width: r.width,
            rank: r.width * ((b[2] - b[0]).hypot(b[3] - b[1])),
        },
        SceneObject::Area(a) => MapFeature {
            id: a.id,
            kind: "area".into(),
            name: String::new(),
            important: false,
            paths: vec![sampled(&a.points, cell_size / 8.0, true)],
            color: match a.material.as_str() {
                "water" => "#91bcc5",
                "earth" => "#c8b99b",
                "stone" => "#aaa9a3",
                _ => "#9db58b",
            }
            .into(),
            width: 0.0,
            rank: a.order as f64,
        },
        SceneObject::Scenery(s) => MapFeature {
            id: s.id,
            kind: "scenery".into(),
            name: String::new(),
            important: false,
            paths: s
                .assets
                .iter()
                .step_by(s.assets.len().div_ceil(512).max(1))
                .filter(|a| a.size * 2.0 >= cell_size / 8.0)
                .map(|a| {
                    (0..8)
                        .map(|i| {
                            let t = i as f64 * std::f64::consts::TAU / 8.0;
                            [a.point[0] + a.size * t.cos(), a.point[1] + a.size * t.sin()]
                        })
                        .collect()
                })
                .collect(),
            color: match s.biome {
                crate::atlas::scenery::Biome::Forest => "#477148",
                crate::atlas::scenery::Biome::Meadow => "#8ca55b",
                crate::atlas::scenery::Biome::Scrub => "#70834b",
                crate::atlas::scenery::Biome::Rocks => "#929083",
            }
            .into(),
            width: 0.0,
            rank,
        },
        SceneObject::Parcel(_) => return None,
    };
    // Increase presentation tolerance for unusually complex
    // paths; never transfer unbounded editing geometry.
    let mut tolerance = cell_size / 8.0;
    while feature.paths.iter().map(Vec::len).sum::<usize>() > 4096 && tolerance < 20_000_000.0 {
        tolerance *= 2.0;
        feature.paths = feature
            .paths
            .iter()
            .map(|p| sampled(p, tolerance, feature.kind != "road"))
            .collect();
    }
    if feature.paths.iter().map(Vec::len).sum::<usize>() > 4096 {
        // A house with thousands of disconnected rings remains
        // represented by density and a label anchor, not a fake roof.
        feature.paths = vec![vec![[(b[0] + b[2]) / 2.0, (b[1] + b[3]) / 2.0]]];
    }
    Some(feature)
}

impl AtlasApplication {
    pub(in crate::atlas) fn map_tiles(&self, args: MapTilesArgs) -> Result<MapTilesResponse> {
        let mut cache = HashMap::<String, MapFeature>::new();
        self.map_tiles_with(args, |id, body, size| {
            if let Some(feature) = cache.get(&id) {
                return Ok(Some(feature.clone()));
            }
            let object = serde_json::from_str(&body).map_err(storage_error)?;
            let feature = project_feature(object, size);
            if let Some(feature) = &feature {
                cache.insert(id, feature.clone());
            }
            Ok(feature)
        })
    }

    pub(super) fn map_tiles_with(
        &self,
        args: MapTilesArgs,
        mut project: impl FnMut(String, String, f64) -> Result<Option<MapFeature>>,
    ) -> Result<MapTilesResponse> {
        ensure(
            args.level <= 20 && args.tiles.len() <= 64,
            "Ungültige Kartenkacheln",
        )?;
        let size = 16.0 * 2_f64.powi(args.level.into());
        let mut tiles = Vec::new();
        for [x, y] in args.tiles {
            let left = f64::from(x) * 32.0 * size;
            let top = f64::from(y) * 32.0 * size;
            ensure(
                left.abs() <= 100_000_000.0 + size * 32.0
                    && top.abs() <= 100_000_000.0 + size * 32.0,
                "Ungültige Kartenkachel",
            )?;
            // Equality on level/X lets the composite primary key also bound Y.
            // CROSS JOIN keeps the 32 columns outside the indexed range lookup;
            // a single X range would scan distant north/south cells as well.
            let mut query = self
                .db
                .prepare_cached(
                    "WITH RECURSIVE columns(x) AS (
                SELECT ?2 UNION ALL SELECT x+1 FROM columns WHERE x+1<?3)
                SELECT d.x,d.y,d.mass FROM columns c CROSS JOIN map_density d
                WHERE d.level=?1 AND d.x=c.x AND d.y>=?4 AND d.y<?5 AND d.n>0
                ORDER BY d.x,d.y",
                )
                .map_err(storage_error)?;
            let density = query
                .query_map(
                    params![
                        args.level,
                        i64::from(x) * 32,
                        i64::from(x) * 32 + 32,
                        i64::from(y) * 32,
                        i64::from(y) * 32 + 32
                    ],
                    |r| {
                        Ok([
                            r.get::<_, f64>(0)? - f64::from(x) * 32.0,
                            r.get::<_, f64>(1)? - f64::from(y) * 32.0,
                            (r.get::<_, f64>(2)? / (size * size)).clamp(0.0, 1.0),
                        ])
                    },
                )
                .map_err(storage_error)?
                .collect::<rusqlite::Result<Vec<_>>>()
                .map_err(storage_error)?;
            let mut features = Vec::new();
            for kind in ["area", "scenery", "road", "house"] {
                // LIMIT precedes JSON decoding. Density remains complete when
                // the bounded individual presentation is saturated.
                let sql = if kind == "house" {
                    // Materialize only ranked scalar headers before fetching
                    // up to 128 JSON bodies. Both XY and eligibility prune in
                    // the RTree before offscreen/below-scale rows reach ranking.
                    "WITH selected AS MATERIALIZED (
                        SELECT key,object_id,important,rank FROM map_houses
                        WHERE min_x<=?1 AND max_x>=?2 AND min_y<=?3 AND max_y>=?4
                            AND max_size>=?5 AND (important=1 OR size>=?5)
                        ORDER BY important DESC,rank DESC,object_id LIMIT 128)
                    SELECT s.object_id,o.body FROM selected s CROSS JOIN objects o ON o.rowid=s.key
                    ORDER BY s.important DESC,s.rank DESC,s.object_id"
                        .to_owned()
                } else {
                    let rank = if kind == "road" {
                        "json_extract(o.body,'$.width') * max(o.max_x-o.min_x,o.max_y-o.min_y)"
                    } else {
                        "(o.max_x-o.min_x)*(o.max_y-o.min_y)"
                    };
                    format!("SELECT o.id,o.body FROM objects o JOIN spatial s ON o.rowid=s.key WHERE s.min_x<=?1 AND s.max_x>=?2 AND s.min_y<=?3 AND s.max_y>=?4 AND o.kind=?5 ORDER BY {rank} DESC,o.id LIMIT 128")
                };
                let mut q = self.db.prepare_cached(&sql).map_err(storage_error)?;
                let bounds = [
                    left + size * 32. + size,
                    left - size,
                    top + size * 32. + size,
                    top - size,
                ];
                let mut rows = if kind == "house" {
                    let minimum = if args.level > 2 { size * 0.75 } else { 0. };
                    q.query(params![bounds[0], bounds[1], bounds[2], bounds[3], minimum])
                } else {
                    q.query(params![bounds[0], bounds[1], bounds[2], bounds[3], kind])
                }
                .map_err(storage_error)?;
                while let Some(row) = rows.next().map_err(storage_error)? {
                    let id = row.get(0).map_err(storage_error)?;
                    let body = row.get(1).map_err(storage_error)?;
                    if let Some(feature) = project(id, body, size)? {
                        features.push(feature);
                    }
                }
            }
            tiles.push(MapTile {
                x,
                y,
                density,
                features,
            });
        }
        Ok(MapTilesResponse {
            status: self.status(),
            level: args.level,
            tiles,
        })
    }
}
