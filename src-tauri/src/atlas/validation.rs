//! Shared object, payload and collision rules at their existing trust boundaries.
use crate::atlas::errors::ensure;
use crate::atlas::geometry::{
    collision_bounds, contours, house_occupancy_shape, intersects, occupancy_contours, overlap,
    road_hits,
};
use crate::atlas::model::{FullObject, Road, SceneObject};
use crate::atlas::{interior, parcel_geometry, plan_context, Result};
use std::collections::HashSet;
pub(in crate::atlas) fn validate_road_identity(r: &Road) -> Result<()> {
    ensure(
        r.edge_sections.len() + 1 == r.nodes.len(),
        "Ungültige Abschnittszuordnung",
    )?;
    let node_ids: HashSet<_> = r.nodes.iter().map(|n| &n.id).collect();
    ensure(
        node_ids.len() == r.nodes.len() && node_ids.iter().all(|id| !id.is_empty()),
        "Ungültige Knotenidentität",
    )?;
    let ids: HashSet<_> = r.sections.iter().map(|s| &s.id).collect();
    let used: HashSet<_> = r.edge_sections.iter().collect();
    ensure(
        ids.len() == r.sections.len() && ids == used && ids.iter().all(|id| !id.is_empty()),
        "Ungültige Abschnittsidentität",
    )?;
    let mut seen = HashSet::new();
    let mut previous = None;
    for id in &r.edge_sections {
        if previous != Some(id) {
            ensure(seen.insert(id), "Nicht zusammenhängender Abschnitt")?;
            previous = Some(id);
        }
    }
    for section in &r.sections {
        let sides: HashSet<_> = section.populated_sides.iter().collect();
        ensure(
            sides.len() == section.populated_sides.len(),
            "Doppelte Abschnittsseite",
        )?;
    }
    Ok(())
}
pub(in crate::atlas) fn material(s: &str) -> bool {
    ["grass", "earth", "stone", "water"].contains(&s)
}
pub(in crate::atlas) fn roof_color(s: &str) -> bool {
    s.len() == 7 && s.starts_with('#') && s.as_bytes()[1..].iter().all(u8::is_ascii_hexdigit)
}
pub(in crate::atlas) fn name(s: &str) -> bool {
    !s.trim().is_empty() && s.chars().count() <= 120
}
pub(in crate::atlas) fn validate_object(
    o: &FullObject,
    prepared: &mut plan_context::PreparedRoads,
) -> Result<()> {
    if let FullObject::Road(r) = o {
        plan_context::prepare_road(prepared, r)?;
    }
    plan_context::validate_header_shape(&SceneObject::from(o), prepared)
        .map_err(|e| e.with_context(vec![o.id().into()]))?;
    validate_house_payload(o, true).map_err(|e| e.with_context(vec![o.id().into()]))
}
pub(in crate::atlas) fn validate_house_payload(o: &FullObject, external: bool) -> Result<()> {
    if let FullObject::House(h) = o {
        h.foundation.validate()?;
        ensure(!h.rooms.is_empty() && !h.cells.is_empty(), "Leeres Gebäude")?;
        interior::validate_openings(&h.cells, &h.connections)?;
        if external {
            ensure(h.contours == contours(&h.cells), "Ungültiger Gebäudeumriss")?;
            ensure(
                h.occupancy_contours == occupancy_contours(&h.cells),
                "Ungültiger Belegungsumriss",
            )?;
        }
        ensure(
            h.rooms.iter().all(|r| r.building_id == h.id),
            "Fremde Raumzugehörigkeit",
        )?;
    }
    Ok(())
}
pub(in crate::atlas) fn conflict(a: &SceneObject, b: &SceneObject) -> Result<bool> {
    if !intersects(collision_bounds(a), collision_bounds(b)) {
        return Ok(false);
    }
    Ok(match (a, b) {
        (SceneObject::Parcel(parcel), SceneObject::House(h))
        | (SceneObject::House(h), SceneObject::Parcel(parcel)) => {
            parcel_geometry::parcel_occupancy_conflict(
                parcel,
                &h.placement,
                &h.occupancy_contours,
                &h.transform,
            )?
        }
        (SceneObject::Parcel(parcel), SceneObject::Parcel(other)) => {
            parcel_geometry::parcel_conflict(parcel, parcel_geometry::Obstacle::Parcel(other))?
        }
        (SceneObject::Parcel(parcel), SceneObject::Road(road))
        | (SceneObject::Road(road), SceneObject::Parcel(parcel)) => {
            parcel_geometry::parcel_conflict(parcel, parcel_geometry::Obstacle::Road(road))?
        }
        (SceneObject::Parcel(parcel), SceneObject::Area(area))
        | (SceneObject::Area(area), SceneObject::Parcel(parcel)) => {
            area.material == "water"
                && parcel_geometry::parcel_conflict(
                    parcel,
                    parcel_geometry::Obstacle::Water(&area.points),
                )?
        }
        (SceneObject::House(a), SceneObject::House(b)) => {
            overlap(&house_occupancy_shape(a), &house_occupancy_shape(b))
        }
        (SceneObject::Road(r), SceneObject::House(h))
        | (SceneObject::House(h), SceneObject::Road(r)) => {
            road_hits(&r.path, r.width, &house_occupancy_shape(h))
        }
        (SceneObject::Area(a), SceneObject::House(h))
        | (SceneObject::House(h), SceneObject::Area(a)) => {
            a.material == "water"
                && overlap(std::slice::from_ref(&a.points), &house_occupancy_shape(h))
        }
        (SceneObject::Area(a), SceneObject::Road(r))
        | (SceneObject::Road(r), SceneObject::Area(a)) => {
            a.material == "water" && road_hits(&r.path, r.width, std::slice::from_ref(&a.points))
        }
        _ => false,
    })
}
