//! Sparse multiresolution pigment authors and derived resolved overviews.
use super::AtlasApplication;
use crate::atlas::{
    change::Computed,
    errors::{ensure, storage_error},
    ground::*,
    Intent, Result,
};
use rusqlite::{params, Connection, OptionalExtension};
use std::collections::BTreeSet;
type Key = (u8, i32, i32);
pub fn install(db: &Connection) -> Result<()> {
    db.execute_batch("CREATE TABLE ground_tiles(level INTEGER NOT NULL,x INTEGER NOT NULL,y INTEGER NOT NULL,pixels BLOB NOT NULL,PRIMARY KEY(level,x,y)) WITHOUT ROWID; CREATE TABLE ground_lod(level INTEGER NOT NULL,x INTEGER NOT NULL,y INTEGER NOT NULL,pixels BLOB NOT NULL,PRIMARY KEY(level,x,y)) WITHOUT ROWID;").map_err(storage_error)
}
fn raw(db: &Connection, table: &str, key: Key) -> Result<Option<Vec<u8>>> {
    db.query_row(
        &format!("SELECT pixels FROM {table} WHERE level=?1 AND x=?2 AND y=?3"),
        params![key.0, key.1, key.2],
        |r| r.get(0),
    )
    .optional()
    .map_err(storage_error)
}
// Authors replace the inherited tile, including transparent pixels. Missing authors
// inherit the nearest coarser author; derived overview pixels never feed inheritance.
fn base(db: &Connection, authors: &Tiles, key: Key) -> Result<Vec<u8>> {
    for level in key.0..=24 {
        let factor = 1i32 << (level - key.0);
        let parent = (level, key.1.div_euclid(factor), key.2.div_euclid(factor));
        let value = match authors.get(&parent) {
            Some(v) => {
                if v.is_empty() {
                    None
                } else {
                    Some(v.clone())
                }
            }
            None => raw(db, "ground_tiles", parent)?,
        };
        if let Some(value) = value {
            if level == key.0 {
                return Ok(value);
            }
            let mut out = vec![0; BYTES];
            for y in 0..64 {
                for x in 0..64 {
                    let px = (key.1.rem_euclid(factor) as i64 * 64 + x) / factor as i64;
                    let py = (key.2.rem_euclid(factor) as i64 * 64 + y) / factor as i64;
                    let src = (py * 64 + px) as usize * 4;
                    let dst = (y * 64 + x) as usize * 4;
                    for offset in [0, PLANE_BYTES] {
                        out[offset + dst..offset + dst + 4]
                            .copy_from_slice(&value[offset + src..offset + src + 4]);
                    }
                }
            }
            return Ok(out);
        }
    }
    Ok(vec![0; BYTES])
}
fn resolved(db: &Connection, authors: &Tiles, overview: &Tiles, key: Key) -> Result<Vec<u8>> {
    if let Some(v) = overview.get(&key) {
        return Ok(v.clone());
    }
    if let Some(v) = raw(db, "ground_lod", key)? {
        return Ok(v);
    }
    base(db, authors, key)
}
fn read(db: &Connection, level: u8, x: i32, y: i32) -> Result<Vec<u8>> {
    resolved(db, &Tiles::new(), &Tiles::new(), (level, x, y))
}
fn overlay_read(db: &Connection, cache: &mut Tiles, level: u8, x: i32, y: i32) -> Result<()> {
    if let std::collections::btree_map::Entry::Vacant(e) = cache.entry((level, x, y)) {
        e.insert(read(db, level, x, y)?);
    }
    Ok(())
}
fn affected(db: &Connection, authors: &Tiles) -> Result<BTreeSet<Key>> {
    let mut keys = BTreeSet::new();
    let mut q=db.prepare("SELECT level,x,y FROM ground_lod WHERE level=?1 AND x BETWEEN ?2 AND ?3 AND y BETWEEN ?4 AND ?5").map_err(storage_error)?;
    for &(level, x, y) in authors.keys() {
        for l in level..=24 {
            let f = 1i32 << (l - level);
            keys.insert((l, x.div_euclid(f), y.div_euclid(f)));
        }
        for l in 1..level {
            let f = 1i64 << (level - l);
            let rows = q
                .query_map(
                    params![
                        l,
                        x as i64 * f,
                        (x as i64 + 1) * f - 1,
                        y as i64 * f,
                        (y as i64 + 1) * f - 1
                    ],
                    |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
                )
                .map_err(storage_error)?;
            for row in rows {
                keys.insert(row.map_err(storage_error)?);
            }
        }
    }
    Ok(keys)
}
fn pyramid(db: &Connection, authors: &Tiles) -> Result<Tiles> {
    let mut out = Tiles::new();
    for key in affected(db, authors)? {
        let (level, x, y) = key;
        // Every quadrant is replaced below; only leaf authors need an initial read.
        let mut parent = if level == 0 {
            base(db, authors, key)?
        } else {
            vec![0; BYTES]
        };
        if level > 0 {
            for cy in 0..2 {
                for cx in 0..2 {
                    let child = (level - 1, x * 2 + cx, y * 2 + cy);
                    let value = resolved(db, authors, &out, child)?;
                    downsample_quadrant(&mut parent, &value, cx as usize, cy as usize);
                }
            }
        }
        out.insert(key, parent);
    }
    Ok(out)
}
#[cfg(test)]
thread_local! {static FINISHED:std::cell::RefCell<Vec<Key>>=const {std::cell::RefCell::new(Vec::new())};}
#[cfg(test)]
pub(super) fn take_finished() -> Vec<Key> {
    FINISHED.with(|v| std::mem::take(&mut *v.borrow_mut()))
}
fn put(db: &Connection, table: &str, key: Key, pixels: &[u8]) -> Result<()> {
    if pixels.is_empty() {
        db.execute(&format!("DELETE FROM {table} WHERE level=? AND x=? AND y=?"),params![key.0,key.1,key.2])
    } else {
        db.execute(&format!("INSERT INTO {table} VALUES(?,?,?,?) ON CONFLICT(level,x,y) DO UPDATE SET pixels=excluded.pixels"),params![key.0,key.1,key.2,pixels])
    }.map_err(storage_error)?;
    Ok(())
}
pub fn write_authors(db: &Connection, changed: &[GroundAuthorTile]) -> Result<()> {
    let authors: Tiles = changed
        .iter()
        .map(|t| ((t.level, t.x, t.y), t.pixels.clone()))
        .collect();
    let overview = pyramid(db, &authors)?;
    for (key, pixels) in authors {
        put(db, "ground_tiles", key, &pixels)?;
    }
    for (key, pixels) in overview {
        if key.0 > 0 {
            let inherited = base(db, &Tiles::new(), key)?;
            put(
                db,
                "ground_lod",
                key,
                if pixels == inherited { &[] } else { &pixels },
            )?;
        }
    }
    Ok(())
}
#[cfg(test)]
pub fn write(db: &Connection, changed: &[GroundTile]) -> Result<()> {
    write_authors(
        db,
        &changed
            .iter()
            .map(|t| GroundAuthorTile {
                level: 0,
                x: t.x,
                y: t.y,
                pixels: t.pixels.clone(),
            })
            .collect::<Vec<_>>(),
    )
}
pub fn rebuild_overview(db: &Connection) -> Result<()> {
    db.execute("DELETE FROM ground_lod", [])
        .map_err(storage_error)?;
    let mut q = db
        .prepare("SELECT level,x,y FROM ground_tiles")
        .map_err(storage_error)?;
    let mut keys = BTreeSet::new();
    let rows = q
        .query_map([], |r| {
            Ok((r.get::<_, u8>(0)?, r.get::<_, i32>(1)?, r.get::<_, i32>(2)?))
        })
        .map_err(storage_error)?;
    for row in rows {
        let (level, x, y) = row.map_err(storage_error)?;
        for l in level.max(1)..=24 {
            let f = 1i32 << (l - level);
            keys.insert((l, x.div_euclid(f), y.div_euclid(f)));
        }
    }
    for key in keys {
        let (level, x, y) = key;
        let mut parent = vec![0; BYTES];
        for cy in 0..2 {
            for cx in 0..2 {
                let child = read(db, level - 1, x * 2 + cx, y * 2 + cy)?;
                downsample_quadrant(&mut parent, &child, cx as usize, cy as usize);
            }
        }
        #[cfg(test)]
        FINISHED.with(|v| v.borrow_mut().push(key));
        let inherited = base(db, &Tiles::new(), key)?;
        put(
            db,
            "ground_lod",
            key,
            if parent == inherited { &[] } else { &parent },
        )?;
    }
    Ok(())
}
fn validate_args(args: &GroundArgs) -> Result<()> {
    ensure(
        args.level <= 24
            && args.tiles.len() <= 64
            && args
                .tiles
                .iter()
                .all(|p| p[0].unsigned_abs() <= 1_562_501 && p[1].unsigned_abs() <= 1_562_501),
        "Ungültige Bodenfarbkacheln",
    )
}
fn response(app: &AtlasApplication, args: GroundArgs, mut cache: Tiles) -> Result<GroundResponse> {
    validate_args(&args)?;
    let mut tiles = vec![];
    for [x, y] in args.tiles {
        // One pixel halo allows bilinear filtering across tile boundaries.
        for dy in -1..=1 {
            for dx in -1..=1 {
                overlay_read(&app.db, &mut cache, args.level, x + dx, y + dy)?;
            }
        }
        let plane = 66 * 66 * 4;
        let mut pixels = vec![0; plane * 2];
        for py in -1i32..=64 {
            for px in -1i32..=64 {
                let source = &cache[&(args.level, x + px.div_euclid(64), y + py.div_euclid(64))];
                let src = (py.rem_euclid(64) * 64 + px.rem_euclid(64)) as usize * 4;
                let dst = ((py + 1) * 66 + px + 1) as usize * 4;
                for layer in 0..2 {
                    pixels[layer * plane + dst..layer * plane + dst + 4].copy_from_slice(
                        &source[layer * PLANE_BYTES + src..layer * PLANE_BYTES + src + 4],
                    );
                }
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
        let plane = if matches!(brush.layer, Some(GroundLayer::Rock)) {
            PLANE_BYTES
        } else {
            0
        };
        let level = brush.resolution.unwrap_or(0);
        ensure(level <= 24, "Ungültige Bodenauflösung")?;
        // Validate world coordinates before converting to the author raster.
        ensure(
            brush
                .points
                .iter()
                .all(|p| crate::atlas::geometry::valid_point([p[0], p[1]])),
            "Ungültiger Bodenpinsel-Pfad",
        )?;
        let step = (1u32 << level) as f64;
        let mut local = brush.clone();
        local.diameter /= step;
        for p in &mut local.points {
            p[0] /= step;
            p[1] /= step;
        }
        let mut coverage = coverage(&local)?;
        coverage.retain(|&(x, y), _| {
            ((x as f64 + 0.5) * step).abs() <= 100_000_000.0
                && ((y as f64 + 0.5) * step).abs() <= 100_000_000.0
        });
        let mut before = Tiles::new();
        let mut after = Tiles::new();
        for &(x, y) in coverage.keys() {
            let key = (level, x.div_euclid(64), y.div_euclid(64));
            if let std::collections::btree_map::Entry::Vacant(e) = after.entry(key) {
                before.insert(key, raw(&self.db, "ground_tiles", key)?.unwrap_or_default());
                e.insert(base(&self.db, &Tiles::new(), key)?);
            }
        }
        for (&(x, y), &alpha) in &coverage {
            let tile = after
                .get_mut(&(level, x.div_euclid(64), y.div_euclid(64)))
                .unwrap();
            let i = plane + (y.rem_euclid(64) * 64 + x.rem_euclid(64)) as usize * 4;
            blend(&mut tile[i..i + 4], brush.color, brush.mode, alpha);
        }
        // Apply the same coarse pigment operation to existing finer authors.
        // Never materialize missing fine tiles beneath a world-sized stroke.
        let mut q=self.db.prepare("SELECT level,x,y,pixels FROM ground_tiles WHERE level=?1 AND x BETWEEN ?2 AND ?3 AND y BETWEEN ?4 AND ?5").map_err(storage_error)?;
        let roots: Vec<_> = after.keys().copied().collect();
        let mut finer = BTreeSet::new();
        for (_, x, y) in roots {
            for l in 0..level {
                let f = 1i64 << (level - l);
                let rows = q
                    .query_map(
                        params![
                            l,
                            x as i64 * f,
                            (x as i64 + 1) * f - 1,
                            y as i64 * f,
                            (y as i64 + 1) * f - 1
                        ],
                        |r| {
                            Ok((
                                (r.get::<_, u8>(0)?, r.get::<_, i32>(1)?, r.get::<_, i32>(2)?),
                                r.get::<_, Vec<u8>>(3)?,
                            ))
                        },
                    )
                    .map_err(storage_error)?;
                for row in rows {
                    let (key, pixels) = row.map_err(storage_error)?;
                    if !finer.insert(key) {
                        continue;
                    }
                    ensure(
                        finer.len() * 4096 + coverage.len() <= 1_000_000,
                        "Bodenpinselstrich überschreitet eine Million Pixel",
                    )?;
                    let mut changed = pixels.clone();
                    let factor = 1i64 << (level - l);
                    for py in 0..64 {
                        for px in 0..64 {
                            let cx = (key.1 as i64 * 64 + px).div_euclid(factor) as i32;
                            let cy = (key.2 as i64 * 64 + py).div_euclid(factor) as i32;
                            if let Some(&alpha) = coverage.get(&(cx, cy)) {
                                let i = plane + (py * 64 + px) as usize * 4;
                                blend(&mut changed[i..i + 4], brush.color, brush.mode, alpha);
                            }
                        }
                    }
                    if changed != pixels {
                        before.insert(key, pixels);
                        after.insert(key, changed);
                    }
                }
            }
        }
        let mut changed = Tiles::new();
        for (key, pixels) in after {
            if pixels != base(&self.db, &Tiles::new(), key)? {
                changed.insert(key, pixels);
            }
        }
        let author = |(key, pixels): (Key, Vec<u8>)| GroundAuthorTile {
            level: key.0,
            x: key.1,
            y: key.2,
            pixels,
        };
        let delta = GroundDelta {
            before: changed
                .keys()
                .map(|k| author((*k, before[k].clone())))
                .collect(),
            after: changed
                .iter()
                .map(|(k, v)| author((*k, v.clone())))
                .collect(),
        };
        let mut computed = Computed::default();
        if let Some(args) = view {
            validate_args(args)?;
            let mut cache = pyramid(&self.db, &changed)?;
            // Requested fine tiles may inherit newly painted coarse authors.
            for [x, y] in &args.tiles {
                for dy in -1..=1 {
                    for dx in -1..=1 {
                        let key = (args.level, x + dx, y + dy);
                        if let std::collections::btree_map::Entry::Vacant(e) = cache.entry(key) {
                            e.insert(resolved(&self.db, &changed, &Tiles::new(), key)?);
                        }
                    }
                }
            }
            computed.ground_preview = Some(response(self, args.clone(), cache)?);
        }
        if !delta.after.is_empty() {
            computed.change.ground = Some(delta);
        }
        Ok(Some(computed))
    }
}
