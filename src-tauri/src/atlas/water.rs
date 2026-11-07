//! Local standing water. Geometry is authored; terrain edits are ordinary height patches.
use super::{
    errors::ensure,
    regions::{self, RegionPolygon},
    terrain, Point, Result,
};
use geo::{BooleanOps, Coord, Intersects, LineString, MultiPolygon, Polygon, Validation};
use serde::{Deserialize, Serialize};

pub const POINT_LIMIT: usize = 200_000;
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct WaterBody {
    pub id: String,
    pub level: f64,
    pub polygons: Vec<RegionPolygon>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct WaterDelta {
    pub before: Vec<WaterBody>,
    pub after: Vec<WaterBody>,
}
pub fn geometry(w: &WaterBody) -> MultiPolygon<f64> {
    regions::polygon_geometry(&w.polygons)
}
pub fn level_at(waters: &[WaterBody], p: Point) -> Option<f64> {
    waters
        .iter()
        .filter(|w| geometry(w).intersects(&geo::Point::from(p)))
        .map(|w| w.level)
        .min_by(f64::total_cmp)
}
/// Operation-local contact geometry. Retain this instead of rebuilding authored rings per point.
pub struct PreparedWater {
    geometry: MultiPolygon<f64>,
    level: f64,
}
impl PreparedWater {
    pub fn new(w: &WaterBody) -> Self {
        Self {
            geometry: geometry(w),
            level: w.level,
        }
    }
    pub fn level_at(&self, p: Point) -> Option<f64> {
        self.geometry
            .intersects(&geo::Point::from(p))
            .then_some(self.level)
    }
}
pub fn point_count(w: &WaterBody) -> usize {
    w.polygons
        .iter()
        .map(|p| p.outer.len() + p.holes.iter().map(Vec::len).sum::<usize>())
        .sum()
}
pub fn check_budget(waters: &[WaterBody]) -> Result<()> {
    ensure(
        waters.iter().map(point_count).sum::<usize>() <= POINT_LIMIT,
        "Gewässer überschreiten 200.000 Konturpunkte",
    )
}
pub fn validate(w: &WaterBody) -> Result<()> {
    ensure(
        terrain::valid_height(w.level) && !w.polygons.is_empty(),
        "Ungültiges Gewässer",
    )?;
    ensure(
        w.polygons
            .iter()
            .map(|p| p.outer.len() + p.holes.iter().map(Vec::len).sum::<usize>())
            .sum::<usize>()
            <= POINT_LIMIT,
        "Gewässer überschreitet 200.000 Konturpunkte",
    )?;
    ensure(
        w.polygons
            .iter()
            .flat_map(|p| std::iter::once(&p.outer).chain(&p.holes))
            .all(|r| r.len() >= 3 && r.iter().all(|p| super::geometry::valid_point(*p))),
        "Ungültige Gewässerkontur",
    )?;
    ensure(geometry(w).is_valid(), "Ungültige Gewässergeometrie")
}
/// Clip one terrain triangle against its horizontal water plane.
pub fn wet_triangle(points: [Point; 3], heights: [f64; 3], level: f64) -> Option<Polygon<f64>> {
    let mut out = vec![];
    for i in 0..3 {
        let j = (i + 1) % 3;
        let a = points[i];
        let b = points[j];
        if heights[i] < level {
            out.push(Coord::from(a));
        }
        if (heights[i] < level) != (heights[j] < level) {
            let t = (level - heights[i]) / (heights[j] - heights[i]);
            out.push(Coord {
                x: a[0] + t * (b[0] - a[0]),
                y: a[1] + t * (b[1] - a[1]),
            });
        }
    }
    if out.len() < 3 {
        return None;
    }
    out.push(out[0]);
    Some(Polygon::new(LineString(out), vec![]))
}
/// Remove newly dry terrain only in the affected raster cells, retaining untouched coastlines.
pub fn trim(
    w: &WaterBody,
    grid: &terrain::Grid,
    cells: &std::collections::BTreeSet<(i32, i32)>,
) -> MultiPolygon<f64> {
    let surface = geometry(w);
    let Some(bounds) = regions::bounds(&surface) else {
        return surface;
    };
    trim_cells(
        surface,
        w.level,
        grid,
        intersecting_cells(cells, bounds).copied(),
    )
}

// Dry triangles cannot affect a water body outside its bounds. Keep touching
// cells as well, so exact boundary and negative-coordinate cases are unchanged.
fn intersecting_cells(
    cells: &std::collections::BTreeSet<(i32, i32)>,
    bounds: super::Bounds,
) -> impl Iterator<Item = &(i32, i32)> {
    let x0 = (bounds[0] / terrain::STEP).ceil() as i32 - 1;
    let x1 = (bounds[2] / terrain::STEP).floor() as i32;
    cells
        .range((x0, i32::MIN)..=(x1, i32::MAX))
        .filter(move |&&(_, y)| {
            y as f64 * terrain::STEP <= bounds[3] && (y as f64 + 1.) * terrain::STEP >= bounds[1]
        })
}

fn trim_cells(
    surface: MultiPolygon<f64>,
    level: f64,
    grid: &terrain::Grid,
    cells: impl IntoIterator<Item = (i32, i32)>,
) -> MultiPolygon<f64> {
    let mut dry = vec![];
    for (x, y) in cells {
        // The author grid is a control lattice, not a triangulated surface.
        // Subdivide its smooth reconstruction for polygon Boolean operations.
        for sy in 0..4 {
            for sx in 0..4 {
                let p = [
                    x as f64 * 5. + sx as f64 * 1.25,
                    y as f64 * 5. + sy as f64 * 1.25,
                ];
                let pts = [
                    p,
                    [p[0] + 1.25, p[1]],
                    [p[0] + 1.25, p[1] + 1.25],
                    [p[0], p[1] + 1.25],
                ];
                let z = pts.map(|p| terrain::height(grid, p));
                for ix in [[0, 1, 2], [0, 2, 3]] {
                    if let Some(poly) =
                        wet_triangle(ix.map(|i| pts[i]), ix.map(|i| -z[i]), -level + 1e-8)
                    {
                        dry.push(poly);
                    }
                }
            }
        }
    }
    if dry.is_empty() {
        return surface;
    }
    surface.difference(&geo::algorithm::bool_ops::unary_union(&dry))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::BTreeSet;

    fn rectangle(x: f64, y: f64, size: f64) -> RegionPolygon {
        RegionPolygon {
            outer: vec![[x, y], [x + size, y], [x + size, y + size], [x, y + size]],
            holes: vec![],
        }
    }

    #[test]
    fn local_trim_matches_unrestricted_reference() {
        for origin in [[0., 0.], [-85., -165.], [79.75, 159.75]] {
            let [ox, oy] = origin;
            let mut polygon = rectangle(ox, oy, 15.);
            polygon.holes.push(rectangle(ox + 5., oy + 5., 3.).outer);
            let water = WaterBody {
                id: "reference".into(),
                level: 0.,
                polygons: vec![polygon, rectangle(ox + 25., oy + 5., 5.)],
            };
            validate(&water).unwrap();
            let x0 = (ox / terrain::STEP).floor() as i32;
            let y0 = (oy / terrain::STEP).floor() as i32;
            let cells: BTreeSet<_> = (-4..=10)
                .flat_map(|x| (-4..=8).map(move |y| (x0 + x, y0 + y)))
                .collect();
            for profile in 0..5 {
                let mut grid = terrain::Grid::new();
                for &(x, y) in &cells {
                    let z = match profile {
                        0 => -10.,
                        1 => 10.,
                        2 => (x - x0) as f64 * 4. - 8.,
                        _ => {
                            ((x - x0) as f64 * 0.7).sin() * 15.
                                + ((y - y0) as f64 * 0.9).cos() * 10.
                        }
                    };
                    grid.insert((x, y), z);
                }
                if profile == 4 {
                    grid.layers.insert(2, grid.points.clone());
                    grid.retain(|&(x, y), _| (x + y).rem_euclid(3) == 0);
                }
                let reference =
                    trim_cells(geometry(&water), water.level, &grid, cells.iter().copied());
                let actual = regions::authored(trim(&water, &grid, &cells));
                let expected = regions::authored(reference);
                assert_eq!(
                    actual.len(),
                    expected.len(),
                    "origin={origin:?}, profile={profile}"
                );
                for (a, e) in actual.iter().zip(&expected) {
                    assert_eq!(a.holes.len(), e.holes.len());
                    for (ar, er) in std::iter::once(&a.outer)
                        .chain(&a.holes)
                        .zip(std::iter::once(&e.outer).chain(&e.holes))
                    {
                        assert_eq!(ar.len(), er.len());
                        for (ap, ep) in ar.iter().zip(er) {
                            // Boolean operations quantize relative to their input
                            // extent. Removing remote triangles changes only this
                            // rounding. With these <=75-foot inputs, 1e-6 feet
                            // covers both Boolean rounds' integer-grid precision;
                            // topology and every contour vertex must still match.
                            assert!(
                                super::super::geometry::distance(*ap, *ep) <= 1e-6,
                                "origin={origin:?}, profile={profile}: {ap:?} != {ep:?}"
                            );
                        }
                    }
                }
            }
        }
    }

    #[test]
    fn trim_selection_keeps_touching_cells_and_excludes_distant_work() {
        let bounds = [-80., -160., -65., -145.];
        let near: BTreeSet<_> = (-17..=-13)
            .flat_map(|x| (-33..=-29).map(move |y| (x, y)))
            .collect();
        let mut cells = near.clone();
        for i in 1..=10000 {
            cells.extend([(i, -32), (-16, i), (-i - 100, -32), (-16, -i - 100)]);
        }
        assert_eq!(
            intersecting_cells(&cells, bounds)
                .copied()
                .collect::<BTreeSet<_>>(),
            near
        );
        assert_eq!(
            intersecting_cells(&cells, [-79.9, -159.9, -65.1, -145.1]).count(),
            9
        );
    }
}
