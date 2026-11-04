//! Pure, ordered invalidation projections from geometry deltas and field patches.
use crate::atlas::change::SmallPatch;
use crate::atlas::model::{
    placement_owner, Bounds, ChangeHints, FullHouse, FullObject, InteriorRegion, ParcelSource,
    Placement, SceneObject,
};
use std::collections::HashMap;
pub(in crate::atlas) fn from_objects(before: &[FullObject], after: &[FullObject]) -> ChangeHints {
    let mut out = ChangeHints::default();
    // Stable invalidation order across previews, history and independent processes.
    let ids: std::collections::BTreeSet<_> =
        before.iter().chain(after).map(FullObject::id).collect();
    for id in ids {
        let a = before.iter().find(|o| o.id() == id);
        let b = after.iter().find(|o| o.id() == id);
        if a.map(SceneObject::from) != b.map(SceneObject::from) {
            if let Some(o) = a {
                out.world.push(o.bounds());
            }
            if let Some(o) = b {
                out.world.push(o.bounds());
            }
        }
        let old = match a {
            Some(FullObject::House(h)) => Some(h),
            _ => None,
        };
        let new = match b {
            Some(FullObject::House(h)) => Some(h),
            _ => None,
        };
        if old.map(|h| placement_owner(&h.placement)) != new.map(|h| placement_owner(&h.placement))
        {
            out.relations.push(id.to_owned());
            for house in [old, new].into_iter().flatten() {
                if let Placement::Parcel { parcel_id, .. } = &house.placement {
                    out.relations.push(parcel_id.clone());
                }
            }
        }
        let parcel_a = match a {
            Some(FullObject::Parcel(p)) => Some(p),
            _ => None,
        };
        let parcel_b = match b {
            Some(FullObject::Parcel(p)) => Some(p),
            _ => None,
        };
        if parcel_a.map(|p| &p.source) != parcel_b.map(|p| &p.source) {
            out.relations.push(id.to_owned());
            for parcel in [parcel_a, parcel_b].into_iter().flatten() {
                if let ParcelSource::Road { road_id, .. } = &parcel.source {
                    out.relations.push(road_id.clone());
                }
            }
        }
        if matches!(
            (a, b),
            (Some(FullObject::Road(_)), None) | (None, Some(FullObject::Road(_)))
        ) {
            out.relations.push(id.to_owned());
        }
        if old.is_some() || new.is_some() {
            let metadata_changed = match (old, new) {
                (Some(a), Some(b)) => {
                    a.rooms != b.rooms
                        || a.connections != b.connections
                        || a.room_counter != b.room_counter
                        || a.connection_counter != b.connection_counter
                }
                _ => true,
            };
            if metadata_changed {
                out.metadata.push(id.to_owned());
            }
            fn cells(house: Option<&FullHouse>) -> HashMap<(i64, i64, i64), &str> {
                house
                    .into_iter()
                    .flat_map(|h| &h.cells)
                    .map(|c| ((c.floor, c.x, c.y), c.room_id.as_str()))
                    .collect()
            }
            let old_cells = cells(old);
            let new_cells = cells(new);
            let mut floors = std::collections::BTreeMap::<i64, Bounds>::new();
            for &(floor, x, y) in old_cells.keys().chain(new_cells.keys()) {
                if old_cells.get(&(floor, x, y)) == new_cells.get(&(floor, x, y)) {
                    continue;
                }
                let (x, y) = (x as f64, y as f64);
                let bounds = floors.entry(floor).or_insert([x, y, x, y]);
                bounds[0] = bounds[0].min(x);
                bounds[1] = bounds[1].min(y);
                bounds[2] = bounds[2].max(x);
                bounds[3] = bounds[3].max(y);
            }
            out.interiors
                .extend(floors.into_iter().map(|(floor, bounds)| InteriorRegion {
                    building_id: id.to_owned(),
                    floor,
                    bounds,
                }));
        }
    }
    out
}

pub(in crate::atlas) fn from_patch(
    patch: &SmallPatch,
    old: &SceneObject,
    next: &SceneObject,
) -> ChangeHints {
    let id = patch.id();
    let mut hints = ChangeHints::default();
    if old != next {
        hints.world.extend([old.bounds(), next.bounds()]);
    }
    if matches!(patch, SmallPatch::RoomName { .. }) {
        hints.metadata.push(id.to_owned());
    }
    if let SmallPatch::Transform { before, after, .. } = patch {
        if placement_owner(&before.placement) != placement_owner(&after.placement) {
            hints.relations.push(id.to_owned());
            for pose in [before, after] {
                if let Placement::Parcel { parcel_id, .. } = &pose.placement {
                    hints.relations.push(parcel_id.clone());
                }
            }
        }
    }
    hints
}
pub(in crate::atlas) fn merge(a: &mut ChangeHints, b: ChangeHints) {
    a.world.extend(b.world);
    a.interiors.extend(b.interiors);
    a.metadata.extend(b.metadata);
    a.relations.extend(b.relations);
}
