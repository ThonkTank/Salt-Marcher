//! Pure house-local room operations.
use super::{
    cell_components,
    edit::{at, reconcile, Changes},
    state::{constraint, State},
    validation::initial_state,
    InteriorChange, InteriorInput, Result, Room, RoomIntent,
};
use std::collections::{BTreeSet, HashMap, HashSet};

// Occupied IDs and names include the entire original input, even rooms removed
// during this operation, as well as identities allocated earlier in the edit.
struct Allocator<'a> {
    ids: HashSet<&'a str>,
    names: HashSet<&'a str>,
    new_ids: HashSet<String>,
    new_names: HashSet<String>,
    counter: i64,
    next_name: i64,
}
impl<'a> Allocator<'a> {
    fn new(input: &InteriorInput<'a>, state: &State<'a>) -> Self {
        Self {
            ids: state.rooms.keys().copied().collect(),
            names: state.room_names.clone(),
            new_ids: HashSet::new(),
            new_names: HashSet::new(),
            counter: input
                .room_counter
                .max(input.rooms.iter().map(|r| r.created + 1).max().unwrap_or(0)),
            next_name: 1,
        }
    }
    fn room(&mut self, house_id: &str, floor: i64) -> Result<Room> {
        let (id, created) = loop {
            let created = self.counter;
            self.counter = self
                .counter
                .checked_add(1)
                .ok_or_else(|| constraint("Identity counter exhausted"))?;
            let id = format!("room-{created}");
            if !self.ids.contains(id.as_str()) && self.new_ids.insert(id.clone()) {
                break (id, created);
            }
        };
        self.next_name = self.next_name.max(
            created
                .checked_add(1)
                .ok_or_else(|| constraint("Name counter exhausted"))?,
        );
        let name = loop {
            let name = format!("Raum {}", self.next_name);
            self.next_name = self
                .next_name
                .checked_add(1)
                .ok_or_else(|| constraint("Name counter exhausted"))?;
            if !self.names.contains(name.as_str()) && self.new_names.insert(name.clone()) {
                break name;
            }
        };
        Ok(Room {
            id,
            name,
            floor,
            building_id: house_id.into(),
            created,
        })
    }
}

fn moved(x: i64, y: i64, dx: i64, dy: i64) -> Result<(i64, i64)> {
    let x = x.checked_add(dx).ok_or("Invalid room move")?;
    let y = y.checked_add(dy).ok_or("Invalid room move")?;
    if x.abs_diff(0) > 1_000_000 || y.abs_diff(0) > 1_000_000 {
        return Err("Invalid room move".into());
    }
    Ok((x, y))
}

pub(crate) fn solve(input: InteriorInput<'_>, intent: RoomIntent) -> Result<InteriorChange> {
    let state = initial_state(&input)?;
    let mut rooms = input.rooms.to_vec();
    let mut connections = input.connections.to_vec();
    let mut changes = Changes::new();
    let mut allocator = Allocator::new(&input, &state);
    match &intent {
        RoomIntent::Rename { room_id, name } => {
            if name.trim().is_empty() || name.chars().count() > 120 {
                return Err("Room name must contain 1 to 120 characters".into());
            }
            rooms
                .iter_mut()
                .find(|r| r.id == *room_id)
                .ok_or("Room not found")?
                .name = name.clone();
        }
        RoomIntent::Move { room_id, dx, dy } => {
            let room = state.rooms.get(room_id.as_str()).ok_or("Room not found")?;
            let source = &state.room_cells[room_id.as_str()];
            // The old scope builder computes the entire destination before the
            // collision loop; coordinate failure wins over an earlier collision.
            let destination = source
                .iter()
                .map(|&(x, y)| moved(x, y, *dx, *dy))
                .collect::<Result<Vec<_>>>()?;
            for &(x, y) in source {
                changes.insert((room.floor, x, y), None);
            }
            for (x, y) in destination {
                if at(&state, &changes, (room.floor, x, y)).is_some_and(|id| id != room_id) {
                    return Err("Room move collision".into());
                }
                changes.insert((room.floor, x, y), Some(room_id.clone()));
            }
            reconcile(
                &state,
                &changes,
                &mut connections,
                Some((room_id, *dx, *dy)),
            )?;
        }
        RoomIntent::Draw { floor, cells }
        | RoomIntent::Erase { floor, cells }
        | RoomIntent::Assign { floor, cells, .. } => {
            if i32::try_from(*floor).is_err() {
                return Err("Invalid floor".into());
            }
            if cells.len() > 100_000 {
                return Err("Too many selected cells".into());
            }
            let selection: BTreeSet<_> = cells.iter().copied().collect();
            if selection
                .iter()
                .any(|(x, y)| x.abs_diff(0) > 1_000_000 || y.abs_diff(0) > 1_000_000)
            {
                return Err("Invalid coordinates".into());
            }
            let mut touched: HashSet<String> = selection
                .iter()
                .filter_map(|&(x, y)| state.occupancy.get(&(*floor, x, y)))
                .map(|id| (*id).into())
                .collect();
            let target = if let RoomIntent::Assign { room_id, .. } = &intent {
                let room = state.rooms.get(room_id.as_str()).ok_or("Room not found")?;
                if room.floor != *floor {
                    return Err("Room is on another floor".into());
                }
                touched.insert(room_id.clone());
                Some(room_id)
            } else {
                None
            };
            let mut geometry: HashMap<String, BTreeSet<(i64, i64)>> = touched
                .iter()
                .map(|id| (id.clone(), state.room_cells[id.as_str()].clone()))
                .collect();
            match &intent {
                RoomIntent::Draw { .. } if !selection.is_empty() => {
                    let winner = if touched.is_empty() {
                        let room = allocator.room(input.house_id, *floor)?;
                        let id = room.id.clone();
                        rooms.push(room);
                        id
                    } else {
                        rooms
                            .iter()
                            .filter(|r| touched.contains(&r.id))
                            .min_by_key(|r| r.created)
                            .unwrap()
                            .id
                            .clone()
                    };
                    let mut merged = selection;
                    for cells in geometry.values() {
                        merged.extend(cells);
                    }
                    if cell_components(&merged).len() != 1 {
                        return Err("Draw would create a disconnected room".into());
                    }
                    rooms.retain(|r| !touched.contains(&r.id) || r.id == winner);
                    geometry.clear();
                    geometry.insert(winner, merged);
                }
                RoomIntent::Erase { .. } | RoomIntent::Assign { .. } => {
                    let mut moved = BTreeSet::new();
                    for &(x, y) in &selection {
                        let Some(id) = state.occupancy.get(&(*floor, x, y)).copied() else {
                            continue;
                        };
                        if target.map(String::as_str) != Some(id)
                            && geometry.get_mut(id).unwrap().remove(&(x, y))
                        {
                            moved.insert((x, y));
                        }
                    }
                    if let Some(id) = target {
                        geometry.get_mut(id).unwrap().extend(moved);
                        if cell_components(&geometry[id]).len() != 1 {
                            return Err("Assignment would create a disconnected room".into());
                        }
                    }
                    let mut ids: Vec<_> = touched.iter().collect();
                    ids.sort_by_key(|id| state.rooms[id.as_str()].created);
                    for id in ids {
                        if Some(id) == target {
                            continue;
                        }
                        let parts = cell_components(&geometry[id]);
                        if parts.is_empty() {
                            rooms.retain(|r| r.id != *id);
                            geometry.remove(id);
                        } else {
                            geometry.insert(id.clone(), parts[0].clone());
                            for part in parts.into_iter().skip(1) {
                                let room = allocator.room(input.house_id, *floor)?;
                                geometry.insert(room.id.clone(), part);
                                rooms.push(room);
                            }
                        }
                    }
                }
                _ => {}
            }
            for id in &touched {
                for &(x, y) in &state.room_cells[id.as_str()] {
                    changes.insert((*floor, x, y), None);
                }
            }
            for (id, cells) in geometry {
                for (x, y) in cells {
                    changes.insert((*floor, x, y), Some(id.clone()));
                }
            }
            reconcile(&state, &changes, &mut connections, None)?;
        }
    }
    // Only author-row changes advance counters. Sorting and unsupported half-offset
    // cleanup occur afterwards and must not accidentally consume low counters.
    let raw_changed = rooms != input.rooms
        || connections
            .iter()
            .map(|c| &c.base)
            .ne(input.connections.iter().map(|c| &c.base))
        || changes
            .iter()
            .any(|(p, id)| state.occupancy.get(p).copied() != id.as_deref());
    let connection_counter = super::edit::initialized_counter(
        input.connection_counter,
        input.connections.iter().map(|c| c.created),
    );
    super::edit::finish(
        input,
        &state,
        changes,
        rooms,
        connections,
        raw_changed,
        (allocator.counter, connection_counter),
    )
}

#[cfg(test)]
#[path = "room_edit_tests.rs"]
mod tests;
