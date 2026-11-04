#[path = "../src/atlas/test_inputs.rs"]
mod test_inputs;
use saltmarcher::atlas::AtlasApplication;
use serde_json::{json, Value};
use test_inputs::update_road;
fn commit(a: &mut AtlasApplication, i: Value) -> Value {
    a.request("commit", json!({"version":a.status(),"intent":i}))
        .unwrap()
}
fn preview(a: &mut AtlasApplication, i: Value) -> Value {
    a.request("preview", json!({"version":a.status(),"intent":i}))
        .unwrap()
}
fn scene(a: &mut AtlasApplication) -> Value {
    a.request(
        "scene",
        json!({"context":{"kind":"exterior"},"bounds":[-10000,-10000,10000,10000]}),
    )
    .unwrap()
}
fn assert_same_objects(actual: &Value, expected: &Value) {
    let by_id = |values: &Value| {
        let mut values = values.as_array().unwrap().clone();
        values.sort_by_key(|v| v["id"].as_str().unwrap().to_owned());
        values
    };
    assert_eq!(by_id(actual), by_id(expected));
}
fn house(x: f64, y: f64, angle: f64) -> Value {
    json!({"type":"createHouse","parcelId":null,"transform":{"x":x,"y":y,"angle":angle},"width":4,"depth":5})
}
fn road(points: Vec<[f64; 2]>) -> Value {
    json!({"type":"createRoad","road":{"name":"Dorfstraße","width":15,"material":"earth","nodes":points.into_iter().map(|point|json!({"point":point,"incoming":null,"outgoing":null})).collect::<Vec<_>>()},"population":null})
}
fn populate(id: &str) -> Value {
    json!({"type":"populate","roadId":id,"settings":{"side":"both","setback":5,"gap":10,"minWidth":4,"maxWidth":7,"minDepth":4,"maxDepth":8,"seed":42,"parcelDepth":null}})
}
#[test]
fn continuous_roads_population_exact_history_and_file() {
    let mut a = AtlasApplication::new().unwrap();
    let r = commit(&mut a, road(vec![[0.3, 0.7], [500.3, 0.7]]));
    let id = r["objects"][0]["id"].as_str().unwrap();
    let intent = populate(id);
    let p = preview(&mut a, intent.clone());
    assert!(p["valid"].as_bool().unwrap());
    assert!(p["objects"].as_array().unwrap().len() > 10);
    assert_eq!(p["objects"], preview(&mut a, intent.clone())["objects"]);
    let c = commit(&mut a, intent);
    assert_eq!(p["objects"], c["objects"]);
    let expected = scene(&mut a);
    a.request("history", json!({"version":a.status(),"redo":false}))
        .unwrap();
    assert_eq!(scene(&mut a)["objects"].as_array().unwrap().len(), 1);
    a.request("history", json!({"version":a.status(),"redo":true}))
        .unwrap();
    assert_eq!(scene(&mut a)["objects"], expected["objects"]);
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("village.saltatlas");
    a.save(&path).unwrap();
    let mut b = AtlasApplication::new().unwrap();
    b.open(&path).unwrap();
    assert_same_objects(&scene(&mut b)["objects"], &expected["objects"]);
    assert!(!b.status().dirty);
}
#[test]
fn seeded_population_reuses_accepted_geometry_for_collisions_and_exact_commit() {
    let mut a = AtlasApplication::new().unwrap();
    let r = commit(
        &mut a,
        road(vec![[0., 0.], [300., 0.], [300., 60.], [0., 60.]]),
    );
    let id = r["objects"][0]["id"].as_str().unwrap();
    let obstacle = commit(
        &mut a,
        json!({"type":"createArea","area":{"material":"water","points":[[100,15],[145,15],[145,35],[100,35]]}}),
    );
    let obstacle_id = obstacle["objects"][0]["id"].as_str().unwrap();
    let mut intent = populate(id);
    intent["settings"]["minDepth"] = json!(4);
    intent["settings"]["maxDepth"] = json!(4);
    let first = preview(&mut a, intent.clone());
    let second = preview(&mut a, intent.clone());
    assert_eq!(first["objects"], second["objects"]);
    assert_eq!(
        first["generationDiagnostics"],
        second["generationDiagnostics"]
    );
    let mut other_seed = intent.clone();
    other_seed["settings"]["seed"] = json!(43);
    assert_ne!(first["objects"], preview(&mut a, other_seed)["objects"]);
    let skipped = first["generationDiagnostics"].as_array().unwrap();
    assert!(
        skipped.iter().any(|s| s["obstacleIds"]
            .as_array()
            .is_some_and(|ids| ids.contains(&json!(obstacle_id)))),
        "{skipped:?}"
    );
    assert!(
        skipped.iter().any(|s| s["code"] == "parcelCollision"),
        "{skipped:?}"
    );
    assert!(first["objects"].as_array().unwrap().len() > 4);
    let result = commit(&mut a, intent);
    assert_eq!(first["objects"], result["objects"]);
    assert_eq!(
        first["generationDiagnostics"],
        result["generationDiagnostics"]
    );
    let persisted = scene(&mut a);
    for house in result["objects"].as_array().unwrap() {
        assert!(persisted["objects"].as_array().unwrap().contains(house));
    }
}
#[test]
fn conflicts_water_roads_rotations_and_stale_previews() {
    let mut a = AtlasApplication::new().unwrap();
    commit(&mut a, house(0.0, 0.0, 0.0));
    assert_eq!(preview(&mut a, house(0.0, 0.0, 0.0))["valid"], false);
    assert_eq!(preview(&mut a, house(20.0, 0.0, 0.0))["valid"], true);
    assert_eq!(
        preview(&mut a, road(vec![[-10., 10.], [100., 10.]]))["valid"],
        false
    );
    let water = json!({"type":"createArea","area":{"material":"water","points":[[100,100],[200,100],[200,200],[100,200]]}});
    commit(&mut a, water);
    assert_eq!(preview(&mut a, house(120., 120., 0.3))["valid"], false);
    assert_eq!(
        preview(&mut a, road(vec![[90., 150.], [210., 150.]]))["valid"],
        false
    );
    let p = preview(&mut a, house(300., 0., 0.0));
    commit(&mut a, house(400., 0., 0.0));
    assert!(a
        .request(
            "commit",
            json!({"version":p["version"],"intent":house(300.,0.,0.0)})
        )
        .is_err());
}
#[test]
fn road_changes_follow_parcels_and_delete_cascades_except_detached() {
    let mut a = AtlasApplication::new().unwrap();
    let r = commit(&mut a, road(vec![[0., 0.], [200., 0.]]));
    let id = r["objects"][0]["id"].as_str().unwrap().to_owned();
    let populated = commit(&mut a, populate(&id));
    let p = populated["objects"]
        .as_array()
        .unwrap()
        .iter()
        .find(|o| o["kind"] == "parcel")
        .unwrap()["id"]
        .clone();
    let mut moved = r["objects"][0].clone();
    for n in moved["nodes"].as_array_mut().unwrap() {
        n["point"][1] = json!(100);
    }
    assert_eq!(commit(&mut a, update_road(&moved))["valid"], true);
    commit(&mut a, json!({"type":"detachParcel","id":p}));
    let deleted = commit(&mut a, json!({"type":"delete","id":id}));
    assert_eq!(deleted["cascadeCounts"]["roads"], 1);
    let remaining = scene(&mut a)["objects"].as_array().unwrap().clone();
    assert_eq!(remaining.len(), 2);
    assert!(remaining
        .iter()
        .any(|o| o["id"] == p && o["source"]["kind"] == "detached"));
    assert!(remaining
        .iter()
        .any(|o| o["kind"] == "house" && o["placement"]["parcelId"] == p));
}

#[test]
fn cell_contours_preserve_holes_and_basements_are_not_roofs() {
    let mut a = AtlasApplication::new().unwrap();
    let id = commit(&mut a, house(0., 0., 0.))["objects"][0]["id"]
        .as_str()
        .unwrap()
        .to_owned();
    commit(
        &mut a,
        json!({"type":"room","buildingId":id,"intent":{"kind":"erase","floor":0,"cells":[[1,1],[2,1],[1,2],[2,2]]}}),
    );
    assert_eq!(
        scene(&mut a)["objects"][0]["contours"]
            .as_array()
            .unwrap()
            .len(),
        2
    );
    let before = scene(&mut a)["objects"][0]["contours"].clone();
    commit(
        &mut a,
        json!({"type":"room","buildingId":id,"intent":{"kind":"draw","floor":-1,"cells":[[20,20],[21,20]]}}),
    );
    assert_eq!(scene(&mut a)["objects"][0]["contours"], before);
}

#[test]
fn spatial_reads_history_branch_and_corrupt_files() {
    let mut a = AtlasApplication::new().unwrap();
    let h = commit(&mut a, house(0., 0., 0.));
    let id = h["objects"][0]["id"].as_str().unwrap().to_owned();
    commit(&mut a, house(1000., 1000., 0.));
    let small = a
        .request(
            "scene",
            json!({"context":{"kind":"exterior"},"bounds":[-1,-1,40,40]}),
        )
        .unwrap();
    assert_eq!(small["objects"].as_array().unwrap().len(), 1);
    assert!(small["objects"][0].get("cells").is_none());
    commit(&mut a, json!({"type":"rename","id":id,"name":"Gasthaus"}));
    a.request("history", json!({"version":a.status(),"redo":false}))
        .unwrap();
    commit(&mut a, json!({"type":"roof","id":id,"roof":"#123456"}));
    assert!(!a.status().can_redo);
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("village.saltatlas");
    a.save(&path).unwrap();
    let original = a.status().session_id;
    let db = rusqlite::Connection::open(&path).unwrap();
    db.execute(
        "UPDATE house_cells SET payload=json_set(payload,'$[0].roomId','room-99999')",
        [],
    )
    .unwrap();
    drop(db);
    assert!(a.open(&path).is_err());
    assert_eq!(a.status().session_id, original);
    a.save(&path).unwrap();
    let db = rusqlite::Connection::open(&path).unwrap();
    db.execute("CREATE TABLE spatial(extra TEXT)", []).unwrap();
    drop(db);
    assert!(a.open(&path).is_err());
    assert_eq!(a.status().session_id, original);
}

#[test]
fn transactional_open_preserves_live_document_on_late_corruption_and_collision() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("candidate.saltatlas");
    let mut source = AtlasApplication::new().unwrap();
    commit(&mut source, house(0., 0., 0.));
    commit(&mut source, house(100., 0., 0.));
    source.save(&path).unwrap();
    let pristine = std::fs::read(&path).unwrap();

    let mut live = AtlasApplication::new().unwrap();
    let live_id = commit(&mut live, house(500., 500., 0.))["objects"][0]["id"]
        .as_str()
        .unwrap()
        .to_owned();
    commit(
        &mut live,
        json!({"type":"rename","id":live_id,"name":"Live"}),
    );
    let status = json!(live.status());
    let objects = scene(&mut live)["objects"].clone();
    for sql in [
        "UPDATE objects SET body=json_remove(body,'$.rooms') WHERE id=(SELECT max(id) FROM objects)",
        "UPDATE house_cells SET payload=json_set(payload,'$[0].roomId','room-99999') WHERE building_id=(SELECT max(id) FROM objects)",
        "INSERT INTO house_cells VALUES('house-9999','[]')",
        "UPDATE objects SET body='{}' WHERE id=(SELECT max(id) FROM objects)",
    ] {
        std::fs::write(&path, &pristine).unwrap();
        let db = rusqlite::Connection::open(&path).unwrap();
        db.execute(sql, []).unwrap();
        drop(db);
        assert!(live.open(&path).is_err(), "accepted corruption: {sql}");
        assert_eq!(json!(live.status()), status);
        assert_eq!(scene(&mut live)["objects"], objects);
    }
    // Append a fully valid object that overlaps the first candidate. Its IDs,
    // derived fields and cell index remain valid, so collision is the failure.
    let other_path = dir.path().join("overlap.saltatlas");
    let mut other = AtlasApplication::new().unwrap();
    commit(&mut other, house(200., 0., 0.));
    commit(&mut other, house(0., 0., 0.));
    other.save(&other_path).unwrap();
    std::fs::write(&path, &pristine).unwrap();
    let db = rusqlite::Connection::open(&path).unwrap();
    db.execute("PRAGMA foreign_keys=ON", []).unwrap();
    db.execute_batch(
        "DELETE FROM house_cells WHERE building_id=(SELECT max(id) FROM objects); DELETE FROM objects WHERE id=(SELECT max(id) FROM objects)",
    )
    .unwrap();
    db.execute("ATTACH DATABASE ? AS other", [other_path.to_str().unwrap()])
        .unwrap();
    db.execute("INSERT INTO objects SELECT * FROM other.objects WHERE id=(SELECT max(id) FROM other.objects)", []).unwrap();
    db.execute("INSERT INTO house_cells SELECT * FROM other.house_cells WHERE building_id=(SELECT id FROM other.objects ORDER BY id DESC LIMIT 1)", []).unwrap();
    drop(db);
    assert!(live
        .open(&path)
        .unwrap_err()
        .message
        .contains("Überschneidung"));
    assert_eq!(json!(live.status()), status);
    assert_eq!(scene(&mut live)["objects"], objects);
    live.request("history", json!({"version":live.status(),"redo":false}))
        .unwrap();
    assert_ne!(scene(&mut live)["objects"], objects);
}

#[test]
fn transactional_open_large_house_preserves_content() {
    let mut original = AtlasApplication::new().unwrap();
    let id = commit(
        &mut original,
        json!({"type":"createHouse","parcelId":null,"transform":{"x":0,"y":0,"angle":0},"width":128,"depth":128}),
    )["objects"][0]["id"]
        .as_str()
        .unwrap()
        .to_owned();
    let expected = original
        .request(
            "detail",
            json!({"buildingId":id,"floor":0,"bounds":[0,0,127,127]}),
        )
        .unwrap();
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("large.saltatlas");
    original.save(&path).unwrap();
    let mut opened = AtlasApplication::new().unwrap();
    opened.open(&path).unwrap();
    let actual = opened
        .request(
            "detail",
            json!({"buildingId":id,"floor":0,"bounds":[0,0,127,127]}),
        )
        .unwrap();
    assert_eq!(actual["cells"], expected["cells"]);
    assert_eq!(actual["rooms"], expected["rooms"]);
    assert_eq!(
        scene(&mut opened)["objects"],
        scene(&mut original)["objects"]
    );
}
#[test]
fn population_limits_and_empty_actions() {
    let mut a = AtlasApplication::new().unwrap();
    let r = commit(&mut a, road(vec![[0., 0.], [10000., 0.]]));
    let id = r["objects"][0]["id"].as_str().unwrap();
    let p = preview(&mut a, populate(id));
    assert_eq!(
        p["objects"]
            .as_array()
            .unwrap()
            .iter()
            .filter(|o| o["kind"] == "house")
            .count(),
        200
    );
    assert_eq!(p["generationSummary"]["limited"], true);
    let r = commit(&mut a, road(vec![[0., 100.], [5., 100.]]));
    let id = r["objects"][0]["id"].as_str().unwrap();
    let version = a.status().revision;
    let p = commit(&mut a, populate(id));
    assert_eq!(p["changed"], true); // Recipe and begun empty sides are persisted.
    assert_eq!(a.status().revision, version + 1);
    assert_eq!(commit(&mut a, populate(id))["changed"], false);
    assert_eq!(a.status().revision, version + 1);
}
#[test]
fn terrain_order_and_indices_survive_delete_undo() {
    let mut a = AtlasApplication::new().unwrap();
    let polygon = json!([[0, 0], [100, 0], [100, 100], [0, 100]]);
    let first = commit(
        &mut a,
        json!({"type":"createArea","area":{"material":"earth","points":polygon}}),
    );
    let id = first["objects"][0]["id"].as_str().unwrap();
    let order = first["objects"][0]["order"].as_u64().unwrap();
    let second = commit(
        &mut a,
        json!({"type":"createArea","area":{"material":"stone","points":polygon}}),
    );
    assert!(second["objects"][0]["order"].as_u64().unwrap() > order);
    commit(&mut a, json!({"type":"delete","id":id}));
    a.request("history", json!({"version":a.status(),"redo":false}))
        .unwrap();
    let objects = scene(&mut a);
    let restored = objects["objects"]
        .as_array()
        .unwrap()
        .iter()
        .find(|o| o["id"] == id)
        .unwrap();
    assert_eq!(restored["order"], order);
}

#[test]
fn collinear_containment_conflicts_in_both_creation_orders() {
    let water = json!({"type":"createArea","area":{"material":"water","points":[[0,0],[200,0],[200,25],[0,25]]}});
    for water_first in [true, false] {
        let mut a = AtlasApplication::new().unwrap();
        if water_first {
            commit(&mut a, water.clone());
            assert_eq!(preview(&mut a, house(10., 0., 0.))["valid"], false);
            assert_eq!(preview(&mut a, house(10., 25., 0.))["valid"], true);
        } else {
            commit(&mut a, house(10., 0., 0.));
            assert_eq!(preview(&mut a, water.clone())["valid"], false);
        }
    }
    let mut a = AtlasApplication::new().unwrap();
    commit(&mut a, house(10., 0., 0.));
    assert_eq!(
        preview(
            &mut a,
            json!({"type":"createHouse","parcelId":null,"transform":{"x":0.,"y":0.,"angle":0.},"width":40,"depth":5})
        )["valid"],
        false
    );
}

#[test]
fn generated_doors_are_centered_on_both_road_sides_for_even_and_odd_widths() {
    for width in [4, 5, 6, 7] {
        let mut a = AtlasApplication::new().unwrap();
        let r = commit(&mut a, road(vec![[0., 0.], [300., 0.]]));
        let id = r["objects"][0]["id"].as_str().unwrap();
        let mut intent = populate(id);
        intent["settings"]["minWidth"] = json!(width);
        intent["settings"]["maxWidth"] = json!(width);
        let p = preview(&mut a, intent.clone());
        let accepted = commit(&mut a, intent);
        assert_eq!(p["objects"], accepted["objects"]);
        let mut sides = [false; 2];
        for h in accepted["objects"]
            .as_array()
            .unwrap()
            .iter()
            .filter(|o| o["kind"] == "house")
        {
            let d = a
                .request(
                    "detail",
                    json!({"buildingId":h["id"],"floor":0,"bounds":[-1,-1,10,10]}),
                )
                .unwrap();
            let doors = d["connections"].as_array().unwrap();
            assert_eq!(doors.len(), 1);
            let door = &doors[0];
            let center = door["x"].as_f64().unwrap() + door["offset"].as_f64().unwrap() + 0.5;
            assert_eq!(center, width as f64 / 2.);
            assert_eq!(door["y"], 0);
            let t = &h["transform"];
            let angle = t["angle"].as_f64().unwrap();
            let front_y = t["y"].as_f64().unwrap() + 5. * center * angle.sin();
            assert!((front_y.abs() - 12.5).abs() < 1e-9);
            sides[usize::from(front_y > 0.)] = true;
        }
        assert_eq!(sides, [true, true]);
    }
}

#[test]
fn shifted_opening_moves_validates_full_span_and_survives_history_and_file() {
    let mut a = AtlasApplication::new().unwrap();
    let id = commit(&mut a, house(0., 0., 0.4))["objects"][0]["id"].clone();
    let read = |a: &mut AtlasApplication| {
        a.request(
            "detail",
            json!({"buildingId":id,"floor":0,"bounds":[-20,-20,30,30]}),
        )
        .unwrap()
    };
    let original = read(&mut a)["connections"][0].clone();
    assert_eq!(original["offset"], 0.5);
    let duplicate = preview(
        &mut a,
        json!({"type":"connection","buildingId":id,"intent":{"action":"createOpening","floor":0,"x":2,"y":0,"axis":"horizontal","kind":"door"}}),
    );
    assert_eq!(duplicate["valid"], false);
    commit(
        &mut a,
        json!({"type":"room","buildingId":id,"intent":{"kind":"move","roomId":"room-0","dx":3,"dy":-2}}),
    );
    let moved = read(&mut a)["connections"][0].clone();
    assert_eq!(moved["x"], 4);
    assert_eq!(moved["y"], -2);
    assert_eq!(moved["offset"], 0.5);
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("centered.saltatlas");
    a.save(&path).unwrap();
    let mut reopened = AtlasApplication::new().unwrap();
    reopened.open(&path).unwrap();
    assert_eq!(read(&mut reopened)["connections"][0], moved);
    let db = rusqlite::Connection::open(&path).unwrap();
    db.execute(
        "UPDATE objects SET body=json_set(body,'$.connections[0].offset',0.25) WHERE kind='house'",
        [],
    )
    .unwrap();
    drop(db);
    assert!(reopened
        .open(&path)
        .unwrap_err()
        .message
        .contains("Öffnungsversatz"));
    assert_eq!(read(&mut reopened)["connections"][0], moved);
    // Only the second supporting edge is removed. The integer anchor remains valid.
    let erase =
        json!({"type":"room","buildingId":id,"intent":{"kind":"erase","floor":0,"cells":[[5,-2]]}});
    let p = preview(&mut a, erase.clone());
    assert_eq!(p["removedConnections"][0]["connection"], moved);
    commit(&mut a, erase);
    assert_eq!(read(&mut a)["connections"], json!([]));
    a.request("history", json!({"version":a.status(),"redo":false}))
        .unwrap();
    assert_eq!(read(&mut a)["connections"][0], moved);
    a.request("history", json!({"version":a.status(),"redo":true}))
        .unwrap();
    assert_eq!(read(&mut a)["connections"], json!([]));
}

#[test]
fn old_format_and_invalid_payload_ownership_leave_session_intact() {
    let mut a = AtlasApplication::new().unwrap();
    commit(&mut a, house(0., 0., 0.));
    commit(&mut a, road(vec![[100., 100.], [200., 100.]]));
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("damaged.saltatlas");
    a.save(&path).unwrap();
    let original = std::fs::read(&path).unwrap();
    let status = json!(a.status());
    let before = scene(&mut a)["objects"].clone();
    for sql in [
        "PRAGMA user_version=7",
        "DELETE FROM house_cells",
        "INSERT INTO house_cells VALUES('orphan','[]')",
        "INSERT INTO house_cells SELECT id,'[]' FROM objects WHERE kind='road'",
        "UPDATE house_cells SET payload='[]'",
        "UPDATE objects SET body=json_set(body,'$.cells',json('[]')) WHERE kind='house'",
        "UPDATE objects SET body=json_remove(body,'$.connections') WHERE kind='house'",
        "UPDATE objects SET body=json_remove(body,'$.roomCounter') WHERE kind='house'",
        "UPDATE objects SET body=json_set(body,'$.contours',json('[]')) WHERE kind='house'",
        "UPDATE house_cells SET payload='null'",
        "UPDATE objects SET body=json_set(body,'$.roof','Tampered') WHERE kind='house'",
        "UPDATE objects SET body=json_set(body,'$.unexpected',true) WHERE kind='house'",
        "UPDATE objects SET body=json_set(body,'$.path',json('[]')) WHERE kind='road'",
    ] {
        std::fs::write(&path, &original).unwrap();
        let db = rusqlite::Connection::open(&path).unwrap();
        db.execute("PRAGMA foreign_keys=OFF", []).unwrap();
        db.execute(sql, []).unwrap();
        drop(db);
        assert!(a.open(&path).is_err(), "accepted {sql}");
        assert_eq!(json!(a.status()), status);
        assert_eq!(scene(&mut a)["objects"], before);
    }
}

#[test]
fn compact_history_keeps_100_actions_and_noop_preserves_redo() {
    let mut a = AtlasApplication::new().unwrap();
    let id = commit(&mut a, house(0., 0., 0.))["objects"][0]["id"]
        .as_str()
        .unwrap()
        .to_owned();
    for i in 0..101 {
        commit(
            &mut a,
            json!({"type":"rename","id":id,"name":format!("Name {i}")}),
        );
    }
    for _ in 0..100 {
        a.request("history", json!({"version":a.status(),"redo":false}))
            .unwrap();
    }
    assert!(!a.status().can_undo);
    assert!(a.status().can_redo);
    assert_eq!(scene(&mut a)["objects"][0]["name"], "Name 0");
    let version = a.status().revision;
    assert_eq!(
        commit(&mut a, json!({"type":"rename","id":id,"name":"Name 0"}))["changed"],
        false
    );
    assert_eq!(a.status().revision, version);
    assert!(a.status().can_redo);
    a.request("history", json!({"version":a.status(),"redo":true}))
        .unwrap();
    assert_eq!(scene(&mut a)["objects"][0]["name"], "Name 1");
    commit(&mut a, json!({"type":"roof","id":id,"roof":"#112233"}));
    assert!(!a.status().can_redo);
}

#[test]
fn each_small_action_round_trips_preview_history_and_file() {
    let mut a = AtlasApplication::new().unwrap();
    let id = commit(&mut a, house(0., 0., 0.))["objects"][0]["id"]
        .as_str()
        .unwrap()
        .to_owned();
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("each.saltatlas");
    let actions = [
        json!({"type":"rename","id":id,"name":"Tavern"}),
        json!({"type":"roof","id":id,"roof":"#123456"}),
        json!({"type":"room","buildingId":id,"intent":{"kind":"rename","roomId":"room-0","name":"Kitchen"}}),
        json!({"type":"transformHouse","id":id,"transform":{"x":12,"y":7,"angle":0.2}}),
    ];
    for (index, action) in actions.into_iter().enumerate() {
        let p = preview(&mut a, action.clone());
        let c = commit(&mut a, action);
        assert_eq!(p["objects"], c["objects"]);
        if index == 2 {
            assert_eq!(c["status"]["changes"]["metadata"], json!([id]));
            assert_eq!(c["status"]["changes"]["interiors"], json!([]));
            assert_eq!(c["status"]["changes"]["world"], json!([]));
        }
        let expected = scene(&mut a)["objects"].clone();
        a.request("history", json!({"version":a.status(),"redo":false}))
            .unwrap();
        a.request("history", json!({"version":a.status(),"redo":true}))
            .unwrap();
        assert_eq!(scene(&mut a)["objects"], expected);
        a.save(&path).unwrap();
        let mut reopened = AtlasApplication::new().unwrap();
        reopened.open(&path).unwrap();
        assert_eq!(scene(&mut reopened)["objects"], expected);
        let detail = |a: &mut AtlasApplication| {
            a.request(
                "detail",
                json!({"buildingId":id,"floor":0,"bounds":[-1,-1,10,10]}),
            )
            .unwrap()
        };
        let expected_detail = detail(&mut a);
        let actual = detail(&mut reopened);
        for field in ["rooms", "connections", "cells"] {
            assert_eq!(actual[field], expected_detail[field]);
        }
    }
}
