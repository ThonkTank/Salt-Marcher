#[path = "../src/atlas/test_inputs.rs"]
mod test_inputs;
use saltmarcher::atlas::AtlasApplication;
use serde_json::{json, Value};
use test_inputs::update_road;
fn edit(a: &mut AtlasApplication, cmd: &str, intent: Value) -> Value {
    a.request(cmd, json!({"version":a.status(),"intent":intent}))
        .unwrap()
}
fn commit(a: &mut AtlasApplication, intent: Value) -> Value {
    edit(a, "commit", intent)
}
fn settings() -> Value {
    json!({"side":"both","setback":5,"gap":20,"minWidth":4,"maxWidth":4,"minDepth":4,"maxDepth":4,"seed":1,"parcelDepth":80})
}
fn new_road(a: &mut AtlasApplication, population: bool) -> Value {
    let mut i = json!({"type":"createRoad","road":{"name":"Road","width":10,"material":"earth","nodes":[{"point":[0,0],"incoming":null,"outgoing":null},{"point":[160,0],"incoming":null,"outgoing":null}]},"population":null});
    if population {
        i["population"] = settings();
    }
    commit(a, i)
}
fn objects(a: &mut AtlasApplication) -> Vec<Value> {
    a.request(
        "scene",
        json!({"bounds":[-10000,-10000,10000,10000],"context":{"kind":"exterior"}}),
    )
    .unwrap()["objects"]
        .as_array()
        .unwrap()
        .clone()
}
// Format 10 persists Area.order, but has no authoritative SQLite row ordinal.
// Compare every object field exactly, independently of the loader's pass order.
fn assert_same_objects(mut actual: Vec<Value>, mut expected: Vec<Value>) {
    actual.sort_by_key(|v| v["id"].as_str().unwrap().to_owned());
    expected.sort_by_key(|v| v["id"].as_str().unwrap().to_owned());
    assert_eq!(actual, expected);
}
fn kind(v: &Value, k: &str) -> Vec<Value> {
    v["objects"]
        .as_array()
        .unwrap()
        .iter()
        .filter(|o| o["kind"] == k)
        .cloned()
        .collect()
}
fn history(a: &mut AtlasApplication, redo: bool) {
    a.request("history", json!({"version":a.status(),"redo":redo}))
        .unwrap();
}
fn moved(road: &Value, dy: f64) -> Value {
    let mut r = road.clone();
    for n in r["nodes"].as_array_mut().unwrap() {
        n["point"][1] = json!(n["point"][1].as_f64().unwrap() + dy);
    }
    update_road(&r)
}
fn room(a: &mut AtlasApplication, house: &Value, floor: i64, cells: Value) -> Value {
    commit(
        a,
        json!({"type":"room","buildingId":house["id"],"intent":{"kind":"draw","floor":floor,"cells":cells}}),
    )
}
#[test]
fn compound_creation_preview_idempotence_and_branching_are_one_action() {
    let mut a = AtlasApplication::new().unwrap();
    let intent = json!({"type":"createRoad","road":{"name":"Road","width":10,"material":"earth","nodes":[{"point":[0,0],"incoming":null,"outgoing":null},{"point":[160,0],"incoming":null,"outgoing":null}]},"population":settings()});
    let before = json!(a.status());
    let p = edit(&mut a, "preview", intent.clone());
    assert_eq!(json!(a.status()), before);
    let c = commit(&mut a, intent);
    assert_eq!(p["objects"], c["objects"]);
    assert_eq!(a.status().revision, 1);
    assert_eq!(kind(&c, "parcel").len(), 8);
    assert_eq!(kind(&c, "house").len(), 8);
    let r = &kind(&c, "road")[0];
    let revision = a.status().revision;
    let repeat = json!({"type":"populate","roadId":r["id"],"settings":settings()});
    assert_eq!(commit(&mut a, repeat)["changed"], false);
    assert_eq!(a.status().revision, revision);
    history(&mut a, false);
    assert!(objects(&mut a).is_empty());
    history(&mut a, true);
    assert_eq!(objects(&mut a).len(), 17);
    history(&mut a, false);
    let branch = new_road(&mut a, false);
    assert_ne!(kind(&branch, "road")[0]["id"], r["id"]);
    assert!(!a.status().can_redo);
}
#[test]
fn last_room_leaves_empty_parcel_rebuilds_new_identity_and_disconnected_owner() {
    let mut a = AtlasApplication::new().unwrap();
    let c = new_road(&mut a, true);
    let h = kind(&c, "house")[0].clone();
    let parcel = h["placement"]["parcelId"].clone();
    let deleted = commit(
        &mut a,
        json!({"type":"room","buildingId":h["id"],"intent":{"kind":"erase","floor":0,"cells":(0..4).flat_map(|y|(0..4).map(move|x|json!([x,y]))).collect::<Vec<_>>()}}),
    );
    assert_eq!(deleted["deletedIds"], json!([h["id"]]));
    assert_eq!(deleted["cascadeCounts"]["houses"], 1);
    assert_eq!(deleted["cascadeCounts"]["rooms"], 1);
    assert_eq!(deleted["cascadeCounts"]["connections"], 1);
    let empty = a
        .request(
            "scene",
            json!({"bounds":[9000,9000,9010,9010],"context":{"kind":"parcel","parcelId":parcel}}),
        )
        .unwrap();
    assert_eq!(
        empty["contextState"],
        json!({"exists":true,"parcelId":parcel,"houseId":null})
    );
    let rebuilt = commit(
        &mut a,
        json!({"type":"createParcelHouse","parcelId":parcel,"floor":-1,"cells":[[-1,1],[1,1]]}),
    );
    let next = kind(&rebuilt, "house")[0].clone();
    assert_ne!(next["id"], h["id"]);
    assert_eq!(
        next["placement"]["gridPose"],
        json!({"xCells":0,"yCells":0,"quarterTurns":0})
    );
    let metadata = a
        .request("interiorMetadata", json!({"buildingId":next["id"]}))
        .unwrap();
    assert_eq!(metadata["rooms"].as_array().unwrap().len(), 2);
    assert!(metadata["rooms"]
        .as_array()
        .unwrap()
        .iter()
        .all(|r| r["buildingId"] == next["id"]));
    room(&mut a, &next, 0, json!([[0, 3]]));
    let occupied = edit(
        &mut a,
        "preview",
        json!({"type":"createParcelHouse","parcelId":parcel,"floor":0,"cells":[[0,4]]}),
    );
    assert_eq!(occupied["valid"], false);
    assert_eq!(occupied["issues"][0]["code"], "occupiedParcel");
    assert!(rebuilt["status"]["changes"]["relations"]
        .as_array()
        .unwrap()
        .contains(&parcel));
}
#[test]
fn bound_creation_transform_alignment_and_all_floor_containment_have_structured_previews() {
    let mut a = AtlasApplication::new().unwrap();
    let c = new_road(&mut a, true);
    let h = kind(&c, "house")[0].clone();
    let parcel = h["placement"]["parcelId"].clone();
    commit(&mut a, json!({"type":"delete","id":h["id"]}));
    let p = kind(&c, "parcel")
        .into_iter()
        .find(|p| p["id"] == parcel)
        .unwrap();
    let frame = p["frame"].clone();
    let new = commit(
        &mut a,
        json!({"type":"createHouse","parcelId":parcel,"transform":frame,"width":1,"depth":1}),
    );
    let h = kind(&new, "house")[0].clone();
    for (dx, da) in [(2.5, 0.0), (0.0, 0.1)] {
        let mut t = h["transform"].clone();
        t["x"] = json!(t["x"].as_f64().unwrap() + dx);
        t["angle"] = json!(t["angle"].as_f64().unwrap() + da);
        let invalid = edit(
            &mut a,
            "preview",
            json!({"type":"transformHouse","id":h["id"],"transform":t}),
        );
        assert_eq!(invalid["valid"], false);
        assert_eq!(invalid["issues"][0]["code"], "gridAlignment");
    }
    // A disconnected basement must obey the parcel even though it changes no roof.
    let invalid = edit(
        &mut a,
        "preview",
        json!({"type":"room","buildingId":h["id"],"intent":{"kind":"draw","floor":-1,"cells":[[0,20]]}}),
    );
    assert_eq!(invalid["valid"], false);
    assert_eq!(invalid["issues"][0]["code"], "parcelContainment");
    assert_eq!(invalid["proposedObjects"][0]["id"], h["id"]);
    let mut t = h["transform"].clone();
    t["x"] = json!(t["x"].as_f64().unwrap() + 1e-9);
    assert_eq!(
        commit(
            &mut a,
            json!({"type":"transformHouse","id":h["id"],"transform":t})
        )["changed"],
        false
    );
}
#[test]
fn insert_delete_and_both_extensions_keep_existing_sections_markers_and_house_interiors() {
    let mut a = AtlasApplication::new().unwrap();
    let c = new_road(&mut a, true);
    let r = kind(&c, "road")[0].clone();
    let h = kind(&c, "house")[0].clone();
    let interior = a
        .request(
            "detail",
            json!({"buildingId":h["id"],"floor":0,"bounds":[-10,-10,50,50]}),
        )
        .unwrap();
    let split = commit(
        &mut a,
        json!({"type":"insertRoadNode","roadId":r["id"],"afterNodeId":r["nodes"][0]["id"],"t":0.5}),
    );
    let split = kind(&split, "road")[0].clone();
    assert_eq!(
        split["edgeSections"],
        json!([r["edgeSections"][0], r["edgeSections"][0]])
    );
    let before_sections = split["sections"].clone();
    let merged = commit(
        &mut a,
        json!({"type":"deleteRoadNode","roadId":r["id"],"nodeId":split["nodes"][1]["id"]}),
    );
    let mut previous = kind(&merged, "road")[0].clone();
    for (end, point) in [("start", json!([-160, 0])), ("end", json!([320, 0]))] {
        let extended = commit(
            &mut a,
            json!({"type":"extendRoad","roadId":r["id"],"end":end,"nodes":[{"point":point,"incoming":null,"outgoing":null}],"endpointHandle":null,"population":settings()}),
        );
        let next = kind(&extended, "road")[0].clone();
        assert!(next["sections"]
            .as_array()
            .unwrap()
            .contains(&before_sections[0]));
        let old_first = previous["nodes"][0].clone();
        let old_last = previous["nodes"]
            .as_array()
            .unwrap()
            .last()
            .unwrap()
            .clone();
        assert!(next["nodes"].as_array().unwrap().contains(&old_first));
        assert!(next["nodes"].as_array().unwrap().contains(&old_last));
        previous = next;
    }
    let now = a
        .request(
            "detail",
            json!({"buildingId":h["id"],"floor":0,"bounds":[-10,-10,50,50]}),
        )
        .unwrap();
    for k in ["rooms", "connections", "cells"] {
        assert_eq!(interior[k], now[k]);
    }
    let invalid = edit(
        &mut a,
        "preview",
        json!({"type":"deleteRoadNode","roadId":r["id"],"nodeId":r["nodes"][0]["id"]}),
    );
    assert_eq!(invalid["valid"], false);
    assert_eq!(invalid["issues"][0]["code"], "boundSection");
}
#[test]
fn deleting_bound_terminal_section_rejects_and_unpopulated_extensions_stay_open() {
    let mut a = AtlasApplication::new().unwrap();
    let c = new_road(&mut a, true);
    let r = kind(&c, "road")[0].clone();
    let e = commit(
        &mut a,
        json!({"type":"extendRoad","roadId":r["id"],"end":"end","nodes":[{"point":[320,0],"incoming":null,"outgoing":null}],"endpointHandle":[180,0],"population":null}),
    );
    let e = kind(&e, "road")[0].clone();
    assert_eq!(e["sections"][1]["populatedSides"], json!([]));
    let filled = commit(
        &mut a,
        json!({"type":"populate","roadId":r["id"],"settings":settings()}),
    );
    assert!(!kind(&filled, "house").is_empty());
    let invalid = edit(
        &mut a,
        "preview",
        json!({"type":"deleteRoadNode","roadId":r["id"],"nodeId":e["nodes"][2]["id"]}),
    );
    assert_eq!(invalid["issues"][0]["code"], "boundSection");
}
#[test]
fn late_collision_rejects_entire_offscreen_follow_and_preserves_version() {
    let mut a = AtlasApplication::new().unwrap();
    let c = new_road(&mut a, true);
    let r = kind(&c, "road")[0].clone();
    let obstacle = commit(
        &mut a,
        json!({"type":"createHouse","parcelId":null,"transform":{"x":140,"y":170,"angle":0},"width":2,"depth":2}),
    );
    let before = objects(&mut a);
    let status = json!(a.status());
    let action = moved(&r, 100.0);
    let invalid = edit(&mut a, "preview", action.clone());
    assert_eq!(invalid["valid"], false);
    assert_eq!(invalid["issues"][0]["code"], "collision");
    assert!(invalid["issues"][0]["objectIds"]
        .as_array()
        .unwrap()
        .contains(&obstacle["objects"][0]["id"]));
    assert_eq!(invalid["proposedObjects"].as_array().unwrap().len(), 17);
    assert!(a
        .request("commit", json!({"version":a.status(),"intent":action}))
        .is_err());
    assert_eq!(json!(a.status()), status);
    assert_eq!(objects(&mut a), before);
}
#[test]
fn empty_population_markers_recipe_updates_and_deletions_never_refill() {
    let mut a = AtlasApplication::new().unwrap();
    let c = new_road(&mut a, true);
    let r = kind(&c, "road")[0].clone();
    let h = kind(&c, "house")[0].clone();
    commit(
        &mut a,
        json!({"type":"delete","id":h["placement"]["parcelId"]}),
    );
    let mut s = settings();
    s["seed"] = json!(99);
    let update = commit(
        &mut a,
        json!({"type":"populate","roadId":r["id"],"settings":s}),
    );
    assert_eq!(update["changed"], true);
    assert!(kind(&update, "house").is_empty());
    assert!(kind(&update, "parcel").is_empty());
    let before = a.status().revision;
    assert_eq!(
        commit(
            &mut a,
            json!({"type":"populate","roadId":r["id"],"settings":s})
        )["changed"],
        false
    );
    assert_eq!(a.status().revision, before);
    assert_eq!(objects(&mut a).len(), 15);
}
#[test]
fn extending_with_population_only_marks_new_sections_and_preserves_old_open_sides() {
    let mut a = AtlasApplication::new().unwrap();
    let c = new_road(&mut a, false);
    let r = kind(&c, "road")[0].clone();
    let e = commit(
        &mut a,
        json!({"type":"extendRoad","roadId":r["id"],"end":"start","nodes":[{"point":[-160,0],"incoming":null,"outgoing":null}],"endpointHandle":null,"population":settings()}),
    );
    let next = kind(&e, "road")[0].clone();
    assert_eq!(next["sections"][0]["populatedSides"], json!([]));
    assert_eq!(
        next["sections"][1]["populatedSides"],
        json!(["left", "right"])
    );
    for p in kind(&e, "parcel") {
        assert_ne!(p["source"]["sectionId"], r["sections"][0]["id"]);
    }
    let filled = commit(
        &mut a,
        json!({"type":"populate","roadId":r["id"],"settings":settings()}),
    );
    for p in kind(&filled, "parcel") {
        assert_eq!(p["source"]["sectionId"], r["sections"][0]["id"]);
    }
}
#[test]
fn persisted_endpoint_handle_node_and_section_identity_survive_save_reopen_and_more_topology() {
    let mut a = AtlasApplication::new().unwrap();
    let c = new_road(&mut a, true);
    let r = kind(&c, "road")[0].clone();
    let extended = commit(
        &mut a,
        json!({"type":"extendRoad","roadId":r["id"],"end":"end","nodes":[{"point":[320,0],"incoming":[300,0],"outgoing":null}],"endpointHandle":[180,0],"population":settings()}),
    );
    let expected = objects(&mut a);
    let persisted = kind(&extended, "road")[0].clone();
    assert_eq!(persisted["nodes"][1]["outgoing"], json!([180.0, 0.0]));
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("p3-topology.saltatlas");
    a.save(&path).unwrap();
    let mut b = AtlasApplication::new().unwrap();
    b.open(&path).unwrap();
    assert_same_objects(objects(&mut b), expected);
    let split = commit(
        &mut b,
        json!({"type":"insertRoadNode","roadId":r["id"],"afterNodeId":persisted["nodes"][1]["id"],"t":0.25}),
    );
    let next = kind(&split, "road")[0].clone();
    assert_eq!(next["edgeSections"][1], persisted["edgeSections"][1]);
    assert_eq!(next["edgeSections"][2], persisted["edgeSections"][1]);
    assert!(!persisted["nodes"]
        .as_array()
        .unwrap()
        .iter()
        .any(|n| n["id"] == next["nodes"][2]["id"]));
}

#[test]
fn curved_parcel_authorship_follow_history_file_detach_and_cascade_form_one_lifecycle() {
    let mut a = AtlasApplication::new().unwrap();
    let mut population = settings();
    population["side"] = json!("right");
    population["gap"] = json!(60);
    population["parcelDepth"] = json!(100);
    let created = commit(
        &mut a,
        json!({"type":"createRoad","road":{"name":"Curved lifecycle","width":10,"material":"earth","nodes":[{"point":[0,0],"outgoing":[80,0],"incoming":null},{"point":[240,30],"incoming":[160,30],"outgoing":null}]},"population":population}),
    );
    let road = kind(&created, "road")[0].clone();
    let house = kind(&created, "house")[0].clone();
    let parcel = kind(&created, "parcel")
        .into_iter()
        .find(|p| p["id"] == house["placement"]["parcelId"])
        .unwrap();
    assert!(road["path"].as_array().unwrap().len() > 2);
    assert!(kind(&created, "parcel").len() > 1);
    let angle = parcel["frame"]["angle"].as_f64().unwrap();
    let transform = |quarter_turns: u8| json!({"x":parcel["frame"]["x"].as_f64().unwrap()-25.0*angle.sin(),"y":parcel["frame"]["y"].as_f64().unwrap()+25.0*angle.cos(),"angle":angle+f64::from(quarter_turns)*std::f64::consts::FRAC_PI_2});
    // Author a cell translation first, then a quarter turn around the grid origin.
    commit(
        &mut a,
        json!({"type":"transformHouse","id":house["id"],"transform":transform(0)}),
    );
    commit(
        &mut a,
        json!({"type":"transformHouse","id":house["id"],"transform":transform(1)}),
    );
    room(&mut a, &house, 0, json!([[0, 6], [1, 6]]));
    room(&mut a, &house, -1, json!([[0, -2], [1, -2]]));
    commit(
        &mut a,
        json!({"type":"room","buildingId":house["id"],"intent":{"kind":"rename","roomId":"room-0","name":"Kept authorship"}}),
    );
    let local_content = |app: &mut AtlasApplication| {
        [-1, 0].map(|floor| {
            let detail = app.request("detail", json!({"buildingId":house["id"],"floor":floor,"bounds":[-50,-50,50,50]})).unwrap();
            json!({"rooms":detail["rooms"],"connections":detail["connections"],"cells":detail["cells"],"lower":detail["lower"]})
        })
    };
    let authored = local_content(&mut a);
    assert_eq!(authored[1]["rooms"].as_array().unwrap().len(), 3);
    assert!(!authored[0]["cells"].as_array().unwrap().is_empty());
    assert!(!authored[1]["connections"].as_array().unwrap().is_empty());
    let before = objects(&mut a);
    let mut changed_road = road.clone();
    changed_road["width"] = json!(12);
    for node in changed_road["nodes"].as_array_mut().unwrap() {
        for field in ["point", "incoming", "outgoing"] {
            if let Some(point) = node[field].as_array_mut() {
                point[0] = json!(point[0].as_f64().unwrap() + 20.0);
                point[1] = json!(point[1].as_f64().unwrap() + 100.0);
            }
        }
    }
    let follow = commit(&mut a, update_road(&changed_road));
    let followed = kind(&follow, "house")
        .into_iter()
        .find(|h| h["id"] == house["id"])
        .unwrap();
    assert_eq!(
        followed["placement"],
        json!({"kind":"parcel","parcelId":parcel["id"],"gridPose":{"xCells":0,"yCells":5,"quarterTurns":1}})
    );
    assert_ne!(followed["transform"], house["transform"]);
    assert_eq!(local_content(&mut a), authored);
    assert_eq!(follow["status"]["changes"]["interiors"], json!([]));
    let after = objects(&mut a);
    history(&mut a, false);
    assert_eq!(objects(&mut a), before);
    assert_eq!(local_content(&mut a), authored);
    history(&mut a, true);
    assert_eq!(objects(&mut a), after);
    assert_eq!(local_content(&mut a), authored);

    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("curved-authored-lifecycle.saltatlas");
    a.save(&path).unwrap();
    let mut reopened = AtlasApplication::new().unwrap();
    reopened.open(&path).unwrap();
    assert_same_objects(objects(&mut reopened), after.clone());
    assert_eq!(local_content(&mut reopened), authored);
    assert!(!reopened.status().can_undo);
    let detached = commit(
        &mut reopened,
        json!({"type":"detachParcel","id":parcel["id"]}),
    );
    let frozen = kind(&detached, "parcel")[0].clone();
    assert_eq!(frozen["source"], json!({"kind":"detached"}));
    history(&mut reopened, false);
    assert_same_objects(objects(&mut reopened), after.clone());
    history(&mut reopened, true);
    let delete_intent = json!({"type":"delete","id":road["id"]});
    let preview = edit(&mut reopened, "preview", delete_intent.clone());
    assert_eq!(preview["cascadeCounts"]["roads"], 1);
    assert_eq!(
        preview["cascadeCounts"]["parcels"].as_u64().unwrap() as usize,
        kind(&created, "parcel").len() - 1
    );
    let deletion = commit(&mut reopened, delete_intent);
    assert_eq!(deletion["deletedIds"], preview["deletedIds"]);
    let remaining = objects(&mut reopened);
    assert_eq!(remaining.len(), 2);
    assert!(remaining.contains(&frozen));
    assert!(remaining.contains(&followed));
    assert_eq!(local_content(&mut reopened), authored);
    history(&mut reopened, false);
    history(&mut reopened, true);
    assert_eq!(objects(&mut reopened), remaining);
    reopened.save(&path).unwrap();
    a.open(&path).unwrap();
    assert_same_objects(objects(&mut a), remaining);
    assert_eq!(local_content(&mut a), authored);
}

#[test]
fn both_sides_empty_authorship_extensions_format18_and_detached_grid_lifecycle() {
    use saltmarcher::atlas::{GridPose, QuarterTurns, Transform};
    let mut a = AtlasApplication::new().unwrap();
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("r7.saltatlas");
    let payloads = |app: &mut AtlasApplication| {
        app.save(&path).unwrap();
        let db = rusqlite::Connection::open(&path).unwrap();
        assert_eq!(
            db.query_row("PRAGMA user_version", [], |r| r.get::<_, i64>(0))
                .unwrap(),
            18
        );
        let result = db
            .prepare("SELECT building_id,payload FROM house_cells ORDER BY building_id")
            .unwrap()
            .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))
            .unwrap()
            .collect::<std::result::Result<Vec<_>, _>>()
            .unwrap();
        result
    };
    let mut population = settings();
    population["gap"] = json!(60);
    population["parcelDepth"] = json!(100);
    let intent = json!({"type":"createRoad","road":{"name":"R7 curved chain","width":10,"material":"earth","nodes":[{"point":[0,0],"incoming":null,"outgoing":[80,0]},{"point":[240,30],"incoming":[160,30],"outgoing":null}]},"population":population});
    let preview = edit(&mut a, "preview", intent.clone());
    assert_eq!(preview["valid"], true);
    let created = commit(&mut a, intent);
    assert_eq!(created["objects"], preview["objects"]);
    assert_eq!(created["generationSummary"], preview["generationSummary"]);
    for side in ["left", "right"] {
        let parcels: Vec<_> = kind(&created, "parcel")
            .into_iter()
            .filter(|p| p["source"]["side"] == side)
            .collect();
        assert!(!parcels.is_empty());
        assert!(parcels.iter().all(|p| kind(&created, "house")
            .iter()
            .any(|h| h["placement"]["parcelId"] == p["id"])));
    }
    let mut road = kind(&created, "road")[0].clone();
    let old_house = kind(&created, "house")[0].clone();
    let parcel = kind(&created, "parcel")
        .into_iter()
        .find(|p| p["id"] == old_house["placement"]["parcelId"])
        .unwrap();
    commit(&mut a, json!({"type":"delete","id":old_house["id"]}));
    let empty = a.request("scene", json!({"bounds":[-10000,-10000,10000,10000],"context":{"kind":"parcel","parcelId":parcel["id"]}})).unwrap();
    assert_eq!(empty["contextState"]["houseId"], Value::Null);
    let first =
        json!({"type":"createParcelHouse","parcelId":parcel["id"],"floor":0,"cells":[[0,2]]});
    let p = edit(&mut a, "preview", first.clone());
    let rebuilt = commit(&mut a, first);
    assert_eq!(p["objects"], rebuilt["objects"]);
    let house = kind(&rebuilt, "house")[0].clone();
    assert_ne!(house["id"], old_house["id"]);
    room(&mut a, &house, 0, json!([[1, 5]]));
    room(&mut a, &house, -1, json!([[1, 3]]));
    let frame: Transform = serde_json::from_value(parcel["frame"].clone()).unwrap();
    let pose = GridPose {
        x_cells: 1,
        y_cells: 5,
        quarter_turns: QuarterTurns(1),
    };
    let transform =
        saltmarcher::atlas::parcel_geometry::parcel_house_transform(&frame, &pose).unwrap();
    commit(
        &mut a,
        json!({"type":"transformHouse","id":house["id"],"transform":transform}),
    );
    let authored_payloads = payloads(&mut a);
    let metadata = a
        .request("interiorMetadata", json!({"buildingId":house["id"]}))
        .unwrap();
    let floors: Vec<_> = metadata["rooms"]
        .as_array()
        .unwrap()
        .iter()
        .map(|r| r["floor"].as_i64().unwrap())
        .collect();
    assert_eq!(floors.iter().filter(|&&f| f == 0).count(), 2);
    assert_eq!(floors.iter().filter(|&&f| f == -1).count(), 1);
    let before = objects(&mut a);
    road["width"] = json!(12);
    for node in road["nodes"].as_array_mut().unwrap() {
        for field in ["point", "incoming", "outgoing"] {
            if let Some(p) = node[field].as_array_mut() {
                p[0] = json!(p[0].as_f64().unwrap() + 20.0);
                p[1] = json!(p[1].as_f64().unwrap() + 100.0);
            }
        }
    }
    commit(&mut a, update_road(&road));
    let after = objects(&mut a);
    for h in before.iter().filter(|o| o["kind"] == "house") {
        let current = after.iter().find(|o| o["id"] == h["id"]).unwrap();
        assert_eq!(current["placement"], h["placement"]);
    }
    assert_eq!(payloads(&mut a), authored_payloads);
    history(&mut a, false);
    assert_same_objects(objects(&mut a), before);
    history(&mut a, true);
    assert_same_objects(objects(&mut a), after);
    for (end, point) in [("start", json!([-140, 100])), ("end", json!([420, 130]))] {
        let before = objects(&mut a);
        let old_road = road.clone();
        let result = commit(
            &mut a,
            json!({"type":"extendRoad","roadId":road["id"],"end":end,"nodes":[{"point":point,"incoming":null,"outgoing":null}],"endpointHandle":null,"population":population}),
        );
        road = kind(&result, "road")[0].clone();
        assert_eq!(
            road["nodes"].as_array().unwrap().len(),
            old_road["nodes"].as_array().unwrap().len() + 1
        );
        for field in ["nodes", "sections"] {
            assert!(old_road[field]
                .as_array()
                .unwrap()
                .iter()
                .all(|item| road[field].as_array().unwrap().contains(item)));
        }
        let after = objects(&mut a);
        for old in before.iter().filter(|o| o["kind"] != "road") {
            assert!(after.contains(old));
        }
        for payload in &authored_payloads {
            assert!(payloads(&mut a).contains(payload));
        }
    }
    let extended = objects(&mut a);
    let extended_payloads = payloads(&mut a);
    let mut reopened = AtlasApplication::new().unwrap();
    reopened.open(&path).unwrap();
    assert_same_objects(objects(&mut reopened), extended);
    assert_eq!(payloads(&mut reopened), extended_payloads);
    assert!(!reopened.status().can_undo);
    commit(
        &mut reopened,
        json!({"type":"detachParcel","id":parcel["id"]}),
    );
    let detached = objects(&mut reopened)
        .into_iter()
        .find(|o| o["id"] == parcel["id"])
        .unwrap();
    let frame: Transform = serde_json::from_value(detached["frame"].clone()).unwrap();
    let next_pose = GridPose {
        x_cells: 2,
        y_cells: 8,
        quarter_turns: QuarterTurns(2),
    };
    let transform =
        saltmarcher::atlas::parcel_geometry::parcel_house_transform(&frame, &next_pose).unwrap();
    commit(
        &mut reopened,
        json!({"type":"transformHouse","id":house["id"],"transform":transform}),
    );
    assert_eq!(payloads(&mut reopened), extended_payloads);
    let invalid = json!({"type":"transformHouse","id":house["id"],"transform":{"x":transform.x+2.5*frame.angle.cos(),"y":transform.y+2.5*frame.angle.sin(),"angle":transform.angle}});
    assert_eq!(
        edit(&mut reopened, "preview", invalid)["issues"][0]["code"],
        "gridAlignment"
    );
    let delete = json!({"type":"delete","id":road["id"]});
    let preview = edit(&mut reopened, "preview", delete.clone());
    let result = commit(&mut reopened, delete);
    assert_eq!(result["deletedIds"], preview["deletedIds"]);
    assert_eq!(result["cascadeCounts"], preview["cascadeCounts"]);
    let remaining = objects(&mut reopened);
    assert_eq!(remaining.len(), 2);
    assert!(remaining.contains(&detached));
    assert_eq!(
        remaining.iter().find(|o| o["kind"] == "house").unwrap()["placement"]["gridPose"],
        json!(next_pose)
    );
    history(&mut reopened, false);
    history(&mut reopened, true);
    assert_same_objects(objects(&mut reopened), remaining.clone());
    let remaining_payloads = payloads(&mut reopened);
    assert_eq!(remaining_payloads.len(), 1);
    assert!(authored_payloads.contains(&remaining_payloads[0]));
    a.open(&path).unwrap();
    assert_same_objects(objects(&mut a), remaining);
    assert_eq!(payloads(&mut a), remaining_payloads);
}
