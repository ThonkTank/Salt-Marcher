use super::{
    application_test_support::{request_edit as edit, *},
    *,
};
fn input() -> Value {
    json!({"type":"createRoad","road":{"name":"Geländeweg","width":10,"material":"earth","nodes":[{"point":[-150,0],"incoming":null,"outgoing":null},{"point":[150,0],"incoming":null,"outgoing":null}]},"terrainFollow":{"tolerance":0.3},"roughness":{"amount":0.5,"seed":4,"viewScale":0.5},"population":null})
}
#[test]
fn terrain_road_preview_commit_sections_zoom_history_and_file() {
    let mut app = AtlasApplication::new().unwrap();
    edit(
        &mut app,
        "commit",
        json!({"type":"terrainStroke","brush":{"mode":"raise","radius":45,"amount":50,"strength":1,"target":10,"points":[[0,0]]}}),
    );
    let mut intent = input();
    intent["roughness"]["amount"] = json!(0);
    let preview = edit(&mut app, "preview", intent.clone());
    assert_eq!(
        preview["objects"],
        edit(&mut app, "preview", intent.clone())["objects"]
    );
    intent["roughness"]["viewScale"] = json!(0.02);
    assert_eq!(
        preview["objects"],
        edit(&mut app, "preview", intent.clone())["objects"]
    );
    let result = edit(&mut app, "commit", intent);
    assert_eq!(preview["objects"], result["objects"]);
    let road: Road = serde_json::from_value(result["objects"][0].clone()).unwrap();
    assert_eq!(road.nodes[0].point, [-150., 0.]);
    assert_eq!(road.nodes.last().unwrap().point, [150., 0.]);
    assert!(road.path.iter().any(|p| p[1].abs() > 15.));
    assert_eq!(road.sections.len(), 1);
    assert!(road
        .edge_sections
        .iter()
        .all(|id| *id == road.sections[0].id));
    history(&mut app, false);
    assert!(app.scene_header(&road.id).unwrap().is_none());
    history(&mut app, true);
    assert_eq!(app.road(&road.id).unwrap(), road);
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("terrain-road.saltatlas");
    app.save(&path).unwrap();
    app.open(&path).unwrap();
    assert_eq!(app.road(&road.id).unwrap(), road);
    // Changing terrain never replans stored roads.
    edit(
        &mut app,
        "commit",
        json!({"type":"terrainStroke","brush":{"mode":"flatten","radius":100,"amount":1,"strength":1,"target":10,"points":[[0,0]]}}),
    );
    assert_eq!(app.road(&road.id).unwrap(), road);
}
#[test]
fn terrain_road_water_polygon_roughness_and_natural_height_ignore_platforms() {
    let mut app = AtlasApplication::new().unwrap();
    edit(
        &mut app,
        "commit",
        json!({"type":"terrainStroke","brush":{"mode":"land","resolution":6,"radius":2000,"amount":1,"strength":1,"target":10,"points":[[0,0]]}}),
    );
    edit(
        &mut app,
        "commit",
        json!({"type":"createArea","area":{"material":"water","points":[[-25,-25],[25,-25],[25,25],[-25,25]]}}),
    );
    let planned = edit(&mut app, "preview", input());
    assert_eq!(planned["valid"], true, "{planned}");
    let road: Road = serde_json::from_value(planned["objects"][0].clone()).unwrap();
    assert!(road.path.iter().any(|p| p[1].abs() > 25.));
    assert!(road.path.iter().all(|p| p[1].abs() <= 90. + 1e-6));
    let mut flat = AtlasApplication::new().unwrap();
    let before = edit(&mut flat, "preview", input());
    let made = edit(
        &mut flat,
        "commit",
        json!({"type":"createHouse","parcelId":null,"transform":{"x":0,"y":50,"angle":0},"width":4,"depth":4}),
    );
    let id = made["objects"][0]["id"].as_str().unwrap();
    edit(
        &mut flat,
        "commit",
        json!({"type":"setFoundation","id":id,"foundation":{"height":100,"transition":100}}),
    );
    let after = edit(&mut flat, "preview", input());
    assert_eq!(before["objects"][0]["path"], after["objects"][0]["path"]);
}
#[test]
fn terrain_extensions_preserve_both_existing_sides_and_join_directions() {
    for end in ["start", "end"] {
        let mut app = AtlasApplication::new().unwrap();
        let mut initial = input();
        initial.as_object_mut().unwrap().remove("terrainFollow");
        initial["roughness"]["amount"] = json!(0);
        let result = edit(&mut app, "commit", initial);
        let old: Road = serde_json::from_value(result["objects"][0].clone()).unwrap();
        let (point, handle) = if end == "start" {
            ([-300., 80.], [-175., 0.])
        } else {
            ([300., 80.], [175., 0.])
        };
        let intent = json!({"type":"extendRoad","roadId":old.id,"end":end,"nodes":[{"point":point,"incoming":null,"outgoing":null}],"endpointHandle":handle,"terrainFollow":{"tolerance":0.3},"roughness":{"amount":0.5,"seed":17},"population":null});
        let preview = edit(&mut app, "preview", intent.clone());
        let result = edit(&mut app, "commit", intent);
        assert_eq!(preview["objects"], result["objects"]);
        let road = app.road(&old.id).unwrap();
        let left = road.nodes.iter().find(|n| n.id == old.nodes[0].id).unwrap();
        let right = road.nodes.iter().find(|n| n.id == old.nodes[1].id).unwrap();
        assert_eq!(left.point, old.nodes[0].point);
        assert_eq!(right.point, old.nodes[1].point);
        assert_eq!(left.outgoing, old.nodes[0].outgoing);
        assert_eq!(right.incoming, old.nodes[1].incoming);
        let (anchor, join) = if end == "start" {
            (left.point, left.incoming.unwrap())
        } else {
            (right.point, right.outgoing.unwrap())
        };
        assert!((join[1] - anchor[1]).abs() < 1e-7);
        assert!((join[0] - anchor[0]) * (handle[0] - anchor[0]) > 0.);
        assert!(road.edge_sections.contains(&old.edge_sections[0]));
        history(&mut app, false);
        assert_eq!(app.road(&old.id).unwrap(), old);
    }
}

#[test]
fn terrain_population_uses_final_sections_and_limits_leave_valid_baseline() {
    let mut app = AtlasApplication::new().unwrap();
    let mut intent = input();
    intent["population"] = json!({"side":"both","setback":5,"gap":5,"minWidth":2,"maxWidth":3,"minDepth":2,"maxDepth":3,"seed":13,"parcelDepth":null});
    let preview = edit(&mut app, "preview", intent.clone());
    let committed = edit(&mut app, "commit", intent);
    assert_eq!(preview["objects"], committed["objects"]);
    assert!(committed["objects"]
        .as_array()
        .unwrap()
        .iter()
        .any(|o| o["kind"] == "house"));
    let mut dense = AtlasApplication::new().unwrap();
    let mut intent = input();
    intent["road"]["nodes"] = json!((0..512)
        .map(|i| json!({"point":[i*10,0],"incoming":null,"outgoing":null}))
        .collect::<Vec<_>>());
    let result = edit(&mut dense, "commit", intent);
    assert_eq!(result["objects"][0]["nodes"].as_array().unwrap().len(), 512);
    assert_eq!(
        result["objects"][0]["sections"].as_array().unwrap().len(),
        511
    );
}
