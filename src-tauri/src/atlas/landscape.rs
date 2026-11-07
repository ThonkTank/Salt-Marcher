//! Semantic landscape coverage. Channels are forest, scrub, meadow and rocks;
//! their sum is at most 255. No channel is alpha or a pigment component.
use super::{ground, scenery::Biome, Status};
use serde::{Deserialize, Serialize};
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LandscapeBrush {
    #[serde(default)]
    #[cfg_attr(test, ts(optional))]
    pub resolution: Option<u8>,
    pub biome: Biome,
    pub mode: ground::GroundMode,
    pub diameter: f64,
    /// Target coverage, not per-stroke additive opacity.
    pub density: f64,
    /// World x/y and elapsed milliseconds, starting at zero.
    pub points: Vec<[f64; 3]>,
}
impl LandscapeBrush {
    pub fn ground_brush(&self) -> ground::GroundBrush {
        ground::GroundBrush {
            resolution: self.resolution,
            layer: None,
            mode: self.mode,
            tip: ground::GroundTip::Soft,
            color: [0; 3],
            diameter: self.diameter,
            opacity: 1.,
            flow: 1.,
            seed: 0,
            points: self.points.clone(),
        }
    }
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LandscapeArgs {
    pub level: u8,
    pub tiles: Vec<[i32; 2]>,
}
impl From<LandscapeArgs> for ground::GroundArgs {
    fn from(a: LandscapeArgs) -> Self {
        Self {
            level: a.level,
            tiles: a.tiles,
        }
    }
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct LandscapeTile {
    pub x: i32,
    pub y: i32,
    #[serde(with = "super::ground::pixel_wire")]
    #[cfg_attr(test, ts(type = "string"))]
    /// Base64 of 66×66 four-channel coverage including one-pixel halo.
    /// Empty means the entire tile and halo have zero coverage.
    pub pixels: Vec<u8>,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct LandscapeResponse {
    pub status: Status,
    pub level: u8,
    pub tiles: Vec<LandscapeTile>,
}
impl From<ground::GroundResponse> for LandscapeResponse {
    fn from(a: ground::GroundResponse) -> Self {
        Self {
            status: a.status,
            level: a.level,
            tiles: a
                .tiles
                .into_iter()
                .map(|t| LandscapeTile {
                    x: t.x,
                    y: t.y,
                    pixels: t.pixels,
                })
                .collect(),
        }
    }
}
// Independent rounding can exceed the coverage budget by a few units.
// Remove excess deterministically from the largest channel; never rescale pigment.
pub fn normalize(p: &mut [u8]) {
    let mut excess = p
        .iter()
        .map(|&x| u16::from(x))
        .sum::<u16>()
        .saturating_sub(255);
    while excess > 0 {
        let i = (0..4).max_by_key(|&i| p[i]).unwrap();
        p[i] -= 1;
        excess -= 1;
    }
}
pub fn blend(p: &mut [u8], brush: &LandscapeBrush, alpha: f64) {
    let channel = match brush.biome {
        Biome::Forest => 0,
        Biome::Scrub => 1,
        Biome::Meadow => 2,
        Biome::Rocks => 3,
    };
    for (i, v) in p.iter_mut().enumerate() {
        let target = if matches!(brush.mode, ground::GroundMode::Paint) && i == channel {
            brush.density * 255.
        } else {
            0.
        };
        *v = (*v as f64 * (1. - alpha) + target * alpha).round() as u8;
    }
    normalize(p);
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn landscape_target_density_and_mixture_budget_are_stable() {
        let mut b = LandscapeBrush {
            resolution: None,
            biome: Biome::Forest,
            mode: ground::GroundMode::Paint,
            diameter: 10.,
            density: 0.4,
            points: vec![[0.; 3]],
        };
        let mut p = [0u8; 4];
        for _ in 0..100 {
            blend(&mut p, &b, 0.5);
        }
        assert_eq!(p, [102, 0, 0, 0]);
        b.biome = Biome::Scrub;
        b.density = 1.;
        blend(&mut p, &b, 0.5);
        assert_eq!(p, [51, 128, 0, 0]);
        b.mode = ground::GroundMode::Erase;
        blend(&mut p, &b, 1.);
        assert_eq!(p, [0; 4]);
        let mut p = [64u8; 4];
        normalize(&mut p);
        assert_eq!(p.iter().map(|&v| u16::from(v)).sum::<u16>(), 255);
    }
}
