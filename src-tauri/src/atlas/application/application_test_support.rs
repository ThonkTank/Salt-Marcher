use super::*;
pub(super) use crate::atlas::change::Delta;
pub(super) fn changes(d: &Delta) -> crate::atlas::model::ChangeHints {
    crate::atlas::change_hints::from_objects(&d.before, &d.after)
}
pub(super) use crate::atlas::errors;
use crate::atlas::errors::ensure;
pub(super) use crate::atlas::errors::{
    storage_error, DomainIssue, DomainViolation, IssueCode, IssueGeometry,
};
pub(super) use crate::atlas::geometry::collision_bounds;
pub(super) use crate::atlas::geometry::{
    contours, occupancy_bounds, occupancy_contours, road_path,
};
pub(super) use crate::atlas::model::{
    placement_owner, AlgorithmVersion, Area, Bounds, EditorContext, FullHouse, FullObject,
    GridPose, HouseHeader, LocalPoint, Node, Parcel, ParcelSource, Placement, PopulationRecipe,
    QuarterTurns, Road, RoadSection, Side, Transform,
};
pub(super) use crate::atlas::model::{Intent, SceneObject};
pub(super) use crate::atlas::validation::{conflict, validate_road_identity};
pub(super) use crate::atlas::{generation, interior, parcel_geometry, plan_context};
pub(super) use crate::interior::InteriorConnection;
pub(super) use rusqlite::{params, Connection};
pub(super) use std::collections::{HashMap, HashSet};

impl AtlasApplication {
    pub(super) fn compute(&self, intent: &Intent) -> Result<Computed> {
        operations::compute(self, intent, &mut PlanDiagnostics::default())
    }
    pub(super) fn collision(
        &self,
        o: &SceneObject,
        removed: &[SceneObject],
        added: &[SceneObject],
    ) -> Result<()> {
        let excluded: HashSet<_> = removed.iter().chain(added).map(SceneObject::id).collect();
        let nearby = self.query_collision_headers(collision_bounds(o))?;
        for other in nearby
            .iter()
            .filter(|x| !excluded.contains(x.id()))
            .chain(added.iter().filter(|x| x.id() != o.id()))
        {
            if conflict(o, other)? {
                return Err(DomainViolation::Collision {
                    first_id: o.id().into(),
                    second_id: other.id().into(),
                    geometry: None,
                }
                .into());
            }
        }
        Ok(())
    }
}

pub(super) fn request_edit(a: &mut AtlasApplication, cmd: &str, intent: Value) -> Value {
    a.request(cmd, json!({"version": a.status(), "intent": intent}))
        .unwrap()
}
pub(super) fn history(a: &mut AtlasApplication, redo: bool) {
    a.request("history", json!({"version": a.status(), "redo": redo}))
        .unwrap();
}
pub(super) fn fixture() -> FullHouse {
    let mut cells = Vec::new();
    for floor in [-1, 0, 1] {
        for x in 0..40 {
            for y in 0..40 {
                cells.push(crate::interior::Cell {
                    floor,
                    x,
                    y,
                    room_id: format!("r{floor}"),
                });
            }
        }
    }
    FullHouse {
        important_place: false,
        foundation: crate::atlas::terrain::Foundation::default(),
        id: "house".into(),
        name: "House".into(),
        roof: "#123456".into(),
        transform: Transform {
            x: 0.0,
            y: 0.0,
            angle: 0.0,
        },
        contours: vec![],
        occupancy_contours: vec![],
        occupancy_bounds: [0.0; 4],
        placement: Placement::Free {},
        room_counter: 3,
        connection_counter: 0,
        rooms: [-1, 0, 1]
            .into_iter()
            .map(|floor| crate::interior::Room {
                id: format!("r{floor}"),
                name: "Room".into(),
                floor,
                building_id: "house".into(),
                created: floor,
            })
            .collect(),
        connections: vec![],
        cells,
    }
}
// Derive the changed answer directly from fixture snapshots, independently of
// the hint implementation, including ownership changes at occupied positions.
pub(super) fn assert_coverage(
    before: Option<&FullHouse>,
    after: Option<&FullHouse>,
    hints: &ChangeHints,
) {
    let mut coords = std::collections::BTreeSet::new();
    for house in [before, after].into_iter().flatten() {
        coords.extend(house.cells.iter().map(|c| (c.floor, c.x, c.y)));
    }
    for (floor, x, y) in coords {
        let owner = |h: Option<&FullHouse>| {
            h.and_then(|h| {
                h.cells
                    .iter()
                    .find(|c| (c.floor, c.x, c.y) == (floor, x, y))
            })
            .map(|c| c.room_id.clone())
        };
        if owner(before) != owner(after) {
            assert!(
                hints.interiors.iter().any(|r| r.building_id == "house"
                    && r.floor == floor
                    && r.bounds[0] <= x as f64
                    && r.bounds[1] <= y as f64
                    && r.bounds[2] >= x as f64
                    && r.bounds[3] >= y as f64),
                "missing {floor} {x} {y}"
            );
        }
    }
    let meta = |h: Option<&FullHouse>| {
        h.map(|h| {
            (
                h.rooms.clone(),
                h.connections.clone(),
                h.room_counter,
                h.connection_counter,
            )
        })
    };
    assert_eq!(
        hints.metadata.contains(&"house".to_owned()),
        meta(before) != meta(after)
    );
}
pub(super) fn hints(before: Option<&FullHouse>, after: Option<&FullHouse>) -> ChangeHints {
    changes(&Delta {
        before: before.into_iter().cloned().map(FullObject::House).collect(),
        after: after.into_iter().cloned().map(FullObject::House).collect(),
    })
}

impl AtlasApplication {
    /// Collision reads include all-floor houses without changing the viewport,
    /// fit bounds or the size of normal scene responses. Both branches use an
    /// RTree and return headers only; UNION deduplicates the same house.
    pub(in crate::atlas) fn query_collision_headers(&self, b: Bounds) -> Result<Vec<SceneObject>> {
        let mut q = self.db.prepare("SELECT o.body FROM objects o JOIN (SELECT key FROM spatial WHERE min_x<=?1 AND max_x>=?2 AND min_y<=?3 AND max_y>=?4 UNION SELECT key FROM occupancy_spatial WHERE min_x<=?1 AND max_x>=?2 AND min_y<=?3 AND max_y>=?4) hits ON o.rowid=hits.key ORDER BY o.rowid").map_err(storage_error)?;
        let rows = q
            .query_map(params![b[2], b[0], b[3], b[1]], |r| r.get::<_, String>(0))
            .map_err(storage_error)?;
        rows.map(|s| serde_json::from_str(&s.map_err(storage_error)?).map_err(storage_error))
            .collect()
    }
}

pub(super) fn validate_rtree(
    source: &Connection,
    candidate: &Connection,
    table: &str,
    houses_only: bool,
) -> Result<()> {
    let check: String = source
        .query_row("SELECT rtreecheck(?)", [table], |r| r.get(0))
        .map_err(storage_error)?;
    ensure(check == "ok", "Beschädigter räumlicher Index")?;
    let mismatch: i64 = source.query_row(&format!("SELECT (SELECT count(*) FROM {table} s LEFT JOIN objects o ON o.rowid=s.key WHERE o.id IS NULL OR (?1 AND o.kind!='house')) + (SELECT count(*) FROM objects o LEFT JOIN {table} s ON s.key=o.rowid WHERE (NOT ?1 OR o.kind='house') AND s.key IS NULL)"), [houses_only], |r| r.get(0)).map_err(storage_error)?;
    ensure(mismatch == 0, "Unvollständiger räumlicher Index")?;
    let mut q = source.prepare(&format!("SELECT o.id,s.min_x,s.min_y,s.max_x,s.max_y FROM {table} s JOIN objects o ON o.rowid=s.key")).map_err(storage_error)?;
    let mut rows = q.query([]).map_err(storage_error)?;
    while let Some(row) = rows.next().map_err(storage_error)? {
        let id: String = row.get(0).map_err(storage_error)?;
        let actual: Bounds = [
            row.get(1).map_err(storage_error)?,
            row.get(2).map_err(storage_error)?,
            row.get(3).map_err(storage_error)?,
            row.get(4).map_err(storage_error)?,
        ];
        let expected: Bounds = candidate.query_row(&format!("SELECT s.min_x,s.min_y,s.max_x,s.max_y FROM {table} s JOIN objects o ON o.rowid=s.key WHERE o.id=?"), [&id], |r| Ok([r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?])).map_err(storage_error)?;
        // SQLite RTree boxes are float32, expanded outwards. Compare to fresh
        // insertion, not the double bounds: both narrowed and inflated caches
        // are corruption, while legitimate conservative rounding is accepted.
        ensure(actual == expected, "Beschädigte räumliche Indexbounds")?;
    }
    Ok(())
}
