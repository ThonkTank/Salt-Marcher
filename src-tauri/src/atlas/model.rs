//! Authoring and wire values; partial house reads cannot become full objects without cells.
use crate::atlas::errors::DomainIssue;
use crate::atlas::geometry::bounds;
use crate::atlas::geometry::expand;
use crate::atlas::plans::safe_proposed;
use crate::atlas::{generation, geometry, population};
use crate::interior::InteriorConnection;
use serde::{Deserialize, Serialize};
/// Continuous exterior feet. Local contour vertices use a distinct newtype.
pub type Point = [f64; 2];
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq)]
#[serde(transparent)]
pub struct LocalPoint(pub [f64; 2]);
pub type Bounds = [f64; 4];
pub(in crate::atlas) fn required_option<'de, D: serde::Deserializer<'de>, T: Deserialize<'de>>(
    d: D,
) -> std::result::Result<Option<T>, D::Error> {
    Option::<T>::deserialize(d)
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Transform {
    pub x: f64,
    pub y: f64,
    pub angle: f64,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Node {
    pub id: String,
    pub point: Point,
    #[serde(deserialize_with = "required_option")]
    pub incoming: Option<Point>,
    #[serde(deserialize_with = "required_option")]
    pub outgoing: Option<Point>,
}
/// Integral offsets in the parcel's five-foot grid; no arbitrary rotation.
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct GridPose {
    pub x_cells: i64,
    pub y_cells: i64,
    pub quarter_turns: QuarterTurns,
}
#[derive(Clone, Copy, Debug, PartialEq)]
#[cfg_attr(test, derive(ts_rs::TS))]
#[cfg_attr(test, ts(type = "0 | 1 | 2 | 3"))]
pub struct QuarterTurns(pub u8);
impl Serialize for QuarterTurns {
    fn serialize<S: serde::Serializer>(&self, s: S) -> std::result::Result<S::Ok, S::Error> {
        s.serialize_u8(self.0)
    }
}
impl<'de> Deserialize<'de> for QuarterTurns {
    fn deserialize<D: serde::Deserializer<'de>>(d: D) -> std::result::Result<Self, D::Error> {
        let value = u8::deserialize(d)?;
        if value <= 3 {
            Ok(Self(value))
        } else {
            Err(serde::de::Error::custom("quarterTurns must be 0..3"))
        }
    }
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(tag = "kind", rename_all = "camelCase", deny_unknown_fields)]
pub enum Placement {
    Free {},
    Parcel {
        #[serde(rename = "parcelId")]
        parcel_id: String,
        #[serde(rename = "gridPose")]
        grid_pose: GridPose,
    },
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "camelCase")]
pub enum Side {
    Left,
    Right,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(tag = "kind", rename_all = "camelCase", deny_unknown_fields)]
pub enum ParcelSource {
    Road {
        #[serde(rename = "roadId")]
        road_id: String,
        #[serde(rename = "sectionId")]
        section_id: String,
        side: Side,
        start: f64,
        end: f64,
        setback: f64,
        depth: f64,
    },
    Detached {},
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Parcel {
    pub id: String,
    pub source: ParcelSource,
    pub polygon: Vec<Point>,
    pub frame: Transform,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RoadSection {
    pub id: String,
    pub populated_sides: Vec<Side>,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PopulationRecipe {
    pub settings: population::Settings,
    pub algorithm_version: AlgorithmVersion,
}
#[derive(Clone, Copy, Debug, PartialEq)]
#[cfg_attr(test, derive(ts_rs::TS))]
#[cfg_attr(test, ts(type = "3"))]
pub struct AlgorithmVersion;
impl Serialize for AlgorithmVersion {
    fn serialize<S: serde::Serializer>(&self, s: S) -> std::result::Result<S::Ok, S::Error> {
        s.serialize_u8(3)
    }
}
impl<'de> Deserialize<'de> for AlgorithmVersion {
    fn deserialize<D: serde::Deserializer<'de>>(d: D) -> std::result::Result<Self, D::Error> {
        if u8::deserialize(d)? == 3 {
            Ok(Self)
        } else {
            Err(serde::de::Error::custom("algorithmVersion must be 3"))
        }
    }
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(tag = "kind", rename_all = "camelCase", deny_unknown_fields)]
pub enum EditorContext {
    Exterior {},
    House {
        #[serde(rename = "houseId")]
        house_id: String,
    },
    Parcel {
        #[serde(rename = "parcelId")]
        parcel_id: String,
    },
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OwnerState {
    pub exists: bool,
    pub parcel_id: Option<String>,
    pub house_id: Option<String>,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FullHouse {
    pub id: String,
    pub name: String,
    pub roof: String,
    pub important_place: bool,
    pub foundation: super::terrain::Foundation,
    pub transform: Transform,
    pub contours: Vec<Vec<LocalPoint>>,
    pub placement: Placement,
    pub occupancy_contours: Vec<Vec<LocalPoint>>,
    pub occupancy_bounds: Bounds,
    pub room_counter: i64,
    pub connection_counter: i64,
    pub rooms: Vec<crate::interior::Room>,
    pub connections: Vec<InteriorConnection>,
    pub cells: Vec<crate::interior::Cell>,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum RoadMaterial {
    Earth,
    Stone,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Road {
    pub id: String,
    pub name: String,
    pub width: f64,
    pub material: RoadMaterial,
    pub nodes: Vec<Node>,
    pub path: Vec<Point>,
    pub edge_sections: Vec<String>,
    pub sections: Vec<RoadSection>,
    pub population_recipe: Option<PopulationRecipe>,
}
// Command DTOs contain only user-authored values. Stored geometry and identities
// are constructed by the action allocator, never supplied by create commands.
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct NewRoadInput {
    pub name: String,
    pub width: f64,
    pub material: RoadMaterial,
    pub nodes: Vec<NodeInput>,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ExistingNodeInput {
    pub id: String,
    pub point: Point,
    #[serde(deserialize_with = "required_option")]
    pub incoming: Option<Point>,
    #[serde(deserialize_with = "required_option")]
    pub outgoing: Option<Point>,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RoadEditInput {
    pub name: String,
    pub width: f64,
    pub material: RoadMaterial,
    pub nodes: Vec<ExistingNodeInput>,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AreaInput {
    pub material: String,
    pub points: Vec<Point>,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Area {
    pub id: String,
    pub material: String,
    pub points: Vec<Point>,
    pub order: u64,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum FullObject {
    House(FullHouse),
    Road(Road),
    Area(Area),
    Scenery(super::scenery::Scenery),
    Parcel(Parcel),
}
impl FullObject {
    pub(in crate::atlas) fn id(&self) -> &str {
        match self {
            Self::House(h) => &h.id,
            Self::Road(r) => &r.id,
            Self::Area(a) => &a.id,
            Self::Scenery(s) => &s.id,
            Self::Parcel(p) => &p.id,
        }
    }
    pub(in crate::atlas) fn kind(&self) -> &str {
        match self {
            Self::House(_) => "house",
            Self::Road(_) => "road",
            Self::Area(_) => "area",
            Self::Scenery(_) => "scenery",
            Self::Parcel(_) => "parcel",
        }
    }
    pub(in crate::atlas) fn bounds(&self) -> Bounds {
        match self {
            Self::House(h) => geometry::house_render_bounds(&h.contours, &h.transform),
            Self::Road(r) => expand(bounds(r.path.iter().copied()), r.width / 2.0),
            Self::Area(a) => bounds(a.points.iter().copied()),
            Self::Scenery(s) => s.bounds(),
            Self::Parcel(p) => bounds(p.polygon.iter().copied()),
        }
    }
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Version {
    pub session_id: String,
    pub revision: i64,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChangeHints {
    pub world: Vec<Bounds>,
    pub interiors: Vec<InteriorRegion>,
    pub metadata: Vec<String>,
    pub relations: Vec<String>,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InteriorRegion {
    pub building_id: String,
    pub floor: i64,
    /// Inclusive local cell bounds covering changed coordinates on this floor.
    pub bounds: Bounds,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    pub session_id: String,
    pub revision: i64,
    pub path: Option<String>,
    pub dirty: bool,
    pub can_undo: bool,
    pub can_redo: bool,
    pub changes: Option<ChangeHints>,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(in crate::atlas) struct InteriorMetadataArgs {
    pub(in crate::atlas) building_id: String,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(in crate::atlas) struct InteriorTileArgs {
    pub(in crate::atlas) building_id: String,
    pub(in crate::atlas) floor: i64,
    pub(in crate::atlas) bounds: Bounds,
    pub(in crate::atlas) include_lower: bool,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(in crate::atlas) struct SceneArgs {
    pub(in crate::atlas) bounds: Bounds,
    pub(in crate::atlas) context: EditorContext,
    #[cfg_attr(test, ts(optional = nullable))]
    pub(in crate::atlas) selected_id: Option<String>,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Deserialize)]
pub(in crate::atlas) struct EditArgs {
    pub(in crate::atlas) version: Version,
    pub(in crate::atlas) intent: Intent,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Deserialize)]
pub(in crate::atlas) struct HistoryArgs {
    pub(in crate::atlas) version: Version,
    #[serde(default)]
    #[cfg_attr(test, ts(as = "Option<bool>", optional))]
    pub(in crate::atlas) redo: bool,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Deserialize)]
pub(in crate::atlas) struct PathArgs {
    pub(in crate::atlas) path: String,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(in crate::atlas) struct DetailArgs {
    pub(in crate::atlas) building_id: String,
    pub(in crate::atlas) floor: i64,
    pub(in crate::atlas) bounds: Bounds,
}

#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(in crate::atlas) struct InteriorMetadataResponse {
    pub(in crate::atlas) status: Status,
    pub(in crate::atlas) building_id: String,
    pub(in crate::atlas) rooms: Vec<crate::interior::Room>,
    pub(in crate::atlas) connections: Vec<InteriorConnection>,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(in crate::atlas) struct InteriorTileResponse {
    pub(in crate::atlas) status: Status,
    pub(in crate::atlas) building_id: String,
    pub(in crate::atlas) floor: i64,
    pub(in crate::atlas) bounds: Bounds,
    pub(in crate::atlas) include_lower: bool,
    pub(in crate::atlas) cells: Vec<crate::interior::Cell>,
    pub(in crate::atlas) lower: Vec<crate::interior::Cell>,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(in crate::atlas) struct HouseHeader {
    pub(in crate::atlas) id: String,
    pub(in crate::atlas) name: String,
    pub(in crate::atlas) roof: String,
    pub(in crate::atlas) important_place: bool,
    pub foundation: super::terrain::Foundation,
    pub(in crate::atlas) transform: Transform,
    pub(in crate::atlas) contours: Vec<Vec<LocalPoint>>,
    pub(in crate::atlas) placement: Placement,
    pub(in crate::atlas) occupancy_contours: Vec<Vec<LocalPoint>>,
    pub(in crate::atlas) occupancy_bounds: Bounds,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(in crate::atlas) struct InteriorMetadata {
    pub(in crate::atlas) rooms: Vec<crate::interior::Room>,
    pub(in crate::atlas) connections: Vec<InteriorConnection>,
    pub(in crate::atlas) room_counter: i64,
    pub(in crate::atlas) connection_counter: i64,
}
// A partial read has no serialization or full-object conversion: only the
// assembler can combine it with the separately loaded cell payload.
pub(in crate::atlas) struct HouseParts {
    pub(in crate::atlas) header: HouseHeader,
    pub(in crate::atlas) metadata: InteriorMetadata,
}
impl FullHouse {
    pub(in crate::atlas) fn header(&self) -> HouseHeader {
        HouseHeader {
            id: self.id.clone(),
            name: self.name.clone(),
            roof: self.roof.clone(),
            important_place: self.important_place,
            foundation: self.foundation.clone(),
            transform: self.transform.clone(),
            contours: self.contours.clone(),
            placement: self.placement.clone(),
            occupancy_contours: self.occupancy_contours.clone(),
            occupancy_bounds: self.occupancy_bounds,
        }
    }
    pub(in crate::atlas) fn metadata(&self) -> InteriorMetadata {
        InteriorMetadata {
            rooms: self.rooms.clone(),
            connections: self.connections.clone(),
            room_counter: self.room_counter,
            connection_counter: self.connection_counter,
        }
    }
}
impl HouseParts {
    pub(in crate::atlas) fn assemble(self, cells: Vec<crate::interior::Cell>) -> FullHouse {
        let HouseHeader {
            id,
            name,
            roof,
            important_place,
            foundation,
            transform,
            contours,
            placement,
            occupancy_contours,
            occupancy_bounds,
        } = self.header;
        let InteriorMetadata {
            rooms,
            connections,
            room_counter,
            connection_counter,
        } = self.metadata;
        FullHouse {
            id,
            name,
            roof,
            important_place,
            foundation,
            transform,
            contours,
            placement,
            occupancy_contours,
            occupancy_bounds,
            rooms,
            connections,
            room_counter,
            connection_counter,
            cells,
        }
    }
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub(in crate::atlas) enum SceneObject {
    House(HouseHeader),
    Road(Road),
    Area(Area),
    Scenery(super::scenery::Scenery),
    Parcel(Parcel),
}
impl SceneObject {
    pub(in crate::atlas) fn id(&self) -> &str {
        match self {
            Self::House(h) => &h.id,
            Self::Road(r) => &r.id,
            Self::Area(a) => &a.id,
            Self::Scenery(s) => &s.id,
            Self::Parcel(p) => &p.id,
        }
    }
    pub(in crate::atlas) fn bounds(&self) -> Bounds {
        match self {
            Self::House(h) => geometry::house_render_bounds(&h.contours, &h.transform),
            Self::Road(r) => expand(bounds(r.path.iter().copied()), r.width / 2.0),
            Self::Area(a) => bounds(a.points.iter().copied()),
            Self::Scenery(s) => s.bounds(),
            Self::Parcel(p) => bounds(p.polygon.iter().copied()),
        }
    }
}
impl From<&FullObject> for SceneObject {
    fn from(o: &FullObject) -> Self {
        match o {
            FullObject::House(h) => Self::House(h.header()),
            FullObject::Road(r) => Self::Road(r.clone()),
            FullObject::Area(a) => Self::Area(a.clone()),
            FullObject::Scenery(s) => Self::Scenery(s.clone()),
            FullObject::Parcel(p) => Self::Parcel(p.clone()),
        }
    }
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(in crate::atlas) struct SceneResponse {
    pub(in crate::atlas) context_state: OwnerState,
    pub(in crate::atlas) selection_state: OwnerState,
    pub(in crate::atlas) status: Status,
    pub(in crate::atlas) objects: Vec<SceneObject>,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(in crate::atlas) struct RemovedConnection {
    pub(in crate::atlas) building_id: String,
    pub(in crate::atlas) connection: InteriorConnection,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Default, Serialize)]
pub(in crate::atlas) struct CascadeCounts {
    pub(in crate::atlas) roads: usize,
    pub(in crate::atlas) parcels: usize,
    pub(in crate::atlas) houses: usize,
    pub(in crate::atlas) rooms: usize,
    pub(in crate::atlas) connections: usize,
}
#[derive(Default)]
pub(in crate::atlas) struct PlanDiagnostics {
    pub(in crate::atlas) proposed: Vec<SceneObject>,
    pub(in crate::atlas) generation: generation::GenerationResponse,
}
impl PlanDiagnostics {
    pub(in crate::atlas) fn replace_proposed(
        &mut self,
        objects: impl IntoIterator<Item = SceneObject>,
    ) {
        self.proposed = objects.into_iter().filter(safe_proposed).collect();
    }
    pub(in crate::atlas) fn push_proposed(&mut self, object: SceneObject) {
        if safe_proposed(&object) {
            self.proposed.push(object);
        }
    }
}
// These owned responses are the actual JSON representation. Both Serde and the
// development-only TypeScript exporter derive their field layout from here.
#[cfg_attr(test, derive(ts_rs::TS))]
#[cfg_attr(test, ts(type = "true"))]
pub(in crate::atlas) struct True;
impl Serialize for True {
    fn serialize<S: serde::Serializer>(
        &self,
        serializer: S,
    ) -> std::result::Result<S::Ok, S::Error> {
        serializer.serialize_bool(true)
    }
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[cfg_attr(test, ts(type = "false"))]
pub(in crate::atlas) struct False;
impl Serialize for False {
    fn serialize<S: serde::Serializer>(
        &self,
        serializer: S,
    ) -> std::result::Result<S::Ok, S::Error> {
        serializer.serialize_bool(false)
    }
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(in crate::atlas) struct ValidPreviewWire {
    pub(in crate::atlas) valid: True,
    pub(in crate::atlas) version: Version,
    pub(in crate::atlas) status: Box<Status>,
    pub(in crate::atlas) objects: Vec<SceneObject>,
    pub(in crate::atlas) removed: Vec<String>,
    pub(in crate::atlas) deleted_ids: Vec<String>,
    pub(in crate::atlas) cascade_counts: CascadeCounts,
    #[serde(flatten)]
    pub(in crate::atlas) generation: generation::GenerationResponse,
    pub(in crate::atlas) removed_connections: Vec<RemovedConnection>,
    pub(in crate::atlas) changed: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[cfg_attr(test, ts(optional))]
    pub(in crate::atlas) terrain: Option<Box<super::terrain::TerrainPreview>>,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(in crate::atlas) struct InvalidPreviewWire {
    pub(in crate::atlas) valid: False,
    pub(in crate::atlas) version: Version,
    pub(in crate::atlas) reason: String,
    pub(in crate::atlas) proposed_objects: Vec<SceneObject>,
    pub(in crate::atlas) issues: [DomainIssue; 1],
    pub(in crate::atlas) objects: [SceneObject; 0],
    pub(in crate::atlas) removed: [String; 0],
    #[serde(flatten)]
    pub(in crate::atlas) generation: generation::GenerationResponse,
    pub(in crate::atlas) changed: False,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Serialize)]
#[serde(untagged)]
pub(in crate::atlas) enum PreviewWire {
    Valid(ValidPreviewWire),
    Invalid(InvalidPreviewWire),
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RoadRoughness {
    pub amount: f64,
    pub seed: u32,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(in crate::atlas) struct ObjectHeaderArgs {
    pub id: String,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(in crate::atlas) struct RoadHeaderArgs {
    pub road_id: String,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase", deny_unknown_fields)]
pub enum Intent {
    SceneryStroke {
        brush: super::scenery::SceneryBrush,
    },
    TerrainStroke {
        brush: super::terrain::Brush,
        #[serde(default)]
        #[cfg_attr(test, ts(optional))]
        view: Option<super::terrain::TerrainArgs>,
    },
    SetWaterLevel {
        level: f64,
        #[serde(default)]
        #[cfg_attr(test, ts(optional))]
        view: Option<super::terrain::TerrainArgs>,
    },
    SetFoundation {
        id: String,
        foundation: super::terrain::Foundation,
    },
    CreateRoad {
        road: NewRoadInput,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        #[cfg_attr(test, ts(optional))]
        roughness: Option<RoadRoughness>,
        #[serde(deserialize_with = "required_option")]
        population: Option<population::Settings>,
    },
    UpdateRoad {
        #[serde(rename = "roadId")]
        road_id: String,
        road: RoadEditInput,
    },
    RoughenRoad {
        #[serde(rename = "roadId")]
        road_id: String,
        roughness: RoadRoughness,
    },
    InsertRoadNode {
        #[serde(rename = "roadId")]
        road_id: String,
        #[serde(rename = "afterNodeId")]
        after_node_id: String,
        t: f64,
    },
    DeleteRoadNode {
        #[serde(rename = "roadId")]
        road_id: String,
        #[serde(rename = "nodeId")]
        node_id: String,
    },
    ExtendRoad {
        #[serde(rename = "roadId")]
        road_id: String,
        end: RoadEnd,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        #[cfg_attr(test, ts(optional))]
        roughness: Option<RoadRoughness>,
        nodes: Vec<NodeInput>,
        #[serde(rename = "endpointHandle", deserialize_with = "required_option")]
        endpoint_handle: Option<Point>,
        #[serde(deserialize_with = "required_option")]
        population: Option<population::Settings>,
    },
    CreateParcelHouse {
        #[serde(rename = "parcelId")]
        parcel_id: String,
        floor: i64,
        cells: Vec<[i64; 2]>,
    },
    UpdateParcel {
        id: String,
        start: f64,
        end: f64,
        setback: f64,
        depth: f64,
    },
    DetachParcel {
        id: String,
    },
    CreateArea {
        area: AreaInput,
    },
    UpdateArea {
        #[serde(rename = "areaId")]
        area_id: String,
        area: AreaInput,
    },
    CreateHouse {
        transform: Transform,
        width: u32,
        depth: u32,
        #[serde(rename = "parcelId", deserialize_with = "required_option")]
        parcel_id: Option<String>,
    },
    TransformHouse {
        id: String,
        transform: Transform,
    },
    Rename {
        id: String,
        name: String,
    },
    Roof {
        id: String,
        roof: String,
    },
    ImportantPlace {
        id: String,
        value: bool,
    },
    Delete {
        id: String,
    },
    Room {
        #[serde(rename = "buildingId")]
        building_id: String,
        intent: crate::interior::RoomIntent,
    },
    Connection {
        #[serde(rename = "buildingId")]
        building_id: String,
        intent: crate::interior::ConnectionIntent,
    },
    Populate {
        #[serde(rename = "roadId")]
        road_id: String,
        settings: population::Settings,
    },
}
impl Intent {
    pub(in crate::atlas) fn object_ids(&self) -> Vec<String> {
        match self {
            Self::SceneryStroke { .. }
            | Self::TerrainStroke { .. }
            | Self::SetWaterLevel { .. }
            | Self::CreateRoad { .. }
            | Self::CreateArea { .. } => vec![],
            Self::SetFoundation { id, .. } => vec![id.clone()],
            Self::UpdateRoad { road_id, .. } | Self::RoughenRoad { road_id, .. } => {
                vec![road_id.clone()]
            }
            Self::UpdateArea { area_id, .. } => vec![area_id.clone()],
            Self::TransformHouse { id, .. }
            | Self::Rename { id, .. }
            | Self::Roof { id, .. }
            | Self::ImportantPlace { id, .. }
            | Self::Delete { id }
            | Self::UpdateParcel { id, .. }
            | Self::DetachParcel { id } => vec![id.clone()],
            Self::Room { building_id, .. } | Self::Connection { building_id, .. } => {
                vec![building_id.clone()]
            }
            Self::CreateParcelHouse { parcel_id, .. } => vec![parcel_id.clone()],
            Self::CreateHouse { parcel_id, .. } => parcel_id.iter().cloned().collect(),
            Self::InsertRoadNode {
                road_id,
                after_node_id,
                ..
            } => vec![road_id.clone(), after_node_id.clone()],
            Self::DeleteRoadNode { road_id, node_id } => vec![road_id.clone(), node_id.clone()],
            Self::ExtendRoad { road_id, .. } | Self::Populate { road_id, .. } => {
                vec![road_id.clone()]
            }
        }
        .into_iter()
        .filter(|id| !id.is_empty())
        .collect()
    }
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum RoadEnd {
    Start,
    End,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct NodeInput {
    pub point: Point,
    #[serde(deserialize_with = "required_option")]
    pub incoming: Option<Point>,
    #[serde(deserialize_with = "required_option")]
    pub outgoing: Option<Point>,
}
pub(in crate::atlas) fn placement_owner(p: &Placement) -> Option<&str> {
    match p {
        Placement::Free {} => None,
        Placement::Parcel { parcel_id, .. } => Some(parcel_id),
    }
}

#[cfg_attr(test, derive(ts_rs::TS))]
#[cfg_attr(test, ts(type = "Record<string, never>"))]
#[derive(Deserialize)]
pub(in crate::atlas) struct EmptyArgs {}

#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Serialize)]
pub(in crate::atlas) struct DetailResponse {
    #[serde(flatten)]
    pub(in crate::atlas) tile: InteriorTileResponse,
    pub(in crate::atlas) rooms: Vec<crate::interior::Room>,
    pub(in crate::atlas) connections: Vec<InteriorConnection>,
}
