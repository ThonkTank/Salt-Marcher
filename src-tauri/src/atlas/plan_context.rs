//! Operation-local header/relationship caches. No interior payloads and no
//! state survives a request. Both mutation and staged-document validation use
//! the same pure header/relationship predicates.
use crate::atlas::application::AtlasApplication;
use crate::atlas::errors::{ensure, invalid, AppError, DomainViolation};
use crate::atlas::geometry::{
    collision_bounds, occupancy_bounds, simple_polygon, valid_point, world,
};
use crate::atlas::model::{
    Bounds, HouseHeader, Parcel, ParcelSource, Placement, Point, Road, SceneObject,
};
use crate::atlas::validation::{conflict, material, name, validate_road_identity};
use crate::atlas::{parcel_geometry, plans, population, Result};
use parcel_geometry::PreparedRoadGeometry;
use rstar::{RTree, RTreeObject, AABB};
use std::collections::{HashMap, HashSet};

pub(in crate::atlas) type PreparedRoads = HashMap<String, PreparedRoadGeometry>;

#[derive(Clone)]
struct SpatialEntry {
    ordinal: usize,
    envelope: AABB<Point>,
}
impl RTreeObject for SpatialEntry {
    type Envelope = AABB<Point>;
    fn envelope(&self) -> Self::Envelope {
        self.envelope
    }
}

/// Stable ordinals are supplied by the owner (plan order or candidate order).
/// The tree is only a conservative broad phase; exact pair predicates retain
/// their shared local-coordinate translation and world-foot tolerances.
#[derive(Default)]
pub(in crate::atlas) struct HeaderSpatialIndex(RTree<SpatialEntry>);
impl HeaderSpatialIndex {
    pub fn bulk_load(headers: &[SceneObject]) -> Self {
        Self(RTree::bulk_load(
            headers
                .iter()
                .enumerate()
                .filter_map(|(ordinal, h)| {
                    let bounds = collision_bounds(h);
                    indexable(bounds).then(|| SpatialEntry {
                        ordinal,
                        envelope: envelope(bounds),
                    })
                })
                .collect(),
        ))
    }
    pub fn insert(&mut self, header: &SceneObject, ordinal: usize) {
        self.insert_bounds(collision_bounds(header), ordinal);
    }
    pub fn insert_bounds(&mut self, bounds: Bounds, ordinal: usize) {
        if indexable(bounds) {
            self.0.insert(SpatialEntry {
                ordinal,
                envelope: envelope(bounds),
            });
        }
    }
    pub fn query(&self, bounds: Bounds) -> Vec<usize> {
        if !indexable(bounds) {
            return vec![];
        }
        let mut ordinals: Vec<_> = self
            .0
            .locate_in_envelope_intersecting(&envelope(bounds))
            .map(|entry| entry.ordinal)
            .collect();
        ordinals.sort_unstable();
        ordinals
    }
}
fn indexable(b: Bounds) -> bool {
    b.iter().all(|v| v.is_finite()) && b[0] <= b[2] && b[1] <= b[3]
}
fn envelope(b: Bounds) -> AABB<Point> {
    AABB::from_corners([b[0], b[1]], [b[2], b[3]])
}

pub(in crate::atlas) struct PlanContext<'a> {
    app: &'a AtlasApplication,
    headers: HashMap<String, Option<SceneObject>>,
    owners: HashMap<String, Option<HouseHeader>>,
    road_parcels: HashMap<String, Vec<Parcel>>,
    pub prepared_roads: PreparedRoads,
}
impl<'a> PlanContext<'a> {
    pub fn new(app: &'a AtlasApplication) -> Self {
        Self {
            app,
            headers: HashMap::new(),
            owners: HashMap::new(),
            road_parcels: HashMap::new(),
            prepared_roads: HashMap::new(),
        }
    }
    /// Called after the last geometry/topology edit, before follow/generation.
    /// Recipe and population markers are deliberately not part of the key.
    pub fn register_final_road(&mut self, road: &mut Road) -> Result<()> {
        let prepared = prepare_road(&mut self.prepared_roads, road)?;
        road.path = prepared.path().to_vec();
        Ok(())
    }
    pub fn parcels_for_road(&mut self, road_id: &str) -> Result<&[Parcel]> {
        if !self.road_parcels.contains_key(road_id) {
            let parcels = self.app.parcel_headers_for_road(road_id)?;
            for p in &parcels {
                self.headers
                    .insert(p.id.clone(), Some(SceneObject::Parcel(p.clone())));
            }
            self.road_parcels.insert(road_id.into(), parcels);
        }
        Ok(&self.road_parcels[road_id])
    }
    pub fn load_owners(&mut self, parcel_ids: &[String]) -> Result<()> {
        let missing: Vec<_> = parcel_ids
            .iter()
            .filter(|id| !self.owners.contains_key(*id))
            .cloned()
            .collect();
        if missing.is_empty() {
            return Ok(());
        }
        for id in &missing {
            self.owners.insert(id.clone(), None);
        }

        for header in self.app.owner_headers_for_parcels(&missing)? {
            let Placement::Parcel { parcel_id, .. } = &header.placement else {
                unreachable!()
            };
            self.owners.insert(parcel_id.clone(), Some(header.clone()));
            self.headers
                .insert(header.id.clone(), Some(SceneObject::House(header)));
        }
        Ok(())
    }
    pub fn owner(&self, parcel_id: &str) -> Option<&HouseHeader> {
        self.owners.get(parcel_id).and_then(Option::as_ref)
    }
    fn load_headers(&mut self, ids: &[String]) -> Result<()> {
        let mut missing: Vec<_> = ids
            .iter()
            .filter(|id| !self.headers.contains_key(*id))
            .cloned()
            .collect();
        missing.sort();
        missing.dedup();
        if missing.is_empty() {
            return Ok(());
        }
        for id in &missing {
            self.headers.insert(id.clone(), None);
        }
        for object in self.app.scene_headers_by_ids(&missing)? {
            self.headers.insert(object.id().into(), Some(object));
        }
        Ok(())
    }
    /// Query each affected area separately. Fetch only IDs/ordinals from the
    /// RTrees; deserialize every live header at most once during this operation.
    pub fn nearby(
        &mut self,
        bounds: Bounds,
        excluded: &HashSet<String>,
    ) -> Result<Vec<SceneObject>> {
        let ids: Vec<_> = self
            .app
            .collision_header_ids(bounds)?
            .into_iter()
            .filter(|id| !excluded.contains(id))
            .collect();
        self.load_headers(&ids)?;
        Ok(ids
            .into_iter()
            .filter_map(|id| self.headers[&id].clone())
            .collect())
    }
}

pub(in crate::atlas) fn prepare_road<'a>(
    prepared: &'a mut PreparedRoads,
    road: &Road,
) -> Result<&'a PreparedRoadGeometry> {
    if let Some(existing) = prepared.get(&road.id) {
        ensure(
            existing.matches_geometry(road),
            "Straßengeometrie nach Vorbereitung verändert",
        )?;
    } else {
        prepared.insert(road.id.clone(), PreparedRoadGeometry::new(road)?);
    }
    Ok(&prepared[&road.id])
}

pub(in crate::atlas) struct HeaderPostState {
    pub before_ids: HashSet<String>,
    pub after: Vec<SceneObject>,
}
impl HeaderPostState {
    pub fn new(before: impl IntoIterator<Item = String>, after: Vec<SceneObject>) -> Result<Self> {
        ensure(
            after
                .iter()
                .map(SceneObject::id)
                .collect::<HashSet<_>>()
                .len()
                == after.len(),
            "ID zugleich Delta und Feldpatch",
        )?;
        Ok(Self {
            before_ids: before.into_iter().collect(),
            after,
        })
    }
    fn excluded(&self) -> HashSet<String> {
        self.before_ids
            .iter()
            .cloned()
            .chain(self.after.iter().map(|h| h.id().to_owned()))
            .collect()
    }
}

/// No SQL or interior reads. After-ID wins, a Before-only ID is deleted, and
/// only then may an unchanged live header satisfy a relation.
pub(in crate::atlas) struct PostStateView<'a> {
    state: &'a HeaderPostState,
    after_ids: HashMap<&'a str, usize>,
    live: &'a HashMap<String, Option<SceneObject>>,
    owners: HashMap<String, Vec<String>>,
    road_counts: HashMap<String, usize>,
}
impl<'a> PostStateView<'a> {
    fn new(state: &'a HeaderPostState, live: &'a HashMap<String, Option<SceneObject>>) -> Self {
        Self {
            state,
            after_ids: state
                .after
                .iter()
                .enumerate()
                .map(|(i, h)| (h.id(), i))
                .collect(),
            live,
            owners: HashMap::new(),
            road_counts: HashMap::new(),
        }
    }
    pub fn lookup(&self, id: &str) -> Option<&SceneObject> {
        if let Some(&index) = self.after_ids.get(id) {
            Some(&self.state.after[index])
        } else if self.state.before_ids.contains(id) {
            None
        } else {
            self.live.get(id).and_then(Option::as_ref)
        }
    }
    fn add_relation(&mut self, object: &SceneObject) {
        match object {
            SceneObject::House(h) => {
                if let Placement::Parcel { parcel_id, .. } = &h.placement {
                    self.owners
                        .entry(parcel_id.clone())
                        .or_default()
                        .push(h.id.clone());
                }
            }
            SceneObject::Parcel(p) => {
                if let ParcelSource::Road { road_id, .. } = &p.source {
                    *self.road_counts.entry(road_id.clone()).or_default() += 1;
                }
            }
            _ => {}
        }
    }
}

pub(in crate::atlas) fn validate_poststate(
    state: &HeaderPostState,
    context: &mut PlanContext<'_>,
) -> Result<()> {
    let excluded = state.excluded();
    let mut references = vec![];
    let mut parcel_ids = vec![];
    let mut road_ids = vec![];
    for h in &state.after {
        match h {
            SceneObject::House(h) => {
                if let Placement::Parcel { parcel_id, .. } = &h.placement {
                    references.push(parcel_id.clone());
                    parcel_ids.push(parcel_id.clone());
                }
            }
            SceneObject::Parcel(p) => {
                parcel_ids.push(p.id.clone());
                if let ParcelSource::Road { road_id, .. } = &p.source {
                    references.push(road_id.clone());
                    road_ids.push(road_id.clone());
                }
            }
            SceneObject::Road(r) => {
                prepare_road(&mut context.prepared_roads, r)?;
                road_ids.push(r.id.clone());
            }
            _ => {}
        }
    }
    references.retain(|id| !excluded.contains(id));
    context.load_headers(&references)?;
    context.load_owners(&parcel_ids)?;
    road_ids.sort();
    road_ids.dedup();
    for id in &road_ids {
        context.parcels_for_road(id)?;
    }
    for id in &references {
        if let Some(Some(SceneObject::Road(r))) = context.headers.get(id) {
            prepare_road(&mut context.prepared_roads, r)?;
        }
    }
    // Live first (in stable row order), followed by plan order. Exclusion also
    // removes replaced IDs even if the caller supplied only an Afterheader.
    let mut relations = vec![];
    for owner in context.owners.values().flatten() {
        if !excluded.contains(&owner.id) {
            relations.push(SceneObject::House(owner.clone()));
        }
    }
    for id in &road_ids {
        relations.extend(
            context.road_parcels[id]
                .iter()
                .filter(|p| !excluded.contains(&p.id))
                .cloned()
                .map(SceneObject::Parcel),
        );
    }
    relations.extend(state.after.iter().cloned());
    // Query each region, cache the union of IDs (never a union bounding box),
    // then freeze the pure view. Owners/counts are built exactly once.
    let mut live_candidates = Vec::with_capacity(state.after.len());
    for header in &state.after {
        live_candidates.push(
            context
                .app
                .collision_header_ids(collision_bounds(header))?
                .into_iter()
                .filter(|id| !excluded.contains(id))
                .collect::<Vec<_>>(),
        );
    }
    context.load_headers(
        &live_candidates
            .iter()
            .flatten()
            .cloned()
            .collect::<Vec<_>>(),
    )?;
    let mut view = PostStateView::new(state, &context.headers);
    for relation in &relations {
        view.add_relation(relation);
    }
    let index = HeaderSpatialIndex::bulk_load(&state.after);
    for (ordinal, header) in state.after.iter().enumerate() {
        validate_header(header, &view, &context.prepared_roads)?;
        for id in &live_candidates[ordinal] {
            if let Some(live) = context.headers[id].as_ref() {
                validate_pair(header, live)?;
            }
        }
        for later in index
            .query(collision_bounds(header))
            .into_iter()
            .filter(|&i| i > ordinal)
        {
            validate_pair(header, &state.after[later])?;
        }
    }
    Ok(())
}

/// Dedicated loader path: candidate contains validated, derived header records
/// and separate payloads. No FullHouse graph, fake deltas or live self-queries.
pub(in crate::atlas) fn validate_staged_document(
    candidate: &AtlasApplication,
    prepared_roads: &mut PreparedRoads,
) -> Result<()> {
    let headers = candidate.all_scene_headers()?;
    for header in &headers {
        if let SceneObject::Road(r) = header {
            prepare_road(prepared_roads, r)?;
        }
    }
    let state = HeaderPostState::new([], headers)?;
    let live = HashMap::new();
    let mut view = PostStateView::new(&state, &live);
    for header in &state.after {
        view.add_relation(header);
    }
    let index = HeaderSpatialIndex::bulk_load(&state.after);
    for (ordinal, header) in state.after.iter().enumerate() {
        validate_header(header, &view, prepared_roads)?;
        for later in index
            .query(collision_bounds(header))
            .into_iter()
            .filter(|&i| i > ordinal)
        {
            validate_pair(header, &state.after[later])?;
        }
    }
    Ok(())
}

fn validate_pair(first: &SceneObject, second: &SceneObject) -> Result<()> {
    if conflict(first, second)? {
        return Err(plans::with_object(
            DomainViolation::Collision {
                first_id: first.id().into(),
                second_id: second.id().into(),
                geometry: None,
            },
            first,
        ));
    }
    Ok(())
}

pub(in crate::atlas) fn validate_header(
    header: &SceneObject,
    view: &PostStateView<'_>,
    prepared_roads: &PreparedRoads,
) -> Result<()> {
    validate_header_shape(header, prepared_roads)
        .map_err(|e| e.with_context(vec![header.id().into()]))?;
    match header {
        SceneObject::House(h) => {
            if let Placement::Parcel {
                parcel_id,
                grid_pose,
            } = &h.placement
            {
                let Some(SceneObject::Parcel(p)) = view.lookup(parcel_id) else {
                    return Err(DomainViolation::ParcelContainment {
                        house_id: h.id.clone(),
                        parcel_id: parcel_id.clone(),
                        geometry: None,
                    }
                    .into());
                };
                if parcel_geometry::parcel_house_transform(&p.frame, grid_pose)? != h.transform {
                    return Err(plans::with_object(
                        DomainViolation::GridAlignment {
                            house_id: h.id.clone(),
                            parcel_id: p.id.clone(),
                            geometry: None,
                        },
                        header,
                    ));
                }
                if let Some(owner_id) = view
                    .owners
                    .get(parcel_id)
                    .and_then(|ids| ids.iter().find(|id| *id != &h.id))
                {
                    return Err(plans::with_object(
                        DomainViolation::OccupiedParcel {
                            parcel_id: p.id.clone(),
                            owner_id: owner_id.clone(),
                            geometry: None,
                        },
                        header,
                    ));
                }
                if !parcel_geometry::covers_occupancy(p, &h.occupancy_contours, &h.transform)? {
                    return Err(plans::with_object(
                        DomainViolation::ParcelContainment {
                            house_id: h.id.clone(),
                            parcel_id: p.id.clone(),
                            geometry: None,
                        },
                        header,
                    ));
                }
            }
        }
        SceneObject::Parcel(p) => {
            if let ParcelSource::Road {
                road_id,
                section_id,
                side,
                ..
            } = &p.source
            {
                let violation = || {
                    AppError::from(DomainViolation::BoundSection {
                        road_id: road_id.clone(),
                        section_ids: vec![section_id.clone()],
                        parcel_ids: vec![p.id.clone()],
                        geometry: None,
                    })
                };
                let Some(SceneObject::Road(r)) = view.lookup(road_id) else {
                    return Err(violation());
                };
                if !r
                    .sections
                    .iter()
                    .any(|s| s.id == *section_id && s.populated_sides.contains(side))
                {
                    return Err(violation());
                }
                let prepared = prepared_roads.get(road_id).ok_or_else(violation)?;
                let derived = prepared
                    .derive(&p.source)
                    .map_err(|e| plans::parcel_error(e, p))?;
                if p.polygon != derived.polygon || p.frame != derived.frame {
                    return Err(plans::parcel_error(
                        invalid("Abgeleitete Parzelle stimmt nicht mit Straße überein"),
                        p,
                    ));
                }
            }
            if let Some(owners) = view.owners.get(&p.id) {
                for id in owners {
                    if let Some(SceneObject::House(h)) = view.lookup(id) {
                        if !parcel_geometry::covers_occupancy(
                            p,
                            &h.occupancy_contours,
                            &h.transform,
                        )? {
                            return Err(plans::with_object(
                                DomainViolation::ParcelContainment {
                                    house_id: h.id.clone(),
                                    parcel_id: p.id.clone(),
                                    geometry: None,
                                },
                                header,
                            ));
                        }
                    }
                }
            }
        }
        _ => {}
    }
    let road_id = match header {
        SceneObject::Road(r) => Some(&r.id),
        SceneObject::Parcel(Parcel {
            source: ParcelSource::Road { road_id, .. },
            ..
        }) => Some(road_id),
        _ => None,
    };
    if let Some(id) = road_id {
        let count = view.road_counts.get(id).copied().unwrap_or(0);
        if count > population::MAX_BOUND_PARCELS {
            return Err(DomainViolation::Limit {
                kind: "gebundene Parzellen".into(),
                actual: count,
                maximum: population::MAX_BOUND_PARCELS,
                object_ids: vec![id.clone()],
            }
            .into());
        }
    }
    Ok(())
}

pub(in crate::atlas) fn validate_header_shape(
    header: &SceneObject,
    prepared_roads: &PreparedRoads,
) -> Result<()> {
    ensure(
        !header.id().is_empty() && header.id().len() <= 120,
        "Ungültige Identität",
    )?;
    match header {
        SceneObject::House(h) => {
            ensure(
                name(&h.name)
                    && h.roof.len() == 7
                    && h.roof.starts_with('#')
                    && h.roof.as_bytes()[1..].iter().all(u8::is_ascii_hexdigit),
                "Ungültiger Gebäudename oder Dachfarbe",
            )?;
            ensure(
                valid_point([h.transform.x, h.transform.y])
                    && h.transform.angle.is_finite()
                    && h.occupancy_bounds == occupancy_bounds(&h.occupancy_contours, &h.transform)
                    && h.contours
                        .iter()
                        .chain(&h.occupancy_contours)
                        .flatten()
                        .all(|p| valid_point(world(*p, &h.transform))),
                "Ungültige Transformation oder Gebäude außerhalb der Welt",
            )?;
            if let Placement::Parcel {
                parcel_id,
                grid_pose,
            } = &h.placement
            {
                ensure(
                    !parcel_id.is_empty() && grid_pose.quarter_turns.0 <= 3,
                    "Ungültige Platzierung",
                )?;
            }
        }
        SceneObject::Road(r) => {
            ensure(
                name(&r.name) && r.width.is_finite() && (2.0..=100.0).contains(&r.width),
                "Straßenbreite muss 2–100 Fuß sein",
            )?;
            validate_road_identity(r)?;
            let p = prepared_roads
                .get(&r.id)
                .ok_or_else(|| invalid("Straßengeometrie fehlt"))?;
            ensure(
                p.matches_geometry(r) && r.path == p.path(),
                "Ungültige Straßenableitung",
            )?;
            if let Some(recipe) = &r.population_recipe {
                population::validate_settings(&recipe.settings)?;
            }
            ensure(
                r.population_recipe.is_some()
                    || r.sections.iter().all(|s| s.populated_sides.is_empty()),
                "Bebauungsmarker ohne Rezept",
            )?;
        }
        SceneObject::Parcel(p) => {
            ensure(
                simple_polygon(&p.polygon)
                    && valid_point([p.frame.x, p.frame.y])
                    && p.frame.angle.is_finite(),
                "Ungültige Parzelle",
            )?;
            if let ParcelSource::Road {
                road_id,
                section_id,
                start,
                end,
                setback,
                depth,
                ..
            } = &p.source
            {
                ensure(
                    !road_id.is_empty()
                        && !section_id.is_empty()
                        && start.is_finite()
                        && end.is_finite()
                        && 0.0 <= *start
                        && start < end
                        && *end <= 1.0
                        && setback.is_finite()
                        && (0.0..=1000.0).contains(setback)
                        && depth.is_finite()
                        && (5.0..=2000.0).contains(depth),
                    "Ungültige Parzellenquelle",
                )?;
            }
        }
        SceneObject::Area(a) => ensure(
            material(&a.material) && simple_polygon(&a.points),
            "Gelände benötigt ein einfaches Polygon mit 3–2048 Punkten",
        )?,
    }
    Ok(())
}
