//! Deterministic landscape asset scattering, independent of storage and rendering.
use super::{errors::ensure, geometry, Bounds, Point, Result};
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;

#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum Biome {
    Forest,
    Meadow,
    Scrub,
    Rocks,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SceneryBrush {
    pub biome: Biome,
    pub radius: f64,
    pub density: f64,
    pub size: f64,
    pub seed: u32,
    pub points: Vec<Point>,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct SceneryAsset {
    pub point: Point,
    pub size: f64,
    pub angle: f64,
    pub variant: u8,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Scenery {
    pub id: String,
    pub biome: Biome,
    pub assets: Vec<SceneryAsset>,
}
impl Scenery {
    pub fn bounds(&self) -> Bounds {
        geometry::bounds(self.assets.iter().flat_map(|a| {
            [
                [a.point[0] - a.size, a.point[1] - a.size],
                [a.point[0] + a.size, a.point[1] + a.size],
            ]
        }))
    }
    pub fn validate(&self) -> Result<()> {
        ensure(
            !self.assets.is_empty()
                && self.assets.len() <= 4096
                && self.assets.iter().all(|a| {
                    geometry::valid_point(a.point)
                        && a.size.is_finite()
                        && (0.5..=100.0).contains(&a.size)
                        && a.angle.is_finite()
                        && (0.0..std::f64::consts::TAU).contains(&a.angle)
                        && a.variant < 4
                        && a.point.iter().all(|v| v.abs() + a.size <= 100_000_000.0)
                }),
            "Ungültige Landschafts-Assets",
        )
    }
}
fn random(x: i32, y: i32, seed: u32, salt: u32) -> f64 {
    let mut n =
        (x as u32).wrapping_mul(374761393) ^ (y as u32).wrapping_mul(668265263) ^ seed ^ salt;
    n = (n ^ (n >> 13)).wrapping_mul(1274126177);
    n ^= n >> 16;
    f64::from(n) / 4294967296.0
}
pub fn scatter(b: &SceneryBrush, id: String) -> Result<Scenery> {
    ensure(
        b.radius.is_finite()
            && (0.001..=10_000_000.0).contains(&b.radius)
            && b.density.is_finite()
            && (0.05..=1.0).contains(&b.density)
            && b.size.is_finite()
            && (1.0..=80.0).contains(&b.size)
            && !b.points.is_empty()
            && b.points.len() <= 4096
            && b.points.iter().all(|p| geometry::valid_point(*p)),
        "Ungültiger Landschaftspinsel",
    )?;
    let step = b.size * 1.7;
    let mut cells = BTreeSet::new();
    // Sample along the path, avoiding a scan over a large diagonal bounding box.
    let mut segments = vec![(b.points[0], b.points[0])];
    segments.extend(b.points.windows(2).map(|p| (p[0], p[1])));
    let mut work = 0usize;
    let mut assets = vec![];
    for (start, end) in segments {
        let count = (geometry::distance(start, end) / (b.radius * 0.5)).ceil() as usize;
        ensure(count <= 100_000, "Pinselstrich zu lang")?;
        for i in 0..=count {
            let t = if count == 0 {
                0.0
            } else {
                i as f64 / count as f64
            };
            let p = [
                start[0] + (end[0] - start[0]) * t,
                start[1] + (end[1] - start[1]) * t,
            ];
            let reach = b.radius * 1.3;
            for y in ((p[1] - reach) / step).floor() as i32..=((p[1] + reach) / step).floor() as i32
            {
                for x in
                    ((p[0] - reach) / step).floor() as i32..=((p[0] + reach) / step).floor() as i32
                {
                    work += 1;
                    ensure(
                        work <= 1_000_000,
                        "Pinselstrich zu aufwendig; kürzeren Strich oder größere Assets wählen",
                    )?;
                    if cells.contains(&(x, y)) {
                        continue;
                    }
                    let point = [
                        (x as f64 + 0.15 + random(x, y, b.seed, 1) * 0.7) * step,
                        (y as f64 + 0.15 + random(x, y, b.seed, 2) * 0.7) * step,
                    ];
                    // Exact swept circle, independent of pointer event subdivision.
                    let inside = geometry::point_segment(point, start, end) <= b.radius;
                    if !inside {
                        continue;
                    }
                    cells.insert((x, y));
                    ensure(cells.len() <= 100_000, "Landschaftsstrich zu groß")?;
                    if random(x, y, b.seed, 3) > b.density {
                        continue;
                    }
                    assets.push(SceneryAsset {
                        point,
                        size: b.size * (0.7 + random(x, y, b.seed, 4) * 0.55),
                        angle: random(x, y, b.seed, 5) * std::f64::consts::TAU,
                        variant: (random(x, y, b.seed, 6) * 4.0) as u8,
                    });
                    ensure(assets.len()<=4096,"Höchstens 4.096 Assets je Pinselstrich; kleineren Pinsel oder geringere Dichte wählen")?;
                }
            }
        }
    }
    assets.sort_by(|a, b| {
        a.point[1]
            .total_cmp(&b.point[1])
            .then(a.point[0].total_cmp(&b.point[0]))
    });
    let out = Scenery {
        id,
        biome: b.biome,
        assets,
    };
    if !out.assets.is_empty() {
        out.validate()?;
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn brush() -> SceneryBrush {
        SceneryBrush {
            biome: Biome::Forest,
            radius: 30.0,
            density: 0.7,
            size: 8.0,
            seed: 17,
            points: vec![[-40.0, -20.0], [60.0, 20.0]],
        }
    }
    #[test]
    fn stable_scatter_is_independent_of_pointer_frequency() {
        let b = brush();
        let first = scatter(&b, "scenery-1".into()).unwrap();
        assert!(!first.assets.is_empty());
        let mut split = b.clone();
        split.points.insert(1, [10.0, 0.0]);
        assert_eq!(first, scatter(&split, "scenery-1".into()).unwrap());
        assert_eq!(first, scatter(&b, "scenery-1".into()).unwrap());
        for a in &first.assets {
            assert!(geometry::point_segment(a.point, b.points[0], b.points[1]) <= b.radius);
        }
        split.seed += 1;
        assert_ne!(first, scatter(&split, "scenery-1".into()).unwrap());
    }
    #[test]
    fn density_is_nested_and_limits_reject_invalid_strokes() {
        let mut b = brush();
        let sparse = scatter(&b, "s".into()).unwrap();
        b.density = 1.0;
        let dense = scatter(&b, "s".into()).unwrap();
        assert!(dense.assets.len() >= sparse.assets.len());
        for a in sparse.assets {
            assert!(dense.assets.contains(&a));
        }
        b.radius = f64::NAN;
        assert!(scatter(&b, "s".into()).is_err());
        b = brush();
        b.points = vec![[-1e8, 0.0], [1e8, 0.0]];
        assert!(scatter(&b, "s".into()).is_err());
        b = brush();
        b.size = 1.0;
        b.radius = 500.0;
        b.density = 1.0;
        assert!(scatter(&b, "s".into()).is_err());
    }
}
