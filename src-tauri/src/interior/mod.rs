//! House-local author data and shared geometry; independent of either editor.
mod components;
mod connection_edit;
mod edit;
mod model;
mod room_edit;
mod stair_geometry;
mod state;
mod validation;
pub(crate) use components::cell_components;
pub use model::*;
pub(crate) fn solve(input: InteriorInput<'_>, edit: LocalEdit) -> Result<InteriorChange> {
    match edit {
        LocalEdit::Room(intent) => room_edit::solve(input, intent),
        LocalEdit::Connection(intent) => connection_edit::solve(input, intent),
    }
}
pub use stair_geometry::{StairDirection, StairGeometry, DEFAULT_STAIR_LENGTH};
pub(crate) use validation::{check_initial_structure, validate, validate_openings};

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum InteriorErrorCategory {
    InvalidInput,
    Storage,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum InteriorErrorOrigin {
    Local,
    OpeningValidation,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct InteriorError {
    pub(crate) origin: InteriorErrorOrigin,
    pub category: InteriorErrorCategory,
    pub message: String,
}
impl From<&str> for InteriorError {
    fn from(message: &str) -> Self {
        Self {
            category: InteriorErrorCategory::InvalidInput,
            origin: InteriorErrorOrigin::Local,
            message: message.into(),
        }
    }
}
impl std::fmt::Display for InteriorError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        self.message.fmt(f)
    }
}
impl std::error::Error for InteriorError {}
type Result<T> = std::result::Result<T, InteriorError>;

#[derive(Clone, Debug)]
pub(crate) enum LocalEdit {
    Room(RoomIntent),
    Connection(ConnectionIntent),
}
pub(crate) struct InteriorInput<'a> {
    pub house_id: &'a str,
    pub rooms: &'a [Room],
    pub cells: &'a [Cell],
    pub connections: &'a [InteriorConnection],
    pub room_counter: i64,
    pub connection_counter: i64,
}
pub(crate) struct InteriorChange {
    pub rooms: Vec<Room>,
    pub cells: Vec<Cell>,
    pub connections: Vec<InteriorConnection>,
    pub room_counter: i64,
    pub connection_counter: i64,
    pub changed: bool,
    pub cells_changed: bool,
}

#[cfg(test)]
mod contract_tests;

#[cfg(test)]
mod test_support;
