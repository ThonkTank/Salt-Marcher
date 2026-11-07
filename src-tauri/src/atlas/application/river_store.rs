//! Local river reads, shared-node connectivity, and transaction-local history.
use super::{terrain_store, AtlasApplication};
use crate::atlas::{
    change::Computed,
    errors::{ensure, invalid, storage_error},
    model::{Status, Version},
    rivers::*,
    terrain, Bounds, Intent, Point, Result,
};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RiverArgs {
    pub version: Version,
    pub bounds: Bounds,
    pub ids: Vec<String>,
    #[serde(default)]
    #[cfg_attr(test, ts(optional))]
    pub overview_scale: Option<f64>,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RiverResponse {
    pub status: Status,
    pub rivers: Vec<RiverView>,
}
pub fn install(db: &Connection) -> Result<()> {
    db.execute_batch("CREATE TABLE rivers(id TEXT PRIMARY KEY,body TEXT NOT NULL,view TEXT NOT NULL,min_x REAL NOT NULL,min_y REAL NOT NULL,max_x REAL NOT NULL,max_y REAL NOT NULL); CREATE VIRTUAL TABLE river_spatial USING rtree(key,min_x,max_x,min_y,max_y); CREATE TABLE river_nodes(node TEXT NOT NULL,river TEXT NOT NULL,PRIMARY KEY(node,river)); CREATE INDEX river_node_owner ON river_nodes(river); CREATE TRIGGER river_insert AFTER INSERT ON rivers BEGIN INSERT INTO river_spatial VALUES(new.rowid,new.min_x,new.max_x,new.min_y,new.max_y); END; CREATE TRIGGER river_delete AFTER DELETE ON rivers BEGIN DELETE FROM river_spatial WHERE key=old.rowid; DELETE FROM river_nodes WHERE river=old.id; END;").map_err(storage_error)
}
pub fn get(db: &Connection, id: &str) -> Result<RiverView> {
    let body: String = db
        .query_row("SELECT view FROM rivers WHERE id=?", [id], |r| r.get(0))
        .map_err(|_| invalid("Fluss nicht gefunden"))?;
    serde_json::from_str(&body).map_err(storage_error)
}
pub fn local(db: &Connection, b: Bounds) -> Result<Vec<RiverView>> {
    let mut q=db.prepare("SELECT r.view FROM rivers r JOIN river_spatial s ON r.rowid=s.key WHERE s.min_x<=? AND s.max_x>=? AND s.min_y<=? AND s.max_y>=? ORDER BY r.id LIMIT 2001").map_err(storage_error)?;
    let rows = q
        .query_map(params![b[2], b[0], b[3], b[1]], |r| r.get::<_, String>(0))
        .map_err(storage_error)?;
    let mut out = vec![];
    let mut samples = 0;
    for row in rows {
        let v: RiverView =
            serde_json::from_str(&row.map_err(storage_error)?).map_err(storage_error)?;
        samples += v.river.path.len();
        ensure(
            samples <= 200000,
            "Flussansicht überschreitet 200.000 Samples; hineinzoomen",
        )?;
        out.push(v);
    }
    ensure(out.len() <= 2000, "Zu viele Flüsse im Ausschnitt")?;
    Ok(out)
}
pub fn connected(db: &Connection, initial: Vec<RiverView>) -> Result<Vec<RiverView>> {
    let mut out = BTreeMap::new();
    let mut queued: BTreeSet<_> = initial.iter().map(|v| v.river.id.clone()).collect();
    let mut pending = initial;
    let mut count = 0;
    while let Some(r) = pending.pop() {
        if out.contains_key(&r.river.id) {
            continue;
        }
        count += r.river.path.len();
        ensure(count <= 200000, "Flussnetz überschreitet 200.000 Samples")?;
        for n in &r.river.nodes {
            let mut q = db
                .prepare_cached("SELECT river FROM river_nodes WHERE node=? ORDER BY river")
                .map_err(storage_error)?;
            let ids = q
                .query_map([&n.id], |r| r.get::<_, String>(0))
                .map_err(storage_error)?
                .collect::<rusqlite::Result<Vec<_>>>()
                .map_err(storage_error)?;
            for id in ids {
                if queued.insert(id.clone()) {
                    pending.push(get(db, &id)?);
                }
            }
        }
        out.insert(r.river.id.clone(), r);
        ensure(out.len() <= 2000, "Flussnetz zu groß")?;
    }
    Ok(out.into_values().collect())
}
pub fn put(db: &Connection, v: &RiverView) -> Result<()> {
    let r = &v.river;
    let b = river_bounds(r);
    db.execute("DELETE FROM rivers WHERE id=?", [&r.id])
        .map_err(storage_error)?;
    db.execute(
        "INSERT INTO rivers VALUES(?,?,?,?,?,?,?)",
        params![
            r.id,
            serde_json::to_string(r).map_err(storage_error)?,
            serde_json::to_string(v).map_err(storage_error)?,
            b[0],
            b[1],
            b[2],
            b[3]
        ],
    )
    .map_err(storage_error)?;
    for n in &r.nodes {
        db.execute("INSERT INTO river_nodes VALUES(?,?)", params![n.id, r.id])
            .map_err(storage_error)?;
    }
    Ok(())
}
pub fn apply(db: &Connection, d: &RiverDelta, forward: bool) -> Result<()> {
    let (old, new) = if forward {
        (&d.before, &d.after)
    } else {
        (&d.after, &d.before)
    };
    for r in old {
        db.execute("DELETE FROM rivers WHERE id=?", [&r.river.id])
            .map_err(storage_error)?;
    }
    for r in new {
        put(db, r)?;
    }
    Ok(())
}
struct Sampler<'a> {
    db: &'a Connection,
    regions: BTreeMap<(i32, i32), terrain::Grid>,
    overrides: &'a [(i32, i32, f64)],
}
impl Sampler<'_> {
    fn at(&mut self, p: Point) -> Result<f64> {
        let k = ((p[0] / 160.).floor() as i32, (p[1] / 160.).floor() as i32);
        if !self.regions.contains_key(&k) {
            if self.regions.len() >= 512 {
                self.regions.pop_first();
            }
            let b = [
                k.0 as f64 * 160. - 5.,
                k.1 as f64 * 160. - 5.,
                (k.0 + 1) as f64 * 160. + 5.,
                (k.1 + 1) as f64 * 160. + 5.,
            ];
            let mut g = terrain_store::grid(self.db, b)?;
            g.extend(
                self.overrides
                    .iter()
                    .filter(|&&(x, y, _)| {
                        x as f64 * 5. >= b[0]
                            && x as f64 * 5. <= b[2]
                            && y as f64 * 5. >= b[1]
                            && y as f64 * 5. <= b[3]
                    })
                    .map(|&(x, y, z)| ((x, y), z)),
            );
            self.regions.insert(k, g);
        }
        Ok(terrain::height(&self.regions[&k], p))
    }
}
fn sampler(db: &Connection) -> Sampler<'_> {
    Sampler {
        db,
        regions: BTreeMap::new(),
        overrides: &[],
    }
}
impl AtlasApplication {
    pub(in crate::atlas) fn rivers(&self, a: RiverArgs) -> Result<RiverResponse> {
        self.check(&a.version)?;
        ensure(
            a.ids.len() <= 100
                && a.bounds.iter().all(|v| v.is_finite())
                && a.bounds[0] <= a.bounds[2]
                && a.bounds[1] <= a.bounds[3],
            "Ungültige Flussabfrage",
        )?;
        if let Some(scale) = a.overview_scale {
            ensure(scale.is_finite() && scale > 0., "Ungültiger Flussmaßstab")?;
        }
        let visible = if let Some(scale) = a.overview_scale {
            overview(&self.db, a.bounds, scale)?
        } else {
            local(&self.db, a.bounds)?
        };
        let mut all: BTreeMap<_, _> = visible
            .into_iter()
            .map(|r| (r.river.id.clone(), r))
            .collect();
        for id in a.ids {
            let exists: bool = self
                .db
                .query_row(
                    "SELECT EXISTS(SELECT 1 FROM rivers WHERE id=?)",
                    [&id],
                    |r| r.get(0),
                )
                .map_err(storage_error)?;
            if exists {
                let r = get(&self.db, &id)?;
                all.insert(id, r);
            }
        }
        ensure(
            all.values().map(|v| v.samples.len()).sum::<usize>() <= 200000,
            "Flussansicht zu groß; hineinzoomen",
        )?;
        Ok(RiverResponse {
            status: self.status(),
            rivers: all.into_values().collect(),
        })
    }
    pub(in crate::atlas) fn compute_rivers(&self, intent: &Intent) -> Result<Option<Computed>> {
        let Intent::RiverEdit { action, .. } = intent else {
            return Ok(None);
        };
        let mut alloc = self.allocator()?;
        let mut sample = sampler(&self.db);

        let mut before = vec![];
        let mut after = vec![];
        match action {
            RiverAction::Delete { id } => {
                before = connected(&self.db, vec![get(&self.db, id)?])?;
                after = before
                    .iter()
                    .filter(|v| v.river.id != *id)
                    .map(|v| v.river.clone())
                    .collect();
            }
            RiverAction::Put {
                id,
                name,
                nodes,
                settings,
                reverse,
                automatic,
                snap,
            } => {
                ensure(
                    (2..=512).contains(&nodes.len())
                        && nodes
                            .iter()
                            .all(|n| crate::atlas::geometry::valid_point(n.point))
                        && snap.is_finite()
                        && (0.0..=1000000.).contains(snap),
                    "Ungültiger Flussentwurf",
                )?;
                let mut r = River {
                    id: if let Some(id) = id {
                        id.clone()
                    } else {
                        alloc.allocate("river")?
                    },
                    name: name.clone(),
                    nodes: nodes.clone(),
                    settings: settings.clone(),
                    path: vec![],
                };
                if let Some(id) = id {
                    before = connected(&self.db, vec![get(&self.db, id)?])?;
                }
                let known: BTreeSet<_> = before
                    .iter()
                    .flat_map(|v| v.river.nodes.iter().map(|n| n.id.clone()))
                    .collect();
                for n in &mut r.nodes {
                    if n.id.is_empty() {
                        n.id = alloc.allocate("rnode")?;
                    } else {
                        ensure(known.contains(&n.id), "Unbekannter Flussknoten")?;
                    }
                }
                if *automatic
                    && sample.at(r.nodes[0].point)? < sample.at(r.nodes.last().unwrap().point)?
                {
                    r.nodes.reverse();
                }
                if *reverse {
                    r.nodes.reverse();
                }
                // Endpoints snap to exact stored geometry; a confluence inserts a shared author node.
                let mut nearest = None;
                for end in [r.nodes.len() - 1, 0] {
                    if id.is_some() {
                        continue;
                    }
                    let p = r.nodes[end].point;
                    for v in local(
                        &self.db,
                        [p[0] - snap, p[1] - snap, p[0] + snap, p[1] + snap],
                    )? {
                        if Some(&v.river.id) == id.as_ref() {
                            continue;
                        }
                        for (i, w) in v.river.path.windows(2).enumerate() {
                            let (t, q, d) = project(p, w[0].point, w[1].point);
                            if d <= *snap
                                && nearest.as_ref().is_none_or(
                                    |(_, _, _, _, _, best): &(
                                        usize,
                                        RiverView,
                                        usize,
                                        f64,
                                        Point,
                                        f64,
                                    )| d < *best,
                                )
                            {
                                nearest = Some((end, v.clone(), i, t, q, d));
                            }
                        }
                    }
                }
                if let Some((end, mut host, index, t, q, _)) = nearest {
                    if end == 0 {
                        r.nodes.reverse();
                    }
                    before =
                        connected(&self.db, before.into_iter().chain([host.clone()]).collect())?;
                    let vertex = if t < 1e-7 {
                        Some(index)
                    } else if t > 1. - 1e-7 {
                        Some(index + 1)
                    } else {
                        None
                    };
                    let q = vertex.map(|i| host.river.path[i].point).unwrap_or(q);
                    let node = vertex
                        .and_then(|i| host.river.path[i].node_id.as_ref())
                        .and_then(|id| host.river.nodes.iter().find(|n| &n.id == id))
                        .cloned();
                    let node = if let Some(n) = node {
                        n
                    } else {
                        let width = host.river.path[index].width
                            + (host.river.path[index + 1].width - host.river.path[index].width) * t;
                        let n = RiverNode {
                            id: alloc.allocate("rnode")?,
                            point: q,
                            width: width.max(2.),
                        };
                        let pos = host.river.path[..=index]
                            .iter()
                            .filter(|v| v.node_id.is_some())
                            .count();
                        host.river.nodes.insert(pos, n.clone());
                        if let Some(i) = vertex {
                            host.river.path[i].node_id = Some(n.id.clone());
                        } else {
                            host.river.path.insert(
                                index + 1,
                                RiverVertex {
                                    point: q,
                                    width,
                                    node_id: Some(n.id.clone()),
                                },
                            );
                        }
                        n
                    };
                    let last = r.nodes.last_mut().unwrap();
                    last.point = node.point;
                    last.id = node.id;
                    after.push(host.river);
                }
                // Move shared nodes in all other owners, preserving their shared identity.
                for old in &before {
                    if old.river.id == r.id || after.iter().any(|v: &River| v.id == old.river.id) {
                        continue;
                    }
                    let mut other = old.river.clone();
                    let mut moved = false;
                    for n in &mut other.nodes {
                        if let Some(new) = r.nodes.iter().find(|v| v.id == n.id) {
                            if new.point != n.point {
                                n.point = new.point;
                                moved = true;
                            }
                        }
                    }
                    if moved {
                        route(&mut other, &mut |p| Ok((sample.at(p)?, false)))?;
                    }
                    after.push(other);
                }
                route(&mut r, &mut |p| Ok((sample.at(p)?, false)))?;
                if let Some(old) = before.iter().find(|v| v.river.id == r.id) {
                    if old.river.settings == r.settings {
                        preserve_segments(&old.river, &mut r);
                    }
                    for n in &old.river.nodes {
                        if !r.nodes.iter().any(|v| v.id == n.id) {
                            ensure(!before.iter().any(|v|v.river.id!=r.id && v.river.nodes.iter().any(|v|v.id==n.id)),"Verbindungsknoten kann nicht entfernt werden; zuerst Zufluss lösen oder löschen")?;
                        }
                    }
                }
                let mut nearby = local(&self.db, river_bounds(&r))?;
                if id.is_some() {
                    nearby.retain(|v| !before.iter().any(|old| old.river.id == v.river.id));
                }
                if let Some((at, t, mut host, index, u, q)) = first_crossing(&r, &nearby)? {
                    // The first existing watercourse becomes the receiving river.
                    before =
                        connected(&self.db, before.into_iter().chain([host.clone()]).collect())?;
                    let n = junction(&mut host.river, index, u, q, &mut alloc)?;
                    let q = n.point;
                    let width = r.path[at].width + (r.path[at + 1].width - r.path[at].width) * t;
                    r.path.truncate(at + 1);
                    if crate::atlas::road_terrain::distance(r.path.last().unwrap().point, q) < 1e-7
                    {
                        r.path.pop();
                    }
                    let retained: BTreeSet<_> =
                        r.path.iter().filter_map(|v| v.node_id.clone()).collect();
                    r.nodes.retain(|n| retained.contains(&n.id));
                    r.nodes.push(RiverNode {
                        id: n.id.clone(),
                        point: q,
                        width: width.max(2.),
                    });
                    r.path.push(RiverVertex {
                        point: q,
                        width,
                        node_id: Some(n.id),
                    });
                    after.retain(|v| v.id != host.river.id);
                    after.push(host.river);
                }
                for old in &before {
                    if old.river.id != r.id && !after.iter().any(|v| v.id == old.river.id) {
                        after.push(old.river.clone());
                    }
                }
                validate(&r)?;
                after.push(r);
            }
        }
        // Connected edits must preserve the graph, not introduce unmodelled crossings.
        let geometry: Vec<_> = after
            .iter()
            .map(|r| RiverView {
                river: r.clone(),
                samples: vec![],
            })
            .collect();
        for r in &after {
            ensure(
                first_crossing(r, &geometry)?.is_none(),
                "Fluss kreuzt einen Netzabschnitt ohne Verbindung; Verlauf korrigieren",
            )?;
        }
        let mut after = profiles(after, &mut |p| water_level(&self.db, p, None), &mut |p| {
            sample.at(p)
        })?;
        before.sort_by(|a, b| a.river.id.cmp(&b.river.id));
        after.sort_by(|a, b| a.river.id.cmp(&b.river.id));
        let delta = RiverDelta { before, after };
        let mut out = Computed::default();
        if delta.before != delta.after {
            out.river_preview = Some(delta.clone());
            out.change.rivers = Some(delta);
            out.next_identity = Some(alloc.next);
        }
        Ok(Some(out))
    }
    pub(in crate::atlas) fn refresh_rivers(&self, c: &mut Computed) -> Result<()> {
        if c.change.terrain.is_none()
            && c.change.world_terrain.is_none()
            && c.change.waters.is_none()
        {
            return Ok(());
        }
        let heights = c
            .change
            .terrain
            .as_ref()
            .map_or(&[][..], |t| t.after.as_slice());
        let mut initial = BTreeMap::new();
        if let Some(d) = &c.change.world_terrain {
            for v in local(&self.db, d.bounds())? {
                initial.insert(v.river.id.clone(), v);
            }
        }
        if let Some(d) = &c.change.waters {
            for w in d.before.iter().chain(&d.after) {
                if let Some(b) = crate::atlas::regions::bounds(&crate::atlas::water::geometry(w)) {
                    for v in local(&self.db, b)? {
                        initial.insert(v.river.id.clone(), v);
                    }
                }
            }
        }
        {
            let tiles: BTreeSet<_> = heights
                .iter()
                .map(|&(x, y, _)| (x.div_euclid(32), y.div_euclid(32)))
                .collect();
            for (x, y) in tiles {
                for v in local(
                    &self.db,
                    [
                        x as f64 * 160. - 5.,
                        y as f64 * 160. - 5.,
                        (x + 1) as f64 * 160. + 5.,
                        (y + 1) as f64 * 160. + 5.,
                    ],
                )? {
                    initial.insert(v.river.id.clone(), v);
                }
            }
        }
        let before = connected(&self.db, initial.into_values().collect())?;
        if before.is_empty() {
            return Ok(());
        }
        let mut s = Sampler {
            db: &self.db,
            regions: BTreeMap::new(),
            overrides: heights,
        };
        let after = profiles(
            before.iter().map(|v| v.river.clone()).collect(),
            &mut |p| water_level(&self.db, p, c.change.waters.as_ref()),
            &mut |p| s.at(p),
        )?;
        c.change.rivers = Some(RiverDelta { before, after });
        c.river_preview = c.change.rivers.clone();
        Ok(())
    }
}
pub fn import(source: &Connection, target: &Connection) -> Result<()> {
    let mut q = source
        .prepare("SELECT id,body FROM rivers ORDER BY id")
        .map_err(storage_error)?;
    let mut rows = q.query([]).map_err(storage_error)?;
    let mut ids = vec![];
    while let Some(row) = rows.next().map_err(storage_error)? {
        let r: River = serde_json::from_str(&row.get::<_, String>(1).map_err(storage_error)?)
            .map_err(invalid)?;
        ensure(
            r.id == row.get::<_, String>(0).map_err(storage_error)?,
            "Ungültige Flussidentität",
        )?;
        validate(&r)?;
        ids.push(r.id.clone());
        ensure(ids.len() <= 100000, "Zu viele Flüsse")?;
        put(
            target,
            &RiverView {
                river: r,
                samples: vec![],
            },
        )?;
    }
    let mut visited = BTreeSet::new();
    let mut s = sampler(target);

    for id in ids {
        if visited.contains(&id) {
            continue;
        }
        let component = connected(target, vec![get(target, &id)?])?;
        for v in &component {
            visited.insert(v.river.id.clone());
        }
        for v in profiles(
            component.into_iter().map(|v| v.river).collect(),
            &mut |p| water_level(target, p, None),
            &mut |p| s.at(p),
        )? {
            put(target, &v)?;
        }
    }
    Ok(())
}
pub fn overlay(db: &Connection, b: Bounds, delta: Option<&RiverDelta>) -> Result<Vec<RiverView>> {
    let mut views = local(db, b)?;
    if let Some(d) = delta {
        views.retain(|v| {
            !d.before
                .iter()
                .chain(&d.after)
                .any(|r| r.river.id == v.river.id)
        });
        views.extend(
            d.after
                .iter()
                .filter(|v| {
                    let q = river_bounds(&v.river);
                    q[0] <= b[2] && q[2] >= b[0] && q[1] <= b[3] && q[3] >= b[1]
                })
                .cloned(),
        );
    }
    Ok(views)
}
fn preserve_segments(old: &River, new: &mut River) {
    let mut path = vec![];
    for pair in new.nodes.windows(2) {
        let same = old.nodes.windows(2).any(|p| p == pair);
        let source = if same { old } else { &*new };
        let a = source
            .path
            .iter()
            .position(|v| v.node_id.as_ref() == Some(&pair[0].id))
            .unwrap();
        let b = source
            .path
            .iter()
            .position(|v| v.node_id.as_ref() == Some(&pair[1].id))
            .unwrap();
        path.extend_from_slice(&source.path[a..b]);
    }
    path.push(new.path.last().unwrap().clone());
    new.path = path;
}
fn junction(
    host: &mut River,
    index: usize,
    t: f64,
    q: Point,
    alloc: &mut crate::atlas::change::ActionAllocator,
) -> Result<RiverNode> {
    let vertex = if t < 1e-7 {
        Some(index)
    } else if t > 1. - 1e-7 {
        Some(index + 1)
    } else {
        None
    };
    let q = vertex.map(|i| host.path[i].point).unwrap_or(q);
    if let Some(n) = vertex
        .and_then(|i| host.path[i].node_id.as_ref())
        .and_then(|id| host.nodes.iter().find(|n| &n.id == id))
    {
        return Ok(n.clone());
    }
    let width = host.path[index].width + (host.path[index + 1].width - host.path[index].width) * t;
    let n = RiverNode {
        id: alloc.allocate("rnode")?,
        point: q,
        width: width.max(2.),
    };
    let pos = host.path[..=index]
        .iter()
        .filter(|v| v.node_id.is_some())
        .count();
    host.nodes.insert(pos, n.clone());
    if let Some(i) = vertex {
        host.path[i].node_id = Some(n.id.clone());
    } else {
        host.path.insert(
            index + 1,
            RiverVertex {
                point: q,
                width,
                node_id: Some(n.id.clone()),
            },
        );
    }
    Ok(n)
}
#[derive(Clone)]
struct Crossing {
    owner: usize,
    index: usize,
    a: Point,
    b: Point,
}
impl rstar::RTreeObject for Crossing {
    type Envelope = rstar::AABB<Point>;
    fn envelope(&self) -> Self::Envelope {
        rstar::AABB::from_corners(
            [self.a[0].min(self.b[0]), self.a[1].min(self.b[1])],
            [self.a[0].max(self.b[0]), self.a[1].max(self.b[1])],
        )
    }
}
type Hit = (usize, f64, RiverView, usize, f64, Point);
fn first_crossing(r: &River, others: &[RiverView]) -> Result<Option<Hit>> {
    use rstar::RTreeObject;
    let edges: Vec<_> = others
        .iter()
        .enumerate()
        .filter(|(_, o)| o.river.id != r.id)
        .flat_map(|(owner, o)| {
            o.river
                .path
                .windows(2)
                .enumerate()
                .map(move |(index, p)| Crossing {
                    owner,
                    index,
                    a: p[0].point,
                    b: p[1].point,
                })
        })
        .collect();
    ensure(
        edges.len() <= 200000,
        "Zu viele Flusskreuzungen im Suchbereich",
    )?;
    let tree = rstar::RTree::bulk_load(edges);
    for (at, pair) in r.path.windows(2).enumerate() {
        let query = Crossing {
            owner: 0,
            index: 0,
            a: pair[0].point,
            b: pair[1].point,
        };
        let mut hit: Option<Hit> = None;
        for edge in tree.locate_in_envelope_intersecting(&query.envelope()) {
            if let Some((t, u, q)) = intersection(query.a, query.b, edge.a, edge.b) {
                // Existing shared junctions are preserved while editing or extending.
                let shared = pair.iter().any(|p| {
                    p.node_id.as_ref().is_some_and(|id| {
                        others[edge.owner].river.nodes.iter().any(|n| {
                            n.id == *id && crate::atlas::road_terrain::distance(n.point, q) < 1e-6
                        })
                    })
                });
                if shared {
                    continue;
                }
                if at == 0 && t < 1e-7 {
                    continue;
                }
                if hit.as_ref().is_none_or(|h| {
                    t < h.1 || (t == h.1 && others[edge.owner].river.id < h.2.river.id)
                }) {
                    hit = Some((at, t, others[edge.owner].clone(), edge.index, u, q));
                }
            }
        }
        if hit.is_some() {
            return Ok(hit);
        }
    }
    Ok(None)
}

fn water_level(
    db: &Connection,
    p: Point,
    delta: Option<&crate::atlas::water::WaterDelta>,
) -> Result<Option<f64>> {
    Ok(crate::atlas::water::level_at(
        &super::water_store::overlay(db, [p[0], p[1], p[0], p[1]], delta)?,
        p,
    ))
}

/// Bounded display only; exact editing and profile solving use `local`/`get`.
pub fn overview(db: &Connection, b: Bounds, scale: f64) -> Result<Vec<RiverView>> {
    let mut q=db.prepare_cached("SELECT r.view FROM rivers r JOIN river_spatial s ON s.key=r.rowid WHERE s.min_x<=?1 AND s.max_x>=?2 AND s.min_y<=?3 AND s.max_y>=?4 AND max(r.max_x-r.min_x,r.max_y-r.min_y)*?5>=8 ORDER BY max(r.max_x-r.min_x,r.max_y-r.min_y) DESC,r.id LIMIT 128").map_err(storage_error)?;
    let rows = q
        .query_map(params![b[2], b[0], b[3], b[1], scale], |r| {
            r.get::<_, String>(0)
        })
        .map_err(storage_error)?;
    let mut out = vec![];
    for row in rows {
        let mut v: RiverView =
            serde_json::from_str(&row.map_err(storage_error)?).map_err(storage_error)?;
        let count = v.samples.len();
        if count > 128 {
            v.samples = (0..128)
                .map(|i| v.samples[i * (count - 1) / 127].clone())
                .collect();
        }
        v.river.path = v
            .samples
            .iter()
            .map(|s| RiverVertex {
                point: s.point,
                width: s.width,
                node_id: None,
            })
            .collect();
        out.push(v);
    }
    Ok(out)
}
