//! Structured generation results shared by preview and successful commit.
use super::{Point, Side};
use serde::{Deserialize, Serialize};
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum GenerationLimit {
    BoundParcels,
    NewHouses,
    NewCells,
    Attempts,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GenerationSummary {
    pub created_parcels: usize,
    pub created_houses: usize,
    pub empty_parcels: usize,
    pub skipped_parcels: usize,
    pub unplaced_houses: usize,
    pub limited: bool,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GenerationLocation {
    pub road_id: String,
    pub section_id: String,
    pub side: Side,
    pub slot_index: usize,
    pub point: Point,
    pub message: String,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum ParcelSkipCode {
    InvalidParcelGeometry,
    ParcelCollision,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum HouseUnplacedCode {
    NoGridFit,
    ClearanceBlocked,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(tag = "target", rename_all = "camelCase")]
pub enum GenerationDiagnostic {
    Parcel {
        #[serde(flatten)]
        location: GenerationLocation,
        code: ParcelSkipCode,
        #[serde(rename = "obstacleIds", skip_serializing_if = "Option::is_none")]
        #[cfg_attr(test, ts(optional))]
        obstacle_ids: Option<Vec<String>>,
    },
    House {
        #[serde(flatten)]
        location: GenerationLocation,
        code: HouseUnplacedCode,
        #[serde(rename = "parcelId")]
        parcel_id: String,
    },
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GenerationResponse {
    pub generation_summary: GenerationSummary,
    pub generation_diagnostics: Vec<GenerationDiagnostic>,
    pub generation_limit: Option<GenerationLimit>,
}
