use super::*;
use crate::interior::{
    Cell, Connection, ConnectionKind, InteriorConnection, InteriorErrorCategory, Room,
    StairDirection,
};

#[derive(Clone)]
struct House {
    rooms: Vec<Room>,
    cells: Vec<Cell>,
    connections: Vec<InteriorConnection>,
    room_counter: i64,
    connection_counter: i64,
}
impl House {
    fn new() -> Self {
        Self {
            rooms: vec![],
            cells: vec![],
            connections: vec![],
            room_counter: 0,
            connection_counter: 0,
        }
    }
    fn room(&mut self, floor: i64, coords: &[(i64, i64)]) -> String {
        let id = format!("room-{}", self.room_counter);
        self.rooms.push(Room {
            id: id.clone(),
            name: format!("Room {}", self.room_counter),
            floor,
            building_id: "house".into(),
            created: self.room_counter,
        });
        self.room_counter += 1;
        self.cells.extend(coords.iter().map(|&(x, y)| Cell {
            floor,
            x,
            y,
            room_id: id.clone(),
        }));
        id
    }
    fn connection(
        &mut self,
        from: &str,
        to: Option<&str>,
        position: (i64, i64, i64),
        shape: ConnectionShape,
        offset: f64,
    ) {
        let (floor, x, y) = position;
        self.connections.push(InteriorConnection {
            base: Connection {
                id: format!("connection-{}", self.connection_counter),
                created: self.connection_counter,
                from_room: from.into(),
                to_room: to.map(str::to_owned),
                floor,
                x,
                y,
                shape,
            },
            offset,
        });
        self.connection_counter += 1;
    }
    fn input(&self) -> InteriorInput<'_> {
        InteriorInput {
            house_id: "house",
            rooms: &self.rooms,
            cells: &self.cells,
            connections: &self.connections,
            room_counter: self.room_counter,
            connection_counter: self.connection_counter,
        }
    }
    fn error(&self, message: &str) {
        let before = (
            self.rooms.clone(),
            self.cells.clone(),
            self.connections
                .iter()
                .map(|c| (&c.base, c.offset.to_bits()))
                .collect::<Vec<_>>(),
            self.room_counter,
            self.connection_counter,
        );
        assert_eq!(validate(self.input()).unwrap_err().message, message);
        assert_eq!(
            before,
            (
                self.rooms.clone(),
                self.cells.clone(),
                self.connections
                    .iter()
                    .map(|c| (&c.base, c.offset.to_bits()))
                    .collect::<Vec<_>>(),
                self.room_counter,
                self.connection_counter
            )
        );
    }
}
fn opening(axis: Axis) -> ConnectionShape {
    ConnectionShape::Opening {
        axis,
        kind: ConnectionKind::Door,
    }
}
fn stair(direction: StairDirection, length: u8) -> ConnectionShape {
    ConnectionShape::Stairs { direction, length }
}

#[test]
fn metadata_owners_names_and_floor_boundaries() {
    let mut h = House::new();
    h.room(i32::MIN.into(), &[(-1_000_000, 1_000_000)]);
    h.room(i32::MAX.into(), &[(0, 0)]);
    h.rooms[0].name = "💧".repeat(120);
    validate(h.input()).unwrap();
    for name in ["".into(), " \n\t".into(), "💧".repeat(121)] {
        let mut invalid = h.clone();
        invalid.rooms[0].name = name;
        invalid.error("Invalid metadata");
    }
    for floor in [
        i64::MIN,
        i64::MAX,
        i64::from(i32::MIN) - 1,
        i64::from(i32::MAX) + 1,
    ] {
        let mut invalid = h.clone();
        invalid.rooms[0].floor = floor;
        invalid.error("Invalid metadata");
    }
    let mut invalid = h.clone();
    invalid.rooms[0].id.clear();
    invalid.cells[0].room_id.clear();
    invalid.error("Invalid metadata");
    let mut invalid = h.clone();
    invalid.rooms[0].created = -1;
    invalid.error("Invalid metadata");
    let mut invalid = h.clone();
    invalid.rooms[0].building_id = "foreign".into();
    invalid.error("Invalid room owner");
    // Repeated display names are valid; allocation must avoid them later.
    h.rooms[1].name = h.rooms[0].name.clone();
    validate(h.input()).unwrap();
}

#[test]
fn duplicates_references_and_counter_order_are_explicit() {
    let mut h = House::new();
    let id = h.room(0, &[(0, 0)]);
    let mut invalid = h.clone();
    invalid.rooms.push(h.rooms[0].clone());
    invalid.error("UNIQUE constraint failed: rooms.created");
    invalid.rooms[1].created = 1;
    invalid.room_counter = 2;
    invalid.error("UNIQUE constraint failed: rooms.id");
    let mut invalid = h.clone();
    invalid.cells.push(h.cells[0].clone());
    invalid.error("UNIQUE constraint failed: cells.floor, cells.x, cells.y");
    let mut invalid = h.clone();
    invalid.cells[0].room_id = "missing".into();
    invalid.error("FOREIGN KEY constraint failed");
    for counter in [-1, 0] {
        let mut invalid = h.clone();
        invalid.room_counter = counter;
        invalid.error("Ungültige Innenraumzähler");
    }
    let mut valid = h.clone();
    valid.room_counter = i64::MAX;
    valid.connection_counter = i64::MAX;
    validate(valid.input()).unwrap();
    let mut invalid = h.clone();
    invalid.rooms[0].created = i64::MAX;
    invalid.room_counter = i64::MAX;
    invalid.error("Ungültige Innenraumzähler");
    let mut negative = House::new();
    negative.room(0, &[(0, 0)]);
    negative.rooms[0].created = -2;
    negative.error("Invalid identity counter");
    h.connection(&id, None, (0, 0, 0), opening(Axis::Horizontal), 0.0);
    let mut invalid = h.clone();
    invalid.connections[0].base.from_room = "missing".into();
    invalid.error("FOREIGN KEY constraint failed");
    let mut invalid = h.clone();
    invalid.connections[0].base.to_room = Some("missing".into());
    invalid.error("Fremde Verbindung");
    let mut invalid = h.clone();
    invalid.connections[0].base.floor = 1;
    invalid.error("Invalid connection floor");
    let mut invalid = h.clone();
    invalid.connection_counter = 0;
    invalid.error("Ungültige Innenraumzähler");
    let mut invalid = h.clone();
    invalid.connections[0].offset = 0.25;
    invalid.room_counter = 0;
    invalid.error("Ungültiger Öffnungsversatz");
    assert_eq!(
        validate({
            let mut i = h.input();
            i.cells = &[];
            i
        })
        .unwrap_err()
        .category,
        InteriorErrorCategory::InvalidInput
    );
}

#[test]
fn cells_are_owned_connected_bounded_and_not_house_limited() {
    let mut h = House::new();
    h.room(0, &[(0, 0), (1, 0)]);
    h.room(0, &[(10, 0)]);
    h.room(-1, &[(0, 0)]);
    validate(h.input()).unwrap(); // Disconnected room groups and stacked cells are valid.
    let mut invalid = h.clone();
    invalid.cells[0].floor = 2;
    invalid.error("Invalid cell coordinates or floor");
    for coord in [i64::MIN, i64::MAX, -1_000_001, 1_000_001] {
        let mut invalid = h.clone();
        invalid.cells[0].x = coord;
        invalid.error("Invalid cell coordinates or floor");
        let mut invalid = h.clone();
        invalid.cells[0].y = coord;
        invalid.error("Invalid cell coordinates or floor");
    }
    let mut invalid = h.clone();
    invalid.cells[1].x = 2;
    invalid.error("Room is disconnected");
    let mut invalid = h.clone();
    invalid.cells.retain(|c| c.room_id != "room-1");
    invalid.error("Room has no cells");
    let mut large = House::new();
    let id = large.room(0, &[]);
    large.cells = (0..100_001)
        .map(|x| Cell {
            floor: 0,
            x,
            y: 0,
            room_id: id.clone(),
        })
        .collect();
    validate(large.input()).unwrap();
    validate(House::new().input()).unwrap();
}

#[test]
fn openings_check_both_sides_offsets_axes_and_overlaps() {
    for axis in [Axis::Horizontal, Axis::Vertical] {
        let mut h = House::new();
        let a = h.room(0, &[(0, 0), (1, 0), (0, 1), (1, 1)]);
        h.connection(&a, None, (0, 0, 0), opening(axis), 0.5);
        validate(h.input()).unwrap();
        let mut invalid = h.clone();
        invalid.cells.retain(|c| c.x != 1 || c.y != 1);
        // Remove the actual second support on this axis.
        invalid
            .cells
            .retain(|c| match invalid.connections[0].shape {
                ConnectionShape::Opening {
                    axis: Axis::Horizontal,
                    ..
                } => c.x != 1 || c.y != 0,
                _ => c.x != 0 || c.y != 1,
            });
        invalid.error("Öffnung liegt nicht vollständig auf einer gemeinsamen Wand");
        for offset in [-0.5, 0.25, 1.0, f64::NAN, f64::INFINITY] {
            let mut invalid = h.clone();
            invalid.connections[0].offset = offset;
            invalid.error("Ungültiger Öffnungsversatz");
        }
        h.connections[0].offset = 0.0;
        validate(h.input()).unwrap();
        h.connection(&a, None, (0, 0, 0), opening(Axis::Horizontal), 0.0);
        if matches!(
            h.connections[0].shape,
            ConnectionShape::Opening {
                axis: Axis::Horizontal,
                ..
            }
        ) {
            h.error("Überlappende Wandöffnungen");
        }
    }
    let mut h = House::new();
    let a = h.room(0, &[(0, 0), (1, 0)]);
    let b = h.room(0, &[(0, 1), (1, 1)]);
    h.connection(&a, Some(&b), (0, 0, 1), opening(Axis::Horizontal), 0.5);
    validate(h.input()).unwrap();
    h.connections[0].base.to_room = None;
    h.error("Opening does not match boundary");
    h.connections[0].base.to_room = Some(a);
    h.error("Invalid connection membership");
    let mut h = House::new();
    let a = h.room(0, &[(0, 0), (1, 0), (2, 0)]);
    h.connection(&a, None, (0, 0, 0), opening(Axis::Horizontal), 0.5);
    h.connection(&a, None, (0, 1, 0), opening(Axis::Horizontal), 0.0);
    h.error("Überlappende Wandöffnungen");
    h.connections[1].base.x = 2;
    validate(h.input()).unwrap();
    for coord in [i64::MIN, i64::MAX] {
        let mut invalid = h.clone();
        invalid.connections.truncate(1);
        invalid.connections[0].base.x = coord;
        invalid.error("Invalid connection metadata or coordinates");
    }
}

#[test]
fn stairs_cover_every_direction_floor_and_footprint_cell() {
    for (direction, dx, dy) in [
        (StairDirection::North, 0, -1),
        (StairDirection::East, 1, 0),
        (StairDirection::South, 0, 1),
        (StairDirection::West, -1, 0),
    ] {
        for length in [2, 3, 64] {
            let coords: Vec<_> = (0..i64::from(length)).map(|i| (i * dx, i * dy)).collect();
            let mut h = House::new();
            let a = h.room(-1, &coords);
            let b = h.room(0, &coords);
            h.connection(&a, Some(&b), (-1, 0, 0), stair(direction, length), 0.0);
            validate(h.input()).unwrap();
            let mut invalid = h.clone();
            invalid.connections[0].offset = 0.5;
            invalid.error("Öffnung liegt nicht vollständig auf einer gemeinsamen Wand");
            if length == 3 {
                // Remove an end to retain room connectivity while breaking a footprint.
                let mut invalid = h.clone();
                invalid
                    .cells
                    .retain(|c| c.floor != 0 || (c.x, c.y) != coords[2]);
                invalid.error("Stairs require occupied footprints");
                let mut invalid = h.clone();
                let third = invalid.room(0, &[(100, 100)]);
                invalid.connections[0].base.to_room = Some(third);
                invalid.error("Invalid stair room references");
                let mut invalid = h.clone();
                invalid
                    .cells
                    .retain(|c| c.floor != 0 || (c.x, c.y) != coords[2]);
                invalid.room(0, &[coords[2]]);
                invalid.error("Stair footprint must lie in one room per floor");
            }
        }
    }
    let mut h = House::new();
    let a = h.room(0, &[(0, 0), (1, 0)]);
    let b = h.room(1, &[(0, 0), (1, 0)]);
    let c = h.room(2, &[(0, 0), (1, 0)]);
    h.connection(&a, Some(&b), (0, 0, 0), stair(StairDirection::East, 2), 0.0);
    h.connection(&b, Some(&c), (1, 0, 0), stair(StairDirection::East, 2), 0.0);
    h.error(
        "UNIQUE constraint failed: stair_footprints.floor, stair_footprints.x, stair_footprints.y",
    );
    for length in [0, 1, 65, 255] {
        let mut invalid = h.clone();
        invalid.connections.truncate(1);
        invalid.connections[0].base.shape = stair(StairDirection::East, length);
        invalid.error("Invalid stair geometry");
    }
    let mut invalid = h.clone();
    invalid.connections.truncate(1);
    invalid.connections[0].base.floor = i32::MAX.into();
    invalid.error("Invalid stair floor");
    let mut invalid = h.clone();
    invalid.connections.truncate(1);
    invalid.connections[0].base.x = i64::MAX;
    invalid.error("Invalid stair coordinates");
}

#[test]
fn operation_indexes_keep_author_id_name_and_footprint_sets() {
    let mut h = House::new();
    let a = h.room(0, &[(0, 0), (1, 0)]);
    let b = h.room(1, &[(0, 0), (1, 0)]);
    h.connection(&a, Some(&b), (0, 0, 0), stair(StairDirection::East, 2), 0.0);
    let state = State::new(&h.input()).unwrap();
    assert!(state.room_names.contains("Room 0"));
    assert!(state.room_created.contains(&1));
    assert!(state.connection_created.contains(&0));
    assert_eq!(state.stair_footprints.len(), 4);
    assert_eq!(state.stair_footprints[&(1, 1, 0)], "connection-0");
    assert_eq!(state.room_cells["room-0"].len(), 2);
    assert_eq!(state.occupancy[&(1, 0, 0)], "room-1");
}
