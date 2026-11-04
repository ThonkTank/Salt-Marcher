//! Pure parcel geometry. Persisted polygons never contain the predicate buffers.
//!
//! All predicate operands are translated by their common bounds centre before
//! ring nesting, DE-9IM, buffering or intersection. Tolerances are measured in
//! original world feet, not in cells or in the translated coordinates.
use crate::atlas::errors::{ensure, invalid};
use crate::atlas::geometry::{
    add, bounds, distance, dot, edges, expand, intersects, length, mul, segment_distance,
    shape_distance, sub, valid_point, world, EPS,
};
#[cfg(test)]
use crate::atlas::geometry::{contains, contours, occupancy_contours};
use crate::atlas::model::{
    GridPose, LocalPoint, Node, Parcel, ParcelSource, Placement, Point, QuarterTurns, Road, Side,
    Transform,
};
use crate::atlas::validation::validate_road_identity;
use crate::atlas::{geometry, Result};
use geo::algorithm::Validation;
use geo::{
    Area as GeoArea, BooleanOps, Buffer, Contains, LineString, MultiPolygon, Polygon, Relate,
};
use std::collections::HashMap;
use std::f64::consts::{FRAC_PI_2, PI, TAU};

const MAX_SAMPLES: usize = 32_768;
const MAX_POLYGON_POINTS: usize = 2_048;
const MITER_LIMIT: f64 = 4.0;
pub const GRID_TOLERANCE_CELLS: f64 = 1e-8;
pub const GRID_TOLERANCE_RADIANS: f64 = 1e-10;

/// Both path products share raw edge samples. Full-path dedup remains the
/// historical final `dedup_by`; section dedup remains incremental per section.
/// Raw samples, including duplicates/zero edges, consume the shared road limit.
#[derive(Clone, Debug)]
pub struct PreparedRoadGeometry {
    road_id: String,
    width: f64,
    nodes: Vec<Node>,
    edge_sections: Vec<String>,
    path: Vec<Point>,
    section_order: Vec<String>,
    sections: HashMap<String, ArcTable>,
}
impl PreparedRoadGeometry {
    pub fn new(road: &Road) -> Result<Self> {
        validate_road_identity(road)?;
        ensure(
            (2..=512).contains(&road.nodes.len()),
            "Straße benötigt 2–512 Punkte",
        )?;
        for node in &road.nodes {
            ensure(
                valid_point(node.point)
                    && node.incoming.is_none_or(valid_point)
                    && node.outgoing.is_none_or(valid_point),
                "Ungültiger Straßenpunkt",
            )?;
        }

        let mut paths: Vec<(String, Vec<Point>)> = Vec::new();
        let mut full = vec![road.nodes[0].point];
        let mut samples = 1;
        for (index, nodes) in road.nodes.windows(2).enumerate() {
            let mut raw = vec![nodes[0].point];

            geometry::flatten(
                nodes[0].point,
                nodes[0].outgoing.unwrap_or(nodes[0].point),
                nodes[1].incoming.unwrap_or(nodes[1].point),
                nodes[1].point,
                0,
                &mut raw,
            )?;

            samples += raw.len() - 1;
            ensure(samples <= MAX_SAMPLES, "Straße ist zu komplex")?;
            full.extend(raw.iter().skip(1).copied());
            let id = &road.edge_sections[index];
            if paths.last().is_none_or(|(previous, _)| previous != id) {
                paths.push((id.clone(), vec![raw[0]]));
            }
            let points = &mut paths.last_mut().expect("section").1;
            for point in raw.into_iter().skip(1) {
                if distance(*points.last().expect("start"), point) >= EPS {
                    points.push(point);
                }
            }
        }
        full.dedup_by(|a, b| distance(*a, *b) < EPS);
        ensure(full.len() >= 2, "Straße hat keine Länge")?;
        let mut section_order = vec![];
        let mut sections = HashMap::new();
        for (id, path) in paths {
            ensure(path.len() >= 2, "Straßenabschnitt hat keine Länge")?;
            section_order.push(id.clone());
            sections.insert(id, arc_table(&path)?);
        }
        Ok(Self {
            road_id: road.id.clone(),
            width: road.width,
            nodes: road.nodes.clone(),
            edge_sections: road.edge_sections.clone(),
            path: full,
            section_order,
            sections,
        })
    }
    pub fn path(&self) -> &[Point] {
        &self.path
    }
    pub fn sections(&self) -> impl Iterator<Item = (&str, &ArcTable)> {
        self.section_order
            .iter()
            .map(|id| (id.as_str(), &self.sections[id]))
    }
    pub fn matches_geometry(&self, road: &Road) -> bool {
        self.road_id == road.id
            && self.width == road.width
            && self.nodes == road.nodes
            && self.edge_sections == road.edge_sections
    }
    pub fn derive(&self, source: &ParcelSource) -> Result<ParcelGeometry> {
        let ParcelSource::Road {
            road_id,
            section_id,
            side,
            start,
            end,
            setback,
            depth,
        } = source
        else {
            return Err(invalid("Gelöste Parzellen haben keine Straßenableitung"));
        };
        ensure(road_id == &self.road_id, "Fremde Parzellenstraße")?;
        let table = self
            .sections
            .get(section_id)
            .ok_or_else(|| invalid("Straßenabschnitt fehlt"))?;
        derive_from_arc(self.width, table, *side, *start, *end, *setback, *depth)
    }
}

// Fixture conveniences. Production plans retain one PreparedRoadGeometry.
#[cfg(test)]
pub fn section_paths(road: &Road) -> Result<Vec<(String, Vec<Point>)>> {
    Ok(PreparedRoadGeometry::new(road)?
        .sections()
        .map(|(id, table)| (id.to_owned(), table.points().to_vec()))
        .collect())
}
#[cfg(test)]
pub fn section_path(road: &Road, section_id: &str) -> Result<Vec<Point>> {
    section_paths(road)?
        .into_iter()
        .find(|(id, _)| id == section_id)
        .map(|(_, path)| path)
        .ok_or_else(|| invalid("Straßenabschnitt fehlt"))
}

/// Exact De Casteljau control polygons for P3's node insertion. The caller owns
/// node identity and section assignment; this function only splits geometry.
pub fn split_bezier(control: [Point; 4], t: f64) -> Result<[[Point; 4]; 2]> {
    ensure(
        t.is_finite() && 0.0 < t && t < 1.0 && control.iter().copied().all(valid_point),
        "Ungültige Kurventeilung",
    )?;
    let blend = |a, b| add(mul(a, 1.0 - t), mul(b, t));
    let [a, b, c, d] = control;
    let ab = blend(a, b);
    let bc = blend(b, c);
    let cd = blend(c, d);
    let abc = blend(ab, bc);
    let bcd = blend(bc, cd);
    let middle = blend(abc, bcd);
    Ok([[a, ab, abc, middle], [middle, bcd, cd, d]])
}

#[derive(Clone, Debug)]
pub struct ArcTable {
    points: Vec<Point>,
    lengths: Vec<f64>,
}

#[cfg(test)]
#[path = "parcel_geometry_tests.rs"]
mod tests;
impl ArcTable {
    pub fn total_length(&self) -> f64 {
        *self.lengths.last().expect("positive path")
    }
    pub fn points(&self) -> &[Point] {
        &self.points
    }
}

pub fn arc_table(path: &[Point]) -> Result<ArcTable> {
    ensure(path.len() <= MAX_SAMPLES, "Straße ist zu komplex")?;
    let mut points = Vec::new();
    for &point in path {
        ensure(valid_point(point), "Pfad außerhalb der Welt")?;
        if points.last().is_none_or(|p| distance(*p, point) >= EPS) {
            points.push(point);
        }
    }
    ensure(points.len() >= 2, "Straßenabschnitt hat keine Länge")?;
    let mut lengths = vec![0.0];
    for pair in points.windows(2) {
        lengths.push(lengths.last().expect("start") + distance(pair[0], pair[1]));
    }
    Ok(ArcTable { points, lengths })
}

fn unit(vector: Point) -> Result<Point> {
    let n = length(vector);
    ensure(
        n.is_finite() && n > 1e-12,
        "Spitze oder Umkehr im Parzellenpfad",
    )?;
    Ok(mul(vector, 1.0 / n))
}

#[derive(Clone, Copy, Debug)]
pub struct ArcSample {
    pub point: Point,
    pub tangent: Point,
}

/// `s` is an absolute arc length in feet. At a join the tangent is the
/// normalized angular bisector, never an arbitrary preceding/following edge.
pub fn sample_arc(table: &ArcTable, s: f64) -> Result<ArcSample> {
    ensure(
        s.is_finite() && (0.0..=table.total_length()).contains(&s),
        "Bogenlänge außerhalb des Pfads",
    )?;
    let last = table.points.len() - 1;
    let i = table.lengths.partition_point(|v| *v < s).max(1).min(last);
    let a = table.points[i - 1];
    let b = table.points[i];
    let tangent = unit(sub(b, a))?;
    let point = add(a, mul(tangent, s - table.lengths[i - 1]));
    // A scale-dependent ULP allowance only selects the correct join tangent;
    // it never moves an input pose or a parcel boundary.
    let join_noise = 8.0 * f64::EPSILON * table.total_length().max(1.0);
    if i < last && (s - table.lengths[i]).abs() <= join_noise {
        return Ok(ArcSample {
            point: if s == table.lengths[i] { b } else { point },
            tangent: unit(add(tangent, unit(sub(table.points[i + 1], b))?))?,
        });
    }
    if i > 1 && (s - table.lengths[i - 1]).abs() <= join_noise {
        return Ok(ArcSample {
            point: if s == table.lengths[i - 1] { a } else { point },
            tangent: unit(add(unit(sub(a, table.points[i - 2]))?, tangent))?,
        });
    }
    Ok(ArcSample { point, tangent })
}

fn cut_arc(table: &ArcTable, start: f64, end: f64) -> Result<Vec<Point>> {
    let mut points = vec![sample_arc(table, start)?.point];
    for (point, &s) in table.points.iter().zip(&table.lengths) {
        if s > start && s < end {
            points.push(*point);
        }
    }
    points.push(sample_arc(table, end)?.point);
    points.dedup_by(|a, b| distance(*a, *b) < EPS);
    ensure(points.len() >= 2, "Parzellenfront hat keine Länge")?;
    Ok(points)
}

fn outward(tangent: Point, side: Side) -> Point {
    match side {
        Side::Left => [tangent[1], -tangent[0]],
        Side::Right => [-tangent[1], tangent[0]],
    }
}

fn offset_chain(path: &[Point], side: Side, offset: f64) -> Result<Vec<Point>> {
    let tangents: Vec<_> = path
        .windows(2)
        .map(|pair| unit(sub(pair[1], pair[0])))
        .collect::<Result<_>>()?;
    let mut chain = vec![add(path[0], mul(outward(tangents[0], side), offset))];
    for i in 1..path.len() - 1 {
        let a = tangents[i - 1];
        let b = tangents[i];
        let denominator = 1.0 + dot(a, b);
        ensure(denominator > 1e-12, "Spitze oder Umkehr im Parzellenpfad")?;
        let miter = mul(add(outward(a, side), outward(b, side)), 1.0 / denominator);
        ensure(
            length(miter) <= MITER_LIMIT + 1e-12,
            "Parzelle überschreitet Miter-Limit 4",
        )?;
        chain.push(add(path[i], mul(miter, offset)));
    }
    chain.push(add(
        *path.last().expect("end"),
        mul(outward(*tangents.last().expect("tangent"), side), offset),
    ));
    ensure(
        chain
            .windows(2)
            .zip(&tangents)
            .all(|(pair, tangent)| dot(sub(pair[1], pair[0]), *tangent) > 0.0),
        "Offsetkette hat eine Spitze oder Umkehr",
    )?;
    ensure(
        chain.iter().copied().all(valid_point),
        "Parzelle außerhalb der Welt",
    )?;
    Ok(chain)
}

fn ring(points: &[Point]) -> LineString<f64> {
    let mut coordinates: Vec<_> = points.iter().map(|p| (p[0], p[1])).collect();
    if let Some(first) = coordinates.first().copied() {
        coordinates.push(first);
    }
    LineString::from(coordinates)
}

/// Canonical open ring, positive signed area, smallest (x,y) first. This rejects
/// invalid strips; it does not repair, split, simplify or take a convex hull.
pub fn canonical_polygon(mut points: Vec<Point>) -> Result<Vec<Point>> {
    ensure(
        (3..=MAX_POLYGON_POINTS).contains(&points.len()) && points.iter().copied().all(valid_point),
        "Parzelle benötigt 3–2048 gültige Polygonpunkte",
    )?;
    let b = bounds(points.iter().copied());
    let centre = [(b[0] + b[2]) / 2.0, (b[1] + b[3]) / 2.0];
    let local: Vec<_> = points.iter().map(|p| sub(*p, centre)).collect();
    let polygon = Polygon::new(ring(&local), vec![]);
    ensure(
        polygon.is_valid()
            && polygon.unsigned_area() > 0.0
            && local
                .iter()
                .zip(local.iter().cycle().skip(1))
                .take(local.len())
                .all(|(a, b)| a != b),
        "Parzellenpolygon ist nicht einfach oder hat keine Fläche",
    )?;
    // Geo's validation rejects crossings and self-touches, including spikes.
    if polygon.signed_area() < 0.0 {
        points.reverse();
    }
    let first = (0..points.len())
        .min_by(|&a, &b| {
            points[a][0]
                .total_cmp(&points[b][0])
                .then(points[a][1].total_cmp(&points[b][1]))
        })
        .expect("polygon");
    points.rotate_left(first);
    Ok(points)
}

#[derive(Clone, Debug, PartialEq)]
pub struct ParcelGeometry {
    pub polygon: Vec<Point>,
    pub frame: Transform,
}

#[cfg(test)]
pub fn derive_parcel(road: &Road, source: &ParcelSource) -> Result<ParcelGeometry> {
    PreparedRoadGeometry::new(road)?.derive(source)
}

pub(in crate::atlas) fn derive_from_arc(
    width: f64,
    table: &ArcTable,
    side: Side,
    start: f64,
    end: f64,
    setback: f64,
    depth: f64,
) -> Result<ParcelGeometry> {
    ensure(
        width.is_finite()
            && (2.0..=100.0).contains(&width)
            && start.is_finite()
            && end.is_finite()
            && 0.0 <= start
            && start < end
            && end <= 1.0
            && setback.is_finite()
            && (0.0..=1000.0).contains(&setback)
            && depth.is_finite()
            && (5.0..=2000.0).contains(&depth),
        "Ungültige Parzellenquelle",
    )?;
    let path = cut_arc(
        table,
        start * table.total_length(),
        end * table.total_length(),
    )?;
    let front = offset_chain(&path, side, width / 2.0 + setback)?;
    let back = offset_chain(&path, side, width / 2.0 + setback + depth)?;
    ensure(
        front.len() + back.len() <= MAX_POLYGON_POINTS,
        "Parzelle ist zu komplex",
    )?;
    let front_table = arc_table(&front)?;
    let middle = sample_arc(&front_table, front_table.total_length() / 2.0)?;
    let y = outward(middle.tangent, side);
    let frame = Transform {
        x: middle.point[0],
        y: middle.point[1],
        angle: (-y[0]).atan2(y[1]),
    };
    let polygon = canonical_polygon(front.into_iter().chain(back.into_iter().rev()).collect())?;
    Ok(ParcelGeometry { polygon, frame })
}

fn angle(value: f64) -> f64 {
    (value + PI).rem_euclid(TAU) - PI
}

/// Composition uses exact integer quarter rotations. The only trigonometry is
/// the parcel frame, shared by all houses in this grid.
pub fn parcel_house_transform(frame: &Transform, pose: &GridPose) -> Result<Transform> {
    ensure(
        valid_point([frame.x, frame.y])
            && frame.angle.is_finite()
            && pose.quarter_turns.0 <= 3
            && pose.x_cells.unsigned_abs() <= (1_u64 << 53)
            && pose.y_cells.unsigned_abs() <= (1_u64 << 53),
        "Ungültige Rasterpose",
    )?;
    let position = world(
        LocalPoint([pose.x_cells as f64, pose.y_cells as f64]),
        frame,
    );
    ensure(valid_point(position), "Haus außerhalb der Welt")?;
    Ok(Transform {
        x: position[0],
        y: position[1],
        angle: angle(frame.angle + f64::from(pose.quarter_turns.0) * FRAC_PI_2),
    })
}

/// Accepts numerical noise only. Return the integral pose and its canonical
/// world transform together, so callers never persist the noisy input.
pub fn parcel_grid_pose(frame: &Transform, transform: &Transform) -> Result<(GridPose, Transform)> {
    ensure(
        valid_point([frame.x, frame.y])
            && frame.angle.is_finite()
            && valid_point([transform.x, transform.y])
            && transform.angle.is_finite(),
        "Ungültige Transformation",
    )?;
    let (sin, cos) = frame.angle.sin_cos();
    let dx = transform.x - frame.x;
    let dy = transform.y - frame.y;
    let x = (dx * cos + dy * sin) / 5.0;
    let y = (-dx * sin + dy * cos) / 5.0;
    let quarter = (angle(transform.angle - frame.angle) / FRAC_PI_2).round();
    ensure(
        (x - x.round()).abs() <= GRID_TOLERANCE_CELLS
            && (y - y.round()).abs() <= GRID_TOLERANCE_CELLS
            && angle(transform.angle - frame.angle - quarter * FRAC_PI_2).abs()
                <= GRID_TOLERANCE_RADIANS,
        "Haus ist nicht am Parzellenraster ausgerichtet",
    )?;
    let pose = GridPose {
        x_cells: x.round() as i64,
        y_cells: y.round() as i64,
        quarter_turns: QuarterTurns((quarter as i64).rem_euclid(4) as u8),
    };
    let canonical = parcel_house_transform(frame, &pose)?;
    Ok((pose, canonical))
}

/// Original world coordinates determine epsilon, including near the world edge.
pub fn predicate_epsilon(a: &[Vec<Point>], b: &[Vec<Point>]) -> f64 {
    let magnitude = a
        .iter()
        .chain(b)
        .flatten()
        .flatten()
        .fold(1.0_f64, |m, c| m.max(c.abs()));
    1e-6 + 1e-12 * magnitude
}

type Rings = Vec<Vec<Point>>;
fn shifted_pair(a: &[Vec<Point>], b: &[Vec<Point>]) -> Result<(Rings, Rings)> {
    ensure(
        a.iter().chain(b).flatten().copied().all(valid_point),
        "Geometrie außerhalb der Welt",
    )?;
    let bounds = bounds(a.iter().chain(b).flatten().copied());
    if !bounds[0].is_finite() {
        return Ok((vec![], vec![]));
    }
    let centre = [(bounds[0] + bounds[2]) / 2.0, (bounds[1] + bounds[3]) / 2.0];
    let shift = |rings: &[Vec<Point>]| {
        rings
            .iter()
            .map(|r| r.iter().map(|p| sub(*p, centre)).collect())
            .collect()
    };
    Ok((shift(a), shift(b)))
}

/// Even nesting depths are exterior components; odd depths are holes. Winding
/// and incoming ring order carry no semantic information. Islands inside holes
/// become separate polygons; point-touching components stay separate.
fn rings_geometry(rings: &[Vec<Point>]) -> Result<MultiPolygon<f64>> {
    // The cell-boundary walker can emit a weakly simple ring when an inner
    // courtyard touches the exterior at a single grid vertex. Split only at
    // repeated vertices; this preserves every boundary edge and its area. It
    // does not repair crossings, invent edges, or union invalid polygons.
    let mut simple_rings = Vec::new();
    for ring in rings {
        let mut stack: Vec<Point> = Vec::new();
        let mut positions = HashMap::new();
        let key = |p: Point| p.map(|v| if v == 0.0 { 0 } else { v.to_bits() });
        for &point in ring.iter().chain(ring.first()) {
            if let Some(&index) = positions.get(&key(point)) {
                let cycle = stack[index..].to_vec();
                ensure(cycle.len() >= 3, "Ungültige Belegungskontur")?;
                simple_rings.push(cycle);
                for removed in stack.drain(index + 1..) {
                    positions.remove(&key(removed));
                }
            } else {
                positions.insert(key(point), stack.len());
                stack.push(point);
            }
        }
        ensure(stack.len() == 1, "Ungültige Belegungskontur")?;
    }
    let rings = &simple_rings;
    let polygons: Vec<_> = rings
        .iter()
        .map(|r| Polygon::new(ring(r), vec![]))
        .collect();
    ensure(
        polygons
            .iter()
            .all(|p| p.is_valid() && p.unsigned_area() > 0.0),
        "Ungültige Belegungskontur",
    )?;
    let areas: Vec<_> = polygons.iter().map(GeoArea::unsigned_area).collect();
    let boxes: Vec<_> = rings.iter().map(|r| bounds(r.iter().copied())).collect();
    let mut by_area: Vec<_> = (0..rings.len()).collect();
    by_area.sort_by(|&a, &b| areas[a].total_cmp(&areas[b]));
    let mut parents = vec![None; rings.len()];
    for i in 0..rings.len() {
        parents[i] = by_area[by_area.partition_point(|&j| areas[j] <= areas[i])..]
            .iter()
            .copied()
            .filter(|&j| {
                boxes[j][0] <= boxes[i][0]
                    && boxes[j][1] <= boxes[i][1]
                    && boxes[j][2] >= boxes[i][2]
                    && boxes[j][3] >= boxes[i][3]
                    && polygons[j].relate(&polygons[i]).is_covers()
            })
            .min_by(|&a, &b| areas[a].total_cmp(&areas[b]));
    }
    let depths: Vec<_> = (0..rings.len())
        .map(|i| {
            let mut depth = 0;
            let mut parent = parents[i];
            while let Some(p) = parent {
                depth += 1;
                parent = parents[p];
            }
            depth
        })
        .collect();
    let result = MultiPolygon(
        (0..rings.len())
            .filter(|&i| depths[i] % 2 == 0)
            .map(|i| {
                Polygon::new(
                    ring(&rings[i]),
                    (0..rings.len())
                        .filter(|&j| parents[j] == Some(i) && depths[j] % 2 == 1)
                        .map(|j| ring(&rings[j]))
                        .collect(),
                )
            })
            .collect(),
    );
    ensure(
        result.is_valid(),
        "Belegungskonturen überschneiden oder berühren sich unzulässig",
    )?;
    Ok(result)
}

fn perimeter(rings: &[Vec<Point>]) -> f64 {
    edges(rings).map(|(a, b)| distance(a, b)).sum()
}

pub fn occupancy_world(contours: &[Vec<LocalPoint>], transform: &Transform) -> Vec<Vec<Point>> {
    contours
        .iter()
        .map(|r| r.iter().map(|p| world(*p, transform)).collect())
        .collect()
}

fn covers_rings(parcel: &[Vec<Point>], occupancy: &[Vec<Point>]) -> Result<bool> {
    let epsilon = predicate_epsilon(parcel, occupancy);
    let (p, h) = shifted_pair(parcel, occupancy)?;
    let p = rings_geometry(&p)?;
    let h = rings_geometry(&h)?;
    if h.0.is_empty() {
        return Ok(true);
    }
    Ok(p.relate(&h).is_covers() || p.buffer(epsilon).relate(&h).is_covers())
}

pub fn covers_occupancy(
    parcel: &Parcel,
    contours: &[Vec<LocalPoint>],
    transform: &Transform,
) -> Result<bool> {
    covers_rings(
        std::slice::from_ref(&parcel.polygon),
        &occupancy_world(contours, transform),
    )
}

/// Positive intersection area includes equality and full enclosure. Boundary
/// contact is allowed. Every ring, including holes, contributes to perimeter.
pub fn interiors_intersect(a: &[Vec<Point>], b: &[Vec<Point>]) -> Result<bool> {
    if a.is_empty() || b.is_empty() {
        return Ok(false);
    }
    let epsilon = predicate_epsilon(a, b);
    let (a, b) = shifted_pair(a, b)?;
    if !intersects(
        bounds(a.iter().flatten().copied()),
        bounds(b.iter().flatten().copied()),
    ) {
        return Ok(false);
    }
    let tolerance = epsilon * perimeter(&a).min(perimeter(&b)) + PI * epsilon * epsilon;
    let a = rings_geometry(&a)?;
    let b = rings_geometry(&b)?;
    Ok(a.intersection(&b).unsigned_area() > tolerance)
}

/// Header-only obstacle view for candidate queries and the P3 post-state
/// validator. No cells, interior metadata, IDs synthesized from row order, or
/// whole-house reads are needed for the all-floor conflict matrix.
#[derive(Clone, Copy)]
pub enum Obstacle<'a> {
    Parcel(&'a Parcel),
    House {
        id: &'a str,
        placement: &'a Placement,
        /// Above-ground roof, used only for initial house spacing.
        contours: &'a [Vec<LocalPoint>],
        /// All floors, authoritative for collisions and parcel containment.
        occupancy_contours: &'a [Vec<LocalPoint>],
        transform: &'a Transform,
    },
    Road(&'a Road),
    Water(&'a [Point]),
}

pub fn parcel_occupancy_conflict(
    parcel: &Parcel,
    placement: &Placement,
    contours: &[Vec<LocalPoint>],
    transform: &Transform,
) -> Result<bool> {
    if matches!(placement, Placement::Parcel { parcel_id, .. } if parcel_id == &parcel.id) {
        return Ok(false);
    }
    interiors_intersect(
        std::slice::from_ref(&parcel.polygon),
        &occupancy_world(contours, transform),
    )
}

pub fn parcel_conflict(parcel: &Parcel, obstacle: Obstacle<'_>) -> Result<bool> {
    match obstacle {
        Obstacle::Parcel(other) => interiors_intersect(
            std::slice::from_ref(&parcel.polygon),
            std::slice::from_ref(&other.polygon),
        ),
        Obstacle::House {
            placement,
            occupancy_contours,
            transform,
            ..
        } => parcel_occupancy_conflict(parcel, placement, occupancy_contours, transform),
        Obstacle::Road(road) => road_polygon_conflict(road, std::slice::from_ref(&parcel.polygon)),
        Obstacle::Water(points) => {
            interiors_intersect(std::slice::from_ref(&parcel.polygon), &[points.to_vec()])
        }
    }
}

/// Symmetric parcel/occupancy rule, also for a free or basement-only house.
/// The owner exception belongs to the parcel relation; owner containment must
/// still be checked separately by covers_occupancy.
pub fn house_conflict(
    placement: &Placement,
    occupancy_contours: &[Vec<LocalPoint>],
    transform: &Transform,
    obstacle: Obstacle<'_>,
) -> Result<bool> {
    match obstacle {
        Obstacle::Parcel(parcel) => {
            parcel_occupancy_conflict(parcel, placement, occupancy_contours, transform)
        }
        Obstacle::House {
            occupancy_contours: other,
            transform: other_transform,
            ..
        } => interiors_intersect(
            &occupancy_world(occupancy_contours, transform),
            &occupancy_world(other, other_transform),
        ),
        Obstacle::Road(road) => {
            road_polygon_conflict(road, &occupancy_world(occupancy_contours, transform))
        }
        Obstacle::Water(points) => interiors_intersect(
            &occupancy_world(occupancy_contours, transform),
            &[points.to_vec()],
        ),
    }
}

fn road_polygon_conflict(road: &Road, rings: &[Vec<Point>]) -> Result<bool> {
    // Preserve the road's existing round-cap distance contract. Geo predicates
    // are used for polygon/polygon relations; no approximate road buffer is
    // stored or allowed to cut off a circular road cap.
    ensure(
        road.width.is_finite() && road.width > 0.0 && road.path.iter().copied().all(valid_point),
        "Ungültige Straße",
    )?;
    let epsilon = predicate_epsilon(std::slice::from_ref(&road.path), rings);
    let (path, rings) = shifted_pair(std::slice::from_ref(&road.path), rings)?;
    let geometry = rings_geometry(&rings)?;
    Ok(path[0]
        .iter()
        .any(|p| geometry.contains(&geo::Point::new(p[0], p[1])))
        || path[0].windows(2).any(|pair| {
            edges(&rings)
                .any(|(a, b)| segment_distance(pair[0], pair[1], a, b) < road.width / 2.0 - epsilon)
        }))
}

/// Generation-only clearance. Unlike parcel ownership this is not a durable
/// restriction on subsequent manual house changes.
pub fn occupancy_clearance(
    contours: &[Vec<LocalPoint>],
    transform: &Transform,
    other_contours: &[Vec<LocalPoint>],
    other_transform: &Transform,
    gap: f64,
) -> Result<bool> {
    ensure(gap.is_finite() && gap >= 0.0, "Ungültiger Hausabstand")?;
    let a = occupancy_world(contours, transform);
    let b = occupancy_world(other_contours, other_transform);
    let epsilon = predicate_epsilon(&a, &b);
    let (a, b) = shifted_pair(&a, &b)?;
    if !intersects(
        expand(bounds(a.iter().flatten().copied()), gap),
        bounds(b.iter().flatten().copied()),
    ) {
        return Ok(false);
    }
    // Existing contour distance is exact on these line segments; test polygon
    // intersection first so equality/full enclosure is also a conflict.
    Ok(interiors_intersect(
        &occupancy_world(contours, transform),
        &occupancy_world(other_contours, other_transform),
    )? || shape_distance(&a, &b) < gap - epsilon)
}
