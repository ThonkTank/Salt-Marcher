//! Bounded, operation-local lookups over borrowed house author data.
use super::{
    Cell, InteriorConnection, InteriorError, InteriorErrorCategory, InteriorInput, Result, Room,
};
use std::collections::{BTreeSet, HashMap, HashSet};

pub(super) type Position = (i64, i64, i64);
pub(super) struct State<'a> {
    pub rooms: HashMap<&'a str, &'a Room>,
    pub connections: HashMap<&'a str, &'a InteriorConnection>,
    pub occupancy: HashMap<Position, &'a str>,
    pub room_cells: HashMap<&'a str, BTreeSet<(i64, i64)>>,
    pub room_names: HashSet<&'a str>,
    pub room_created: HashSet<i64>,
    pub connection_created: HashSet<i64>,
    pub stair_footprints: HashMap<Position, &'a str>,
}

// These are specific historical constraint results, not conversions of domain errors.
pub(super) fn constraint(message: &str) -> InteriorError {
    InteriorError {
        category: InteriorErrorCategory::Storage,
        origin: super::InteriorErrorOrigin::Local,
        message: message.into(),
    }
}
impl<'a> State<'a> {
    pub fn new(input: &InteriorInput<'a>) -> Result<Self> {
        let mut state = Self {
            rooms: HashMap::new(),
            connections: HashMap::new(),
            occupancy: HashMap::new(),
            room_cells: HashMap::new(),
            room_names: HashSet::new(),
            room_created: HashSet::new(),
            connection_created: HashSet::new(),
            stair_footprints: HashMap::new(),
        };
        // Match the old insertion order: rooms, cells, connections and their footprints.
        // UNIQUE(created) precedes UNIQUE(id) when both conflict on the same row.
        for room in input.rooms {
            if !state.room_created.insert(room.created) {
                return Err(constraint("UNIQUE constraint failed: rooms.created"));
            }
            if state.rooms.insert(&room.id, room).is_some() {
                return Err(constraint("UNIQUE constraint failed: rooms.id"));
            }
            state.room_names.insert(&room.name);
        }
        for Cell {
            floor,
            x,
            y,
            room_id,
        } in input.cells
        {
            if state.occupancy.insert((*floor, *x, *y), room_id).is_some() {
                return Err(constraint(
                    "UNIQUE constraint failed: cells.floor, cells.x, cells.y",
                ));
            }
            if !state.rooms.contains_key(room_id.as_str()) {
                return Err(constraint("FOREIGN KEY constraint failed"));
            }
            state
                .room_cells
                .entry(room_id)
                .or_default()
                .insert((*x, *y));
        }
        for connection in input.connections {
            if !state.connection_created.insert(connection.created) {
                return Err(constraint("UNIQUE constraint failed: connections.created"));
            }
            if state
                .connections
                .insert(&connection.id, connection)
                .is_some()
            {
                return Err(constraint("UNIQUE constraint failed: connections.id"));
            }
            if !state.rooms.contains_key(connection.from_room.as_str())
                || connection
                    .to_room
                    .as_deref()
                    .is_some_and(|id| !state.rooms.contains_key(id))
            {
                return Err(constraint("FOREIGN KEY constraint failed"));
            }
            if let Some(geometry) = connection.stair_geometry() {
                for position in geometry.footprint()? {
                    if state
                        .stair_footprints
                        .insert(position, &connection.id)
                        .is_some()
                    {
                        return Err(constraint("UNIQUE constraint failed: stair_footprints.floor, stair_footprints.x, stair_footprints.y"));
                    }
                }
            }
        }
        Ok(state)
    }
}
