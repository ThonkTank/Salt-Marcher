use crate::atlas::errors::ensure;
#[cfg(test)]
use crate::atlas::model::Node;
use crate::atlas::model::{Bounds, HouseHeader, LocalPoint, Point, SceneObject, Transform};
use crate::atlas::Result;
use std::collections::{BTreeMap, BTreeSet};
pub const EPS: f64 = 1e-7;
pub fn add(a: Point, b: Point) -> Point {
    [a[0] + b[0], a[1] + b[1]]
}
pub fn sub(a: Point, b: Point) -> Point {
    [a[0] - b[0], a[1] - b[1]]
}
pub fn mul(a: Point, k: f64) -> Point {
    [a[0] * k, a[1] * k]
}
pub fn dot(a: Point, b: Point) -> f64 {
    a[0] * b[0] + a[1] * b[1]
}
pub fn cross(a: Point, b: Point) -> f64 {
    a[0] * b[1] - a[1] * b[0]
}
pub fn length(a: Point) -> f64 {
    dot(a, a).sqrt()
}
pub fn distance(a: Point, b: Point) -> f64 {
    length(sub(a, b))
}
pub fn world(LocalPoint(p): LocalPoint, t: &Transform) -> Point {
    let (s, c) = t.angle.sin_cos();
    [
        t.x + 5.0 * (p[0] * c - p[1] * s),
        t.y + 5.0 * (p[0] * s + p[1] * c),
    ]
}
pub fn valid_point(p: Point) -> bool {
    p.iter().all(|x| x.is_finite() && x.abs() <= 5_000_000.0)
}
pub fn bounds(points: impl Iterator<Item = Point>) -> Bounds {
    let mut b = [
        f64::INFINITY,
        f64::INFINITY,
        f64::NEG_INFINITY,
        f64::NEG_INFINITY,
    ];
    for p in points {
        b[0] = b[0].min(p[0]);
        b[1] = b[1].min(p[1]);
        b[2] = b[2].max(p[0]);
        b[3] = b[3].max(p[1]);
    }
    b
}
pub fn expand(b: Bounds, d: f64) -> Bounds {
    [b[0] - d, b[1] - d, b[2] + d, b[3] + d]
}
pub fn intersects(a: Bounds, b: Bounds) -> bool {
    a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1]
}
pub fn point_segment(p: Point, a: Point, b: Point) -> f64 {
    let v = sub(b, a);
    let n = dot(v, v);
    if n < EPS {
        return distance(p, a);
    }
    distance(p, add(a, mul(v, (dot(sub(p, a), v) / n).clamp(0.0, 1.0))))
}
pub fn proper_cross(a: Point, b: Point, c: Point, d: Point) -> bool {
    let ab = sub(b, a);
    let cd = sub(d, c);
    cross(ab, sub(c, a)) * cross(ab, sub(d, a)) < -EPS
        && cross(cd, sub(a, c)) * cross(cd, sub(b, c)) < -EPS
}
pub fn segment_distance(a: Point, b: Point, c: Point, d: Point) -> f64 {
    if proper_cross(a, b, c, d) {
        0.0
    } else {
        point_segment(a, c, d)
            .min(point_segment(b, c, d))
            .min(point_segment(c, a, b))
            .min(point_segment(d, a, b))
    }
}
pub fn edges(rings: &[Vec<Point>]) -> impl Iterator<Item = (Point, Point)> + '_ {
    rings.iter().flat_map(|r| {
        r.iter()
            .copied()
            .zip(r.iter().copied().cycle().skip(1))
            .take(r.len())
    })
}
pub fn contains(rings: &[Vec<Point>], p: Point) -> bool {
    let mut inside = false;
    for (a, b) in edges(rings) {
        if point_segment(p, a, b) < EPS {
            return false;
        }
        if (a[1] > p[1]) != (b[1] > p[1])
            && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]
        {
            inside = !inside
        }
    }
    inside
}
pub fn shape_distance(a: &[Vec<Point>], b: &[Vec<Point>]) -> f64 {
    if a.iter().flatten().any(|p| contains(b, *p)) || b.iter().flatten().any(|p| contains(a, *p)) {
        return 0.0;
    }
    edges(a)
        .flat_map(|(p, q)| edges(b).map(move |(r, s)| segment_distance(p, q, r, s)))
        .fold(f64::INFINITY, f64::min)
}
pub fn overlap(a: &[Vec<Point>], b: &[Vec<Point>]) -> bool {
    if a.iter().flatten().any(|p| contains(b, *p))
        || b.iter().flatten().any(|p| contains(a, *p))
        || edges(a).any(|(p, q)| edges(b).any(|(r, s)| proper_cross(p, q, r, s)))
    {
        return true;
    }
    // Probe on both sides of boundary midpoints: catches coincident rectangles and
    // collinear overlapping strips while allowing pure boundary contact.
    edges(a).chain(edges(b)).any(|(p, q)| {
        let d = sub(q, p);
        let n = length(d);
        if n < EPS {
            return false;
        }
        let m = mul(add(p, q), 0.5);
        [-1.0, 1.0].iter().any(|sign| {
            let v = add(m, mul([-d[1] / n, d[0] / n], sign * 1e-5));
            contains(a, v) && contains(b, v)
        })
    })
}
pub fn road_hits(path: &[Point], width: f64, rings: &[Vec<Point>]) -> bool {
    path.iter().any(|p| contains(rings, *p))
        || path.windows(2).any(|w| {
            edges(rings).any(|(a, b)| segment_distance(w[0], w[1], a, b) < width / 2.0 - EPS)
        })
}
pub fn simple_polygon(p: &[Point]) -> bool {
    if p.len() < 3 || p.len() > 2048 || p.iter().any(|p| !valid_point(*p)) {
        return false;
    }
    let area: f64 = p
        .iter()
        .zip(p.iter().cycle().skip(1))
        .take(p.len())
        .map(|(a, b)| cross(*a, *b))
        .sum();
    if area.abs() < EPS {
        return false;
    }
    for i in 0..p.len() {
        if distance(p[i], p[(i + 1) % p.len()]) < EPS {
            return false;
        }
        for j in i + 1..p.len() {
            if j == i + 1 || (i == 0 && j == p.len() - 1) {
                continue;
            }
            if segment_distance(p[i], p[(i + 1) % p.len()], p[j], p[(j + 1) % p.len()]) < EPS {
                return false;
            }
        }
    }
    true
}
pub(in crate::atlas) fn flatten(
    a: Point,
    b: Point,
    c: Point,
    d: Point,
    depth: u8,
    out: &mut Vec<Point>,
) -> Result<()> {
    ensure(out.len() < 32768, "Straße ist zu komplex")?;
    if point_segment(b, a, d).max(point_segment(c, a, d)) <= 0.05 {
        out.push(d);
        return Ok(());
    }
    ensure(
        depth < 32,
        "Straßenkurve kann nicht genau genug unterteilt werden",
    )?;
    let ab = mul(add(a, b), 0.5);
    let bc = mul(add(b, c), 0.5);
    let cd = mul(add(c, d), 0.5);
    let abc = mul(add(ab, bc), 0.5);
    let bcd = mul(add(bc, cd), 0.5);
    let m = mul(add(abc, bcd), 0.5);
    flatten(a, ab, abc, m, depth + 1, out)?;
    flatten(m, bcd, cd, d, depth + 1, out)
}
#[cfg(test)]
pub fn road_path(nodes: &[Node]) -> Result<Vec<Point>> {
    ensure(
        nodes.len() >= 2 && nodes.len() <= 512,
        "Straße benötigt 2–512 Punkte",
    )?;
    let mut out = vec![nodes[0].point];
    for n in nodes {
        ensure(
            valid_point(n.point)
                && n.incoming.is_none_or(valid_point)
                && n.outgoing.is_none_or(valid_point),
            "Ungültiger Straßenpunkt",
        )?
    }
    for pair in nodes.windows(2) {
        let a = &pair[0];
        let b = &pair[1];
        flatten(
            a.point,
            a.outgoing.unwrap_or(a.point),
            b.incoming.unwrap_or(b.point),
            b.point,
            0,
            &mut out,
        )?;
        ensure(out.len() <= 32768, "Straße ist zu komplex")?;
    }
    out.dedup_by(|a, b| distance(*a, *b) < EPS);
    ensure(out.len() >= 2, "Straße hat keine Länge")?;
    Ok(out)
}
pub fn contours(cells: &[crate::interior::Cell]) -> Vec<Vec<LocalPoint>> {
    union_contours(cells, |floor| floor >= 0)
}
pub fn occupancy_contours(cells: &[crate::interior::Cell]) -> Vec<Vec<LocalPoint>> {
    union_contours(cells, |_| true)
}
fn union_contours(
    cells: &[crate::interior::Cell],
    include_floor: impl Fn(i64) -> bool,
) -> Vec<Vec<LocalPoint>> {
    let occupied: BTreeSet<(i64, i64)> = cells
        .iter()
        .filter(|c| include_floor(c.floor))
        .map(|c| (c.x, c.y))
        .collect();
    let mut edges: BTreeMap<(i64, i64), BTreeSet<(i64, i64)>> = BTreeMap::new();
    for &(x, y) in &occupied {
        for (dx, dy, a, b) in [
            (0, -1, (x, y), (x + 1, y)),
            (1, 0, (x + 1, y), (x + 1, y + 1)),
            (0, 1, (x + 1, y + 1), (x, y + 1)),
            (-1, 0, (x, y + 1), (x, y)),
        ] {
            if !occupied.contains(&(x + dx, y + dy)) {
                edges.entry(a).or_default().insert(b);
            }
        }
    }
    let mut result = Vec::new();
    while let Some((&start, _)) = edges.first_key_value() {
        let mut ring = vec![];
        let mut p = start;
        let mut previous = (start.0 - 1, start.1);
        loop {
            ring.push([p.0 as f64, p.1 as f64]);
            let choices = edges.get_mut(&p).expect("boundary");
            let incoming = (p.0 - previous.0, p.1 - previous.1);
            let next = *choices
                .iter()
                .min_by_key(|q| {
                    let d = (q.0 - p.0, q.1 - p.1);
                    let cross = incoming.0 * d.1 - incoming.1 * d.0;
                    let dot = incoming.0 * d.0 + incoming.1 * d.1;
                    if cross > 0 {
                        0
                    } else if dot > 0 {
                        1
                    } else if cross < 0 {
                        2
                    } else {
                        3
                    }
                })
                .expect("edge");
            choices.remove(&next);
            if choices.is_empty() {
                edges.remove(&p);
            }
            previous = p;
            p = next;
            if p == start {
                break;
            }
        }
        // Remove collinear vertices so exterior payloads depend on boundaries.
        let n = ring.len();
        let simple: Vec<_> = (0..n)
            .filter(|&i| {
                cross(
                    sub(ring[i], ring[(i + n - 1) % n]),
                    sub(ring[(i + 1) % n], ring[i]),
                )
                .abs()
                    > EPS
            })
            .map(|i| ring[i])
            .collect();
        if simple.len() >= 3 {
            result.push(simple.into_iter().map(LocalPoint).collect())
        }
    }
    result
}

pub(in crate::atlas) fn house_occupancy_shape(h: &HouseHeader) -> Vec<Vec<Point>> {
    h.occupancy_contours
        .iter()
        .map(|r| r.iter().map(|p| world(*p, &h.transform)).collect())
        .collect()
}
pub(in crate::atlas) fn occupancy_bounds(
    contours: &[Vec<LocalPoint>],
    transform: &Transform,
) -> Bounds {
    let b = bounds(contours.iter().flatten().map(|p| world(*p, transform)));
    if b[0].is_finite() {
        b
    } else {
        [transform.x, transform.y, transform.x, transform.y]
    }
}
pub(in crate::atlas) fn collision_bounds(object: &SceneObject) -> Bounds {
    let b = object.bounds();
    match object {
        SceneObject::House(h) => [
            b[0].min(h.occupancy_bounds[0]),
            b[1].min(h.occupancy_bounds[1]),
            b[2].max(h.occupancy_bounds[2]),
            b[3].max(h.occupancy_bounds[3]),
        ],
        _ => b,
    }
}

pub(in crate::atlas) fn house_render_bounds(
    contours: &[Vec<LocalPoint>],
    transform: &Transform,
) -> Bounds {
    let b = bounds(contours.iter().flatten().map(|p| world(*p, transform)));
    if b[0].is_finite() {
        b
    } else {
        [transform.x, transform.y, transform.x, transform.y]
    }
}
