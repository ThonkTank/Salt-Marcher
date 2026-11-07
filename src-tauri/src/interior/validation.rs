//! Complete house-local validation. No outer house metadata or document limits.
use super::{cell_components, state::State, Axis, ConnectionShape, InteriorInput, Result};
use std::collections::{BTreeMap, HashMap, HashSet};

pub(crate) fn validate(input: InteriorInput<'_>) -> Result<()> {
    // The adapter checks offsets/support and local counters before constructing its store.
    validate_openings(input.cells, input.connections)?;
    if input.room_counter <= input.rooms.iter().map(|r| r.created).max().unwrap_or(-1)
        || input.connection_counter
            <= input
                .connections
                .iter()
                .map(|c| c.created)
                .max()
                .unwrap_or(-1)
    {
        return Err("Ungültige Innenraumzähler".into());
    }
    initial_state(&input)?;
    Ok(())
}

// Edit initialization validates base author data before applying an intent. The
// existing adapter checks offsets only on its result and raises low supplied
// counters to max(created)+1; keep that order separate from explicit validate.
fn initial_structure<'a>(input: &InteriorInput<'a>) -> Result<State<'a>> {
    let ids: HashSet<_> = input.rooms.iter().map(|r| r.id.as_str()).collect();
    for connection in input.connections {
        if let Some(target) = connection.to_room.as_deref() {
            if !ids.contains(connection.from_room.as_str()) || !ids.contains(target) {
                return Err("Fremde Verbindung".into());
            }
        }
    }
    let state = State::new(input)?;
    if state.room_created.contains(&i64::MAX) || state.connection_created.contains(&i64::MAX) {
        return Err(super::state::constraint(
            "Invalid column type Real at index: 0, name: next",
        ));
    }
    // initialize() derives counters from created before validating metadata.
    if state.room_created.iter().max().is_some_and(|v| *v < -1)
        || state
            .connection_created
            .iter()
            .max()
            .is_some_and(|v| *v < -1)
    {
        return Err("Invalid identity counter".into());
    }
    Ok(state)
}

// Roof-free prefix for the outer adapter's historical metadata ordering.
pub(crate) fn check_initial_structure(input: InteriorInput<'_>) -> Result<()> {
    initial_structure(&input).map(|_| ())
}

pub(super) fn initial_state<'a>(input: &InteriorInput<'a>) -> Result<State<'a>> {
    let state = initial_structure(input)?;
    if input.rooms.iter().any(|room| {
        room.id.is_empty()
            || room.name.trim().is_empty()
            || room.name.chars().count() > 120
            || room.created < 0
            || i32::try_from(room.floor).is_err()
    }) {
        return Err("Invalid metadata".into());
    }
    // Unlike the isolated old adapter, the pure boundary never rewrites owners.
    if input
        .rooms
        .iter()
        .any(|room| room.building_id != input.house_id)
    {
        return Err("Invalid room owner".into());
    }
    for cell in input.cells {
        let room = state.rooms[cell.room_id.as_str()];
        if cell.floor != room.floor
            || cell.x.abs_diff(0) > 1_000_000
            || cell.y.abs_diff(0) > 1_000_000
        {
            return Err("Invalid cell coordinates or floor".into());
        }
    }
    for room in input.rooms {
        let cells = state
            .room_cells
            .get(room.id.as_str())
            .ok_or("Room has no cells")?;
        // Coordinates have been checked, so component neighbor arithmetic is bounded.
        if cell_components(cells).len() != 1 {
            return Err("Room is disconnected".into());
        }
    }
    // The old reader visits connections by created, independently of payload ordering.
    let mut connections: Vec<_> = state.connections.values().copied().collect();
    connections.sort_by_key(|c| c.created);
    let mut edges = HashSet::new();
    for connection in connections {
        if connection.id.is_empty()
            || connection.created < 0
            || connection.x.abs_diff(0) > 1_000_001
            || connection.y.abs_diff(0) > 1_000_001
        {
            return Err("Invalid connection metadata or coordinates".into());
        }
        let from = state.rooms[connection.from_room.as_str()];
        if from.floor != connection.floor {
            return Err("Invalid connection floor".into());
        }
        let target = connection.to_room.as_deref().map(|id| state.rooms[id]);
        if target.is_some_and(|room| room.id == from.id || room.building_id != from.building_id) {
            return Err("Invalid connection membership".into());
        }
        match &connection.shape {
            ConnectionShape::Opening { axis, .. } => {
                let vertical = matches!(axis, Axis::Vertical);
                if !edges.insert((connection.floor, connection.x, connection.y, vertical)) {
                    return Err("Duplicate wall opening".into());
                }
                let neighbor = if vertical {
                    (connection.x - 1, connection.y)
                } else {
                    (connection.x, connection.y - 1)
                };
                let sides = [
                    state
                        .occupancy
                        .get(&(connection.floor, connection.x, connection.y))
                        .copied(),
                    state
                        .occupancy
                        .get(&(connection.floor, neighbor.0, neighbor.1))
                        .copied(),
                ];
                if !sides.contains(&Some(connection.from_room.as_str()))
                    || !sides.contains(&connection.to_room.as_deref())
                    || target.is_some_and(|room| room.floor != connection.floor)
                {
                    return Err("Opening does not match boundary".into());
                }
            }
            ConnectionShape::Stairs { .. } => {
                let (lower, upper) = connection
                    .stair_geometry()
                    .unwrap()
                    .resolve_rooms::<super::InteriorError>(
                        |f, x, y| Ok(state.occupancy.get(&(f, x, y)).map(|id| (*id).to_owned())),
                        |_, _, _| Ok(false),
                    )?;
                if lower != connection.from_room
                    || connection.to_room.as_deref() != Some(upper.as_str())
                {
                    return Err("Invalid stair room references".into());
                }
            }
        }
    }
    Ok(state)
}

pub(crate) fn validate_openings(
    input_cells: &[super::Cell],
    connections: &[super::InteriorConnection],
) -> Result<()> {
    check_openings(input_cells, connections).map_err(|mut error| {
        error.origin = super::InteriorErrorOrigin::OpeningValidation;
        error
    })
}

fn check_openings(
    input_cells: &[super::Cell],
    connections: &[super::InteriorConnection],
) -> Result<()> {
    // Last duplicate cell wins in this precheck, as in the old adapter. The index
    // subsequently rejects duplicates; do not let collecting overwrite that error.
    let cells: HashMap<_, _> = input_cells
        .iter()
        .map(|c| ((c.floor, c.x, c.y), c.room_id.as_str()))
        .collect();
    let mut walls: BTreeMap<_, Vec<f64>> = BTreeMap::new();
    for connection in connections {
        if connection.offset != 0.0 && connection.offset != 0.5 {
            return Err("Ungültiger Öffnungsversatz".into());
        }
        if connection.offset != 0.0 {
            let ConnectionShape::Opening { axis, .. } = &connection.shape else {
                return Err("Öffnung liegt nicht vollständig auf einer gemeinsamen Wand".into());
            };
            let pair = |x: i64, y: i64| -> Result<_> {
                let neighbor = match axis {
                    Axis::Horizontal => (
                        x,
                        y.checked_sub(1)
                            .ok_or("Invalid connection metadata or coordinates")?,
                    ),
                    Axis::Vertical => (
                        x.checked_sub(1)
                            .ok_or("Invalid connection metadata or coordinates")?,
                        y,
                    ),
                };
                Ok((
                    cells.get(&(connection.floor, neighbor.0, neighbor.1)),
                    cells.get(&(connection.floor, x, y)),
                ))
            };
            let (x, y) = match axis {
                Axis::Horizontal => (
                    connection
                        .x
                        .checked_add(1)
                        .ok_or("Invalid connection metadata or coordinates")?,
                    connection.y,
                ),
                Axis::Vertical => (
                    connection.x,
                    connection
                        .y
                        .checked_add(1)
                        .ok_or("Invalid connection metadata or coordinates")?,
                ),
            };
            if pair(connection.x, connection.y)? != pair(x, y)? {
                return Err("Öffnung liegt nicht vollständig auf einer gemeinsamen Wand".into());
            }
        }
        if let ConnectionShape::Opening { axis, .. } = &connection.shape {
            let (horizontal, wall, along) = match axis {
                Axis::Horizontal => (true, connection.y, connection.x),
                Axis::Vertical => (false, connection.x, connection.y),
            };
            walls
                .entry((connection.floor, horizontal, wall))
                .or_default()
                .push(along as f64 + connection.offset);
        }
    }
    for positions in walls.values_mut() {
        positions.sort_by(f64::total_cmp);
        if !positions.windows(2).all(|p| p[1] - p[0] >= 1.0) {
            return Err("Überlappende Wandöffnungen".into());
        }
    }
    Ok(())
}

#[cfg(test)]
#[path = "validation_tests.rs"]
mod tests;
