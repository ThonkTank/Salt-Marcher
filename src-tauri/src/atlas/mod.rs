//! Atlas V7: continuous exterior geometry, explicitly owned local interiors.
mod application;
mod change;
mod change_hints;
mod errors;
pub mod generation;
mod geometry;
mod interior;
mod model;
mod operations;
pub mod parcel_geometry;
mod plan_context;
mod plans;
pub mod population;
mod reads;
mod road_roughness;
mod scenery;
mod terrain;
mod validation;
pub use application::AtlasApplication;
pub use errors::{AppError, DomainIssue, DomainViolation, ErrorCategory, IssueCode, IssueGeometry};
pub use model::{
    AlgorithmVersion, Area, AreaInput, Bounds, ChangeHints, EditorContext, ExistingNodeInput,
    FullHouse, FullObject, GridPose, Intent, InteriorRegion, LocalPoint, NewRoadInput, Node,
    NodeInput, OwnerState, Parcel, ParcelSource, Placement, Point, PopulationRecipe, QuarterTurns,
    Road, RoadEditInput, RoadEnd, RoadMaterial, RoadSection, Side, Status, Transform, Version,
};
pub type Result<T> = std::result::Result<T, AppError>;
#[cfg(test)]
mod test_inputs;
#[cfg(test)]
mod transport_contract_tests;
