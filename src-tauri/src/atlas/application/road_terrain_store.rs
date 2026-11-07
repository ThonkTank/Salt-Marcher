//! Local, bounded natural-height/water reads for the pure road planner.
use super::{terrain_blocks, AtlasApplication};
use crate::atlas::{
    errors::storage_error,
    model::{Node, Road, RoadRoughness, SceneObject},
    parcel_geometry::PreparedRoadGeometry,
    road_terrain::{self, Corridor, Route, TerrainFollow},
    Point, Result,
};
use rusqlite::params;
use std::{
    collections::{BTreeMap, HashSet},
    ops::Range,
};
struct Region {
    rivers: crate::atlas::rivers::RiverSurface,
    water: Vec<Vec<Point>>,
    lakes: Vec<crate::atlas::water::WaterBody>,
}
struct Sampler<'a> {
    app: &'a AtlasApplication,
    heights: terrain_blocks::Sampler<'a>,
    regions: BTreeMap<(i32, i32), Region>,
}
fn inside(p: Point, polygon: &[Point]) -> bool {
    let mut yes = false;
    for i in 0..polygon.len() {
        let a = polygon[i];
        let b = polygon[(i + 1) % polygon.len()];
        if road_terrain::segment_distance(p, a, b) <= 1e-7 {
            return true;
        }
        if (a[1] > p[1]) != (b[1] > p[1])
            && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]
        {
            yes = !yes;
        }
    }
    yes
}
impl Sampler<'_> {
    fn sample(&mut self, p: Point) -> Result<(f64, bool)> {
        let key = ((p[0] / 160.).floor() as i32, (p[1] / 160.).floor() as i32);
        if !self.regions.contains_key(&key) {
            // Requests cover only visited corridor samples (including cross-slope/interpolation margin).
            // The read cache cannot grow with the world bounding box.
            if self.regions.len() >= 512 {
                self.regions.pop_first();
            }
            let b = [
                key.0 as f64 * 160.,
                key.1 as f64 * 160.,
                (key.0 + 1) as f64 * 160.,
                (key.1 + 1) as f64 * 160.,
            ];
            let mut query=self.app.db.prepare_cached("SELECT o.body FROM objects o JOIN spatial s ON o.rowid=s.key WHERE o.kind='area' AND s.min_x<=?1 AND s.max_x>=?2 AND s.min_y<=?3 AND s.max_y>=?4 ORDER BY o.id").map_err(storage_error)?;
            let rows = query
                .query_map(params![b[2], b[0], b[3], b[1]], |r| r.get::<_, String>(0))
                .map_err(storage_error)?;
            let mut water = vec![];
            for row in rows {
                if let SceneObject::Area(a) =
                    serde_json::from_str(&row.map_err(storage_error)?).map_err(storage_error)?
                {
                    if a.material == "water" {
                        water.push(a.points);
                    }
                }
            }
            self.regions.insert(
                key,
                Region {
                    lakes: super::water_store::local(&self.app.db, b)?,
                    water,
                    rivers: crate::atlas::rivers::RiverSurface::new(&super::river_store::local(
                        &self.app.db,
                        b,
                    )?),
                },
            );
        }
        let region = &self.regions[&key];
        let (z, river_wet) = region.rivers.at(p, self.heights.height(p)?);
        Ok((
            z,
            z < 0.0
                || river_wet
                || crate::atlas::water::level_at(&region.lakes, p).is_some_and(|level| z < level)
                || region.water.iter().any(|poly| inside(p, poly)),
        ))
    }
}
/// Flatten only the newly planned part, retaining its original section identities.
fn sampled(road: &Road, range: Range<usize>, sections: &[String], step: f64) -> Option<Route> {
    let mut route = Route {
        points: vec![road.nodes[range.start].point],
        sections: vec![],
    };
    for i in range {
        let a = &road.nodes[i];
        let b = &road.nodes[i + 1];
        let control = [
            a.point,
            a.outgoing.unwrap_or(a.point),
            b.incoming.unwrap_or(b.point),
            b.point,
        ];
        let length: f64 = control
            .windows(2)
            .map(|w| road_terrain::distance(w[0], w[1]))
            .sum();
        let count = (length / step).ceil().max(4.) as usize;
        if route.points.len() + count > 32768 {
            return None;
        }
        let section = sections.iter().position(|s| *s == road.edge_sections[i])?;
        for n in 1..=count {
            let t = n as f64 / count as f64;
            let u = 1. - t;
            route.points.push(if n == count {
                b.point
            } else {
                [0, 1].map(|k| {
                    u * u * u * control[0][k]
                        + 3. * u * u * t * control[1][k]
                        + 3. * u * t * t * control[2][k]
                        + t * t * t * control[3][k]
                })
            });
            route.sections.push(section);
        }
    }
    Some(route)
}
fn accepted(
    road: &Road,
    range: Range<usize>,
    sections: &[String],
    corridor: &Corridor,
    score: f64,
    sample: &mut impl FnMut(Point) -> Result<(f64, bool)>,
) -> Result<bool> {
    let Some(route) = sampled(road, range, sections, corridor.sample_step) else {
        return Ok(false);
    };
    Ok(corridor.valid(&route)
        && corridor.cost(&route, sample)? <= score + 1e-7
        && PreparedRoadGeometry::new(road).is_ok())
}
impl AtlasApplication {
    pub(in crate::atlas) fn follow_road(
        &self,
        road: &mut Road,
        range: Range<usize>,
        settings: &TerrainFollow,
        roughness: Option<&RoadRoughness>,
        mut allocate: impl FnMut() -> Result<String>,
    ) -> Result<()> {
        PreparedRoadGeometry::new(road)?;
        let original = road.clone();
        let corridor = Corridor::new(
            road.nodes[range.start..=range.end]
                .iter()
                .map(|n| n.point)
                .collect(),
            road.width,
            settings,
        )?;
        let sections = road.edge_sections[range.clone()].to_vec();
        let mut sampler = Sampler {
            app: self,
            heights: terrain_blocks::Sampler::new(&self.db)?,
            regions: BTreeMap::new(),
        };
        let mut sample = |p| sampler.sample(p);
        let mut route = road_terrain::plan(&corridor, &mut sample)?;
        if route.points.len() + road.nodes.len() - (range.len() + 1) > 512 {
            route = corridor.direct();
        }
        let mut prefix = "terrain:".to_owned();
        while road.nodes.iter().any(|n| n.id.starts_with(&prefix)) {
            prefix.push(':');
        }
        let mut nodes: Vec<_> = route
            .points
            .iter()
            .enumerate()
            .map(|(i, p)| Node {
                id: format!("{prefix}{i}"),
                point: *p,
                incoming: None,
                outgoing: None,
            })
            .collect();
        nodes[0].id = road.nodes[range.start].id.clone();
        nodes[0].incoming = road.nodes[range.start].incoming;
        let last = nodes.len() - 1;
        nodes[last].id = road.nodes[range.end].id.clone();
        nodes[last].outgoing = road.nodes[range.end].outgoing;
        // Existing-side handles and nodes remain byte-for-byte unchanged. The new-side
        // join direction is fixed, while its length may shrink to fit a narrow corridor.
        let start_tangent = if range.start > 0 {
            original.nodes[range.start].outgoing
        } else {
            None
        };
        let end_tangent = if range.end + 1 < original.nodes.len() {
            original.nodes[range.end].incoming
        } else {
            None
        };
        let apply_join = |nodes: &mut Vec<Node>, factor: f64| {
            for (i, handle, incoming, section) in [
                (0, start_tangent, false, 0),
                (last, end_tangent, true, corridor.radii.len() - 1),
            ] {
                if let Some(h) = handle {
                    let p = nodes[i].point;
                    let norm = road_terrain::distance(p, h);
                    if norm > 1e-9 {
                        let length = (corridor.width / 3.)
                            .min(corridor.radii[section] / 4.)
                            .max(1e-8)
                            * factor;
                        let h = Some([
                            p[0] + (h[0] - p[0]) * length / norm,
                            p[1] + (h[1] - p[1]) * length / norm,
                        ]);
                        if incoming {
                            nodes[i].incoming = h;
                        } else {
                            nodes[i].outgoing = h;
                        }
                    }
                }
            }
        };
        apply_join(&mut nodes, 1.);
        let build = |nodes: Vec<Node>| {
            let mut r = original.clone();
            r.nodes.splice(range.start..=range.end, nodes);
            r.edge_sections.splice(
                range.clone(),
                route.sections.iter().map(|i| sections[*i].clone()),
            );
            r
        };
        let mut chosen = build(nodes.clone());
        let new_range = range.start..range.start + nodes.len() - 1;
        let baseline = corridor.cost(&route, &mut sample)?;
        // Local cubic tangents. Every retry starts from the same polyline.
        for attempt in 0..=12 {
            let factor = 0.5f64.powi(attempt);
            let mut smooth = nodes.clone();
            for (i, node) in smooth.iter_mut().enumerate() {
                let p = node.point;
                let a = route.points[i.saturating_sub(1)];
                let b = route.points[(i + 1).min(last)];
                let norm = road_terrain::distance(a, b);
                if norm <= 1e-9 {
                    continue;
                }
                let length =
                    road_terrain::distance(a, p).min(road_terrain::distance(p, b)) * factor / 3.;
                if i > 0 {
                    node.incoming = Some([
                        p[0] - (b[0] - a[0]) * length / norm,
                        p[1] - (b[1] - a[1]) * length / norm,
                    ]);
                }
                if i < last {
                    node.outgoing = Some([
                        p[0] + (b[0] - a[0]) * length / norm,
                        p[1] + (b[1] - a[1]) * length / norm,
                    ]);
                }
            }
            apply_join(&mut smooth, factor);
            let candidate = build(smooth);
            if accepted(
                &candidate,
                new_range.clone(),
                &sections,
                &corridor,
                baseline,
                &mut sample,
            )? {
                chosen = candidate;
                break;
            }
            // Always retain a valid straight fallback with the same join direction.
            let mut straight = nodes.clone();
            apply_join(&mut straight, factor * 0.5);
            chosen = build(straight);
        }
        let score = sampled(&chosen, new_range.clone(), &sections, corridor.sample_step)
            .map(|r| corridor.cost(&r, &mut sample))
            .transpose()?
            .unwrap_or(baseline);
        if let Some(settings) = roughness {
            for half in 0..=8 {
                let mut candidate = chosen.clone();
                let mut n = 0;
                let mut settings = settings.clone();
                settings.amount *= 0.5f64.powi(half);
                super::super::road_roughness::deform(
                    &mut candidate,
                    &settings,
                    new_range.clone(),
                    || {
                        n += 1;
                        Ok(format!("{prefix}rough:{n}"))
                    },
                )?;
                let count = candidate.nodes.len() - chosen.nodes.len() + new_range.len();
                if accepted(
                    &candidate,
                    new_range.start..new_range.start + count,
                    &sections,
                    &corridor,
                    score,
                    &mut sample,
                )? {
                    chosen = candidate;
                    break;
                }
            }
        }
        let ids: HashSet<_> = original.nodes.iter().map(|n| n.id.as_str()).collect();
        for node in &mut chosen.nodes {
            if !ids.contains(node.id.as_str()) {
                node.id = allocate()?;
            }
        }
        *road = chosen;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::atlas::{
        application::{terrain_store, world_terrain_store},
        terrain,
    };

    #[test]
    fn road_samples_share_canonical_blocks_across_region_boundaries() {
        let app = AtlasApplication::new().unwrap();
        let coarse = (-4..=4)
            .flat_map(|y| (-4..=4).map(move |x| (x, y, Some(200. + x as f64 * 3.))))
            .collect();
        world_terrain_store::apply(
            &app.db,
            &world_terrain_store::WorldTerrainDelta {
                level: 6,
                before: vec![],
                after: coarse,
            },
            true,
        )
        .unwrap();
        let local: Vec<_> = (-32..=32)
            .flat_map(|y| {
                (-32..=32).filter_map(move |x| {
                    ((x + y) % 3 != 0).then_some((x, y, 50. + (x * x + y * y) as f64 / 100.))
                })
            })
            .collect();
        terrain_store::write_points(&app.db, &local).unwrap();
        let reference = terrain_store::grid(&app.db, [-165., -165., 165., 165.]).unwrap();
        let mut sampler = Sampler {
            app: &app,
            heights: terrain_blocks::Sampler::new(&app.db).unwrap(),
            regions: BTreeMap::new(),
        };
        let points = [
            [-0.25, -0.25],
            [0.25, 0.25],
            [-0.25, 0.25],
            [0.25, -0.25],
            [0., 0.],
        ];
        for p in points {
            let (height, wet) = sampler.sample(p).unwrap();
            assert!((height - terrain::height(&reference, p)).abs() < 1e-8);
            assert!(!wet);
        }
        let loaded = sampler.heights.loaded_controls;
        assert!(loaded <= 5 * 16 * 16, "loaded {loaded} controls");
        assert!(loaded < local.len());
        for _ in 0..100 {
            for p in points {
                sampler.sample(p).unwrap();
            }
        }
        assert_eq!(sampler.heights.loaded_controls, loaded);
        assert_eq!(sampler.regions.len(), 4);
    }
}
