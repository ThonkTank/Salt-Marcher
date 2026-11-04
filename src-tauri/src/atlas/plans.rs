//! Atomic, header-only post-state planning for parcel ownership and road follow.
use crate::atlas::application::AtlasApplication;
use crate::atlas::change::{Delta, EditPlan};
use crate::atlas::errors::{ensure, AppError, DomainViolation, ErrorCategory, IssueGeometry};
use crate::atlas::geometry::{
    bounds, collision_bounds, expand, occupancy_bounds, simple_polygon, valid_point, world,
};
use crate::atlas::model::{
    AlgorithmVersion, FullObject, HouseHeader, Parcel, ParcelSource, Placement, PlanDiagnostics,
    PopulationRecipe, Road, SceneObject, Side,
};
use crate::atlas::operations::fresh_house_name;
use crate::atlas::{generation, interior, parcel_geometry, plan_context, population, Result};
use std::collections::HashSet;

/// Recompose a bound header without loading or modifying its interior payload.
pub(in crate::atlas) fn follow_parcel(
    header: &HouseHeader,
    parcel: &Parcel,
) -> Result<HouseHeader> {
    let Placement::Parcel { grid_pose, .. } = &header.placement else {
        unreachable!()
    };
    let mut next = header.clone();
    next.transform = parcel_geometry::parcel_house_transform(&parcel.frame, grid_pose)?;
    next.occupancy_bounds = occupancy_bounds(&next.occupancy_contours, &next.transform);
    Ok(next)
}
pub(in crate::atlas) fn parcel_error(error: AppError, parcel: &Parcel) -> AppError {
    if error.category != ErrorCategory::InvalidInput {
        return error;
    }
    let mut ids = vec![parcel.id.clone()];
    if let ParcelSource::Road {
        road_id,
        section_id,
        ..
    } = &parcel.source
    {
        ids.extend([road_id.clone(), section_id.clone()]);
    }
    DomainViolation::ParcelGeometry {
        object_ids: ids,
        detail: error.message,
        geometry: None,
    }
    .into()
}
pub(in crate::atlas) fn with_object(violation: DomainViolation, object: &SceneObject) -> AppError {
    violation
        .with_geometry(IssueGeometry::Bounds {
            bounds: collision_bounds(object),
        })
        .into()
}
impl AtlasApplication {
    pub(in crate::atlas) fn plan_delete(&self, id: &str, delta: &mut Delta) -> Result<()> {
        let object = self.object(id)?;
        match &object {
            FullObject::Road(r) => {
                for parcel in self.parcel_headers_for_road(&r.id)? {
                    self.plan_delete(&parcel.id, delta)?;
                }
            }
            FullObject::Parcel(p) => {
                if let Some(h) = self.house_header_for_parcel(&p.id)? {
                    self.plan_delete(&h.id, delta)?;
                }
            }
            _ => {}
        }
        delta.before.push(object);
        Ok(())
    }
    pub(in crate::atlas) fn plan_road(
        &self,
        plan: &mut EditPlan,
        road: &mut Road,
        diagnostics: &mut PlanDiagnostics,
        context: &mut plan_context::PlanContext<'_>,
    ) -> Result<()> {
        context.register_final_road(road)?;
        diagnostics.replace_proposed([SceneObject::Road(road.clone())]);
        plan_context::validate_header_shape(
            &SceneObject::Road(road.clone()),
            &context.prepared_roads,
        )?;
        let parcels = context.parcels_for_road(&road.id)?.to_vec();
        context.load_owners(&parcels.iter().map(|p| p.id.clone()).collect::<Vec<_>>())?;
        if parcels.len() > population::MAX_BOUND_PARCELS {
            return Err(DomainViolation::Limit {
                kind: "gebundene Parzellen".into(),
                actual: parcels.len(),
                maximum: population::MAX_BOUND_PARCELS,
                object_ids: vec![road.id.clone()],
            }
            .into());
        }
        for before in &parcels {
            let ParcelSource::Road { section_id, .. } = &before.source else {
                unreachable!()
            };
            if !road.sections.iter().any(|s| s.id == *section_id) {
                let parcel_ids = parcels.iter().filter(|p| {
                    matches!(&p.source, ParcelSource::Road { section_id: id, .. } if id == section_id)
                }).map(|p| p.id.clone()).collect();
                return Err(with_object(
                    DomainViolation::BoundSection {
                        road_id: road.id.clone(),
                        section_ids: vec![section_id.clone()],
                        parcel_ids,
                        geometry: None,
                    },
                    &SceneObject::Parcel(before.clone()),
                ));
            }
            let geometry = context.prepared_roads[&road.id]
                .derive(&before.source)
                .map_err(|e| {
                    parcel_error(e, before).with_geometry(IssueGeometry::Path {
                        points: road.path.clone(),
                    })
                })?;
            let mut after = before.clone();
            after.polygon = geometry.polygon;
            after.frame = geometry.frame;
            diagnostics.push_proposed(SceneObject::Parcel(after.clone()));
            if let Some(header) = context.owner(&before.id).cloned() {
                let next = follow_parcel(&header, &after)?;
                diagnostics.push_proposed(SceneObject::House(next.clone()));
                plan.change_pose(header, next);
            }
            if *before != after {
                plan.delta.before.push(FullObject::Parcel(before.clone()));
                plan.delta.after.push(FullObject::Parcel(after));
            }
        }
        Ok(())
    }
    pub(in crate::atlas) fn plan_population(
        &self,
        road: &mut Road,
        context: &mut plan_context::PlanContext<'_>,
        settings: &population::Settings,
        plan: &mut EditPlan,
        only_sections: Option<&HashSet<String>>,
        generation: &mut generation::GenerationResponse,
    ) -> Result<()> {
        population::validate_settings(settings)?;
        // Existing bound parcels include empty ones; detached parcels never count.
        let bound = context.parcels_for_road(&road.id)?.len();
        let excluded: HashSet<String> = plan
            .before_ids()
            .chain(std::iter::once(road.id.as_str()))
            .map(str::to_owned)
            .collect();
        let added = plan.after_headers();
        let added_index = plan_context::HeaderSpatialIndex::bulk_load(&added);
        let prepared = context.prepared_roads[&road.id].clone();
        let mut generation_road = road.clone();
        if let Some(only) = only_sections {
            for s in &mut generation_road.sections {
                if !only.contains(&s.id) {
                    s.populated_sides = vec![Side::Left, Side::Right];
                }
            }
        }
        let generated = population::generate_prepared_candidates(
            &generation_road,
            &prepared,
            settings,
            bound,
            |slot| {
                let b = expand(bounds(slot.geometry.polygon.iter().copied()), settings.gap);
                let mut nearby = context.nearby(b, &excluded)?;
                nearby.extend(added_index.query(b).into_iter().map(|i| added[i].clone()));
                Ok(nearby)
            },
        )?;
        let mut names = self.house_names()?;
        let mut next_name = 1;
        generation
            .generation_diagnostics
            .extend(generated.diagnostics);
        for accepted in generated.parcels {
            let slot = accepted.slot;
            let parcel = slot.parcel(plan.allocator.allocate("parcel")?);
            generation.generation_summary.created_parcels += 1;
            plan.delta.after.push(FullObject::Parcel(parcel.clone()));
            if let Some(placement) = accepted.house {
                let mut house = interior::new_house(
                    plan.allocator.allocate("house")?,
                    placement.transform,
                    slot.width,
                    slot.depth,
                    slot.roof_index as usize,
                )?;
                house.placement = Placement::Parcel {
                    parcel_id: parcel.id.clone(),
                    grid_pose: placement.grid_pose,
                };
                house.name = fresh_house_name(&mut names, &mut next_name);
                plan.delta.after.push(FullObject::House(house));
                generation.generation_summary.created_houses += 1;
            } else if let Some(code) = accepted.unplaced {
                let message = match code {
                    generation::HouseUnplacedCode::NoGridFit => {
                        "Kein Rasterplatz für das Haus in der Parzelle"
                    }
                    generation::HouseUnplacedCode::ClearanceBlocked => {
                        "Kein Rasterplatz mit ausreichendem Hausabstand"
                    }
                }
                .into();
                generation
                    .generation_diagnostics
                    .push(generation::GenerationDiagnostic::House {
                        location: generation::GenerationLocation {
                            road_id: road.id.clone(),
                            section_id: slot.section_id,
                            side: slot.side,
                            slot_index: slot.slot,
                            point: slot.point,
                            message,
                        },
                        code,
                        parcel_id: parcel.id.clone(),
                    });
            }
        }
        for (id, side) in generated.started_sides {
            road.sections
                .iter_mut()
                .find(|s| s.id == id)
                .expect("generated section")
                .populated_sides
                .push(side);
        }
        road.population_recipe = Some(PopulationRecipe {
            settings: population::Settings {
                layout: None,
                ..settings.clone()
            },
            algorithm_version: AlgorithmVersion,
        });
        generation.generation_limit = generated.limit;
        let summary = &mut generation.generation_summary;
        summary.empty_parcels = summary.created_parcels - summary.created_houses;
        summary.unplaced_houses = generation
            .generation_diagnostics
            .iter()
            .filter(|d| matches!(d, generation::GenerationDiagnostic::House { .. }))
            .count();
        summary.skipped_parcels = generation
            .generation_diagnostics
            .iter()
            .filter(|d| matches!(d, generation::GenerationDiagnostic::Parcel { .. }))
            .count();
        summary.limited = generation.generation_limit.is_some();
        Ok(())
    }
    pub(in crate::atlas) fn validate_plan(
        &self,
        plan: &EditPlan,
        diagnostics: &mut PlanDiagnostics,
        context: &mut plan_context::PlanContext<'_>,
    ) -> Result<()> {
        let geometry_ids: HashSet<_> = plan
            .delta
            .before
            .iter()
            .chain(&plan.delta.after)
            .map(FullObject::id)
            .collect();
        ensure(
            plan.fields
                .iter()
                .all(|f| !geometry_ids.contains(f.before.id.as_str())),
            "ID zugleich Delta und Feldpatch",
        )?;
        let after = plan.after_headers();
        diagnostics.replace_proposed(after.clone());
        let state =
            plan_context::HeaderPostState::new(plan.before_ids().map(str::to_owned), after)?;
        plan_context::validate_poststate(&state, context)
    }
}

pub(in crate::atlas) fn obstacle(o: &SceneObject) -> Option<parcel_geometry::Obstacle<'_>> {
    use parcel_geometry::Obstacle;
    Some(match o {
        SceneObject::House(h) => Obstacle::House {
            id: &h.id,
            placement: &h.placement,
            contours: &h.contours,
            occupancy_contours: &h.occupancy_contours,
            transform: &h.transform,
        },
        SceneObject::Parcel(p) => Obstacle::Parcel(p),
        SceneObject::Road(r) => Obstacle::Road(r),
        SceneObject::Area(a) if a.material == "water" => Obstacle::Water(&a.points),
        _ => return None,
    })
}

/// Component order is independent of client cell ordering and duplicates.
pub(in crate::atlas) fn cell_components(cells: &[[i64; 2]]) -> Result<Vec<Vec<(i64, i64)>>> {
    ensure(
        cells
            .iter()
            .all(|p| p[0].abs_diff(0) <= 1_000_000 && p[1].abs_diff(0) <= 1_000_000),
        "Ungültige Raumkoordinaten",
    )?;
    let cells = cells.iter().map(|p| (p[0], p[1])).collect();
    Ok(crate::interior::cell_components(&cells)
        .into_iter()
        .map(|c| c.into_iter().collect())
        .collect())
}

pub(in crate::atlas) fn safe_proposed(o: &SceneObject) -> bool {
    match o {
        SceneObject::House(h) => {
            valid_point([h.transform.x, h.transform.y])
                && h.transform.angle.is_finite()
                && h.contours
                    .iter()
                    .chain(&h.occupancy_contours)
                    .flatten()
                    .all(|p| valid_point(world(*p, &h.transform)))
        }
        SceneObject::Parcel(p) => {
            simple_polygon(&p.polygon)
                && valid_point([p.frame.x, p.frame.y])
                && p.frame.angle.is_finite()
        }
        SceneObject::Road(r) => {
            (2.0..=100.0).contains(&r.width)
                && (2..=512).contains(&r.nodes.len())
                && (2..=32768).contains(&r.path.len())
                && r.path.iter().copied().all(valid_point)
                && r.nodes.iter().all(|n| {
                    valid_point(n.point)
                        && n.incoming
                            .iter()
                            .chain(n.outgoing.iter())
                            .copied()
                            .all(valid_point)
                })
        }
        SceneObject::Area(a) => simple_polygon(&a.points),
    }
}
