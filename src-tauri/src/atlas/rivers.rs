//! Authored river paths and a pure, directed, non-rising water-profile solver.
use super::{
    errors::ensure,
    geometry::{bounds, expand, valid_point},
    road_terrain, Bounds, Point, Result,
};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RiverSettings {
    pub tolerance: f64,
    pub roughness: f64,
    pub meander: f64,
    pub source_fade: bool,
    pub seed: u32,
}
impl Default for RiverSettings {
    fn default() -> Self {
        Self {
            tolerance: 0.1,
            roughness: 0.5,
            meander: 40.,
            source_fade: true,
            seed: 1,
        }
    }
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RiverNode {
    pub id: String,
    pub point: Point,
    pub width: f64,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RiverVertex {
    pub point: Point,
    pub width: f64,
    pub node_id: Option<String>,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct River {
    pub id: String,
    pub name: String,
    pub nodes: Vec<RiverNode>,
    pub settings: RiverSettings,
    pub path: Vec<RiverVertex>,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RiverSample {
    pub point: Point,
    pub width: f64,
    pub water: f64,
    pub cut: f64,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RiverView {
    pub river: River,
    pub samples: Vec<RiverSample>,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum RiverAction {
    Put {
        id: Option<String>,
        name: String,
        nodes: Vec<RiverNode>,
        settings: RiverSettings,
        reverse: bool,
        automatic: bool,
        snap: f64,
    },
    Delete {
        id: String,
    },
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct RiverDelta {
    pub before: Vec<RiverView>,
    pub after: Vec<RiverView>,
}
pub fn river_bounds(r: &River) -> Bounds {
    expand(bounds(r.path.iter().map(|v| v.point)), {
        let width = r.path.iter().map(|v| v.width).fold(0., f64::max);
        width / 2. + width.max(5.) + 8.
    })
}
pub fn validate(r: &River) -> Result<()> {
    ensure(
        !r.id.is_empty() && super::validation::name(&r.name),
        "Ungültiger Flussname",
    )?;
    ensure(
        (2..=512).contains(&r.nodes.len()) && (2..=32768).contains(&r.path.len()),
        "Fluss: 2–512 Punkte und höchstens 32.768 Verlaufssamples",
    )?;
    let s = &r.settings;
    ensure(
        s.tolerance.is_finite()
            && (0.0..=0.3).contains(&s.tolerance)
            && s.roughness.is_finite()
            && (0.0..=1.0).contains(&s.roughness)
            && s.meander.is_finite()
            && (0.0..=10000.).contains(&s.meander),
        "Ungültige Flusseinstellungen",
    )?;
    let mut ids = BTreeSet::new();
    for n in &r.nodes {
        ensure(
            !n.id.is_empty()
                && ids.insert(&n.id)
                && valid_point(n.point)
                && n.width.is_finite()
                && (2.0..=1000.).contains(&n.width),
            "Ungültiger Flusspunkt",
        )?;
    }
    for v in &r.path {
        ensure(
            valid_point(v.point) && v.width.is_finite() && v.width > 0. && v.width <= 1000.,
            "Ungültiger Flussverlauf",
        )?;
    }
    let marked: Vec<_> = r
        .path
        .iter()
        .filter_map(|v| v.node_id.as_ref().map(|id| (id, v.point)))
        .collect();
    ensure(
        marked == r.nodes.iter().map(|n| (&n.id, n.point)).collect::<Vec<_>>()
            && r.path[0].node_id.is_some()
            && r.path.last().unwrap().node_id.is_some(),
        "Flussknoten stimmen nicht mit Verlauf überein",
    )?;
    ensure(
        r.path
            .windows(2)
            .all(|p| road_terrain::distance(p[0].point, p[1].point) > 1e-7),
        "Doppelte Flusspunkte",
    )?;
    simple_path(r)
}
pub fn route(r: &mut River, sample: &mut impl FnMut(Point) -> Result<(f64, bool)>) -> Result<()> {
    // Validate authored input before allocating search/sample work.
    r.path = r
        .nodes
        .iter()
        .map(|n| RiverVertex {
            point: n.point,
            width: n.width,
            node_id: Some(n.id.clone()),
        })
        .collect();
    validate(r)?;
    let mut path = vec![];
    for (section, pair) in r.nodes.windows(2).enumerate() {
        let (a, b) = (&pair[0], &pair[1]);
        let c = road_terrain::Corridor::new(
            vec![a.point, b.point],
            a.width.min(100.),
            &road_terrain::TerrainFollow {
                tolerance: r.settings.tolerance,
            },
        )?;
        let route = road_terrain::plan_river(&c, sample, 200000 / (r.nodes.len() - 1))?;
        let total: f64 = route
            .points
            .windows(2)
            .map(|p| road_terrain::distance(p[0], p[1]))
            .sum();
        let mut run = 0.;
        for pair in route.points.windows(2) {
            let len = road_terrain::distance(pair[0], pair[1]);
            let count = (len / 5.).ceil().max(1.) as usize;
            ensure(
                path.len() + count < 32768,
                "Fluss zu lang; weniger oder kürzere Abschnitte zeichnen",
            )?;
            for i in 0..count {
                let t = i as f64 / count as f64;
                let progress = (run + t * len) / total;
                let base = [
                    pair[0][0] + (pair[1][0] - pair[0][0]) * t,
                    pair[0][1] + (pair[1][1] - pair[0][1]) * t,
                ];
                let phase = (r.settings.seed as f64 * 2.399963 + section as f64).sin();
                let wave = (progress * total / (a.width.max(b.width) * 8.).max(40.)
                    * std::f64::consts::TAU
                    + phase)
                    .sin();
                let offset = r.settings.meander
                    * r.settings.roughness
                    * wave
                    * (std::f64::consts::PI * progress).sin();
                let clearance =
                    (c.radii[0] - road_terrain::segment_distance(base, a.point, b.point)).max(0.);
                let offset = if clearance > 1e-9 {
                    clearance * (offset / clearance).tanh()
                } else {
                    0.
                };
                let mut p = [
                    base[0] - (pair[1][1] - pair[0][1]) / len * offset,
                    base[1] + (pair[1][0] - pair[0][0]) / len * offset,
                ];
                if !c.contains(p, 0) {
                    p = base;
                }
                let width = a.width + (b.width - a.width) * progress;
                let fade = if section == 0 && r.settings.source_fade {
                    (0.1 + progress * total / (a.width * 2.)).min(1.)
                } else {
                    1.
                };
                path.push(RiverVertex {
                    point: p,
                    width: width * fade,
                    node_id: if run == 0. && i == 0 {
                        Some(a.id.clone())
                    } else {
                        None
                    },
                });
            }
            run += len;
        }
    }
    let n = r.nodes.last().unwrap();
    path.push(RiverVertex {
        point: n.point,
        width: n.width,
        node_id: Some(n.id.clone()),
    });
    r.path = path;
    validate(r)
}
/// Shared node identities form a DAG. Each vertex has at most one downstream edge.
pub fn profiles(
    rivers: Vec<River>,
    water: &mut impl FnMut(Point) -> Result<Option<f64>>,
    sample: &mut impl FnMut(Point) -> Result<f64>,
) -> Result<Vec<RiverView>> {
    ensure(
        rivers.iter().map(|r| r.path.len()).sum::<usize>() <= 200000,
        "Flussnetz überschreitet 200.000 Samples",
    )?;
    let mut keys = BTreeMap::<String, usize>::new();
    let mut positions: Vec<Point> = vec![];
    let mut rows = vec![];
    let mut heights: Vec<f64> = vec![];
    let mut levels: Vec<Option<f64>> = vec![];
    let mut outgoing: Vec<Option<usize>> = vec![];
    let mut incoming: Vec<usize> = vec![];
    for r in &rivers {
        validate(r)?;
        let mut row = vec![];
        for (i, v) in r.path.iter().enumerate() {
            let key = v.node_id.clone().unwrap_or_else(|| format!("{}:{i}", r.id));
            let index = if let Some(&idx) = keys.get(&key) {
                ensure(
                    positions[idx] == v.point,
                    "Verbundene Flussknoten haben verschiedene Positionen",
                )?;
                idx
            } else {
                let idx = keys.len();
                keys.insert(key, idx);
                positions.push(v.point);
                let level = water(v.point)?;
                heights.push(level.unwrap_or(sample(v.point)?));
                levels.push(level);
                outgoing.push(None);
                incoming.push(0);
                idx
            };
            row.push(index);
        }
        for p in row.windows(2) {
            ensure(
                outgoing[p[0]].is_none(),
                "Flussteilungen sind nicht unterstützt",
            )?;
            outgoing[p[0]] = Some(p[1]);
            incoming[p[1]] += 1;
        }
        rows.push(row);
    }
    ensure(keys.len() <= 200000, "Flussnetz zu groß")?;
    let mut ready: BTreeSet<usize> = incoming
        .iter()
        .enumerate()
        .filter_map(|(i, &n)| (n == 0).then_some(i))
        .collect();
    let mut visited = 0;
    let mut order = vec![];
    while let Some(i) = ready.pop_first() {
        visited += 1;
        order.push(i);
        if let Some(j) = outgoing[i] {
            if levels[j].is_none() {
                heights[j] = heights[j].min(heights[i]);
            }
            incoming[j] -= 1;
            if incoming[j] == 0 {
                ready.insert(j);
            }
        }
    }
    ensure(
        visited == keys.len(),
        "Geschlossene Flussschleife; Verbindung korrigieren",
    )?;
    // A receiving lake sets a downstream boundary; propagate its backwater upstream.
    for &i in order.iter().rev() {
        if let Some(j) = outgoing[i] {
            if heights[i] < heights[j] {
                ensure(
                    levels[i].is_none(),
                    "Fluss verbindet widersprüchliche Gewässerpegel",
                )?;
                heights[i] = heights[j];
            }
        }
    }
    rivers
        .into_iter()
        .zip(rows)
        .map(|(r, row)| {
            let samples = r
                .path
                .iter()
                .zip(row)
                .map(|(v, i)| {
                    ensure(
                        super::terrain::valid_height(heights[i] - 2.),
                        "Flussbett außerhalb der Höhengrenzen",
                    )?;
                    Ok(RiverSample {
                        point: v.point,
                        width: v.width,
                        water: heights[i],
                        cut: (sample(v.point)? - (heights[i] - 2.)).max(0.),
                    })
                })
                .collect::<Result<Vec<_>>>()?;
            Ok(RiverView { river: r, samples })
        })
        .collect()
}
pub fn project(p: Point, a: Point, b: Point) -> (f64, Point, f64) {
    let dx = b[0] - a[0];
    let dy = b[1] - a[1];
    let t = (((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)).clamp(0., 1.);
    let q = [a[0] + dx * t, a[1] + dy * t];
    (t, q, road_terrain::distance(p, q))
}
/// Proper segment intersections, including endpoint contacts (parallel edges excluded).
pub fn intersection(a: Point, b: Point, c: Point, d: Point) -> Option<(f64, f64, Point)> {
    let u = [b[0] - a[0], b[1] - a[1]];
    let v = [d[0] - c[0], d[1] - c[1]];
    let det = u[0] * v[1] - u[1] * v[0];
    if det.abs() < 1e-10 {
        return None;
    }
    let w = [c[0] - a[0], c[1] - a[1]];
    let t = (w[0] * v[1] - w[1] * v[0]) / det;
    let s = (w[0] * u[1] - w[1] * u[0]) / det;
    if (-1e-8..=1. + 1e-8).contains(&t) && (-1e-8..=1. + 1e-8).contains(&s) {
        Some((
            t.clamp(0., 1.),
            s.clamp(0., 1.),
            [a[0] + t * u[0], a[1] + t * u[1]],
        ))
    } else {
        None
    }
}
fn simple_path(r: &River) -> Result<()> {
    let mut bins = BTreeMap::<(i32, i32), Vec<usize>>::new();
    let mut work = 0;
    for (i, pair) in r.path.windows(2).enumerate() {
        let b = bounds(pair.iter().map(|v| v.point));
        let (x0, x1, y0, y1) = (
            (b[0] / 100.).floor() as i32,
            (b[2] / 100.).floor() as i32,
            (b[1] / 100.).floor() as i32,
            (b[3] / 100.).floor() as i32,
        );
        ensure(
            (x1 as i64 - x0 as i64 + 1) * (y1 as i64 - y0 as i64 + 1) <= 100000,
            "Flusssegment zu lang",
        )?;
        let mut checked = BTreeSet::new();
        for y in y0..=y1 {
            for x in x0..=x1 {
                let cell = bins.entry((x, y)).or_default();
                for &j in cell.iter() {
                    if j + 1 >= i || !checked.insert(j) {
                        continue;
                    }
                    work += 1;
                    ensure(work <= 2000000, "Flussverlauf zu komplex")?;
                    ensure(
                        intersection(
                            pair[0].point,
                            pair[1].point,
                            r.path[j].point,
                            r.path[j + 1].point,
                        )
                        .is_none(),
                        "Fluss kreuzt sich selbst; Verlauf korrigieren",
                    )?;
                    // Also reject collinear overlap/retracing.
                    ensure(
                        project(pair[0].point, r.path[j].point, r.path[j + 1].point).2 > 1e-7
                            && project(r.path[j].point, pair[0].point, pair[1].point).2 > 1e-7,
                        "Fluss überlagert sich selbst",
                    )?;
                }
                cell.push(i);
            }
        }
    }
    Ok(())
}
#[derive(Clone)]
struct BedSegment {
    a: RiverSample,
    b: RiverSample,
}
impl rstar::RTreeObject for BedSegment {
    type Envelope = rstar::AABB<Point>;
    fn envelope(&self) -> Self::Envelope {
        let width = self.a.width.max(self.b.width);
        let w = width / 2. + width.max(5.) + 8.;
        rstar::AABB::from_corners(
            [
                self.a.point[0].min(self.b.point[0]) - w,
                self.a.point[1].min(self.b.point[1]) - w,
            ],
            [
                self.a.point[0].max(self.b.point[0]) + w,
                self.a.point[1].max(self.b.point[1]) + w,
            ],
        )
    }
}
pub struct RiverSurface(rstar::RTree<BedSegment>);
impl RiverSurface {
    pub fn new(views: &[RiverView]) -> Self {
        Self(rstar::RTree::bulk_load(
            views
                .iter()
                .flat_map(|v| {
                    v.samples.windows(2).map(|p| BedSegment {
                        a: p[0].clone(),
                        b: p[1].clone(),
                    })
                })
                .collect(),
        ))
    }
    pub fn at(&self, p: Point, natural: f64) -> (f64, bool) {
        let mut z = natural;
        let mut wet = false;
        for s in self
            .0
            .locate_in_envelope_intersecting(&rstar::AABB::from_point(p))
        {
            let (t, _, d) = project(p, s.a.point, s.b.point);
            let w = s.a.width + (s.b.width - s.a.width) * t;
            let water = s.a.water + (s.b.water - s.a.water) * t;
            // Include the raster interpolation support of narrow channels.
            let half = w / 2. + std::f64::consts::SQRT_2 * 5.;
            let influence = (1. - ((d - half) / w.max(5.)).max(0.)).clamp(0., 1.);
            z = z.min(
                natural
                    + (water - 2. - natural).min(0.)
                        * influence
                        * influence
                        * (3. - 2. * influence),
            );
            wet |= d <= w / 2.;
        }
        (z, wet)
    }
}
