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
#[derive(Clone, Debug, Serialize, Deserialize)]
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
    pub(in crate::atlas) geometry: Delta,
    pub(in crate::atlas) fields: Vec<SmallPatch>,
}
impl ChangeSet {
    pub(in crate::atlas) fn is_empty(&self) -> bool {
        self.geometry.before.is_empty() && self.geometry.after.is_empty() && self.fields.is_empty()
    }
}
pub(in crate::atlas) struct FieldChange {
    pub(in crate::atlas) patch: SmallPatch,
    pub(in crate::atlas) before: HouseHeader,
    pub(in crate::atlas) after: HouseHeader,
}
pub(in crate::atlas) struct Computed {
    pub(in crate::atlas) change: ChangeSet,
    pub(in crate::atlas) headers: Vec<(HouseHeader, HouseHeader)>,
    pub(in crate::atlas) generation: generation::GenerationResponse,
    pub(in crate::atlas) next_identity: Option<i64>,
}
impl Computed {
    pub(in crate::atlas) fn geometry(delta: Delta) -> Self {
        Self {
            change: ChangeSet {
                geometry: if delta.before == delta.after {
                    Delta::default()
                } else {
                    delta
                },
                fields: vec![],
            },
            headers: vec![],
            generation: generation::GenerationResponse::default(),
            next_identity: None,
        }
    }
    pub(in crate::atlas) fn fields(
        patch: SmallPatch,
        before: HouseHeader,
        after: HouseHeader,
    ) -> Self {
        Self {
            change: ChangeSet {
                geometry: Delta::default(),
                fields: vec![patch],
            },
            headers: vec![(before, after)],
            generation: generation::GenerationResponse::default(),
            next_identity: None,
        }
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
