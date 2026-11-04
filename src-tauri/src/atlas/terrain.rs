//! Pure height field mathematics. No SQL, editor state or object ownership.
use super::{errors::ensure, Point, Result, Status};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TerrainDelta {
    pub before: Vec<(i32, i32, f64)>,
    pub after: Vec<(i32, i32, f64)>,
    pub water_before: f64,
    pub water_after: f64,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerrainPreview {
    pub surface: Option<TerrainResponse>,
    pub points: Vec<(i32, i32, f64)>,
    pub water_level: f64,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TerrainArgs {
    pub level: u8,
    pub tiles: Vec<[i32; 2]>,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SurfaceTile {
    pub foundation_tops: Vec<(String, f64)>,
    pub x: i32,
    pub y: i32,
    pub heights: Vec<f64>,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerrainResponse {
    pub status: Status,
    pub level: u8,
    pub water_level: f64,
    pub tiles: Vec<SurfaceTile>,
}
pub const BASE: f64 = 10.0;
pub const STEP: f64 = 5.0;
pub const LIMIT: usize = 100_000;
pub type Grid = BTreeMap<(i32, i32), f64>;
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Brush {
    pub mode: BrushMode,
    pub radius: f64,
    pub amount: f64,
    pub strength: f64,
    pub target: f64,
    pub points: Vec<Point>,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum BrushMode {
    Raise,
    Lower,
    Smooth,
    Flatten,
}
pub fn valid_height(z: f64) -> bool {
    z.is_finite() && z.abs() <= 100_000.0
}
pub fn at(g: &Grid, x: i32, y: i32) -> f64 {
    *g.get(&(x, y)).unwrap_or(&BASE)
}
pub fn height(g: &Grid, p: Point) -> f64 {
    let x = (p[0] / STEP).floor() as i32;
    let y = (p[1] / STEP).floor() as i32;
    triangle_height(
        p,
        x,
        y,
        [
            at(g, x, y),
            at(g, x + 1, y),
            at(g, x + 1, y + 1),
            at(g, x, y + 1),
        ],
    )
}
pub fn triangle_height(p: Point, x: i32, y: i32, z: [f64; 4]) -> f64 {
    let u = p[0] / STEP - x as f64;
    let v = p[1] / STEP - y as f64;
    if u >= v {
        z[0] * (1.0 - u) + z[1] * (u - v) + z[2] * v
    } else {
        z[0] * (1.0 - v) + z[2] * u + z[3] * (v - u)
    }
}
pub fn stroke(g: &mut Grid, b: &Brush) -> Result<()> {
    ensure(
        b.radius.is_finite() && (5.0..=500.0).contains(&b.radius),
        "Pinselradius: 5–500 Fuß",
    )?;
    ensure(
        b.amount.is_finite() && (0.1..=100.0).contains(&b.amount),
        "Höhenänderung: 0,1–100 Fuß",
    )?;
    ensure(
        b.strength.is_finite() && (0.01..=1.0).contains(&b.strength) && valid_height(b.target),
        "Ungültige Pinselstärke oder Zielhöhe",
    )?;
    ensure(
        !b.points.is_empty()
            && b.points.len() <= LIMIT
            && b.points
                .iter()
                .flatten()
                .all(|v| v.is_finite() && v.abs() <= 5_000_000.0),
        "Ungültiger Pinselpfad",
    )?;
    let centers = stroke_centers(b)?;
    let mut touched = BTreeSet::new();
    for p in centers {
        let mut updates = vec![];
        for y in
            ((p[1] - b.radius) / STEP).ceil() as i32..=((p[1] + b.radius) / STEP).floor() as i32
        {
            for x in
                ((p[0] - b.radius) / STEP).ceil() as i32..=((p[0] + b.radius) / STEP).floor() as i32
            {
                let d = (x as f64 * STEP - p[0]).hypot(y as f64 * STEP - p[1]) / b.radius;
                if d >= 1.0 {
                    continue;
                }
                ensure(
                    x.abs() <= 1_000_000 && y.abs() <= 1_000_000,
                    "Gelände außerhalb der Welt",
                )?;
                touched.insert((x, y));
                ensure(
                    touched.len() <= LIMIT,
                    "Höchstens 100.000 Höhenpunkte je Aktion",
                )?;
                let w = (1.0 - d * d).powi(2);
                let old = at(g, x, y);
                let z = match b.mode {
                    BrushMode::Raise => old + b.amount * w,
                    BrushMode::Lower => old - b.amount * w,
                    BrushMode::Flatten => old + (b.target - old) * b.strength * w,
                    BrushMode::Smooth => {
                        let mut sum = 0.0;
                        for dy in -1..=1 {
                            for dx in -1..=1 {
                                sum += at(g, x + dx, y + dy);
                            }
                        }
                        old + (sum / 9.0 - old) * b.strength * w
                    }
                };
                ensure(valid_height(z), "Geländehöhe außerhalb ±100.000 Fuß")?;
                updates.push(((x, y), z));
            }
        }
        g.extend(updates);
    }
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    fn brush(points: Vec<Point>) -> Brush {
        Brush {
            mode: BrushMode::Lower,
            radius: 25.0,
            amount: 1.0,
            strength: 0.25,
            target: 0.0,
            points,
        }
    }
    #[test]
    fn resampling_and_negative_tiles() {
        let mut a = Grid::new();
        let mut b = Grid::new();
        stroke(&mut a, &brush(vec![[-20.0, 0.0], [20.0, 0.0]])).unwrap();
        stroke(&mut b, &brush(vec![[-20.0, 0.0], [0.0, 0.0], [20.0, 0.0]])).unwrap();
        assert_eq!(a, b);
        assert!(a.keys().any(|&(x, _)| x < 0));
    }
    #[test]
    fn interpolation_and_modes() {
        let mut g = Grid::new();
        g.insert((0, 0), 0.0);
        g.insert((1, 0), 10.0);
        g.insert((1, 1), 20.0);
        g.insert((0, 1), 10.0);
        assert_eq!(height(&g, [2.5, 2.5]), 10.0);
        for mode in [
            BrushMode::Raise,
            BrushMode::Lower,
            BrushMode::Smooth,
            BrushMode::Flatten,
        ] {
            let mut b = brush(vec![[0.0, 0.0]]);
            b.mode = mode;
            stroke(&mut g, &b).unwrap();
            assert!(g.values().all(|z| valid_height(*z)));
        }
    }
}

#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Foundation {
    pub height: f64,
    pub transition: f64,
}
impl Default for Foundation {
    fn default() -> Self {
        Self {
            height: 1.0,
            transition: 10.0,
        }
    }
}
impl Foundation {
    pub fn validate(&self) -> Result<()> {
        ensure(
            self.height.is_finite()
                && (0.0..=100.0).contains(&self.height)
                && self.transition.is_finite()
                && (0.0..=500.0).contains(&self.transition),
            "Fundament: 0–100 Fuß, Übergang: 0–500 Fuß",
        )
    }
}

#[derive(Clone)]
pub struct Platform {
    pub rings: Vec<Vec<Point>>,
    pub level: f64,
    pub foundation: Foundation,
}
impl Platform {
    pub fn new(rings: Vec<Vec<Point>>, g: &Grid, foundation: Foundation) -> Self {
        use super::geometry::{bounds, contains, edges};
        let b = bounds(rings.iter().flatten().copied());
        let mut level = f64::NEG_INFINITY;
        // Linear triangles attain maxima at footprint vertices, grid vertices,
        // or intersections of footprint edges with the triangle mesh.
        for p in rings.iter().flatten() {
            level = level.max(height(g, *p));
        }
        for (&(x, y), &z) in g {
            let p = [x as f64 * STEP, y as f64 * STEP];
            if p[0] >= b[0] && p[0] <= b[2] && p[1] >= b[1] && p[1] <= b[3] && contains(&rings, p) {
                level = level.max(z);
            }
        }
        for (a, b) in edges(&rings) {
            let d = [b[0] - a[0], b[1] - a[1]];
            for (start, delta) in [(a[0], d[0]), (a[1], d[1]), (a[0] - a[1], d[0] - d[1])] {
                if delta.abs() < 1e-10 {
                    continue;
                }
                let lo = start.min(start + delta);
                let hi = start.max(start + delta);
                for k in (lo / STEP).ceil() as i32..=(hi / STEP).floor() as i32 {
                    let t = (k as f64 * STEP - start) / delta;
                    level = level.max(height(g, [a[0] + d[0] * t, a[1] + d[1] * t]));
                }
            }
        }
        // Include unmodified interior vertices (sparse grid defaults to BASE).
        if level < BASE {
            'rows: for y in (b[1] / STEP).ceil() as i32..=(b[3] / STEP).floor() as i32 {
                for x in (b[0] / STEP).ceil() as i32..=(b[2] / STEP).floor() as i32 {
                    if !g.contains_key(&(x, y))
                        && contains(&rings, [x as f64 * STEP, y as f64 * STEP])
                    {
                        level = BASE;
                        break 'rows;
                    }
                }
            }
        }
        Self {
            rings,
            level,
            foundation,
        }
    }
}
pub fn surface(natural: f64, p: Point, platforms: &[Platform]) -> f64 {
    use super::geometry::{contains, edges, point_segment};
    for platform in platforms {
        if contains(&platform.rings, p) {
            return platform.level;
        }
    }
    platforms.iter().fold(natural, |z, platform| {
        if platform.foundation.transition <= 0.0 {
            return z;
        }
        let distance = edges(&platform.rings)
            .map(|(a, b)| point_segment(p, a, b))
            .fold(f64::INFINITY, f64::min);
        let t = (1.0 - distance / platform.foundation.transition).clamp(0.0, 1.0);
        z.max(natural + (platform.level - natural).max(0.0) * t * t * (3.0 - 2.0 * t))
    })
}

pub fn stroke_centers(b: &Brush) -> Result<Vec<Point>> {
    ensure(
        b.radius.is_finite()
            && (5.0..=500.0).contains(&b.radius)
            && !b.points.is_empty()
            && b.points.len() <= LIMIT
            && b.points.iter().all(|p| super::geometry::valid_point(*p)),
        "Ungültiger Pinselpfad",
    )?;
    let spacing = (b.radius / 4.0).max(2.5);
    let mut centers = vec![b.points[0]];
    let mut remaining = spacing;
    for pair in b.points.windows(2) {
        let mut a = pair[0];
        let end = pair[1];
        let mut length = (end[0] - a[0]).hypot(end[1] - a[1]);
        while length >= remaining && length > 1e-10 {
            let t = remaining / length;
            a = [a[0] + (end[0] - a[0]) * t, a[1] + (end[1] - a[1]) * t];
            centers.push(a);
            ensure(centers.len() <= LIMIT, "Pinselstrich zu lang")?;
            length = (end[0] - a[0]).hypot(end[1] - a[1]);
            remaining = spacing;
        }
        remaining -= length;
    }
    Ok(centers)
}
