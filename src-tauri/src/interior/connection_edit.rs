//! Pure connection edits over immutable house-local author data.
use super::{
    edit::{finish, initialized_counter, reconcile, Changes},
    state::constraint,
    validation::initial_state,
    Axis, Connection, ConnectionIntent, ConnectionShape, InteriorChange, InteriorConnection,
    InteriorInput, Result, StairGeometry,
};

pub(super) fn solve(input: InteriorInput<'_>, intent: ConnectionIntent) -> Result<InteriorChange> {
    let state = initial_state(&input)?;
    let mut connections = input.connections.to_vec();
    let room_counter =
        initialized_counter(input.room_counter, input.rooms.iter().map(|r| r.created));
    let mut counter = initialized_counter(
        input.connection_counter,
        input.connections.iter().map(|c| c.created),
    );
    let new_connection =
        match intent {
            ConnectionIntent::CreateOpening {
                floor,
                x,
                y,
                axis,
                kind,
            } => {
                if i32::try_from(floor).is_err()
                    || x.abs_diff(0) > 1_000_001
                    || y.abs_diff(0) > 1_000_001
                {
                    return Err("Invalid opening".into());
                }
                if connections.iter().any(|c| c.floor == floor && c.x == x && c.y == y
                && matches!(&c.shape, ConnectionShape::Opening { axis: a, .. } if *a == axis))
            {
                return Err("Duplicate wall opening".into());
            }
                let (nx, ny) = match axis {
                    Axis::Vertical => (x - 1, y),
                    Axis::Horizontal => (x, y - 1),
                };
                let a = state.occupancy.get(&(floor, x, y)).copied();
                let b = state.occupancy.get(&(floor, nx, ny)).copied();
                if a == b {
                    return Err("Opening must border distinct rooms or exterior".into());
                }
                let (from, to) = match (a, b) {
                    (Some(a), b) => (a, b),
                    (None, Some(b)) => (b, None),
                    _ => return Err("Opening has no room".into()),
                };
                Some((
                    from.to_owned(),
                    to.map(str::to_owned),
                    floor,
                    x,
                    y,
                    ConnectionShape::Opening { kind, axis },
                ))
            }
            ConnectionIntent::CreateStairs {
                floor,
                x,
                y,
                direction,
                length,
            } => {
                let geometry = StairGeometry {
                    floor,
                    x,
                    y,
                    direction,
                    length,
                };
                let (from, to) = geometry.resolve_rooms::<super::InteriorError>(
                    |f, x, y| Ok(state.occupancy.get(&(f, x, y)).map(|id| (*id).to_owned())),
                    |f, x, y| Ok(state.stair_footprints.contains_key(&(f, x, y))),
                )?;
                Some((
                    from,
                    Some(to),
                    floor,
                    x,
                    y,
                    ConnectionShape::Stairs { direction, length },
                ))
            }
            ConnectionIntent::Convert {
                connection_id,
                kind,
            } => {
                let c = connections
                    .iter_mut()
                    .find(|c| c.id == connection_id)
                    .ok_or("Connection not found")?;
                match &mut c.base.shape {
                    ConnectionShape::Opening { kind: current, .. } => *current = kind,
                    ConnectionShape::Stairs { .. } => {
                        return Err("Only doors and passages can be converted".into())
                    }
                }
                None
            }
            ConnectionIntent::Delete { connection_id } => {
                let index = connections
                    .iter()
                    .position(|c| c.id == connection_id)
                    .ok_or("Connection not found")?;
                connections.remove(index);
                None
            }
        };
    if let Some((from_room, to_room, floor, x, y, shape)) = new_connection {
        let (id, created) = loop {
            let created = counter;
            counter = counter
                .checked_add(1)
                .ok_or_else(|| constraint("Identity counter exhausted"))?;
            let id = format!("connection-{created}");
            if !state.connections.contains_key(id.as_str()) {
                break (id, created);
            }
        };
        connections.push(InteriorConnection {
            base: Connection {
                id,
                created,
                from_room,
                to_room,
                floor,
                x,
                y,
                shape,
            },
            offset: 0.0,
        });
    }
    let changes = Changes::new();
    reconcile(&state, &changes, &mut connections, None)?;
    // Offsets and array ordering are adapter result work, not author-row changes.
    let raw_changed = connections
        .iter()
        .map(|c| &c.base)
        .ne(input.connections.iter().map(|c| &c.base));
    let rooms = input.rooms.to_vec();
    finish(
        input,
        &state,
        changes,
        rooms,
        connections,
        raw_changed,
        (room_counter, counter),
    )
}

#[cfg(test)]
#[path = "connection_edit_tests.rs"]
mod tests;
