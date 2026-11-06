//! Sparse pigment tiles and a derived premultiplied color pyramid.
use super::AtlasApplication;
use crate::atlas::{
    change::Computed,
    errors::{ensure, storage_error},
    ground::*,
    Intent, Result,
};
use rusqlite::{params, Connection, OptionalExtension};
use std::collections::BTreeSet;
pub fn install(db: &Connection) -> Result<()> {
    db.execute_batch("CREATE TABLE ground_tiles(x INTEGER NOT NULL,y INTEGER NOT NULL,pixels BLOB NOT NULL,PRIMARY KEY(x,y)) WITHOUT ROWID; CREATE TABLE ground_lod(level INTEGER NOT NULL,x INTEGER NOT NULL,y INTEGER NOT NULL,pixels BLOB NOT NULL,PRIMARY KEY(level,x,y)) WITHOUT ROWID;").map_err(storage_error)
}
fn read(db: &Connection, level: u8, x: i32, y: i32) -> Result<Vec<u8>> {
    let value = if level == 0 {
        db.query_row(
            "SELECT pixels FROM ground_tiles WHERE x=?1 AND y=?2",
            params![x, y],
            |r| r.get(0),
        )
        .optional()
    } else {
        db.query_row(
            "SELECT pixels FROM ground_lod WHERE level=?1 AND x=?2 AND y=?3",
            params![level, x, y],
            |r| r.get(0),
        )
        .optional()
    }
    .map_err(storage_error)?;
    Ok(value.unwrap_or_else(|| vec![0; BYTES]))
}
fn overlay_read(db: &Connection, cache: &mut Tiles, level: u8, x: i32, y: i32) -> Result<()> {
    if let std::collections::btree_map::Entry::Vacant(e) = cache.entry((level, x, y)) {
        e.insert(read(db, level, x, y)?);
    }
    Ok(())
}
fn pyramid(db: &Connection, tiles: &mut Tiles) -> Result<()> {
    let mut keys: BTreeSet<_> = tiles
        .keys()
        .filter(|k| k.0 == 0)
        .map(|k| (k.1, k.2))
        .collect();
    for level in 1..=24 {
        keys = keys
            .into_iter()
            .map(|(x, y)| (x.div_euclid(2), y.div_euclid(2)))
            .collect();
        for &(x, y) in &keys {
            let mut parent = vec![0; BYTES];
            for cy in 0..2 {
                for cx in 0..2 {
                    let key = (level - 1, x * 2 + cx, y * 2 + cy);
                    let child = if let Some(value) = tiles.get(&key) {
                        value.clone()
                    } else {
                        read(db, key.0, key.1, key.2)?
                    };
                    for py in 0..32 {
                        for px in 0..32 {
                            for c in 0..4 {
                                let i = (py * 2 * 64 + px * 2) * 4 + c;
                                let sum = child[i] as u16
                                    + child[i + 4] as u16
                                    + child[i + 256] as u16
                                    + child[i + 260] as u16;
                                parent[((cy as usize * 32 + py) * 64 + cx as usize * 32 + px)
                                    * 4
                                    + c] = ((sum + 2) / 4) as u8;
                            }
                        }
                    }
                }
            }
            tiles.insert((level, x, y), parent);
        }
    }
    Ok(())
}
pub fn write(db: &Connection, changed: &[GroundTile]) -> Result<()> {
    let mut tiles: Tiles = changed
        .iter()
        .map(|t| ((0, t.x, t.y), t.pixels.clone()))
        .collect();
    pyramid(db, &mut tiles)?;
    for ((level, x, y), pixels) in tiles {
        let empty = pixels.iter().all(|v| *v == 0);
        if level == 0 {
            if empty { db.execute("DELETE FROM ground_tiles WHERE x=? AND y=?",params![x,y]) }
            else { db.execute("INSERT INTO ground_tiles VALUES(?,?,?) ON CONFLICT(x,y) DO UPDATE SET pixels=excluded.pixels",params![x,y,pixels]) }
        } else if empty { db.execute("DELETE FROM ground_lod WHERE level=? AND x=? AND y=?",params![level,x,y]) }
        else { db.execute("INSERT INTO ground_lod VALUES(?,?,?,?) ON CONFLICT(level,x,y) DO UPDATE SET pixels=excluded.pixels",params![level,x,y,pixels]) }.map_err(storage_error)?;
    }
    Ok(())
}
fn response(app: &AtlasApplication, args: GroundArgs, mut cache: Tiles) -> Result<GroundResponse> {
    ensure(
        args.level <= 24
            && args.tiles.len() <= 64
            && args
                .tiles
                .iter()
                .all(|p| p[0].unsigned_abs() <= 1_562_501 && p[1].unsigned_abs() <= 1_562_501),
        "Ungültige Bodenfarbkacheln",
    )?;
    let mut tiles = vec![];
    for [x, y] in args.tiles {
        // One pixel halo allows bilinear filtering across tile boundaries.
        for dy in -1..=1 {
            for dx in -1..=1 {
                overlay_read(&app.db, &mut cache, args.level, x + dx, y + dy)?;
            }
        }
        let mut pixels = vec![0; 66 * 66 * 4];
        for py in -1i32..=64 {
            for px in -1i32..=64 {
                let source = &cache[&(args.level, x + px.div_euclid(64), y + py.div_euclid(64))];
                let src = (py.rem_euclid(64) * 64 + px.rem_euclid(64)) as usize * 4;
                let dst = ((py + 1) * 66 + px + 1) as usize * 4;
                pixels[dst..dst + 4].copy_from_slice(&source[src..src + 4]);
            }
        }
        tiles.push(GroundTile { x, y, pixels });
    }
    Ok(GroundResponse {
        status: app.status(),
        level: args.level,
        tiles,
    })
}
impl AtlasApplication {
    pub(in crate::atlas) fn ground_tiles(&self, args: GroundArgs) -> Result<GroundResponse> {
        response(self, args, Tiles::new())
    }
    pub(in crate::atlas) fn compute_ground(&self, intent: &Intent) -> Result<Option<Computed>> {
        let Intent::GroundStroke { brush, view } = intent else {
            return Ok(None);
        };
        let coverage = coverage(brush)?;
        let mut before = Tiles::new();
        for &(x, y) in coverage.keys() {
            overlay_read(&self.db, &mut before, 0, x.div_euclid(64), y.div_euclid(64))?;
        }
        let mut after = before.clone();
        for ((x, y), alpha) in coverage {
            let tile = after
                .get_mut(&(0, x.div_euclid(64), y.div_euclid(64)))
                .unwrap();
            let i = (y.rem_euclid(64) * 64 + x.rem_euclid(64)) as usize * 4;
            blend(&mut tile[i..i + 4], brush.color, brush.mode, alpha);
        }
        after.retain(|k, v| before.get(k) != Some(v));
        let delta = GroundDelta {
            before: after
                .keys()
                .map(|k| GroundTile {
                    x: k.1,
                    y: k.2,
                    pixels: before[k].clone(),
                })
                .collect(),
            after: after
                .iter()
                .map(|(k, v)| GroundTile {
                    x: k.1,
                    y: k.2,
                    pixels: v.clone(),
                })
                .collect(),
        };
        let mut computed = Computed::default();
        if let Some(args) = view {
            pyramid(&self.db, &mut after)?;
            computed.ground_preview = Some(response(self, args.clone(), after)?);
        }
        if !delta.after.is_empty() {
            computed.change.ground = Some(delta);
        }
        Ok(Some(computed))
    }
}
