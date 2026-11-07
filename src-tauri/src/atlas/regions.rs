//! Authored region geometry and independent, spatially derived membership.
use crate::atlas::{
    errors::ensure,
    model::{Bounds, Point},
    validation::name,
    Result,
};
use geo::{
    Area, BooleanOps, BoundingRect, Buffer, Centroid, Contains, Coord, LineString, MultiPolygon,
    Point as GeoPoint, Polygon, Validation,
};
use serde::{Deserialize, Serialize};

#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RegionCategory {
    #[serde(default)]
    pub markers: bool,
    pub id: String,
    pub name: String,
    pub visible: bool,
    pub fixed_rank: Option<String>,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RegionRank {
    pub id: String,
    pub category_id: String,
    pub name: String,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RegionCatalog {
    pub categories: Vec<RegionCategory>,
    pub ranks: Vec<RegionRank>,
}
impl Default for RegionCatalog {
    fn default() -> Self {
        let categories = vec![
            RegionCategory {
                id: "builtin-category-1".into(),
                name: "Politisch".into(),
                visible: true,
                fixed_rank: None,
                markers: false,
            },
            RegionCategory {
                id: "builtin-category-2".into(),
                name: "Geographisch".into(),
                visible: false,
                fixed_rank: None,
                markers: false,
            },
        ];
        let mut categories = categories;
        categories.push(RegionCategory {
            id: "builtin-category-16".into(),
            name: "Ortschaften".into(),
            visible: true,
            fixed_rank: None,
            markers: true,
        });
        let mut ranks = vec![];
        for (category, names) in [
            (
                "builtin-category-1",
                vec![
                    "Viertel",
                    "Stadtteil",
                    "Ortschaft",
                    "Bezirk",
                    "Grafschaft",
                    "Herzogtum",
                    "Königreich",
                    "Kaiserreich",
                ],
            ),
            (
                "builtin-category-2",
                vec![
                    "Örtlichkeit",
                    "Landschaft",
                    "Großlandschaft",
                    "Subkontinent",
                    "Kontinent",
                ],
            ),
            (
                "builtin-category-16",
                vec!["Gehöft", "Dorf", "Stadt", "Metropole"],
            ),
        ] {
            for n in names {
                ranks.push(RegionRank {
                    id: format!(
                        "builtin-rank-{}",
                        ranks.len() + 3 + usize::from(ranks.len() >= 13)
                    ),
                    category_id: category.into(),
                    name: n.into(),
                });
            }
        }
        Self { categories, ranks }
    }
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RegionPolygon {
    pub outer: Vec<Point>,
    pub holes: Vec<Vec<Point>>,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RegionStyle {
    pub color: String,
    pub opacity: f64,
    pub width: f64,
    pub dash: RegionDash,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum RegionDash {
    Solid,
    Dashed,
    Dotted,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RegionLabel {
    pub anchor: Option<Point>,
    pub min_scale: Option<f64>,
    pub max_scale: Option<f64>,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Region {
    pub id: String,
    pub name: String,
    pub rank_id: String,
    pub polygons: Vec<RegionPolygon>,
    pub style: RegionStyle,
    pub label: RegionLabel,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum RegionAction {
    Create {
        name: String,
        rank_id: String,
    },
    Update {
        id: String,
        name: String,
        rank_id: String,
        style: RegionStyle,
        label: RegionLabel,
    },
    Delete {
        id: String,
    },
    Catalog {
        catalog: RegionCatalog,
    },
    AddCategory {
        name: String,
    },
    AddRank {
        category_id: String,
        name: String,
    },
    DeleteCategory {
        id: String,
    },
    DeleteRank {
        id: String,
    },
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct RegionDelta {
    pub before: Vec<Region>,
    pub after: Vec<Region>,
    pub catalog_before: RegionCatalog,
    pub catalog_after: RegionCatalog,
}
pub fn geometry(r: &Region) -> MultiPolygon<f64> {
    polygon_geometry(&r.polygons)
}
pub fn polygon_geometry(polygons: &[RegionPolygon]) -> MultiPolygon<f64> {
    fn ring(p: &[Point]) -> LineString<f64> {
        let mut c: Vec<_> = p.iter().map(|p| Coord { x: p[0], y: p[1] }).collect();
        if let Some(first) = c.first().copied() {
            c.push(first)
        }
        LineString(c)
    }
    MultiPolygon(
        polygons
            .iter()
            .map(|p| Polygon::new(ring(&p.outer), p.holes.iter().map(|h| ring(h)).collect()))
            .collect(),
    )
}
pub fn authored(g: MultiPolygon<f64>) -> Vec<RegionPolygon> {
    fn ring(r: &LineString<f64>, positive: bool) -> Vec<Point> {
        let mut points: Vec<_> =
            r.0.iter()
                .take(r.0.len().saturating_sub(1))
                .map(|p| {
                    [
                        if p.x == 0.0 { 0.0 } else { p.x },
                        if p.y == 0.0 { 0.0 } else { p.y },
                    ]
                })
                .collect();
        if let Some(origin) = points.first().copied() {
            let signed: f64 = points
                .iter()
                .zip(points.iter().cycle().skip(1))
                .take(points.len())
                .map(|(a, b)| {
                    (a[0] - origin[0]) * (b[1] - origin[1])
                        - (b[0] - origin[0]) * (a[1] - origin[1])
                })
                .sum();
            if (signed > 0.0) != positive {
                points.reverse();
            }
        }
        if let Some((i, _)) = points
            .iter()
            .enumerate()
            .min_by(|a, b| a.1[0].total_cmp(&b.1[0]).then(a.1[1].total_cmp(&b.1[1])))
        {
            points.rotate_left(i)
        }
        points
    }
    fn compare(a: &[Point], b: &[Point]) -> std::cmp::Ordering {
        a.iter()
            .zip(b)
            .map(|(a, b)| a[0].total_cmp(&b[0]).then(a[1].total_cmp(&b[1])))
            .find(|o| !o.is_eq())
            .unwrap_or_else(|| a.len().cmp(&b.len()))
    }
    let mut polygons: Vec<_> =
        g.0.into_iter()
            .map(|p| {
                let mut holes: Vec<_> = p.interiors().iter().map(|r| ring(r, false)).collect();
                holes.sort_by(|a, b| compare(a, b));
                RegionPolygon {
                    outer: ring(p.exterior(), true),
                    holes,
                }
            })
            .collect();
    polygons.sort_by(|a, b| compare(&a.outer, &b.outer));
    polygons
}
pub fn bounds(g: &MultiPolygon<f64>) -> Option<Bounds> {
    g.bounding_rect()
        .map(|b| [b.min().x, b.min().y, b.max().x, b.max().y])
}
pub fn anchor(g: &MultiPolygon<f64>) -> Point {
    let Some(p) =
        g.0.iter()
            .max_by(|a, b| a.unsigned_area().total_cmp(&b.unsigned_area()))
    else {
        return [0.0, 0.0];
    };
    if let Some(c) = p.centroid() {
        if p.contains(&c) {
            return [c.x(), c.y()];
        }
    }
    // Scan interior horizontal intervals: deterministic, including narrow concave polygons.
    let b = p.bounding_rect().unwrap();
    let mut best = None;
    let mut best_distance = 0.0;
    for step in 0..65 {
        let y = b.min().y + (b.max().y - b.min().y) * (step as f64 + 0.5) / 65.0;
        let mut xs = vec![];
        for r in std::iter::once(p.exterior()).chain(p.interiors()) {
            for edge in r.0.windows(2) {
                let (a, z) = (edge[0], edge[1]);
                if (a.y > y) != (z.y > y) {
                    xs.push(a.x + (y - a.y) * (z.x - a.x) / (z.y - a.y));
                }
            }
        }
        xs.sort_by(f64::total_cmp);
        if let Some(pair) = xs
            .as_chunks::<2>()
            .0
            .iter()
            .max_by(|a, b| (a[1] - a[0]).total_cmp(&(b[1] - b[0])))
        {
            let x = (pair[0] + pair[1]) / 2.0;
            if p.contains(&GeoPoint::new(x, y)) {
                let distance = std::iter::once(p.exterior())
                    .chain(p.interiors())
                    .flat_map(|r| r.0.windows(2))
                    .map(|edge| {
                        let (a, b) = (edge[0], edge[1]);
                        let (dx, dy) = (b.x - a.x, b.y - a.y);
                        let t = if dx * dx + dy * dy > 0.0 {
                            ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy)
                        } else {
                            0.0
                        };
                        let t = t.clamp(0.0, 1.0);
                        (x - a.x - t * dx).powi(2) + (y - a.y - t * dy).powi(2)
                    })
                    .fold(f64::INFINITY, f64::min);
                if distance > best_distance {
                    best = Some([x, y]);
                    best_distance = distance;
                }
            }
        }
    }
    let c = p.exterior().0[0];
    best.unwrap_or([c.x, c.y])
}
pub fn validate_catalog(c: &RegionCatalog) -> Result<()> {
    ensure(
        c.categories.len() <= 64 && c.ranks.len() <= 512,
        "Höchstens 64 Kategorien und 512 Rangstufen",
    )?;
    let mut ids = std::collections::HashSet::new();
    for cat in &c.categories {
        ensure(name(&cat.name), "Name: 1–120 Zeichen")?;
        ensure(ids.insert(&cat.id), "Doppelte Kategorie")?;
        ensure(
            cat.fixed_rank.as_ref().is_none_or(|id| {
                c.ranks
                    .iter()
                    .any(|r| &r.id == id && r.category_id == cat.id)
            }),
            "Ungültige feste Rangstufe",
        )?;
    }
    for rank in &c.ranks {
        ensure(name(&rank.name), "Name: 1–120 Zeichen")?;
        ensure(
            ids.insert(&rank.id) && c.categories.iter().any(|c| c.id == rank.category_id),
            "Ungültige Rangstufe",
        )?;
    }
    Ok(())
}
pub fn validate(r: &Region, c: &RegionCatalog) -> Result<()> {
    ensure(name(&r.name), "Name: 1–120 Zeichen")?;
    ensure(c.ranks.iter().any(|a| a.id == r.rank_id), "Rangstufe fehlt")?;
    ensure(
        r.style.color.len() == 7
            && r.style.color.starts_with('#')
            && r.style.color[1..].bytes().all(|b| b.is_ascii_hexdigit())
            && r.style.opacity.is_finite()
            && (0.0..=1.0).contains(&r.style.opacity)
            && r.style.width.is_finite()
            && (0.5..=12.0).contains(&r.style.width),
        "Ungültiger Regionsstil",
    )?;
    let valid_point = |p: &Point| p.iter().all(|v| v.is_finite() && v.abs() <= 100_000_000.0);
    ensure(
        r.label.anchor.as_ref().is_none_or(valid_point)
            && [r.label.min_scale, r.label.max_scale]
                .iter()
                .flatten()
                .all(|v| v.is_finite() && *v > 0.0)
            && r.label
                .min_scale
                .zip(r.label.max_scale)
                .is_none_or(|(a, b)| a <= b),
        "Ungültige Beschriftung",
    )?;
    let mut count = 0;
    for p in &r.polygons {
        for ring in std::iter::once(&p.outer).chain(&p.holes) {
            count += ring.len();
            ensure(
                ring.len() >= 3 && ring.iter().all(valid_point),
                "Ungültige Regionskontur",
            )?;
        }
    }
    ensure(
        count <= 100_000,
        "Region überschreitet 100.000 Konturpunkte",
    )?;
    let g = geometry(r);
    ensure(
        g.is_valid() && g.0.iter().all(|p| p.unsigned_area() > 0.0),
        "Ungültige Regionsgeometrie",
    )
}
pub fn brush(points: &[Point], radius: f64) -> Result<MultiPolygon<f64>> {
    ensure(
        !points.is_empty()
            && points.len() <= 4096
            && radius.is_finite()
            && radius > 0.0
            && radius <= 200_000_000.0,
        "Ungültiger Regionspinsel",
    )?;
    ensure(
        points
            .iter()
            .flatten()
            .all(|v| v.is_finite() && v.abs() <= 100_000_000.0),
        "Pinsel außerhalb der Welt",
    )?;
    let shape = if points.len() == 1 {
        GeoPoint::new(points[0][0], points[0][1]).buffer(radius)
    } else {
        LineString::from(points.iter().map(|p| (p[0], p[1])).collect::<Vec<_>>()).buffer(radius)
    };
    if bounds(&shape).is_none_or(|b| b.iter().all(|v| v.abs() <= 100_000_000.0)) {
        return Ok(shape);
    }
    let b = bounds(&shape).unwrap().map(|v| v.clamp(-1e8, 1e8));
    let world = Polygon::new(
        LineString::from(vec![
            (b[0], b[1]),
            (b[2], b[1]),
            (b[2], b[3]),
            (b[0], b[3]),
            (b[0], b[1]),
        ]),
        vec![],
    );
    Ok(shape.intersection(&MultiPolygon(vec![world])))
}
pub fn overlap(a: &MultiPolygon<f64>, b: &MultiPolygon<f64>) -> f64 {
    let area = a.intersection(b).unsigned_area();
    let m = bounds(a)
        .into_iter()
        .flatten()
        .chain(bounds(b).into_iter().flatten())
        .fold(1.0_f64, |a, b| a.max(b.abs()));
    if area > (1e-6 + 1e-12 * m).powi(2) {
        area
    } else {
        0.0
    }
}
