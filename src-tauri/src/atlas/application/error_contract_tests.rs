use super::application_test_support::{request_edit as edit, *};
use super::*;
use crate::atlas::test_inputs::update_road;
use rusqlite::hooks::{AuthAction, AuthContext, Authorization};

fn settings() -> Value {
    json!({"side":"both","setback":5,"gap":20,"minWidth":4,"maxWidth":4,"minDepth":4,"maxDepth":4,"seed":1,"parcelDepth":80})
}
fn fixture() -> (AtlasApplication, Value, Value, Value) {
    let mut a = AtlasApplication::new().unwrap();
    let result = edit(
        &mut a,
        "commit",
        json!({"type":"createRoad","road":{"name":"Road","width":10,"material":"earth","nodes":[{"point":[0,0],"incoming":null,"outgoing":null},{"point":[160,0],"incoming":null,"outgoing":null}]},"population":settings()}),
    );
    let get = |kind| {
        result["objects"]
            .as_array()
            .unwrap()
            .iter()
            .find(|o| o["kind"] == kind)
            .unwrap()
            .clone()
    };
    (a, get("road"), get("parcel"), get("house"))
}
fn rejected(a: &mut AtlasApplication, intent: Value, code: IssueCode, ids: &[&str]) -> DomainIssue {
    let before = json!(a.status());
    let preview = edit(a, "preview", intent.clone());
    assert_eq!(preview["valid"], false, "{preview}");
    assert_eq!(preview["issues"].as_array().unwrap().len(), 1);
    let error = a
        .request("commit", json!({"version":a.status(),"intent":intent}))
        .unwrap_err();
    assert_eq!(error.category, ErrorCategory::InvalidInput);
    let issue = *error.issue.unwrap();
    assert_eq!(issue.code, code);
    assert_eq!(json!(issue), preview["issues"][0]);
    assert_eq!(issue.message, error.message);
    assert_eq!(preview["reason"], issue.message);
    for id in ids {
        assert!(
            issue.object_ids.iter().any(|found| found == id),
            "missing {id} in {issue:?}"
        );
    }
    if let Some(geometry) = &issue.geometry {
        assert!(geometry.valid());
    }
    assert_eq!(json!(a.status()), before);
    for object in preview["proposedObjects"].as_array().unwrap() {
        let object: SceneObject = serde_json::from_value(object.clone()).unwrap();
        assert!(safe_proposed(&object));
    }
    issue
}
#[test]
fn eight_domain_codes_have_identical_preview_commit_issues_with_complete_ids() {
    let (mut a, road, parcel, house) = fixture();
    let hid = house["id"].as_str().unwrap();
    let pid = parcel["id"].as_str().unwrap();
    let rid = road["id"].as_str().unwrap();
    rejected(
        &mut a,
        json!({"type":"rename","id":hid,"name":""}),
        IssueCode::InvalidInput,
        &[hid],
    );
    // An interior message with words associated with other codes remains InvalidInput.
    rejected(
        &mut a,
        json!({"type":"room","buildingId":hid,"intent":{"kind":"move","roomId":"missing","dx":1,"dy":0}}),
        IssueCode::InvalidInput,
        &[hid],
    );
    let mut transform = house["transform"].clone();
    transform["x"] = json!(transform["x"].as_f64().unwrap() + 2.5);
    rejected(
        &mut a,
        json!({"type":"transformHouse","id":hid,"transform":transform}),
        IssueCode::GridAlignment,
        &[hid, pid],
    );
    transform["x"] = json!(house["transform"]["x"].as_f64().unwrap() + 5000.0);
    rejected(
        &mut a,
        json!({"type":"transformHouse","id":hid,"transform":transform}),
        IssueCode::ParcelContainment,
        &[hid, pid],
    );
    let occupied = rejected(
        &mut a,
        json!({"type":"createParcelHouse","parcelId":pid,"floor":0,"cells":[[0,0]]}),
        IssueCode::OccupiedParcel,
        &[pid, hid],
    );
    assert_eq!(occupied.object_ids.len(), 2); // Existing owner, never the rejected new house.
    rejected(
        &mut a,
        json!({"type":"createHouse","parcelId":null,"transform":house["transform"],"width":4,"depth":4}),
        IssueCode::Collision,
        &[pid],
    );
    let limit = rejected(
        &mut a,
        json!({"type":"createHouse","parcelId":null,"transform":{"x":0,"y":0,"angle":0},"width":100001,"depth":1}),
        IssueCode::Limit,
        &[],
    );
    assert_eq!(limit.object_ids.len(), 1);
    assert!(limit.message.contains("100001"));
    let extension = edit(
        &mut a,
        "commit",
        json!({"type":"extendRoad","roadId":rid,"end":"end","nodes":[{"point":[320,0],"incoming":null,"outgoing":null}],"endpointHandle":null,"population":null}),
    );
    let extended = extension["objects"]
        .as_array()
        .unwrap()
        .iter()
        .find(|o| o["kind"] == "road")
        .unwrap();
    let bound = rejected(
        &mut a,
        json!({"type":"deleteRoadNode","roadId":rid,"nodeId":extended["nodes"][0]["id"]}),
        IssueCode::BoundSection,
        &[rid, road["sections"][0]["id"].as_str().unwrap(), pid],
    );
    assert_eq!(bound.object_ids.len(), 10); // road + section + all eight bound parcels
    let junction = rejected(
        &mut a,
        json!({"type":"deleteRoadNode","roadId":rid,"nodeId":extended["nodes"][1]["id"]}),
        IssueCode::BoundSection,
        &[
            rid,
            road["sections"][0]["id"].as_str().unwrap(),
            extended["sections"][1]["id"].as_str().unwrap(),
            pid,
        ],
    );
    assert_eq!(junction.object_ids.len(), 11); // Both source sections of the rejected merge.

    // Strong backtracking controls make the existing bound polygon impossible.
    let mut proposed = extended.clone();
    proposed["nodes"][0]["outgoing"] = json!([320, 0]);
    proposed["nodes"][1]["incoming"] = json!([-160, 0]);
    let invalid = rejected(
        &mut a,
        update_road(&proposed),
        IssueCode::ParcelGeometry,
        &[rid, road["sections"][0]["id"].as_str().unwrap()],
    );
    assert!(invalid
        .object_ids
        .iter()
        .any(|id| id.starts_with("parcel-")));
    assert_eq!(
        invalid
            .geometry
            .as_ref()
            .map(|g| matches!(g, IssueGeometry::Path { .. })),
        Some(true)
    );
}
#[test]
fn stale_and_storage_failures_are_not_invalid_previews() {
    let (mut a, road, _, _) = fixture();
    let intent = json!({"type":"rename","id":road["id"],"name":"Renamed"});
    for cmd in ["preview", "commit"] {
        let mut version = json!(a.status());
        version["revision"] = json!(-1);
        let error = a
            .request(cmd, json!({"version":version,"intent":intent}))
            .unwrap_err();
        assert_eq!(error.category, ErrorCategory::StaleVersion);
        assert!(error.issue.is_none());
    }
    a.db.flush_prepared_statement_cache();
    a.db.authorizer(Some(|ctx: AuthContext<'_>| match ctx.action {
        AuthAction::Read {
            table_name: "document_meta",
            ..
        } => Authorization::Deny,
        _ => Authorization::Allow,
    }));
    for cmd in ["preview", "commit"] {
        let error = a
            .request(cmd, json!({"version":a.status(),"intent":intent}))
            .unwrap_err();
        assert_eq!(error.category, ErrorCategory::Storage);
        assert!(error.issue.is_none());
    }
}
#[test]
fn unsafe_issue_geometry_is_never_published_and_text_never_defines_code() {
    let violation = || DomainViolation::InvalidInput {
        object_ids: vec!["house-1".into()],
        detail: "boundSection Raster Überschneidung parcelGeometry limit occupiedParcel".into(),
    };
    for geometry in [
        IssueGeometry::Point {
            point: [f64::NAN, 0.0],
        },
        IssueGeometry::Bounds {
            bounds: [10.0, 0.0, 0.0, 1.0],
        },
        IssueGeometry::Path {
            points: vec![[0.0, 0.0]; 32769],
        },
        IssueGeometry::Polygon {
            points: vec![[0.0, 0.0], [1.0, 1.0], [2.0, 2.0]],
        },
    ] {
        let error = AppError::from(violation()).with_geometry(geometry);
        assert_eq!(error.issue.as_ref().unwrap().code, IssueCode::InvalidInput);
        assert!(error.issue.unwrap().geometry.is_none());
    }
    let error = errors::local_interior_error(
        crate::interior::InteriorError {
            origin: crate::interior::InteriorErrorOrigin::Local,
            category: crate::interior::InteriorErrorCategory::InvalidInput,
            message: "Raster Überschneidung boundSection".into(),
        },
        "house-1",
    );
    assert_eq!(error.issue.unwrap().code, IssueCode::InvalidInput);
}

#[test]
fn malformed_json_is_explicit_invalid_input_and_generation_contract_is_active() {
    let mut a = AtlasApplication::new().unwrap();
    for cmd in ["preview", "commit"] {
        let error = a.request(cmd, json!({"version": a.status(), "intent": {"type":"transformHouse", "id":"house-1", "transform": {"x":"invalid", "y":0, "angle":0}}})).unwrap_err();
        assert_eq!(error.category, ErrorCategory::InvalidInput);
        assert_eq!(error.issue.unwrap().code, IssueCode::InvalidInput);
    }
    use generation::*;
    assert_eq!(
        json!(GenerationResponse::default()),
        json!({"generationSummary":{"createdParcels":0,"createdHouses":0,"emptyParcels":0,"skippedParcels":0,"unplacedHouses":0,"limited":false},"generationDiagnostics":[],"generationLimit":null})
    );
    let house = json!({"target":"house","code":"noGridFit","roadId":"road-1","sectionId":"section-2","side":"left","slotIndex":0,"point":[0.0,0.0],"message":"no fit"});
    assert!(serde_json::from_value::<GenerationDiagnostic>(house.clone()).is_err());
    let mut house = house;
    house["parcelId"] = json!("parcel-3");
    assert_eq!(
        json!(serde_json::from_value::<GenerationDiagnostic>(house.clone()).unwrap()),
        house
    );
    let parcel = json!({"target":"parcel","code":"parcelCollision","roadId":"road-1","sectionId":"section-2","side":"right","slotIndex":1,"point":[0.0,0.0],"message":"blocked","obstacleIds":["area-4"]});
    assert_eq!(
        json!(serde_json::from_value::<GenerationDiagnostic>(parcel.clone()).unwrap()),
        parcel
    );
    let (mut a, _, _, _) = fixture();
    let result = edit(
        &mut a,
        "preview",
        json!({"type":"createHouse","parcelId":null,"width":1,"depth":1,"transform":{"x":10000,"y":10000,"angle":0}}),
    );
    assert!(result.get("skipped").is_none());
    assert_eq!(result["generationDiagnostics"], json!([]));
}
