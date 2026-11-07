//! Indexed standing-water authors, compound terrain edits and file/history plumbing.
use super::{terrain_store, AtlasApplication};
use crate::atlas::{
    change::Computed,
    errors::{ensure, invalid, storage_error},
    geometry::expand,
    regions,
    terrain::{self, Grid},
    water::{self, WaterBody, WaterDelta},
    Bounds, Result,
};
use geo::{BooleanOps, Buffer, Contains, Distance, Euclidean, Intersects};
use rusqlite::{params, Connection};
use std::collections::{BTreeMap, BTreeSet};
pub fn install(db: &Connection) -> Result<()> {
    db.execute_batch("CREATE TABLE waters(id TEXT PRIMARY KEY,body TEXT NOT NULL,min_x REAL NOT NULL,min_y REAL NOT NULL,max_x REAL NOT NULL,max_y REAL NOT NULL); CREATE VIRTUAL TABLE water_spatial USING rtree(key,min_x,max_x,min_y,max_y); CREATE TRIGGER water_insert AFTER INSERT ON waters BEGIN INSERT INTO water_spatial VALUES(new.rowid,new.min_x,new.max_x,new.min_y,new.max_y); END; CREATE TRIGGER water_delete AFTER DELETE ON waters BEGIN DELETE FROM water_spatial WHERE key=old.rowid; END;").map_err(storage_error)
}
pub fn local(db: &Connection, b: Bounds) -> Result<Vec<WaterBody>> {
    let mut q=db.prepare_cached("SELECT w.body FROM waters w JOIN water_spatial s ON s.key=w.rowid WHERE s.min_x<=?1 AND s.max_x>=?2 AND s.min_y<=?3 AND s.max_y>=?4 ORDER BY w.id").map_err(storage_error)?;
    let rows = q
        .query_map(params![b[2], b[0], b[3], b[1]], |r| r.get::<_, String>(0))
        .map_err(storage_error)?;
    let mut out = vec![];
    let mut count = 0;
    for row in rows {
        let w: WaterBody =
            serde_json::from_str(&row.map_err(storage_error)?).map_err(storage_error)?;
        count += w
            .polygons
            .iter()
            .map(|p| p.outer.len() + p.holes.iter().map(Vec::len).sum::<usize>())
            .sum::<usize>();
        ensure(
            count <= water::POINT_LIMIT,
            "Gewässeransicht überschreitet 200.000 Konturpunkte",
        )?;
        out.push(w);
    }
    Ok(out)
}
pub fn overlay(db: &Connection, b: Bounds, delta: Option<&WaterDelta>) -> Result<Vec<WaterBody>> {
    let mut out = local(db, b)?;
    if let Some(d) = delta {
        let replaced: BTreeSet<_> = d
            .before
            .iter()
            .chain(&d.after)
            .map(|w| w.id.as_str())
            .collect();
        out.retain(|w| !replaced.contains(w.id.as_str()));
        out.extend(
            d.after
                .iter()
                .filter(|w| {
                    regions::bounds(&water::geometry(w)).is_some_and(|a| {
                        a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1]
                    })
                })
                .cloned(),
        );
        out.sort_unstable_by(|a, b| a.id.cmp(&b.id));
    }
    water::check_budget(&out)?;
    Ok(out)
}
/// Reuse only the last point-local candidate set. Authors/delta stay fixed during
/// one solve; a changed set replaces (rather than accumulates) prepared geometry.
pub struct ContactReader<'a> {
    db: &'a Connection,
    delta: Option<&'a WaterDelta>,
    changed_bounds: Vec<Option<Bounds>>,
    candidates: Option<(Vec<String>, Vec<usize>)>,
    prepared: Vec<water::PreparedWater>,
    #[cfg(test)]
    preparations: usize,
}
impl<'a> ContactReader<'a> {
    pub fn new(db: &'a Connection, delta: Option<&'a WaterDelta>) -> Self {
        Self {
            db,
            delta,
            changed_bounds: delta
                .into_iter()
                .flat_map(|d| &d.after)
                .map(|w| regions::bounds(&water::geometry(w)))
                .collect(),
            candidates: None,
            prepared: vec![],
            #[cfg(test)]
            preparations: 0,
        }
    }
    pub fn level_at(&mut self, p: crate::atlas::Point) -> Result<Option<f64>> {
        let mut q = self.db.prepare_cached("SELECT w.id FROM waters w JOIN water_spatial s ON s.key=w.rowid WHERE s.min_x<=?1 AND s.max_x>=?1 AND s.min_y<=?2 AND s.max_y>=?2 ORDER BY w.id").map_err(storage_error)?;
        let ids = q
            .query_map(params![p[0], p[1]], |r| r.get::<_, String>(0))
            .map_err(storage_error)?
            .collect::<rusqlite::Result<Vec<_>>>()
            .map_err(storage_error)?;
        let changed: Vec<_> = self
            .changed_bounds
            .iter()
            .enumerate()
            .filter_map(|(i, b)| {
                b.filter(|b| b[0] <= p[0] && b[2] >= p[0] && b[1] <= p[1] && b[3] >= p[1])
                    .map(|_| i)
            })
            .collect();
        let candidates = (ids, changed);
        if self.candidates.as_ref() != Some(&candidates) {
            // Release the previous set before loading another bounded selection.
            self.candidates = None;
            self.prepared.clear();
            // Keep the exact existing point-local budget and overlay semantics.
            let waters = overlay(self.db, [p[0], p[1], p[0], p[1]], self.delta)?;
            self.prepared = waters.iter().map(water::PreparedWater::new).collect();
            self.candidates = Some(candidates);
            #[cfg(test)]
            {
                self.preparations += 1;
            }
        }
        Ok(self
            .prepared
            .iter()
            .filter_map(|w| w.level_at(p))
            .min_by(f64::total_cmp))
    }
}

pub fn put(db: &Connection, w: &WaterBody) -> Result<()> {
    water::validate(w)?;
    let b = regions::bounds(&water::geometry(w)).ok_or_else(|| invalid("Leeres Gewässer"))?;
    db.execute("DELETE FROM waters WHERE id=?", [&w.id])
        .map_err(storage_error)?;
    db.execute(
        "INSERT INTO waters VALUES(?,?,?,?,?,?)",
        params![
            w.id,
            serde_json::to_string(w).map_err(storage_error)?,
            b[0],
            b[1],
            b[2],
            b[3]
        ],
    )
    .map_err(storage_error)?;
    Ok(())
}
pub fn apply(db: &Connection, d: &WaterDelta, forward: bool) -> Result<()> {
    let (before, after) = if forward {
        (&d.before, &d.after)
    } else {
        (&d.after, &d.before)
    };
    for w in before {
        db.execute("DELETE FROM waters WHERE id=?", [&w.id])
            .map_err(storage_error)?;
    }
    for w in after {
        put(db, w)?;
    }
    Ok(())
}
pub fn import(source: &Connection, target: &Connection) -> Result<()> {
    let mut q = source
        .prepare("SELECT id,body FROM waters ORDER BY id")
        .map_err(storage_error)?;
    let mut rows = q.query([]).map_err(storage_error)?;
    while let Some(r) = rows.next().map_err(storage_error)? {
        let w: WaterBody = serde_json::from_str(&r.get::<_, String>(1).map_err(storage_error)?)
            .map_err(invalid)?;
        ensure(
            w.id == r.get::<_, String>(0).map_err(storage_error)?,
            "Ungültige Gewässeridentität",
        )?;
        water::validate(&w)?;
        for other in local(target, regions::bounds(&water::geometry(&w)).unwrap())? {
            ensure(
                regions::overlap(&water::geometry(&w), &water::geometry(&other)) <= 1e-7,
                "Überlagerte Gewässer",
            )?;
        }
        put(target, &w)?;
    }
    Ok(())
}
pub fn cells(points: &[(i32, i32, f64)]) -> BTreeSet<(i32, i32)> {
    points
        .iter()
        .flat_map(|&(x, y, _)| {
            (-2..=1).flat_map(move |dy| (-2..=1).map(move |dx| (x + dx, y + dy)))
        })
        .collect()
}
#[derive(Default)]
struct WaterFootprint {
    cells: BTreeSet<(i32, i32)>,
    rows: BTreeSet<i64>,
}

// A coarse author influences only its four-by-four spline support. Query
// existing water bounds per occupied source block, then clip that exact support
// before enumerating local cells. Neither empty world rectangles nor whole lake
// rectangles are rasterized; water bodies are loaded only after this budget check.
fn world_water_cells(
    db: &Connection,
    delta: &super::world_terrain_store::WorldTerrainDelta,
) -> Result<WaterFootprint> {
    if delta.after.is_empty() {
        return Ok(WaterFootprint::default());
    }
    // Most world strokes meet no local water. Reject that case with one index
    // lookup before constructing the finer footprint.
    let b = delta.bounds();
    let nearby: bool = db.query_row(
        "SELECT EXISTS(SELECT 1 FROM water_spatial WHERE min_x<=?1 AND max_x>=?2 AND min_y<=?3 AND max_y>=?4)",
        params![b[2], b[0], b[3], b[1]], |r| r.get(0)
    ).map_err(storage_error)?;
    if !nearby {
        return Ok(WaterFootprint::default());
    }
    let step = terrain::STEP * 2f64.powi(delta.level as i32);
    let mut blocks: BTreeMap<(i32, i32), Vec<crate::atlas::Point>> = BTreeMap::new();
    for &(x, y, _) in &delta.after {
        blocks
            .entry((x.div_euclid(16), y.div_euclid(16)))
            .or_default()
            .push([x as f64 * step, y as f64 * step]);
    }
    let mut query = db.prepare_cached(
        "SELECT w.rowid,w.min_x,w.min_y,w.max_x,w.max_y FROM water_spatial s JOIN waters w ON w.rowid=s.key WHERE s.min_x<=?1 AND s.max_x>=?2 AND s.min_y<=?3 AND s.max_y>=?4"
    ).map_err(storage_error)?;
    let mut affected = BTreeSet::new();
    let mut waters = BTreeSet::new();
    for points in blocks.into_values() {
        let bounds = expand(
            crate::atlas::geometry::bounds(points.iter().copied()),
            2. * step,
        );
        let mut rows = query
            .query(params![bounds[2], bounds[0], bounds[3], bounds[1]])
            .map_err(storage_error)?;
        while let Some(row) = rows.next().map_err(storage_error)? {
            let key: i64 = row.get(0).map_err(storage_error)?;
            let water: Bounds = [
                row.get(1).map_err(storage_error)?,
                row.get(2).map_err(storage_error)?,
                row.get(3).map_err(storage_error)?,
                row.get(4).map_err(storage_error)?,
            ];
            for p in &points {
                let b = [
                    (p[0] - 2. * step).max(water[0]),
                    (p[1] - 2. * step).max(water[1]),
                    (p[0] + 2. * step).min(water[2]),
                    (p[1] + 2. * step).min(water[3]),
                ];
                if b[0] > b[2] || b[1] > b[3] {
                    continue;
                }
                let x0 = (b[0] / terrain::STEP).ceil() as i32 - 1;
                let y0 = (b[1] / terrain::STEP).ceil() as i32 - 1;
                let x1 = (b[2] / terrain::STEP).floor() as i32;
                let y1 = (b[3] / terrain::STEP).floor() as i32;
                let count =
                    (i64::from(x1) - i64::from(x0) + 1) * (i64::from(y1) - i64::from(y0) + 1);
                ensure(
                    count <= terrain::LIMIT as i64,
                    "Gewässernachführung zu groß",
                )?;
                waters.insert(key);
                for x in x0..=x1 {
                    for y in y0..=y1 {
                        affected.insert((x, y));
                        ensure(
                            affected.len() <= terrain::LIMIT,
                            "Gewässernachführung zu groß",
                        )?;
                    }
                }
            }
        }
    }
    Ok(WaterFootprint {
        cells: affected,
        rows: waters,
    })
}
impl AtlasApplication {
    pub(super) fn water_stroke(
        &self,
        brush: &terrain::Brush,
        old: &mut Grid,
        next: &mut Grid,
    ) -> Result<(WaterDelta, i64)> {
        let footprint = regions::brush(&brush.points, brush.radius)?;
        let bound = regions::bounds(&footprint).ok_or_else(|| invalid("Leerer Gewässerstrich"))?;
        let before: Vec<_> = local(&self.db, bound)?
            .into_iter()
            .filter(|w| water::geometry(w).intersects(&footprint))
            .collect();
        let rivers = super::river_store::local(&self.db, bound)?;
        let mut contacts: Vec<f64> = before.iter().map(|w| w.level).collect();
        let mut contact_checks = 0usize;
        for river in &rivers {
            for pair in river.samples.windows(2) {
                let line = geo::LineString::from(vec![pair[0].point, pair[1].point]);
                if line
                    .buffer(pair[0].width.max(pair[1].width) / 2.)
                    .intersects(&footprint)
                {
                    // Intersect the centreline with the brush; sample at raster spacing, bounded by river limits.
                    let n = ((Euclidean.length(&line) / 5.).ceil() as usize).clamp(1, 100000);
                    contact_checks += n + 1;
                    ensure(
                        contact_checks <= 200_000,
                        "Zu viele Flusskontakte im Gewässerstrich",
                    )?;
                    for i in 0..=n {
                        let t = i as f64 / n as f64;
                        let p = [0, 1]
                            .map(|k| pair[0].point[k] + t * (pair[1].point[k] - pair[0].point[k]));
                        if Euclidean.distance(&footprint, &geo::Point::from(p))
                            <= (pair[0].width + (pair[1].width - pair[0].width) * t) / 2.
                        {
                            contacts.push(pair[0].water + t * (pair[1].water - pair[0].water));
                        }
                    }
                }
            }
        }
        let start = brush.points[0];
        let level = contacts
            .into_iter()
            .min_by(f64::total_cmp)
            .unwrap_or_else(|| {
                crate::atlas::rivers::RiverSurface::new(&rivers)
                    .at(start, terrain::height(old, start))
                    .0
            });
        let mut combined = footprint.clone();
        for w in &before {
            combined = combined.union(&water::geometry(w));
        }
        let width = (brush.radius / 4.).max(5.);
        let outer = footprint.buffer(width);
        let ob = regions::bounds(&outer).unwrap();
        ensure(
            ((ob[2] - ob[0]) / 5. + 3.) * ((ob[3] - ob[1]) / 5. + 3.) <= 400000.,
            "Gewässerstrich zu groß",
        )?;
        let mut lowered = brush.clone();
        lowered.mode = terrain::BrushMode::Lower;
        terrain::stroke(next, &lowered)?;
        for y in (ob[1] / 5.).floor() as i32..=(ob[3] / 5.).ceil() as i32 {
            for x in (ob[0] / 5.).floor() as i32..=(ob[2] / 5.).ceil() as i32 {
                let p = geo::Point::new(x as f64 * 5., y as f64 * 5.);
                if combined.contains(&p) {
                    continue;
                }
                let d = Euclidean.distance(&footprint, &p);
                if d <= width {
                    let z = terrain::at(next, x, y);
                    if z < level {
                        let t = (1. - d / width).clamp(0., 1.);
                        next.insert((x, y), z + (level - z) * t * t * (3. - 2. * t));
                    }
                }
            }
        }
        if before.len() == 1
            && before[0].level == level
            && next == old
            && footprint
                .difference(&water::geometry(&before[0]))
                .0
                .is_empty()
        {
            return Ok((
                WaterDelta {
                    before: before.clone(),
                    after: before,
                },
                self.allocator()?.next,
            ));
        }
        // Clip the complete merged body when its level changes; otherwise only the stroke neighbourhood.
        let mut affected = cells(
            &next
                .iter()
                .map(|(&(x, y), &z)| (x, y, z))
                .collect::<Vec<_>>(),
        );
        for w in &before {
            if w.level != level {
                let b = expand(regions::bounds(&water::geometry(w)).unwrap(), 5.);
                ensure(
                    ((b[2] - b[0]) / 5. + 1.) * ((b[3] - b[1]) / 5. + 1.) <= 100000.,
                    "Pegeländerung betrifft zu großes Gewässer",
                )?;
                let loaded = terrain_store::grid(&self.db, b)?;
                for (k, z) in loaded {
                    old.entry(k).or_insert(z);
                    next.entry(k).or_insert(z);
                }
                for y in (b[1] / 5.).floor() as i32..=(b[3] / 5.).ceil() as i32 {
                    for x in (b[0] / 5.).floor() as i32..=(b[2] / 5.).ceil() as i32 {
                        affected.insert((x, y));
                    }
                }
            }
        }
        // Include default-height cells as well as explicitly stored points.
        for y in (bound[1] / 5.).floor() as i32..=(bound[3] / 5.).ceil() as i32 {
            for x in (bound[0] / 5.).floor() as i32..=(bound[2] / 5.).ceil() as i32 {
                affected.insert((x, y));
            }
        }
        ensure(affected.len() <= 400000, "Gewässerstrich zu groß")?;
        let candidate = WaterBody {
            id: String::new(),
            level,
            polygons: regions::authored(combined),
        };
        let clipped = water::trim(&candidate, next, &affected);
        if before.len() == 1
            && before[0].level == level
            && regions::authored(clipped.clone()) == before[0].polygons
        {
            return Ok((
                WaterDelta {
                    before: before.clone(),
                    after: before,
                },
                self.allocator()?.next,
            ));
        }
        let mut alloc = self.allocator()?;
        let mut after = vec![];
        for polygon in clipped.0 {
            let w = WaterBody {
                id: alloc.allocate("water")?,
                level,
                polygons: regions::authored(geo::MultiPolygon(vec![polygon])),
            };
            water::validate(&w)?;
            after.push(w);
        }
        water::check_budget(&after)?;
        Ok((WaterDelta { before, after }, alloc.next))
    }
    pub(super) fn trim_water(&self, c: &mut Computed) -> Result<()> {
        if c.change.waters.is_some() {
            return Ok(());
        }
        let WaterFootprint {
            cells: mut affected,
            rows: world_rows,
        } = if let Some(d) = &c.change.world_terrain {
            world_water_cells(&self.db, d)?
        } else {
            WaterFootprint::default()
        };
        if let Some(t) = &c.change.terrain {
            affected.extend(cells(&t.after));
        }
        if affected.is_empty() {
            return Ok(());
        }
        let mut candidates = BTreeMap::new();
        if !world_rows.is_empty() {
            let mut query = self
                .db
                .prepare_cached("SELECT body FROM waters WHERE rowid=?")
                .map_err(storage_error)?;
            let mut contour_points = 0;
            for row in world_rows {
                let body: String = query
                    .query_row([row], |r| r.get(0))
                    .map_err(storage_error)?;
                let water: WaterBody = serde_json::from_str(&body).map_err(storage_error)?;
                contour_points += water::point_count(&water);
                ensure(
                    contour_points <= water::POINT_LIMIT,
                    "Gewässeransicht überschreitet 200.000 Konturpunkte",
                )?;
                candidates.insert(water.id.clone(), water);
            }
        }
        let mut regions = Vec::new();
        let tiles: BTreeSet<_> = affected
            .iter()
            .map(|&(x, y)| (x.div_euclid(32), y.div_euclid(32)))
            .collect();
        for (x, y) in tiles {
            let b = [
                x as f64 * 160. - 5.,
                y as f64 * 160. - 5.,
                (x + 1) as f64 * 160. + 5.,
                (y + 1) as f64 * 160. + 5.,
            ];
            regions.push(b);
            if c.change.terrain.is_some() {
                for w in local(&self.db, b)? {
                    candidates.insert(w.id.clone(), w);
                }
            }
        }
        if candidates.is_empty() {
            return Ok(());
        }
        let mut grid = terrain_store::brush_grid(&self.db, &regions, 0)?;
        if let Some(t) = &c.change.terrain {
            grid.extend(t.after.iter().map(|&(x, y, z)| ((x, y), z)));
        }
        let mut before = vec![];
        let mut after = vec![];
        let mut alloc = self.allocator()?;
        for w in candidates.into_values() {
            let g = water::trim(&w, &grid, &affected);
            let polygons = regions::authored(g.clone());
            if polygons == w.polygons {
                continue;
            }
            for (i, p) in g.0.into_iter().enumerate() {
                let v = WaterBody {
                    id: if i == 0 {
                        w.id.clone()
                    } else {
                        alloc.allocate("water")?
                    },
                    level: w.level,
                    polygons: regions::authored(geo::MultiPolygon(vec![p])),
                };
                water::validate(&v)?;
                after.push(v);
            }
            before.push(w);
        }
        if !before.is_empty() {
            water::check_budget(&after)?;
            c.change.waters = Some(WaterDelta { before, after });
            c.next_identity = Some(alloc.next);
        }
        Ok(())
    }
}
use geo::Length;

pub fn overview(db: &Connection, b: Bounds, step: f64) -> Result<Vec<WaterBody>> {
    use geo::Simplify;
    let mut q=db.prepare_cached("SELECT w.body FROM waters w JOIN water_spatial s ON s.key=w.rowid WHERE s.min_x<=?1 AND s.max_x>=?2 AND s.min_y<=?3 AND s.max_y>=?4 AND max(w.max_x-w.min_x,w.max_y-w.min_y)>=?5 ORDER BY (w.max_x-w.min_x)*(w.max_y-w.min_y) DESC,w.id LIMIT 32").map_err(storage_error)?;
    let rows = q
        .query_map(params![b[2], b[0], b[3], b[1], step], |r| {
            r.get::<_, String>(0)
        })
        .map_err(storage_error)?;
    let mut out = vec![];
    for row in rows {
        let mut w: WaterBody =
            serde_json::from_str(&row.map_err(storage_error)?).map_err(storage_error)?;
        let g = water::geometry(&w);
        let mut tolerance = step / 8.;
        for _ in 0..24 {
            w.polygons = regions::authored(g.simplify(tolerance));
            if water::point_count(&w) <= 64 {
                break;
            }
            tolerance *= 2.;
        }
        if water::point_count(&w) <= 64 {
            out.push(w);
        }
    }
    Ok(out)
}

#[cfg(test)]
mod contact_tests {
    use super::*;
    use crate::atlas::{application::AtlasApplication, regions::RegionPolygon, Point};

    fn rectangle(a: f64, b: f64) -> Vec<Point> {
        vec![[a, a], [b, a], [b, b], [a, b]]
    }
    fn lake(id: &str, level: f64, a: f64, b: f64) -> WaterBody {
        WaterBody {
            id: id.into(),
            level,
            polygons: vec![RegionPolygon {
                outer: rectangle(a, b),
                holes: vec![],
            }],
        }
    }
    #[test]
    fn prepared_contacts_match_point_local_reference_and_reuse_candidate_set() {
        let app = AtlasApplication::new().unwrap();
        let mut main = lake("main", 20., -20., 20.);
        main.polygons[0].holes.push(rectangle(-5., 5.));
        main.polygons.push(RegionPolygon {
            outer: rectangle(-1., 1.),
            holes: vec![],
        });
        let other = lake("other", 7., 12., 18.);
        put(&app.db, &main).unwrap();
        put(&app.db, &other).unwrap();
        let delta = WaterDelta {
            before: vec![main.clone(), other.clone()],
            after: vec![lake("main", 30., 100., 120.), lake("new", 3., -8., 8.)],
        };
        for delta in [None, Some(&delta)] {
            let mut reader = ContactReader::new(&app.db, delta);
            for p in [
                [-30., 0.],
                [-20., 0.],
                [-15., 10.],
                [-5., 0.],
                [3., 3.],
                [0., 0.],
                [14., 14.],
                [100., 100.],
                [110., 110.],
                [200., 200.],
            ] {
                let reference = overlay(&app.db, [p[0], p[1], p[0], p[1]], delta).unwrap();
                assert_eq!(
                    reader.level_at(p).unwrap(),
                    water::level_at(&reference, p),
                    "point {p:?}"
                );
            }
        }
        let mut reader = ContactReader::new(&app.db, None);
        for i in 0..100 {
            assert_eq!(
                reader.level_at([-15. + i as f64 / 100., 10.]).unwrap(),
                Some(20.)
            );
        }
        assert_eq!(reader.preparations, 1);
        assert_eq!(reader.prepared.len(), 1);
        assert_eq!(reader.level_at([14., 14.]).unwrap(), Some(7.));
        assert_eq!(reader.prepared.len(), 2);
        assert_eq!(reader.level_at([200., 200.]).unwrap(), None);
        assert!(reader.prepared.is_empty());
        drop(reader);
        let updated = lake("main", 40., -20., 20.);
        put(&app.db, &updated).unwrap();
        assert_eq!(
            ContactReader::new(&app.db, None)
                .level_at([0., 0.])
                .unwrap(),
            Some(40.)
        );
    }
    #[test]
    fn contact_reader_keeps_the_existing_point_local_contour_budget() {
        let app = AtlasApplication::new().unwrap();
        // Deliberately malformed stored data: reject at the existing read budget,
        // before constructing contact geometry, even if an overlay removes it.
        let mut oversized = lake("too-many", 10., -1., 1.);
        oversized.polygons[0].outer = vec![[0., 0.]; water::POINT_LIMIT + 1];
        app.db
            .execute(
                "INSERT INTO waters VALUES(?1,?2,-1,-1,1,1)",
                params![oversized.id, serde_json::to_string(&oversized).unwrap()],
            )
            .unwrap();
        let delta = WaterDelta {
            before: vec![oversized],
            after: vec![],
        };
        for delta in [None, Some(&delta)] {
            let reference = overlay(&app.db, [0., 0., 0., 0.], delta).unwrap_err();
            let mut reader = ContactReader::new(&app.db, delta);
            assert_eq!(
                reader.level_at([0., 0.]).unwrap_err().to_string(),
                reference.to_string()
            );
            assert_eq!(reader.preparations, 0);
            assert!(reader.prepared.is_empty());
            assert_eq!(reader.level_at([10., 10.]).unwrap(), None);
        }
    }
}
