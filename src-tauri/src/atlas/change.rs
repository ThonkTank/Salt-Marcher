//! Operation-local allocation, computed plans and existing history values. No document owner.
use crate::atlas::errors::invalid;
use crate::atlas::model::{FullObject, HouseHeader, Placement, SceneObject, Transform};
use crate::atlas::{generation, Result};
use serde::{Deserialize, Serialize};
/// Action-local reservation. Only a successful non-noop SQL transaction persists next.
pub(in crate::atlas) struct ActionAllocator {
    pub(in crate::atlas) next: i64,
}
impl ActionAllocator {
    pub(in crate::atlas) fn allocate(&mut self, prefix: &str) -> Result<String> {
        let current = self.next;
        self.next = current
            .checked_add(1)
            .ok_or_else(|| invalid("Identitäten erschöpft"))?;
        Ok(format!("{prefix}-{current}"))
    }
}
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub(in crate::atlas) struct Delta {
    pub(in crate::atlas) before: Vec<FullObject>,
    pub(in crate::atlas) after: Vec<FullObject>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub(in crate::atlas) enum SmallPatch {
    Foundation {
        id: String,
        before: super::terrain::Foundation,
        after: super::terrain::Foundation,
    },
    HouseName {
        id: String,
        before: String,
        after: String,
    },
    Roof {
        id: String,
        before: String,
        after: String,
    },
    ImportantPlace {
        id: String,
        before: bool,
        after: bool,
    },
    RoomName {
        id: String,
        room_id: String,
        before: String,
        after: String,
    },
    Transform {
        id: String,
        before: HousePose,
        after: HousePose,
    },
}
impl SmallPatch {
    pub fn id(&self) -> &str {
        match self {
            Self::Foundation { id, .. }
            | Self::HouseName { id, .. }
            | Self::Roof { id, .. }
            | Self::ImportantPlace { id, .. }
            | Self::RoomName { id, .. }
            | Self::Transform { id, .. } => id,
        }
    }
    fn is_empty(&self) -> bool {
        match self {
            Self::HouseName { before, after, .. }
            | Self::Roof { before, after, .. }
            | Self::RoomName { before, after, .. } => before == after,
            Self::Foundation { before, after, .. } => before == after,
            Self::ImportantPlace { before, after, .. } => before == after,
            Self::Transform { before, after, .. } => before == after,
        }
    }
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub(in crate::atlas) struct HousePose {
    pub(in crate::atlas) transform: Transform,
    pub(in crate::atlas) placement: Placement,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub(in crate::atlas) struct History<C = ChangeSet> {
    pub(in crate::atlas) change: C,
    pub(in crate::atlas) before_state: u64,
    pub(in crate::atlas) after_state: u64,
}
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub(in crate::atlas) struct ChangeSet {
    pub(in crate::atlas) waters: Option<super::water::WaterDelta>,
    pub(in crate::atlas) rivers: Option<super::rivers::RiverDelta>,
    pub(in crate::atlas) geometry: Delta,
    pub(in crate::atlas) fields: Vec<SmallPatch>,
    pub(in crate::atlas) world_terrain:
        Option<super::application::world_terrain_store::WorldTerrainDelta>,
    pub(in crate::atlas) terrain: Option<super::terrain::TerrainDelta>,
    pub(in crate::atlas) ground: Option<super::ground::GroundDelta>,
    pub(in crate::atlas) regions: Option<super::regions::RegionDelta>,
}
impl ChangeSet {
    pub(in crate::atlas) fn is_empty(&self) -> bool {
        self.waters.is_none()
            && self.rivers.is_none()
            && self.regions.is_none()
            && self.ground.is_none()
            && self.terrain.is_none()
            && self.world_terrain.is_none()
            && self.geometry.before.is_empty()
            && self.geometry.after.is_empty()
            && self.fields.is_empty()
    }
}
pub(in crate::atlas) struct FieldChange {
    pub(in crate::atlas) patch: SmallPatch,
    pub(in crate::atlas) before: HouseHeader,
    pub(in crate::atlas) after: HouseHeader,
}
#[derive(Default)]
pub(in crate::atlas) struct Computed {
    pub river_preview: Option<super::rivers::RiverDelta>,
    pub ground_preview: Option<super::ground::GroundResponse>,
    pub region_preview: Option<Vec<super::regions::Region>>,
    pub terrain_preview: Option<super::terrain::TerrainPreview>,
    pub(in crate::atlas) change: ChangeSet,
    pub(in crate::atlas) headers: Vec<(HouseHeader, HouseHeader)>,
    pub(in crate::atlas) generation: generation::GenerationResponse,
    pub(in crate::atlas) next_identity: Option<i64>,
}
impl Computed {
    pub(in crate::atlas) fn geometry(delta: Delta) -> Self {
        let mut computed = Self::default();
        if delta.before != delta.after {
            computed.change.geometry = delta;
        }
        computed
    }
    pub(in crate::atlas) fn fields(
        patch: SmallPatch,
        before: HouseHeader,
        after: HouseHeader,
    ) -> Self {
        let mut computed = Self::default();
        if !patch.is_empty() {
            computed.change.fields.push(patch);
            computed.headers.push((before, after));
        }
        computed
    }
    pub(in crate::atlas) fn terrain(
        delta: super::terrain::TerrainDelta,
        preview: super::terrain::TerrainPreview,
    ) -> Self {
        let mut computed = Self {
            terrain_preview: Some(preview),
            ..Self::default()
        };
        if delta.before != delta.after {
            computed.change.terrain = Some(delta);
        }
        computed
    }
}

/// One operation owns allocation and all proposed changes until validation succeeds.
pub(in crate::atlas) struct EditPlan {
    pub delta: Delta,
    pub fields: Vec<FieldChange>,
    pub allocator: ActionAllocator,
}
impl EditPlan {
    pub fn new(allocator: ActionAllocator) -> Self {
        Self {
            delta: Delta::default(),
            fields: vec![],
            allocator,
        }
    }
    pub fn change_pose(&mut self, before: HouseHeader, after: HouseHeader) {
        if before == after {
            return;
        }
        self.fields.push(FieldChange {
            patch: SmallPatch::Transform {
                id: before.id.clone(),
                before: HousePose {
                    transform: before.transform.clone(),
                    placement: before.placement.clone(),
                },
                after: HousePose {
                    transform: after.transform.clone(),
                    placement: after.placement.clone(),
                },
            },
            before,
            after,
        });
    }
    pub fn before_ids(&self) -> impl Iterator<Item = &str> {
        self.delta
            .before
            .iter()
            .map(FullObject::id)
            .chain(self.fields.iter().map(|f| f.before.id.as_str()))
    }
    pub fn after_headers(&self) -> Vec<SceneObject> {
        self.delta
            .after
            .iter()
            .map(SceneObject::from)
            .chain(
                self.fields
                    .iter()
                    .map(|f| SceneObject::House(f.after.clone())),
            )
            .collect()
    }
    pub fn finish(self, generation: generation::GenerationResponse) -> Computed {
        let mut computed = Computed::geometry(self.delta);
        for field in self.fields {
            computed.change.fields.push(field.patch);
            computed.headers.push((field.before, field.after));
        }
        computed.next_identity = Some(self.allocator.next);
        computed.generation = generation;
        computed
    }
}
