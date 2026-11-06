//! Deterministic draft-only deformation. Persist only the resulting cubic nodes.
use super::errors::ensure;
use super::model::{Node, Point, Road, RoadRoughness};
use super::parcel_geometry::split_bezier;
use super::Result;

pub fn deform(
    road: &mut Road,
    settings: &RoadRoughness,
    edges: std::ops::Range<usize>,
    mut allocate: impl FnMut() -> Result<String>,
) -> Result<()> {
    ensure(
        settings.amount.is_finite() && (0.0..=1.0).contains(&settings.amount),
        "Rauheit muss zwischen 0 und 1 liegen",
    )?;
    ensure(
        road.width.is_finite() && (2.0..=100.0).contains(&road.width),
        "Ungültige Straßenbreite",
    )?;
    ensure(
        settings
            .view_scale
            .is_none_or(|scale| scale.is_finite() && (0.000002..=25.6).contains(&scale)),
        "Ungültiger Entwurfszoom für Straßenrauheit",
    )?;
    if settings.amount == 0.0 {
        return Ok(());
    }
    // Validate the untouched geometry first: retries must never hide invalid input.
    super::parcel_geometry::PreparedRoadGeometry::new(road)?;
    let desired: Vec<usize> = road
        .nodes
        .windows(2)
        .enumerate()
        .map(|(i, pair)| {
            if !edges.contains(&i) {
                return 0;
            }
            let curve = [
                pair[0].point,
                pair[0].outgoing.unwrap_or(pair[0].point),
                pair[1].incoming.unwrap_or(pair[1].point),
                pair[1].point,
            ];
            let length: f64 = curve
                .windows(2)
                .map(|p| (p[1][0] - p[0][0]).hypot(p[1][1] - p[0][1]))
                .sum();
            ((length / wavelength(road, settings) * 4.0).ceil().max(1.0) as usize) - 1
        })
        .collect();
    let mut budget = (512 - road.nodes.len()) / 2;
    loop {
        let counts = subdivision_counts(&desired, budget);
        if counts.iter().all(|&count| count == 1) {
            return Ok(());
        }
        let mut candidate = build(road, settings, &counts)?;
        match super::parcel_geometry::PreparedRoadGeometry::new(&candidate) {
            Ok(_) => {
                let old_ids: std::collections::HashSet<_> =
                    road.nodes.iter().map(|n| n.id.as_str()).collect();
                for node in &mut candidate.nodes {
                    if !old_ids.contains(node.id.as_str()) {
                        node.id = allocate()?;
                    }
                }
                *road = candidate;
                return Ok(());
            }
            Err(error)
                if error
                    .issue
                    .as_ref()
                    .is_some_and(|issue| issue.code == super::errors::IssueCode::Limit) =>
            {
                budget /= 2;
            }
            Err(error) => return Err(error),
        }
    }
}

// Screen-space dimensions use CSS pixels, independent of device pixel ratio.
fn wavelength(road: &Road, settings: &RoadRoughness) -> f64 {
    settings
        .view_scale
        .map_or((8.0 * road.width).max(40.0), |scale| 128.0 / scale)
}
fn amplitude(road: &Road, settings: &RoadRoughness) -> f64 {
    settings
        .view_scale
        .map_or(0.5 * road.width, |scale| 24.0 / scale)
}

fn subdivision_counts(desired: &[usize], budget: usize) -> Vec<usize> {
    let total: usize = desired.iter().sum();
    if total <= budget {
        return desired.iter().map(|n| n + 1).collect();
    }
    let mut extra: Vec<_> = desired.iter().map(|n| n * budget / total).collect();
    let mut remaining = budget - extra.iter().sum::<usize>();
    for (n, wanted) in extra.iter_mut().zip(desired) {
        if remaining > 0 && *n < *wanted {
            *n += 1;
            remaining -= 1;
        }
    }
    extra.into_iter().map(|n| n + 1).collect()
}

fn build(road: &Road, settings: &RoadRoughness, counts: &[usize]) -> Result<Road> {
    // Temporary IDs are local to this attempt and cannot collide with author IDs.
    let existing: std::collections::HashSet<_> = road.nodes.iter().map(|n| n.id.as_str()).collect();
    let mut prefix = "roughness:".to_owned();
    while existing.iter().any(|id| id.starts_with(&prefix)) {
        prefix.push(':');
    }
    let mut nodes = Vec::new();
    let mut sections = Vec::new();
    for (i, &count) in counts.iter().enumerate() {
        let a = &road.nodes[i];
        let b = &road.nodes[i + 1];
        if count == 1 {
            if nodes.is_empty() {
                nodes.push(a.clone());
            }
            nodes.last_mut().unwrap().outgoing = a.outgoing;
            nodes.push(b.clone());
            sections.push(road.edge_sections[i].clone());
            continue;
        }
        let curve = [
            a.point,
            a.outgoing.unwrap_or(a.point),
            b.incoming.unwrap_or(b.point),
            b.point,
        ];
        ensure(
            curve
                .iter()
                .flatten()
                .all(|v| v.is_finite() && v.abs() <= 100_000_000.0),
            "Ungültige Straßenkoordinate",
        )?;
        let length: f64 = curve
            .windows(2)
            .map(|p| (p[1][0] - p[0][0]).hypot(p[1][1] - p[0][1]))
            .sum();
        let waves = (length / wavelength(road, settings)).min(count as f64 / 4.0);
        if nodes.is_empty() {
            nodes.push(a.clone());
        }
        for j in 0..count {
            let lo = j as f64 / count as f64;
            let hi = (j + 1) as f64 / count as f64;
            let mut part = curve;
            if hi < 1.0 {
                part = split_bezier(part, hi)?[0];
            }
            if lo > 0.0 {
                part = split_bezier(part, lo / hi)?[1];
            }
            {
                let offset = |t: f64| -> Point {
                    if t <= 0.0 || t >= 1.0 {
                        return [0.0, 0.0];
                    }
                    let d: Point = std::array::from_fn(|k| {
                        3.0 * ((1.0 - t).powi(2) * (curve[1][k] - curve[0][k])
                            + 2.0 * (1.0 - t) * t * (curve[2][k] - curve[1][k])
                            + t * t * (curve[3][k] - curve[2][k]))
                    });
                    let norm = d[0].hypot(d[1]);
                    if norm < 1e-9 {
                        return [0.0, 0.0];
                    }
                    let x = t * waves;
                    let cell = x.floor() as u32;
                    let u = x.fract();
                    let random = |n: u32| {
                        let mut v = settings.seed
                            ^ (i as u32).wrapping_mul(0x9e3779b9)
                            ^ n.wrapping_mul(0x85ebca6b);
                        v ^= v >> 16;
                        v = v.wrapping_mul(0x7feb352d);
                        v ^= v >> 15;
                        (v as f64 / u32::MAX as f64) * 2.0 - 1.0
                    };
                    let noise = random(cell)
                        + (random(cell.wrapping_add(1)) - random(cell)) * u * u * (3.0 - 2.0 * u);
                    let amplitude = amplitude(road, settings)
                        * settings.amount
                        * (std::f64::consts::PI * t).sin().powi(2)
                        * noise;
                    [-d[1] / norm * amplitude, d[0] / norm * amplitude]
                };
                let derivative = |t: f64| -> Point {
                    if t == 0.0 || t == 1.0 {
                        return [0.0, 0.0];
                    }
                    let h = 1e-5_f64.min(t / 2.0).min((1.0 - t) / 2.0);
                    let l = offset(t - h);
                    let r = offset(t + h);
                    [(r[0] - l[0]) / (2.0 * h), (r[1] - l[1]) / (2.0 * h)]
                };
                let l = offset(lo);
                let r = offset(hi);
                let dl = derivative(lo);
                let dr = derivative(hi);
                for k in 0..2 {
                    part[0][k] += l[k];
                    part[1][k] += l[k] + dl[k] * (hi - lo) / 3.0;
                    part[2][k] += r[k] - dr[k] * (hi - lo) / 3.0;
                    part[3][k] += r[k];
                }
            }
            nodes.last_mut().unwrap().outgoing = Some(part[1]);
            let mut next = if j + 1 == count {
                b.clone()
            } else {
                Node {
                    id: format!("{prefix}{i}:{j}"),
                    point: part[3],
                    incoming: None,
                    outgoing: None,
                }
            };
            next.incoming = Some(part[2]);
            nodes.push(next);
            sections.push(road.edge_sections[i].clone());
        }
    }
    let mut result = road.clone();
    result.nodes = nodes;
    result.edge_sections = sections;
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::super::model::{RoadMaterial, RoadSection};
    use super::*;
    fn fixture(scale: f64) -> Road {
        Road {
            id: "road".into(),
            name: "Road".into(),
            width: 100.0,
            material: RoadMaterial::Earth,
            path: vec![],
            population_recipe: None,
            nodes: vec![
                Node {
                    id: "a".into(),
                    point: [0.0, 0.0],
                    incoming: None,
                    outgoing: Some([0.0, scale]),
                },
                Node {
                    id: "b".into(),
                    point: [scale, 0.0],
                    incoming: Some([scale, scale]),
                    outgoing: Some([scale, -scale]),
                },
                Node {
                    id: "c".into(),
                    point: [0.0, 0.0],
                    incoming: Some([0.0, -scale]),
                    outgoing: None,
                },
            ],
            edge_sections: vec!["section".into(); 2],
            sections: vec![RoadSection {
                id: "section".into(),
                populated_sides: vec![],
            }],
        }
    }
    #[test]
    fn screen_space_roughness_is_independent_of_zoom_and_road_width() {
        let mut reference: Option<Road> = None;
        for scale in [1.0, 0.01, 0.000064, 25.6] {
            for width in [2.0, 15.0, 100.0] {
                let mut road = fixture(1.0);
                road.width = width;
                road.nodes.truncate(2);
                road.nodes[0].outgoing = Some([256.0 / scale / 3.0, 0.0]);
                road.nodes[1].point = [256.0 / scale, 0.0];
                road.nodes[1].incoming = Some([256.0 / scale * 2.0 / 3.0, 0.0]);
                road.nodes[1].outgoing = None;
                road.edge_sections.truncate(1);
                let settings = RoadRoughness {
                    amount: 0.33,
                    seed: 17,
                    view_scale: Some(scale),
                };
                let mut allocated = 0;
                deform(&mut road, &settings, 0..1, || {
                    allocated += 1;
                    Ok(format!("allocated{allocated}"))
                })
                .unwrap();
                for node in &mut road.nodes {
                    for point in std::iter::once(&mut node.point)
                        .chain(node.incoming.iter_mut())
                        .chain(node.outgoing.iter_mut())
                    {
                        point[0] *= scale;
                        point[1] *= scale;
                    }
                }
                assert!(road.nodes.iter().any(|n| n.point[1].abs() > 1.0));
                if let Some(expected) = &reference {
                    assert_eq!(road.nodes.len(), expected.nodes.len());
                    for (actual, expected) in road.nodes.iter().zip(&expected.nodes) {
                        for (a, b) in std::iter::once(actual.point)
                            .chain(actual.incoming)
                            .chain(actual.outgoing)
                            .zip(
                                std::iter::once(expected.point)
                                    .chain(expected.incoming)
                                    .chain(expected.outgoing),
                            )
                        {
                            assert!((a[0] - b[0]).abs() < 1e-7 && (a[1] - b[1]).abs() < 1e-7);
                        }
                    }
                } else {
                    reference = Some(road);
                }
            }
        }
        for scale in [0.0, -1.0, f64::NAN, f64::INFINITY, 26.0] {
            let mut road = fixture(100.0);
            let settings = RoadRoughness {
                amount: 0.33,
                seed: 1,
                view_scale: Some(scale),
            };
            assert!(deform(&mut road, &settings, 0..2, || panic!(
                "invalid zoom allocated an ID"
            ))
            .is_err());
        }
    }
    #[test]
    fn allocation_is_proportional_and_reserves_unmodified_edges() {
        assert_eq!(subdivision_counts(&[0, 100, 300], 10), vec![1, 4, 8]);
        assert_eq!(subdivision_counts(&[0, 0], 10), vec![1, 1]);
        assert_eq!(subdivision_counts(&[3, 3], 0), vec![1, 1]);
        assert_eq!(subdivision_counts(&[1, 2], 10), vec![2, 3]);
    }
    #[test]
    fn exhausted_budget_is_exact_noop_and_invalid_input_is_not_hidden() {
        for count in [511, 512] {
            let mut road = fixture(100.0);
            road.nodes = (0..count)
                .map(|i| Node {
                    id: format!("node{i}"),
                    point: [i as f64 * 100.0, 0.0],
                    incoming: None,
                    outgoing: None,
                })
                .collect();
            road.edge_sections = vec!["section".into(); count - 1];
            let before = road.clone();
            let settings = RoadRoughness {
                amount: 1.0,
                seed: 1,
                view_scale: None,
            };
            deform(&mut road, &settings, 0..count - 1, || {
                panic!("no allocation for no-op")
            })
            .unwrap();
            assert_eq!(road, before);
            road.nodes[0].point[0] = f64::NAN;
            assert!(deform(&mut road, &settings, 0..count - 1, || panic!(
                "no allocation for invalid input"
            ))
            .is_err());
        }
    }
    #[test]
    fn sample_overflow_retries_without_consuming_ids() {
        let scale = 660.0;
        let mut road = fixture(scale);
        road.nodes = (0..256)
            .map(|i| {
                let x = if i % 2 == 0 { 0.0 } else { scale };
                Node {
                    id: format!("n{i}"),
                    point: [x, 0.0],
                    incoming: Some([x, scale]),
                    outgoing: Some([x, scale]),
                }
            })
            .collect();
        road.edge_sections = vec!["section".into(); 255];
        super::super::parcel_geometry::PreparedRoadGeometry::new(&road).unwrap();
        let settings = RoadRoughness {
            amount: 1.0,
            seed: 17,
            view_scale: None,
        };
        let counts = subdivision_counts(&[9; 255], 128);
        let candidate = build(&road, &settings, &counts).unwrap();
        let error =
            super::super::parcel_geometry::PreparedRoadGeometry::new(&candidate).unwrap_err();
        assert_eq!(
            error.issue.unwrap().code,
            super::super::errors::IssueCode::Limit
        );
        let mut allocated = 0;
        deform(&mut road, &settings, 0..255, || {
            allocated += 1;
            Ok(format!("allocated{allocated}"))
        })
        .unwrap();
        assert_eq!(allocated, road.nodes.len() - 256);
        assert!(allocated < 128);
        super::super::parcel_geometry::PreparedRoadGeometry::new(&road).unwrap();
    }
}
