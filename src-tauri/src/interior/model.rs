use super::{StairDirection, StairGeometry, DEFAULT_STAIR_LENGTH};
use serde::{Deserialize, Serialize};

#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Room {
    pub id: String,
    pub name: String,
    pub floor: i64,
    pub building_id: String,
    pub created: i64,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Cell {
    pub floor: i64,
    pub x: i64,
    pub y: i64,
    pub room_id: String,
}
/// A vertical edge at (x,y) separates (x-1,y) and (x,y); horizontal separates (x,y-1) and (x,y).
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum Axis {
    Vertical,
    Horizontal,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ConnectionKind {
    Door,
    Passage,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(
    tag = "type",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum ConnectionShape {
    Opening {
        kind: ConnectionKind,
        axis: Axis,
    },
    Stairs {
        direction: StairDirection,
        length: u8,
    },
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Connection {
    pub id: String,
    pub created: i64,
    pub from_room: String,
    pub to_room: Option<String>,
    pub floor: i64,
    pub x: i64,
    pub y: i64,
    #[serde(flatten)]
    pub shape: ConnectionShape,
}
impl Connection {
    pub fn stair_geometry(&self) -> Option<StairGeometry> {
        match self.shape {
            ConnectionShape::Stairs { direction, length } => Some(StairGeometry {
                floor: self.floor,
                x: self.x,
                y: self.y,
                direction,
                length,
            }),
            _ => None,
        }
    }
}
/// An opening may start halfway along its anchor cell edge. Stairs always use zero.
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct InteriorConnection {
    #[serde(flatten)]
    pub base: Connection,
    pub offset: f64,
}
impl std::ops::Deref for InteriorConnection {
    type Target = Connection;
    fn deref(&self) -> &Self::Target {
        &self.base
    }
}

#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum RoomIntent {
    Draw {
        floor: i64,
        cells: Vec<(i64, i64)>,
    },
    Erase {
        floor: i64,
        cells: Vec<(i64, i64)>,
    },
    Assign {
        floor: i64,
        cells: Vec<(i64, i64)>,
        room_id: String,
    },
    Rename {
        room_id: String,
        name: String,
    },
    Move {
        room_id: String,
        dx: i64,
        dy: i64,
    },
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(
    tag = "action",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum ConnectionIntent {
    CreateOpening {
        floor: i64,
        x: i64,
        y: i64,
        axis: Axis,
        kind: ConnectionKind,
    },
    CreateStairs {
        floor: i64,
        x: i64,
        y: i64,
        direction: StairDirection,
        #[serde(default = "default_stair_length")]
        #[cfg_attr(test, ts(as = "Option<u8>", optional))]
        length: u8,
    },
    Convert {
        connection_id: String,
        kind: ConnectionKind,
    },
    Delete {
        connection_id: String,
    },
}

fn default_stair_length() -> u8 {
    DEFAULT_STAIR_LENGTH
}
