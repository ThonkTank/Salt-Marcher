use super::{application_test_support::*, *};
use crate::atlas::rivers::*;
fn create(points: Value) -> Value {
    json!({"type":"riverEdit","view":{"level":0,"tiles":[[0,0]]},"action":{"kind":"put","id":null,"name":"Fluss","nodes":points.as_array().unwrap().iter().map(|p|json!({"id":"","point":p,"width":20})).collect::<Vec<_>>(),"settings":{"tolerance":0,"roughness":0,"meander":40,"sourceFade":false,"seed":1},"reverse":false,"automatic":true,"snap":2}})
}
fn views(a: &AtlasApplication) -> Vec<RiverView> {
    river_store::local(&a.db, [-1000., -1000., 1000., 1000.]).unwrap()
}
fn surface(a: &mut AtlasApplication) -> Value {
    a.request("terrainTiles", json!({"level":0,"tiles":[[0,0]]}))
        .unwrap()["tiles"]
        .clone()
}
#[test]
fn river_preview_history_delete_and_file_roundtrip_preserve_authored_heights() {
    let mut a = AtlasApplication::new().unwrap();
    let original = surface(&mut a);
    let intent = create(json!([[10, 20], [100, 20]]));
    let p = request_edit(&mut a, "preview", intent.clone());
    assert_eq!(a.status().revision, 0);
    let c = request_edit(&mut a, "commit", intent);
    assert_eq!(p["rivers"], c["rivers"]);
    assert_eq!(p["terrain"], c["terrain"]);
    let v = views(&a);
    assert_eq!(v.len(), 1);
    let cut = surface(&mut a);
    assert!(cut[0]["heights"][4 * 33 + 8].as_f64().unwrap() < 10.);
    assert_eq!(
        a.db.query_row("SELECT count(*) FROM terrain", [], |r| r.get::<_, i64>(0))
            .unwrap(),
        0
    );
    history(&mut a, false);
    assert_eq!(surface(&mut a), original);
    history(&mut a, true);
    assert_eq!(views(&a), v);
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("river.saltatlas");
    a.save(&path).unwrap();
    a.open(&path).unwrap();
    assert_eq!(views(&a), v);
    assert_eq!(surface(&mut a), cut);
    request_edit(
        &mut a,
        "commit",
        json!({"type":"riverEdit","view":null,"action":{"kind":"delete","id":v[0].river.id}}),
    );
    assert_eq!(surface(&mut a), original);
}
#[test]
fn river_confluence_has_shared_height_and_moves_atomically() {
    let mut a = AtlasApplication::new().unwrap();
    request_edit(&mut a, "commit", create(json!([[0, 50], [150, 50]])));
    let p = request_edit(
        &mut a,
        "commit",
        create(json!([[70.000000001, -80], [70.000000001, 50]])),
    );
    assert!(p["rivers"]["after"].as_array().unwrap().len() == 2);
    let v = views(&a);
    let host = &v[0];
    assert_eq!(host.river.nodes.len(), 3);
    let node = &host.river.nodes[1];
    let other = v.iter().find(|r| r.river.id != host.river.id).unwrap();
    assert_eq!(other.river.nodes.last().unwrap().id, node.id);
    let z = host
        .samples
        .iter()
        .find(|s| s.point == node.point)
        .unwrap()
        .water;
    assert_eq!(other.samples.last().unwrap().water, z);
    let mut nodes = host.river.nodes.clone();
    nodes[1].point = [80., 60.];
    request_edit(
        &mut a,
        "commit",
        json!({"type":"riverEdit","view":null,"action":{"kind":"put","id":host.river.id,"name":"Moved","nodes":nodes,"settings":host.river.settings,"automatic":false,"reverse":false,"snap":0}}),
    );
    assert!(views(&a).iter().all(|v| v
        .river
        .nodes
        .iter()
        .filter(|n| n.id == node.id)
        .all(|n| n.point == [80., 60.])));
    history(&mut a, false);
    assert_eq!(views(&a), v);
}
#[test]
fn river_terrain_edits_recompute_profile_without_moving_path() {
    let mut a = AtlasApplication::new().unwrap();
    request_edit(&mut a, "commit", create(json!([[10, 20], [130, 20]])));
    let old = views(&a);
    let edit = json!({"type":"terrainStroke","brush":{"mode":"lower","radius":15,"amount":8,"strength":1,"target":10,"points":[[70,20]]},"view":{"level":0,"tiles":[[0,0]]}});
    let p = request_edit(&mut a, "preview", edit.clone());
    let c = request_edit(&mut a, "commit", edit);
    assert_eq!(p["rivers"], c["rivers"]);
    assert_eq!(p["terrain"], c["terrain"]);
    let new = views(&a);
    assert_eq!(new[0].river, old[0].river);
    assert!(new[0].samples.last().unwrap().water < old[0].samples.last().unwrap().water);
    assert!(new[0].samples.windows(2).all(|w| w[1].water <= w[0].water));
    history(&mut a, false);
    assert_eq!(views(&a), old);
    history(&mut a, true);
    assert_eq!(views(&a), new);
    let id = new[0].river.id.clone();
    request_edit(
        &mut a,
        "commit",
        json!({"type":"riverEdit","view":null,"action":{"kind":"delete","id":id}}),
    );
    assert!(terrain_store::grid(&a.db, [60., 10., 80., 30.])
        .unwrap()
        .values()
        .any(|z| *z < 10.));
}
#[test]
fn river_large_cut_is_valid_and_sql_failure_is_atomic() {
    let mut a = AtlasApplication::new().unwrap();
    terrain_store::write_points(&a.db, &[(10, 4, 100.), (11, 4, 100.)]).unwrap();
    let input = create(json!([[10, 20], [100, 20]]));
    let p = request_edit(&mut a, "preview", input.clone());
    assert_eq!(p["valid"], true);
    assert!(p["rivers"]["after"][0]["samples"]
        .as_array()
        .unwrap()
        .iter()
        .any(|s| s["cut"].as_f64().unwrap() > 30.));
    let before = a.status().revision;
    a.db.execute_batch("CREATE TEMP TRIGGER fail_river BEFORE INSERT ON rivers BEGIN SELECT RAISE(ABORT,'injected'); END;").unwrap();
    assert!(a
        .request("commit", json!({"version":a.status(),"intent":input}))
        .is_err());
    assert_eq!(a.status().revision, before);
    assert!(views(&a).is_empty());
}
#[test]
fn river_direction_uses_end_heights_and_cycles_are_rejected() {
    let mut a = AtlasApplication::new().unwrap();
    terrain_store::write_points(&a.db, &[(20, 4, 50.)]).unwrap();
    request_edit(&mut a, "commit", create(json!([[10, 20], [100, 20]])));
    let v = views(&a);
    assert_eq!(v[0].river.nodes[0].point, [100., 20.]);
    let mut r = v[0].river.clone();
    r.id = "river-extra".into();
    r.nodes.reverse();
    r.path.reverse();
    assert!(
        profiles(vec![v[0].river.clone(), r], &mut |_| Ok(None), &mut |_| Ok(
            10.
        ))
        .is_err()
    );
}
#[test]
fn river_crossing_stops_at_receiver_and_self_crossing_is_atomic() {
    let mut a = AtlasApplication::new().unwrap();
    request_edit(&mut a, "commit", create(json!([[0, 50], [150, 50]])));
    request_edit(&mut a, "commit", create(json!([[70, -80], [70, 100]])));
    let v = views(&a);
    assert_eq!(v.len(), 2);
    let tributary = v
        .iter()
        .find(|v| v.river.nodes[0].point == [70., -80.])
        .unwrap();
    assert_eq!(tributary.river.nodes.last().unwrap().point, [70., 50.]);
    let before = a.status().revision;
    let input = create(json!([[200, 0], [300, 100], [200, 100], [300, 0]]));
    assert!(a
        .request("commit", json!({"version":a.status(),"intent":input}))
        .is_err());
    assert_eq!(a.status().revision, before);
    history(&mut a, false);
    assert_eq!(views(&a).len(), 1);
    assert_eq!(views(&a)[0].river.nodes.len(), 2);
}
#[test]
fn river_extension_keeps_existing_route_and_shared_nodes_cannot_be_removed() {
    let mut a = AtlasApplication::new().unwrap();
    request_edit(&mut a, "commit", create(json!([[10, 20], [100, 20]])));
    let old = views(&a)[0].river.clone();
    let mut nodes = old.nodes.clone();
    nodes.push(RiverNode {
        id: String::new(),
        point: [150., 40.],
        width: 25.,
    });
    request_edit(
        &mut a,
        "commit",
        json!({"type":"riverEdit","view":null,"action":{"kind":"put","id":old.id,"name":old.name,"nodes":nodes,"settings":old.settings,"automatic":false,"reverse":false,"snap":0}}),
    );
    assert_eq!(
        &views(&a)[0].river.path[..old.path.len()],
        old.path.as_slice()
    );
}
#[test]
fn river_hill_route_is_deterministic_and_height_following_never_rises() {
    let mut r = River {
        id: "river-1".into(),
        name: "Test".into(),
        nodes: vec![
            RiverNode {
                id: "rnode-2".into(),
                point: [0., 0.],
                width: 20.,
            },
            RiverNode {
                id: "rnode-3".into(),
                point: [500., 0.],
                width: 20.,
            },
        ],
        settings: RiverSettings {
            tolerance: 0.3,
            roughness: 0.,
            ..Default::default()
        },
        path: vec![],
    };
    let height =
        |p: [f64; 2]| 10. + 80. * (-(p[0] - 250.).powi(2) / 2000. - p[1].powi(2) / 2000.).exp();
    route(&mut r, &mut |p| Ok((height(p), false))).unwrap();
    let mut again = r.clone();
    route(&mut again, &mut |p| Ok((height(p), false))).unwrap();
    assert_eq!(r, again);
    assert!(r.path.iter().any(|v| v.point[1].abs() > 20.));
    let v = profiles(vec![r], &mut |_| Ok(None), &mut |p| Ok(height(p))).unwrap();
    assert!(v[0].samples.windows(2).all(|p| p[1].water <= p[0].water));
}
#[test]
fn river_invalid_coordinates_and_unchanged_edit_preserve_revision() {
    let mut a = AtlasApplication::new().unwrap();
    let bad = create(json!([[1e100, 0], [0, 0]]));
    assert!(a
        .request("commit", json!({"version":a.status(),"intent":bad}))
        .is_err());
    assert_eq!(a.status().revision, 0);
    request_edit(&mut a, "commit", create(json!([[0, 0], [100, 0]])));
    let r = views(&a)[0].river.clone();
    let revision = a.status().revision;
    let intent = json!({"type":"riverEdit","view":null,"action":{"kind":"put","id":r.id,"name":r.name,"nodes":r.nodes,"settings":r.settings,"automatic":false,"reverse":false,"snap":0}});
    let result = request_edit(&mut a, "commit", intent);
    assert_eq!(result["changed"], false);
    assert_eq!(a.status().revision, revision);
}

#[test]
fn river_preview_and_commit_use_riverbed_for_house_platform() {
    let mut a = AtlasApplication::new().unwrap();
    request_edit(
        &mut a,
        "commit",
        json!({"type":"createHouse","parcelId":null,"transform":{"x":40,"y":17.5,"angle":0},"width":1,"depth":1}),
    );
    let before = surface(&mut a)[0]["foundationTops"][0][1].as_f64().unwrap();
    let intent = create(json!([[10, 20], [100, 20]]));
    let preview = request_edit(&mut a, "preview", intent.clone());
    let commit = request_edit(&mut a, "commit", intent);
    assert_eq!(preview["terrain"], commit["terrain"]);
    let tiles = surface(&mut a);
    let after = tiles[0]["foundationTops"][0][1].as_f64().unwrap();
    assert!(
        after < before,
        "riverbed must lower the house platform: {before} -> {after}"
    );
    assert_eq!(preview["terrain"]["surface"]["tiles"], tiles);
}

#[test]
fn direct_sections_restore_river_profiles_in_one_history_action() {
    let mut a = AtlasApplication::new().unwrap();
    request_edit(&mut a, "commit", create(json!([[0, 0], [80, 0]])));
    let before = views(&a);
    let cursor = a.cursor;
    a.request("beginTerrainStroke", json!({"version":a.status(),"strokeId":"river-history","brush":{"resolution":0,"mode":"lower","radius":20,"amount":10,"strength":1,"target":10,"points":[[0,0]]},"view":null})).unwrap();
    a.request("appendTerrainStroke", json!({"sessionId":a.session,"strokeId":"river-history","sequence":1,"points":[[40,0]],"view":null})).unwrap();
    let after = views(&a);
    assert_ne!(before, after);
    assert_eq!(a.cursor, cursor + 1);
    history(&mut a, false);
    assert_eq!(views(&a), before);
    history(&mut a, true);
    assert_eq!(views(&a), after);
}

#[test]
fn river_overview_preview_matches_fresh_surface_and_rolls_back_indexes() {
    for level in [5, 6] {
        let mut a = AtlasApplication::new().unwrap();
        let view = json!({"level":level,"tiles":[[0,0]],"pixels":32});
        let original = a.request("terrainTiles", view.clone()).unwrap()["tiles"].clone();
        let status = serde_json::to_value(a.status()).unwrap();
        let mut intent = create(json!([[300, 320], [400, 320]]));
        intent["view"] = view.clone();
        let preview = request_edit(&mut a, "preview", intent.clone());
        let mut invalid_view = intent.clone();
        invalid_view["view"]["pixels"] = json!(31);
        assert_eq!(
            request_edit(&mut a, "preview", invalid_view)["valid"],
            false
        );
        assert!(views(&a).is_empty());
        assert_eq!(serde_json::to_value(a.status()).unwrap(), status);
        assert_eq!(
            a.request("terrainTiles", view.clone()).unwrap()["tiles"],
            original
        );
        for table in ["river_spatial", "river_nodes"] {
            assert_eq!(
                a.db.query_row(&format!("SELECT count(*) FROM {table}"), [], |r| r
                    .get::<_, i64>(0))
                    .unwrap(),
                0
            );
        }
        let committed = request_edit(&mut a, "commit", intent);
        let fresh = a.request("terrainTiles", view.clone()).unwrap()["tiles"].clone();
        assert_eq!(
            preview["terrain"]["surface"]["tiles"], fresh,
            "level {level}"
        );
        assert_eq!(committed["terrain"]["surface"]["tiles"], fresh);
        if level == 6 {
            assert_eq!(fresh, original);
        } else {
            assert_ne!(fresh, original);
        }
        history(&mut a, false);
        assert_eq!(
            a.request("terrainTiles", view.clone()).unwrap()["tiles"],
            original
        );
        history(&mut a, true);
        assert_eq!(a.request("terrainTiles", view).unwrap()["tiles"], fresh);
    }
}

#[test]
fn long_river_surface_uses_same_overview_for_preview_sections_and_delete() {
    let mut a = AtlasApplication::new().unwrap();
    let view = json!({"level":6,"tiles":[[0,0]],"pixels":32});
    let points: Vec<_> = (0..201)
        .map(|i| [320. + i as f64 * 20., 320. + (i as f64 / 10.).sin() * 100.])
        .collect();
    let mut intent = create(json!(points));
    intent["action"]["automatic"] = json!(false);
    intent["view"] = view.clone();
    let preview = request_edit(&mut a, "preview", intent.clone());
    request_edit(&mut a, "commit", intent);
    let before = river_store::local(&a.db, [0., 0., 10240., 10240.]).unwrap();
    assert!(before[0].samples.len() > 128);
    assert_eq!(
        river_store::overview(&a.db, [0., 0., 10240., 10240.], 8. / 320.).unwrap()[0]
            .samples
            .len(),
        128
    );
    assert_eq!(
        preview["terrain"]["surface"]["tiles"],
        a.request("terrainTiles", view.clone()).unwrap()["tiles"]
    );
    let reply = a.request("beginTerrainStroke", json!({"version":a.status(),"strokeId":"overview-river","brush":{"resolution":0,"mode":"lower","radius":20,"amount":10,"strength":1,"target":10,"points":[[320,320]]},"view":view})).unwrap();
    assert_eq!(
        reply["surface"]["tiles"],
        a.request("terrainTiles", view.clone()).unwrap()["tiles"]
    );
    let reply = a.request("appendTerrainStroke", json!({"sessionId":a.session,"strokeId":"overview-river","sequence":1,"points":[[340,330]],"view":view})).unwrap();
    let fresh = a.request("terrainTiles", view.clone()).unwrap()["tiles"].clone();
    assert_eq!(reply["surface"]["tiles"], fresh);
    let after = river_store::local(&a.db, [0., 0., 10240., 10240.]).unwrap();
    assert_ne!(before, after);
    assert_eq!(before[0].river, after[0].river);
    history(&mut a, false);
    assert_eq!(
        river_store::local(&a.db, [0., 0., 10240., 10240.]).unwrap(),
        before
    );
    history(&mut a, true);
    assert_eq!(
        a.request("terrainTiles", view.clone()).unwrap()["tiles"],
        fresh
    );
    let delete =
        json!({"type":"riverEdit","view":view,"action":{"kind":"delete","id":after[0].river.id}});
    let preview = request_edit(&mut a, "preview", delete.clone());
    assert_eq!(
        river_store::local(&a.db, [0., 0., 10240., 10240.]).unwrap(),
        after
    );
    request_edit(&mut a, "commit", delete);
    assert_eq!(
        preview["terrain"]["surface"]["tiles"],
        a.request("terrainTiles", view).unwrap()["tiles"]
    );
}
