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
    let mut dry = vec![];
    for &(x, y) in cells {
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
                        wet_triangle(ix.map(|i| pts[i]), ix.map(|i| -z[i]), -w.level + 1e-8)
                    {
                        dry.push(poly);
                    }
                }
            }
        }
    }
    if dry.is_empty() {
        return geometry(w);
    }
    geometry(w).difference(&geo::algorithm::bool_ops::unary_union(&dry))
}
