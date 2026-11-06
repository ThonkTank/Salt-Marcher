use super::application_test_support::{request_edit as edit, *};
use super::*;
use crate::atlas::test_inputs::update_road;
use rusqlite::hooks::{AuthAction, AuthContext, Authorization};

fn road_input() -> Value {
    json!({"type":"createRoad","road":{"name":"Road","width":10,"material":"earth","nodes":[{"point":[0,0],"incoming":null,"outgoing":null},{"point":[2000,0],"incoming":null,"outgoing":null}]},"population":null})
}
fn fixture(width: u32) -> (AtlasApplication, Road, Parcel, FullHouse) {
    let mut a = AtlasApplication::new().unwrap();
    let mut r: Road =
        serde_json::from_value(edit(&mut a, "commit", road_input())["objects"][0].clone()).unwrap();
    // The directly staged fixture obeys the same provenance invariant as
    // generated/live documents: a bound source has a populated side and recipe.
    r.sections[0].populated_sides = vec![Side::Right];
    r.population_recipe = Some(PopulationRecipe {
        settings: serde_json::from_value(json!({"side":"right","setback":5,"gap":10,"minWidth":2,"maxWidth":2,"minDepth":2,"maxDepth":2,"seed":1,"parcelDepth":1000})).unwrap(),
        algorithm_version: AlgorithmVersion,
    });
    storage::write_object(&a.db, &FullObject::Road(r.clone()), false).unwrap();
    let source = ParcelSource::Road {
        road_id: r.id.clone(),
        section_id: r.sections[0].id.clone(),
        side: Side::Right,
        start: 0.0,
        end: 1.0,
        setback: 5.0,
        depth: 1000.0,
    };
    let g = parcel_geometry::derive_parcel(&r, &source).unwrap();
    let p = Parcel {
        id: "parcel-100".into(),
        source,
        polygon: g.polygon,
        frame: g.frame,
    };
    storage::write_object(&a.db, &FullObject::Parcel(p.clone()), false).unwrap();
    let mut h = interior::new_house("house-101".into(), p.frame.clone(), width, width, 0).unwrap();
    h.placement = Placement::Parcel {
        parcel_id: p.id.clone(),
        grid_pose: GridPose {
            x_cells: 0,
            y_cells: 0,
            quarter_turns: QuarterTurns(0),
        },
    };
    storage::write_object(&a.db, &FullObject::House(h.clone()), true).unwrap();
    a.db.execute("UPDATE document_meta SET next_identity=102", [])
        .unwrap();
    (a, r, p, h)
}
fn move_road(r: &Road, dy: f64) -> Value {
    let mut r = r.clone();
    for n in &mut r.nodes {
        n.point[1] += dy;
    }
    update_road(&r)
}
type RawInterior = (String, String, Vec<(i64, i64, i64, String)>);
fn raw_interior(a: &AtlasApplication, id: &str) -> RawInterior {
    let metadata =
        a.db.query_row("SELECT metadata FROM objects WHERE id=?", [id], |r| {
            r.get(0)
        })
        .unwrap();
    let payload =
        a.db.query_row(
            "SELECT payload FROM house_cells WHERE building_id=?",
            [id],
            |r| r.get(0),
        )
        .unwrap();
    let cells = a
        .db
        .prepare("SELECT floor,x,y,room_id FROM local_cells WHERE building_id=? ORDER BY floor,y,x")
        .unwrap()
        .query_map([id], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)))
        .unwrap()
        .map(|r| r.unwrap())
        .collect();
    (metadata, payload, cells)
}
#[test]
fn follow_transform_rename_history_are_header_only_and_history_size_ignores_cell_count() {
    let mut sizes = vec![];
    for width in [2, 128] {
        let (mut a, r, p, h) = fixture(width);
        let before = raw_interior(&a, &h.id);
        a.db.flush_prepared_statement_cache();
        a.db.authorizer(Some(|ctx: AuthContext<'_>| match ctx.action {
            AuthAction::Read { table_name, .. }
            | AuthAction::Update { table_name, .. }
            | AuthAction::Insert { table_name }
            | AuthAction::Delete { table_name }
                if ["house_cells", "local_cells"].contains(&table_name) =>
            {
                Authorization::Deny
            }
            AuthAction::Read {
                table_name: "objects",
                column_name: "metadata",
                ..
            } => Authorization::Deny,
            _ => Authorization::Allow,
        }));

        let action = move_road(&r, 100.0);
        let preview = edit(&mut a, "preview", action.clone());
        let committed = edit(&mut a, "commit", action);
        assert_eq!(preview["objects"], committed["objects"]);
        assert_eq!(committed["status"]["changes"]["interiors"], json!([]));
        assert_eq!(committed["status"]["changes"]["metadata"], json!([]));
        assert!(committed["objects"]
            .as_array()
            .unwrap()
            .iter()
            .all(|o| o.get("cells").is_none()));
        sizes.push(
            a.db.query_row(
                "SELECT length(body) FROM history ORDER BY seq DESC LIMIT 1",
                [],
                |r| r.get::<_, i64>(0),
            )
            .unwrap(),
        );
        a.history(false).unwrap();
        a.history(true).unwrap();
        let header = a.required_house_header(&h.id).unwrap();
        let mut transform = header.transform;
        transform.y += 5.0;
        for action in [
            json!({"type":"transformHouse","id":h.id,"transform":transform}),
            json!({"type":"rename","id":h.id,"name":"Authored"}),
            json!({"type":"roof","id":h.id,"roof":"#123456"}),
        ] {
            let preview = edit(&mut a, "preview", action.clone());
            let committed = edit(&mut a, "commit", action);
            assert_eq!(preview["objects"], committed["objects"]);
            a.history(false).unwrap();
            a.history(true).unwrap();
        }

        a.db.authorizer(None::<fn(AuthContext<'_>) -> Authorization>);
        assert_eq!(raw_interior(&a, &h.id), before);
        let owner = a.house_header_for_parcel(&p.id).unwrap().unwrap();
        assert_eq!(owner.id, h.id);
    }
    assert_eq!(sizes[0], sizes[1]);
    assert!(sizes[0] < 5000, "{sizes:?}");
}
#[test]
fn compound_sql_failure_restores_exact_objects_indices_history_counter_and_status() {
    let (mut a, r, _, h) = fixture(4);
    let before = raw_interior(&a, &h.id);
    let old = a.house(&h.id).unwrap();
    let status = json!(a.status());
    let snapshot = |a: &AtlasApplication| -> Vec<String> {
        [
            "objects",
            "spatial",
            "occupancy_spatial",
            "history",
            "document_meta",
        ]
        .into_iter()
        .map(|table| {
            let mut q =
                a.db.prepare(&format!("SELECT * FROM {table} ORDER BY 1"))
                    .unwrap();
            let cols = q.column_count();
            let rows = q
                .query_map([], |row| {
                    Ok((0..cols)
                        .map(|i| format!("{:?}", row.get_ref(i).unwrap()))
                        .collect::<Vec<_>>()
                        .join("|"))
                })
                .unwrap()
                .map(|v| v.unwrap())
                .collect::<Vec<_>>();
            rows.join("\n")
        })
        .collect()
    };
    let saved = snapshot(&a);
    a.db.execute_batch("CREATE TEMP TRIGGER fail_history BEFORE INSERT ON history BEGIN SELECT RAISE(ABORT,'injected compound failure'); END;").unwrap();
    assert!(a
        .request(
            "commit",
            json!({"version":a.status(),"intent":move_road(&r,100.0)})
        )
        .is_err());
    assert_eq!(snapshot(&a), saved);
    assert_eq!(a.house(&h.id).unwrap(), old);
    assert_eq!(raw_interior(&a, &h.id), before);
    assert_eq!(json!(a.status()), status);
    a.db.execute_batch("DROP TRIGGER fail_history").unwrap();
    let input: Intent = serde_json::from_value(move_road(&r, 100.0)).unwrap();
    let c = a.compute(&input).unwrap();
    assert!(!c.change.geometry.after.is_empty());
    assert!(!c.change.fields.is_empty());
    edit(&mut a, "commit", move_road(&r, 100.0));
    let history: String =
        a.db.query_row(
            "SELECT body FROM history ORDER BY seq DESC LIMIT 1",
            [],
            |r| r.get(0),
        )
        .unwrap();
    let stored: crate::atlas::change::History = serde_json::from_str(&history).unwrap();
    assert!(!stored.change.geometry.after.is_empty());
    assert!(!stored.change.fields.is_empty());
    assert!(!history.contains("cells"));
    assert!(!history.contains("rooms"));
}
#[test]
fn all_quarter_turns_and_manual_gridposes_roundtrip_while_follow_keeps_gridpose() {
    let (mut a, r, p, h) = fixture(2);
    for quarter in 0..4 {
        let pose = GridPose {
            x_cells: 10,
            y_cells: 10,
            quarter_turns: QuarterTurns(quarter),
        };
        let t = parcel_geometry::parcel_house_transform(&p.frame, &pose).unwrap();
        let committed = edit(
            &mut a,
            "commit",
            json!({"type":"transformHouse","id":h.id,"transform":t}),
        );
        assert_eq!(
            committed["objects"][0]["placement"]["gridPose"],
            json!(pose)
        );
        a.history(false).unwrap();
        a.history(true).unwrap();
        assert_eq!(a.house(&h.id).unwrap().transform, t);
    }
    let before = a.house(&h.id).unwrap();
    edit(&mut a, "commit", move_road(&r, 100.0));
    let after = a.house(&h.id).unwrap();
    assert_eq!(before.placement, after.placement);
    assert_eq!(before.cells, after.cells);
    assert_eq!(before.rooms, after.rooms);
    assert_eq!(before.connections, after.connections);
}
#[test]
fn detached_owner_survives_road_cascade_and_relation_hints_cover_every_lifecycle() {
    let (mut a, r, p, h) = fixture(2);
    let detached = edit(&mut a, "commit", json!({"type":"detachParcel","id":p.id}));
    let relations = detached["status"]["changes"]["relations"]
        .as_array()
        .unwrap();
    for id in [&r.id, &p.id, &h.id] {
        assert!(relations.contains(&json!(id)));
    }
    let counter: i64 =
        a.db.query_row("SELECT next_identity FROM document_meta", [], |r| r.get(0))
            .unwrap();
    let revision = a.revision;
    assert_eq!(
        edit(&mut a, "commit", json!({"type":"detachParcel","id":p.id}))["changed"],
        false
    );
    assert_eq!(a.revision, revision);
    assert_eq!(
        a.db.query_row("SELECT next_identity FROM document_meta", [], |r| r
            .get::<_, i64>(0))
            .unwrap(),
        counter
    );
    a.history(false).unwrap();
    assert!(matches!(
        a.parcel(&p.id).unwrap().source,
        ParcelSource::Road { .. }
    ));
    a.history(true).unwrap();
    let deleted = edit(&mut a, "commit", json!({"type":"delete","id":r.id}));
    assert_eq!(deleted["cascadeCounts"]["parcels"], 0);
    assert_eq!(deleted["cascadeCounts"]["houses"], 0);
    assert_eq!(a.house(&h.id).unwrap(), h);
    let deleted = edit(&mut a, "commit", json!({"type":"delete","id":p.id}));
    assert_eq!(deleted["cascadeCounts"]["parcels"], 1);
    assert_eq!(deleted["cascadeCounts"]["houses"], 1);
    assert_eq!(deleted["cascadeCounts"]["rooms"], 1);
    assert_eq!(deleted["cascadeCounts"]["connections"], 1);
    assert_eq!(deleted["deletedIds"].as_array().unwrap().len(), 2);
    a.history(false).unwrap();
    assert_eq!(a.house(&h.id).unwrap(), h);
}
#[test]
fn population_allocator_and_complete_compound_plan_roll_back_on_late_sql_failure() {
    let mut a = AtlasApplication::new().unwrap();
    let mut input = road_input();
    input["population"] = json!({"side":"both","setback":5,"gap":10,"minWidth":4,"maxWidth":7,"minDepth":4,"maxDepth":8,"seed":1,"parcelDepth":null});
    let preview = edit(&mut a, "preview", input.clone());
    let status = json!(a.status());
    a.db.execute_batch("CREATE TEMP TRIGGER fail_history BEFORE INSERT ON history BEGIN SELECT RAISE(ABORT,'failure'); END;").unwrap();
    assert!(a
        .request("commit", json!({"version":a.status(),"intent":input}))
        .is_err());
    assert_eq!(json!(a.status()), status);
    for table in [
        "objects",
        "house_cells",
        "local_cells",
        "spatial",
        "occupancy_spatial",
        "history",
    ] {
        assert_eq!(
            a.db.query_row(&format!("SELECT count(*) FROM {table}"), [], |r| r
                .get::<_, i64>(0))
                .unwrap(),
            0
        );
    }
    assert_eq!(a.allocator().unwrap().next, 1);
    a.db.execute_batch("DROP TRIGGER fail_history").unwrap();
    assert_eq!(edit(&mut a, "commit", input)["objects"], preview["objects"]);
}
#[test]
fn cell_budget_is_per_generation_and_follow_of_more_than_100000_existing_cells_is_complete() {
    let mut a = AtlasApplication::new().unwrap();
    let mut input = road_input();
    input["road"]["nodes"][1]["point"] = json!([10000, 0]);
    let created = edit(&mut a, "commit", input);
    let road: Road = serde_json::from_value(created["objects"][0].clone()).unwrap();
    let settings = json!({"side":"both","setback":5,"gap":0,"minWidth":64,"maxWidth":64,"minDepth":64,"maxDepth":64,"seed":1,"parcelDepth":null});
    for _ in 0..2 {
        let result = edit(
            &mut a,
            "commit",
            json!({"type":"populate","roadId":road.id,"settings":settings}),
        );
        assert_eq!(result["generationSummary"]["limited"], true);
        let houses = result["objects"]
            .as_array()
            .unwrap()
            .iter()
            .filter(|o| o["kind"] == "house")
            .count();
        assert_eq!(houses, 24);
        assert!(houses * 64 * 64 <= 100_000);
    }
    let total: i64 =
        a.db.query_row("SELECT count(*) FROM local_cells", [], |r| r.get(0))
            .unwrap();
    assert_eq!(total, 196608);
    let revision = a.revision;
    assert_eq!(
        edit(
            &mut a,
            "commit",
            json!({"type":"populate","roadId":road.id,"settings":settings})
        )["changed"],
        false
    );
    assert_eq!(revision, a.revision);
    a.db.flush_prepared_statement_cache();
    a.db.authorizer(Some(|ctx: AuthContext<'_>| match ctx.action {
        AuthAction::Read { table_name, .. }
        | AuthAction::Update { table_name, .. }
        | AuthAction::Insert { table_name }
        | AuthAction::Delete { table_name }
            if ["house_cells", "local_cells"].contains(&table_name) =>
        {
            Authorization::Deny
        }
        _ => Authorization::Allow,
    }));
    let result = edit(&mut a, "commit", move_road(&road, 1000.0));
    assert_eq!(
        result["objects"]
            .as_array()
            .unwrap()
            .iter()
            .filter(|o| o["kind"] == "house")
            .count(),
        48
    );
    assert_eq!(result["generationSummary"]["limited"], false);
    a.history(false).unwrap();
    a.history(true).unwrap();
}
#[test]
fn empty_parcels_count_towards_200_limit_and_detach_releases_one_slot_without_refilling_old_side() {
    let mut a = AtlasApplication::new().unwrap();
    let mut input = road_input();
    input["road"]["nodes"][1]["point"] = json!([10000, 0]);
    let created = edit(&mut a, "commit", input);
    let road: Road = serde_json::from_value(created["objects"][0].clone()).unwrap();
    let settings = json!({"side":"both","setback":5,"gap":10,"minWidth":4,"maxWidth":4,"minDepth":4,"maxDepth":4,"seed":1,"parcelDepth":null});
    let result = edit(
        &mut a,
        "commit",
        json!({"type":"populate","roadId":road.id,"settings":settings}),
    );
    assert_eq!(result["generationSummary"]["limited"], true);
    assert_eq!(a.parcel_headers_for_road(&road.id).unwrap().len(), 200);
    let p = a.parcel_headers_for_road(&road.id).unwrap()[0].clone();
    let h = a.house_header_for_parcel(&p.id).unwrap().unwrap();
    edit(&mut a, "commit", json!({"type":"delete","id":h.id}));
    assert_eq!(
        edit(
            &mut a,
            "commit",
            json!({"type":"populate","roadId":road.id,"settings":settings})
        )["changed"],
        false
    );
    assert_eq!(a.parcel_headers_for_road(&road.id).unwrap().len(), 200);
    edit(&mut a, "commit", json!({"type":"detachParcel","id":p.id}));
    assert_eq!(a.parcel_headers_for_road(&road.id).unwrap().len(), 199);
    let result = edit(
        &mut a,
        "commit",
        json!({"type":"populate","roadId":road.id,"settings":settings}),
    );
    assert_eq!(result["generationSummary"]["limited"], true);
    assert_eq!(
        result["objects"]
            .as_array()
            .unwrap()
            .iter()
            .filter(|o| o["kind"] == "parcel")
            .count(),
        1
    );
    assert_eq!(a.parcel_headers_for_road(&road.id).unwrap().len(), 200);
    assert!(a.house_header_for_parcel(&p.id).unwrap().is_none());
    // Follow must validate and move the entire maximum-size dependency set.
    let invalid = a
        .request(
            "preview",
            json!({"version":a.status(),"intent":move_road(&a.road(&road.id).unwrap(),1000.0)}),
        )
        .unwrap();
    assert_eq!(invalid["valid"], true);
    assert_eq!(
        invalid["objects"]
            .as_array()
            .unwrap()
            .iter()
            .filter(|o| o["kind"] == "parcel")
            .count(),
        200
    );
}
#[test]
fn authored_stairs_doors_rooms_and_noncanonical_interior_payload_bytes_survive_follow_history() {
    let (mut a, r, _, h) = fixture(4);
    for (floor, cells) in [
        (
            1,
            (0..4)
                .flat_map(|y| (0..4).map(move |x| json!([x, y])))
                .collect::<Vec<_>>(),
        ),
        (-1, vec![json!([0, 0]), json!([1, 0])]),
    ] {
        edit(
            &mut a,
            "commit",
            json!({"type":"room","buildingId":h.id,"intent":{"kind":"draw","floor":floor,"cells":cells}}),
        );
    }
    edit(
        &mut a,
        "commit",
        json!({"type":"room","buildingId":h.id,"intent":{"kind":"rename","roomId":"room-0","name":"Named room"}}),
    );
    edit(
        &mut a,
        "commit",
        json!({"type":"connection","buildingId":h.id,"intent":{"action":"createStairs","floor":0,"x":0,"y":0,"direction":"south","length":3}}),
    );
    let authored = a.house(&h.id).unwrap();
    assert_eq!(authored.connections.len(), 2);
    // Storage bytes need not be rewritten into a different whitespace/order
    // representation merely because an exterior header moved.
    a.db.execute(
        "UPDATE objects SET metadata=? WHERE id=?",
        params![
            serde_json::to_string_pretty(&authored.metadata()).unwrap(),
            h.id
        ],
    )
    .unwrap();
    a.db.execute(
        "UPDATE house_cells SET payload=? WHERE building_id=?",
        params![serde_json::to_string_pretty(&authored.cells).unwrap(), h.id],
    )
    .unwrap();
    let before = raw_interior(&a, &h.id);
    edit(&mut a, "commit", move_road(&r, 100.0));
    for redo in [false, true, false, true] {
        a.history(redo).unwrap();
        assert_eq!(raw_interior(&a, &h.id), before);
        let next = a.house(&h.id).unwrap();
        assert_eq!(next.rooms, authored.rooms);
        assert_eq!(next.connections, authored.connections);
        assert_eq!(next.cells, authored.cells);
        assert_eq!(next.placement, authored.placement);
    }
    let mut rotated = a.road(&r.id).unwrap();
    for node in &mut rotated.nodes {
        node.point = [-node.point[1], node.point[0]];
    }
    edit(&mut a, "commit", update_road(&rotated));
    assert_eq!(raw_interior(&a, &h.id), before);
    let rotated = a.house(&h.id).unwrap();
    assert_eq!(rotated.placement, authored.placement);
    assert!((rotated.transform.angle - std::f64::consts::FRAC_PI_2).abs() < 1e-12);
}
#[test]
fn exhausted_state_or_revision_rejects_before_any_sql_commit() {
    for state_exhausted in [true, false] {
        let (mut a, r, _, h) = fixture(2);
        if state_exhausted {
            a.next_state = u64::MAX;
        } else {
            a.revision = i64::MAX;
        }
        let status = json!(a.status());
        let before = a.house(&h.id).unwrap();
        assert!(a
            .request(
                "commit",
                json!({"version":a.status(),"intent":move_road(&r,100.0)})
            )
            .is_err());
        assert_eq!(json!(a.status()), status);
        assert_eq!(a.house(&h.id).unwrap(), before);
    }
}
#[test]
fn invalid_follow_parcel_geometry_has_safe_path_issue_instead_of_a_broken_parcel_object() {
    let (mut a, r, _, _) = fixture(2);
    let mut proposed = r.clone();
    proposed.nodes[0].outgoing = Some([4000.0, 0.0]);
    proposed.nodes[1].incoming = Some([-2000.0, 0.0]);
    let invalid = edit(&mut a, "preview", update_road(&proposed));
    assert_eq!(invalid["valid"], false);
    assert_eq!(invalid["issues"][0]["code"], "parcelGeometry");
    assert_eq!(invalid["issues"][0]["geometry"]["kind"], "path");
    assert!(invalid["issues"][0]["geometry"]["points"].is_array());
    assert!(invalid["proposedObjects"]
        .as_array()
        .unwrap()
        .iter()
        .all(|o| o["kind"] != "parcel"));
}
#[test]
fn actual_bezier_insert_preserves_existing_node_section_owner_grid_and_interior_identity() {
    let (mut a, r, p, h) = fixture(4);
    let pose = GridPose {
        x_cells: 0,
        y_cells: 10,
        quarter_turns: QuarterTurns(0),
    };
    let transform = parcel_geometry::parcel_house_transform(&p.frame, &pose).unwrap();
    edit(
        &mut a,
        "commit",
        json!({"type":"transformHouse","id":h.id,"transform":transform}),
    );
    let mut curved = r.clone();
    curved.nodes[0].outgoing = Some([500.0, 100.0]);
    curved.nodes[1].incoming = Some([1500.0, 100.0]);
    edit(&mut a, "commit", update_road(&curved));
    let before = a.house(&h.id).unwrap();
    let raw = raw_interior(&a, &h.id);
    let road = a.road(&r.id).unwrap();
    edit(
        &mut a,
        "commit",
        json!({"type":"insertRoadNode","roadId":r.id,"afterNodeId":r.nodes[0].id,"t":0.37}),
    );
    let split = a.road(&r.id).unwrap();
    assert_eq!(split.nodes[0].id, road.nodes[0].id);
    assert_eq!(split.nodes[2].id, road.nodes[1].id);
    assert_eq!(split.edge_sections, vec![road.edge_sections[0].clone(); 2]);
    assert_eq!(split.sections, road.sections);
    let after = a.house(&h.id).unwrap();
    assert_eq!(after.placement, before.placement);
    assert_eq!(after.rooms, before.rooms);
    assert_eq!(after.connections, before.connections);
    assert_eq!(after.cells, before.cells);
    assert_eq!(raw_interior(&a, &h.id), raw);
    a.history(false).unwrap();
    assert_eq!(a.house(&h.id).unwrap(), before);
    assert_eq!(a.road(&r.id).unwrap(), road);
    a.history(true).unwrap();
    assert_eq!(a.house(&h.id).unwrap(), after);
}

fn generation_invariants(response: &Value) {
    assert!(response.get("skipped").is_none());
    assert!(response.get("limited").is_none());
    let s = &response["generationSummary"];
    let diagnostics = response["generationDiagnostics"].as_array().unwrap();
    let parcels = diagnostics
        .iter()
        .filter(|d| d["target"] == "parcel")
        .count();
    let houses = diagnostics
        .iter()
        .filter(|d| d["target"] == "house")
        .count();
    assert_eq!(s["skippedParcels"], parcels);
    assert_eq!(s["emptyParcels"], houses);
    assert_eq!(s["unplacedHouses"], houses);
    assert_eq!(
        s["createdParcels"].as_u64().unwrap() - s["createdHouses"].as_u64().unwrap(),
        houses as u64
    );
    assert_eq!(s["limited"], !response["generationLimit"].is_null());
    for d in diagnostics {
        assert!(d["roadId"].is_string());
        assert!(d["sectionId"].is_string());
        assert!(d["slotIndex"].is_u64());
        assert!(d["message"].is_string());
        if d["target"] == "house" {
            assert!(d["parcelId"].as_str().unwrap().starts_with("parcel-"));
        } else {
            assert!(d.get("parcelId").is_none());
        }
    }
}
#[test]
fn empty_parcels_have_real_ids_manual_owner_and_header_only_follow() {
    let mut a = AtlasApplication::new().unwrap();
    let mut input = road_input();
    input["road"]["nodes"][1]["point"] = json!([100, 0]);
    input["population"] = json!({"side":"both","setback":5,"gap":10,"minWidth":2,"maxWidth":2,"minDepth":2,"maxDepth":2,"seed":1,"parcelDepth":5});
    let preview = edit(&mut a, "preview", input.clone());
    generation_invariants(&preview);
    let before_id = a.allocator().unwrap().next;
    assert_eq!(before_id, 1);
    let commit = edit(&mut a, "commit", input);
    for field in [
        "objects",
        "generationSummary",
        "generationDiagnostics",
        "generationLimit",
    ] {
        assert_eq!(preview[field], commit[field]);
    }
    generation_invariants(&commit);
    assert_eq!(
        commit["generationSummary"],
        json!({"createdParcels":10,"createdHouses":0,"emptyParcels":10,"skippedParcels":0,"unplacedHouses":10,"limited":false})
    );
    assert_eq!(a.allocator().unwrap().next, 15); // road + 2 nodes + section + ten parcels
    let road_json = commit["objects"]
        .as_array()
        .unwrap()
        .iter()
        .find(|o| o["kind"] == "road")
        .unwrap();
    let r: Road = serde_json::from_value(road_json.clone()).unwrap();
    assert_eq!(
        r.population_recipe.as_ref().unwrap().algorithm_version,
        AlgorithmVersion
    );
    assert_eq!(road_json["populationRecipe"]["algorithmVersion"], 4);
    let parcel = a.parcel_headers_for_road(&r.id).unwrap()[0].clone();
    let again = edit(
        &mut a,
        "commit",
        json!({"type":"populate","roadId":r.id,"settings":r.population_recipe.as_ref().unwrap().settings}),
    );
    assert_eq!(again["changed"], false);
    assert_eq!(
        again["generationSummary"],
        json!(generation::GenerationSummary::default())
    );
    let result = edit(
        &mut a,
        "commit",
        json!({"type":"createParcelHouse","parcelId":parcel.id,"floor":0,"cells":[[-1,0],[0,0]]}),
    );
    generation_invariants(&result);
    let SceneObject::House(house) = serde_json::from_value(result["objects"][0].clone()).unwrap()
    else {
        panic!("house header")
    };
    assert_eq!(house.id, "house-15");
    assert_eq!(house.name, "Haus 1");
    let payload = raw_interior(&a, &house.id);
    let follow = edit(&mut a, "commit", move_road(&r, 200.0));
    generation_invariants(&follow);
    assert_eq!(
        follow["generationSummary"],
        json!(generation::GenerationSummary::default())
    );
    let next = a.required_house_header(&house.id).unwrap();
    assert_eq!(next.placement, house.placement);
    assert_eq!(next.transform.y, house.transform.y + 200.0);
    assert_eq!(raw_interior(&a, &house.id), payload);
    assert_eq!(a.parcel_headers_for_road(&r.id).unwrap().len(), 10);
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("r3-format11.saltatlas");
    a.save(&path).unwrap();
    let db = Connection::open(&path).unwrap();
    assert_eq!(
        db.query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0))
            .unwrap(),
        persistence::FORMAT_VERSION
    );
    drop(db);
    let mut reopened = AtlasApplication::new().unwrap();
    reopened.open(&path).unwrap();
    assert_eq!(reopened.required_house_header(&house.id).unwrap(), next);
    assert_eq!(reopened.parcel_headers_for_road(&r.id).unwrap().len(), 10);
}
#[test]
fn mirrored_curves_preview_commit_and_invalid_proposed_generation() {
    for bend in [-1.0, 1.0] {
        let mut a = AtlasApplication::new().unwrap();
        let mut input = road_input();
        input["road"]["nodes"][1]["point"] = json!([200, 0]);
        input["road"]["nodes"][0]["outgoing"] = json!([50, 20.0 * bend]);
        input["road"]["nodes"][1]["incoming"] = json!([150, 20.0 * bend]);
        input["population"] = json!({"side":"both","setback":5,"gap":10,"minWidth":4,"maxWidth":7,"minDepth":4,"maxDepth":8,"seed":1,"parcelDepth":null});
        let preview = edit(&mut a, "preview", input.clone());
        assert_eq!(preview["valid"], true);
        generation_invariants(&preview);
        let committed = edit(&mut a, "commit", input);
        generation_invariants(&committed);
        for field in [
            "objects",
            "generationSummary",
            "generationDiagnostics",
            "generationLimit",
        ] {
            assert_eq!(preview[field], committed[field]);
        }
        let parcels = committed["objects"]
            .as_array()
            .unwrap()
            .iter()
            .filter(|o| o["kind"] == "parcel")
            .collect::<Vec<_>>();
        for side in ["left", "right"] {
            assert!(parcels.iter().any(|p| p["source"]["side"] == side
                && a.house_header_for_parcel(p["id"].as_str().unwrap())
                    .unwrap()
                    .is_some()));
        }
    }
    let mut a = AtlasApplication::new().unwrap();
    edit(
        &mut a,
        "commit",
        json!({"type":"createArea","area":{"material":"water","points":[[80,-4],[120,-4],[120,4],[80,4]]}}),
    );
    let mut input = road_input();
    input["road"]["nodes"][1]["point"] = json!([200, 0]);
    input["population"] = json!({"side":"both","setback":5,"gap":10,"minWidth":2,"maxWidth":2,"minDepth":2,"maxDepth":2,"seed":1,"parcelDepth":5});
    let preview = edit(&mut a, "preview", input.clone());
    assert_eq!(preview["valid"], false);
    generation_invariants(&preview);
    assert!(
        preview["generationSummary"]["createdParcels"]
            .as_u64()
            .unwrap()
            > 0
    );
    assert_eq!(
        preview["generationSummary"]["createdParcels"],
        preview["proposedObjects"]
            .as_array()
            .unwrap()
            .iter()
            .filter(|p| p["kind"] == "parcel")
            .count()
    );
    let before = a.allocator().unwrap().next;
    let error = a
        .request("commit", json!({"version":a.status(),"intent":input}))
        .unwrap_err();
    assert_eq!(json!(error.issue.unwrap()), preview["issues"][0]);
    assert_eq!(a.allocator().unwrap().next, before);
}

#[test]
fn mixed_generation_diagnostics_match_commit_and_skips_allocate_no_identity() {
    let mut a = AtlasApplication::new().unwrap();
    edit(
        &mut a,
        "commit",
        json!({"type":"createArea","area":{"material":"water","points":[[-1,9],[19,9],[19,16],[-1,16]]}}),
    );
    let mut input = road_input();
    input["road"]["nodes"][1]["point"] = json!([100, 0]);
    input["population"] = json!({"side":"both","setback":5,"gap":10,"minWidth":2,"maxWidth":2,"minDepth":2,"maxDepth":2,"seed":1,"parcelDepth":5});
    let preview = edit(&mut a, "preview", input.clone());
    assert_eq!(preview["valid"], true);
    generation_invariants(&preview);
    assert_eq!(preview["generationSummary"]["skippedParcels"], 1);
    assert_eq!(preview["generationSummary"]["emptyParcels"], 9);
    let committed = edit(&mut a, "commit", input);
    generation_invariants(&committed);
    for field in [
        "objects",
        "generationSummary",
        "generationDiagnostics",
        "generationLimit",
    ] {
        assert_eq!(preview[field], committed[field]);
    }
    assert_eq!(a.allocator().unwrap().next, 15); // area + road/nodes/section + nine parcels
    let parcels: HashSet<_> = committed["objects"]
        .as_array()
        .unwrap()
        .iter()
        .filter(|p| p["kind"] == "parcel")
        .map(|p| p["id"].as_str().unwrap())
        .collect();
    for d in committed["generationDiagnostics"].as_array().unwrap() {
        if d["target"] == "house" {
            assert!(parcels.contains(d["parcelId"].as_str().unwrap()));
        } else {
            assert_eq!(d["code"], "parcelCollision");
            assert_eq!(d["obstacleIds"], json!(["area-1"]));
        }
    }
}

#[test]
fn explicit_layout_parcels_only_resize_and_history_are_atomic() {
    let mut app = AtlasApplication::new().unwrap();
    let mut input = road_input();
    input["road"]["nodes"][1]["point"] = json!([160, 0]);
    input["population"] = json!({"houses":false,"side":"right","setback":5,"gap":10,"minWidth":2,"maxWidth":6,"minDepth":2,"maxDepth":6,"seed":1,"parcelDepth":40,"layout":[
        {"key":"a","section":0,"side":"right","start":0.0,"end":0.4,"setback":5,"depth":40,"width":6,"houseDepth":6,"roofIndex":0,"excluded":false},
        {"key":"b","section":0,"side":"right","start":0.5,"end":1.0,"setback":5,"depth":40,"width":6,"houseDepth":6,"roofIndex":1,"excluded":true}
    ]});
    let preview = edit(&mut app, "preview", input.clone());
    let result = edit(&mut app, "commit", input);
    assert_eq!(preview["objects"], result["objects"]);
    assert_eq!(result["generationSummary"]["createdParcels"], 1);
    assert_eq!(result["generationSummary"]["createdHouses"], 0);
    assert_eq!(result["generationSummary"]["unplacedHouses"], 0);
    let objects = result["objects"].as_array().unwrap();
    let SceneObject::Parcel(p) = serde_json::from_value(
        objects
            .iter()
            .find(|o| o["kind"] == "parcel")
            .unwrap()
            .clone(),
    )
    .unwrap() else {
        panic!("parcel")
    };
    let SceneObject::Road(r) = serde_json::from_value(
        objects
            .iter()
            .find(|o| o["kind"] == "road")
            .unwrap()
            .clone(),
    )
    .unwrap() else {
        panic!("road")
    };
    assert!(r.population_recipe.unwrap().settings.layout.is_none());
    let update =
        json!({"type":"updateParcel","id":p.id,"start":0.0,"end":0.4,"setback":7,"depth":20});
    let checked = edit(&mut app, "preview", update.clone());
    assert_eq!(checked["valid"], true);
    edit(&mut app, "commit", update);
    let changed = app.parcel(&p.id).unwrap();
    assert_ne!(p, changed);
    app.history(false).unwrap();
    assert_eq!(app.parcel(&p.id).unwrap(), p);
    app.history(true).unwrap();
    assert_eq!(app.parcel(&p.id).unwrap(), changed);
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("planned.saltatlas");
    app.save(&path).unwrap();
    let mut reopened = AtlasApplication::new().unwrap();
    reopened.open(&path).unwrap();
    assert_eq!(reopened.parcel(&p.id).unwrap(), changed);
}

#[test]
fn planned_house_shrinks_but_existing_house_blocks_small_parcel() {
    let mut app = AtlasApplication::new().unwrap();
    let mut input = road_input();
    input["road"]["nodes"][1]["point"] = json!([160, 0]);
    input["population"] = json!({"side":"right","setback":5,"gap":0,"minWidth":2,"maxWidth":6,"minDepth":2,"maxDepth":6,"seed":1,"parcelDepth":40,"layout":[
      {"key":"a","section":0,"side":"right","start":0.0,"end":0.5,"setback":5,"depth":15,"width":6,"houseDepth":6,"roofIndex":0,"excluded":false}
    ]});
    let result = edit(&mut app, "commit", input);
    assert_eq!(result["generationSummary"]["createdHouses"], 1);
    let objects = result["objects"].as_array().unwrap();
    let SceneObject::House(h) = serde_json::from_value(
        objects
            .iter()
            .find(|o| o["kind"] == "house")
            .unwrap()
            .clone(),
    )
    .unwrap() else {
        panic!("house")
    };
    let SceneObject::Parcel(p) = serde_json::from_value(
        objects
            .iter()
            .find(|o| o["kind"] == "parcel")
            .unwrap()
            .clone(),
    )
    .unwrap() else {
        panic!("parcel")
    };
    assert_eq!(app.house(&h.id).unwrap().cells.len(), 18);
    let before = app.house(&h.id).unwrap();
    let invalid = edit(
        &mut app,
        "preview",
        json!({"type":"updateParcel","id":p.id,"start":0.0,"end":0.5,"setback":5,"depth":5}),
    );
    assert_eq!(invalid["valid"], false);
    assert_eq!(app.house(&h.id).unwrap(), before);
    let moved = edit(
        &mut app,
        "commit",
        json!({"type":"updateParcel","id":p.id,"start":0.0,"end":0.5,"setback":20,"depth":20}),
    );
    assert_eq!(moved["changed"], true);
    assert_eq!(app.house(&h.id).unwrap().cells, before.cells);
}

#[test]
fn roughening_follows_bound_house_without_rewriting_interior() {
    let (mut app, road, parcel, house) = fixture(2);
    let before = raw_interior(&app, &house.id);
    let action =
        json!({"type":"roughenRoad","roadId":road.id,"roughness":{"amount":0.2,"seed":42}});
    let preview = edit(&mut app, "preview", action.clone());
    assert_eq!(preview["valid"], true, "{preview}");
    let result = edit(&mut app, "commit", action);
    assert_eq!(preview["objects"], result["objects"]);
    assert_eq!(before, raw_interior(&app, &house.id));
    let after = app.parcel(&parcel.id).unwrap();
    assert_eq!(after.source, parcel.source);
    assert_ne!(after.polygon, parcel.polygon);
    history(&mut app, false);
    assert_eq!(app.parcel(&parcel.id).unwrap(), parcel);
    assert_eq!(before, raw_interior(&app, &house.id));
}

#[test]
fn adaptive_short_road_population_preview_history_and_file_roundtrip() {
    let mut app = AtlasApplication::new().unwrap();
    let mut input = road_input();
    input["road"]["nodes"][1]["point"] = json!([25, 0]);
    input["population"] = json!({"side":"both","setback":5,"gap":10,"minWidth":4,"maxWidth":7,"minDepth":4,"maxDepth":8,"seed":1,"parcelDepth":null});
    let preview = edit(&mut app, "preview", input.clone());
    assert_eq!(preview["valid"], true);
    assert_eq!(preview["generationSummary"]["createdHouses"], 2);
    let committed = edit(&mut app, "commit", input);
    generation_invariants(&committed);
    assert_eq!(preview["objects"], committed["objects"]);
    assert_eq!(preview["generationSummary"], committed["generationSummary"]);
    let parcels: Vec<Parcel> = committed["objects"]
        .as_array()
        .unwrap()
        .iter()
        .filter(|o| o["kind"] == "parcel")
        .map(|o| match serde_json::from_value(o.clone()).unwrap() {
            SceneObject::Parcel(p) => p,
            _ => unreachable!(),
        })
        .collect();
    assert_eq!(parcels.len(), 2);
    app.history(false).unwrap();
    for p in &parcels {
        assert!(app.parcel(&p.id).is_err());
    }
    app.history(true).unwrap();
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("adaptive.saltatlas");
    app.save(&path).unwrap();
    let mut reopened = AtlasApplication::new().unwrap();
    reopened.open(&path).unwrap();
    for p in parcels {
        assert_eq!(reopened.parcel(&p.id).unwrap(), p);
    }
}
