//! Shared sparse raster mechanics for independent pigment and landscape authors.
//! Table names and layout are selected internally; public transports stay distinct.
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
    db.execute_batch("CREATE TABLE landscape_tiles(level INTEGER NOT NULL,x INTEGER NOT NULL,y INTEGER NOT NULL,pixels BLOB NOT NULL,PRIMARY KEY(level,x,y)) WITHOUT ROWID; CREATE TABLE landscape_lod(level INTEGER NOT NULL,x INTEGER NOT NULL,y INTEGER NOT NULL,pixels BLOB NOT NULL,PRIMARY KEY(level,x,y)) WITHOUT ROWID;").map_err(storage_error)?;
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
fn base(kind: RasterKind, db: &Connection, authors: &Tiles, key: Key) -> Result<Vec<u8>> {
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
            None => raw(db, kind.authors(), parent)?,
        };
        if let Some(value) = value {
            if level == key.0 {
                return Ok(value);
            }
            let mut out = vec![0; kind.bytes()];
            for y in 0..64 {
                for x in 0..64 {
                    let px = (key.1.rem_euclid(factor) as i64 * 64 + x) / factor as i64;
                    let py = (key.2.rem_euclid(factor) as i64 * 64 + y) / factor as i64;
                    let src = (py * 64 + px) as usize * 4;
                    let dst = (y * 64 + x) as usize * 4;
                    for offset in (0..kind.bytes()).step_by(PLANE_BYTES) {
                        out[offset + dst..offset + dst + 4]
                            .copy_from_slice(&value[offset + src..offset + src + 4]);
                    }
                }
            }
            return Ok(out);
        }
    }
    Ok(vec![0; kind.bytes()])
}
fn resolved(
    kind: RasterKind,
    db: &Connection,
    authors: &Tiles,
    overview: &Tiles,
    key: Key,
) -> Result<Vec<u8>> {
    if let Some(v) = overview.get(&key) {
        return Ok(v.clone());
    }
    if let Some(v) = raw(db, kind.overview(), key)? {
        return Ok(v);
    }
    base(kind, db, authors, key)
}
fn read(kind: RasterKind, db: &Connection, level: u8, x: i32, y: i32) -> Result<Vec<u8>> {
    resolved(kind, db, &Tiles::new(), &Tiles::new(), (level, x, y))
}
fn overlay_read(
    kind: RasterKind,
    db: &Connection,
    cache: &mut Tiles,
    level: u8,
    x: i32,
    y: i32,
) -> Result<()> {
    if let std::collections::btree_map::Entry::Vacant(e) = cache.entry((level, x, y)) {
        e.insert(read(kind, db, level, x, y)?);
    }
    Ok(())
}
fn affected(kind: RasterKind, db: &Connection, authors: &Tiles) -> Result<BTreeSet<Key>> {
    let mut keys = BTreeSet::new();
    let mut q=db.prepare(&format!("SELECT level,x,y FROM {} WHERE level=?1 AND x BETWEEN ?2 AND ?3 AND y BETWEEN ?4 AND ?5",kind.overview())).map_err(storage_error)?;
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
fn pyramid(kind: RasterKind, db: &Connection, authors: &Tiles) -> Result<Tiles> {
    let mut out = Tiles::new();
    for key in affected(kind, db, authors)? {
        let (level, x, y) = key;
        // Every quadrant is replaced below; only leaf authors need an initial read.
        let mut parent = if level == 0 {
            base(kind, db, authors, key)?
        } else {
            vec![0; kind.bytes()]
        };
        if level > 0 {
            for cy in 0..2 {
                for cx in 0..2 {
                    let child = (level - 1, x * 2 + cx, y * 2 + cy);
                    let value = resolved(kind, db, authors, &out, child)?;
                    downsample_quadrant(&mut parent, &value, cx as usize, cy as usize);
                }
            }
        }
        kind.normalize(&mut parent);
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
fn write_kind(kind: RasterKind, db: &Connection, changed: &[GroundAuthorTile]) -> Result<()> {
    let authors: Tiles = changed
        .iter()
        .map(|t| ((t.level, t.x, t.y), t.pixels.clone()))
        .collect();
    let overview = pyramid(kind, db, &authors)?;
    for (key, pixels) in authors {
        put(db, kind.authors(), key, &pixels)?;
    }
    for (key, pixels) in overview {
        if key.0 > 0 {
            let inherited = base(kind, db, &Tiles::new(), key)?;
            put(
                db,
                kind.overview(),
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
fn rebuild_kind(kind: RasterKind, db: &Connection) -> Result<()> {
    db.execute(&format!("DELETE FROM {}", kind.overview()), [])
        .map_err(storage_error)?;
    let mut q = db
        .prepare(&format!("SELECT level,x,y FROM {}", kind.authors()))
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
        let mut parent = vec![0; kind.bytes()];
        for cy in 0..2 {
            for cx in 0..2 {
                let child = read(kind, db, level - 1, x * 2 + cx, y * 2 + cy)?;
                downsample_quadrant(&mut parent, &child, cx as usize, cy as usize);
            }
        }
        kind.normalize(&mut parent);
        #[cfg(test)]
        FINISHED.with(|v| v.borrow_mut().push(key));
        let inherited = base(kind, db, &Tiles::new(), key)?;
        put(
            db,
            kind.overview(),
            key,
            if parent == inherited { &[] } else { &parent },
        )?;
    }
    Ok(())
}
fn validate_args(kind: RasterKind, args: &GroundArgs) -> Result<()> {
    ensure(
        args.level <= 24
            && args.tiles.len() <= 64
            && args
                .tiles
                .iter()
                .all(|p| p[0].unsigned_abs() <= 1_562_501 && p[1].unsigned_abs() <= 1_562_501),
        &format!("Ungültige {}-Kacheln", kind.label()),
    )
}
fn response(
    kind: RasterKind,
    app: &AtlasApplication,
    args: GroundArgs,
    mut cache: Tiles,
) -> Result<GroundResponse> {
    validate_args(kind, &args)?;
    // With no authors, every requested tile and its halo are empty. Avoid
    // probing all inheritance levels and assembling neighbors for unused layers.
    if cache.is_empty()
        && !app
            .db
            .query_row(
                &format!("SELECT EXISTS(SELECT 1 FROM {})", kind.authors()),
                [],
                |r| r.get::<_, bool>(0),
            )
            .map_err(storage_error)?
    {
        return Ok(GroundResponse {
            status: app.status(),
            level: args.level,
            tiles: args
                .tiles
                .into_iter()
                .map(|[x, y]| GroundTile {
                    x,
                    y,
                    pixels: Vec::new(),
                })
                .collect(),
        });
    }
    let mut tiles = vec![];
    for [x, y] in args.tiles {
        // One pixel halo allows bilinear filtering across tile boundaries.
        for dy in -1..=1 {
            for dx in -1..=1 {
                overlay_read(kind, &app.db, &mut cache, args.level, x + dx, y + dy)?;
            }
        }
        let plane = 66 * 66 * 4;
        let mut pixels = vec![0; plane * kind.planes()];
        for py in -1i32..=64 {
            for px in -1i32..=64 {
                let source = &cache[&(args.level, x + px.div_euclid(64), y + py.div_euclid(64))];
                let src = (py.rem_euclid(64) * 64 + px.rem_euclid(64)) as usize * 4;
                let dst = ((py + 1) * 66 + px + 1) as usize * 4;
                for layer in 0..kind.planes() {
                    pixels[layer * plane + dst..layer * plane + dst + 4].copy_from_slice(
                        &source[layer * PLANE_BYTES + src..layer * PLANE_BYTES + src + 4],
                    );
                }
            }
        }
        // Include both pigment planes and the full halo in the empty test.
        if pixels.iter().all(|&v| v == 0) {
            pixels.clear();
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
        response(RasterKind::Ground, self, args, Tiles::new())
    }
    pub(in crate::atlas) fn compute_ground(&self, intent: &Intent) -> Result<Option<Computed>> {
        let (kind, brush, view, landscape) = match intent {
            Intent::GroundStroke { brush, view } => {
                (RasterKind::Ground, brush.clone(), view.clone(), None)
            }
            Intent::LandscapeStroke { brush, view } => (
                RasterKind::Landscape,
                brush.ground_brush(),
                view.clone().map(Into::into),
                Some(brush),
            ),
            _ => return Ok(None),
        };
        if let Some(b) = landscape {
            ensure(
                b.density.is_finite() && (0.01..=1.).contains(&b.density),
                "Ungültige Landschaftsdichte",
            )?;
        }
        let plane = if matches!(brush.layer, Some(GroundLayer::Rock)) {
            PLANE_BYTES
        } else {
            0
        };
        let level = brush.resolution.unwrap_or(0);
        ensure(
            level <= 24,
            &format!("Ungültige {}-Auflösung", kind.label()),
        )?;
        // Validate world coordinates before converting to the author raster.
        ensure(
            brush
                .points
                .iter()
                .all(|p| crate::atlas::geometry::valid_point([p[0], p[1]])),
            &format!("Ungültiger {}-Pfad", kind.label()),
        )?;
        let step = (1u32 << level) as f64;
        let mut local = brush.clone();
        local.diameter /= step;
        for p in &mut local.points {
            p[0] /= step;
            p[1] /= step;
        }
        let mut coverage = match kind {
            RasterKind::Ground => coverage(&local)?,
            RasterKind::Landscape => crate::atlas::ground::coverage_named(&local, kind.label())?,
        };
        coverage.retain(|&(x, y), _| {
            ((x as f64 + 0.5) * step).abs() <= 100_000_000.0
                && ((y as f64 + 0.5) * step).abs() <= 100_000_000.0
        });
        let mut before = Tiles::new();
        let mut after = Tiles::new();
        for &(x, y) in coverage.keys() {
            let key = (level, x.div_euclid(64), y.div_euclid(64));
            if let std::collections::btree_map::Entry::Vacant(e) = after.entry(key) {
                before.insert(key, raw(&self.db, kind.authors(), key)?.unwrap_or_default());
                e.insert(base(kind, &self.db, &Tiles::new(), key)?);
            }
        }
        for (&(x, y), &alpha) in &coverage {
            let tile = after
                .get_mut(&(level, x.div_euclid(64), y.div_euclid(64)))
                .unwrap();
            let i = plane + (y.rem_euclid(64) * 64 + x.rem_euclid(64)) as usize * 4;
            apply_pixel(&mut tile[i..i + 4], &brush, landscape, alpha);
        }
        // Apply the same coarse pigment operation to existing finer authors.
        // Never materialize missing fine tiles beneath a world-sized stroke.
        let mut q=self.db.prepare(&format!("SELECT level,x,y,pixels FROM {} WHERE level=?1 AND x BETWEEN ?2 AND ?3 AND y BETWEEN ?4 AND ?5",kind.authors())).map_err(storage_error)?;
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
                        &format!("{}strich überschreitet eine Million Pixel", kind.label()),
                    )?;
                    let mut changed = pixels.clone();
                    let factor = 1i64 << (level - l);
                    for py in 0..64 {
                        for px in 0..64 {
                            let cx = (key.1 as i64 * 64 + px).div_euclid(factor) as i32;
                            let cy = (key.2 as i64 * 64 + py).div_euclid(factor) as i32;
                            if let Some(&alpha) = coverage.get(&(cx, cy)) {
                                let i = plane + (py * 64 + px) as usize * 4;
                                apply_pixel(&mut changed[i..i + 4], &brush, landscape, alpha);
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
            if pixels != base(kind, &self.db, &Tiles::new(), key)? {
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
            validate_args(kind, &args)?;
            let mut cache = pyramid(kind, &self.db, &changed)?;
            // Requested fine tiles may inherit newly painted coarse authors.
            for [x, y] in &args.tiles {
                for dy in -1..=1 {
                    for dx in -1..=1 {
                        let key = (args.level, x + dx, y + dy);
                        if let std::collections::btree_map::Entry::Vacant(e) = cache.entry(key) {
                            e.insert(resolved(kind, &self.db, &changed, &Tiles::new(), key)?);
                        }
                    }
                }
            }
            let raster = response(kind, self, args.clone(), cache)?;
            if landscape.is_some() {
                computed.landscape_preview = Some(raster.into());
            } else {
                computed.ground_preview = Some(raster);
            }
        }
        if !delta.after.is_empty() {
            if landscape.is_some() {
                computed.change.landscape = Some(delta);
            } else {
                computed.change.ground = Some(delta);
            }
        }
        Ok(Some(computed))
    }
}

#[derive(Clone, Copy)]
enum RasterKind {
    Ground,
    Landscape,
}
impl RasterKind {
    fn label(self) -> &'static str {
        match self {
            Self::Ground => "Bodenpinsel",
            Self::Landscape => "Landschaftspinsel",
        }
    }
    fn authors(self) -> &'static str {
        match self {
            Self::Ground => "ground_tiles",
            Self::Landscape => "landscape_tiles",
        }
    }
    fn overview(self) -> &'static str {
        match self {
            Self::Ground => "ground_lod",
            Self::Landscape => "landscape_lod",
        }
    }
    fn planes(self) -> usize {
        match self {
            Self::Ground => 2,
            Self::Landscape => 1,
        }
    }
    fn bytes(self) -> usize {
        self.planes() * PLANE_BYTES
    }
    fn normalize(self, pixels: &mut [u8]) {
        if matches!(self, Self::Landscape) {
            for p in pixels.as_chunks_mut::<4>().0 {
                crate::atlas::landscape::normalize(p);
            }
        }
    }
}
pub fn write_authors(db: &Connection, changed: &[GroundAuthorTile]) -> Result<()> {
    write_kind(RasterKind::Ground, db, changed)
}
pub fn write_landscape(db: &Connection, changed: &[GroundAuthorTile]) -> Result<()> {
    write_kind(RasterKind::Landscape, db, changed)
}
pub fn rebuild_overview(db: &Connection) -> Result<()> {
    rebuild_kind(RasterKind::Ground, db)
}
pub fn rebuild_landscape(db: &Connection) -> Result<()> {
    rebuild_kind(RasterKind::Landscape, db)
}
fn apply_pixel(
    pixel: &mut [u8],
    brush: &GroundBrush,
    landscape: Option<&crate::atlas::landscape::LandscapeBrush>,
    alpha: f64,
) {
    if let Some(b) = landscape {
        crate::atlas::landscape::blend(pixel, b, alpha);
    } else {
        blend(pixel, brush.color, brush.mode, alpha);
    }
}
impl AtlasApplication {
    pub(in crate::atlas) fn landscape_tiles(
        &self,
        args: crate::atlas::landscape::LandscapeArgs,
    ) -> Result<crate::atlas::landscape::LandscapeResponse> {
        Ok(response(RasterKind::Landscape, self, args.into(), Tiles::new())?.into())
    }
}
