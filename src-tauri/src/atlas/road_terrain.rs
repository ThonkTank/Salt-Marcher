//! Camera-independent, bounded direction-aware search through ordered waypoint regions.
//! The caller supplies natural terrain only. No document writes or author IDs here.
use super::{errors::ensure, geometry::valid_point, Point, Result};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BinaryHeap};

#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TerrainFollow {
    pub tolerance: f64,
}
pub const BUDGET: usize = 200_000;
#[derive(Clone, Debug)]
pub struct Route {
    pub points: Vec<Point>,
    /// Original section ordinal for each edge.
    pub sections: Vec<usize>,
}
#[derive(Clone)]
pub struct Corridor {
    river: bool,
    pub points: Vec<Point>,
    pub radii: Vec<f64>,
    pub waypoint_radii: Vec<f64>,
    pub width: f64,
    pub sample_step: f64,
}
pub fn distance(a: Point, b: Point) -> f64 {
    (a[0] - b[0]).hypot(a[1] - b[1])
}
fn lerp(a: Point, b: Point, t: f64) -> Point {
    [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
}
pub fn segment_distance(p: Point, a: Point, b: Point) -> f64 {
    let length = distance(a, b);
    if length < 1e-9 {
        return distance(p, a);
    }
    let t = ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / (length * length);
    distance(p, lerp(a, b, t.clamp(0., 1.)))
}
impl Corridor {
    pub fn new(points: Vec<Point>, width: f64, settings: &TerrainFollow) -> Result<Self> {
        ensure(
            (2..=512).contains(&points.len()) && points.iter().all(|p| valid_point(*p)),
            "Ungültige Geländeroute",
        )?;
        ensure(
            width.is_finite()
                && (2.0..=100.0).contains(&width)
                && settings.tolerance.is_finite()
                && (0.0..=0.3).contains(&settings.tolerance),
            "Ungültiger Geländespielraum",
        )?;
        let lengths: Vec<_> = points.windows(2).map(|p| distance(p[0], p[1])).collect();
        ensure(lengths.iter().all(|l| *l > 1e-6), "Doppelte Straßenpunkte")?;
        let mut waypoint_radii = vec![0.; points.len()];
        for i in 1..points.len() - 1 {
            waypoint_radii[i] = settings.tolerance * lengths[i - 1].min(lengths[i]);
        }
        Ok(Self {
            river: false,
            sample_step: (lengths.iter().sum::<f64>() / 16000.).max(5.),
            radii: lengths.iter().map(|l| settings.tolerance * l).collect(),
            points,
            waypoint_radii,
            width,
        })
    }
    pub fn contains(&self, p: Point, section: usize) -> bool {
        segment_distance(p, self.points[section], self.points[section + 1])
            <= self.radii[section] + 1e-7
    }
    fn reached(&self, p: Point, target: usize) -> bool {
        distance(p, self.points[target]) <= self.waypoint_radii[target] + 1e-7
    }
    pub fn direct(&self) -> Route {
        Route {
            points: self.points.clone(),
            sections: (0..self.radii.len()).collect(),
        }
    }
    /// Integrates length, squared longitudinal/cross slope and water with the same samples
    /// for baseline, search edges, smoothing and roughness acceptance.
    pub fn edge_cost(
        &self,
        a: Point,
        b: Point,
        sample: &mut impl FnMut(Point) -> Result<(f64, bool)>,
    ) -> Result<f64> {
        let length = distance(a, b);
        if length < 1e-9 {
            return Ok(0.);
        }
        let steps = (length / self.sample_step).ceil().max(1.) as usize;
        let normal = [
            -(b[1] - a[1]) / length * self.width / 2.,
            (b[0] - a[0]) / length * self.width / 2.,
        ];
        let mut old = sample(a)?.0;
        let mut cost = 0.;
        for i in 0..steps {
            let next = lerp(a, b, (i + 1) as f64 / steps as f64);
            let mid = lerp(a, b, (i as f64 + 0.5) / steps as f64);
            let (z, wet) = sample(next)?;
            let (_, middle_wet) = sample(mid)?;
            let (left, lwet) = sample([mid[0] + normal[0], mid[1] + normal[1]])?;
            let (right, rwet) = sample([mid[0] - normal[0], mid[1] - normal[1]])?;
            let (_, edge_left_wet) = sample([next[0] + normal[0], next[1] + normal[1]])?;
            let (_, edge_right_wet) = sample([next[0] - normal[0], next[1] - normal[1]])?;
            let run = length / steps as f64;
            cost += if self.river {
                run * (1. + 200. * ((z - old) / run).max(0.).powi(2))
            } else {
                run * (1.
                    + 100. * ((z - old) / run).powi(2)
                    + 25. * ((right - left) / self.width).powi(2)
                    + if wet || middle_wet || lwet || rwet || edge_left_wet || edge_right_wet {
                        100.
                    } else {
                        0.
                    })
            };
            old = z;
        }
        Ok(cost)
    }
    pub fn cost(
        &self,
        route: &Route,
        sample: &mut impl FnMut(Point) -> Result<(f64, bool)>,
    ) -> Result<f64> {
        let mut total = 0.;
        for (i, pair) in route.points.windows(2).enumerate() {
            total += self.edge_cost(pair[0], pair[1], sample)?;
            if i > 0 {
                total += turn(route.points[i - 1], pair[0], pair[1], self.width);
            }
            if i > 0 && route.sections[i] != route.sections[i - 1] {
                total += distance(pair[0], self.points[route.sections[i]]);
            }
        }
        Ok(total)
    }
    pub fn valid(&self, route: &Route) -> bool {
        if route.points.len() < 2
            || route.sections.len() + 1 != route.points.len()
            || route.points[0] != self.points[0]
            || route.points.last() != self.points.last()
        {
            return false;
        }
        let mut expected = 0;
        for (i, pair) in route.points.windows(2).enumerate() {
            let section = route.sections[i];
            if section == expected + 1 && self.reached(pair[0], section) {
                expected += 1;
            }
            if section != expected || section >= self.radii.len() {
                return false;
            }
            // Capsules are convex; endpoint containment also covers every straight sample.
            if !self.contains(pair[0], section) || !self.contains(pair[1], section) {
                return false;
            }
        }
        expected + 1 == self.radii.len()
    }
}
fn turn(a: Point, b: Point, c: Point, width: f64) -> f64 {
    let norm = distance(a, b) * distance(b, c);
    if norm < 1e-12 {
        return 0.;
    }
    let dot = ((b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1])) / norm;
    width * dot.clamp(-1., 1.).acos().powi(2)
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
enum Vertex {
    Grid(i32, i32),
    Waypoint(usize),
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
struct State {
    vertex: Vertex,
    target: usize,
    direction: u8,
}
#[derive(Clone, Copy)]
struct Entry {
    cost: f64,
    rank: f64,
    state: State,
}
impl PartialEq for Entry {
    fn eq(&self, b: &Self) -> bool {
        self.rank == b.rank && self.state == b.state
    }
}
impl Eq for Entry {}
impl Ord for Entry {
    fn cmp(&self, b: &Self) -> std::cmp::Ordering {
        b.rank
            .total_cmp(&self.rank)
            .then_with(|| b.state.cmp(&self.state))
    }
}
impl PartialOrd for Entry {
    fn partial_cmp(&self, b: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(b))
    }
}
const DIRS: [(i32, i32); 8] = [
    (1, 0),
    (1, 1),
    (0, 1),
    (-1, 1),
    (-1, 0),
    (-1, -1),
    (0, -1),
    (1, -1),
];
fn direction(a: Point, b: Point) -> u8 {
    (((b[1] - a[1]).atan2(b[0] - a[0]) * 4. / std::f64::consts::PI).round() as i32).rem_euclid(8)
        as u8
}
fn search(
    c: &Corridor,
    step: f64,
    limit: usize,
    used: &mut usize,
    guide: Option<(&Route, f64)>,
    sample: &mut impl FnMut(Point) -> Result<(f64, bool)>,
) -> Result<Option<Route>> {
    let position = |v: Vertex| match v {
        Vertex::Grid(x, y) => [x as f64 * step, y as f64 * step],
        Vertex::Waypoint(i) => c.points[i],
    };
    let start = State {
        vertex: Vertex::Waypoint(0),
        target: 1,
        direction: 8,
    };
    let mut queue = BinaryHeap::from([Entry {
        cost: 0.,
        rank: 0.,
        state: start,
    }]);
    let mut records = BTreeMap::from([(start, (0., None::<State>))]);
    let trace = |state: State, records: &BTreeMap<State, (f64, Option<State>)>| {
        let mut points = vec![position(state.vertex)];
        let mut sections = vec![];
        let mut current = state;
        while let Some(parent) = records[&current].1 {
            if current.vertex != parent.vertex {
                points.push(position(parent.vertex));
                sections.push(parent.target - 1);
            }
            current = parent;
        }
        points.reverse();
        sections.reverse();
        Route { points, sections }
    };
    let mut completed: Option<(State, f64)> = None;
    let mut costs = BTreeMap::new();
    *used += 1;
    while let Some(Entry { cost, state, .. }) = queue.pop() {
        if cost > records[&state].0 {
            continue;
        }
        let p = position(state.vertex);
        if state.target == c.points.len() - 1 && state.vertex == Vertex::Waypoint(state.target) {
            return Ok(Some(trace(state, &records)));
        }
        let mut candidates = vec![];
        if state.target < c.points.len() - 1
            && c.reached(p, state.target)
            && c.contains(p, state.target)
        {
            candidates.push((
                State {
                    target: state.target + 1,
                    ..state
                },
                distance(p, c.points[state.target]),
            ));
        }
        let gx = (p[0] / step).floor() as i32;
        let gy = (p[1] / step).floor() as i32;
        let mut neighbors = vec![];
        match state.vertex {
            Vertex::Grid(x, y) => {
                neighbors.extend(DIRS.iter().map(|(dx, dy)| Vertex::Grid(x + dx, y + dy)))
            }
            Vertex::Waypoint(i) => {
                for dy in -1..=1 {
                    for dx in -1..=1 {
                        neighbors.push(Vertex::Grid(gx + dx, gy + dy));
                    }
                }
                if i + 1 < c.points.len() {
                    neighbors.push(Vertex::Waypoint(i + 1));
                }
            }
        }
        // Include authored points explicitly even when they do not lie on the lattice.
        for i in state.target.saturating_sub(1)..=(state.target + 1).min(c.points.len() - 1) {
            if distance(p, c.points[i]) <= step * 2. {
                neighbors.push(Vertex::Waypoint(i));
            }
        }
        neighbors.sort();
        neighbors.dedup();
        for vertex in neighbors {
            let q = position(vertex);
            if distance(p, q) < 1e-8 || !valid_point(q) || !c.contains(q, state.target - 1) {
                continue;
            }
            if let Some((route, radius)) = guide {
                if route
                    .points
                    .windows(2)
                    .all(|w| segment_distance(q, w[0], w[1]) > radius)
                {
                    continue;
                }
            }
            let dir = direction(p, q);
            let key = if state.vertex < vertex {
                (state.vertex, vertex)
            } else {
                (vertex, state.vertex)
            };
            let edge = if let Some(cost) = costs.get(&key) {
                *cost
            } else {
                let cost = c.edge_cost(p, q, sample)?;
                costs.insert(key, cost);
                cost
            };
            let angular = if state.direction == 8 {
                0.
            } else {
                let d = (dir as i32 - state.direction as i32).abs();
                c.width * ((d.min(8 - d) as f64) * std::f64::consts::PI / 4.).powi(2)
            };
            candidates.push((
                State {
                    vertex,
                    target: state.target,
                    direction: dir,
                },
                edge + angular,
            ));
        }
        for (next, extra) in candidates {
            let next_cost = cost + extra;
            if records.get(&next).is_some_and(|r| r.0 <= next_cost) {
                continue;
            }
            if !records.contains_key(&next) {
                if *used >= limit {
                    return Ok(completed.map(|(state, _)| trace(state, &records)));
                }
                *used += 1;
            }
            records.insert(next, (next_cost, Some(state)));
            if next.target == c.points.len() - 1
                && next.vertex == Vertex::Waypoint(next.target)
                && completed.is_none_or(|(_, cost)| next_cost < cost)
            {
                completed = Some((next, next_cost));
            }
            queue.push(Entry {
                cost: next_cost,
                rank: next_cost + distance(position(next.vertex), *c.points.last().unwrap()),
                state: next,
            });
        }
    }
    Ok(None)
}
pub fn plan(c: &Corridor, sample: &mut impl FnMut(Point) -> Result<(f64, bool)>) -> Result<Route> {
    plan_with_budget(c, sample, BUDGET)
}
pub fn plan_river(
    c: &Corridor,
    sample: &mut impl FnMut(Point) -> Result<(f64, bool)>,
    budget: usize,
) -> Result<Route> {
    let mut c = c.clone();
    c.river = true;
    plan_with_budget(&c, sample, budget)
}
fn plan_with_budget(
    c: &Corridor,
    sample: &mut impl FnMut(Point) -> Result<(f64, bool)>,
    budget: usize,
) -> Result<Route> {
    let mut best = c.direct();
    let mut score = c.cost(&best, sample)?;
    if (score <= distance(c.points[0], *c.points.last().unwrap()) + 1e-7)
        || c.radii.iter().all(|r| *r == 0.)
        || budget == 0
    {
        return Ok(best);
    }
    let area: f64 = c
        .points
        .windows(2)
        .zip(&c.radii)
        .map(|(p, r)| 2. * r * distance(p[0], p[1]) + std::f64::consts::PI * r * r)
        .sum();
    let mut step = 5.;
    while area / (step * step) * 8. > budget as f64 / 3. {
        step *= 2.;
    }
    let mut used = 0;
    let mut previous_step = None;
    loop {
        let limit = if step > 5. {
            (used + (budget - used) / 2).max(used + 1).min(budget)
        } else {
            budget
        };
        if let Some(mut route) = search(
            c,
            step,
            limit,
            &mut used,
            previous_step.map(|s| (&best, s * 2.)),
            sample,
        )? {
            // Collapse only cost-neutral or improving shortcuts within their original section.
            let mut i = 1;
            while i + 1 < route.points.len() {
                if route.sections[i - 1] == route.sections[i] {
                    let mut candidate = route.clone();
                    candidate.points.remove(i);
                    candidate.sections.remove(i);
                    if c.valid(&candidate)
                        && c.cost(&candidate, sample)? <= c.cost(&route, sample)? + 1e-7
                    {
                        route = candidate;
                        continue;
                    }
                }
                i += 1;
            }
            let cost = c.cost(&route, sample)?;
            if c.valid(&route) && route.points.len() <= 512 && cost < score - 1e-7 {
                best = route;
                score = cost;
            }
        }
        if step <= 5. || used >= budget {
            break;
        }
        previous_step = Some(step);
        step = (step / 2.).max(5.);
    }
    Ok(best)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn corridor(points: Vec<Point>, tolerance: f64) -> Corridor {
        Corridor::new(points, 10., &TerrainFollow { tolerance }).unwrap()
    }
    #[test]
    fn flat_zero_budget_zero_tolerance_and_long_negative_routes_keep_exact_endpoints() {
        for points in [
            vec![[-100., -80.], [100., -80.]],
            vec![[-4_000_000., -100.], [4_000_000., 100.]],
        ] {
            let c = corridor(points, 0.1);
            let route = plan(&c, &mut |_| Ok((10., false))).unwrap();
            assert_eq!(route.points, c.points);
            assert!(c.valid(&route));
            assert_eq!(
                plan_with_budget(&c, &mut |_| Ok((100., true)), 0)
                    .unwrap()
                    .points,
                c.points
            );
        }
        let c = corridor(vec![[0., 0.], [100., 0.]], 0.);
        assert_eq!(
            plan(&c, &mut |p| Ok((p[0], true))).unwrap().points,
            c.points
        );
        assert!(Corridor::new(
            vec![[0., 0.], [0., 0.]],
            10.,
            &TerrainFollow { tolerance: 0.1 }
        )
        .is_err());
    }
    #[test]
    fn hill_and_water_choose_better_routes_deterministically() {
        for water in [false, true] {
            let c = corridor(vec![[-150., 0.], [150., 0.]], 0.3);
            let mut sample = |p: Point| {
                let d = p[0].hypot(p[1]);
                Ok((
                    if water {
                        10.
                    } else {
                        10. + (1. - d / 45.).max(0.) * 50.
                    },
                    water && d < 28.,
                ))
            };
            let direct = c.cost(&c.direct(), &mut sample).unwrap();
            let route = plan(&c, &mut sample).unwrap();
            assert!(c.valid(&route));
            assert!(route.points.iter().any(|p| p[1].abs() > 20.));
            assert!(c.cost(&route, &mut sample).unwrap() < direct * 0.7);
            assert_eq!(route.points, plan(&c, &mut sample).unwrap().points);
        }
    }
    #[test]
    fn ordered_regions_short_neighbor_and_unavoidable_slopes() {
        let c = corridor(vec![[-100., 0.], [0., 0.], [20., 0.], [180., 50.]], 0.3);
        assert_eq!(c.waypoint_radii[1], 6.);
        assert_eq!(c.waypoint_radii[2], 6.);
        let route = plan(&c, &mut |p| Ok((p[0] * 0.5, true))).unwrap();
        assert!(c.valid(&route));
        for i in 1..c.points.len() - 1 {
            assert!(route
                .points
                .iter()
                .any(|p| distance(*p, c.points[i]) <= c.waypoint_radii[i] + 1e-7));
        }
        let c = corridor(vec![[0., 0.], [150., 0.]], 0.3);
        let mut slope = |p: Point| Ok((p[0] * 2., false));
        let direct = c.cost(&c.direct(), &mut slope).unwrap();
        let route = plan(&c, &mut slope).unwrap();
        assert!(c.valid(&route));
        assert!(c.cost(&route, &mut slope).unwrap() <= direct);
    }
}
