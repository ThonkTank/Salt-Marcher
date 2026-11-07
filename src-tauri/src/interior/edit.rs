//! Local connection reconciliation and canonical author-result assembly.
use super::{
    state::{Position, State},
    validation::validate_openings,
    Axis, Cell, ConnectionShape, InteriorChange, InteriorConnection, InteriorInput, Result, Room,
};
use std::collections::BTreeMap;

pub(super) type Changes = BTreeMap<Position, Option<String>>;

// Called only after initial_state has rejected max(created)==i64::MAX.
pub(super) fn initialized_counter(supplied: i64, created: impl Iterator<Item = i64>) -> i64 {
    supplied.max(created.map(|value| value + 1).max().unwrap_or(0))
}

pub(super) fn at<'a>(state: &State<'a>, changes: &'a Changes, p: Position) -> Option<&'a str> {
    changes
        .get(&p)
        .map(|id| id.as_deref())
        .unwrap_or_else(|| state.occupancy.get(&p).copied())
}
// Geometry edits may change endpoints at fixed positions. Moves instead keep
// both endpoint identities; only an owned exterior door changes position.
pub(super) fn reconcile(
    state: &State<'_>,
    changes: &Changes,
    connections: &mut Vec<InteriorConnection>,
    movement: Option<(&str, i64, i64)>,
) -> Result<()> {
    let mut retained = Vec::with_capacity(connections.len());
    for mut c in connections.drain(..) {
        if let Some((room_id, dx, dy)) = movement {
            if c.from_room == room_id && c.to_room.is_none() {
                c.base.x = c.x.checked_add(dx).ok_or("Invalid room move")?;
                c.base.y = c.y.checked_add(dy).ok_or("Invalid room move")?;
            }
        }
        if let Some(stair) = c.stair_geometry() {
            if let Ok((from, to)) = stair.resolve_rooms::<super::InteriorError>(
                |f, x, y| Ok(at(state, changes, (f, x, y)).map(str::to_owned)),
                |_, _, _| Ok(false),
            ) {
                if movement.is_none() {
                    c.base.from_room = from;
                    c.base.to_room = Some(to);
                } else if c.from_room != from || c.to_room.as_deref() != Some(to.as_str()) {
                    continue;
                }
                retained.push(c);
            }
            continue;
        }
        let ConnectionShape::Opening { axis, .. } = &c.shape else {
            unreachable!()
        };
        // Original input has already passed bounded base-coordinate validation.
        let (nx, ny) = match axis {
            Axis::Vertical => (c.x - 1, c.y),
            Axis::Horizontal => (c.x, c.y - 1),
        };
        let a = at(state, changes, (c.floor, c.x, c.y));
        let b = at(state, changes, (c.floor, nx, ny));
        if movement.is_some() {
            if (a == Some(c.from_room.as_str()) && b == c.to_room.as_deref())
                || (b == Some(c.from_room.as_str()) && a == c.to_room.as_deref())
            {
                retained.push(c);
            }
        } else {
            let old_a = state.occupancy.get(&(c.floor, c.x, c.y)).copied();
            let (from, to) = if old_a == Some(c.from_room.as_str()) {
                (a, b)
            } else {
                (b, a)
            };
            if let Some(from) = from {
                if (c.to_room.is_none() && to.is_none())
                    || (c.to_room.is_some() && to.is_some_and(|to| to != from))
                {
                    c.base.from_room = from.into();
                    c.base.to_room = to.map(str::to_owned);
                    retained.push(c);
                }
            }
        }
    }
    *connections = retained;
    Ok(())
}

fn supported(c: &InteriorConnection, state: &State<'_>, changes: &Changes) -> bool {
    if c.offset == 0.0 {
        return true;
    }
    let ConnectionShape::Opening { axis, .. } = &c.shape else {
        return false;
    };
    let pair = |x, y| match axis {
        Axis::Horizontal => (
            at(state, changes, (c.floor, x, y - 1)),
            at(state, changes, (c.floor, x, y)),
        ),
        Axis::Vertical => (
            at(state, changes, (c.floor, x - 1, y)),
            at(state, changes, (c.floor, x, y)),
        ),
    };
    let (dx, dy) = match axis {
        Axis::Horizontal => (1, 0),
        Axis::Vertical => (0, 1),
    };
    pair(c.x, c.y) == pair(c.x + dx, c.y + dy)
}

pub(super) fn finish(
    input: InteriorInput<'_>,
    state: &State<'_>,
    changes: Changes,
    mut rooms: Vec<Room>,
    mut connections: Vec<InteriorConnection>,
    raw_changed: bool,
    counters: (i64, i64),
) -> Result<InteriorChange> {
    rooms.sort_by_key(|r| r.created);
    connections.sort_by_key(|c| c.created);
    connections.retain(|c| supported(c, state, &changes));
    let mut cells: Vec<_> = input
        .cells
        .iter()
        .filter(|c| !changes.contains_key(&(c.floor, c.x, c.y)))
        .cloned()
        .collect();
    cells.extend(changes.into_iter().filter_map(|((floor, x, y), id)| {
        id.map(|room_id| Cell {
            floor,
            x,
            y,
            room_id,
        })
    }));
    cells.sort_by_key(|c| (c.floor, c.y, c.x));
    let (room_counter, connection_counter) = if raw_changed {
        counters
    } else {
        (input.room_counter, input.connection_counter)
    };
    validate_openings(&cells, &connections)?;
    let cells_changed = cells != input.cells;
    let changed = rooms != input.rooms
        || cells_changed
        || connections != input.connections
        || room_counter != input.room_counter
        || connection_counter != input.connection_counter;
    Ok(InteriorChange {
        rooms,
        cells,
        connections,
        room_counter,
        connection_counter,
        cells_changed,
        changed,
    })
}
