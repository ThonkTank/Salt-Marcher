//! Pure ground pigment brush. Pixels are premultiplied RGBA; no geometry ownership.
use super::{errors::ensure, geometry::valid_point, Result, Status};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
pub const SIDE: usize = 64;
pub const BYTES: usize = SIDE * SIDE * 4;
pub type Tiles = BTreeMap<(u8, i32, i32), Vec<u8>>;
/// Reduce one child tile into its quadrant of a parent, retaining premultiplied channels.
pub(super) fn downsample_quadrant(parent: &mut [u8], child: &[u8], cx: usize, cy: usize) {
    for py in 0..SIDE / 2 {
        for px in 0..SIDE / 2 {
            for c in 0..4 {
                let i = (py * 2 * SIDE + px * 2) * 4 + c;
                let sum = child[i] as u16
                    + child[i + 4] as u16
                    + child[i + SIDE * 4] as u16
                    + child[i + SIDE * 4 + 4] as u16;
                parent[((cy * (SIDE / 2) + py) * SIDE + cx * (SIDE / 2) + px) * 4 + c] =
                    ((sum + 2) / 4) as u8;
            }
        }
    }
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct GroundBrush {
    #[serde(default)]
    #[cfg_attr(test, ts(optional))]
    pub resolution: Option<u8>,
    pub mode: GroundMode,
    pub tip: GroundTip,
    pub color: [u8; 3],
    pub diameter: f64,
    pub opacity: f64,
    pub flow: f64,
    pub seed: u32,
    /// World x/y and elapsed milliseconds, starting at zero.
    pub points: Vec<[f64; 3]>,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum GroundMode {
    Paint,
    Erase,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum GroundTip {
    Soft,
    Hard,
    Cloud,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct GroundArgs {
    pub level: u8,
    pub tiles: Vec<[i32; 2]>,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct GroundTile {
    pub x: i32,
    pub y: i32,
    #[serde(with = "pixel_wire")]
    #[cfg_attr(test, ts(type = "string"))]
    pub pixels: Vec<u8>,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct GroundResponse {
    pub status: Status,
    pub level: u8,
    pub tiles: Vec<GroundTile>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct GroundAuthorTile {
    pub level: u8,
    pub x: i32,
    pub y: i32,
    /// Empty means absent; transparent tiles override inherited color.
    #[serde(with = "pixel_wire")]
    pub pixels: Vec<u8>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct GroundDelta {
    pub before: Vec<GroundAuthorTile>,
    pub after: Vec<GroundAuthorTile>,
}

fn noise(x: f64, y: f64, seed: u32) -> f64 {
    let ix = x.floor() as i32;
    let iy = y.floor() as i32;
    let hash = |x: i32, y: i32| {
        let mut n = (x as u32).wrapping_mul(374761393) ^ (y as u32).wrapping_mul(668265263) ^ seed;
        n = (n ^ (n >> 13)).wrapping_mul(1274126177);
        ((n ^ (n >> 16)) & 65535) as f64 / 65535.0
    };
    let smooth = |v: f64| v * v * (3.0 - 2.0 * v);
    let u = smooth(x - x.floor());
    let v = smooth(y - y.floor());
    (hash(ix, iy) * (1.0 - u) + hash(ix + 1, iy) * u) * (1.0 - v)
        + (hash(ix, iy + 1) * (1.0 - u) + hash(ix + 1, iy + 1) * u) * v
}
fn mask(tip: GroundTip, dx: f64, dy: f64, x: f64, y: f64, radius: f64, seed: u32) -> f64 {
    let d = dx.hypot(dy) / radius;
    if d >= 1.0 {
        return 0.0;
    }
    match tip {
        GroundTip::Hard => 1.0,
        GroundTip::Soft => (1.0 - d * d).powi(2),
        GroundTip::Cloud => {
            (1.0 - d * d).powi(2)
                * (0.15 + 0.85 * noise(x / radius * 8.0, y / radius * 8.0, seed).powi(2))
        }
    }
}
/// Canonical 60 Hz integration with spatial subdivision, independent of input event density.
pub fn coverage(brush: &GroundBrush) -> Result<BTreeMap<(i32, i32), f64>> {
    ensure(
        !brush.points.is_empty() && brush.points.len() <= 100_000,
        "Zu viele Bodenpinsel-Punkte",
    )?;
    ensure(
        brush.diameter.is_finite()
            && (0.002..=256_000_000.0).contains(&brush.diameter)
            && brush.opacity.is_finite()
            && (0.01..=1.0).contains(&brush.opacity)
            && brush.flow.is_finite()
            && (0.01..=1.0).contains(&brush.flow),
        "Ungültiger Bodenpinsel",
    )?;
    let mut last = 0.0;
    for (i, p) in brush.points.iter().enumerate() {
        ensure(
            valid_point([p[0], p[1]])
                && p[2].is_finite()
                && p[2] >= last
                && p[2] <= 3_600_000.0
                && (i != 0 || p[2] == 0.0),
            "Ungültiger Bodenpinsel-Pfad",
        )?;
        last = p[2];
    }
    let radius = brush.diameter / 2.0;
    let mut out = BTreeMap::new();
    let mut work = 0usize;
    let mut stamp = |p: [f64; 2], dt: f64| -> Result<()> {
        let x0 = (p[0] - radius).floor().max(-100_000_000.0) as i32;
        let x1 = (p[0] + radius).ceil().min(100_000_000.0) as i32;
        let y0 = (p[1] - radius).floor().max(-100_000_000.0) as i32;
        let y1 = (p[1] + radius).ceil().min(100_000_000.0) as i32;
        work = work.saturating_add(((x1 - x0 + 1) as usize).saturating_mul((y1 - y0 + 1) as usize));
        ensure(
            work <= 40_000_000,
            "Bodenpinselstrich zu aufwendig; bitte kürzere Striche verwenden",
        )?;
        for y in y0..=y1 {
            for x in x0..=x1 {
                let amount = mask(
                    brush.tip,
                    x as f64 + 0.5 - p[0],
                    y as f64 + 0.5 - p[1],
                    x as f64,
                    y as f64,
                    radius,
                    brush.seed,
                );
                if amount > 0.0 {
                    *out.entry((x, y)).or_insert(0.0) += amount * dt;
                    ensure(
                        out.len() <= 1_000_000,
                        "Bodenpinselstrich überschreitet eine Million Pixel",
                    )?;
                }
            }
        }
        Ok(())
    };
    let mut index = 0;
    let mut at = |t: f64| {
        while index + 1 < brush.points.len() && brush.points[index + 1][2] <= t {
            index += 1;
        }
        let a = brush.points[index];
        let b = brush.points.get(index + 1).copied().unwrap_or(a);
        let u = if b[2] > a[2] {
            ((t - a[2]) / (b[2] - a[2])).clamp(0.0, 1.0)
        } else {
            0.0
        };
        [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]
    };
    let mut previous = at(0.0);
    let mut stamps: Vec<([f64; 2], f64)> = vec![(previous, 1.0 / 60.0)];
    let mut add_stamp = |point: [f64; 2], dt: f64| -> Result<()> {
        if let Some(last) = stamps.last_mut() {
            if last.0 == point {
                last.1 += dt;
                return Ok(());
            }
        }
        ensure(stamps.len() < 100_000, "Bodenpinselpfad zu aufwendig")?;
        stamps.push((point, dt));
        Ok(())
    };
    let mut times: Vec<f64> = (1..=(last * 60.0 / 1000.0).ceil() as usize)
        .map(|i| (i as f64 * 1000.0 / 60.0).min(last))
        .collect();
    // Retain turns and speed changes between ticks, but not redundant events.
    for w in brush.points.windows(3) {
        let dt1 = w[1][2] - w[0][2];
        let dt2 = w[2][2] - w[1][2];
        if dt1 > 0.0
            && dt2 > 0.0
            && (0..2).any(|c| ((w[1][c] - w[0][c]) / dt1 - (w[2][c] - w[1][c]) / dt2).abs() > 1e-9)
        {
            times.push(w[1][2]);
        }
    }
    times.sort_by(f64::total_cmp);
    times.dedup();
    let mut time = 0.0;
    for next_time in times {
        let next = at(next_time);
        let steps = ((next[0] - previous[0]).hypot(next[1] - previous[1]) / (radius / 4.0).max(0.5))
            .ceil()
            .max(1.0) as usize;
        ensure(steps <= 100_000, "Bodenpinselpfad zu lang")?;
        for i in 0..steps {
            let u = (i as f64 + 0.5) / steps as f64;
            add_stamp(
                [
                    previous[0] + (next[0] - previous[0]) * u,
                    previous[1] + (next[1] - previous[1]) * u,
                ],
                (next_time - time) / 1000.0 / steps as f64,
            )?;
        }
        previous = next;
        time = next_time;
    }
    for (point, dt) in stamps {
        stamp(point, dt)?;
    }
    for value in out.values_mut() {
        *value = brush.opacity * (1.0 - (-12.0 * brush.flow * *value).exp());
    }
    Ok(out)
}
pub fn blend(pixel: &mut [u8], color: [u8; 3], mode: GroundMode, alpha: f64) {
    match mode {
        GroundMode::Paint => {
            for c in 0..3 {
                pixel[c] =
                    (pixel[c] as f64 * (1.0 - alpha) + color[c] as f64 * alpha).round() as u8;
            }
            pixel[3] = (pixel[3] as f64 * (1.0 - alpha) + 255.0 * alpha).round() as u8;
        }
        GroundMode::Erase => {
            for c in pixel.iter_mut() {
                *c = (*c as f64 * (1.0 - alpha)).round() as u8;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn brush() -> GroundBrush {
        GroundBrush {
            resolution: None,
            mode: GroundMode::Paint,
            tip: GroundTip::Soft,
            color: [80, 130, 60],
            diameter: 10.0,
            opacity: 0.5,
            flow: 0.5,
            seed: 17,
            points: vec![[0.0, 0.0, 0.0], [20.0, 0.0, 1000.0]],
        }
    }
    #[test]
    fn coverage_is_event_rate_independent_and_capped() {
        let a = brush();
        let mut b = a.clone();
        b.points = (0..=100)
            .map(|i| [i as f64 / 5.0, 0.0, i as f64 * 10.0])
            .collect();
        let x = coverage(&a).unwrap();
        let y = coverage(&b).unwrap();
        assert_eq!(x.len(), y.len());
        for (p, v) in x {
            assert!((v - y[&p]).abs() < 1e-12);
            assert!(v <= a.opacity);
        }
    }
    #[test]
    fn tips_hold_flow_and_seed_affect_the_coverage() {
        let mut a = brush();
        a.points = vec![[0.0, 0.0, 0.0]];
        let click = coverage(&a).unwrap();
        a.points.push([0.0, 0.0, 500.0]);
        let held = coverage(&a).unwrap();
        assert!(held[&(0, 0)] > click[&(0, 0)]);
        assert!(held[&(0, 0)] > held[&(4, 0)]);
        a.flow = 1.0;
        assert!(coverage(&a).unwrap()[&(0, 0)] > held[&(0, 0)]);
        a.tip = GroundTip::Hard;
        let hard = coverage(&a).unwrap();
        assert_eq!(hard[&(0, 0)], hard[&(4, 0)]);
        a.tip = GroundTip::Cloud;
        let cloud = coverage(&a).unwrap();
        assert_eq!(cloud, coverage(&a).unwrap());
        a.seed += 1;
        assert_ne!(cloud, coverage(&a).unwrap());
    }
    #[test]
    fn paint_and_erase_preserve_premultiplication() {
        let mut pixel = [0; 4];
        blend(&mut pixel, [120, 200, 80], GroundMode::Paint, 0.5);
        assert_eq!(pixel, [60, 100, 40, 128]);
        blend(&mut pixel, [250, 0, 0], GroundMode::Paint, 0.5);
        assert_eq!(pixel, [155, 50, 20, 192]);
        blend(&mut pixel, [0; 3], GroundMode::Erase, 1.0);
        assert_eq!(pixel, [0; 4]);
    }
    #[test]
    fn invalid_and_excessive_strokes_are_rejected() {
        let mut a = brush();
        a.points[1][2] = -1.0;
        assert!(coverage(&a).is_err());
        a.points = vec![[0.0, 0.0, 0.0], [100_000_000.0, 0.0, 1.0]];
        assert!(coverage(&a).is_err());
        a.points = vec![[0.0, 0.0, 0.0]];
        a.diameter = 0.0;
        assert!(coverage(&a).is_err());
        a.diameter = 10.0;
        a.points = vec![[0.0, 0.0, 0.0]; 100_001];
        assert!(coverage(&a).unwrap_err().to_string().contains("Punkte"));
        a.diameter = 1000.0;
        a.points = vec![[0.0, 0.0, 0.0], [1000.0, 0.0, 1.0]];
        assert!(coverage(&a).unwrap_err().to_string().contains("Million"));
    }
}

mod pixel_wire {
    use base64::Engine;
    use serde::{Deserialize, Deserializer, Serializer};
    pub fn serialize<S: Serializer>(
        value: &[u8],
        serializer: S,
    ) -> std::result::Result<S::Ok, S::Error> {
        serializer.serialize_str(&base64::engine::general_purpose::STANDARD.encode(value))
    }
    pub fn deserialize<'de, D: Deserializer<'de>>(
        deserializer: D,
    ) -> std::result::Result<Vec<u8>, D::Error> {
        let text = String::deserialize(deserializer)?;
        base64::engine::general_purpose::STANDARD
            .decode(text)
            .map_err(serde::de::Error::custom)
    }
}
