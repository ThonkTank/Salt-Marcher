//! Region author tables, bounded spatial reads, and atomic history deltas.
use super::AtlasApplication;
use crate::atlas::{
    change::Computed,
    errors::{ensure, invalid, storage_error},
    model::{Bounds, Point, Status, Version},
    regions::*,
    Intent, Result,
};
use geo::{Area, BooleanOps, Simplify};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RegionArgs {
    pub version: Version,
    pub bounds: Option<Bounds>,
    pub ids: Vec<String>,
    pub rank_ids: Vec<String>,
    pub detail: Option<String>,
    pub scale: f64,
    #[serde(default)]
    pub exact: bool,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RegionSummary {
    pub id: String,
    pub name: String,
    pub rank_id: String,
    pub area: f64,
    pub anchor: Point,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RegionRelation {
    pub region: RegionSummary,
    pub higher: bool,
    pub fraction: f64,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RegionResponse {
    pub status: Status,
    pub catalog: RegionCatalog,
    pub summaries: Vec<RegionSummary>,
    pub regions: Vec<Region>,
    pub relations: Vec<RegionRelation>,
}
pub fn install(db: &Connection) -> Result<()> {
    db.execute_batch("CREATE TABLE region_catalog(singleton INTEGER PRIMARY KEY,body TEXT NOT NULL); CREATE TABLE regions(id TEXT PRIMARY KEY,body TEXT NOT NULL,rank_id TEXT NOT NULL,name TEXT NOT NULL,area REAL NOT NULL,anchor_x REAL NOT NULL,anchor_y REAL NOT NULL,min_x REAL,min_y REAL,max_x REAL,max_y REAL); CREATE INDEX region_rank ON regions(rank_id); CREATE VIRTUAL TABLE region_spatial USING rtree(key,min_x,max_x,min_y,max_y); CREATE TRIGGER region_insert AFTER INSERT ON regions WHEN new.min_x IS NOT NULL BEGIN INSERT INTO region_spatial VALUES(new.rowid,new.min_x,new.max_x,new.min_y,new.max_y); END; CREATE TRIGGER region_delete AFTER DELETE ON regions BEGIN DELETE FROM region_spatial WHERE key=old.rowid; END;").map_err(storage_error)?;
    db.execute(
        "INSERT INTO region_catalog VALUES(1,?)",
        [serde_json::to_string(&RegionCatalog::default()).map_err(storage_error)?],
    )
    .map_err(storage_error)?;
    Ok(())
}
pub fn catalog(db: &Connection) -> Result<RegionCatalog> {
    let s: String = db
        .query_row(
            "SELECT body FROM region_catalog WHERE singleton=1",
            [],
            |r| r.get(0),
        )
        .map_err(storage_error)?;
    serde_json::from_str(&s).map_err(invalid)
}
pub fn get(db: &Connection, id: &str) -> Result<Region> {
    let s: String = db
        .query_row("SELECT body FROM regions WHERE id=?", [id], |r| r.get(0))
        .map_err(|_| invalid("Region nicht gefunden"))?;
    serde_json::from_str(&s).map_err(invalid)
}
pub fn put(db: &Connection, r: &Region) -> Result<()> {
    let g = geometry(r);
    let b = bounds(&g).or_else(|| r.label.anchor.map(|p| [p[0], p[1], p[0], p[1]]));
    let a = r.label.anchor.unwrap_or_else(|| anchor(&g));
    db.execute("DELETE FROM regions WHERE id=?", [&r.id])
        .map_err(storage_error)?;
    db.execute(
        "INSERT INTO regions VALUES(?,?,?,?,?,?,?,?,?,?,?)",
        params![
            r.id,
            serde_json::to_string(r).map_err(storage_error)?,
            r.rank_id,
            r.name,
            g.unsigned_area(),
            a[0],
            a[1],
            b.map(|b| b[0]),
            b.map(|b| b[1]),
            b.map(|b| b[2]),
            b.map(|b| b[3])
        ],
    )
    .map_err(storage_error)?;
    Ok(())
}
pub fn apply(db: &Connection, d: &RegionDelta, forward: bool) -> Result<()> {
    let (old, new, c) = if forward {
        (&d.before, &d.after, &d.catalog_after)
    } else {
        (&d.after, &d.before, &d.catalog_before)
    };
    for r in old {
        db.execute("DELETE FROM regions WHERE id=?", [&r.id])
            .map_err(storage_error)?;
    }
    for r in new {
        put(db, r)?;
    }
    db.execute(
        "UPDATE region_catalog SET body=? WHERE singleton=1",
        [serde_json::to_string(c).map_err(storage_error)?],
    )
    .map_err(storage_error)?;
    Ok(())
}
fn overview_summaries(db: &Connection) -> Result<Vec<RegionSummary>> {
    let mut q = db.prepare_cached("SELECT id,name,rank_id,area,anchor_x,anchor_y FROM regions ORDER BY area DESC,id LIMIT 1000").map_err(storage_error)?;
    let result = q
        .query_map([], |r| {
            Ok(RegionSummary {
                id: r.get(0)?,
                name: r.get(1)?,
                rank_id: r.get(2)?,
                area: r.get(3)?,
                anchor: [r.get(4)?, r.get(5)?],
            })
        })
        .map_err(storage_error)?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(storage_error);
    result
}
fn summaries(db: &Connection) -> Result<Vec<RegionSummary>> {
    let mut q = db
        .prepare(
            "SELECT id,name,rank_id,area,anchor_x,anchor_y FROM regions ORDER BY id LIMIT 100001",
        )
        .map_err(storage_error)?;
    let out = q
        .query_map([], |r| {
            Ok(RegionSummary {
                id: r.get(0)?,
                name: r.get(1)?,
                rank_id: r.get(2)?,
                area: r.get(3)?,
                anchor: [r.get(4)?, r.get(5)?],
            })
        })
        .map_err(storage_error)?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(storage_error)?;
    ensure(out.len() <= 100_000, "Höchstens 100.000 Regionen")?;
    Ok(out)
}
fn spatial(db: &Connection, b: Bounds) -> Result<Vec<String>> {
    spatial_rank(db, b, None)
}
fn spatial_rank(db: &Connection, b: Bounds, rank: Option<&str>) -> Result<Vec<String>> {
    let mut q=db.prepare("SELECT r.id FROM region_spatial s JOIN regions r ON r.rowid=s.key WHERE s.min_x<=? AND s.max_x>=? AND s.min_y<=? AND s.max_y>=? AND (?5 IS NULL OR r.rank_id=?5) ORDER BY r.id LIMIT 10001").map_err(storage_error)?;
    let out = q
        .query_map(params![b[2], b[0], b[3], b[1], rank], |r| r.get(0))
        .map_err(storage_error)?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(storage_error)?;
    ensure(
        out.len() <= 10_000,
        "Zu viele Regionen im Ausschnitt; bitte hineinzoomen",
    )?;
    Ok(out)
}
#[derive(Default)]
pub(in crate::atlas) struct RegionReadCache {
    revision: Option<i64>,
    catalog: Option<RegionCatalog>,
    summaries: Vec<RegionSummary>,
    relations: std::collections::BTreeMap<String, Vec<RegionRelation>>,
}
impl AtlasApplication {
    pub(in crate::atlas) fn regions(&self, args: RegionArgs) -> Result<RegionResponse> {
        self.check(&args.version)?;
        ensure(
            args.scale.is_finite()
                && args.scale > 0.0
                && args.ids.len() <= 1000
                && args.rank_ids.len() <= 512,
            "Ungültige Regionsabfrage",
        )?;
        let mut cache = self.region_cache.borrow_mut();
        if cache.revision != Some(self.revision) {
            cache.catalog = Some(catalog(&self.db)?);
            cache.summaries.clear();
            cache.relations.clear();
            cache.revision = Some(self.revision);
        }
        let c = cache.catalog.clone().unwrap();
        let full = args.exact || args.detail.is_some();
        if full && cache.summaries.is_empty() {
            cache.summaries = summaries(&self.db)?;
        }
        let mut summaries = if full {
            cache.summaries.clone()
        } else {
            overview_summaries(&self.db)?
        };
        let by_id: std::collections::HashMap<_, _> =
            summaries.iter().map(|s| (s.id.as_str(), s)).collect();
        let mut ids = args.ids;
        if let Some(b) = args.bounds {
            ensure(
                b.iter().all(|v| v.is_finite()) && b[0] <= b[2] && b[1] <= b[3],
                "Ungültiger Ausschnitt",
            )?;
            let visible = if args.exact {
                spatial(&self.db, b)?
            } else {
                let mut q=self.db.prepare_cached("SELECT r.id FROM regions r JOIN region_spatial s ON r.rowid=s.key WHERE s.min_x<=?1 AND s.max_x>=?2 AND s.min_y<=?3 AND s.max_y>=?4 AND r.rank_id IN (SELECT value FROM json_each(?5)) ORDER BY r.area DESC,r.id LIMIT 1000").map_err(storage_error)?;
                let visible = q
                    .query_map(
                        params![
                            b[2],
                            b[0],
                            b[3],
                            b[1],
                            serde_json::to_string(&args.rank_ids).map_err(storage_error)?
                        ],
                        |r| r.get::<_, String>(0),
                    )
                    .map_err(storage_error)?
                    .collect::<rusqlite::Result<Vec<_>>>()
                    .map_err(storage_error)?;
                visible
            };
            for id in visible {
                if !args.exact
                    || by_id
                        .get(id.as_str())
                        .is_some_and(|s| args.rank_ids.contains(&s.rank_id))
                {
                    ids.push(id)
                }
            }
        }
        if let Some(id) = &args.detail {
            ids.push(id.clone())
        }
        ids.sort();
        ids.dedup();
        ensure(ids.len() <= 2000, "Zu viele sichtbare Regionen")?;
        let mut regions = vec![];
        let mut relations = vec![];
        let mut vertices = 0;
        let mut visible_summaries = vec![];
        for id in ids {
            let mut r = get(&self.db, &id)?;
            if !full {
                let g = geometry(&r);
                visible_summaries.push(RegionSummary {
                    id: r.id.clone(),
                    name: r.name.clone(),
                    rank_id: r.rank_id.clone(),
                    area: g.unsigned_area(),
                    anchor: r.label.anchor.unwrap_or_else(|| anchor(&g)),
                });
            }
            if args.detail.as_ref() == Some(&id) {
                if let Some(cached) = cache.relations.get(&id) {
                    relations = cached.clone();
                } else {
                    let g = geometry(&r);
                    let rank = c
                        .ranks
                        .iter()
                        .position(|x| x.id == r.rank_id)
                        .ok_or_else(|| invalid("Rang fehlt"))?;
                    if let Some(b) = bounds(&g) {
                        let mut work = 0;
                        for other in spatial(&self.db, b)? {
                            if other == id {
                                continue;
                            }
                            let s = *by_id.get(other.as_str()).unwrap();
                            let index = c.ranks.iter().position(|x| x.id == s.rank_id).unwrap();
                            if rank == index
                                || c.ranks[index].category_id != c.ranks[rank].category_id
                            {
                                continue;
                            }
                            let o = get(&self.db, &other)?;
                            work += r
                                .polygons
                                .iter()
                                .map(|p| {
                                    p.outer.len() + p.holes.iter().map(Vec::len).sum::<usize>()
                                })
                                .sum::<usize>()
                                + o.polygons
                                    .iter()
                                    .map(|p| {
                                        p.outer.len() + p.holes.iter().map(Vec::len).sum::<usize>()
                                    })
                                    .sum::<usize>();
                            ensure(work <= 2_000_000, "Zu aufwendige Regionsbeziehungen")?;
                            let a = overlap(&g, &geometry(&o));
                            if a > 0.0 {
                                relations.push(RegionRelation {
                                    region: s.clone(),
                                    higher: index > rank,
                                    fraction: (a / if index > rank {
                                        g.unsigned_area()
                                    } else {
                                        s.area
                                    })
                                    .min(1.0),
                                });
                            }
                        }
                    }
                    if cache.relations.len() >= 128 {
                        cache.relations.clear();
                    }
                    cache.relations.insert(id.clone(), relations.clone());
                }
            } else if !args.exact {
                r.polygons = authored(geometry(&r).simplify(0.5 / args.scale));
            }
            vertices += r
                .polygons
                .iter()
                .map(|p| p.outer.len() + p.holes.iter().map(Vec::len).sum::<usize>())
                .sum::<usize>();
            ensure(
                vertices <= 250_000,
                "Regionsdarstellung zu komplex; bitte hineinzoomen",
            )?;
            regions.push(r);
        }
        if !full && args.bounds.is_some() {
            summaries = visible_summaries;
        }
        Ok(RegionResponse {
            status: self.status(),
            catalog: c,
            summaries,
            regions,
            relations,
        })
    }
    pub(in crate::atlas) fn compute_regions(&self, intent: &Intent) -> Result<Option<Computed>> {
        if !matches!(
            intent,
            Intent::RegionEdit { .. } | Intent::RegionStroke { .. }
        ) {
            return Ok(None);
        }
        let c = catalog(&self.db)?;
        let mut d = RegionDelta {
            before: vec![],
            after: vec![],
            catalog_before: c.clone(),
            catalog_after: c,
        };
        let mut alloc = self.allocator()?;
        match intent {
            Intent::RegionStroke {
                id,
                points,
                radius,
                erase,
            } => {
                let r = get(&self.db, id)?;
                let shape = brush(points, *radius)?;
                let mut next = r.clone();
                let g = geometry(&r);
                next.polygons = authored(if *erase {
                    g.difference(&shape)
                } else {
                    g.union(&shape)
                });
                d.before.push(r.clone());
                d.after.push(next);
                if !erase {
                    let mut work = 0;
                    for other in bounds(&shape)
                        .map(|b| spatial_rank(&self.db, b, Some(&r.rank_id)))
                        .transpose()?
                        .unwrap_or_default()
                    {
                        if other == *id {
                            continue;
                        }
                        let other = get(&self.db, &other)?;
                        if other.rank_id != r.rank_id {
                            continue;
                        }
                        work += other
                            .polygons
                            .iter()
                            .map(|p| p.outer.len() + p.holes.iter().map(Vec::len).sum::<usize>())
                            .sum::<usize>();
                        ensure(work <= 2_000_000, "Regionsstrich zu aufwendig")?;
                        let mut n = other.clone();
                        n.polygons = authored(geometry(&other).difference(&shape));
                        if n != other {
                            d.before.push(other);
                            d.after.push(n)
                        }
                    }
                }
            }
            Intent::RegionEdit { action } => match action {
                RegionAction::Create { name, rank_id } => {
                    ensure(
                        summaries(&self.db)?.len() < 100_000,
                        "Höchstens 100.000 Regionen",
                    )?;
                    d.after.push(Region {
                        id: alloc.allocate("region")?,
                        name: name.clone(),
                        rank_id: rank_id.clone(),
                        polygons: vec![],
                        style: RegionStyle {
                            color: "#6087b5".into(),
                            opacity: 0.15,
                            width: 2.0,
                            dash: RegionDash::Solid,
                        },
                        label: RegionLabel {
                            anchor: None,
                            min_scale: None,
                            max_scale: None,
                        },
                    });
                }
                RegionAction::Update {
                    id,
                    name,
                    rank_id,
                    style,
                    label,
                } => {
                    let old = get(&self.db, id)?;
                    let mut n = old.clone();
                    n.name = name.clone();
                    n.rank_id = rank_id.clone();
                    n.style = style.clone();
                    n.label = label.clone();
                    if n.rank_id != old.rank_id {
                        if let Some(b) = bounds(&geometry(&n)) {
                            for other in spatial_rank(&self.db, b, Some(&n.rank_id))? {
                                if other == *id {
                                    continue;
                                }
                                let o = get(&self.db, &other)?;
                                ensure(
                                    o.rank_id != n.rank_id
                                        || overlap(&geometry(&n), &geometry(&o)) == 0.0,
                                    "Zielrangstufe enthält überlappende Region",
                                )?;
                            }
                        }
                    }
                    d.before.push(old);
                    d.after.push(n);
                }
                RegionAction::Delete { id } => d.before.push(get(&self.db, id)?),
                RegionAction::Catalog { catalog } => {
                    ensure(
                        catalog
                            .categories
                            .iter()
                            .all(|x| d.catalog_before.categories.iter().any(|v| v.id == x.id))
                            && catalog.ranks.iter().all(|x| {
                                d.catalog_before
                                    .ranks
                                    .iter()
                                    .any(|v| v.id == x.id && v.category_id == x.category_id)
                            })
                            && catalog.categories.len() == d.catalog_before.categories.len()
                            && catalog.ranks.len() == d.catalog_before.ranks.len(),
                        "Kategorien über Hinzufügen/Löschen ändern",
                    )?;
                    d.catalog_after = catalog.clone();
                }
                RegionAction::AddCategory { name } => {
                    let id = alloc.allocate("category")?;
                    d.catalog_after.categories.push(RegionCategory {
                        id: id.clone(),
                        name: name.clone(),
                        visible: true,
                        fixed_rank: None,
                        markers: false,
                    });
                    d.catalog_after.ranks.push(RegionRank {
                        id: alloc.allocate("rank")?,
                        name: "Gebiet".into(),
                        category_id: id,
                    });
                }
                RegionAction::AddRank { category_id, name } => {
                    d.catalog_after.ranks.push(RegionRank {
                        id: alloc.allocate("rank")?,
                        name: name.clone(),
                        category_id: category_id.clone(),
                    })
                }
                RegionAction::DeleteCategory { id } => {
                    ensure(
                        d.catalog_after.categories.iter().any(|c| c.id == *id),
                        "Kategorie fehlt",
                    )?;
                    d.catalog_after.categories.retain(|c| c.id != *id);
                    d.catalog_after.ranks.retain(|r| r.category_id != *id);
                }
                RegionAction::DeleteRank { id } => {
                    ensure(
                        d.catalog_after.ranks.iter().any(|r| r.id == *id),
                        "Rangstufe fehlt",
                    )?;
                    d.catalog_after.ranks.retain(|r| r.id != *id);
                    for c in &mut d.catalog_after.categories {
                        if c.fixed_rank.as_ref() == Some(id) {
                            c.fixed_rank = None
                        }
                    }
                }
            },
            _ => unreachable!(),
        }
        validate_catalog(&d.catalog_after)?;
        if d.catalog_after != d.catalog_before {
            for s in summaries(&self.db)? {
                if !d.catalog_after.ranks.iter().any(|r| r.id == s.rank_id) {
                    d.before.push(get(&self.db, &s.id)?);
                }
            }
        }
        for r in &d.after {
            validate(r, &d.catalog_after)?;
        }
        let mut out = Computed::default();
        if d.before != d.after || d.catalog_before != d.catalog_after {
            out.region_preview = Some(d.after.clone());
            out.change.regions = Some(d);
            out.next_identity = Some(alloc.next);
        }
        Ok(Some(out))
    }
}
pub fn import(source: &Connection, target: &Connection) -> Result<()> {
    let c = catalog(source)?;
    validate_catalog(&c)?;
    let n: i64 = source
        .query_row("SELECT count(*) FROM region_catalog", [], |r| r.get(0))
        .map_err(storage_error)?;
    ensure(n == 1, "Ungültiger Regionskatalog")?;
    target
        .execute(
            "UPDATE region_catalog SET body=? WHERE singleton=1",
            [serde_json::to_string(&c).map_err(storage_error)?],
        )
        .map_err(storage_error)?;
    let mut q = source
        .prepare("SELECT id,body FROM regions ORDER BY id")
        .map_err(storage_error)?;
    let mut rows = q.query([]).map_err(storage_error)?;
    let mut count = 0;
    while let Some(row) = rows.next().map_err(storage_error)? {
        count += 1;
        ensure(count <= 100_000, "Zu viele Regionen")?;
        let id: String = row.get(0).map_err(storage_error)?;
        let body: String = row.get(1).map_err(storage_error)?;
        let r: Region = serde_json::from_str(&body).map_err(invalid)?;
        ensure(id == r.id, "Ungültige Regionsidentität")?;
        validate(&r, &c)?;
        if let Some(b) = bounds(&geometry(&r)) {
            for id in spatial_rank(target, b, Some(&r.rank_id))? {
                let o = get(target, &id)?;
                ensure(
                    o.rank_id != r.rank_id || overlap(&geometry(&o), &geometry(&r)) == 0.0,
                    "Überlappende Regionen derselben Rangstufe",
                )?;
            }
        }
        put(target, &r)?;
    }
    Ok(())
}
