//! The document owner's working SQL, indices and atomic apply/history boundary.
use crate::atlas::application::AtlasApplication;
use crate::atlas::change::ActionAllocator;
use crate::atlas::change::{ChangeSet, Computed, History, SmallPatch};
use crate::atlas::errors::{invalid, storage_error};
use crate::atlas::geometry::occupancy_bounds;
use crate::atlas::model::{
    Bounds, ChangeHints, FullHouse, FullObject, HouseHeader, HouseParts, InteriorMetadata, Parcel,
    Road, SceneObject,
};
use crate::atlas::{change_hints, Result};
use crate::interior::Cell;
use rusqlite::OptionalExtension;
use rusqlite::{params, Connection, Params};
use std::collections::HashSet;
use std::sync::atomic::{AtomicU64, Ordering};
static SESSION: AtomicU64 = AtomicU64::new(0);
impl AtlasApplication {
    pub fn new() -> Result<Self> {
        let temp = tempfile::tempdir().map_err(storage_error)?;
        let db = Connection::open(temp.path().join("working.sqlite")).map_err(storage_error)?;
        db.execute_batch(r#"
            -- The working schema is internal and is never exported.
            PRAGMA user_version=0;
            PRAGMA foreign_keys=ON;
            CREATE TABLE objects(id TEXT PRIMARY KEY,kind TEXT NOT NULL,body TEXT NOT NULL,metadata TEXT NOT NULL,min_x REAL NOT NULL,min_y REAL NOT NULL,max_x REAL NOT NULL,max_y REAL NOT NULL);
            CREATE TABLE document_meta(singleton INTEGER PRIMARY KEY CHECK(singleton=1),next_identity INTEGER NOT NULL CHECK(next_identity>=1));
            INSERT INTO document_meta VALUES(1,1);
            CREATE UNIQUE INDEX house_parcel_owner ON objects(json_extract(body,'$.placement.parcelId')) WHERE kind='house' AND json_extract(body,'$.placement.kind')='parcel';
            CREATE INDEX parcel_road_section ON objects(json_extract(body,'$.source.roadId'),json_extract(body,'$.source.sectionId')) WHERE kind='parcel' AND json_extract(body,'$.source.kind')='road';
            CREATE VIRTUAL TABLE occupancy_spatial USING rtree(key,min_x,max_x,min_y,max_y);
            CREATE TABLE house_cells(building_id TEXT PRIMARY KEY REFERENCES objects(id) ON DELETE CASCADE,payload TEXT NOT NULL);
            CREATE TABLE local_cells(building_id TEXT NOT NULL REFERENCES objects(id) ON DELETE CASCADE,floor INTEGER NOT NULL,x INTEGER NOT NULL,y INTEGER NOT NULL,room_id TEXT NOT NULL,PRIMARY KEY(building_id,floor,x,y));
            CREATE INDEX lower_cells ON local_cells(building_id,x,y,floor DESC);
            CREATE VIRTUAL TABLE spatial USING rtree(key,min_x,max_x,min_y,max_y);
            CREATE TRIGGER spatial_insert AFTER INSERT ON objects BEGIN INSERT INTO spatial VALUES(new.rowid,new.min_x,new.max_x,new.min_y,new.max_y);
            END;
            CREATE TRIGGER spatial_update AFTER UPDATE ON objects BEGIN UPDATE spatial SET min_x=new.min_x,max_x=new.max_x,min_y=new.min_y,max_y=new.max_y WHERE key=new.rowid;
            END;
            CREATE TRIGGER spatial_delete AFTER DELETE ON objects BEGIN DELETE FROM spatial WHERE key=old.rowid;
            END;
            CREATE TRIGGER occupancy_insert AFTER INSERT ON objects WHEN new.kind='house' BEGIN INSERT INTO occupancy_spatial VALUES(new.rowid,json_extract(new.body,'$.occupancyBounds[0]'),json_extract(new.body,'$.occupancyBounds[2]'),json_extract(new.body,'$.occupancyBounds[1]'),json_extract(new.body,'$.occupancyBounds[3]'));
            END;
            CREATE TRIGGER occupancy_update AFTER UPDATE ON objects BEGIN DELETE FROM occupancy_spatial WHERE key=old.rowid;
            INSERT INTO occupancy_spatial SELECT new.rowid,json_extract(new.body,'$.occupancyBounds[0]'),json_extract(new.body,'$.occupancyBounds[2]'),json_extract(new.body,'$.occupancyBounds[1]'),json_extract(new.body,'$.occupancyBounds[3]') WHERE new.kind='house';
            END;
            CREATE TRIGGER occupancy_delete AFTER DELETE ON objects BEGIN DELETE FROM occupancy_spatial WHERE key=old.rowid;
            END;
            CREATE TEMP TABLE history(seq INTEGER PRIMARY KEY,body TEXT NOT NULL);
        "#).map_err(storage_error)?;
        super::map_tiles::install(&db)?;
        Ok(Self {
            db,
            _temp: temp,
            session: format!(
                "v7-{}-{}",
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map_err(storage_error)?
                    .as_nanos(),
                SESSION.fetch_add(1, Ordering::Relaxed)
            ),
            revision: 0,
            path: None,
            cursor: 0,
            tip: 0,
            history_floor: 0,
            state: 0,
            saved: 0,
            next_state: 1,
            last_changes: None,
        })
    }
    pub(in crate::atlas) fn object(&self, id: &str) -> Result<FullObject> {
        read_object(&self.db, id)
    }
    pub(in crate::atlas) fn house_parts(&self, id: &str) -> Result<HouseParts> {
        read_house_parts(&self.db, id)
    }
    fn headers(&self, sql: &str, params: impl Params) -> Result<Vec<SceneObject>> {
        let mut query = self.db.prepare(sql).map_err(storage_error)?;
        let rows = query
            .query_map(params, |row| row.get::<_, String>(0))
            .map_err(storage_error)?;
        rows.map(|row| serde_json::from_str(&row.map_err(storage_error)?).map_err(storage_error))
            .collect()
    }
    pub(in crate::atlas) fn query(&self, b: Bounds) -> Result<Vec<SceneObject>> {
        let count: i64 = self.db.query_row("SELECT count(*) FROM (SELECT key FROM spatial WHERE min_x<=?1 AND max_x>=?2 AND min_y<=?3 AND max_y>=?4 LIMIT 5001)", params![b[2], b[0], b[3], b[1]], |r| r.get(0)).map_err(storage_error)?;
        crate::atlas::errors::ensure(
            count <= 5000,
            "Zu viele Objekte für die Bearbeitung. Bitte weiter hineinzoomen.",
        )?;
        self.headers("SELECT o.body FROM spatial s JOIN objects o ON o.rowid=s.key WHERE s.min_x<=? AND s.max_x>=? AND s.min_y<=? AND s.max_y>=? ORDER BY o.rowid", params![b[2], b[0], b[3], b[1]])
    }
    /// Stable SQLite row ordinal, queried separately for each affected region.
    pub(in crate::atlas) fn collision_header_ids(&self, b: Bounds) -> Result<Vec<String>> {
        let mut q = self.db.prepare("SELECT o.id FROM objects o JOIN (SELECT key FROM spatial WHERE min_x<=?1 AND max_x>=?2 AND min_y<=?3 AND max_y>=?4 UNION SELECT key FROM occupancy_spatial WHERE min_x<=?1 AND max_x>=?2 AND min_y<=?3 AND max_y>=?4) hits ON o.rowid=hits.key ORDER BY o.rowid").map_err(storage_error)?;
        let result = q
            .query_map(params![b[2], b[0], b[3], b[1]], |r| r.get(0))
            .map_err(storage_error)?
            .collect::<rusqlite::Result<Vec<_>>>()
            .map_err(storage_error);
        result
    }
    pub(in crate::atlas) fn local_cells(
        &self,
        id: &str,
        floor: i64,
        b: Bounds,
        lower: bool,
    ) -> Result<Vec<crate::interior::Cell>> {
        let query = if lower {
            "SELECT floor,x,y,room_id FROM (SELECT floor,x,y,room_id,ROW_NUMBER() OVER(PARTITION BY x,y ORDER BY floor DESC) AS rank FROM local_cells WHERE building_id=?1 AND floor<?2 AND x BETWEEN ?3 AND ?4 AND y BETWEEN ?5 AND ?6) WHERE rank=1 ORDER BY y,x"
        } else {
            "SELECT floor,x,y,room_id FROM local_cells WHERE building_id=?1 AND floor=?2 AND x BETWEEN ?3 AND ?4 AND y BETWEEN ?5 AND ?6 ORDER BY y,x"
        };
        let mut q = self.db.prepare(query).map_err(storage_error)?;
        let result = q
            .query_map(
                params![id, floor, b[0] - 1.0, b[2] + 1.0, b[1] - 1.0, b[3] + 1.0],
                |r| {
                    Ok(crate::interior::Cell {
                        floor: r.get(0)?,
                        x: r.get(1)?,
                        y: r.get(2)?,
                        room_id: r.get(3)?,
                    })
                },
            )
            .map_err(storage_error)?
            .collect::<std::result::Result<Vec<_>, _>>()
            .map_err(storage_error);
        result
    }
    pub(in crate::atlas) fn apply_computed(&mut self, c: &Computed) -> Result<()> {
        if c.change.is_empty() {
            return Ok(());
        }
        let seq = self
            .cursor
            .checked_add(1)
            .ok_or_else(|| invalid("History erschöpft"))?;
        let next_state = self
            .next_state
            .checked_add(1)
            .ok_or_else(|| invalid("Zustände erschöpft"))?;
        let revision = self
            .revision
            .checked_add(1)
            .ok_or_else(|| invalid("Revisionen erschöpft"))?;
        let h = History {
            change: &c.change,
            before_state: self.state,
            after_state: self.next_state,
        };
        let tx = self.db.transaction().map_err(storage_error)?;
        let hints = apply_history_change(&tx, h.change, true)?;
        if let Some(next) = c.next_identity {
            tx.execute(
                "UPDATE document_meta SET next_identity=? WHERE singleton=1",
                [next],
            )
            .map_err(storage_error)?;
        }
        tx.execute("DELETE FROM history WHERE seq>?", [self.cursor])
            .map_err(storage_error)?;
        let history_body = serde_json::to_string(&h).map_err(storage_error)?;
        tx.execute(
            "INSERT INTO history VALUES(?,?)",
            params![seq, history_body],
        )
        .map_err(storage_error)?;
        drop(history_body);
        tx.execute("DELETE FROM history WHERE seq<=?", [seq - 100])
            .map_err(storage_error)?;
        tx.commit().map_err(storage_error)?;
        self.last_changes = Some(hints);
        self.cursor = seq;
        self.tip = seq;
        self.history_floor = self.history_floor.max(seq - 100);
        self.state = self.next_state;
        self.next_state = next_state;
        self.revision = revision;
        Ok(())
    }
    pub(in crate::atlas) fn history(&mut self, redo: bool) -> Result<()> {
        if (redo && self.cursor >= self.tip) || (!redo && self.cursor <= self.history_floor) {
            return Ok(());
        }
        let seq = if redo { self.cursor + 1 } else { self.cursor };
        let s: String = self
            .db
            .query_row("SELECT body FROM history WHERE seq=?", [seq], |r| r.get(0))
            .map_err(storage_error)?;
        let h: History = serde_json::from_str(&s).map_err(storage_error)?;
        let revision = self
            .revision
            .checked_add(1)
            .ok_or_else(|| invalid("Revisionen erschöpft"))?;
        let tx = self.db.transaction().map_err(storage_error)?;
        let hints = apply_history_change(&tx, &h.change, redo)?;
        tx.commit().map_err(storage_error)?;
        self.last_changes = Some(hints);
        self.cursor += if redo { 1 } else { -1 };
        self.state = if redo { h.after_state } else { h.before_state };
        self.revision = revision;
        Ok(())
    }
}
enum CellWrite<'a> {
    Keep,
    Replace,
    Diff(&'a [Cell]),
}

pub(in crate::atlas) fn write_object(
    db: &Connection,
    o: &FullObject,
    write_cells: bool,
) -> Result<()> {
    write_object_cells(
        db,
        o,
        if write_cells {
            CellWrite::Replace
        } else {
            CellWrite::Keep
        },
    )
}

fn write_object_cells(db: &Connection, o: &FullObject, cells: CellWrite<'_>) -> Result<()> {
    let b = o.bounds();
    // An UPSERT prepares foreign-key cascade paths even for a pure header
    // replacement. Explicit UPDATE preserves the no-cell-access follow contract.
    let exists: bool = db
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM objects WHERE id=?)",
            [o.id()],
            |r| r.get(0),
        )
        .map_err(storage_error)?;
    let sql = if exists {
        "UPDATE objects SET kind=?2,body=?3,metadata=?4,min_x=?5,min_y=?6,max_x=?7,max_y=?8 WHERE id=?1"
    } else {
        "INSERT INTO objects VALUES(?,?,?,?,?,?,?,?)"
    };

    db.prepare_cached(sql)
        .map_err(storage_error)?
        .execute(params![
            o.id(),
            o.kind(),
            serde_json::to_string(&SceneObject::from(o)).map_err(storage_error)?,
            match o {
                FullObject::House(h) =>
                    serde_json::to_string(&h.metadata()).map_err(storage_error)?,
                _ => "{}".into(),
            },
            b[0],
            b[1],
            b[2],
            b[3]
        ])
        .map_err(storage_error)?;

    if let FullObject::House(h) = o {
        if !matches!(cells, CellWrite::Keep) {
            let payload = serde_json::to_string(&h.cells).map_err(storage_error)?;
            db.execute("INSERT INTO house_cells VALUES(?,?) ON CONFLICT(building_id) DO UPDATE SET payload=excluded.payload", params![h.id, payload]).map_err(storage_error)?;
            drop(payload);

            match cells {
                CellWrite::Diff(before) => update_cell_index(db, &h.id, before, &h.cells)?,
                CellWrite::Replace => {
                    db.execute("DELETE FROM local_cells WHERE building_id=?", [&h.id])
                        .map_err(storage_error)?;
                    let mut q = db
                        .prepare_cached("INSERT INTO local_cells VALUES(?,?,?,?,?)")
                        .map_err(storage_error)?;
                    for c in &h.cells {
                        q.execute(params![h.id, c.floor, c.x, c.y, c.room_id])
                            .map_err(storage_error)?;
                    }
                }
                CellWrite::Keep => unreachable!(),
            }
        }
    }
    Ok(())
}
fn write_delta(db: &Connection, before: &[FullObject], after: &[FullObject]) -> Result<()> {
    let kept: HashSet<_> = after.iter().map(FullObject::id).collect();
    for o in before {
        if !kept.contains(o.id()) {
            db.execute("DELETE FROM objects WHERE id=?", [o.id()])
                .map_err(storage_error)?;
        }
    }
    for o in after {
        let cells = match (before.iter().find(|old| old.id() == o.id()), o) {
            (Some(FullObject::House(before)), FullObject::House(after))
                if before.cells == after.cells =>
            {
                CellWrite::Keep
            }
            (Some(FullObject::House(before)), FullObject::House(_)) => {
                CellWrite::Diff(&before.cells)
            }
            _ => CellWrite::Replace,
        };
        write_object_cells(db, o, cells)?;
    }
    Ok(())
}

// Solver outputs are ordered, but imported/undo payloads may retain a different
// author order. Sort borrowed references only for that fallback, never the payload.
struct OrderedCells<'a> {
    cells: &'a [Cell],
    sorted: Option<Vec<&'a Cell>>,
}
fn cell_key(cell: &Cell) -> (i64, i64, i64) {
    (cell.floor, cell.y, cell.x)
}
impl<'a> OrderedCells<'a> {
    fn new(cells: &'a [Cell]) -> Self {
        let sorted = if cells
            .windows(2)
            .all(|pair| cell_key(&pair[0]) < cell_key(&pair[1]))
        {
            None
        } else {
            let mut sorted: Vec<_> = cells.iter().collect();
            sorted.sort_unstable_by_key(|cell| cell_key(cell));
            Some(sorted)
        };
        Self { cells, sorted }
    }
    fn get(&self, index: usize) -> Option<&'a Cell> {
        self.sorted
            .as_ref()
            .map_or_else(|| self.cells.get(index), |cells| cells.get(index).copied())
    }
}

fn update_cell_index(db: &Connection, id: &str, before: &[Cell], after: &[Cell]) -> Result<()> {
    use std::cmp::Ordering;
    let before = OrderedCells::new(before);
    let after = OrderedCells::new(after);
    let mut delete = db
        .prepare_cached("DELETE FROM local_cells WHERE building_id=? AND floor=? AND x=? AND y=?")
        .map_err(storage_error)?;
    let mut insert = db
        .prepare_cached("INSERT INTO local_cells VALUES(?,?,?,?,?)")
        .map_err(storage_error)?;
    let mut update = db
        .prepare_cached(
            "UPDATE local_cells SET room_id=? WHERE building_id=? AND floor=? AND x=? AND y=?",
        )
        .map_err(storage_error)?;
    let (mut old_index, mut new_index) = (0, 0);
    while before.get(old_index).is_some() || after.get(new_index).is_some() {
        let old = before.get(old_index);
        let new = after.get(new_index);
        let order = match (old, new) {
            (Some(old), Some(new)) => cell_key(old).cmp(&cell_key(new)),
            (Some(_), None) => Ordering::Less,
            (None, Some(_)) => Ordering::Greater,
            (None, None) => unreachable!(),
        };
        match order {
            Ordering::Less => {
                let cell = old.unwrap();
                let affected = delete
                    .execute(params![id, cell.floor, cell.x, cell.y])
                    .map_err(storage_error)?;
                if affected != 1 {
                    return Err(storage_error("Fehlende Innenraumindexzelle beim Löschen"));
                }
                old_index += 1;
            }
            Ordering::Greater => {
                let cell = new.unwrap();
                insert
                    .execute(params![id, cell.floor, cell.x, cell.y, cell.room_id])
                    .map_err(storage_error)?;

                new_index += 1;
            }
            Ordering::Equal => {
                let (old, new) = (old.unwrap(), new.unwrap());
                if old.room_id != new.room_id {
                    let affected = update
                        .execute(params![new.room_id, id, new.floor, new.x, new.y])
                        .map_err(storage_error)?;
                    if affected != 1 {
                        return Err(storage_error("Fehlende Innenraumindexzelle beim Ändern"));
                    }
                    // Counts inserted/updated rows; deletions are excluded from this counter.
                }
                old_index += 1;
                new_index += 1;
            }
        }
    }
    Ok(())
}

#[cfg(test)]
mod cell_index_tests;

fn missing_object(error: rusqlite::Error) -> crate::atlas::AppError {
    if matches!(error, rusqlite::Error::QueryReturnedNoRows) {
        invalid("Objekt existiert nicht mehr")
    } else {
        storage_error(error)
    }
}

// `body` contains the small header and derived contours; metadata and cells each
// have exactly one authoritative representation. local_cells is a read index.
pub(in crate::atlas) fn parse_house_parts(body: &str, metadata: &str) -> Result<HouseParts> {
    let SceneObject::House(header) = serde_json::from_str(body).map_err(invalid)? else {
        return Err(invalid("Kein Gebäude"));
    };
    Ok(HouseParts {
        header,
        metadata: serde_json::from_str(metadata).map_err(invalid)?,
    })
}

fn read_house_parts(db: &Connection, id: &str) -> Result<HouseParts> {
    let (body, metadata): (String, String) = db
        .query_row("SELECT body,metadata FROM objects WHERE id=?", [id], |r| {
            Ok((r.get(0)?, r.get(1)?))
        })
        .map_err(missing_object)?;
    parse_house_parts(&body, &metadata)
}
fn assemble_object(db: &Connection, id: &str, body: &str) -> Result<FullObject> {
    let object: SceneObject = serde_json::from_str(body).map_err(invalid)?;
    Ok(match object {
        SceneObject::House(header) => {
            let metadata: String = db
                .query_row("SELECT metadata FROM objects WHERE id=?", [id], |r| {
                    r.get(0)
                })
                .map_err(storage_error)?;
            let parts = HouseParts {
                header,
                metadata: serde_json::from_str(&metadata).map_err(invalid)?,
            };

            let payload: String = db
                .query_row(
                    "SELECT payload FROM house_cells WHERE building_id=?",
                    [id],
                    |r| r.get(0),
                )
                .map_err(storage_error)?;
            let cells: Vec<crate::interior::Cell> =
                serde_json::from_str(&payload).map_err(invalid)?;

            FullObject::House(parts.assemble(cells))
        }
        SceneObject::Road(v) => FullObject::Road(v),
        SceneObject::Area(v) => FullObject::Area(v),
        SceneObject::Parcel(v) => FullObject::Parcel(v),
    })
}
fn read_object(db: &Connection, id: &str) -> Result<FullObject> {
    let body: String = db
        .query_row("SELECT body FROM objects WHERE id=?", [id], |r| r.get(0))
        .map_err(missing_object)?;
    assemble_object(db, id, &body)
}

fn apply_patch(db: &Connection, patch: &SmallPatch, forward: bool) -> Result<ChangeHints> {
    let id = match patch {
        SmallPatch::HouseName { id, .. }
        | SmallPatch::Roof { id, .. }
        | SmallPatch::ImportantPlace { id, .. }
        | SmallPatch::RoomName { id, .. }
        | SmallPatch::Transform { id, .. } => id,
    };
    let body: String = db
        .query_row("SELECT body FROM objects WHERE id=?", [id], |r| r.get(0))
        .map_err(storage_error)?;
    let SceneObject::House(mut header) =
        serde_json::from_str::<SceneObject>(&body).map_err(storage_error)?
    else {
        return Err(invalid("Kein Haus"));
    };
    let old = SceneObject::House(header.clone());
    match patch {
        SmallPatch::HouseName { before, after, .. } => {
            header.name = if forward { after } else { before }.clone()
        }
        SmallPatch::Roof { before, after, .. } => {
            header.roof = if forward { after } else { before }.clone()
        }
        SmallPatch::ImportantPlace { before, after, .. } => {
            header.important_place = if forward { *after } else { *before };
        }
        SmallPatch::RoomName {
            room_id,
            before,
            after,
            ..
        } => {
            let metadata: String = db
                .query_row("SELECT metadata FROM objects WHERE id=?", [id], |r| {
                    r.get(0)
                })
                .map_err(storage_error)?;
            let mut metadata: InteriorMetadata =
                serde_json::from_str(&metadata).map_err(storage_error)?;
            metadata
                .rooms
                .iter_mut()
                .find(|r| r.id == *room_id)
                .ok_or_else(|| invalid("Room not found"))?
                .name = if forward { after } else { before }.clone();
            db.execute(
                "UPDATE objects SET metadata=? WHERE id=?",
                params![serde_json::to_string(&metadata).map_err(storage_error)?, id],
            )
            .map_err(storage_error)?;
        }
        SmallPatch::Transform { before, after, .. } => {
            let pose = if forward { after } else { before };
            header.transform = pose.transform.clone();
            header.placement = pose.placement.clone();
            header.occupancy_bounds =
                occupancy_bounds(&header.occupancy_contours, &header.transform);
        }
    }
    let next = SceneObject::House(header);
    if old != next {
        let b = next.bounds();
        let body = serde_json::to_string(&next).map_err(storage_error)?;

        db.execute(
            "UPDATE objects SET body=?,min_x=?,min_y=?,max_x=?,max_y=? WHERE id=?",
            params![body, b[0], b[1], b[2], b[3], id],
        )
        .map_err(storage_error)?;
    }
    Ok(change_hints::from_patch(patch, &old, &next))
}

fn apply_history_change(db: &Connection, change: &ChangeSet, forward: bool) -> Result<ChangeHints> {
    let d = &change.geometry;
    let (before, after) = if forward {
        (&d.before[..], &d.after[..])
    } else {
        (&d.after[..], &d.before[..])
    };
    write_delta(db, before, after)?;
    let mut hints = change_hints::from_objects(before, after);
    for patch in &change.fields {
        change_hints::merge(&mut hints, apply_patch(db, patch, forward)?);
    }
    // Expand relation hints with live owners, including detach of an occupied parcel.
    for id in hints.relations.clone() {
        let owner: Option<String> = db.query_row("SELECT id FROM objects WHERE kind='house' AND json_extract(body,'$.placement.kind')='parcel' AND json_extract(body,'$.placement.parcelId')=?", [&id], |r| r.get(0)).optional().map_err(storage_error)?;
        if let Some(owner) = owner {
            hints.relations.push(owner);
        }
    }
    hints.relations.sort();
    hints.relations.dedup();
    Ok(hints)
}

impl AtlasApplication {
    /// Indexed relation reads never touch interior metadata or cell payloads.
    pub(in crate::atlas) fn parcel_headers_for_road(&self, road_id: &str) -> Result<Vec<Parcel>> {
        self.headers("SELECT body FROM objects WHERE kind='parcel' AND json_extract(body,'$.source.kind')='road' AND json_extract(body,'$.source.roadId')=? ORDER BY rowid", [road_id])?
            .into_iter().map(|object| match object { SceneObject::Parcel(p) => Ok(p), _ => Err(invalid("Keine Parzelle")) }).collect()
    }
    pub(in crate::atlas) fn house_header_for_parcel(
        &self,
        parcel_id: &str,
    ) -> Result<Option<HouseHeader>> {
        let body: Option<String> = self.db.query_row("SELECT body FROM objects WHERE kind='house' AND json_extract(body,'$.placement.kind')='parcel' AND json_extract(body,'$.placement.parcelId')=?", [parcel_id], |r| r.get(0)).optional().map_err(storage_error)?;
        body.map(
            |s| match serde_json::from_str::<SceneObject>(&s).map_err(storage_error)? {
                SceneObject::House(h) => Ok(h),
                _ => Err(invalid("Kein Haus")),
            },
        )
        .transpose()
    }
    pub(in crate::atlas) fn scene_header(&self, id: &str) -> Result<Option<SceneObject>> {
        let value: Option<String> = self
            .db
            .query_row("SELECT body FROM objects WHERE id=?", [id], |r| r.get(0))
            .optional()
            .map_err(storage_error)?;
        value
            .map(|s| serde_json::from_str(&s).map_err(storage_error))
            .transpose()
    }
    pub(in crate::atlas) fn allocator(&self) -> Result<ActionAllocator> {
        Ok(ActionAllocator {
            next: self
                .db
                .query_row(
                    "SELECT next_identity FROM document_meta WHERE singleton=1",
                    [],
                    |r| r.get(0),
                )
                .map_err(storage_error)?,
        })
    }
    pub(in crate::atlas) fn house(&self, id: &str) -> Result<FullHouse> {
        match self.object(id)? {
            FullObject::House(h) => Ok(h),
            _ => Err(invalid("Kein Gebäude")),
        }
    }
    pub(in crate::atlas) fn house_names(&self) -> Result<HashSet<String>> {
        let mut q = self
            .db
            .prepare("SELECT json_extract(body,'$.name') FROM objects WHERE kind='house'")
            .map_err(storage_error)?;
        let rows = q
            .query_map([], |r| r.get::<_, String>(0))
            .map_err(storage_error)?;
        rows.collect::<std::result::Result<HashSet<_>, _>>()
            .map_err(storage_error)
    }
    pub(in crate::atlas) fn interior_metadata(&self, id: &str) -> Result<InteriorMetadata> {
        let metadata: String = self
            .db
            .query_row(
                "SELECT metadata FROM objects WHERE id=? AND kind='house'",
                [id],
                |r| r.get(0),
            )
            .map_err(storage_error)?;
        serde_json::from_str(&metadata).map_err(storage_error)
    }
    pub(in crate::atlas) fn house_exists(&self, id: &str) -> Result<bool> {
        self.db
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM objects WHERE id=? AND kind='house')",
                [id],
                |r| r.get(0),
            )
            .map_err(storage_error)
    }
    pub(in crate::atlas) fn extent(&self) -> Result<Option<Bounds>> {
        self.db
            .query_row(
                "SELECT min(min_x),min(min_y),max(max_x),max(max_y) FROM objects",
                [],
                |r| {
                    Ok(r.get::<_, Option<f64>>(0)?.map(|x| {
                        [
                            x,
                            r.get(1).unwrap_or(x),
                            r.get(2).unwrap_or(x),
                            r.get(3).unwrap_or(x),
                        ]
                    }))
                },
            )
            .map_err(storage_error)
    }
    pub(in crate::atlas) fn owner_headers_for_parcels(
        &self,
        ids: &[String],
    ) -> Result<Vec<HouseHeader>> {
        self.headers("SELECT body FROM objects WHERE kind='house' AND json_extract(body,'$.placement.kind')='parcel' AND json_extract(body,'$.placement.parcelId') IN (SELECT value FROM json_each(?)) ORDER BY rowid", [serde_json::to_string(ids).map_err(storage_error)?])?
            .into_iter().map(|object| match object { SceneObject::House(h) => Ok(h), _ => Err(invalid("Beschädigter Hausheader")) }).collect()
    }
    pub(in crate::atlas) fn scene_headers_by_ids(
        &self,
        ids: &[String],
    ) -> Result<Vec<SceneObject>> {
        self.headers(
            "SELECT body FROM objects WHERE id IN (SELECT value FROM json_each(?)) ORDER BY rowid",
            [serde_json::to_string(ids).map_err(storage_error)?],
        )
    }
    pub(in crate::atlas) fn all_scene_headers(&self) -> Result<Vec<SceneObject>> {
        self.headers("SELECT body FROM objects ORDER BY rowid", [])
    }
    pub(in crate::atlas) fn road(&self, id: &str) -> Result<Road> {
        match self.object(id)? {
            FullObject::Road(r) => Ok(r),
            _ => Err(invalid("Keine Straße")),
        }
    }
    pub(in crate::atlas) fn parcel(&self, id: &str) -> Result<Parcel> {
        match self.object(id)? {
            FullObject::Parcel(p) => Ok(p),
            _ => Err(invalid("Keine Parzelle")),
        }
    }
    pub(in crate::atlas) fn required_house_header(&self, id: &str) -> Result<HouseHeader> {
        match self.scene_header(id)? {
            Some(SceneObject::House(h)) => Ok(h),
            _ => Err(invalid("Kein Gebäude")),
        }
    }
    pub(in crate::atlas) fn object_kind(&self, id: &str) -> Result<String> {
        self.db
            .query_row("SELECT kind FROM objects WHERE id=?", [id], |r| r.get(0))
            .map_err(missing_object)
    }
}
