use super::parcel_geometry::{self as parcels, Obstacle};
use crate::atlas::errors::{ensure, DomainViolation, ErrorCategory};
use crate::atlas::geometry::{bounds, expand, valid_point};
use crate::atlas::model::{
    required_option, GridPose, LocalPoint, Parcel, ParcelSource, Placement, Point, QuarterTurns,
    Road, SceneObject, Side, Transform,
};
use crate::atlas::{generation, plan_context, plans, Result};
use serde::{Deserialize, Serialize};
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum PopulationSide {
    Both,
    Left,
    Right,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[cfg_attr(test, ts(rename = "PopulationSettings"))]
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Settings {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[cfg_attr(test, ts(optional))]
    pub houses: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[cfg_attr(test, ts(optional))]
    pub layout: Option<Vec<PlannedParcel>>,
    pub side: PopulationSide,
    pub setback: f64,
    pub gap: f64,
    pub min_width: u32,
    pub max_width: u32,
    pub min_depth: u32,
    pub max_depth: u32,
    pub seed: u32,
    #[serde(deserialize_with = "required_option")]
    pub parcel_depth: Option<f64>,
}

/// Explicit draft layout uses section order, never preview object identities.
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PlannedParcel {
    pub key: String,
    pub section: usize,
    pub side: Side,
    pub start: f64,
    pub end: f64,
    pub setback: f64,
    pub depth: f64,
    pub width: u32,
    pub house_depth: u32,
    pub roof_index: u32,
    pub excluded: bool,
}

pub fn validate_settings(s: &Settings) -> Result<()> {
    if let Some(layout) = &s.layout {
        ensure(
            layout.len() <= MAX_BOUND_PARCELS,
            "Zu viele geplante Parzellen",
        )?;
        let mut keys = std::collections::HashSet::new();
        for p in layout {
            ensure(
                !p.key.is_empty()
                    && p.key.len() <= 120
                    && keys.insert(&p.key)
                    && p.section < 512
                    && p.start.is_finite()
                    && p.end.is_finite()
                    && 0.0 <= p.start
                    && p.start < p.end
                    && p.end <= 1.0
                    && p.setback.is_finite()
                    && (0.0..=1000.0).contains(&p.setback)
                    && p.depth.is_finite()
                    && (5.0..=2000.0).contains(&p.depth)
                    && (1..=64).contains(&p.width)
                    && (1..=64).contains(&p.house_depth)
                    && p.roof_index < 4,
                "Ungültige geplante Parzelle",
            )?;
        }
    }
    ensure(
        s.setback.is_finite()
            && (0.0..=1000.0).contains(&s.setback)
            && s.gap.is_finite()
            && (0.0..=1000.0).contains(&s.gap)
            && s.parcel_depth
                .is_none_or(|d| d.is_finite() && (5.0..=2000.0).contains(&d))
            && s.min_width >= 1
            && s.min_width <= s.max_width
            && s.max_width <= 64
            && s.min_depth >= 1
            && s.min_depth <= s.max_depth
            && s.max_depth <= 64,
        "Ungültige Bebauungseinstellungen",
    )
}

/// FNV-1a identity of a section/side stream, with unambiguous byte framing.
/// Algorithm 2 retains the v1 random stream; neither accepted-house count nor
/// SQL/header order enters this stream.
pub fn parcel_seed(seed: u32, section_id: &str, side: Side) -> u32 {
    let mut hash = 2_166_136_261_u32;
    for byte in b"saltmarcher.parcels\0v1\0"
        .iter()
        .copied()
        .chain(seed.to_le_bytes())
        .chain((section_id.len() as u32).to_le_bytes())
        .chain(section_id.bytes())
        .chain([match side {
            Side::Left => 0,
            Side::Right => 1,
        }])
    {
        hash = (hash ^ u32::from(byte)).wrapping_mul(16_777_619);
    }
    hash
}

pub struct ParcelRandom(u32);
impl ParcelRandom {
    pub fn for_section_side(seed: u32, section_id: &str, side: Side) -> Self {
        Self(parcel_seed(seed, section_id, side))
    }
    pub fn next_u32(&mut self) -> u32 {
        self.0 = self.0.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
        self.0
    }
    fn range(&mut self, min: u32, max: u32) -> u32 {
        min + self.next_u32() % (max - min + 1)
    }
}

/// An independently validatable parcel and exactly three random house values.
/// No identity is allocated until the whole slot has completed.
#[derive(Clone, Debug, PartialEq)]
pub struct ParcelSlot {
    pub section_id: String,
    pub side: Side,
    pub slot: usize,
    pub point: Point,
    pub width: u32,
    pub depth: u32,
    pub roof_index: u32,
    pub source: ParcelSource,
    pub geometry: parcels::ParcelGeometry,
}
impl ParcelSlot {
    pub fn parcel(&self, id: String) -> Parcel {
        Parcel {
            id,
            source: self.source.clone(),
            polygon: self.geometry.polygon.clone(),
            frame: self.geometry.frame.clone(),
        }
    }
    pub fn contours(&self) -> Vec<Vec<LocalPoint>> {
        vec![vec![
            LocalPoint([0.0, 0.0]),
            LocalPoint([f64::from(self.width), 0.0]),
            LocalPoint([f64::from(self.width), f64::from(self.depth)]),
            LocalPoint([0.0, f64::from(self.depth)]),
        ]]
    }
}
#[derive(Clone, Debug, PartialEq)]
pub struct InitialHousePlacement {
    pub grid_pose: GridPose,
    pub transform: Transform,
}
#[derive(Clone, Debug, PartialEq)]
pub struct AcceptedParcel {
    pub slot: ParcelSlot,
    pub house: Option<InitialHousePlacement>,
    pub unplaced: Option<generation::HouseUnplacedCode>,
}
#[derive(Clone, Debug, Default, PartialEq)]
pub struct GeneratedCandidates {
    pub parcels: Vec<AcceptedParcel>,
    pub diagnostics: Vec<generation::GenerationDiagnostic>,
    /// A begun side stays closed even if every slot is rejected or budget ends.
    pub started_sides: Vec<(String, Side)>,
    pub limit: Option<generation::GenerationLimit>,
    pub attempts: usize,
    pub cell_count: u32,
    pub house_count: usize,
}
pub const MAX_BOUND_PARCELS: usize = 200;
pub const MAX_NEW_HOUSES: usize = 200;
pub const MAX_NEW_CELLS: u32 = 100_000;
pub const MAX_ATTEMPTS: usize = 10_000;

/// Lazy finite integer poses ordered by (abs(x-x0), y, x). Start at the nearest
/// legal x, so a distant finite interval never causes coordinate-skipping work.
struct GridPoses {
    min_x: i64,
    max_x: i64,
    min_y: i64,
    max_y: i64,
    x0: i64,
    distance: i64,
    max_distance: i64,
    y: i64,
    right_pending: bool,
    done: bool,
}
impl GridPoses {
    fn new(slot: &ParcelSlot) -> Self {
        let frame = &slot.geometry.frame;
        let (sin, cos) = frame.angle.sin_cos();
        let local = bounds(slot.geometry.polygon.iter().map(|p| {
            let dx = p[0] - frame.x;
            let dy = p[1] - frame.y;
            [(dx * cos + dy * sin) / 5.0, (-dx * sin + dy * cos) / 5.0]
        }));
        // A world epsilon projects onto either local axis by at most sqrt(2).
        // Include the maximum house extent when bounding its world magnitude.
        let epsilon =
            (parcels::predicate_epsilon(std::slice::from_ref(&slot.geometry.polygon), &[])
                + 640.0e-12)
                * std::f64::consts::SQRT_2
                / 5.0;
        let min_x = (local[0] - epsilon).ceil() as i64;
        let max_x = (local[2] - f64::from(slot.width) + epsilon).floor() as i64;
        let min_y = ((local[1] - epsilon).ceil() as i64).max(0);
        let max_y = (local[3] - f64::from(slot.depth) + epsilon).floor() as i64;
        let x0 = -i64::from(slot.width / 2);
        let done = !local.iter().all(|v| v.is_finite()) || min_x > max_x || min_y > max_y;
        let x = if done { x0 } else { x0.clamp(min_x, max_x) };
        let distance = x.abs_diff(x0) as i64;
        let max_distance = min_x.abs_diff(x0).max(max_x.abs_diff(x0)) as i64;
        Self {
            min_x,
            max_x,
            min_y,
            max_y,
            x0,
            distance,
            max_distance,
            y: min_y,
            right_pending: false,
            done,
        }
    }
    fn advance_row(&mut self) {
        if self.y < self.max_y {
            self.y += 1;
        } else {
            self.y = self.min_y;
            if self.distance < self.max_distance {
                self.distance += 1;
            } else {
                self.done = true;
            }
        }
    }
}
impl Iterator for GridPoses {
    type Item = GridPose;
    fn next(&mut self) -> Option<Self::Item> {
        if self.done {
            return None;
        }
        let left = self.x0 - self.distance;
        let right = self.x0 + self.distance;
        let x;
        let y = self.y;
        if self.right_pending {
            x = right;
            self.right_pending = false;
            self.advance_row();
        } else if left >= self.min_x && left <= self.max_x {
            x = left;
            if self.distance > 0 && right >= self.min_x && right <= self.max_x {
                self.right_pending = true;
            } else {
                self.advance_row();
            }
        } else {
            x = right;
            self.advance_row();
        }
        let pose = GridPose {
            x_cells: x,
            y_cells: y,
            quarter_turns: QuarterTurns(0),
        };
        Some(pose)
    }
}

/// Query existing final headers once per parcel bounds plus gap, never per pose.
#[cfg(test)]
fn generate_candidates(
    road: &Road,
    settings: &Settings,
    bound_parcel_count: usize,
    nearby: impl FnMut(&ParcelSlot) -> Result<Vec<SceneObject>>,
) -> Result<GeneratedCandidates> {
    let prepared = parcels::PreparedRoadGeometry::new(road)?;
    generate_prepared_candidates(road, &prepared, settings, bound_parcel_count, nearby)
}

pub(in crate::atlas) fn generate_prepared_candidates(
    road: &Road,
    prepared: &parcels::PreparedRoadGeometry,
    settings: &Settings,
    bound_parcel_count: usize,
    mut nearby: impl FnMut(&ParcelSlot) -> Result<Vec<SceneObject>>,
) -> Result<GeneratedCandidates> {
    generate_with_attempt_limit(
        road,
        prepared,
        settings,
        bound_parcel_count,
        &mut nearby,
        MAX_ATTEMPTS,
    )
}
fn generate_with_attempt_limit(
    road: &Road,
    prepared: &parcels::PreparedRoadGeometry,
    settings: &Settings,
    bound_parcel_count: usize,
    mut nearby: impl FnMut(&ParcelSlot) -> Result<Vec<SceneObject>>,
    attempt_limit: usize,
) -> Result<GeneratedCandidates> {
    use generation::{
        GenerationDiagnostic, GenerationLimit, GenerationLocation, HouseUnplacedCode,
        ParcelSkipCode,
    };
    ensure(
        prepared.matches_geometry(road),
        "Fremde vorbereitete Straße",
    )?;
    validate_settings(settings)?;
    if bound_parcel_count > MAX_BOUND_PARCELS {
        return Err(DomainViolation::Limit {
            kind: "gebundene Parzellen".into(),
            actual: bound_parcel_count,
            maximum: MAX_BOUND_PARCELS,
            object_ids: vec![road.id.clone()],
        }
        .into());
    }
    let depth = settings
        .parcel_depth
        .unwrap_or(5.0 * f64::from(settings.max_depth) + settings.gap);
    let mut generated = GeneratedCandidates::default();
    let mut accepted_index = plan_context::HeaderSpatialIndex::default();
    let sections: Vec<_> = prepared.sections().collect();
    if let Some(layout) = &settings.layout {
        ensure(
            layout.iter().all(|p| p.section < sections.len()),
            "Geplanter Straßenabschnitt fehlt",
        )?;
    }
    for (section_index, (section_id, table)) in sections.into_iter().enumerate() {
        let record = road
            .sections
            .iter()
            .find(|r| r.id == section_id)
            .expect("validated sections");
        for side in [Side::Left, Side::Right] {
            if record.populated_sides.contains(&side)
                || settings.side == PopulationSide::Left && side != Side::Left
                || settings.side == PopulationSide::Right && side != Side::Right
            {
                continue;
            }
            let mut random = ParcelRandom::for_section_side(settings.seed, section_id, side);
            let mut cursor = 0.0;
            let mut slot_index = 0;
            let explicit: Option<Vec<_>> = settings.layout.as_ref().map(|layout| {
                layout
                    .iter()
                    .filter(|p| p.section == section_index && p.side == side)
                    .collect()
            });
            while explicit
                .as_ref()
                .map_or(cursor < table.total_length(), |v| slot_index < v.len())
            {
                if bound_parcel_count + generated.parcels.len() >= MAX_BOUND_PARCELS {
                    generated.limit = Some(GenerationLimit::BoundParcels);
                    return Ok(generated);
                }
                if generated.attempts == attempt_limit {
                    generated.limit = Some(GenerationLimit::Attempts);
                    return Ok(generated);
                }
                if slot_index == 0 {
                    generated.started_sides.push((section_id.to_owned(), side));
                }
                generated.attempts += 1;
                // Exactly three draws even for rejected or incomplete final slots.
                let mut width = random.range(settings.min_width, settings.max_width);
                let mut house_depth = random.range(settings.min_depth, settings.max_depth);
                let mut roof_index = random.next_u32() % 4;
                let mut start = cursor;
                let mut setback = settings.setback;
                let mut parcel_depth = depth;
                cursor += 5.0 * f64::from(width + width % 2) + settings.gap;
                if let Some(layout) = &explicit {
                    let p = layout[slot_index];
                    if p.excluded {
                        slot_index += 1;
                        continue;
                    }
                    start = p.start * table.total_length();
                    cursor = p.end * table.total_length();
                    setback = p.setback;
                    parcel_depth = p.depth;
                    width = p.width;
                    house_depth = p.house_depth;
                    roof_index = p.roof_index;
                } else if cursor > table.total_length() {
                    break;
                }
                let point = parcels::sample_arc(table, (start + cursor) / 2.0)?.point;
                let location = GenerationLocation {
                    road_id: road.id.clone(),
                    section_id: section_id.to_owned(),
                    side,
                    slot_index,
                    point,
                    message: String::new(),
                };
                let source = ParcelSource::Road {
                    road_id: road.id.clone(),
                    section_id: section_id.to_owned(),
                    side,
                    start: start / table.total_length(),
                    end: cursor / table.total_length(),
                    setback,
                    depth: parcel_depth,
                };
                let geometry = match parcels::derive_from_arc(
                    road.width,
                    table,
                    side,
                    start / table.total_length(),
                    cursor / table.total_length(),
                    setback,
                    parcel_depth,
                ) {
                    Ok(g) => g,
                    Err(error)
                        if error.category == ErrorCategory::InvalidInput && explicit.is_none() =>
                    {
                        generated.diagnostics.push(GenerationDiagnostic::Parcel {
                            location: GenerationLocation {
                                message: error.message,
                                ..location
                            },
                            code: ParcelSkipCode::InvalidParcelGeometry,
                            obstacle_ids: None,
                        });
                        slot_index += 1;
                        continue;
                    }
                    Err(error) => return Err(error),
                };
                let mut slot = ParcelSlot {
                    section_id: section_id.to_owned(),
                    side,
                    slot: slot_index,
                    point,
                    width,
                    depth: house_depth,
                    roof_index,
                    source,
                    geometry,
                };
                let parcel = slot.parcel(String::new());
                let b = expand(bounds(parcel.polygon.iter().copied()), settings.gap);
                let existing = nearby(&slot)?;
                let previous = accepted_index.query(b);
                let mut conflict_ids = vec![];
                let mut blocked = parcels::parcel_conflict(&parcel, Obstacle::Road(road))?;
                if blocked {
                    conflict_ids.push(road.id.clone());
                }
                for other in &existing {
                    if let Some(obstacle) = plans::obstacle(other) {
                        // Transient IDs never confer the owner exception.
                        if slot_conflict(&parcel, obstacle)? {
                            blocked = true;
                            conflict_ids.push(other.id().to_owned());
                            break;
                        }
                    }
                }
                if !blocked {
                    for &i in &previous {
                        let other: &AcceptedParcel = &generated.parcels[i];
                        if parcels::parcel_conflict(
                            &parcel,
                            Obstacle::Parcel(&other.slot.parcel(String::new())),
                        )? {
                            blocked = true;
                            break;
                        }
                        if let Some(h) = &other.house {
                            if parcels::parcel_occupancy_conflict(
                                &parcel,
                                &Placement::Free {},
                                &other.slot.contours(),
                                &h.transform,
                            )? {
                                blocked = true;
                                break;
                            }
                        }
                    }
                }
                if blocked {
                    ensure(
                        explicit.is_none(),
                        "Geplante Parzelle kollidiert mit bestehender Geometrie",
                    )?;
                    generated.diagnostics.push(GenerationDiagnostic::Parcel {
                        location: GenerationLocation {
                            message: "Parzelle kollidiert mit bestehender Geometrie".into(),
                            ..location
                        },
                        code: ParcelSkipCode::ParcelCollision,
                        obstacle_ids: (!conflict_ids.is_empty()).then_some(conflict_ids),
                    });
                    slot_index += 1;
                    continue;
                }
                let mut house = None;
                let mut contained = false;
                let mut sizes = vec![(width, house_depth)];
                let mut smaller: Vec<_> = (settings.min_width..=width)
                    .flat_map(|w| (settings.min_depth..=house_depth).map(move |d| (w, d)))
                    .filter(|size| *size != (width, house_depth))
                    .collect();
                smaller.sort_by_key(|(w, d)| (std::cmp::Reverse(w * d), std::cmp::Reverse(*w)));
                sizes.extend(smaller);
                if settings.houses == Some(false) {
                    sizes.clear();
                }
                'sizes: for (size_index, (w, d)) in sizes.into_iter().enumerate() {
                    if size_index > 0 {
                        if generated.attempts == attempt_limit {
                            generated.limit = Some(GenerationLimit::Attempts);
                            return Ok(generated);
                        }
                        generated.attempts += 1;
                    }
                    slot.width = w;
                    slot.depth = d;
                    let contours = slot.contours();
                    for pose in GridPoses::new(&slot) {
                        if generated.attempts == attempt_limit {
                            generated.limit = Some(GenerationLimit::Attempts);
                            return Ok(generated);
                        }
                        generated.attempts += 1;
                        let transform = match parcels::parcel_house_transform(&parcel.frame, &pose)
                        {
                            Ok(t) => t,
                            Err(error) if error.category == ErrorCategory::InvalidInput => continue,
                            Err(error) => return Err(error),
                        };
                        if !parcels::occupancy_world(&contours, &transform)
                            .iter()
                            .flatten()
                            .copied()
                            .all(valid_point)
                            || !parcels::covers_occupancy(&parcel, &contours, &transform)?
                        {
                            continue;
                        }
                        contained = true;
                        if house_conflict(&slot, &transform, Obstacle::Road(road), settings.gap)? {
                            continue;
                        }
                        let mut collision = false;
                        for other in &existing {
                            if let Some(obstacle) = plans::obstacle(other) {
                                if house_conflict(&slot, &transform, obstacle, settings.gap)? {
                                    collision = true;
                                    break;
                                }
                            }
                        }
                        if collision {
                            continue;
                        }
                        for &i in &previous {
                            let other = &generated.parcels[i];
                            if house_conflict(
                                &slot,
                                &transform,
                                Obstacle::Parcel(&other.slot.parcel(String::new())),
                                settings.gap,
                            )? {
                                collision = true;
                                break;
                            }
                            if let Some(h) = &other.house {
                                if parcels::occupancy_clearance(
                                    &contours,
                                    &transform,
                                    &other.slot.contours(),
                                    &h.transform,
                                    settings.gap,
                                )? {
                                    collision = true;
                                    break;
                                }
                            }
                        }
                        if !collision {
                            house = Some(InitialHousePlacement {
                                grid_pose: pose,
                                transform,
                            });
                            break 'sizes;
                        }
                    }
                }
                if house.is_some() {
                    if generated.house_count == MAX_NEW_HOUSES {
                        generated.limit = Some(GenerationLimit::NewHouses);
                        return Ok(generated);
                    }
                    if generated.cell_count + slot.width * slot.depth > MAX_NEW_CELLS {
                        generated.limit = Some(GenerationLimit::NewCells);
                        return Ok(generated);
                    }
                    generated.house_count += 1;
                    generated.cell_count += slot.width * slot.depth;
                }
                let unplaced =
                    (house.is_none() && settings.houses != Some(false)).then_some(if contained {
                        HouseUnplacedCode::ClearanceBlocked
                    } else {
                        HouseUnplacedCode::NoGridFit
                    });
                accepted_index.insert(&SceneObject::Parcel(parcel), generated.parcels.len());
                generated.parcels.push(AcceptedParcel {
                    slot,
                    house,
                    unplaced,
                });
                slot_index += 1;
            }
        }
    }
    Ok(generated)
}

fn slot_conflict(parcel: &Parcel, obstacle: Obstacle<'_>) -> Result<bool> {
    if let Obstacle::House {
        occupancy_contours,
        transform,
        ..
    } = obstacle
    {
        // New parcel has no owner yet, including obstacles with empty IDs.
        return parcels::parcel_occupancy_conflict(
            parcel,
            &Placement::Free {},
            occupancy_contours,
            transform,
        );
    }
    parcels::parcel_conflict(parcel, obstacle)
}
fn house_conflict(
    slot: &ParcelSlot,
    transform: &Transform,
    obstacle: Obstacle<'_>,
    gap: f64,
) -> Result<bool> {
    let contours = slot.contours();
    if parcels::house_conflict(&Placement::Free {}, &contours, transform, obstacle)? {
        return Ok(true);
    }
    if let Obstacle::House {
        contours: other,
        transform: other_transform,
        ..
    } = obstacle
    {
        return parcels::occupancy_clearance(&contours, transform, other, other_transform, gap);
    }
    Ok(false)
}

#[cfg(test)]
#[path = "population_tests.rs"]
mod tests;
