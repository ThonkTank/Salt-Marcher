use crate::atlas::errors;
use crate::atlas::errors::{ensure, invalid, DomainViolation};
use crate::atlas::geometry::{contours, occupancy_bounds, occupancy_contours};
use crate::atlas::model::{FullHouse, Placement, Transform};
use crate::atlas::Result;
use crate::interior::InteriorConnection;
use crate::interior::{
    Axis, Cell, Connection as Opening, ConnectionKind, ConnectionShape, InteriorInput, LocalEdit,
    Room,
};
use std::collections::HashSet;
pub fn new_house(
    id: String,
    transform: Transform,
    width: u32,
    depth: u32,
    index: usize,
) -> Result<FullHouse> {
    ensure(width >= 1 && depth >= 1, "Ungültige Hausmaße")
        .map_err(|e| e.with_context(vec![id.clone()]))?;
    let cell_count = u64::from(width) * u64::from(depth);
    if cell_count > 100_000 {
        return Err(DomainViolation::Limit {
            kind: "Hauszellen".into(),
            actual: usize::try_from(cell_count).unwrap_or(usize::MAX),
            maximum: 100_000,
            object_ids: vec![id],
        }
        .into());
    }
    let room_id = "room-0".to_owned();
    let cells: Vec<_> = (0..depth)
        .flat_map(|y| {
            let room_id = room_id.clone();
            (0..width).map(move |x| Cell {
                floor: 0,
                x: x.into(),
                y: y.into(),
                room_id: room_id.clone(),
            })
        })
        .collect();
    let contours = contours(&cells);
    let house = FullHouse {
        important_place: false,
        foundation: crate::atlas::terrain::Foundation::default(),
        id: id.clone(),
        name: format!("Haus {}", index + 1),
        roof: ["#9a705a", "#80756b", "#ad8765", "#6f7775"][index % 4].into(),
        occupancy_bounds: occupancy_bounds(&contours, &transform),
        occupancy_contours: contours.clone(),
        placement: Placement::Free {},
        transform,
        contours,
        room_counter: 1,
        connection_counter: 1,
        rooms: vec![Room {
            id: room_id.clone(),
            name: "Erdgeschoss".into(),
            floor: 0,
            building_id: id,
            created: 0,
        }],
        connections: vec![InteriorConnection {
            base: Opening {
                id: "connection-0".into(),
                created: 0,
                from_room: room_id,
                to_room: None,
                floor: 0,
                x: ((width - 1) / 2).into(),
                y: 0,
                shape: ConnectionShape::Opening {
                    axis: Axis::Horizontal,
                    kind: ConnectionKind::Door,
                },
            },
            offset: if width.is_multiple_of(2) { 0.5 } else { 0.0 },
        }],
        cells,
    };
    validate(&house)?;
    Ok(house)
}
pub fn validate_openings(cells: &[Cell], connections: &[InteriorConnection]) -> Result<()> {
    crate::interior::validate_openings(cells, connections).map_err(|error| match error.category {
        crate::interior::InteriorErrorCategory::InvalidInput => invalid(error.message),
        crate::interior::InteriorErrorCategory::Storage => errors::storage_error(error.message),
    })
}

fn input(h: &FullHouse) -> InteriorInput<'_> {
    InteriorInput {
        house_id: &h.id,
        rooms: &h.rooms,
        cells: &h.cells,
        connections: &h.connections,
        room_counter: h.room_counter,
        connection_counter: h.connection_counter,
    }
}
fn check_outer_prefix(h: &FullHouse) -> Result<()> {
    let rooms: HashSet<_> = h.rooms.iter().map(|r| &r.id).collect();
    for c in &h.connections {
        if let Some(other) = &c.to_room {
            ensure(
                rooms.contains(&c.from_room) && rooms.contains(other),
                "Fremde Verbindung",
            )?;
        }
    }
    // Preserve the historical structural-error priority over invalid roof metadata.
    if !h.rooms.is_empty() && !crate::atlas::validation::roof_color(&h.roof) {
        crate::interior::check_initial_structure(input(h))
            .map_err(|e| errors::local_interior_error(e, &h.id))?;
        return Err(invalid("Invalid metadata").with_context(vec![h.id.clone()]));
    }
    Ok(())
}

pub fn validate(h: &FullHouse) -> Result<()> {
    validate_openings(&h.cells, &h.connections)?;
    ensure(
        h.room_counter > h.rooms.iter().map(|r| r.created).max().unwrap_or(-1)
            && h.connection_counter > h.connections.iter().map(|c| c.created).max().unwrap_or(-1),
        "Ungültige Innenraumzähler",
    )?;
    check_outer_prefix(h)?;

    crate::interior::validate(input(h)).map_err(|e| errors::local_interior_error(e, &h.id))
}

pub fn edit(h: &FullHouse, intent: LocalEdit) -> Result<FullHouse> {
    check_outer_prefix(h)?;
    let local = crate::interior::solve(input(h), intent)
        .map_err(|e| errors::local_interior_error(e, &h.id))?;
    let mut next = FullHouse {
        id: h.id.clone(),
        name: h.name.clone(),
        roof: h.roof.clone(),
        important_place: h.important_place,
        foundation: h.foundation.clone(),
        transform: h.transform.clone(),
        contours: h.contours.clone(),
        placement: h.placement.clone(),
        occupancy_contours: h.occupancy_contours.clone(),
        occupancy_bounds: h.occupancy_bounds,
        rooms: local.rooms,
        cells: local.cells,
        connections: local.connections,
        room_counter: local.room_counter,
        connection_counter: local.connection_counter,
    };
    debug_assert_eq!(local.changed, next != *h);
    if local.cells_changed {
        next.contours = contours(&next.cells);
        next.occupancy_contours = occupancy_contours(&next.cells);
        next.occupancy_bounds = occupancy_bounds(&next.occupancy_contours, &next.transform);
    }
    Ok(next)
}
