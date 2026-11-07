use super::application_test_support::{request_edit as edit, *};
use super::*;

fn input() -> Value {
    json!({"type":"createRoad","road":{"name":"Weg","width":16,"material":"earth","nodes":[{"point":[0,0],"incoming":null,"outgoing":[100,0]},{"point":[300,0],"incoming":[200,0],"outgoing":null}]},"population":null,"roughness":{"amount":0.6,"seed":17}})
}
#[test]
fn roughness_preview_commit_history_and_file_are_identical() {
    let mut app = AtlasApplication::new().unwrap();
    let preview = edit(&mut app, "preview", input());
    let repeated = edit(&mut app, "preview", input());
    assert_eq!(preview["objects"], repeated["objects"]);
    let result = edit(&mut app, "commit", input());
    assert_eq!(preview["objects"], result["objects"]);
    let road: Road = serde_json::from_value(result["objects"][0].clone()).unwrap();
    assert!(road.nodes.len() > 2);
    assert_eq!(road.sections.len(), 1);
    assert!(road.edge_sections.iter().all(|s| *s == road.sections[0].id));
    assert_eq!(road.nodes[0].point, [0.0, 0.0]);
    assert_eq!(road.nodes.last().unwrap().point, [300.0, 0.0]);
    assert_eq!(road.nodes[0].outgoing.unwrap()[1], 0.0);
    assert_eq!(road.nodes.last().unwrap().incoming.unwrap()[1], 0.0);
    assert!(road.path.iter().any(|p| p[1].abs() > 0.1));
    history(&mut app, false);
    assert!(app.scene_header(&road.id).unwrap().is_none());
    history(&mut app, true);
    assert_eq!(app.road(&road.id).unwrap(), road);
    let path =
        std::env::temp_dir().join(format!("atlas-roughness-{}.saltatlas", std::process::id()));
    app.save(&path).unwrap();
    app.open(&path).unwrap();
    assert_eq!(app.road(&road.id).unwrap(), road);
    std::fs::remove_file(path).unwrap();
}
#[test]
fn existing_roughness_is_non_cumulative_preserves_ids_and_zero_is_noop() {
    let mut app = AtlasApplication::new().unwrap();
    let mut plain = input();
    plain["roughness"]["amount"] = json!(0);
    let result = edit(&mut app, "commit", plain);
    let old: Road = serde_json::from_value(result["objects"][0].clone()).unwrap();
    let action = json!({"type":"roughenRoad","roadId":old.id,"roughness":{"amount":0.5,"seed":3}});
    let first = edit(&mut app, "preview", action.clone());
    let mut other = action.clone();
    other["roughness"]["amount"] = json!(0.9);
    edit(&mut app, "preview", other);
    assert_eq!(
        first["objects"],
        edit(&mut app, "preview", action.clone())["objects"]
    );
    let zero = json!({"type":"roughenRoad","roadId":old.id,"roughness":{"amount":0,"seed":3}});
    assert_eq!(edit(&mut app, "commit", zero)["changed"], false);
    edit(&mut app, "commit", action);
    let new = app.road(&old.id).unwrap();
    assert_eq!(new.nodes.first().unwrap().id, old.nodes[0].id);
    assert_eq!(new.nodes.last().unwrap().id, old.nodes[1].id);
    assert_eq!(new.sections, old.sections);
}
#[test]
fn rough_extensions_preserve_existing_cubics_at_both_ends() {
    for end in ["start", "end"] {
        let mut app = AtlasApplication::new().unwrap();
        let result = edit(&mut app, "commit", input());
        let old: Road = serde_json::from_value(result["objects"][0].clone()).unwrap();
        let (point, handle) = if end == "start" {
            ([-100000, 0], [-100, 0])
        } else {
            ([100000, 0], [400, 0])
        };
        let action = json!({"type":"extendRoad","roadId":old.id,"end":end,"nodes":[{"point":point,"incoming":null,"outgoing":null}],"endpointHandle":handle,"population":null,"roughness":{"amount":0.5,"seed":2}});
        edit(&mut app, "commit", action);
        let new = app.road(&old.id).unwrap();
        for pair in old.nodes.windows(2) {
            let a = new.nodes.iter().find(|n| n.id == pair[0].id).unwrap();
            let b = new.nodes.iter().find(|n| n.id == pair[1].id).unwrap();
            assert_eq!(
                (a.point, a.outgoing, b.incoming, b.point),
                (
                    pair[0].point,
                    pair[0].outgoing,
                    pair[1].incoming,
                    pair[1].point
                )
            );
        }
    }
}
#[test]
fn long_roughness_succeeds_and_road_header_reads_no_cells() {
    let mut app = AtlasApplication::new().unwrap();
    let mut action = input();
    action["road"]["nodes"][1]["point"] = json!([100000, 0]);
    let preview = edit(&mut app, "preview", action.clone());
    assert_eq!(preview["valid"], true);
    let result = edit(&mut app, "commit", action);
    assert_eq!(preview["objects"], result["objects"]);
    let road: Road = serde_json::from_value(result["objects"][0].clone()).unwrap();
    assert!(road.nodes.len() > 2 && road.nodes.len() <= 257);
    assert!(road.path.iter().any(|p| p[1].abs() > 0.1));
    history(&mut app, false);
    assert!(app.scene_header(&road.id).unwrap().is_none());
    history(&mut app, true);
    assert_eq!(app.road(&road.id).unwrap(), road);
    let path = std::env::temp_dir().join(format!(
        "atlas-long-roughness-{}.saltatlas",
        std::process::id()
    ));
    app.save(&path).unwrap();
    app.open(&path).unwrap();
    assert_eq!(app.road(&road.id).unwrap(), road);
    std::fs::remove_file(path).unwrap();
    let id = result["objects"][0]["id"].as_str().unwrap();
    app.db.flush_prepared_statement_cache();
    app.db
        .authorizer(Some(|ctx: rusqlite::hooks::AuthContext<'_>| {
            match ctx.action {
                rusqlite::hooks::AuthAction::Read {
                    table_name: "house_cells" | "local_cells",
                    ..
                } => rusqlite::hooks::Authorization::Deny,
                _ => rusqlite::hooks::Authorization::Allow,
            }
        }));
    let header = app.request("roadHeader", json!({"roadId":id})).unwrap();
    assert_eq!(header["objects"], result["objects"]);
}

#[test]
fn roughness_scales_across_lengths_widths_seeds_and_amounts() {
    for length in [30.0, 100_000.0] {
        for width in [2, 16, 100] {
            for seed in [1, 42] {
                for amount in [0.0, 0.33, 1.0] {
                    let mut app = AtlasApplication::new().unwrap();
                    let mut action = input();
                    action["road"]["width"] = json!(width);
                    action["road"]["nodes"] = json!([
                        {"point":[0,0],"incoming":null,"outgoing":[length/6.0,0]},
                        {"point":[length/2.0,0],"incoming":[length/3.0,0],"outgoing":[length*2.0/3.0,0]},
                        {"point":[length,0],"incoming":[length*5.0/6.0,0],"outgoing":null}]);
                    action["roughness"] = json!({"amount":amount,"seed":seed});
                    let preview = edit(&mut app, "preview", action.clone());
                    let result = edit(&mut app, "commit", action);
                    assert_eq!(preview["objects"], result["objects"]);
                    let road: Road = serde_json::from_value(result["objects"][0].clone()).unwrap();
                    assert!(road.nodes.len() <= 257);
                    for point in [[0.0, 0.0], [length / 2.0, 0.0], [length, 0.0]] {
                        assert!(road.nodes.iter().any(|n| n.point == point));
                    }
                }
            }
        }
    }
}

#[test]
fn repeated_roughening_reserves_capacity_and_eventually_is_noop() {
    let mut app = AtlasApplication::new().unwrap();
    let mut action = input();
    action["road"]["nodes"][1]["point"] = json!([100000, 0]);
    let result = edit(&mut app, "commit", action);
    let mut old: Road = serde_json::from_value(result["objects"][0].clone()).unwrap();
    for _ in 0..12 {
        let action =
            json!({"type":"roughenRoad","roadId":old.id,"roughness":{"amount":0.33,"seed":17}});
        let result = edit(&mut app, "commit", action);
        let new = app.road(&old.id).unwrap();
        assert!(new.nodes.len() <= old.nodes.len() + (512 - old.nodes.len()) / 2);
        for node in &old.nodes {
            assert_eq!(
                new.nodes.iter().find(|n| n.id == node.id).unwrap().point,
                node.point
            );
        }
        if result["changed"] == false {
            assert_eq!(new, old);
            return;
        }
        old = new;
    }
    panic!("repeated roughening must settle within the fixed budget");
}
