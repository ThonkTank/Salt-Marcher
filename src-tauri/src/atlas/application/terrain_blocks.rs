//! Disposable spatial summaries and bounded canonical point/display sampling.
//! Area authoring keeps its exact read limits; sampling never materializes a whole area.
use crate::atlas::{errors::storage_error, terrain, Bounds, Point, Result};
use rusqlite::{params, Connection, OptionalExtension};
use std::collections::HashMap;
const DEPTH: u8 = 24;
const BLOCK: i32 = 16;
const BLOCK_CACHE: usize = 64;
const NODE_CACHE: usize = 4096;
const PATCH_CACHE: usize = 2048;
struct Patch {
    values: [f64; 16],
    mask: [f64; 16],
    constant: Option<(f64, bool)>,
    empty: bool,
}
fn coefficients(samples: &[f64; 16]) -> [f64; 16] {
    let basis = [
        [1. / 6., 4. / 6., 1. / 6., 0.],
        [-0.5, 0., 0.5, 0.],
        [0.5, -1., 0.5, 0.],
        [-1. / 6., 0.5, -0.5, 1. / 6.],
    ];
    let mut result = [0.; 16];
    for y in 0..4 {
        for x in 0..4 {
            for j in 0..4 {
                for i in 0..4 {
                    result[y * 4 + x] += basis[y][j] * basis[x][i] * samples[j * 4 + i];
                }
            }
        }
    }
    result
}
fn evaluate(c: &[f64; 16], u: f64, v: f64) -> f64 {
    let mut rows = [0.; 4];
    for (j, row) in rows.iter_mut().enumerate() {
        let i = j * 4;
        *row = ((c[i + 3] * u + c[i + 2]) * u + c[i + 1]) * u + c[i];
    }
    ((rows[3] * v + rows[2]) * v + rows[1]) * v + rows[0]
}
type Key = (u8, u8, i32, i32);
#[derive(Clone, Copy)]
struct Interval {
    low: f64,
    high: f64,
    count: i64,
}

// SQLite can prefer the level prefix of the primary key over an expression
// index. Require the spatial index so each read is bounded to one author block.
pub(super) fn author_block_query(local: bool) -> &'static str {
    if local {
        "SELECT x,y,z FROM terrain INDEXED BY terrain_block_authors WHERE (x >> 4)=?2 AND (y >> 4)=?3 AND ?1=0"
    } else {
        "SELECT x,y,z FROM terrain_layers INDEXED BY world_block_authors WHERE level=?1 AND (x >> 4)=?2 AND (y >> 4)=?3"
    }
}

pub fn install(db: &Connection) -> Result<()> {
    db.execute_batch("CREATE TABLE terrain_blocks(source INTEGER NOT NULL,depth INTEGER NOT NULL,x INTEGER NOT NULL,y INTEGER NOT NULL,low REAL NOT NULL,high REAL NOT NULL,n INTEGER NOT NULL,min_x INTEGER NOT NULL,min_y INTEGER NOT NULL,max_x INTEGER NOT NULL,max_y INTEGER NOT NULL,PRIMARY KEY(source,depth,x,y)) WITHOUT ROWID;
        CREATE TABLE terrain_dirty_blocks(depth INTEGER NOT NULL,source INTEGER NOT NULL,x INTEGER NOT NULL,y INTEGER NOT NULL,PRIMARY KEY(depth,source,x,y)) WITHOUT ROWID;
        CREATE INDEX terrain_block_authors ON terrain(x >> 4,y >> 4);
        CREATE INDEX world_block_authors ON terrain_layers(level,x >> 4,y >> 4);").map_err(storage_error)?;
    for (table, source) in [("terrain", "0"), ("terrain_layers", "new.level")] {
        for event in ["INSERT", "UPDATE", "DELETE"] {
            let new = if event == "DELETE" {
                "".to_owned()
            } else {
                format!("INSERT INTO terrain_dirty_blocks VALUES(0,{source},new.x >> 4,new.y >> 4) ON CONFLICT DO NOTHING;")
            };
            let old = if event == "INSERT" {
                "".to_owned()
            } else {
                format!("INSERT INTO terrain_dirty_blocks VALUES(0,{},old.x >> 4,old.y >> 4) ON CONFLICT DO NOTHING;", source.replace("new.","old."))
            };
            db.execute_batch(&format!("CREATE TRIGGER {table}_blocks_{event} AFTER {event} ON {table} BEGIN {old}{new} END;")).map_err(storage_error)?;
        }
    }
    Ok(())
}

/// Import uses the same summaries, streamed through SQLite rather than Rust author maps.
pub fn rebuild(db: &Connection) -> Result<()> {
    db.execute_batch("DELETE FROM terrain_blocks;
        INSERT INTO terrain_blocks SELECT 0,0,x >> 4,y >> 4,min(z),max(z),count(*),min(x),min(y),max(x),max(y) FROM terrain GROUP BY x >> 4,y >> 4;
        INSERT INTO terrain_blocks SELECT level,0,x >> 4,y >> 4,min(z),max(z),count(*),min(x),min(y),max(x),max(y) FROM terrain_layers GROUP BY level,x >> 4,y >> 4;").map_err(storage_error)?;
    for depth in 1..=DEPTH {
        db.execute("INSERT INTO terrain_blocks SELECT source,?1,x >> 1,y >> 1,min(low),max(high),sum(n),min(min_x),min(min_y),max(max_x),max(max_y) FROM terrain_blocks WHERE depth=?2 GROUP BY source,x >> 1,y >> 1",params![depth,depth-1]).map_err(storage_error)?;
    }
    db.execute("DELETE FROM terrain_dirty_blocks", [])
        .map_err(storage_error)?;
    Ok(())
}

/// SQL dirtiness follows commit, preview rollback and history automatically. Only
/// dirty leaves and their ancestors are refreshed, inside the current transaction.
pub fn refresh(db: &Connection) -> Result<()> {
    if db.is_autocommit() {
        let tx = db.unchecked_transaction().map_err(storage_error)?;
        refresh(&tx)?;
        return tx.commit().map_err(storage_error);
    }
    // Prepare this fixed worklist once, not once per block/ancestor.
    let mut next = db
        .prepare_cached(
            "SELECT depth,source,x,y FROM terrain_dirty_blocks ORDER BY depth,source,x,y LIMIT 1",
        )
        .map_err(storage_error)?;
    let mut remove = db
        .prepare_cached("DELETE FROM terrain_blocks WHERE source=? AND depth=? AND x=? AND y=?")
        .map_err(storage_error)?;
    let mut parent = db.prepare_cached("INSERT INTO terrain_blocks SELECT ?1,?2,?3,?4,min(low),max(high),sum(n),min(min_x),min(min_y),max(max_x),max(max_y) FROM terrain_blocks WHERE source=?1 AND depth=?5 AND x IN (?6,?6+1) AND y IN (?7,?7+1) HAVING count(*)>0").map_err(storage_error)?;
    let mut local = db.prepare_cached("INSERT INTO terrain_blocks SELECT 0,0,?1,?2,min(z),max(z),count(*),min(x),min(y),max(x),max(y) FROM terrain INDEXED BY terrain_block_authors WHERE (x >> 4)=?1 AND (y >> 4)=?2 HAVING count(*)>0").map_err(storage_error)?;
    let mut world = db.prepare_cached("INSERT INTO terrain_blocks SELECT ?1,0,?2,?3,min(z),max(z),count(*),min(x),min(y),max(x),max(y) FROM terrain_layers INDEXED BY world_block_authors WHERE level=?1 AND (x >> 4)=?2 AND (y >> 4)=?3 HAVING count(*)>0").map_err(storage_error)?;
    let mut clean = db
        .prepare_cached(
            "DELETE FROM terrain_dirty_blocks WHERE depth=? AND source=? AND x=? AND y=?",
        )
        .map_err(storage_error)?;
    let mut dirty_parent = db
        .prepare_cached("INSERT OR IGNORE INTO terrain_dirty_blocks VALUES(?,?,?,?)")
        .map_err(storage_error)?;
    loop {
        let key: Option<(u8, u8, i32, i32)> = next
            .query_row([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)))
            .optional()
            .map_err(storage_error)?;
        let Some((depth, source, x, y)) = key else {
            break;
        };
        remove
            .execute(params![source, depth, x, y])
            .map_err(storage_error)?;
        if depth > 0 {
            parent
                .execute(params![source, depth, x, y, depth - 1, x * 2, y * 2])
                .map_err(storage_error)?;
        } else if source == 0 {
            local.execute(params![x, y]).map_err(storage_error)?;
        } else {
            world
                .execute(params![source, x, y])
                .map_err(storage_error)?;
        }
        clean
            .execute(params![depth, source, x, y])
            .map_err(storage_error)?;
        if depth < DEPTH {
            dirty_parent
                .execute(params![depth + 1, source, x >> 1, y >> 1])
                .map_err(storage_error)?;
        }
    }
    Ok(())
}

pub struct Sampler<'a> {
    db: &'a Connection,
    sources: Vec<(u8, [i32; 4])>,
    nodes: HashMap<Key, Option<Interval>>,
    blocks: HashMap<(u8, i32, i32), Vec<Option<f64>>>,
    patches: HashMap<(u8, i32, i32), Patch>,
    #[cfg(test)]
    pub loaded_controls: usize,
}
impl<'a> Sampler<'a> {
    pub fn new(db: &'a Connection) -> Result<Self> {
        refresh(db)?;
        let mut sources = Vec::new();
        let mut roots = db.prepare_cached("SELECT min(min_x),min(min_y),max(max_x),max(max_y) FROM terrain_blocks WHERE source=? AND depth=? HAVING count(*)>0").map_err(storage_error)?;
        for source in (0..=21).rev() {
            let bounds: Option<[i32; 4]> = roots
                .query_row(params![source, DEPTH], |r| {
                    Ok([r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?])
                })
                .optional()
                .map_err(storage_error)?;
            if let Some(bounds) = bounds {
                sources.push((source, bounds));
            }
        }
        Ok(Self {
            db,
            sources,
            nodes: HashMap::new(),
            blocks: HashMap::new(),
            patches: HashMap::new(),
            #[cfg(test)]
            loaded_controls: 0,
        })
    }
    fn node(&mut self, key: Key) -> Result<Option<Interval>> {
        if let Some(value) = self.nodes.get(&key) {
            return Ok(*value);
        }
        let value = self
            .db
            .prepare_cached(
                "SELECT low,high,n FROM terrain_blocks WHERE source=? AND depth=? AND x=? AND y=?",
            )
            .map_err(storage_error)?
            .query_row(params![key.0, key.1, key.2, key.3], |r| {
                Ok(Interval {
                    low: r.get(0)?,
                    high: r.get(1)?,
                    count: r.get(2)?,
                })
            })
            .optional()
            .map_err(storage_error)?;
        if self.nodes.len() == NODE_CACHE {
            self.nodes.clear();
        }
        self.nodes.insert(key, value);
        Ok(value)
    }
    fn control(&mut self, source: u8, x: i32, y: i32) -> Result<Option<f64>> {
        let bx = x.div_euclid(BLOCK);
        let by = y.div_euclid(BLOCK);
        let Some(interval) = self.node((source, 0, bx, by))? else {
            return Ok(None);
        };
        if interval.count == 256 && interval.low == interval.high {
            return Ok(Some(interval.low));
        }
        let key = (source, bx, by);
        if !self.blocks.contains_key(&key) {
            let mut q = self
                .db
                .prepare_cached(author_block_query(source == 0))
                .map_err(storage_error)?;
            let mut rows = q.query(params![source, bx, by]).map_err(storage_error)?;
            let mut values = vec![None; 256];
            while let Some(row) = rows.next().map_err(storage_error)? {
                let x: i32 = row.get(0).map_err(storage_error)?;
                let y: i32 = row.get(1).map_err(storage_error)?;
                values[(y.rem_euclid(BLOCK) * BLOCK + x.rem_euclid(BLOCK)) as usize] =
                    Some(row.get(2).map_err(storage_error)?);
                #[cfg(test)]
                {
                    self.loaded_controls += 1;
                }
            }
            if self.blocks.len() == BLOCK_CACHE {
                self.blocks.clear();
            }
            self.blocks.insert(key, values);
        }
        Ok(self.blocks[&key][(y.rem_euclid(BLOCK) * BLOCK + x.rem_euclid(BLOCK)) as usize])
    }
    fn patch(&mut self, source: u8, x: i32, y: i32) -> Result<&Patch> {
        let key = (source, x, y);
        if !self.patches.contains_key(&key) {
            let mut values = [0.; 16];
            let mut mask = [0.; 16];
            let mut count = 0;
            let mut first = None;
            let mut uniform = true;
            for j in 0..4 {
                for i in 0..4 {
                    if let Some(z) = self.control(source, x + i as i32 - 1, y + j as i32 - 1)? {
                        values[j * 4 + i] = z;
                        mask[j * 4 + i] = 1.;
                        count += 1;
                        if let Some(prior) = first {
                            uniform &= prior == z
                        } else {
                            first = Some(z)
                        }
                    }
                }
            }
            let patch = Patch {
                values: coefficients(&values),
                mask: coefficients(&mask),
                constant: if uniform {
                    first.map(|z| (z, count == 16))
                } else {
                    None
                },
                empty: count == 0,
            };
            if self.patches.len() == PATCH_CACHE {
                self.patches.clear();
            }
            self.patches.insert(key, patch);
        }
        Ok(&self.patches[&key])
    }
    pub fn height(&mut self, p: Point) -> Result<f64> {
        let mut value = terrain::BASE;
        for index in 0..self.sources.len() {
            let (source, bounds) = self.sources[index];
            let step = terrain::STEP * 2f64.powi(source as i32);
            let gx = p[0] / step;
            let gy = p[1] / step;
            let x = gx.floor() as i32;
            let y = gy.floor() as i32;
            if x + 2 < bounds[0] || y + 2 < bounds[1] || x - 1 > bounds[2] || y - 1 > bounds[3] {
                continue;
            }
            let patch = self.patch(source, x, y)?;
            if patch.empty {
                continue;
            }
            if let Some((z, complete)) = patch.constant {
                // Sparse equal-valued authors over the same inherited height are
                // exactly flat too. Preserve that invariant before polynomial rounding.
                if complete || value == z {
                    value = z;
                    continue;
                }
            }
            let u = gx - x as f64;
            let v = gy - y as f64;
            value = evaluate(&patch.values, u, v)
                + value * (1. - evaluate(&patch.mask, u, v).clamp(0., 1.));
        }
        Ok(value)
    }
    /// At most four enclosing nodes per source. Conservative enclosure avoids
    /// traversing millions of leaves along the border of a world-sized rectangle.
    pub fn range(&mut self, b: Bounds) -> Result<[f64; 2]> {
        let mut low = terrain::BASE;
        let mut high = terrain::BASE;
        for index in 0..self.sources.len() {
            let (source, bounds) = self.sources[index];
            let step = terrain::STEP * 2f64.powi(source as i32);
            let x0 = (b[0] / step).floor() as i32 - 1;
            let y0 = (b[1] / step).floor() as i32 - 1;
            let x1 = (b[2] / step).floor() as i32 + 2;
            let y1 = (b[3] / step).floor() as i32 + 2;
            if x1 < bounds[0] || y1 < bounds[1] || x0 > bounds[2] || y0 > bounds[3] {
                continue;
            }
            let span = (x1 - x0 + 1).max(y1 - y0 + 1) as u32;
            let width = span.max(BLOCK as u32).next_power_of_two();
            let depth = (width.trailing_zeros() - 4) as u8;
            let width = width as i32;
            let mut count = 0;
            let mut min = f64::INFINITY;
            let mut max = f64::NEG_INFINITY;
            let mut capacity = 0i64;
            for y in y0.div_euclid(width)..=y1.div_euclid(width) {
                for x in x0.div_euclid(width)..=x1.div_euclid(width) {
                    capacity += i64::from(width) * i64::from(width);
                    if let Some(node) = self.node((source, depth, x, y))? {
                        count += node.count;
                        min = min.min(node.low);
                        max = max.max(node.high);
                    }
                }
            }
            if count > 0 {
                if count == capacity {
                    low = min;
                    high = max;
                } else {
                    low = low.min(min);
                    high = high.max(max);
                }
            }
        }
        Ok([low, high])
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::atlas::application::{terrain_store, AtlasApplication};
    #[test]
    fn sampling_and_dirty_leaf_refresh_ignore_distant_authors() {
        use std::sync::{
            atomic::{AtomicUsize, Ordering},
            Arc,
        };
        for source in [0, 4, 21] {
            let app = AtlasApplication::new().unwrap();
            let put = |y: i32, z: f64| {
                if source == 0 {
                    app.db.execute("INSERT INTO terrain VALUES(0,?1,?2) ON CONFLICT(x,y) DO UPDATE SET z=excluded.z", params![y,z]).unwrap();
                } else {
                    app.db.execute("INSERT INTO terrain_layers VALUES(?1,0,?2,?3) ON CONFLICT(level,x,y) DO UPDATE SET z=excluded.z", params![source,y,z]).unwrap();
                }
            };
            put(0, 10.);
            refresh(&app.db).unwrap();
            let measure = || {
                put(0, 11.);
                let count = Arc::new(AtomicUsize::new(0));
                let steps = count.clone();
                app.db.progress_handler(
                    100,
                    Some(move || {
                        steps.fetch_add(1, Ordering::Relaxed);
                        false
                    }),
                );
                // Includes refreshing exactly the changed leaf and its ancestors.
                let mut sampler = Sampler::new(&app.db).unwrap();
                let height = sampler.height([0., 0.]).unwrap();
                app.db.progress_handler(0, None::<fn() -> bool>);
                (height, count.load(Ordering::Relaxed))
            };
            let (height, budget) = measure();
            for y in 10000..12000 {
                put(y, 10.);
            }
            refresh(&app.db).unwrap();
            let (actual, work) = measure();
            assert_eq!(height, actual);
            assert!(
                work <= budget + 30,
                "source {source}: {budget} -> {work} VM batches"
            );
        }
    }
    fn summaries(db: &Connection) -> Vec<(u8, u8, i32, i32, f64, f64, i64)> {
        db.prepare(
            "SELECT source,depth,x,y,low,high,n FROM terrain_blocks ORDER BY source,depth,x,y",
        )
        .unwrap()
        .query_map([], |r| {
            Ok((
                r.get(0)?,
                r.get(1)?,
                r.get(2)?,
                r.get(3)?,
                r.get(4)?,
                r.get(5)?,
                r.get(6)?,
            ))
        })
        .unwrap()
        .collect::<rusqlite::Result<_>>()
        .unwrap()
    }
    #[test]
    fn indexed_samples_and_intervals_match_sparse_inheritance_and_negative_coordinates() {
        let app = AtlasApplication::new().unwrap();
        app.db.execute_batch("WITH RECURSIVE v(n) AS (SELECT -20 UNION ALL SELECT n+1 FROM v WHERE n<20)
            INSERT INTO terrain_layers SELECT 3,a.n,b.n,12 FROM v a CROSS JOIN v b;
            WITH RECURSIVE v(n) AS (SELECT -12 UNION ALL SELECT n+1 FROM v WHERE n<12)
            INSERT INTO terrain SELECT a.n,b.n,(a.n+b.n)%7-3 FROM v a CROSS JOIN v b WHERE (a.n+b.n)%3!=0;").unwrap();
        let expected = terrain_store::grid(&app.db, [-300., -300., 300., 300.]).unwrap();
        let mut sampler = Sampler::new(&app.db).unwrap();
        for x in -31..31 {
            for y in -31..31 {
                let p = [x as f64 * 3.71, y as f64 * 4.13];
                let h = sampler.height(p).unwrap();
                assert!((h - terrain::height(&expected, p)).abs() < 1e-10);
                let [low, high] = sampler
                    .range([p[0] - 4., p[1] - 4., p[0] + 4., p[1] + 4.])
                    .unwrap();
                assert!(low <= h + 1e-10 && h <= high + 1e-10);
            }
        }
        assert!(sampler.blocks.len() <= BLOCK_CACHE && sampler.nodes.len() <= NODE_CACHE);
    }
    #[test]
    fn sparse_uniform_authors_preserve_exact_inherited_height() {
        for source in [0, 4] {
            for height in [17.3, -100., 100000.] {
                let app = AtlasApplication::new().unwrap();
                for x in -5..=5 {
                    for y in -5..=5 {
                        app.db
                            .execute(
                                "INSERT INTO terrain_layers VALUES(?1,?2,?3,?4)",
                                params![source + 4, x, y, height],
                            )
                            .unwrap();
                    }
                }
                for (x, y) in [(-1, 0), (0, 0), (1, 1), (16, -17)] {
                    if source == 0 {
                        terrain_store::write_points(&app.db, &[(x, y, height)]).unwrap();
                    } else {
                        app.db
                            .execute(
                                "INSERT INTO terrain_layers VALUES(?1,?2,?3,?4)",
                                params![source, x, y, height],
                            )
                            .unwrap();
                    }
                }
                let mut sampler = Sampler::new(&app.db).unwrap();
                let step = terrain::STEP * 2f64.powi(source);
                for x in -3..=18 {
                    for y in -19..=3 {
                        let p = [(x as f64 + 0.26) * step, (y as f64 + 0.54) * step];
                        assert_eq!(
                            sampler.height(p).unwrap(),
                            height,
                            "source {source}, point {p:?}"
                        );
                    }
                }
            }
        }
    }
    #[test]
    fn incremental_index_matches_rebuild_and_transaction_rollback() {
        let app = AtlasApplication::new().unwrap();
        terrain_store::write_points(&app.db, &[(-17, 4, 30.), (-1, -1, -12.), (16, 16, 7.)])
            .unwrap();
        refresh(&app.db).unwrap();
        let initial = summaries(&app.db);
        let tx = app.db.unchecked_transaction().unwrap();
        terrain_store::write_samples(
            &tx,
            &[(-17, 4, None), (-1, -1, Some(20.)), (80, 90, Some(60.))],
        )
        .unwrap();
        refresh(&tx).unwrap();
        let changed = summaries(&tx);
        assert_ne!(changed, initial);
        rebuild(&tx).unwrap();
        assert_eq!(summaries(&tx), changed);
        tx.rollback().unwrap();
        assert_eq!(summaries(&app.db), initial);
        app.db.execute("DELETE FROM terrain", []).unwrap();
        refresh(&app.db).unwrap();
        assert!(summaries(&app.db).is_empty());
    }
    #[test]
    fn dense_overview_exceeds_detail_read_limit_without_exporting_authors() {
        use crate::atlas::terrain::TerrainArgs;
        use base64::{engine::general_purpose::STANDARD, Engine};
        let app = AtlasApplication::new().unwrap();
        app.db.execute_batch("WITH RECURSIVE x(n) AS (SELECT 0 UNION ALL SELECT n+1 FROM x WHERE n<399), y(n) AS (SELECT 0 UNION ALL SELECT n+1 FROM y WHERE n<299)
            INSERT INTO terrain_layers SELECT 1,x.n,y.n,10 FROM x CROSS JOIN y;").unwrap();
        assert!(
            super::super::world_terrain_store::read(&app.db, [0., 0., 40960., 40960.]).is_err()
        );
        for pixels in [32, 512] {
            let response = app
                .terrain_tiles(TerrainArgs {
                    contour_interval: None,
                    pixels: Some(pixels),
                    level: 8,
                    tiles: vec![[0, 0]],
                })
                .unwrap();
            let tile = &response.tiles[0];
            let raster = tile.raster.as_ref().unwrap();
            assert_eq!(
                STANDARD.decode(&raster.heights).unwrap().len(),
                usize::from(pixels + 1).pow(2) * 4
            );
            assert_eq!(
                STANDARD.decode(&raster.ocean).unwrap().len(),
                usize::from(pixels).pow(2)
            );
            assert!(
                serde_json::to_vec(tile).unwrap().len() < 60_000 + usize::from(pixels).pow(2) * 16
            );
        }
        let mut sampler = Sampler::new(&app.db).unwrap();
        assert_eq!(sampler.range([500., 500., 600., 600.]).unwrap(), [10., 10.]);
        assert_eq!(sampler.height([555., 555.]).unwrap(), 10.);
        // Uniform occupied blocks do not load their individual controls.
        assert_eq!(sampler.loaded_controls, 0);
        assert!(sampler.blocks.len() <= BLOCK_CACHE);
    }
}

#[cfg(test)]
mod performance_fixtures {
    use super::super::{application_test_support::request_edit, AtlasApplication};
    use serde_json::json;

    /// Fixed authors, independent of rendering resolution or machine speed.
    #[test]
    #[ignore = "release terrain fixtures; writes only to the configured diagnostic directory"]
    fn terrain_performance_fixtures() {
        let output = std::path::PathBuf::from(
            std::env::var_os("ATLAS_TERRAIN_FIXTURES")
                .unwrap_or_else(|| "target/diagnostics/terrain-performance".into()),
        );
        std::fs::create_dir_all(&output).unwrap();
        for name in ["empty-coast", "built-coast", "dense-overview"] {
            let mut app = AtlasApplication::new().unwrap();
            if name == "dense-overview" {
                app.db.execute_batch("WITH RECURSIVE x(n) AS (SELECT -200 UNION ALL SELECT n+1 FROM x WHERE n<199), y(n) AS (SELECT -150 UNION ALL SELECT n+1 FROM y WHERE n<149)
                    INSERT INTO terrain_layers SELECT 1,x.n,y.n,10+(abs(x.n*17+y.n*7)%31)*0.02 FROM x CROSS JOIN y;").unwrap();
            } else {
                app.db.execute_batch("WITH RECURSIVE x(n) AS (SELECT -32 UNION ALL SELECT n+1 FROM x WHERE n<32), y(n) AS (SELECT -32 UNION ALL SELECT n+1 FROM y WHERE n<0)
                    INSERT INTO terrain_layers SELECT 3,x.n,y.n,10 FROM x CROSS JOIN y;").unwrap();
            }
            super::rebuild(&app.db).unwrap();
            if name == "built-coast" {
                for i in 0..12 {
                    let result = request_edit(
                        &mut app,
                        "commit",
                        json!({
                            "type":"createHouse", "parcelId":null,
                            "transform":{"x":-330+i*60,"y":-70,"angle":0},
                            "width":12,"depth":10
                        }),
                    );
                    assert_eq!(result["valid"], true);
                }
            }
            let controls: i64 = app
                .db
                .query_row("SELECT count(*) FROM terrain_layers", [], |r| r.get(0))
                .unwrap();
            if name == "dense-overview" {
                assert_eq!(controls, 120_000);
            }
            let path = output.join(format!("{name}.saltatlas"));
            app.save(&path).unwrap();
            app.open(&path).unwrap(); // Validate the actual persisted fixture and rebuild derived indices.
            let reopened: i64 = app
                .db
                .query_row("SELECT count(*) FROM terrain_layers", [], |r| r.get(0))
                .unwrap();
            assert_eq!(reopened, controls);
            println!(
                "{}",
                json!({"fixture":name,"recipe":1,"seed":7,"controls":controls})
            );
        }
    }
}
