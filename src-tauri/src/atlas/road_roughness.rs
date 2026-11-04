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
    if settings.amount == 0.0 {
        return Ok(());
    }
    let mut nodes = Vec::new();
    let mut sections = Vec::new();
    for i in 0..road.nodes.len().saturating_sub(1) {
        let a = &road.nodes[i];
        let b = &road.nodes[i + 1];
        if !edges.contains(&i) {
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
                .all(|v| v.is_finite() && v.abs() <= 5_000_000.0),
            "Ungültige Straßenkoordinate",
        )?;
        let length: f64 = curve
            .windows(2)
            .map(|p| (p[1][0] - p[0][0]).hypot(p[1][1] - p[0][1]))
            .sum();
        let waves = length / (8.0 * road.width).max(40.0);
        let count = if edges.contains(&i) {
            (waves * 4.0).ceil().max(4.0) as usize
        } else {
            1
        };
        ensure(nodes.len().saturating_add(count).saturating_add(1) <= 512, "Rauheit überschreitet das Limit von 512 Straßenknoten; Stärke 0 oder kürzeren Abschnitt verwenden")?;
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
            if edges.contains(&i) {
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
                    let amplitude = 0.5
                        * road.width
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
                    id: allocate()?,
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
    ensure(
        nodes.len() <= 512,
        "Rauheit überschreitet das Limit von 512 Straßenknoten",
    )?;
    ensure(nodes.len() >= 2, "Mindestens zwei Straßenknoten benötigt")?;
    road.nodes = nodes;
    road.edge_sections = sections;
    Ok(())
}
