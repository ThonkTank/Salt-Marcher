//! Pure height field mathematics. No SQL, editor state or object ownership.
use super::{errors::ensure, Point, Result, Status};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TerrainDelta {
    pub missing_before: Vec<(i32, i32)>,
    pub before: Vec<(i32, i32, f64)>,
    pub after: Vec<(i32, i32, f64)>,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerrainPreview {
    pub surface: Option<TerrainResponse>,
    pub points: Vec<(i32, i32, f64)>,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TerrainArgs {
    #[serde(default)]
    #[cfg_attr(test, ts(optional))]
    pub pixels: Option<u16>,
    #[serde(default)]
    #[cfg_attr(test, ts(optional))]
    pub contour_interval: Option<f64>,
    pub level: u8,
    pub tiles: Vec<[i32; 2]>,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SurfaceTile {
    pub content_id: String,
    /// Prepared relief, water coverage and contours; no author controls.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[cfg_attr(test, ts(optional))]
    pub raster: Option<SurfaceRaster>,
    pub waters: Vec<super::water::WaterBody>,
    pub foundation_tops: Vec<(String, f64)>,
    pub x: i32,
    pub y: i32,
    pub heights: Vec<f64>,
}
impl SurfaceTile {
    /// Hash the wire payload without allocating a second serialized raster.
    /// The empty ID makes the digest independent of revision and previous IDs.
    pub(crate) fn identify(&mut self) -> serde_json::Result<()> {
        use sha2::{Digest, Sha256};
        struct Writer(Sha256);
        impl std::io::Write for Writer {
            fn write(&mut self, bytes: &[u8]) -> std::io::Result<usize> {
                self.0.update(bytes);
                Ok(bytes.len())
            }
            fn flush(&mut self) -> std::io::Result<()> {
                Ok(())
            }
        }
        self.content_id.clear();
        let mut writer = Writer(Sha256::new());
        serde_json::to_writer(&mut writer, self)?;
        self.content_id = format!("{:x}", writer.0.finalize());
        Ok(())
    }
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SurfaceRaster {
    pub contour_interval: f64,
    pub pixels: u16,
    /// Base64 little-endian Float32 node heights: one constant or (pixels+1)^2 values.
    #[cfg(test)]
    #[serde(skip)]
    #[ts(skip)]
    pub heights: String,
    /// Base64 Uint8 ocean coverage: one constant or pixels^2 values.
    #[cfg(test)]
    #[serde(skip)]
    #[ts(skip)]
    pub ocean: String,
    /// Base64 RGBA relief, with one pixel halo on each edge.
    pub relief: String,
    /// Base64 35×35 RGB control nodes (one node halo), or one constant triple.
    /// Rock coverage, snow coverage, illumination (255 = 1.15).
    pub materials: String,
    /// Base64 water coverage with the same halo; local water takes precedence.
    pub water: String,
    pub contours: Vec<[f64; 4]>,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerrainResponse {
    pub status: Status,
    pub level: u8,
    pub tiles: Vec<SurfaceTile>,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SurfacePointsArgs {
    pub version: super::Version,
    pub points: Vec<Point>,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SurfacePointsResponse {
    pub status: Status,
    pub heights: Vec<f64>,
}
pub const BASE: f64 = -100.0;
pub const STEP: f64 = 5.0;
pub const LIMIT: usize = 100_000;
#[derive(Clone, Debug, Default, PartialEq)]
pub struct Grid {
    pub points: BTreeMap<(i32, i32), f64>,
    pub layers: BTreeMap<u8, BTreeMap<(i32, i32), f64>>,
}
impl Grid {
    pub fn new() -> Self {
        Self::default()
    }
    pub fn merge(&mut self, other: Self) {
        self.points.extend(other.points);
        for (level, points) in other.layers {
            self.layers.entry(level).or_default().extend(points);
        }
    }
    pub fn coarse_height(&self, p: Point) -> f64 {
        let mut value = BASE;
        for (&level, points) in self.layers.iter().rev() {
            value = spline_layer(points, p, STEP * 2f64.powi(level as i32), value);
        }
        value
    }
}
impl std::ops::Deref for Grid {
    type Target = BTreeMap<(i32, i32), f64>;
    fn deref(&self) -> &Self::Target {
        &self.points
    }
}
impl std::ops::DerefMut for Grid {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.points
    }
}
impl FromIterator<((i32, i32), f64)> for Grid {
    fn from_iter<T: IntoIterator<Item = ((i32, i32), f64)>>(iter: T) -> Self {
        Self {
            points: iter.into_iter().collect(),
            layers: BTreeMap::new(),
        }
    }
}
impl<'a> IntoIterator for &'a Grid {
    type Item = (&'a (i32, i32), &'a f64);
    type IntoIter = std::collections::btree_map::Iter<'a, (i32, i32), f64>;
    fn into_iter(self) -> Self::IntoIter {
        self.points.iter()
    }
}
impl IntoIterator for Grid {
    type Item = ((i32, i32), f64);
    type IntoIter = std::collections::btree_map::IntoIter<(i32, i32), f64>;
    fn into_iter(self) -> Self::IntoIter {
        self.points.into_iter()
    }
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Brush {
    #[serde(default)]
    #[cfg_attr(test, ts(optional))]
    pub resolution: Option<u8>,
    #[serde(default)]
    #[cfg_attr(test, ts(optional))]
    pub roughness: Option<f64>,
    #[serde(default)]
    #[cfg_attr(test, ts(optional))]
    pub feature_height: Option<f64>,
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
    Land,
    Sea,
    Raise,
    Lower,
    Smooth,
    Flatten,
    Mountains,
    Hills,
    Canyon,
}
pub fn valid_height(z: f64) -> bool {
    z.is_finite() && z.abs() <= 100_000.0
}
pub fn at(g: &Grid, x: i32, y: i32) -> f64 {
    g.get(&(x, y))
        .copied()
        .unwrap_or_else(|| g.coarse_height([x as f64 * STEP, y as f64 * STEP]))
}
/// Positive cubic basis: C2 continuous and bounded by its control values.
pub fn spline_weights(t: f64) -> [f64; 4] {
    let t2 = t * t;
    let t3 = t2 * t;
    [
        (1. - t).powi(3) / 6.,
        (3. * t3 - 6. * t2 + 4.) / 6.,
        (-3. * t3 + 3. * t2 + 3. * t + 1.) / 6.,
        t3 / 6.,
    ]
}
fn spline_layer(points: &BTreeMap<(i32, i32), f64>, p: Point, step: f64, inherited: f64) -> f64 {
    if points.is_empty() {
        return inherited;
    }
    let gx = p[0] / step;
    let gy = p[1] / step;
    let x = gx.floor() as i32;
    let y = gy.floor() as i32;
    let wx = spline_weights(gx - x as f64);
    let wy = spline_weights(gy - y as f64);
    let first = points.get(&(x - 1, y - 1)).copied().unwrap_or(inherited);
    let mut uniform = true;
    let mut value = 0.;
    for (j, &v) in wy.iter().enumerate() {
        for (i, &u) in wx.iter().enumerate() {
            let z = points
                .get(&(x + i as i32 - 1, y + j as i32 - 1))
                .copied()
                .unwrap_or(inherited);
            uniform &= z == first;
            value += u * v * z;
        }
    }
    if uniform {
        first
    } else {
        value
    }
}
pub fn height(g: &Grid, p: Point) -> f64 {
    spline_layer(&g.points, p, STEP, g.coarse_height(p))
}
pub fn stroke(g: &mut Grid, b: &Brush) -> Result<()> {
    stroke_with_offset(g, b, None)
}
/// Exact swept-disk samples in author coordinates. Blocks only carry nearby
/// segments; horizontal strip clipping keeps long diagonals spatially local.
pub type LandSamples = BTreeMap<(i32, i32), f64>;

// A continuous spatial field, independent of event spacing, section boundaries,
// or traversal direction. Coordinates and radius scale together for coarse authors.
fn coast_noise(p: Point) -> f64 {
    fn value(x: i64, y: i64) -> f64 {
        let mut h =
            (x as u32).wrapping_mul(374761393) ^ (y as u32).wrapping_mul(668265263) ^ 0x9e3779b9;
        h = (h ^ (h >> 13)).wrapping_mul(1274126177);
        (h ^ (h >> 16)) as f64 / u32::MAX as f64
    }
    let x = p[0].floor() as i64;
    let y = p[1].floor() as i64;
    let smooth = |t: f64| t * t * t * (t * (t * 6. - 15.) + 10.);
    let tx = smooth(p[0] - x as f64);
    let ty = smooth(p[1] - y as f64);
    let mix = |a: f64, b: f64, t: f64| a + (b - a) * t;
    mix(
        mix(value(x, y), value(x + 1, y), tx),
        mix(value(x, y + 1), value(x + 1, y + 1), tx),
        ty,
    )
}

fn coast_inset(b: &Brush, p: Point) -> f64 {
    let roughness = b.roughness.unwrap_or(0.);
    if roughness == 0. {
        return 0.;
    }
    let q = [p[0] / b.radius, p[1] / b.radius];
    let noise = [(1.5, 0.2), (4.5, 0.5), (11., 0.3)]
        .into_iter()
        .map(|(frequency, weight)| {
            weight * coast_noise([q[0] * frequency + 17.3, q[1] * frequency - 43.7])
        })
        .sum::<f64>();
    b.radius * roughness * 0.6 * ((noise - 0.5) * 1.8 + 0.5).clamp(0., 1.)
}
pub fn land_samples(b: &Brush) -> Result<Option<LandSamples>> {
    if !matches!(b.mode, BrushMode::Land | BrushMode::Sea) {
        return Ok(None);
    }
    // Share validation and the existing per-stamp budget with other modes.
    validate_stroke(b)?;
    let segments: Vec<_> = if b.points.len() == 1 {
        vec![(b.points[0], b.points[0])]
    } else {
        b.points.windows(2).map(|p| (p[0], p[1])).collect()
    };
    let width = STEP * 16.;
    let pad = b.radius + STEP * 2.;
    let mut blocks = BTreeMap::<(i32, i32), Vec<usize>>::new();
    for (index, &(a, end)) in segments.iter().enumerate() {
        let dy = end[1] - a[1];
        let y0 = ((a[1].min(end[1]) - pad) / width).floor() as i32;
        let y1 = ((a[1].max(end[1]) + pad) / width).floor() as i32;
        for y in y0..=y1 {
            let (lo, hi) = if dy == 0. {
                (0., 1.)
            } else {
                let t0 = (y as f64 * width - pad - a[1]) / dy;
                let t1 = ((y + 1) as f64 * width + pad - a[1]) / dy;
                (t0.min(t1).max(0.), t0.max(t1).min(1.))
            };
            if lo > hi {
                continue;
            }
            let x0 = a[0] + (end[0] - a[0]) * lo;
            let x1 = a[0] + (end[0] - a[0]) * hi;
            for x in ((x0.min(x1) - pad) / width).floor() as i32
                ..=((x0.max(x1) + pad) / width).floor() as i32
            {
                blocks.entry((x, y)).or_default().push(index);
                ensure(blocks.len() * 256 <= 400_000, "Geländestrich zu groß")?;
            }
        }
    }
    let mut samples = LandSamples::new();
    for ((bx, by), nearby) in blocks {
        for y in by * 16..by * 16 + 16 {
            for x in bx * 16..bx * 16 + 16 {
                let p = [x as f64 * STEP, y as f64 * STEP];
                let distance = nearby
                    .iter()
                    .map(|&i| {
                        let (a, end) = segments[i];
                        let v = [end[0] - a[0], end[1] - a[1]];
                        let norm = v[0] * v[0] + v[1] * v[1];
                        let t = if norm == 0. {
                            0.
                        } else {
                            (((p[0] - a[0]) * v[0] + (p[1] - a[1]) * v[1]) / norm).clamp(0., 1.)
                        };
                        (p[0] - a[0] - t * v[0]).hypot(p[1] - a[1] - t * v[1])
                    })
                    .fold(f64::INFINITY, f64::min);
                if distance < pad {
                    if x.abs() > 20_000_000 || y.abs() > 20_000_000 {
                        continue;
                    }
                    samples.insert((x, y), distance + coast_inset(b, p));
                    ensure(
                        samples.len() <= LIMIT,
                        "Höchstens 100.000 Höhenpunkte je Aktion. Pinsel verkleinern oder kürzere Striche malen.",
                    )?;
                }
            }
        }
    }
    Ok(Some(samples))
}

pub fn stroke_with_offset(g: &mut Grid, b: &Brush, offset: Option<f64>) -> Result<()> {
    let samples = land_samples(b)?;
    stroke_prepared(g, b, offset, samples.as_ref())
}
pub fn stroke_prepared(
    g: &mut Grid,
    b: &Brush,
    offset: Option<f64>,
    samples: Option<&LandSamples>,
) -> Result<()> {
    ensure(
        b.radius.is_finite() && (0.001..=10_000_000.0).contains(&b.radius),
        "Ungültiger Pinselradius",
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
                .all(|v| v.is_finite() && v.abs() <= 100_000_000.0),
        "Ungültiger Pinselpfad",
    )?;
    if let Some(samples) = samples {
        for (&(x, y), &distance) in samples {
            let old = at(g, x, y);
            let profile = ((b.radius - distance) / STEP * 10.).clamp(-10., 10.);
            g.insert(
                (x, y),
                if matches!(b.mode, BrushMode::Land) {
                    old.max(profile)
                } else {
                    old.min(-profile)
                },
            );
        }
        return Ok(());
    }
    let centers = stroke_centers_offset(b, offset)?;
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
                if x.abs() > 20_000_000 || y.abs() > 20_000_000 {
                    continue;
                }
                touched.insert((x, y));
                ensure(
                    touched.len() <= LIMIT,
                    "Höchstens 100.000 Höhenpunkte je Aktion. Pinsel verkleinern oder kürzere Striche malen.",
                )?;
                let w = (1.0 - d * d).powi(2);
                let old = at(g, x, y);
                let z = match b.mode {
                    BrushMode::Land => old.max(10.0),
                    BrushMode::Sea => old.min(-10.0),
                    BrushMode::Mountains | BrushMode::Hills | BrushMode::Canyon => {
                        let q = [x as f64 * STEP / b.radius, y as f64 * STEP / b.radius];
                        let shape = feature_profile(b.mode, q, d);
                        old + b.feature_height.unwrap_or(100.0) * shape
                    }
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
            resolution: None,
            roughness: None,
            feature_height: None,
            mode: BrushMode::Lower,
            radius: 25.0,
            amount: 1.0,
            strength: 0.25,
            target: 0.0,
            points,
        }
    }
    #[test]
    fn feature_relief_is_bounded_varied_and_accumulates() {
        for mode in [BrushMode::Mountains, BrushMode::Hills, BrushMode::Canyon] {
            let mut b = brush(vec![[-100., -20.], [0., 20.], [100., -20.]]);
            b.mode = mode;
            b.radius = 80.;
            b.feature_height = Some(1000.);
            let mut grid = Grid::new();
            stroke(&mut grid, &b).unwrap();
            let first = grid.clone();
            let base = at(&Grid::new(), 0, 0);
            let sign = if matches!(mode, BrushMode::Canyon) {
                -1.
            } else {
                1.
            };
            assert!(first.iter().all(|(_, z)| (z - base) * sign >= 0.));
            assert!((at(&first, 0, 0) - base) * sign > 10.);
            assert_eq!(at(&first, 0, 40), base);
            assert!((at(&first, 0, 0) - at(&first, 8, 0)).abs() > 1.);
            stroke(&mut grid, &b).unwrap();
            for (&key, &z) in first.iter() {
                assert!((grid.get(&key).unwrap() - base - 2. * (z - base)).abs() < 1e-8);
            }
            b.feature_height = Some(f64::NAN);
            assert!(stroke(&mut grid, &b).is_err());
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
        for y in -2..=3 {
            for x in -2..=3 {
                g.insert((x, y), (x + y) as f64 * 10.);
            }
        }
        assert!((height(&g, [2.5, 2.5]) - 10.).abs() < 1e-10);
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
    influence: rstar::AABB<Point>,
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
        for (&resolution, samples) in &g.layers {
            let step = STEP * 2f64.powi(resolution as i32);
            for &(x, y) in samples.keys() {
                let p = [x as f64 * step, y as f64 * step];
                if p[0] >= b[0]
                    && p[0] <= b[2]
                    && p[1] >= b[1]
                    && p[1] <= b[3]
                    && contains(&rings, p)
                {
                    level = level.max(height(g, p));
                }
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
                        level = level.max(height(g, [x as f64 * STEP, y as f64 * STEP]));
                        if level >= BASE {
                            break 'rows;
                        }
                    }
                }
            }
        }
        // A segment projection and a ray crossing use a fraction in [0, 1].
        // Their few rounding operations can move a result only O(eps * M)
        // outside the endpoint bounds; EPS and 64 eps * M reserve that margin.
        // The bounds only filter candidates, never replace exact containment.
        let m = b
            .iter()
            .map(|v| v.abs())
            .fold(1.0_f64, f64::max)
            .max(b[2] - b[0])
            .max(b[3] - b[1])
            .max(foundation.transition);
        let pad = super::geometry::EPS + 64.0 * f64::EPSILON * m;
        let influence = super::geometry::expand(b, foundation.transition + pad);
        Self {
            rings,
            level,
            foundation,
            influence: rstar::AABB::from_corners(
                [influence[0], influence[1]],
                [influence[2], influence[3]],
            ),
        }
    }
}

struct PlatformEntry {
    ordinal: usize,
    envelope: rstar::AABB<Point>,
}
impl rstar::RTreeObject for PlatformEntry {
    type Envelope = rstar::AABB<Point>;
    fn envelope(&self) -> Self::Envelope {
        self.envelope
    }
}
pub struct PreparedPlatforms<'a> {
    platforms: Vec<&'a Platform>,
    index: rstar::RTree<PlatformEntry>,
    candidates: Vec<usize>,
}
impl<'a> PreparedPlatforms<'a> {
    pub fn new(platforms: Vec<&'a Platform>) -> Self {
        let entries = platforms
            .iter()
            .enumerate()
            .map(|(ordinal, p)| PlatformEntry {
                ordinal,
                envelope: p.influence,
            })
            .collect();
        Self {
            platforms,
            index: rstar::RTree::bulk_load(entries),
            candidates: Vec::new(),
        }
    }
    pub fn at(&mut self, natural: f64, p: Point) -> f64 {
        self.candidates.clear();
        self.candidates.extend(
            self.index
                .locate_in_envelope_intersecting(&rstar::AABB::from_point(p))
                .map(|entry| entry.ordinal),
        );
        self.candidates.sort_unstable();
        evaluate_surface(
            natural,
            p,
            self.candidates.iter().map(|&i| self.platforms[i]),
        )
    }
}
#[cfg(test)]
pub fn surface(natural: f64, p: Point, platforms: &[Platform]) -> f64 {
    evaluate_surface(natural, p, platforms.iter())
}
#[cfg(test)]
thread_local! { static SURFACE_COUNTS: std::cell::Cell<(usize, usize)> = const { std::cell::Cell::new((0, 0)) }; }
fn evaluate_surface<'a, I>(natural: f64, p: Point, platforms: I) -> f64
where
    I: Iterator<Item = &'a Platform> + Clone,
{
    use super::geometry::{contains, edges, point_segment};
    for platform in platforms.clone() {
        #[cfg(test)]
        SURFACE_COUNTS.with(|c| {
            let (a, b) = c.get();
            c.set((a + 1, b));
        });
        if contains(&platform.rings, p) {
            return platform.level;
        }
    }
    platforms.fold(natural, |z, platform| {
        if platform.foundation.transition <= 0.0 {
            return z;
        }
        let distance = edges(&platform.rings)
            .map(|(a, b)| {
                #[cfg(test)]
                SURFACE_COUNTS.with(|c| {
                    let (a, b) = c.get();
                    c.set((a, b + 1));
                });
                point_segment(p, a, b)
            })
            .fold(f64::INFINITY, f64::min);
        let t = (1.0 - distance / platform.foundation.transition).clamp(0.0, 1.0);
        z.max(natural + (platform.level - natural).max(0.0) * t * t * (3.0 - 2.0 * t))
    })
}

// World-anchored relief, invariant when points and radius are scaled into an
// author grid. The 15/64 factor normalizes the quartic kernel at radius/4 spacing.
fn feature_profile(mode: BrushMode, q: Point, d: f64) -> f64 {
    // Rotate and gently warp the field so lattice axes do not become straight
    // east-west / north-south ridges. The warp is spatial, never event-random.
    let rotated = [0.8 * q[0] - 0.6 * q[1], 0.6 * q[0] + 0.8 * q[1]];
    let warped = [
        rotated[0] + 0.6 * (coast_noise([rotated[0] * 1.7 + 5.2, rotated[1] * 1.7 + 9.1]) - 0.5),
        rotated[1] + 0.6 * (coast_noise([rotated[0] * 1.7 - 8.3, rotated[1] * 1.7 + 2.4]) - 0.5),
    ];
    let noise = |f: f64| coast_noise([warped[0] * f + 17.3, warped[1] * f - 43.7]);
    let w = (1.0 - d * d).powi(2);
    match mode {
        BrushMode::Hills => w * (0.12 + 0.88 * noise(3.5).powi(2)) * 0.234375,
        BrushMode::Mountains => {
            let ridge = |f| (1.0 - (2.0 * noise(f) - 1.0).abs()).powi(3);
            w * (0.12 + 0.65 * ridge(2.5) + 0.23 * ridge(7.5)) * 0.234375
        }
        BrushMode::Canyon => {
            let floor = (1.0 - d.powi(4)).max(0.0).powi(8);
            -floor * (0.85 + 0.15 * noise(5.0)) * 0.2
        }
        _ => 0.0,
    }
}

fn validate_stroke(b: &Brush) -> Result<()> {
    ensure(
        b.feature_height
            .is_none_or(|h| h.is_finite() && (0.1..=30_000.0).contains(&h)),
        "Reliefhöhe: 0,1–30.000 Fuß",
    )?;
    ensure(
        b.roughness
            .is_none_or(|r| r.is_finite() && (0.0..=1.0).contains(&r)),
        "Küstenrauheit: 0–100 %",
    )?;
    ensure(
        b.radius.is_finite()
            && (0.001..=10_000_000.0).contains(&b.radius)
            && !b.points.is_empty()
            && b.points.len() <= LIMIT
            && b.points.iter().all(|p| super::geometry::valid_point(*p)),
        "Ungültiger Pinselpfad",
    )?;
    ensure(
        (2.0 * b.radius / STEP + 3.0).powi(2) <= 400_000.0,
        "Höhenpinsel zu groß; bitte hineinzoomen oder Pinsel verkleinern",
    )?;
    Ok(())
}

pub fn stroke_centers_offset(b: &Brush, offset: Option<f64>) -> Result<Vec<Point>> {
    validate_stroke(b)?;
    let spacing = (b.radius / 4.0).max(2.5);
    let sweep = matches!(b.mode, BrushMode::Land | BrushMode::Sea);
    let mut centers = if offset.is_none() || sweep {
        vec![b.points[0]]
    } else {
        vec![]
    };
    let mut remaining = if sweep {
        spacing
    } else {
        offset.unwrap_or(spacing)
    };
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
    if sweep && centers.last() != b.points.last() {
        centers.push(*b.points.last().unwrap());
    }
    Ok(centers)
}

#[cfg(test)]
mod platform_index_tests {
    use super::*;
    fn square(x: f64, y: f64, size: f64) -> Vec<Point> {
        vec![[x, y], [x + size, y], [x + size, y + size], [x, y + size]]
    }
    fn platform(rings: Vec<Vec<Point>>, level: f64, transition: f64) -> Platform {
        let mut p = Platform::new(
            rings,
            &Grid::new(),
            Foundation {
                height: 1.,
                transition,
            },
        );
        p.level = level;
        p
    }
    fn compare(platforms: &[Platform], points: &[Point]) {
        let mut indexed = PreparedPlatforms::new(platforms.iter().collect());
        for &p in points {
            let expected = surface(10., p, platforms);
            assert!(expected.is_finite());
            assert_eq!(indexed.at(10., p), expected, "{p:?}");
        }
    }
    #[test]
    fn indexed_surface_preserves_edges_holes_order_and_world_limits() {
        let base = platform(vec![square(0., 0., 20.)], 30., 10.);
        for (point, expected) in [([10., 10.], 30.), ([25., 10.], 20.), ([30., 10.], 10.)] {
            assert_eq!(surface(10., point, std::slice::from_ref(&base)), expected);
        }
        let zero = platform(vec![square(0., 0., 20.)], 30., 0.);
        assert_eq!(surface(10., [0., 10.], std::slice::from_ref(&zero)), 10.);
        assert_eq!(
            surface(
                10.,
                [super::super::geometry::EPS / 2., 10.],
                std::slice::from_ref(&zero)
            ),
            10.
        );
        assert_eq!(surface(10., [1., 10.], std::slice::from_ref(&zero)), 30.);
        let hole = platform(vec![square(0., 0., 40.), square(10., 10., 20.)], 30., 10.);
        assert_eq!(surface(10., [20., 20.], std::slice::from_ref(&hole)), 10.);
        assert_eq!(surface(10., [15., 20.], std::slice::from_ref(&hole)), 20.);
        let high = platform(vec![square(0., 0., 20.)], 50., 10.);
        assert_eq!(surface(10., [10., 10.], &[base.clone(), high.clone()]), 30.);
        assert_eq!(surface(10., [10., 10.], &[high.clone(), base.clone()]), 50.);
        let shifted = platform(vec![square(25., 0., 20.)], 15., 10.);
        assert_eq!(
            surface(10., [26., 10.], &[high.clone(), shifted.clone()]),
            15.
        );
        let rotated = platform(
            vec![vec![[-30., 0.], [-20., -10.], [-10., 0.], [-20., 10.]]],
            40.,
            500.,
        );
        let mut platforms = vec![base, zero, hole, high, shifted, rotated];
        for origin in [-100_000_000., 99_999_970.] {
            platforms.push(platform(vec![square(origin, origin, 20.)], 30., 10.));
        }
        let mut points = vec![
            [0., 10.],
            [f64::from_bits(0.0f64.to_bits() + 1), 10.],
            [10., 10.],
            [20., 10.],
            [25., 10.],
            [30., 10.],
            [-20., 0.],
            [-530., 0.],
            [510., 0.],
            [15., 20.],
            [20., 20.],
        ];
        for origin in [-100_000_000., 99_999_970.] {
            for offset in [-10., 0., 10., 20., 30.] {
                let x: f64 = origin + offset;
                points.extend([
                    [x, origin + 10.],
                    [f64::from_bits(x.to_bits() - 1), origin + 10.],
                    [f64::from_bits(x.to_bits() + 1), origin + 10.],
                ]);
            }
        }
        compare(&platforms, &points);
        platforms.reverse();
        compare(&platforms, &points);
        compare(&[], &points);
    }
    #[test]
    fn indexed_surface_reduces_actual_predicates() {
        let platforms: Vec<_> = (0..256)
            .map(|i| platform(vec![square(i as f64 * 100., 0., 20.)], 30., 10.))
            .collect();
        let point = [25., 10.];
        let mut index = PreparedPlatforms::new(platforms.iter().collect());
        SURFACE_COUNTS.with(|c| c.set((0, 0)));
        let actual = index.at(10., point);
        let indexed = SURFACE_COUNTS.with(|c| c.get());
        SURFACE_COUNTS.with(|c| c.set((0, 0)));
        let expected = surface(10., point, &platforms);
        let full = SURFACE_COUNTS.with(|c| c.get());
        assert_eq!(actual, expected);
        assert_eq!(actual, 20.);
        assert_eq!(indexed, (1, 4));
        assert_eq!(full, (256, 1024));
        eprintln!("surface predicates: indexed={indexed:?}, unfiltered={full:?}");
    }
}

#[cfg(test)]
mod swept_land_tests {
    use super::*;
    #[test]
    fn crinkled_coast_is_spatial_continuous_and_packet_independent() {
        for mode in [BrushMode::Land, BrushMode::Sea] {
            let mut brush = Brush {
                resolution: None,
                roughness: Some(0.8),
                feature_height: None,
                mode,
                radius: 80.,
                amount: 1.,
                strength: 1.,
                target: 10.,
                points: vec![
                    [-150., -30.],
                    [-70., 50.],
                    [40., 20.],
                    [0., -40.],
                    [-70., 50.],
                ],
            };
            let mut full = Grid::new();
            if matches!(mode, BrushMode::Sea) {
                for point in land_samples(&brush).unwrap().unwrap().keys() {
                    full.insert(*point, 10.);
                }
            }
            let mut split = full.clone();
            stroke(&mut full, &brush).unwrap();
            for segment in brush.points.windows(2) {
                let mut part = brush.clone();
                part.points = segment.to_vec();
                stroke(&mut split, &part).unwrap();
            }
            assert_eq!(full, split);
            stroke(&mut split, &brush).unwrap();
            assert_eq!(full, split, "overpainting must not randomize the coast");
            let samples = land_samples(&brush).unwrap().unwrap();
            brush.roughness = Some(0.);
            let smooth = land_samples(&brush).unwrap().unwrap();
            assert_eq!(samples.len(), smooth.len());
            assert!(samples.iter().filter(|(p, d)| **d > smooth[p] + 5.).count() > 100);
            brush.roughness = None;
            assert_eq!(smooth, land_samples(&brush).unwrap().unwrap());
        }
        let mut brush = Brush {
            resolution: None,
            roughness: None,
            feature_height: None,
            mode: BrushMode::Land,
            radius: 25.,
            amount: 1.,
            strength: 1.,
            target: 10.,
            points: vec![[0., 0.]],
        };
        brush.roughness = Some(1.);
        for p in [[-80., 40.], [0., 0.], [100_000_000., -100_000_000.]] {
            let inset = coast_inset(&brush, p);
            assert!((0.0..=brush.radius * 0.6).contains(&inset));
            assert!((coast_inset(&brush, [p[0] + 1e-5, p[1]]) - inset).abs() < 1e-4);
        }
        for invalid in [-0.01, 1.01, f64::NAN, f64::INFINITY] {
            brush.roughness = Some(invalid);
            assert!(stroke(&mut Grid::new(), &brush).is_err());
        }
    }
    #[test]
    fn spatial_land_matches_full_segment_reference_and_packet_splits() {
        let paths = [
            vec![[-80., -80.]],
            vec![[-161., -81.], [159., 79.]],
            vec![
                [0., 0.],
                [0., 0.],
                [100., 0.],
                [80., 80.],
                [-80., 80.],
                [0., 0.],
            ],
            vec![[-160., 160.], [160., -160.], [-160., -160.], [160., 160.]],
        ];
        for points in paths {
            for mode in [BrushMode::Land, BrushMode::Sea] {
                let brush = Brush {
                    resolution: None,
                    roughness: None,
                    feature_height: None,
                    mode,
                    radius: 21.,
                    amount: 1.,
                    strength: 1.,
                    target: 10.,
                    points: points.clone(),
                };
                let samples = land_samples(&brush).unwrap().unwrap();
                for y in -40..=40 {
                    for x in -40..=40 {
                        let p = [x as f64 * STEP, y as f64 * STEP];
                        let d = if points.len() == 1 {
                            (p[0] - points[0][0]).hypot(p[1] - points[0][1])
                        } else {
                            points
                                .windows(2)
                                .map(|pair| {
                                    super::super::geometry::point_segment(p, pair[0], pair[1])
                                })
                                .fold(f64::INFINITY, f64::min)
                        };
                        if d < brush.radius + STEP * 2. {
                            assert!((samples[&(x, y)] - d).abs() < 1e-10, "{p:?}");
                        } else {
                            assert!(!samples.contains_key(&(x, y)));
                        }
                    }
                }
                let mut full = Grid::new();
                stroke(&mut full, &brush).unwrap();
                let mut split = Grid::new();
                let mut section = brush.clone();
                section.points = vec![points[0]];
                stroke(&mut split, &section).unwrap();
                for pair in points.windows(2) {
                    section.points = pair.to_vec();
                    stroke(&mut split, &section).unwrap();
                }
                assert_eq!(full, split);
            }
        }
    }
    #[test]
    fn long_diagonal_uses_corridor_not_bounding_rectangle() {
        let brush = Brush {
            resolution: None,
            roughness: None,
            feature_height: None,
            mode: BrushMode::Land,
            radius: 10.,
            amount: 1.,
            strength: 1.,
            target: 10.,
            points: vec![[-5000., -5000.], [5000., 5000.]],
        };
        let samples = land_samples(&brush).unwrap().unwrap();
        assert!(samples.len() < 30000);
        assert!(samples.contains_key(&(0, 0)));
        assert!(!samples.contains_key(&(0, 100)));
    }
}
