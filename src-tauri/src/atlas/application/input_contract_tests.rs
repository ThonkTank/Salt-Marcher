use super::application_test_support::{request_edit as request, *};
use super::*;
use crate::atlas::test_inputs::update_road;
fn create() -> Value {
    json!({"type":"createRoad","road":{"name":"Input","width":10.0,"material":"earth","nodes":[{"point":[0.0,0.0],"incoming":[-7.0,3.0],"outgoing":[30.0,2.0]},{"point":[100.0,0.0],"incoming":[70.0,-2.0],"outgoing":[109.0,4.0]}]},"population":null})
}

#[test]
fn strict_input_dtos_reject_stored_and_unknown_fields_at_every_level() {
    let mut a = AtlasApplication::new().unwrap();
    let result = request(&mut a, "commit", create());
    let update = update_road(&result["objects"][0]);
    let settings = json!({"side":"both","setback":5,"gap":10,"minWidth":2,"maxWidth":2,"minDepth":2,"maxDepth":2,"seed":1,"parcelDepth":null});
    let extension = json!({"type":"extendRoad","roadId":result["objects"][0]["id"],"end":"end","nodes":[{"point":[150.0,0.0],"incoming":null,"outgoing":null}],"endpointHandle":null,"population":null});
    let area = json!({"type":"createArea","area":{"material":"grass","points":[[200.0,0.0],[210.0,0.0],[200.0,10.0]]}});
    for input in [
        create(),
        update.clone(),
        extension.clone(),
        area.clone(),
        json!({"type":"updateArea","areaId":"area-99","area":area["area"]}),
    ] {
        let typed: Intent = serde_json::from_value(input.clone()).unwrap();
        assert_eq!(serde_json::to_value(typed).unwrap(), input);
        let mut bad = input.clone();
        bad["unexpected"] = json!(true);
        assert!(serde_json::from_value::<Intent>(bad).is_err());
        let field = if input.get("road").is_some() {
            "road"
        } else {
            "area"
        };
        if input.get(field).is_some() {
            for key in [
                "id",
                "kind",
                "order",
                "path",
                "sections",
                "edgeSections",
                "populationRecipe",
            ] {
                let mut bad = input.clone();
                bad[field][key] = json!("forbidden");
                assert!(
                    serde_json::from_value::<Intent>(bad).is_err(),
                    "{key}: {input}"
                );
            }
        }
    }
    for mut input in [create(), extension.clone()] {
        let nodes = if input["type"] == "createRoad" {
            &mut input["road"]["nodes"]
        } else {
            &mut input["nodes"]
        };
        nodes[0]["id"] = json!("");
        assert!(serde_json::from_value::<Intent>(input).is_err());
    }
    let mut bad_update = update.clone();
    bad_update["road"]["nodes"][0]["path"] = json!([]);
    assert!(serde_json::from_value::<Intent>(bad_update).is_err());
    for mut input in [create(), extension.clone()] {
        input["population"] = settings.clone();
        input["population"]["unexpected"] = json!(true);
        assert!(serde_json::from_value::<Intent>(input).is_err());
    }
    let mut old_extension = extension;
    old_extension["populate"] = json!(false);
    old_extension["settings"] = settings;
    assert!(serde_json::from_value::<Intent>(old_extension).is_err());
    let mut missing = create();
    missing.as_object_mut().unwrap().remove("population");
    assert!(serde_json::from_value::<Intent>(missing).is_err());
    let mut missing = create();
    missing["road"]["nodes"][0]
        .as_object_mut()
        .unwrap()
        .remove("incoming");
    assert!(serde_json::from_value::<Intent>(missing).is_err());
    for old in ["putRoad", "putArea"] {
        assert!(serde_json::from_value::<Intent>(json!({"type":old})).is_err());
    }
}
#[test]
fn allocator_and_exact_update_sequence_preserve_core_topology_and_recipe() {
    let mut a = AtlasApplication::new().unwrap();
    let status = a.status();
    let preview = request(&mut a, "preview", create());
    assert_eq!(a.status().revision, status.revision);
    let committed = request(&mut a, "commit", create());
    assert_eq!(committed["objects"], preview["objects"]);
    let r = committed["objects"][0].clone();
    assert_eq!(r["id"], "road-1");
    assert_eq!(r["nodes"][0]["id"], "node-2");
    assert_eq!(r["nodes"][1]["id"], "node-3");
    let mut input = update_road(&r);
    input["road"]["width"] = json!(12);
    let accepted = request(&mut a, "commit", input.clone());
    for key in ["edgeSections", "sections", "populationRecipe"] {
        assert_eq!(accepted["objects"][0][key], r[key]);
    }
    let state = a.status();
    for mode in 0..3 {
        let mut bad = input.clone();
        match mode {
            0 => bad["road"]["nodes"].as_array_mut().unwrap().swap(0, 1),
            1 => bad["road"]["nodes"][0]["id"] = json!("node-999"),
            _ => bad["road"]["nodes"][0]["id"] = json!(""),
        }
        let preview = request(&mut a, "preview", bad.clone());
        assert_eq!(preview["valid"], false);
        let error = a
            .request("commit", json!({"version":a.status(),"intent":bad}))
            .unwrap_err();
        assert_eq!(
            serde_json::to_value(error).unwrap()["issue"],
            preview["issues"][0]
        );
        assert_eq!(a.status().revision, state.revision);
    }
}
#[test]
fn explicit_extension_preserves_asymmetric_handles_and_existing_node_ids() {
    for end in ["start", "end"] {
        let mut a = AtlasApplication::new().unwrap();
        let r = request(&mut a, "commit", create())["objects"][0].clone();
        let (point, handle) = if end == "start" {
            ([-80.0, 0.0], [-9.0, 5.0])
        } else {
            ([180.0, 0.0], [111.0, -6.0])
        };
        let input = json!({"type":"extendRoad","roadId":r["id"],"end":end,"nodes":[{"point":point,"incoming":[point[0]-15.0,7.0],"outgoing":[point[0]+11.0,-3.0]}],"endpointHandle":handle,"population":null});
        let p = request(&mut a, "preview", input.clone());
        let c = request(&mut a, "commit", input);
        assert_eq!(p["objects"], c["objects"]);
        let nodes = &c["objects"][0]["nodes"];
        let offset = usize::from(end == "start");
        for i in 0..2 {
            assert_eq!(nodes[i + offset]["id"], r["nodes"][i]["id"]);
            assert_eq!(nodes[i + offset]["point"], r["nodes"][i]["point"]);
        }
        if end == "start" {
            assert_eq!(nodes[1]["incoming"], json!(handle));
            assert_eq!(nodes[1]["outgoing"], r["nodes"][0]["outgoing"]);
            assert_eq!(nodes[2], r["nodes"][1]);
        } else {
            assert_eq!(nodes[1]["outgoing"], json!(handle));
            assert_eq!(nodes[1]["incoming"], r["nodes"][1]["incoming"]);
            assert_eq!(nodes[0], r["nodes"][0]);
        }
        let new = &nodes[if end == "start" { 0 } else { 2 }];
        assert_eq!(new["incoming"], json!([point[0] - 15.0, 7.0]));
        assert_eq!(new["outgoing"], json!([point[0] + 11.0, -3.0]));
    }
}
#[test]
fn area_update_preserves_core_order_and_house_commands_keep_their_wire_shape() {
    let mut a = AtlasApplication::new().unwrap();
    let area = request(&mut a, "commit", json!({"type":"createArea","area":{"material":"grass","points":[[0.0,0.0],[20.0,0.0],[0.0,20.0]]}}))["objects"][0].clone();
    let updated = request(&mut a, "commit", json!({"type":"updateArea","areaId":area["id"],"area":{"material":"earth","points":area["points"]}}))["objects"][0].clone();
    assert_eq!(updated["order"], area["order"]);
    assert_eq!(updated["id"], area["id"]);
    for input in [
        json!({"type":"createHouse","transform":{"x":100.0,"y":100.0,"angle":0.0},"width":2,"depth":2,"parcelId":null}),
        json!({"type":"transformHouse","id":"house-9","transform":{"x":1.0,"y":2.0,"angle":0.0}}),
        json!({"type":"rename","id":"house-9","name":"Same"}),
    ] {
        let typed: Intent = serde_json::from_value(input.clone()).unwrap();
        assert_eq!(serde_json::to_value(typed).unwrap(), input);
    }
}

#[test]
fn closed_road_values_reject_invalid_commands_without_mutation() {
    let mut app = AtlasApplication::new().unwrap();
    let before = serde_json::to_value(app.status()).unwrap();
    let mut material = create();
    material["road"]["material"] = json!("water");
    let mut side = create();
    side["population"] = json!({"side":"middle","setback":5,"gap":10,"minWidth":2,"maxWidth":2,"minDepth":2,"maxDepth":2,"seed":1,"parcelDepth":null});
    for intent in [material, side] {
        for cmd in ["preview", "commit"] {
            let error = app
                .request(cmd, json!({"version": app.status(), "intent": intent}))
                .unwrap_err();
            let error = serde_json::to_value(error).unwrap();
            assert_eq!(error["category"], "invalidInput");
            assert!(!error["message"].as_str().unwrap().is_empty());
            assert_eq!(serde_json::to_value(app.status()).unwrap(), before);
        }
    }
}
