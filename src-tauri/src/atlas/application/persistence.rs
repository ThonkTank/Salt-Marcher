//! The only persisted contract. Working headers, indices and history never cross it.
use super::storage;
use crate::atlas::application::AtlasApplication;
use crate::atlas::errors::{ensure, invalid, storage_error};
use crate::atlas::geometry::{contours, occupancy_bounds, occupancy_contours};
use crate::atlas::model::{
    required_option, Area, FullHouse, FullObject, GridPose, HouseParts, Node, Parcel, ParcelSource,
    Placement, Point, PopulationRecipe, Road, RoadMaterial, RoadSection, SceneObject, Side, Status,
    Transform,
};
use crate::atlas::validation::validate_object;
use crate::atlas::{interior, parcel_geometry, plan_context, Result};
use crate::interior::{
    Cell, Connection as InteriorBase, ConnectionShape, InteriorConnection, Room,
};
use rusqlite::{params, Connection};
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashSet;
use std::path::Path;

pub const FORMAT_VERSION: i64 = 20;
const SCHEMA: &str = "
CREATE TABLE rivers(id TEXT PRIMARY KEY NOT NULL,body TEXT NOT NULL) STRICT, WITHOUT ROWID;
CREATE TABLE region_catalog(singleton INTEGER PRIMARY KEY NOT NULL,body TEXT NOT NULL) STRICT, WITHOUT ROWID;
CREATE TABLE regions(id TEXT PRIMARY KEY NOT NULL,body TEXT NOT NULL) STRICT, WITHOUT ROWID;
CREATE TABLE document_meta(singleton INTEGER PRIMARY KEY NOT NULL,
 next_identity INTEGER NOT NULL) STRICT, WITHOUT ROWID;
CREATE TABLE objects(id TEXT PRIMARY KEY NOT NULL,
 kind TEXT NOT NULL, body TEXT NOT NULL) STRICT, WITHOUT ROWID;
CREATE TABLE house_cells(building_id TEXT PRIMARY KEY NOT NULL,
 payload TEXT NOT NULL) STRICT, WITHOUT ROWID;
CREATE TABLE terrain_layers(level INTEGER NOT NULL,x INTEGER NOT NULL,y INTEGER NOT NULL,z REAL NOT NULL,PRIMARY KEY(level,x,y)) STRICT, WITHOUT ROWID;
CREATE TABLE terrain(x INTEGER NOT NULL,y INTEGER NOT NULL,z REAL NOT NULL,PRIMARY KEY(x,y)) STRICT, WITHOUT ROWID;
CREATE TABLE ground_tiles(level INTEGER NOT NULL,x INTEGER NOT NULL,y INTEGER NOT NULL,pixels BLOB NOT NULL,PRIMARY KEY(level,x,y)) STRICT, WITHOUT ROWID;
CREATE TABLE waters(id TEXT PRIMARY KEY NOT NULL,body TEXT NOT NULL) STRICT, WITHOUT ROWID;";

// Shared authored values are strict themselves. File-specific DTOs omit derived
// runtime data structurally; no FullObject JSON is pruned.
macro_rules! dto {
    ($name:ident { $($(#[$attr:meta])* $field:ident : $ty:ty),* $(,)? }) => {
        #[derive(Serialize, Deserialize)]
        #[serde(rename_all="camelCase", deny_unknown_fields)]
        struct $name { $($(#[$attr])* $field: $ty),* }
    };
}
dto!(RoadDto { id: String, name: String, width: f64, material: RoadMaterial,
    nodes: Vec<Node>, edge_sections: Vec<String>, sections: Vec<RoadSection>,
    #[serde(deserialize_with="required_option")] population_recipe: Option<PopulationRecipe> });
dto!(ParcelDto {
    id: String,
    source: SourceDto
});
#[derive(Serialize, Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
enum SourceDto {
    Road {
        road_id: String,
        section_id: String,
        side: Side,
        start: f64,
        end: f64,
        setback: f64,
        depth: f64,
    },
    Detached {
        polygon: Vec<Point>,
        frame: Transform,
    },
}
#[derive(Serialize, Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
enum PlacementDto {
    Free {
        transform: Transform,
    },
    Parcel {
        parcel_id: String,
        grid_pose: GridPose,
    },
}
// A flat, strict enum avoids flatten's unknown-field ambiguity in connections.
#[derive(Serialize, Deserialize)]
#[serde(
    tag = "type",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
enum ConnectionDto {
    Opening {
        id: String,
        created: i64,
        from_room: String,
        #[serde(deserialize_with = "required_option")]
        to_room: Option<String>,
        floor: i64,
        x: i64,
        y: i64,
        offset: f64,
        kind: crate::interior::ConnectionKind,
        axis: crate::interior::Axis,
    },
    Stairs {
        id: String,
        created: i64,
        from_room: String,
        #[serde(deserialize_with = "required_option")]
        to_room: Option<String>,
        floor: i64,
        x: i64,
        y: i64,
        offset: f64,
        direction: crate::interior::StairDirection,
        length: u8,
    },
}
dto!(HouseDto { id: String, name: String, roof: String, important_place: bool, foundation: crate::atlas::terrain::Foundation,
    placement: PlacementDto, room_counter: i64, connection_counter: i64,
    rooms: Vec<Room>, connections: Vec<ConnectionDto> });
#[derive(Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase", deny_unknown_fields)]
enum ObjectDto {
    House(HouseDto),
    Road(RoadDto),
    Parcel(ParcelDto),
    Area(Area),
    Scenery(crate::atlas::scenery::Scenery),
}
impl ObjectDto {
    fn identity(&self) -> (&str, &str) {
        match self {
            Self::House(v) => (&v.id, "house"),
            Self::Road(v) => (&v.id, "road"),
            Self::Parcel(v) => (&v.id, "parcel"),
            Self::Area(v) => (&v.id, "area"),
            Self::Scenery(v) => (&v.id, "scenery"),
        }
    }
}
// Connections have a deliberately flat file representation. Conversion is typed,
// so a model change fails compilation rather than a save operation.
impl From<InteriorConnection> for ConnectionDto {
    fn from(c: InteriorConnection) -> Self {
        let InteriorConnection {
            base:
                InteriorBase {
                    id,
                    created,
                    from_room,
                    to_room,
                    floor,
                    x,
                    y,
                    shape,
                },
            offset,
        } = c;
        match shape {
            ConnectionShape::Opening { kind, axis } => Self::Opening {
                id,
                created,
                from_room,
                to_room,
                floor,
                x,
                y,
                offset,
                kind,
                axis,
            },
            ConnectionShape::Stairs { direction, length } => Self::Stairs {
                id,
                created,
                from_room,
                to_room,
                floor,
                x,
                y,
                offset,
                direction,
                length,
            },
        }
    }
}
impl From<ConnectionDto> for InteriorConnection {
    fn from(c: ConnectionDto) -> Self {
        let (id, created, from_room, to_room, floor, x, y, offset, shape) = match c {
            ConnectionDto::Opening {
                id,
                created,
                from_room,
                to_room,
                floor,
                x,
                y,
                offset,
                kind,
                axis,
            } => (
                id,
                created,
                from_room,
                to_room,
                floor,
                x,
                y,
                offset,
                ConnectionShape::Opening { kind, axis },
            ),
            ConnectionDto::Stairs {
                id,
                created,
                from_room,
                to_room,
                floor,
                x,
                y,
                offset,
                direction,
                length,
            } => (
                id,
                created,
                from_room,
                to_room,
                floor,
                x,
                y,
                offset,
                ConnectionShape::Stairs { direction, length },
            ),
        };
        Self {
            base: InteriorBase {
                id,
                created,
                from_room,
                to_room,
                floor,
                x,
                y,
                shape,
            },
            offset,
        }
    }
}
fn export_header(app: &AtlasApplication, id: &str, kind: &str) -> Result<ObjectDto> {
    Ok(match kind {
        "house" => {
            let HouseParts {
                header: h,
                metadata: m,
            } = app.house_parts(id)?;
            let placement = match h.placement {
                Placement::Free {} => PlacementDto::Free {
                    transform: h.transform,
                },
                Placement::Parcel {
                    parcel_id,
                    grid_pose,
                } => PlacementDto::Parcel {
                    parcel_id,
                    grid_pose,
                },
            };
            ObjectDto::House(HouseDto {
                id: h.id,
                name: h.name,
                roof: h.roof,
                important_place: h.important_place,
                foundation: h.foundation.clone(),
                placement,
                room_counter: m.room_counter,
                connection_counter: m.connection_counter,
                rooms: m.rooms,
                connections: m.connections.into_iter().map(Into::into).collect(),
            })
        }
        _ => match app.object(id)? {
            FullObject::Road(r) => ObjectDto::Road(RoadDto {
                id: r.id,
                name: r.name,
                width: r.width,
                material: r.material,
                nodes: r.nodes,
                edge_sections: r.edge_sections,
                sections: r.sections,
                population_recipe: r.population_recipe,
            }),
            FullObject::Area(a) => ObjectDto::Area(a),
            FullObject::Scenery(s) => ObjectDto::Scenery(s),
            FullObject::Parcel(p) => {
                let source = match p.source {
                    ParcelSource::Road {
                        road_id,
                        section_id,
                        side,
                        start,
                        end,
                        setback,
                        depth,
                    } => SourceDto::Road {
                        road_id,
                        section_id,
                        side,
                        start,
                        end,
                        setback,
                        depth,
                    },
                    ParcelSource::Detached {} => SourceDto::Detached {
                        polygon: p.polygon,
                        frame: p.frame,
                    },
                };
                ObjectDto::Parcel(ParcelDto { id: p.id, source })
            }
            _ => return Err(invalid("Ungültige Objektart")),
        },
    })
}

/// Stream authored SQL values without parsing or collecting the whole table.
fn copy_rows(source: &Connection, target: &Connection, select: &str, insert: &str) -> Result<()> {
    let mut query = source.prepare(select).map_err(storage_error)?;
    let columns = query.column_count();
    let mut write = target.prepare(insert).map_err(storage_error)?;
    let mut rows = query.query([]).map_err(storage_error)?;
    while let Some(row) = rows.next().map_err(storage_error)? {
        let values = (0..columns)
            .map(|i| row.get::<_, rusqlite::types::Value>(i))
            .collect::<rusqlite::Result<Vec<_>>>()
            .map_err(storage_error)?;
        write
            .execute(rusqlite::params_from_iter(values))
            .map_err(storage_error)?;
    }
    Ok(())
}

impl AtlasApplication {
    pub fn save(&mut self, path: &Path) -> Result<Status> {
        self.terrain_stroke = None;
        self.save_snapshot(path, |_| Ok(()))
    }
    // The callback is an internal deterministic failure seam, not a file feature.
    pub(in crate::atlas) fn save_snapshot(
        &mut self,
        path: &Path,
        mut exported: impl FnMut(usize) -> Result<()>,
    ) -> Result<Status> {
        self.terrain_stroke = None;
        let parent = path
            .parent()
            .filter(|p| !p.as_os_str().is_empty())
            .unwrap_or(Path::new("."));
        let temp = tempfile::NamedTempFile::new_in(parent).map_err(storage_error)?;
        let mut target = Connection::open(temp.path()).map_err(storage_error)?;
        let source = self.db.unchecked_transaction().map_err(storage_error)?;
        let tx = target.transaction().map_err(storage_error)?;
        tx.execute_batch(SCHEMA).map_err(storage_error)?;
        tx.pragma_update(None, "user_version", FORMAT_VERSION)
            .map_err(storage_error)?;
        tx.execute(
            "INSERT INTO region_catalog VALUES(1,?)",
            [
                serde_json::to_string(&super::region_store::catalog(&source)?)
                    .map_err(storage_error)?,
            ],
        )
        .map_err(storage_error)?;
        // These tables already contain exactly the authored file values.
        // Copy one row at a time; spatial indices and derived data stay local.
        for (select, insert) in [
            (
                "SELECT id,body FROM regions ORDER BY id",
                "INSERT INTO regions VALUES(?,?)",
            ),
            (
                "SELECT id,body FROM rivers ORDER BY id",
                "INSERT INTO rivers VALUES(?,?)",
            ),
            (
                "SELECT id,body FROM waters ORDER BY id",
                "INSERT INTO waters VALUES(?,?)",
            ),
            (
                "SELECT level,x,y,z FROM terrain_layers ORDER BY level,x,y",
                "INSERT INTO terrain_layers VALUES(?,?,?,?)",
            ),
            (
                "SELECT x,y,z FROM terrain ORDER BY x,y",
                "INSERT INTO terrain VALUES(?,?,?)",
            ),
            (
                "SELECT level,x,y,pixels FROM ground_tiles ORDER BY level,x,y",
                "INSERT INTO ground_tiles VALUES(?,?,?,?)",
            ),
        ] {
            copy_rows(&source, &tx, select, insert)?;
        }
        let next: i64 = source
            .query_row(
                "SELECT next_identity FROM document_meta WHERE singleton=1",
                [],
                |r| r.get(0),
            )
            .map_err(storage_error)?;
        tx.execute("INSERT INTO document_meta VALUES(1,?)", [next])
            .map_err(storage_error)?;
        {
            let mut q = source
                .prepare("SELECT id,kind FROM objects ORDER BY rowid")
                .map_err(storage_error)?;
            let mut rows = q.query([]).map_err(storage_error)?;
            let mut count = 0;
            while let Some(row) = rows.next().map_err(storage_error)? {
                let id: String = row.get(0).map_err(storage_error)?;
                let kind: String = row.get(1).map_err(storage_error)?;
                let dto = export_header(self, &id, &kind)?;
                tx.execute(
                    "INSERT INTO objects VALUES(?,?,?)",
                    params![
                        id,
                        kind,
                        serde_json::to_string(&dto).map_err(storage_error)?
                    ],
                )
                .map_err(storage_error)?;
                if kind == "house" {
                    #[cfg(test)]
                    let _payload_lifetime = payload_metrics::Lease::new();

                    let payload: String = source
                        .query_row(
                            "SELECT payload FROM house_cells WHERE building_id=?",
                            [&id],
                            |r| r.get(0),
                        )
                        .map_err(storage_error)?;

                    tx.execute("INSERT INTO house_cells VALUES(?,?)", params![id, payload])
                        .map_err(storage_error)?;
                }
                count += 1;
                exported(count)?;
            }
        }
        tx.commit().map_err(storage_error)?;
        source.commit().map_err(storage_error)?;
        target.close().map_err(|(_, e)| storage_error(e))?;

        temp.as_file().sync_all().map_err(storage_error)?;
        temp.persist(path).map_err(storage_error)?;
        self.path = Some(path.to_owned());
        self.saved = self.state;
        Ok(self.status())
    }
    pub fn open(&mut self, path: &Path) -> Result<Status> {
        self.terrain_stroke = None;
        let source = Connection::open_with_flags(path, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)
            .map_err(storage_error)?;
        source
            .execute_batch("PRAGMA query_only=ON; PRAGMA trusted_schema=OFF;")
            .map_err(storage_error)?;
        let source_tx = source.unchecked_transaction().map_err(storage_error)?;
        let version: i64 = source_tx
            .pragma_query_value(None, "user_version", |r| r.get(0))
            .map_err(storage_error)?;
        ensure(
            version == FORMAT_VERSION,
            &format!("Atlas V7 benötigt Dateiformat {FORMAT_VERSION}. Ältere Dateiformate werden nicht migriert."),
        )?;
        validate_schema(&source_tx)?;
        {
            let mut q = source_tx
                .prepare("PRAGMA main.integrity_check")
                .map_err(storage_error)?;
            let mut rows = q.query([]).map_err(storage_error)?;
            let mut any = false;
            while let Some(row) = rows.next().map_err(storage_error)? {
                any = true;
                ensure(
                    row.get::<_, String>(0).map_err(storage_error)? == "ok",
                    "Beschädigte Atlas-Datei",
                )?;
            }
            ensure(any, "Fehlende Integritätsprüfung")?;
        }
        let mut candidate = Self::new()?;
        let tx = candidate
            .db
            .unchecked_transaction()
            .map_err(storage_error)?;
        let next_state = stage_document(&source_tx, &candidate)?;
        super::region_store::import(&source_tx, &tx)?;
        super::water_store::import(&source_tx, &tx)?;
        {
            let mut q = source_tx
                .prepare("SELECT level,x,y,z FROM terrain_layers ORDER BY level,x,y")
                .map_err(storage_error)?;
            let mut rows = q.query([]).map_err(storage_error)?;
            let mut insert = tx
                .prepare("INSERT INTO terrain_layers(level,x,y,z) VALUES(?,?,?,?)")
                .map_err(storage_error)?;
            while let Some(r) = rows.next().map_err(storage_error)? {
                let level: u8 = r.get(0).map_err(storage_error)?;
                let x: i32 = r.get(1).map_err(storage_error)?;
                let y: i32 = r.get(2).map_err(storage_error)?;
                let z: f64 = r.get(3).map_err(storage_error)?;
                let step = 5. * 2f64.powi(level as i32);
                ensure(
                    (1..=21).contains(&level)
                        && crate::atlas::geometry::valid_point([x as f64 * step, y as f64 * step])
                        && crate::atlas::terrain::valid_height(z),
                    "Ungültige Geländeauflösung",
                )?;
                insert
                    .execute(rusqlite::params![level, x, y, z])
                    .map_err(storage_error)?;
            }
        }
        {
            let mut q = source_tx
                .prepare("SELECT x,y,z FROM terrain ORDER BY x,y")
                .map_err(storage_error)?;
            let mut rows = q.query([]).map_err(storage_error)?;
            let mut insert = tx
                .prepare("INSERT INTO terrain(x,y,z) VALUES(?,?,?)")
                .map_err(storage_error)?;
            while let Some(r) = rows.next().map_err(storage_error)? {
                let (x, y, z): (i32, i32, f64) = (
                    r.get(0).map_err(storage_error)?,
                    r.get(1).map_err(storage_error)?,
                    r.get(2).map_err(storage_error)?,
                );
                ensure(
                    x.unsigned_abs() <= 20_000_000
                        && y.unsigned_abs() <= 20_000_000
                        && crate::atlas::terrain::valid_height(z),
                    "Ungültiger Höhenpunkt",
                )?;
                insert
                    .execute(rusqlite::params![x, y, z])
                    .map_err(storage_error)?;
            }
        }
        super::terrain_blocks::rebuild(&tx)?;
        {
            super::river_store::import(&source_tx, &tx)?;
            let mut q = source_tx
                .prepare("SELECT level,x,y,pixels FROM ground_tiles ORDER BY level,x,y")
                .map_err(storage_error)?;
            let mut rows = q.query([]).map_err(storage_error)?;
            let mut insert = tx
                .prepare("INSERT INTO ground_tiles(level,x,y,pixels) VALUES(?,?,?,?)")
                .map_err(storage_error)?;
            while let Some(r) = rows.next().map_err(storage_error)? {
                let level: u8 = r.get(0).map_err(storage_error)?;
                let x: i32 = r.get(1).map_err(storage_error)?;
                let y: i32 = r.get(2).map_err(storage_error)?;
                let pixels: Vec<u8> = r.get(3).map_err(storage_error)?;
                ensure(
                    level <= 24
                        && (x as i64).abs() <= (1_562_500i64 >> level) + 1
                        && (y as i64).abs() <= (1_562_500i64 >> level) + 1
                        && pixels.len() == crate::atlas::ground::BYTES
                        && pixels
                            .as_chunks::<4>()
                            .0
                            .iter()
                            .all(|p| p[0] <= p[3] && p[1] <= p[3] && p[2] <= p[3]),
                    "Ungültige Bodenfarbkachel",
                )?;
                insert
                    .execute(rusqlite::params![level, x, y, pixels])
                    .map_err(storage_error)?;
            }
        }
        super::ground_store::rebuild_overview(&tx)?;
        tx.commit().map_err(storage_error)?;
        source_tx.commit().map_err(storage_error)?;
        candidate.next_state = next_state;
        candidate.path = Some(path.to_owned());
        *self = candidate;
        Ok(self.status())
    }
}

// Compare all structural PRAGMA cells with a fresh snapshot, including index
// auxiliary columns. SQL text and additional CHECK clauses are not authority.
fn pragma_rows(db: &Connection, sql: &str) -> Result<Vec<Vec<rusqlite::types::Value>>> {
    let mut q = db.prepare(sql).map_err(storage_error)?;
    let n = q.column_count();
    let rows = q
        .query_map([], |r| (0..n).map(|i| r.get(i)).collect())
        .map_err(storage_error)?;
    rows.collect::<rusqlite::Result<_>>().map_err(storage_error)
}
fn structural_rows(
    db: &Connection,
    sql: &str,
    identifiers: &[usize],
) -> Result<Vec<Vec<rusqlite::types::Value>>> {
    let mut rows = pragma_rows(db, sql)?;
    for row in &mut rows {
        for &column in identifiers {
            if let rusqlite::types::Value::Text(value) = &mut row[column] {
                // SQLite's built-in identifiers/collations ignore ASCII case.
                // Do not normalize JSON, defaults, coordinates or any data.
                value.make_ascii_lowercase();
            }
        }
    }
    Ok(rows)
}
fn validate_schema(source: &Connection) -> Result<()> {
    let expected = Connection::open_in_memory().map_err(storage_error)?;
    expected.execute_batch(SCHEMA).map_err(storage_error)?;
    for sql in [
        "SELECT type,name,tbl_name FROM main.sqlite_schema ORDER BY lower(type),lower(name)",
        "SELECT schema,name,type,ncol,wr,strict FROM pragma_table_list WHERE schema='main' AND name!='sqlite_schema' ORDER BY lower(name)",
    ] {
        ensure(structural_rows(source,sql,&[0,1,2])?==structural_rows(&expected,sql,&[0,1,2])?,"Ungültiges Format-20-Schema")?;
    }
    for table in [
        "document_meta",
        "objects",
        "house_cells",
        "terrain",
        "terrain_layers",
        "waters",
        "ground_tiles",
        "rivers",
        "region_catalog",
        "regions",
    ] {
        for (pragma, identifiers) in [
            ("table_xinfo", &[1, 2][..]),
            ("index_list", &[1, 3][..]),
            ("foreign_key_list", &[][..]),
        ] {
            let sql = format!("PRAGMA main.{pragma}('{table}')");
            ensure(
                structural_rows(source, &sql, identifiers)?
                    == structural_rows(&expected, &sql, identifiers)?,
                "Ungültige Tabellenstruktur",
            )?;
        }
        let mut q = expected
            .prepare(&format!("PRAGMA main.index_list('{table}')"))
            .map_err(storage_error)?;
        let indexes = q
            .query_map([], |r| r.get::<_, String>(1))
            .map_err(storage_error)?;
        for name in indexes {
            let name = name.map_err(storage_error)?;
            let sql = format!("PRAGMA main.index_xinfo('{name}')");
            ensure(
                structural_rows(source, &sql, &[2, 4])?
                    == structural_rows(&expected, &sql, &[2, 4])?,
                "Ungültige Primärschlüsselstruktur",
            )?;
        }
    }
    Ok(())
}

#[derive(Default)]
struct ImportIdentities {
    seen: HashSet<String>,
    maximum: i64,
}
impl ImportIdentities {
    fn register(&mut self, id: &str, prefix: &str) -> Result<()> {
        let suffix = id
            .strip_prefix(prefix)
            .and_then(|s| s.strip_prefix('-'))
            .and_then(|s| s.parse::<i64>().ok())
            .ok_or_else(|| invalid("Ungültige globale Identität"))?;
        ensure(
            suffix >= 1 && id == format!("{prefix}-{suffix}") && self.seen.insert(id.to_owned()),
            "Ungültige oder doppelte globale Identität",
        )?;
        self.maximum = self.maximum.max(suffix);
        Ok(())
    }
    fn read(&mut self, source: &Connection, sql: &str, prefix: &str) -> Result<()> {
        for_strings(source, sql, |id| self.register(&id, prefix))
    }
}

fn for_strings(
    source: &Connection,
    sql: &str,
    mut visit: impl FnMut(String) -> Result<()>,
) -> Result<()> {
    let mut query = source.prepare(sql).map_err(storage_error)?;
    let mut rows = query.query([]).map_err(storage_error)?;
    while let Some(row) = rows.next().map_err(storage_error)? {
        visit(row.get(0).map_err(storage_error)?)?;
    }
    Ok(())
}
fn for_objects(
    source: &Connection,
    kind: Option<&str>,
    mut visit: impl FnMut(ObjectDto) -> Result<()>,
) -> Result<()> {
    let mut q = source
        .prepare("SELECT id,kind,body FROM objects WHERE (?1 IS NULL OR kind=?1) ORDER BY id")
        .map_err(storage_error)?;
    let mut rows = q.query([kind]).map_err(storage_error)?;
    while let Some(row) = rows.next().map_err(storage_error)? {
        let id: String = row.get(0).map_err(storage_error)?;
        let kind: String = row.get(1).map_err(storage_error)?;
        let body: String = row.get(2).map_err(storage_error)?;
        let dto: ObjectDto = parse(&body)?;
        ensure(
            dto.identity() == (id.as_str(), kind.as_str()),
            "Beschädigte Objektidentität",
        )?;
        visit(dto)?;
    }
    Ok(())
}
fn stage_document(source: &Connection, candidate: &AtlasApplication) -> Result<u64> {
    let mut prepared = plan_context::PreparedRoads::new();
    let mut identities = ImportIdentities::default();
    let mut maximum_order = 0;
    // Pass 1 only holds global IDs and one metadata record, never cell data.

    for_objects(source, None, |dto| {
        let (id, kind) = dto.identity();
        identities.register(id, kind)?;
        if let ObjectDto::Road(r) = dto {
            for n in r.nodes {
                identities.register(&n.id, "node")?;
            }
            for s in r.sections {
                identities.register(&s.id, "section")?;
            }
        }
        Ok(())
    })?;

    let catalog = super::region_store::catalog(source)?;
    for c in catalog.categories {
        if ![
            "builtin-category-1",
            "builtin-category-2",
            "builtin-category-16",
        ]
        .contains(&c.id.as_str())
        {
            identities.register(&c.id, "category")?;
        }
    }
    for r in catalog.ranks {
        if !(3..=20)
            .filter(|n| *n != 16)
            .any(|n| r.id == format!("builtin-rank-{n}"))
        {
            identities.register(&r.id, "rank")?;
        }
    }
    identities.read(source, "SELECT id FROM regions", "region")?;
    {
        let mut nodes = std::collections::BTreeMap::new();
        for_strings(source, "SELECT body FROM rivers ORDER BY id", |body| {
            let r: crate::atlas::rivers::River = serde_json::from_str(&body).map_err(invalid)?;
            identities.register(&r.id, "river")?;
            for n in r.nodes {
                if let Some(p) = nodes.get(&n.id) {
                    ensure(*p == n.point, "Ungültige Flussverbindung")?;
                } else {
                    identities.register(&n.id, "rnode")?;
                    nodes.insert(n.id, n.point);
                }
            }
            Ok(())
        })?;
    }
    identities.read(source, "SELECT id FROM waters ORDER BY id", "water")?;
    let meta = pragma_rows(source, "SELECT singleton,next_identity FROM document_meta")?;
    use rusqlite::types::Value as SqlValue;
    let next = match meta.as_slice() {
        [row] => match row.as_slice() {
            [SqlValue::Integer(1), SqlValue::Integer(n)]
                if *n > identities.maximum && *n < i64::MAX =>
            {
                *n
            }
            _ => return Err(invalid("Ungültiger Identitätszähler")),
        },
        _ => return Err(invalid("Ungültiger Identitätszähler")),
    };

    for kind in ["road", "area", "scenery"] {
        for_objects(source, Some(kind), |dto| {
            let object = match dto {
                ObjectDto::Road(r) => {
                    let mut road = Road {
                        id: r.id,
                        name: r.name,
                        width: r.width,
                        material: r.material,
                        nodes: r.nodes,
                        path: vec![],
                        edge_sections: r.edge_sections,
                        sections: r.sections,
                        population_recipe: r.population_recipe,
                    };
                    road.path = plan_context::prepare_road(&mut prepared, &road)?
                        .path()
                        .to_vec();
                    FullObject::Road(road)
                }
                ObjectDto::Scenery(s) => FullObject::Scenery(s),
                ObjectDto::Area(a) => {
                    maximum_order = maximum_order.max(a.order);
                    FullObject::Area(a)
                }
                _ => return Err(invalid("Ungültige Objektart")),
            };
            validate_object(&object, &mut prepared)?;
            storage::write_object(&candidate.db, &object, false)
        })?;
    }

    for_objects(source, Some("parcel"), |dto| {
        let ObjectDto::Parcel(p) = dto else {
            return Err(invalid("Keine Parzelle"));
        };
        let parcel = match p.source {
            SourceDto::Road {
                road_id,
                section_id,
                side,
                start,
                end,
                setback,
                depth,
            } => {
                let source = ParcelSource::Road {
                    road_id,
                    section_id,
                    side,
                    start,
                    end,
                    setback,
                    depth,
                };
                let ParcelSource::Road { road_id, .. } = &source else {
                    unreachable!()
                };
                let derived = prepared
                    .get(road_id)
                    .ok_or_else(|| invalid("Gebundener Straßenabschnitt fehlt"))?
                    .derive(&source)?;
                Parcel {
                    id: p.id,
                    source,
                    polygon: derived.polygon,
                    frame: derived.frame,
                }
            }
            SourceDto::Detached { polygon, frame } => Parcel {
                id: p.id,
                source: ParcelSource::Detached {},
                polygon,
                frame,
            },
        };
        ensure(
            parcel_geometry::canonical_polygon(parcel.polygon.clone())? == parcel.polygon,
            "Nichtkanonisches Parzellenpolygon",
        )?;
        let object = FullObject::Parcel(parcel);
        validate_object(&object, &mut prepared)?;
        storage::write_object(&candidate.db, &object, false)
    })?;

    for_objects(source, Some("house"), |dto| {
        let ObjectDto::House(h) = dto else {
            return Err(invalid("Kein Haus"));
        };
        let (placement, transform) = match h.placement {
            PlacementDto::Free { transform } => (Placement::Free {}, transform),
            PlacementDto::Parcel {
                parcel_id,
                grid_pose,
            } => {
                let Some(SceneObject::Parcel(p)) = candidate.scene_header(&parcel_id)? else {
                    return Err(invalid("Ownerparzelle fehlt"));
                };
                let transform = parcel_geometry::parcel_house_transform(&p.frame, &grid_pose)?;
                (
                    Placement::Parcel {
                        parcel_id,
                        grid_pose,
                    },
                    transform,
                )
            }
        };
        #[cfg(test)]
        let _payload_lifetime = payload_metrics::Lease::new();

        let payload: String = source
            .query_row(
                "SELECT payload FROM house_cells WHERE building_id=?",
                [&h.id],
                |r| r.get(0),
            )
            .map_err(storage_error)?;
        let cells: Vec<Cell> = parse(&payload)?;

        let connections: Vec<InteriorConnection> =
            h.connections.into_iter().map(Into::into).collect();
        ensure(
            cells.iter().all(|c| {
                c.x.abs_diff(0) <= 1_000_000
                    && c.y.abs_diff(0) <= 1_000_000
                    && i32::try_from(c.floor).is_ok()
            }) && connections.iter().all(|c| {
                c.x.abs_diff(0) <= 1_000_001
                    && c.y.abs_diff(0) <= 1_000_001
                    && i32::try_from(c.floor).is_ok()
            }),
            "Ungültige Innenraumkoordinaten",
        )?;
        let contours = contours(&cells);
        let occupancy_contours = occupancy_contours(&cells);
        let house = FullHouse {
            id: h.id,
            name: h.name,
            roof: h.roof,
            important_place: h.important_place,
            foundation: h.foundation.clone(),
            placement,
            occupancy_bounds: occupancy_bounds(&occupancy_contours, &transform),
            transform,
            contours,
            occupancy_contours,
            room_counter: h.room_counter,
            connection_counter: h.connection_counter,
            rooms: h.rooms,
            connections,
            cells,
        };
        interior::validate(&house)?;
        let object = FullObject::House(house);
        validate_object(&object, &mut prepared)?;
        storage::write_object(&candidate.db, &object, true)?;
        // Retain the exact authoritative JSON bytes, not a reserialization.

        candidate
            .db
            .execute(
                "UPDATE house_cells SET payload=? WHERE building_id=?",
                params![payload, object.id()],
            )
            .map_err(storage_error)?;
        Ok(())
    })?;

    let mismatch:i64=source.query_row("SELECT (SELECT count(*) FROM house_cells c LEFT JOIN objects o ON c.building_id=o.id WHERE o.id IS NULL OR o.kind!='house')+(SELECT count(*) FROM objects o LEFT JOIN house_cells c ON c.building_id=o.id WHERE o.kind='house' AND c.building_id IS NULL)",[],|r|r.get(0)).map_err(storage_error)?;
    ensure(mismatch == 0, "Beschädigte Payloadzuordnung")?;
    plan_context::validate_staged_document(candidate, &mut prepared)?;
    candidate
        .db
        .execute(
            "UPDATE document_meta SET next_identity=? WHERE singleton=1",
            [next],
        )
        .map_err(storage_error)?;
    maximum_order
        .checked_add(1)
        .ok_or_else(|| invalid("Zustände erschöpft"))
}

// Deserialize through a duplicate-aware tree before strict DTO decoding. This
// also checks discriminator duplicates buffered by internally tagged enums.
fn parse<T: DeserializeOwned>(text: &str) -> Result<T> {
    struct Json(Value);
    impl<'de> Deserialize<'de> for Json {
        fn deserialize<D: serde::Deserializer<'de>>(d: D) -> std::result::Result<Self, D::Error> {
            struct Visitor;
            impl<'de> serde::de::Visitor<'de> for Visitor {
                type Value = Json;
                fn expecting(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
                    f.write_str("JSON without duplicate keys")
                }
                fn visit_map<M: serde::de::MapAccess<'de>>(
                    self,
                    mut map: M,
                ) -> std::result::Result<Json, M::Error> {
                    let mut object = serde_json::Map::new();
                    while let Some((key, Json(value))) = map.next_entry::<String, Json>()? {
                        if object.insert(key, value).is_some() {
                            return Err(serde::de::Error::custom("Doppeltes JSON-Objektfeld"));
                        }
                    }
                    Ok(Json(Value::Object(object)))
                }
                fn visit_seq<S: serde::de::SeqAccess<'de>>(
                    self,
                    mut seq: S,
                ) -> std::result::Result<Json, S::Error> {
                    let mut a = Vec::new();
                    while let Some(Json(v)) = seq.next_element()? {
                        a.push(v);
                    }
                    Ok(Json(Value::Array(a)))
                }
                fn visit_bool<E: serde::de::Error>(self, v: bool) -> std::result::Result<Json, E> {
                    Ok(Json(json!(v)))
                }
                fn visit_i64<E: serde::de::Error>(self, v: i64) -> std::result::Result<Json, E> {
                    Ok(Json(json!(v)))
                }
                fn visit_u64<E: serde::de::Error>(self, v: u64) -> std::result::Result<Json, E> {
                    Ok(Json(json!(v)))
                }
                fn visit_f64<E: serde::de::Error>(self, v: f64) -> std::result::Result<Json, E> {
                    serde_json::Number::from_f64(v)
                        .map(|n| Json(Value::Number(n)))
                        .ok_or_else(|| E::custom("Ungültige Zahl"))
                }
                fn visit_str<E: serde::de::Error>(self, v: &str) -> std::result::Result<Json, E> {
                    Ok(Json(json!(v)))
                }
                fn visit_unit<E: serde::de::Error>(self) -> std::result::Result<Json, E> {
                    Ok(Json(Value::Null))
                }
            }
            d.deserialize_any(Visitor)
        }
    }
    let Json(value) = serde_json::from_str(text).map_err(invalid)?;
    serde_json::from_value(value).map_err(invalid)
}

#[cfg(test)]
pub(in crate::atlas) mod payload_metrics {
    use std::cell::Cell;
    thread_local! { static COUNTS: Cell<(usize,usize,usize)> = const { Cell::new((0,0,0)) }; }
    pub struct Lease;
    impl Lease {
        pub fn new() -> Self {
            COUNTS.with(|c| {
                let (active, max, total) = c.get();
                c.set((active + 1, max.max(active + 1), total + 1));
            });
            Self
        }
    }
    impl Drop for Lease {
        fn drop(&mut self) {
            COUNTS.with(|c| {
                let (active, max, total) = c.get();
                c.set((active - 1, max, total));
            });
        }
    }
    pub fn reset() {
        COUNTS.with(|c| c.set((0, 0, 0)));
    }
    pub fn counts() -> (usize, usize, usize) {
        COUNTS.with(Cell::get)
    }
}
