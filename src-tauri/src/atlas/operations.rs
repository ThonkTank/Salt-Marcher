//! Stateless intent planning and preview projection over typed document reads.
use crate::atlas::application::AtlasApplication;
use crate::atlas::change::{Computed, EditPlan, SmallPatch};
use crate::atlas::errors::{ensure, invalid, AppError, DomainViolation, IssueGeometry};
use crate::atlas::geometry::{collision_bounds, contours, occupancy_bounds, occupancy_contours};
use crate::atlas::model::{
    Area, CascadeCounts, FullObject, GridPose, Intent, Node, ParcelSource, Placement,
    PlanDiagnostics, QuarterTurns, RemovedConnection, Road, RoadEnd, RoadSection, SceneObject,
    Transform,
};
use crate::atlas::plans::{cell_components, follow_parcel, safe_proposed};
use crate::atlas::validation::{name, validate_house_payload};
use crate::atlas::{interior, parcel_geometry, plan_context, Result};
use std::collections::HashSet;
pub(in crate::atlas) fn compute(
    app: &AtlasApplication,
    intent: &Intent,
    diagnostics: &mut PlanDiagnostics,
) -> Result<Computed> {
    if let Some(result) = app.compute_rivers(intent)? {
        return Ok(result);
    }
    if let Some(result) = app.compute_regions(intent)? {
        return Ok(result);
    }
    if let Some(result) = app.compute_ground(intent)? {
        return Ok(result);
    }
    if let Some(result) = app.compute_terrain(intent)? {
        return Ok(result);
    }
    let mut context = plan_context::PlanContext::new(app);
    let mut plan = EditPlan::new(app.allocator()?);
    match intent {
        Intent::RiverEdit { .. }
        | Intent::RegionEdit { .. }
        | Intent::RegionStroke { .. }
        | Intent::GroundStroke { .. }
        | Intent::TerrainStroke { .. }
        | Intent::WaterStroke { .. }
        | Intent::SetFoundation { .. } => unreachable!(),
        Intent::CreateRoad {
            road,
            population,
            roughness,
            terrain_follow,
        } => {
            let mut r = Road {
                id: plan.allocator.allocate("road")?,
                name: road.name.clone(),
                width: road.width,
                material: road.material,
                nodes: vec![],
                path: vec![],
                edge_sections: vec![],
                sections: vec![],
                population_recipe: None,
            };
            for node in &road.nodes {
                r.nodes.push(Node {
                    id: plan.allocator.allocate("node")?,
                    point: node.point,
                    incoming: node.incoming,
                    outgoing: node.outgoing,
                });
            }
            for _ in 1..r.nodes.len() {
                let id = plan.allocator.allocate("section")?;
                r.edge_sections.push(id.clone());
                r.sections.push(RoadSection {
                    id,
                    populated_sides: vec![],
                });
            }
            if let Some(settings) = terrain_follow {
                let count = r.edge_sections.len();
                app.follow_road(&mut r, 0..count, settings, roughness.as_ref(), || {
                    plan.allocator.allocate("node")
                })?;
            } else if let Some(settings) = roughness {
                let count = r.edge_sections.len();
                crate::atlas::road_roughness::deform(&mut r, settings, 0..count, || {
                    plan.allocator.allocate("node")
                })?;
            }
            app.plan_road(&mut plan, &mut r, diagnostics, &mut context)?;
            if let Some(settings) = population {
                app.plan_population(
                    &mut r,
                    &mut context,
                    settings,
                    &mut plan,
                    None,
                    &mut diagnostics.generation,
                )?;
            }
            plan.delta.after.push(FullObject::Road(r));
        }
        Intent::UpdateRoad { road_id, road } => {
            let mut r = app.road(road_id)?;
            ensure(
                r.nodes
                    .iter()
                    .map(|n| &n.id)
                    .eq(road.nodes.iter().map(|n| &n.id)),
                "Topologieänderung benötigt eigenen Intent",
            )?;
            plan.delta.before.push(FullObject::Road(r.clone()));
            r.name = road.name.clone();
            r.width = road.width;
            r.material = road.material;
            r.nodes = road
                .nodes
                .iter()
                .map(|n| Node {
                    id: n.id.clone(),
                    point: n.point,
                    incoming: n.incoming,
                    outgoing: n.outgoing,
                })
                .collect();
            app.plan_road(&mut plan, &mut r, diagnostics, &mut context)?;
            plan.delta.after.push(FullObject::Road(r));
        }
        Intent::RoughenRoad { road_id, roughness } => {
            let mut r = app.road(road_id)?;
            plan.delta.before.push(FullObject::Road(r.clone()));
            let count = r.edge_sections.len();
            crate::atlas::road_roughness::deform(&mut r, roughness, 0..count, || {
                plan.allocator.allocate("node")
            })?;
            app.plan_road(&mut plan, &mut r, diagnostics, &mut context)?;
            plan.delta.after.push(FullObject::Road(r));
        }
        Intent::SceneryStroke { brush } => {
            let scenery = super::scenery::scatter(brush, plan.allocator.allocate("scenery")?)?;
            if !scenery.assets.is_empty() {
                plan.delta.after.push(FullObject::Scenery(scenery));
            }
        }
        Intent::CreateArea { area } => {
            plan.delta.after.push(FullObject::Area(Area {
                id: plan.allocator.allocate("area")?,
                material: area.material.clone(),
                points: area.points.clone(),
                order: app.next_action_state(),
            }));
        }
        Intent::UpdateArea { area_id, area } => {
            let before = app.object(area_id)?;
            let FullObject::Area(old) = &before else {
                return Err(invalid("Keine Geländefläche"));
            };
            let a = Area {
                id: old.id.clone(),
                material: area.material.clone(),
                points: area.points.clone(),
                order: old.order,
            };
            plan.delta.before.push(before);
            plan.delta.after.push(FullObject::Area(a));
        }
        Intent::CreateHouse {
            transform,
            width,
            depth,
            parcel_id,
        } => {
            let mut h = interior::new_house(
                plan.allocator.allocate("house")?,
                transform.clone(),
                *width,
                *depth,
                0,
            )?;
            if let Some(parcel_id) = parcel_id {
                (h.placement, h.transform) =
                    parcel_placement(app, &h.id, parcel_id, transform, None)?;
                h.occupancy_bounds = occupancy_bounds(&h.occupancy_contours, &h.transform);
            }
            h.name = fresh_house_name(&mut app.house_names()?, &mut 1);
            plan.delta.after.push(FullObject::House(h));
        }
        Intent::TransformHouse { id, transform } => {
            let before = app.required_house_header(id)?;
            let mut after = before.clone();
            after.transform = transform.clone();
            after.occupancy_bounds = occupancy_bounds(&after.occupancy_contours, &after.transform);
            if safe_proposed(&SceneObject::House(after.clone())) {
                diagnostics.replace_proposed([SceneObject::House(after.clone())]);
            }
            if let Placement::Parcel { parcel_id, .. } = &before.placement {
                (after.placement, after.transform) = parcel_placement(
                    app,
                    id,
                    parcel_id,
                    transform,
                    Some(IssueGeometry::Bounds {
                        bounds: collision_bounds(&SceneObject::House(after.clone())),
                    }),
                )?;
            }
            after.occupancy_bounds = occupancy_bounds(&after.occupancy_contours, &after.transform);
            plan.change_pose(before, after);
        }
        Intent::Rename { id, name: new_name } => {
            let kind = app.object_kind(id)?;
            if kind == "house" {
                ensure(name(new_name), "Ungültiger Gebäudename oder Dachfarbe")?;
                let before = app.required_house_header(id)?;
                let mut after = before.clone();
                after.name = new_name.clone();
                return Ok(Computed::fields(
                    SmallPatch::HouseName {
                        id: id.clone(),
                        before: before.name.clone(),
                        after: new_name.clone(),
                    },
                    before,
                    after,
                ));
            }
            let mut o = app.object(id)?;
            plan.delta.before.push(o.clone());
            match &mut o {
                FullObject::Road(r) => r.name = new_name.clone(),
                _ => return Err(invalid("Objekt hat keinen Namen")),
            }
            plan.delta.after.push(o);
        }
        Intent::Roof { id, roof } => {
            ensure(
                crate::atlas::validation::roof_color(roof),
                "Ungültiger Gebäudename oder Dachfarbe",
            )?;
            let before = app.required_house_header(id)?;
            let mut after = before.clone();
            after.roof = roof.clone();
            return Ok(Computed::fields(
                SmallPatch::Roof {
                    id: id.clone(),
                    before: before.roof.clone(),
                    after: roof.clone(),
                },
                before,
                after,
            ));
        }
        Intent::ImportantPlace { id, value } => {
            let before = app.required_house_header(id)?;
            let mut after = before.clone();
            after.important_place = *value;
            return Ok(Computed::fields(
                SmallPatch::ImportantPlace {
                    id: id.clone(),
                    before: before.important_place,
                    after: *value,
                },
                before,
                after,
            ));
        }
        Intent::Delete { id } => app.plan_delete(id, &mut plan.delta)?,
        Intent::Room {
            building_id,
            intent,
        } => {
            if let crate::interior::RoomIntent::Rename {
                room_id,
                name: new_name,
            } = intent
            {
                ensure(name(new_name), "Room name must contain 1 to 120 characters")?;
                let parts = app.house_parts(building_id)?;
                let room = parts
                    .metadata
                    .rooms
                    .iter()
                    .find(|r| r.id == *room_id)
                    .ok_or_else(|| invalid("Room not found"))?;
                let before = parts.header;
                return Ok(Computed::fields(
                    SmallPatch::RoomName {
                        id: building_id.clone(),
                        room_id: room_id.clone(),
                        before: room.name.clone(),
                        after: new_name.clone(),
                    },
                    before.clone(),
                    before,
                ));
            }
            let h = app.house(building_id)?;
            let next = interior::edit(&h, crate::interior::LocalEdit::Room(intent.clone()))?;
            plan.delta.before.push(FullObject::House(h));
            if !next.rooms.is_empty() {
                plan.delta.after.push(FullObject::House(next));
            }
        }
        Intent::Connection {
            building_id,
            intent,
        } => {
            let h = app.house(building_id)?;
            let next = interior::edit(&h, crate::interior::LocalEdit::Connection(intent.clone()))?;
            plan.delta.before.push(FullObject::House(h));
            plan.delta.after.push(FullObject::House(next));
        }
        Intent::Populate { road_id, settings } => {
            let mut road = app.road(road_id)?;
            plan.delta.before.push(FullObject::Road(road.clone()));
            context.register_final_road(&mut road)?;
            app.plan_population(
                &mut road,
                &mut context,
                settings,
                &mut plan,
                None,
                &mut diagnostics.generation,
            )?;
            plan.delta.after.push(FullObject::Road(road));
        }
        Intent::InsertRoadNode {
            road_id,
            after_node_id,
            t,
        } => {
            let mut r = app.road(road_id)?;
            plan.delta.before.push(FullObject::Road(r.clone()));
            let i = r
                .nodes
                .iter()
                .position(|n| n.id == *after_node_id)
                .ok_or_else(|| invalid("Knoten fehlt"))?;
            ensure(i + 1 < r.nodes.len(), "Keine Kante nach Endknoten")?;
            let a = &r.nodes[i];
            let b = &r.nodes[i + 1];
            let [left, right] = parcel_geometry::split_bezier(
                [
                    a.point,
                    a.outgoing.unwrap_or(a.point),
                    b.incoming.unwrap_or(b.point),
                    b.point,
                ],
                *t,
            )?;
            r.nodes[i].outgoing = Some(left[1]);
            r.nodes[i + 1].incoming = Some(right[2]);
            r.nodes.insert(
                i + 1,
                Node {
                    id: plan.allocator.allocate("node")?,
                    point: left[3],
                    incoming: Some(left[2]),
                    outgoing: Some(right[1]),
                },
            );
            r.edge_sections.insert(i + 1, r.edge_sections[i].clone());
            app.plan_road(&mut plan, &mut r, diagnostics, &mut context)?;
            plan.delta.after.push(FullObject::Road(r));
        }
        Intent::DeleteRoadNode { road_id, node_id } => {
            let mut r = app.road(road_id)?;
            plan.delta.before.push(FullObject::Road(r.clone()));
            ensure(r.nodes.len() > 2, "Mindestens zwei Straßenknoten bleiben")?;
            let i = r
                .nodes
                .iter()
                .position(|n| n.id == *node_id)
                .ok_or_else(|| invalid("Knoten fehlt"))?;
            if i > 0 && i + 1 < r.nodes.len() && r.edge_sections[i - 1] != r.edge_sections[i] {
                let section_id = r.edge_sections[i - 1].clone();
                let parcel_ids = app.parcel_headers_for_road(road_id)?.into_iter().filter(|p| matches!(&p.source, ParcelSource::Road{section_id: id, ..} if id == &section_id || id == &r.edge_sections[i])).map(|p| p.id).collect();
                return Err(DomainViolation::BoundSection {
                    road_id: road_id.clone(),
                    section_ids: vec![section_id, r.edge_sections[i].clone()],
                    parcel_ids,
                    geometry: None,
                }
                .into());
            }
            let edge = if i == 0 { 0 } else { i - 1 };
            r.nodes.remove(i);
            r.edge_sections.remove(edge);
            r.sections.retain(|s| r.edge_sections.contains(&s.id));
            app.plan_road(&mut plan, &mut r, diagnostics, &mut context)?;
            plan.delta.after.push(FullObject::Road(r));
        }
        Intent::ExtendRoad {
            roughness,
            terrain_follow,
            road_id,
            end,
            nodes,
            endpoint_handle,
            population,
        } => {
            let mut r = app.road(road_id)?;
            plan.delta.before.push(FullObject::Road(r.clone()));
            ensure(
                !nodes.is_empty() && nodes.len() + r.nodes.len() <= 512,
                "Ungültige Verlängerung",
            )?;
            let mut new_nodes = vec![];
            let mut edges = vec![];
            for n in nodes {
                new_nodes.push(Node {
                    id: plan.allocator.allocate("node")?,
                    point: n.point,
                    incoming: n.incoming,
                    outgoing: n.outgoing,
                });
                let id = plan.allocator.allocate("section")?;
                edges.push(id.clone());
                r.sections.push(RoadSection {
                    id,
                    populated_sides: vec![],
                });
            }
            match end {
                RoadEnd::Start => {
                    r.nodes[0].incoming = *endpoint_handle;
                    new_nodes.extend(r.nodes);
                    r.nodes = new_nodes;
                    edges.extend(r.edge_sections);
                    r.edge_sections = edges;
                }
                RoadEnd::End => {
                    r.nodes.last_mut().unwrap().outgoing = *endpoint_handle;
                    r.nodes.extend(new_nodes);
                    r.edge_sections.extend(edges);
                }
            }
            if let Some(settings) = terrain_follow {
                let range = match end {
                    RoadEnd::Start => 0..nodes.len(),
                    RoadEnd::End => r.edge_sections.len() - nodes.len()..r.edge_sections.len(),
                };
                app.follow_road(&mut r, range, settings, roughness.as_ref(), || {
                    plan.allocator.allocate("node")
                })?;
            } else if let Some(settings) = roughness {
                let count = nodes.len();
                let range = match end {
                    RoadEnd::Start => 0..count,
                    RoadEnd::End => r.edge_sections.len() - count..r.edge_sections.len(),
                };
                crate::atlas::road_roughness::deform(&mut r, settings, range, || {
                    plan.allocator.allocate("node")
                })?;
            }
            app.plan_road(&mut plan, &mut r, diagnostics, &mut context)?;
            if let Some(settings) = population {
                let old_ids: HashSet<_> = match &plan.delta.before[0] {
                    FullObject::Road(old) => old.sections.iter().map(|s| s.id.clone()).collect(),
                    _ => unreachable!(),
                };
                let new_ids: HashSet<_> = r
                    .sections
                    .iter()
                    .filter(|s| !old_ids.contains(&s.id))
                    .map(|s| s.id.clone())
                    .collect();
                app.plan_population(
                    &mut r,
                    &mut context,
                    settings,
                    &mut plan,
                    Some(&new_ids),
                    &mut diagnostics.generation,
                )?;
            }
            plan.delta.after.push(FullObject::Road(r));
        }
        Intent::CreateParcelHouse {
            parcel_id,
            floor,
            cells,
        } => {
            let p = app.parcel(parcel_id)?;
            ensure(
                !cells.is_empty() && cells.len() <= 100_000,
                "Ungültige erste Raumzellen",
            )?;
            let mut h =
                interior::new_house(plan.allocator.allocate("house")?, p.frame.clone(), 1, 1, 0)?;
            h.rooms.clear();
            h.cells.clear();
            h.connections.clear();
            h.contours.clear();
            h.occupancy_contours.clear();
            h.room_counter = 0;
            h.connection_counter = 0;
            let grid_pose = GridPose {
                x_cells: 0,
                y_cells: 0,
                quarter_turns: QuarterTurns(0),
            };
            // Even the identity pose normalizes the frame angle. Copying
            // the raw frame can differ by an ULP from canonical composition.
            h.transform = parcel_geometry::parcel_house_transform(&p.frame, &grid_pose)?;
            h.placement = Placement::Parcel {
                parcel_id: parcel_id.clone(),
                grid_pose,
            };
            h.name = fresh_house_name(&mut app.house_names()?, &mut 1);
            ensure(i32::try_from(*floor).is_ok(), "Ungültiges Geschoss")?;
            // Canonical component order defines stable local room identities.
            // All disconnected components share this single explicit owner.
            for (index, component) in cell_components(cells)?.into_iter().enumerate() {
                let room_id = format!("room-{index}");
                h.rooms.push(crate::interior::Room {
                    id: room_id.clone(),
                    name: format!("Raum {}", index + 1),
                    floor: *floor,
                    building_id: h.id.clone(),
                    created: index as i64,
                });
                h.cells
                    .extend(component.into_iter().map(|(x, y)| crate::interior::Cell {
                        floor: *floor,
                        x,
                        y,
                        room_id: room_id.clone(),
                    }));
            }
            h.room_counter = h.rooms.len() as i64;
            h.cells.sort_by_key(|c| (c.floor, c.y, c.x));
            h.contours = contours(&h.cells);
            h.occupancy_contours = occupancy_contours(&h.cells);
            h.occupancy_bounds = occupancy_bounds(&h.occupancy_contours, &h.transform);
            interior::validate(&h)?;
            plan.delta.after.push(FullObject::House(h));
        }
        Intent::UpdateParcel {
            id,
            start,
            end,
            setback,
            depth,
        } => {
            let before = app.parcel(id)?;
            let mut after = before.clone();
            let ParcelSource::Road {
                road_id,
                start: a,
                end: b,
                setback: c,
                depth: d,
                ..
            } = &mut after.source
            else {
                return Err(invalid(
                    "Nur straßengebundene Parzellen besitzen Straßengriffe",
                ));
            };
            let mut road = app.road(road_id)?;
            *a = *start;
            *b = *end;
            *c = *setback;
            *d = *depth;
            context.register_final_road(&mut road)?;
            let geometry = context.prepared_roads[&road.id].derive(&after.source)?;
            after.polygon = geometry.polygon;
            after.frame = geometry.frame;
            if let Some(header) = app.house_header_for_parcel(id)? {
                let next = follow_parcel(&header, &after)?;
                plan.change_pose(header, next);
            }
            diagnostics.push_proposed(SceneObject::Parcel(after.clone()));
            plan.delta.before.push(FullObject::Parcel(before));
            plan.delta.after.push(FullObject::Parcel(after));
        }
        Intent::DetachParcel { id } => {
            let mut p = app.parcel(id)?;
            if matches!(p.source, ParcelSource::Road { .. }) {
                plan.delta.before.push(FullObject::Parcel(p.clone()));
                p.source = ParcelSource::Detached {};
                plan.delta.after.push(FullObject::Parcel(p));
            }
        }
    }
    for object in &plan.delta.after {
        validate_house_payload(object, false)
            .map_err(|e| e.with_context(vec![object.id().into()]))?;
    }
    app.validate_plan(&plan, diagnostics, &mut context)?;
    Ok(plan.finish(diagnostics.generation.clone()))
}

pub(in crate::atlas) fn fresh_house_name(names: &mut HashSet<String>, next: &mut u64) -> String {
    loop {
        let name = format!("Haus {}", next);
        *next += 1;
        if names.insert(name.clone()) {
            return name;
        }
    }
}

pub(in crate::atlas) struct PreviewParts {
    pub(in crate::atlas) objects: Vec<SceneObject>,
    pub(in crate::atlas) removed: Vec<String>,
    pub(in crate::atlas) deleted_ids: Vec<String>,
    pub(in crate::atlas) cascade_counts: CascadeCounts,
    pub(in crate::atlas) removed_connections: Vec<RemovedConnection>,
}
pub(in crate::atlas) fn preview_parts(computed: &Computed) -> PreviewParts {
    let delta = &computed.change.geometry;
    let previews = delta
        .after
        .iter()
        .map(SceneObject::from)
        .chain(
            computed
                .headers
                .iter()
                .map(|(_, after)| SceneObject::House(after.clone())),
        )
        .collect();
    let field_removed = computed.headers.iter().map(|(before, _)| before.id.clone());
    let mut removed_connections = Vec::new();
    for o in &delta.before {
        if let FullObject::House(h) = o {
            let next = delta.after.iter().find_map(|o| match o {
                FullObject::House(n) if n.id == h.id => Some(n),
                _ => None,
            });
            for connection in &h.connections {
                if !next.is_some_and(|n| n.connections.iter().any(|c| c.id == connection.id)) {
                    removed_connections.push(RemovedConnection {
                        building_id: h.id.clone(),
                        connection: connection.clone(),
                    });
                }
            }
        }
    }
    let removed: Vec<_> = delta
        .before
        .iter()
        .map(|o| o.id().to_owned())
        .chain(field_removed)
        .collect();
    let deleted_ids: Vec<_> = delta
        .before
        .iter()
        .filter(|o| !delta.after.iter().any(|n| n.id() == o.id()))
        .map(|o| o.id().to_owned())
        .collect();
    let mut cascade_counts = CascadeCounts::default();
    for o in delta
        .before
        .iter()
        .filter(|o| deleted_ids.iter().any(|id| id == o.id()))
    {
        match o {
            FullObject::Road(_) => cascade_counts.roads += 1,
            FullObject::Parcel(_) => cascade_counts.parcels += 1,
            FullObject::Area(_) | FullObject::Scenery(_) => {}
            FullObject::House(_) => cascade_counts.houses += 1,
        }
    }
    cascade_counts.connections = removed_connections.len();
    for object in &delta.before {
        if let FullObject::House(house) = object {
            let next = delta.after.iter().find_map(|o| match o {
                FullObject::House(h) if h.id == house.id => Some(h),
                _ => None,
            });
            cascade_counts.rooms += house
                .rooms
                .iter()
                .filter(|r| !next.is_some_and(|h| h.rooms.iter().any(|n| n.id == r.id)))
                .count();
        }
    }
    PreviewParts {
        objects: previews,
        removed,
        deleted_ids,
        cascade_counts,
        removed_connections,
    }
}

/// Canonical placement for both founding and moving a parcel-owned house.
fn parcel_placement(
    app: &AtlasApplication,
    house_id: &str,
    parcel_id: &str,
    transform: &Transform,
    geometry: Option<IssueGeometry>,
) -> Result<(Placement, Transform)> {
    let parcel = app.parcel(parcel_id)?;
    let (grid_pose, canonical) = parcel_geometry::parcel_grid_pose(&parcel.frame, transform)
        .map_err(|_| {
            AppError::from(DomainViolation::GridAlignment {
                house_id: house_id.into(),
                parcel_id: parcel_id.into(),
                geometry,
            })
        })?;
    Ok((
        Placement::Parcel {
            parcel_id: parcel_id.into(),
            grid_pose,
        },
        canonical,
    ))
}
