//! Atlas domain failures are data. Visible text is derived here, never classified.
use super::{geometry::valid_point, Bounds, Point};
use crate::atlas::Result;
use serde::{Deserialize, Serialize};

#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ErrorCategory {
    InvalidInput,
    StaleVersion,
    Storage,
}

#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AppError {
    pub category: ErrorCategory,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[cfg_attr(test, ts(optional))]
    pub issue: Option<Box<DomainIssue>>,
}
impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        self.message.fmt(f)
    }
}
impl std::error::Error for AppError {}
impl AppError {
    pub fn storage(message: impl ToString) -> Self {
        Self {
            category: ErrorCategory::Storage,
            message: message.to_string(),
            issue: None,
        }
    }
    pub fn stale(message: impl ToString) -> Self {
        Self {
            category: ErrorCategory::StaleVersion,
            message: message.to_string(),
            issue: None,
        }
    }
    pub(in crate::atlas) fn with_context(mut self, ids: Vec<String>) -> Self {
        if let Some(issue) = &mut self.issue {
            if issue.object_ids.is_empty() {
                issue.object_ids = ids;
            }
        }
        self
    }
    pub(in crate::atlas) fn with_geometry(mut self, geometry: IssueGeometry) -> Self {
        if let Some(issue) = &mut self.issue {
            issue.geometry = geometry.valid().then_some(geometry);
        }
        self
    }
}

#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum IssueCode {
    ParcelGeometry,
    ParcelContainment,
    Collision,
    GridAlignment,
    OccupiedParcel,
    BoundSection,
    Limit,
    InvalidInput,
}

#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(tag = "kind", rename_all = "camelCase", deny_unknown_fields)]
pub enum IssueGeometry {
    Bounds { bounds: Bounds },
    Point { point: Point },
    Path { points: Vec<Point> },
    Polygon { points: Vec<Point> },
}
impl IssueGeometry {
    pub fn valid(&self) -> bool {
        match self {
            Self::Bounds {
                bounds: [x, y, xx, yy],
            } => valid_point([*x, *y]) && valid_point([*xx, *yy]) && x <= xx && y <= yy,
            Self::Point { point } => valid_point(*point),
            Self::Path { points } => {
                (2..=32_768).contains(&points.len()) && points.iter().copied().all(valid_point)
            }
            Self::Polygon { points } => super::geometry::simple_polygon(points),
        }
    }
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DomainIssue {
    pub code: IssueCode,
    pub object_ids: Vec<String>,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[cfg_attr(test, ts(optional))]
    pub geometry: Option<IssueGeometry>,
}
#[derive(Clone, Debug)]
pub enum DomainViolation {
    Collision {
        geometry: Option<IssueGeometry>,
        first_id: String,
        second_id: String,
    },
    ParcelContainment {
        geometry: Option<IssueGeometry>,
        house_id: String,
        parcel_id: String,
    },
    GridAlignment {
        geometry: Option<IssueGeometry>,
        house_id: String,
        parcel_id: String,
    },
    BoundSection {
        geometry: Option<IssueGeometry>,
        road_id: String,
        section_ids: Vec<String>,
        parcel_ids: Vec<String>,
    },
    OccupiedParcel {
        geometry: Option<IssueGeometry>,
        parcel_id: String,
        owner_id: String,
    },
    ParcelGeometry {
        geometry: Option<IssueGeometry>,
        object_ids: Vec<String>,
        detail: String,
    },
    Limit {
        kind: String,
        actual: usize,
        maximum: usize,
        object_ids: Vec<String>,
    },
    InvalidInput {
        object_ids: Vec<String>,
        detail: String,
    },
}
impl DomainViolation {
    pub(in crate::atlas) fn with_geometry(mut self, value: IssueGeometry) -> Self {
        match &mut self {
            Self::Collision { geometry, .. }
            | Self::ParcelContainment { geometry, .. }
            | Self::GridAlignment { geometry, .. }
            | Self::BoundSection { geometry, .. }
            | Self::OccupiedParcel { geometry, .. }
            | Self::ParcelGeometry { geometry, .. } => *geometry = Some(value),
            _ => {}
        }
        self
    }
}
impl From<DomainViolation> for AppError {
    fn from(violation: DomainViolation) -> Self {
        use DomainViolation::*;
        let geometry = match &violation {
            Collision { geometry, .. }
            | ParcelContainment { geometry, .. }
            | GridAlignment { geometry, .. }
            | BoundSection { geometry, .. }
            | OccupiedParcel { geometry, .. }
            | ParcelGeometry { geometry, .. } => geometry.clone().filter(IssueGeometry::valid),
            _ => None,
        };
        let (code, ids, message) = match violation {
            Collision {
                first_id,
                second_id,
                ..
            } => (
                IssueCode::Collision,
                vec![first_id, second_id.clone()],
                format!("Überschneidung mit {second_id}"),
            ),
            ParcelContainment {
                house_id,
                parcel_id,
                ..
            } => (
                IssueCode::ParcelContainment,
                vec![house_id, parcel_id],
                "Sämtliche Geschosse müssen innerhalb der Ownerparzelle bleiben.".into(),
            ),
            GridAlignment {
                house_id,
                parcel_id,
                ..
            } => (
                IssueCode::GridAlignment,
                vec![house_id, parcel_id],
                "Haus liegt nicht im Parzellenraster.".into(),
            ),
            BoundSection {
                road_id,
                section_ids,
                parcel_ids,
                ..
            } => {
                let mut ids = vec![road_id];
                ids.extend(section_ids);
                ids.extend(parcel_ids);
                (
                    IssueCode::BoundSection,
                    ids,
                    "Gebundener Straßenabschnitt fehlt oder darf nicht zusammengeführt werden."
                        .into(),
                )
            }
            OccupiedParcel {
                parcel_id,
                owner_id,
                ..
            } => (
                IssueCode::OccupiedParcel,
                vec![parcel_id, owner_id],
                "Parzelle ist bereits bebaut.".into(),
            ),
            ParcelGeometry {
                object_ids, detail, ..
            } => (
                IssueCode::ParcelGeometry,
                object_ids,
                format!("Ungültige Parzellengeometrie: {detail}"),
            ),
            Limit {
                kind,
                actual,
                maximum,
                object_ids,
            } => (
                IssueCode::Limit,
                object_ids,
                format!("Grenze für {kind} überschritten: {actual}, maximal {maximum}."),
            ),
            InvalidInput { object_ids, detail } => (IssueCode::InvalidInput, object_ids, detail),
        };
        let mut object_ids = vec![];
        for id in ids {
            if !id.is_empty() && !object_ids.contains(&id) {
                object_ids.push(id);
            }
        }
        let issue = DomainIssue {
            code,
            object_ids,
            message: message.clone(),
            geometry,
        };
        Self {
            category: ErrorCategory::InvalidInput,
            message,
            issue: Some(Box::new(issue)),
        }
    }
}
/// Preserve the house-local error category and attach the known owner.
pub(in crate::atlas) fn local_interior_error(
    error: crate::interior::InteriorError,
    house_id: &str,
) -> AppError {
    match error.category {
        crate::interior::InteriorErrorCategory::InvalidInput => DomainViolation::InvalidInput {
            // Opening checks historically run at the adapter boundary, before
            // the document layer supplies context. Preserve that typed origin.
            object_ids: match error.origin {
                crate::interior::InteriorErrorOrigin::Local => vec![house_id.into()],
                crate::interior::InteriorErrorOrigin::OpeningValidation => vec![],
            },
            detail: error.message,
        }
        .into(),
        crate::interior::InteriorErrorCategory::Storage => AppError::storage(error.message),
    }
}

pub(in crate::atlas) fn invalid(s: impl ToString) -> AppError {
    DomainViolation::InvalidInput {
        object_ids: vec![],
        detail: s.to_string(),
    }
    .into()
}
pub(in crate::atlas) fn storage_error(s: impl ToString) -> AppError {
    AppError::storage(s)
}
pub(in crate::atlas) fn ensure(ok: bool, s: &str) -> Result<()> {
    if ok {
        Ok(())
    } else {
        Err(invalid(s))
    }
}
