//! Bounded display rasters sampled from canonical authors, independent of relief LOD.
use super::terrain_blocks::Sampler;
use crate::atlas::{terrain::SurfaceRaster, Bounds, Result};
use base64::{engine::general_purpose::STANDARD, Engine};

struct Raster<'a, 'db> {
    sampler: &'a mut Sampler<'db>,
    bounds: Bounds,
    pixels: usize,
    heights: Vec<f64>,
}
impl Raster<'_, '_> {
    fn fill(&mut self, x: usize, y: usize, size: usize) -> Result<()> {
        let step = (self.bounds[2] - self.bounds[0]) / self.pixels as f64;
        let region = [
            self.bounds[0] + x as f64 * step,
            self.bounds[1] + y as f64 * step,
            self.bounds[0] + (x + size) as f64 * step,
            self.bounds[1] + (y + size) as f64 * step,
        ];
        let [low, high] = self.sampler.range(region)?;
        if low == high || size <= 16 {
            for dy in y..=y + size {
                for dx in x..=x + size {
                    let i = dy * (self.pixels + 1) + dx;
                    if self.heights[i].is_nan() {
                        self.heights[i] = if low == high {
                            low
                        } else {
                            self.sampler.height([
                                self.bounds[0] + dx as f64 * step,
                                self.bounds[1] + dy as f64 * step,
                            ])?
                        };
                    }
                }
            }
        } else {
            let half = size / 2;
            for dy in [y, y + half] {
                for dx in [x, x + half] {
                    self.fill(dx, dy, half)?;
                }
            }
        }
        Ok(())
    }
}
/// Canonical natural nodes; interval proofs skip constant regions without changing
/// sample positions. Derived river/platform effects are applied by the caller.
pub(super) fn natural_grid(
    sampler: &mut Sampler<'_>,
    bounds: Bounds,
    pixels: usize,
) -> Result<Vec<f64>> {
    debug_assert!(pixels.is_power_of_two());
    let mut raster = Raster {
        sampler,
        bounds,
        pixels,
        heights: vec![f64::NAN; (pixels + 1) * (pixels + 1)],
    };
    raster.fill(0, 0, pixels)?;
    Ok(raster.heights)
}

fn coverage(z: f64, gradient: f64) -> f64 {
    if gradient > 1e-12 {
        (0.5 - z / gradient).clamp(0., 1.)
    } else if z < 0. {
        1.
    } else {
        0.
    }
}
/// The interval also bounds the antialias gradient: for four corners,
/// (|b+d-a-c|+|c+d-a-b|)/2 = max(|d-a|,|b-c|) <= high-low.
/// Same-sign heights alone are insufficient near a steep coast.
fn uniform_ocean(low: f64, high: f64) -> Option<f64> {
    if low == high {
        return Some(if low < 0. { 1. } else { 0. });
    }
    let margin = (high - low) / 2. + 1e-9 * low.abs().max(high.abs()).max(1.);
    if low > margin {
        Some(0.)
    } else if high < -margin {
        Some(1.)
    } else {
        None
    }
}
fn ocean_cell([a, b, c, d]: [f64; 4]) -> f64 {
    coverage(
        (a + b + c + d) / 4.,
        ((b + d - a - c).abs() + (c + d - a - b).abs()) / 2.,
    )
}

/// Request-local water coverage. Only uncertain coastal cells need exact nodes;
/// the independent relief/contour grid always retains its true heights.
struct OceanRaster<'a, 'db> {
    sampler: &'a mut Sampler<'db>,
    bounds: Bounds,
    pixels: usize,
    nodes: Vec<f64>,
    coverage: Vec<f64>,
    #[cfg(test)]
    samples: usize,
}
impl OceanRaster<'_, '_> {
    fn render(&mut self) -> Result<()> {
        let n = self.pixels;
        // Keep the power-of-two interior aligned; including the two halo
        // pixels in its quadtree would create extra, uneven subdivisions.
        self.fill(1, 1, n, n)?;
        self.fill(0, 0, n + 2, 1)?;
        self.fill(0, n + 1, n + 2, 1)?;
        self.fill(0, 1, 1, n)?;
        self.fill(n + 1, 1, 1, n)
    }
    fn point(&self, x: usize, y: usize) -> [f64; 2] {
        let step = (self.bounds[2] - self.bounds[0]) / self.pixels as f64;
        [
            self.bounds[0] + (x as f64 - 1.) * step,
            self.bounds[1] + (y as f64 - 1.) * step,
        ]
    }
    fn node(&mut self, x: usize, y: usize) -> Result<f64> {
        let i = y * (self.pixels + 3) + x;
        if self.nodes[i].is_nan() {
            self.nodes[i] = self.sampler.height(self.point(x, y))?;
            #[cfg(test)]
            {
                self.samples += 1;
            }
        }
        Ok(self.nodes[i])
    }
    fn fill(&mut self, x: usize, y: usize, w: usize, h: usize) -> Result<()> {
        let a = self.point(x, y);
        let b = self.point(x + w, y + h);
        let [low, high] = self.sampler.range([a[0], a[1], b[0], b[1]])?;
        if let Some(alpha) = uniform_ocean(low, high) {
            for row in y..y + h {
                let start = row * (self.pixels + 2) + x;
                self.coverage[start..start + w].fill(alpha);
            }
        } else if w <= 16 && h <= 16 {
            for row in y..y + h {
                for col in x..x + w {
                    let corners = [
                        self.node(col, row)?,
                        self.node(col + 1, row)?,
                        self.node(col, row + 1)?,
                        self.node(col + 1, row + 1)?,
                    ];
                    self.coverage[row * (self.pixels + 2) + col] = ocean_cell(corners);
                }
            }
        } else if w > 16 && h > 16 {
            for (dy, height) in [(y, h / 2), (y + h / 2, h - h / 2)] {
                for (dx, width) in [(x, w / 2), (x + w / 2, w - w / 2)] {
                    self.fill(dx, dy, width, height)?;
                }
            }
        } else if w >= h {
            self.fill(x, y, w / 2, h)?;
            self.fill(x + w / 2, y, w - w / 2, h)?;
        } else {
            self.fill(x, y, w, h / 2)?;
            self.fill(x, y + h / 2, w, h - h / 2)?;
        }
        Ok(())
    }
}
fn compact(bytes: &[u8]) -> String {
    STANDARD.encode(if bytes.iter().all(|&v| v == bytes[0]) {
        &bytes[..1]
    } else {
        bytes
    })
}
/// Physical height and slope determine material, independently of the pigment layers.
fn material(z: f64, slope: f64, shade: f64) -> [u8; 3] {
    let smooth = |x: f64, lo: f64, hi: f64| {
        let t = ((x - lo) / (hi - lo)).clamp(0., 1.);
        t * t * (3. - 2. * t)
    };
    [
        (255. * smooth(slope, 30f64.to_radians().tan(), 45f64.to_radians().tan())).round() as u8,
        (255. * smooth(z * 0.3048, 3500., 5000.)).round() as u8,
        (255. * shade / 1.15).round() as u8,
    ]
}
fn material_color(m: [u8; 3]) -> [u8; 4] {
    let rock = m[0] as f64 / 255.;
    let snow = m[1] as f64 / 255.;
    let shade = m[2] as f64 / 255. * 1.15;
    let soil = [178., 185., 151.];
    let stone = [145., 142., 137.];
    let ice = [245., 247., 250.];
    let mut out = [0, 0, 0, 255];
    for k in 0..3 {
        out[k] = (((soil[k] * (1. - rock) + stone[k] * rock) * (1. - snow) + ice[k] * snow) * shade)
            .round()
            .clamp(0., 255.) as u8;
    }
    out
}

/// Natural surface and all derived influences are evaluated at shared world nodes.
/// The halo supplies filtering across tile boundaries without neighbor dependencies.
pub fn display(
    sampler: &mut Sampler<'_>,
    bounds: Bounds,
    pixels: u16,
    relief_heights: &[f64],
    waters: &[crate::atlas::water::WaterBody],
    mut influence: impl FnMut(crate::atlas::Point, f64) -> f64,
    influenced: bool,
) -> Result<SurfaceRaster> {
    let [lo, hi] = sampler.range(crate::atlas::geometry::expand(
        bounds,
        (bounds[2] - bounds[0]) / 16.,
    ))?;
    if !influenced && waters.is_empty() && lo == hi {
        return Ok(SurfaceRaster {
            contour_interval: 5.,
            pixels,
            #[cfg(test)]
            heights: STANDARD.encode((lo as f32).to_le_bytes()),
            #[cfg(test)]
            ocean: STANDARD.encode([if lo < 0. { 255 } else { 0 }]),
            relief: STANDARD.encode(material_color(material(lo, 0., 1.))),
            materials: STANDARD.encode(material(lo, 0., 1.)),
            water: STANDARD.encode([if lo < 0. { 255 } else { 0 }]),
            contours: vec![],
        });
    }
    let n = pixels as usize;
    let width = bounds[2] - bounds[0];
    let step = width / n as f64;
    let stride = n + 3;
    let (nodes, ocean_coverage) = if !influenced && waters.is_empty() {
        let mut ocean = OceanRaster {
            sampler,
            bounds,
            pixels: n,
            nodes: vec![f64::NAN; stride * stride],
            coverage: vec![0.; (n + 2) * (n + 2)],
            #[cfg(test)]
            samples: 0,
        };
        ocean.render()?;
        (ocean.nodes, ocean.coverage)
    } else {
        let natural = natural_grid(sampler, bounds, n)?;
        let mut nodes = vec![0.; stride * stride];
        for y in 0..stride {
            for x in 0..stride {
                let p = [
                    bounds[0] + (x as f64 - 1.) * step,
                    bounds[1] + (y as f64 - 1.) * step,
                ];
                let z = if x > 0 && y > 0 && x <= n + 1 && y <= n + 1 {
                    natural[(y - 1) * (n + 1) + x - 1]
                } else {
                    sampler.height(p)?
                };
                nodes[y * stride + x] = if influenced { influence(p, z) } else { z };
            }
        }
        let mut ocean = vec![0.; (n + 2) * (n + 2)];
        for y in 0..n + 2 {
            for x in 0..n + 2 {
                let i = y * stride + x;
                ocean[y * (n + 2) + x] = ocean_cell([
                    nodes[i],
                    nodes[i + 1],
                    nodes[i + stride],
                    nodes[i + stride + 1],
                ]);
            }
        }
        (nodes, ocean)
    };
    // Diagnostic heights remain exact even where production only needs a
    // proven constant coverage. They are never used to compute ocean alpha.
    #[cfg(test)]
    let nodes = {
        let mut nodes = nodes;
        for y in 0..stride {
            for x in 0..stride {
                if nodes[y * stride + x].is_nan() {
                    nodes[y * stride + x] = sampler.height([
                        bounds[0] + (x as f64 - 1.) * step,
                        bounds[1] + (y as f64 - 1.) * step,
                    ])?;
                }
            }
        }
        nodes
    };
    #[cfg(test)]
    let ocean: Vec<u8> = (1..=n)
        .flat_map(|y| {
            let coverage = &ocean_coverage;
            (1..=n).map(move |x| (255. * coverage[y * (n + 2) + x]).round() as u8)
        })
        .collect();
    let mut water_coverage = ocean_coverage.clone();
    // Scan authored rings once per subpixel row. Repeated polygon predicates per
    // pixel would make a detailed lake cost pixels times contour complexity.
    if !waters.is_empty() {
        for y in 0..n + 2 {
            for sy in 0..4 {
                let v = (sy as f64 + 0.5) / 4.;
                let wy = bounds[1] + (y as f64 - 1. + v) * step;
                let mut levels = vec![f64::INFINITY; (n + 2) * 4];
                for water in waters {
                    for polygon in &water.polygons {
                        let mut crossings = vec![];
                        for ring in std::iter::once(&polygon.outer).chain(&polygon.holes) {
                            for i in 0..ring.len() {
                                let a = ring[i];
                                let b = ring[(i + 1) % ring.len()];
                                if (a[1] > wy) != (b[1] > wy) {
                                    crossings
                                        .push(a[0] + (wy - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
                                }
                            }
                        }
                        crossings.sort_by(f64::total_cmp);
                        for span in crossings.as_chunks::<2>().0 {
                            let index = |x: f64| {
                                ((4. * (x - bounds[0]) / step + 3.5).ceil() as i64)
                                    .clamp(0, ((n + 2) * 4) as i64)
                                    as usize
                            };
                            for level in &mut levels[index(span[0])..index(span[1])] {
                                *level = level.min(water.level);
                            }
                        }
                    }
                }
                for (sx, level) in levels.into_iter().enumerate() {
                    if !level.is_finite() {
                        continue;
                    }
                    let x = sx / 4;
                    let u = ((sx % 4) as f64 + 0.5) / 4.;
                    let i = y * stride + x;
                    let z = nodes[i] * (1. - u) * (1. - v)
                        + nodes[i + 1] * u * (1. - v)
                        + nodes[i + stride] * (1. - u) * v
                        + nodes[i + stride + 1] * u * v;
                    water_coverage[y * (n + 2) + x] +=
                        ((if z < level { 1. } else { 0. }) - ocean_coverage[y * (n + 2) + x]) / 16.;
                }
            }
        }
    }
    let water: Vec<u8> = water_coverage
        .into_iter()
        .map(|a| (255. * a.clamp(0., 1.)).round() as u8)
        .collect();
    // Shared relief gradients are sampled independently of tile arrival order.
    let h = width / 32.;
    // The caller already evaluated the 33x33 interior for contours. Only the
    // two-node halo is missing; share each height between adjacent gradients.
    let mut relief_nodes = vec![0.; 37 * 37];
    for y in 0..37 {
        for x in 0..37 {
            relief_nodes[y * 37 + x] = if (2..=34).contains(&x) && (2..=34).contains(&y) {
                relief_heights[(y - 2) * 33 + x - 2]
            } else {
                let p = [
                    bounds[0] + (x as f64 - 2.) * h,
                    bounds[1] + (y as f64 - 2.) * h,
                ];
                let z = sampler.height(p)?;
                if influenced {
                    influence(p, z)
                } else {
                    z
                }
            };
        }
    }
    // Material and illumination vary on the existing relief control grid.
    // Transfer this small grid once, rather than another pixel-sized texture.
    let mut materials = vec![0; 35 * 35 * 3];
    for y in 0..35 {
        for x in 0..35 {
            let i = (y + 1) * 37 + x + 1;
            let dx = (relief_nodes[i + 1] - relief_nodes[i - 1]) / (2. * h);
            let dy = (relief_nodes[i + 37] - relief_nodes[i - 37]) / (2. * h);
            let shade = (0.38
                + 0.62 * (1. + 0.45 * dx - 0.55 * dy) / (1. + dx * dx + dy * dy).sqrt())
            .clamp(0.58, 1.15);
            let at = (y * 35 + x) * 3;
            materials[at..at + 3].copy_from_slice(&material(relief_nodes[i], dx.hypot(dy), shade));
        }
    }
    let mut relief = vec![0; (n + 2) * (n + 2) * 4];
    for y in 0..n + 2 {
        for x in 0..n + 2 {
            let gx = (x as f64 - 0.5) * 32. / n as f64 + 1.;
            let gy = (y as f64 - 0.5) * 32. / n as f64 + 1.;
            let ix = gx.floor() as usize;
            let iy = gy.floor() as usize;
            let u = gx - ix as f64;
            let v = gy - iy as f64;
            let i = iy * 35 + ix;
            let mut m = [0; 3];
            for (k, value) in m.iter_mut().enumerate() {
                *value = (materials[i * 3 + k] as f64 * (1. - u) * (1. - v)
                    + materials[(i + 1) * 3 + k] as f64 * u * (1. - v)
                    + materials[(i + 35) * 3 + k] as f64 * (1. - u) * v
                    + materials[(i + 36) * 3 + k] as f64 * u * v)
                    .round() as u8;
            }
            let pixel = y * (n + 2) + x;
            relief[pixel * 4..pixel * 4 + 4].copy_from_slice(&material_color(m));
        }
    }
    #[cfg(test)]
    let heights = {
        let mut heights = Vec::with_capacity((n + 1) * (n + 1) * 4);
        for y in 1..=n + 1 {
            for x in 1..=n + 1 {
                heights.extend_from_slice(&(nodes[y * stride + x] as f32).to_le_bytes());
            }
        }
        heights
    };
    Ok(SurfaceRaster {
        contour_interval: 5. * 2f64.powf((0.4 * width / pixels as f64).log2().ceil().max(0.)),
        pixels,
        #[cfg(test)]
        heights: STANDARD.encode(heights),
        #[cfg(test)]
        ocean: compact(&ocean),
        relief: STANDARD.encode(relief),
        materials: STANDARD.encode(materials),
        water: compact(&water),
        contours: contours(
            bounds,
            relief_heights,
            5. * 2f64.powf((0.4 * width / pixels as f64).log2().ceil().max(0.)),
        ),
    })
}
pub(super) fn contours(b: Bounds, heights: &[f64], interval: f64) -> Vec<[f64; 4]> {
    let step = (b[2] - b[0]) / 32.;
    let mut result = vec![];
    let vertex = |x: usize, y: usize| {
        [
            b[0] + x as f64 * step,
            b[1] + y as f64 * step,
            heights[y * 33 + x],
        ]
    };
    for y in 0..32 {
        for x in 0..32 {
            let a = vertex(x, y);
            let b = vertex(x + 1, y);
            let c = vertex(x, y + 1);
            let d = vertex(x + 1, y + 1);
            for tri in [[a, b, d], [a, d, c]] {
                let lo = tri.iter().map(|p| p[2]).fold(f64::INFINITY, f64::min);
                let hi = tri.iter().map(|p| p[2]).fold(f64::NEG_INFINITY, f64::max);
                let every = interval * ((hi - lo) / interval / 16.).ceil().max(1.);
                let mut level = (lo / every).ceil() * every;
                while level < hi - 1e-9 {
                    if level != 0. {
                        let mut points = vec![];
                        for i in 0..3 {
                            let p = tri[i];
                            let q = tri[(i + 1) % 3];
                            if (p[2] < level) != (q[2] < level) {
                                let t = (level - p[2]) / (q[2] - p[2]);
                                points.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]);
                            }
                        }
                        if points.len() == 2 {
                            result.push([points[0][0], points[0][1], points[1][0], points[1][1]]);
                        }
                    }
                    level += every;
                }
            }
        }
    }
    result
}
#[cfg(test)]
fn render(
    sampler: &mut Sampler<'_>,
    bounds: Bounds,
    pixels: u16,
    offsets: &[f64],
) -> Result<SurfaceRaster> {
    let step = (bounds[2] - bounds[0]) / 32.;
    let mut heights = Vec::with_capacity(1089);
    for y in 0..=32 {
        for x in 0..=32 {
            heights.push(
                sampler.height([bounds[0] + x as f64 * step, bounds[1] + y as f64 * step])?
                    + offsets[0],
            );
        }
    }
    display(
        sampler,
        bounds,
        pixels,
        &heights,
        &[],
        |_, z| z + offsets[0],
        offsets[0] != 0.,
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::atlas::{
        application::{terrain_store, AtlasApplication},
        terrain,
    };
    fn heights(raster: &SurfaceRaster) -> Vec<f32> {
        STANDARD
            .decode(&raster.heights)
            .unwrap()
            .as_chunks::<4>()
            .0
            .iter()
            .map(|b| f32::from_le_bytes(*b))
            .collect()
    }
    #[test]
    fn natural_grid_matches_dense_nodes_and_skips_constant_author_reads() {
        for shape in 0..4 {
            let app = AtlasApplication::new().unwrap();
            if shape > 0 {
                let points: Vec<_> = (-64..64)
                    .flat_map(|y| {
                        (-64..64).filter_map(move |x| {
                            if shape == 3 && (x + y) % 3 == 0 {
                                return None;
                            }
                            Some((
                                x,
                                y,
                                if shape == 1 {
                                    17.3
                                } else {
                                    (x + y) as f64 * 0.7
                                },
                            ))
                        })
                    })
                    .collect();
                terrain_store::write_points(&app.db, &points).unwrap();
            }
            if shape == 3 {
                app.db.execute_batch("WITH RECURSIVE v(n) AS (SELECT -16 UNION ALL SELECT n+1 FROM v WHERE n<16) INSERT INTO terrain_layers SELECT 3,a.n,b.n,12 FROM v a CROSS JOIN v b;").unwrap();
            }
            for bounds in [
                [-160., -160., 0., 0.],
                [0., 0., 160., 160.],
                [-83., -47., 77., 113.],
            ] {
                let mut adaptive = Sampler::new(&app.db).unwrap();
                let actual = natural_grid(&mut adaptive, bounds, 32).unwrap();
                if shape <= 1 {
                    assert_eq!(
                        adaptive.loaded_controls, 0,
                        "constant grid needs no author payloads"
                    );
                }
                let mut dense = Sampler::new(&app.db).unwrap();
                for (i, z) in actual.iter().enumerate() {
                    let p = [
                        bounds[0] + (i % 33) as f64 * 5.,
                        bounds[1] + (i / 33) as f64 * 5.,
                    ];
                    assert_eq!(*z, dense.height(p).unwrap(), "shape {shape}, point {p:?}");
                }
            }
        }
    }

    #[test]
    fn material_thresholds_use_physical_height_and_slope() {
        assert_eq!(&material(0., 0., 1.)[..2], &[0, 0]);
        assert_eq!(&material(5000. / 0.3048, 0., 1.)[..2], &[0, 255]);
        assert_eq!(&material(100., 1., 1.)[..2], &[255, 0]);
        let transition = material(4250. / 0.3048, 0.8, 1.);
        assert!((1..255).contains(&transition[0]));
        assert_eq!(transition[1], 128);
        let snow = material_color(material(6000. / 0.3048, 0., 1.));
        assert!(snow[..3].iter().all(|&v| v >= 245));
        let stone = material_color(material(100., 1., 1.));
        assert_eq!(stone, [145, 142, 137, 255]);
    }

    #[test]
    fn material_halos_match_at_adjacent_tile_edges() {
        let app = AtlasApplication::new().unwrap();
        let points: Vec<_> = (-5..=37)
            .flat_map(|y| (-5..=69).map(move |x| (x, y, 13000. + x as f64 * 6.)))
            .collect();
        terrain_store::write_points(&app.db, &points).unwrap();
        let mut sampler = Sampler::new(&app.db).unwrap();
        let mut render = |left: f64| {
            let heights: Vec<_> = (0..=32)
                .flat_map(|_| (0..=32).map(move |x| 13000. + (left + x as f64 * 5.) * 1.2))
                .collect();
            display(
                &mut sampler,
                [left, 0., left + 160., 160.],
                32,
                &heights,
                &[],
                |_, z| z,
                false,
            )
            .unwrap()
        };
        let a = STANDARD.decode(render(0.).materials).unwrap();
        let b = STANDARD.decode(render(160.).materials).unwrap();
        for y in 0..35 {
            assert_eq!(
                &a[(y * 35 + 33) * 3..(y * 35 + 34) * 3],
                &b[(y * 35 + 1) * 3..(y * 35 + 2) * 3]
            );
        }
    }

    #[test]
    fn uniform_coverage_proof_preserves_steep_antialiasing_and_zero() {
        assert_eq!(uniform_ocean(0., 0.), Some(0.));
        assert_eq!(uniform_ocean(1., 10.), None);
        assert!(ocean_cell([1., 1., 1., 10.]) > 0.);
        let values: [f64; 9] = [-100., -10., -1., -1e-14, 0., 1e-14, 1., 10., 100.];
        for a in values {
            for b in values {
                for c in values {
                    for d in values {
                        let low = a.min(b).min(c).min(d);
                        let high = a.max(b).max(c).max(d);
                        if let Some(alpha) = uniform_ocean(low, high) {
                            assert_eq!(alpha, ocean_cell([a, b, c, d]), "{a} {b} {c} {d}");
                        }
                    }
                }
            }
        }
    }

    #[test]
    fn adaptive_ocean_matches_dense_reference_and_skips_noncoastal_samples() {
        for shape in 0..4 {
            let app = AtlasApplication::new().unwrap();
            let points: Vec<_> = (-64..64)
                .flat_map(|y| {
                    (-64..64).filter_map(move |x| {
                        if shape == 3 && (x + y) % 5 == 0 {
                            return None;
                        }
                        let z = match shape {
                            0 => 200. + x as f64 * 0.1 + y as f64 * 0.2,
                            1 => -200. + x as f64 * 0.1 + y as f64 * 0.2,
                            2 => x as f64 * 2. + y as f64 * 0.25,
                            _ => {
                                if x * x + y * y < 200 {
                                    10.
                                } else {
                                    -100.
                                }
                            }
                        };
                        Some((x, y, z))
                    })
                })
                .collect();
            terrain_store::write_points(&app.db, &points).unwrap();
            let mut sampler = Sampler::new(&app.db).unwrap();
            let n = 128;
            let bounds = [-160., -160., 160., 160.];
            let mut ocean = OceanRaster {
                sampler: &mut sampler,
                bounds,
                pixels: n,
                nodes: vec![f64::NAN; (n + 3) * (n + 3)],
                coverage: vec![0.; (n + 2) * (n + 2)],
                samples: 0,
            };
            ocean.render().unwrap();
            let samples = ocean.samples;
            let actual = ocean.coverage;
            let mut nodes = vec![0.; (n + 3) * (n + 3)];
            for y in 0..n + 3 {
                for x in 0..n + 3 {
                    nodes[y * (n + 3) + x] = sampler
                        .height([
                            bounds[0] + (x as f64 - 1.) * 320. / n as f64,
                            bounds[1] + (y as f64 - 1.) * 320. / n as f64,
                        ])
                        .unwrap();
                }
            }
            for y in 0..n + 2 {
                for x in 0..n + 2 {
                    let i = y * (n + 3) + x;
                    let expected =
                        ocean_cell([nodes[i], nodes[i + 1], nodes[i + n + 3], nodes[i + n + 4]]);
                    assert_eq!(
                        (actual[y * (n + 2) + x] * 255.).round(),
                        (expected * 255.).round(),
                        "shape {shape}, cell {x},{y}"
                    );
                }
            }
            let mut relief = Vec::new();
            for y in 0..=32 {
                for x in 0..=32 {
                    relief.push(
                        sampler
                            .height([bounds[0] + x as f64 * 10., bounds[1] + y as f64 * 10.])
                            .unwrap(),
                    );
                }
            }
            let adaptive = display(
                &mut sampler,
                bounds,
                n as u16,
                &relief,
                &[],
                |_, z| z,
                false,
            )
            .unwrap();
            // Identity influence deliberately selects the existing dense path.
            let dense =
                display(&mut sampler, bounds, n as u16, &relief, &[], |_, z| z, true).unwrap();
            assert_eq!(adaptive.water, dense.water, "water shape {shape}");
            assert_eq!(adaptive.relief, dense.relief, "relief shape {shape}");
            assert_eq!(adaptive.contours, dense.contours, "contours shape {shape}");
            assert_eq!(adaptive.heights, dense.heights, "heights shape {shape}");
            if shape < 2 {
                assert_eq!(samples, 0, "noncoastal shape {shape}");
            }
            if shape == 2 {
                assert!(samples < (n + 3) * (n + 3), "coast uses {samples} samples");
            }
        }
    }

    #[test]
    fn relief_reuses_interior_samples_and_only_evaluates_the_missing_halo() {
        let app = AtlasApplication::new().unwrap();
        let points: Vec<_> = (-5..=37)
            .flat_map(|y| (-5..=37).map(move |x| (x, y, x as f64 * 0.25 + y as f64 * 0.1)))
            .collect();
        terrain_store::write_points(&app.db, &points).unwrap();
        let mut sampler = Sampler::new(&app.db).unwrap();
        let mut interior = Vec::new();
        for y in 0..=32 {
            for x in 0..=32 {
                let p = [x as f64 * 5., y as f64 * 5.];
                interior.push(sampler.height(p).unwrap() + p[0] * 0.1);
            }
        }
        let mut evaluations = 0;
        let raster = display(
            &mut sampler,
            [0., 0., 160., 160.],
            32,
            &interior,
            &[],
            |p, z| {
                evaluations += 1;
                z + p[0] * 0.1
            },
            true,
        )
        .unwrap();
        // 35x35 water nodes plus the 37x37 relief grid's missing 280 nodes.
        assert_eq!(evaluations, 35 * 35 + 37 * 37 - 33 * 33);
        let dx: f64 = 0.15;
        let dy: f64 = 0.02;
        let shade = (0.38 + 0.62 * (1. + 0.45 * dx - 0.55 * dy) / (1. + dx * dx + dy * dy).sqrt())
            .clamp(0.58, 1.15);
        let expected = [178., 185., 151.].map(|c| (c * shade).round() as u8);
        for rgba in STANDARD.decode(raster.relief).unwrap().as_chunks::<4>().0 {
            assert_eq!(&rgba[..3], &expected);
            assert_eq!(rgba[3], 255);
        }
    }
    #[test]
    fn scanline_lakes_preserve_holes_and_override_ocean_including_the_halo() {
        use crate::atlas::{
            regions::RegionPolygon,
            water::{self, WaterBody},
        };
        let app = AtlasApplication::new().unwrap();
        let square = |a, b| vec![[a, a], [b, a], [b, b], [a, b]];
        let waters = vec![
            WaterBody {
                id: "dry".into(),
                level: -110.,
                polygons: vec![RegionPolygon {
                    outer: square(-5., 90.),
                    holes: vec![square(30., 55.)],
                }],
            },
            WaterBody {
                id: "wet".into(),
                level: -90.,
                polygons: vec![RegionPolygon {
                    outer: square(70., 125.),
                    holes: vec![],
                }],
            },
        ];
        let mut sampler = Sampler::new(&app.db).unwrap();
        let raster = display(
            &mut sampler,
            [0., 0., 160., 160.],
            32,
            &vec![-100.; 1089],
            &waters,
            |_, z| z,
            false,
        )
        .unwrap();
        let bytes = STANDARD.decode(&raster.water).unwrap();
        for y in 0..34 {
            for x in 0..34 {
                let mut wet: f64 = 0.;
                for sy in 0..4 {
                    for sx in 0..4 {
                        let p = [
                            (x as f64 - 1. + (sx as f64 + 0.5) / 4.) * 5.,
                            (y as f64 - 1. + (sy as f64 + 0.5) / 4.) * 5.,
                        ];
                        if -100. < water::level_at(&waters, p).unwrap_or(0.) {
                            wet += 255. / 16.;
                        }
                    }
                }
                assert_eq!(bytes[y * 34 + x], wet.round() as u8, "pixel {x},{y}");
            }
        }
    }
    #[test]
    fn positive_spline_basis_is_smooth_across_negative_author_cells() {
        for i in 0..=100 {
            let w = terrain::spline_weights(i as f64 / 100.);
            assert!(w.iter().all(|v| *v >= 0. && *v <= 1.));
            assert!((w.iter().sum::<f64>() - 1.).abs() < 1e-14);
        }
        let mut grid = terrain::Grid::new();
        for y in -12i32..=12 {
            for x in -12i32..=12 {
                grid.insert((x, y), (8. - (x as f64).hypot(y as f64)) * 10.);
            }
        }
        for x in [-40., -35., 0., 35., 40.] {
            let h = 0.0001;
            let z = terrain::height(&grid, [x, 7.3]);
            let left = terrain::height(&grid, [x - h, 7.3]);
            let right = terrain::height(&grid, [x + h, 7.3]);
            assert!(((z - left) / h - (right - z) / h).abs() < 0.01);
        }
    }
    #[test]
    fn canonical_coast_matrix_including_islands_straits_bays_and_sparse_inheritance() {
        for level in 0..=21u8 {
            let width = 160. * 2f64.powi(level as i32);
            let source = level.saturating_sub(1);
            let step = 5. * 2f64.powi(source as i32);
            for shape in 0..3 {
                let app = AtlasApplication::new().unwrap();
                let mut grid = terrain::Grid::new();
                let mut points = vec![];
                for y in -2..=(width / step) as i32 + 2 {
                    for x in -2..=(width / step) as i32 + 2 {
                        let u = x as f64 * step / width;
                        let v = y as f64 * step / width;
                        let d = match shape {
                            0 => (0.31 - (u - 0.5).hypot(v - 0.5))
                                .min((u - 0.48).hypot(v - 0.48) - 0.08),
                            1 => (0.34 - (u - 0.5).hypot(v - 0.5)).min((v - u).abs() - 0.025),
                            _ => (0.35 - (u - 0.5).hypot(v - 0.5))
                                .min((u - 0.77).hypot(v - 0.5) - 0.23),
                        };
                        let z = (d * 1000.).clamp(-10., 10.);
                        points.push((x, y, z));
                        if source == 0 {
                            grid.insert((x, y), z);
                        } else {
                            grid.layers.entry(source).or_default().insert((x, y), z);
                        }
                    }
                }
                let tx = app.db.unchecked_transaction().unwrap();
                for &(x, y, z) in &points {
                    if source == 0 {
                        tx.execute(
                            "INSERT INTO terrain VALUES(?,?,?)",
                            rusqlite::params![x, y, z],
                        )
                        .unwrap();
                    } else {
                        tx.execute(
                            "INSERT INTO terrain_layers VALUES(?,?,?,?)",
                            rusqlite::params![source, x, y, z],
                        )
                        .unwrap();
                    }
                }
                if shape == 2 && source > 0 {
                    for y in 20..28 {
                        for x in 20..28 {
                            if source == 1 {
                                grid.insert((x, y), 10.);
                                tx.execute("INSERT INTO terrain VALUES(?,?,10)", [x, y])
                                    .unwrap();
                            } else {
                                grid.layers
                                    .entry(source - 1)
                                    .or_default()
                                    .insert((x, y), 10.);
                                tx.execute(
                                    "INSERT INTO terrain_layers VALUES(?,?,?,10)",
                                    rusqlite::params![source - 1, x, y],
                                )
                                .unwrap();
                            }
                        }
                    }
                }
                tx.commit().unwrap();
                let mut sampler = Sampler::new(&app.db).unwrap();
                let n = 128usize;
                let raster = render(
                    &mut sampler,
                    [0., 0., width, width],
                    n as u16,
                    &vec![0.; 1089],
                )
                .unwrap();
                let bytes = STANDARD.decode(raster.ocean).unwrap();
                let mut crossings = 0;
                for vertical in [false, true] {
                    for row in (8..n - 8).step_by(17) {
                        let point = |p: f64| {
                            if vertical {
                                [(row as f64 + 0.5) * width / n as f64, p * width / n as f64]
                            } else {
                                [p * width / n as f64, (row as f64 + 0.5) * width / n as f64]
                            }
                        };
                        let height = |p| terrain::height(&grid, point(p));
                        let alpha = |p: usize| {
                            bytes[if vertical { p * n + row } else { row * n + p }] as f64 - 127.5
                        };
                        let mut prior = height(0.5);
                        for column in 1..n {
                            let next = height(column as f64 + 0.5);
                            if (prior < 0.) != (next < 0.) {
                                let mut lo = column as f64 - 0.5;
                                let mut hi = column as f64 + 0.5;
                                for _ in 0..20 {
                                    let mid = (lo + hi) / 2.;
                                    if (height(mid) < 0.) == (prior < 0.) {
                                        lo = mid;
                                    } else {
                                        hi = mid;
                                    }
                                }
                                let root = (lo + hi) / 2.;
                                let mut nearest = f64::INFINITY;
                                for p in column.saturating_sub(2)..(column + 2).min(n - 1) {
                                    let a = alpha(p);
                                    let b = alpha(p + 1);
                                    if (a < 0.) != (b < 0.) {
                                        nearest = nearest
                                            .min((p as f64 + 0.5 + a / (a - b) - root).abs());
                                    }
                                }
                                assert!(
                                    nearest <= 0.5,
                                    "level {level}, shape {shape}, error {nearest}"
                                );
                                crossings += 1;
                            }
                            prior = next;
                        }
                    }
                }
                assert!(crossings > 10);
            }
        }
    }
    #[test]
    fn raster_samples_match_canonical_surface_and_share_tile_edges() {
        let app = AtlasApplication::new().unwrap();
        let points: Vec<_> = (-12..=12)
            .flat_map(|y| (-12..=12).map(move |x| (x, y, 10. - ((x * x + y * y) as f64))))
            .collect();
        terrain_store::write_points(&app.db, &points).unwrap();
        let grid = terrain_store::grid(&app.db, [-200., -200., 200., 200.]).unwrap();
        let mut sampler = Sampler::new(&app.db).unwrap();
        let a = render(&mut sampler, [-160., -160., 0., 0.], 64, &vec![0.; 1089]).unwrap();
        let b = render(&mut sampler, [0., -160., 160., 0.], 64, &vec![0.; 1089]).unwrap();
        let values = heights(&a);
        let adjacent = heights(&b);
        for y in 0..=64 {
            for x in 0..=64 {
                let expected =
                    terrain::height(&grid, [-160. + x as f64 * 2.5, -160. + y as f64 * 2.5]) as f32;
                assert_eq!(values[y * 65 + x], expected);
            }
            assert_eq!(values[y * 65 + 64], adjacent[y * 65]);
        }
        let mask = STANDARD.decode(&a.ocean).unwrap();
        assert!(mask.contains(&0));
        assert!(mask.contains(&255));
    }
    #[test]
    fn overview_coast_is_within_half_a_raster_pixel_of_the_canonical_surface() {
        let app = AtlasApplication::new().unwrap();
        let points: Vec<_> = (-12..=12)
            .flat_map(|y| (-12..=12).map(move |x| (x, y, 10. - ((x * x + y * y) as f64))))
            .collect();
        terrain_store::write_points(&app.db, &points).unwrap();
        let grid = terrain_store::grid(&app.db, [-200., -200., 200., 200.]).unwrap();
        let mut sampler = Sampler::new(&app.db).unwrap();
        for n in [128u16, 512] {
            let raster =
                render(&mut sampler, [-160., -160., 160., 160.], n, &vec![0.; 1089]).unwrap();
            let mask = STANDARD.decode(&raster.ocean).unwrap();
            let step = 320. / f64::from(n);
            let mut crossings = 0;
            for row in [n / 2 - 4, n / 2, n / 2 + 4] {
                let y = -160. + (f64::from(row) + 0.5) * step;
                for x in 0..n - 1 {
                    let a = mask[usize::from(row) * usize::from(n) + usize::from(x)] as f64;
                    let b = mask[usize::from(row) * usize::from(n) + usize::from(x + 1)] as f64;
                    if (a < 127.5) == (b < 127.5) {
                        continue;
                    }
                    let shown = -160. + (f64::from(x) + 0.5 + (127.5 - a) / (b - a)) * step;
                    let mut low = shown - step;
                    let mut high = shown + step;
                    let sign = terrain::height(&grid, [low, y]) < 0.;
                    assert_ne!(sign, terrain::height(&grid, [high, y]) < 0.);
                    for _ in 0..40 {
                        let mid = (low + high) / 2.;
                        if (terrain::height(&grid, [mid, y]) < 0.) == sign {
                            low = mid
                        } else {
                            high = mid
                        }
                    }
                    assert!((shown - (low + high) / 2.).abs() <= 0.5 * step);
                    crossings += 1;
                }
            }
            assert_eq!(crossings, 6);
        }
    }
}
