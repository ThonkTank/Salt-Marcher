use super::*;

#[derive(Clone, Debug, PartialEq)]
pub(super) struct House {
    pub(super) rooms: Vec<Room>,
    pub(super) cells: Vec<Cell>,
    pub(super) connections: Vec<InteriorConnection>,
    pub(super) room_counter: i64,
    pub(super) connection_counter: i64,
}
impl House {
    pub(super) fn new() -> Self {
        Self {
            rooms: vec![],
            cells: vec![],
            connections: vec![],
            room_counter: 0,
            connection_counter: 0,
        }
    }
    pub(super) fn input(&self) -> InteriorInput<'_> {
        InteriorInput {
            house_id: "house",
            rooms: &self.rooms,
            cells: &self.cells,
            connections: &self.connections,
            room_counter: self.room_counter,
            connection_counter: self.connection_counter,
        }
    }
    pub(super) fn room(&mut self, floor: i64, cells: &[(i64, i64)]) -> String {
        let created = self.room_counter;
        let id = format!("room-{created}");
        self.rooms.push(Room {
            id: id.clone(),
            name: format!("Raum {}", created + 1),
            floor,
            building_id: "house".into(),
            created,
        });
        self.cells.extend(cells.iter().map(|&(x, y)| Cell {
            floor,
            x,
            y,
            room_id: id.clone(),
        }));
        self.room_counter += 1;
        id
    }
    pub(super) fn connection(
        &mut self,
        endpoints: (&str, Option<&str>),
        position: (i64, i64, i64),
        shape: ConnectionShape,
        offset: f64,
    ) {
        let (floor, x, y) = position;
        let created = self.connection_counter;
        self.connections.push(InteriorConnection {
            base: Connection {
                id: format!("connection-{created}"),
                created,
                from_room: endpoints.0.into(),
                to_room: endpoints.1.map(str::to_owned),
                floor,
                x,
                y,
                shape,
            },
            offset,
        });
        self.connection_counter += 1;
    }
    fn apply(&mut self, intent: LocalEdit) -> InteriorChange {
        let result = solve(self.input(), intent).unwrap();
        assert_eq!(result.cells_changed, result.cells != self.cells);
        assert_eq!(
            result.changed,
            result.rooms != self.rooms
                || result.cells != self.cells
                || result.connections != self.connections
                || result.room_counter != self.room_counter
                || result.connection_counter != self.connection_counter
        );
        self.rooms = result.rooms.clone();
        self.cells = result.cells.clone();
        self.connections = result.connections.clone();
        self.room_counter = result.room_counter;
        self.connection_counter = result.connection_counter;
        result
    }
    fn reject(&self, intent: LocalEdit, message: &str, category: InteriorErrorCategory) {
        let error = solve(self.input(), intent).err().unwrap();
        assert_eq!((error.message, error.category), (message.into(), category));
    }

    pub(super) fn edit_room(&mut self, intent: RoomIntent) -> InteriorChange {
        self.apply(LocalEdit::Room(intent))
    }
    pub(super) fn edit_connection(&mut self, intent: ConnectionIntent) -> InteriorChange {
        self.apply(LocalEdit::Connection(intent))
    }
    pub(super) fn room_error(
        &self,
        intent: RoomIntent,
        message: &str,
        category: InteriorErrorCategory,
    ) {
        self.reject(LocalEdit::Room(intent), message, category)
    }
    pub(super) fn connection_error(
        &self,
        intent: ConnectionIntent,
        message: &str,
        category: InteriorErrorCategory,
    ) {
        self.reject(LocalEdit::Connection(intent), message, category)
    }
}
