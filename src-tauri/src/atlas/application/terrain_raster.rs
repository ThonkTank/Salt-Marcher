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
fn coverage(z: f64, gradient: f64) -> f64 {
    if gradient > 1e-12 {
        (0.5 - z / gradient).clamp(0., 1.)
    } else if z < 0. {
        1.
    } else {
        0.
    }
}
fn compact(bytes: &[u8]) -> String {
    STANDARD.encode(if bytes.iter().all(|&v| v == bytes[0]) {
        &bytes[..1]
    } else {
        bytes
    })
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
            relief: STANDARD.encode([178u8, 185, 151, 255]),
            water: STANDARD.encode([if lo < 0. { 255 } else { 0 }]),
            contours: vec![],
        });
    }
    let n = pixels as usize;
    let width = bounds[2] - bounds[0];
    let step = width / n as f64;
    let mut raster = Raster {
        sampler,
        bounds,
        pixels: n,
        heights: vec![f64::NAN; (n + 1) * (n + 1)],
    };
    raster.fill(0, 0, n)?;
    let stride = n + 3;
    let mut nodes = vec![0.; stride * stride];
    for y in 0..stride {
        for x in 0..stride {
            let p = [
                bounds[0] + (x as f64 - 1.) * step,
                bounds[1] + (y as f64 - 1.) * step,
            ];
            let z = if x > 0 && y > 0 && x <= n + 1 && y <= n + 1 {
                raster.heights[(y - 1) * (n + 1) + x - 1]
            } else {
                raster.sampler.height(p)?
            };
            nodes[y * stride + x] = if influenced { influence(p, z) } else { z };
        }
    }
    #[cfg(test)]
    let mut ocean = vec![0; n * n];
    let mut ocean_coverage = vec![0.; (n + 2) * (n + 2)];
    for y in 0..n + 2 {
        for x in 0..n + 2 {
            let i = y * stride + x;
            let [a, b, c, d] = [
                nodes[i],
                nodes[i + 1],
                nodes[i + stride],
                nodes[i + stride + 1],
            ];
            let gradient = ((b + d - a - c).abs() + (c + d - a - b).abs()) / 2.;
            let z = (a + b + c + d) / 4.;
            let ocean_alpha = coverage(z, gradient);
            #[cfg(test)]
            if x > 0 && y > 0 && x <= n && y <= n {
                ocean[(y - 1) * n + x - 1] = (255. * ocean_alpha).round() as u8;
            }
            ocean_coverage[y * (n + 2) + x] = ocean_alpha;
        }
    }
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
                let z = raster.sampler.height(p)?;
                if influenced {
                    influence(p, z)
                } else {
                    z
                }
            };
        }
    }
    let mut shades = vec![0.; 35 * 35];
    for y in 0..35 {
        for x in 0..35 {
            let i = (y + 1) * 37 + x + 1;
            let dx = (relief_nodes[i + 1] - relief_nodes[i - 1]) / (2. * h);
            let dy = (relief_nodes[i + 37] - relief_nodes[i - 37]) / (2. * h);
            shades[y * 35 + x] = (0.38
                + 0.62 * (1. + 0.45 * dx - 0.55 * dy) / (1. + dx * dx + dy * dy).sqrt())
            .clamp(0.58, 1.15);
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
            let shade = shades[i] * (1. - u) * (1. - v)
                + shades[i + 1] * u * (1. - v)
                + shades[i + 35] * (1. - u) * v
                + shades[i + 36] * u * v;
            let at = (y * (n + 2) + x) * 4;
            for (k, color) in [178., 185., 151.].iter().enumerate() {
                relief[at + k] = (color * shade).round() as u8;
            }
            relief[at + 3] = 255;
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
