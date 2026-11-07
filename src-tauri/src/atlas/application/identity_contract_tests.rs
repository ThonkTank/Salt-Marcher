use super::application_test_support::{request_edit as edit, *};
use super::*;
use rusqlite::hooks::{AuthAction, AuthContext, Authorization};

fn create(x: f64) -> Value {
    json!({"type":"createHouse","parcelId":null,"transform":{"x":x,"y":0,"angle":0},"width":2,"depth":2})
}
fn counter(a: &AtlasApplication) -> i64 {
    a.db.query_row("SELECT next_identity FROM document_meta", [], |r| r.get(0))
        .unwrap()
}
#[test]
fn strict_wire_unions_require_owners_and_discrete_rotation() {
    for bad in [
        json!({"kind":"parcel","gridPose":{"xCells":0,"yCells":0,"quarterTurns":0}}),
        json!({"kind":"free","parcelId":"parcel-1"}),
        json!({"kind":"parcel","parcelId":"parcel-1","gridPose":{"xCells":0,"yCells":0,"quarterTurns":4}}),
        json!({"kind":"parcel","parcelId":"parcel-1","gridPose":{"xCells":0.5,"yCells":0,"quarterTurns":0}}),
    ] {
        assert!(
            serde_json::from_value::<Placement>(bad.clone()).is_err(),
            "accepted {bad}"
        );
    }
    assert!(
        serde_json::from_value::<ParcelSource>(json!({"kind":"detached","roadId":"road-1"}))
            .is_err()
    );
    assert!(serde_json::from_value::<EditorContext>(json!({"kind":"house"})).is_err());
    let mut missing = create(0.0);
    missing.as_object_mut().unwrap().remove("parcelId");
    assert!(serde_json::from_value::<Intent>(missing).is_err());
    assert!(serde_json::from_value::<AlgorithmVersion>(json!(1)).is_err());
    assert_eq!(serde_json::to_value(AlgorithmVersion).unwrap(), json!(4));
}
#[test]
fn allocator_is_local_atomic_monotone_and_separate_from_history_state() {
    let mut a = AtlasApplication::new().unwrap();
    let preview = edit(&mut a, "preview", create(0.0));
    assert_eq!(counter(&a), 1);
    let committed = edit(&mut a, "commit", create(0.0));
    assert_eq!(preview["objects"], committed["objects"]);
    assert_eq!(committed["objects"][0]["id"], "house-1");
    assert_eq!(counter(&a), 2);
    assert_eq!(edit(&mut a, "preview", create(0.0))["valid"], false);
    assert_eq!(counter(&a), 2);
    let id = committed["objects"][0]["id"].as_str().unwrap();
    assert_eq!(
        edit(
            &mut a,
            "commit",
            json!({"type":"rename","id":id,"name":"Haus 1"})
        )["changed"],
        false
    );
    assert_eq!(counter(&a), 2);
    edit(
        &mut a,
        "commit",
        json!({"type":"rename","id":id,"name":"Inn"}),
    );
    a.history(false).unwrap();
    a.history(false).unwrap();
    assert_eq!(counter(&a), 2);
    let branch = edit(&mut a, "commit", create(30.0));
    assert_eq!(branch["objects"][0]["id"], "house-2");
    assert_eq!(counter(&a), 3);
    let temp = tempfile::tempdir().unwrap();
    let path = temp.path().join("counter.saltatlas");
    a.save(&path).unwrap();
    let mut b = AtlasApplication::new().unwrap();
    b.open(&path).unwrap();
    assert_eq!(counter(&b), 3);
    b.db.execute("UPDATE document_meta SET next_identity=?", [i64::MAX])
        .unwrap();
    let status = json!(b.status());
    assert!(b
        .request(
            "commit",
            json!({"version":b.status(),"intent":create(100.0)})
        )
        .is_err());
    assert_eq!(json!(b.status()), status);
    assert_eq!(counter(&b), i64::MAX);
}
#[test]
fn failed_sql_write_rolls_back_objects_indices_counter_and_history() {
    let mut a = AtlasApplication::new().unwrap();
    a.db.execute_batch("CREATE TEMP TRIGGER fail_history BEFORE INSERT ON history BEGIN SELECT RAISE(ABORT,'injected failure'); END;").unwrap();
    let before = json!(a.status());
    assert!(a
        .request("commit", json!({"version":a.status(),"intent":create(0.0)}))
        .is_err());
    assert_eq!(json!(a.status()), before);
    assert_eq!(counter(&a), 1);
    for table in [
        "objects",
        "spatial",
        "occupancy_spatial",
        "map_houses",
        "house_cells",
        "local_cells",
        "history",
    ] {
        let count: i64 =
            a.db.query_row(&format!("SELECT count(*) FROM {table}"), [], |r| r.get(0))
                .unwrap();
        assert_eq!(count, 0, "{table}");
    }
    a.db.execute_batch("DROP TRIGGER fail_history").unwrap();
    assert_eq!(
        edit(&mut a, "commit", create(0.0))["objects"][0]["id"],
        "house-1"
    );
}
#[test]
fn road_nodes_and_sections_share_allocator_and_retain_identity_on_edits() {
    let mut a = AtlasApplication::new().unwrap();
    let r=edit(&mut a,"commit",json!({"type":"createRoad","road":{"name":"Road","width":10,"material":"earth","nodes":[{"point":[0,0],"incoming":null,"outgoing":null},{"point":[100,0],"incoming":null,"outgoing":null},{"point":[200,0],"incoming":null,"outgoing":null}]},"population":null}))["objects"][0].clone();
    assert_eq!(r["id"], "road-1");
    assert_eq!(r["nodes"][0]["id"], "node-2");
    assert_eq!(r["edgeSections"], json!(["section-5", "section-6"]));
    assert_eq!(counter(&a), 7);
    let mut moved = r.clone();
    moved["nodes"][1]["point"] = json!([100, 10]);
    let next = edit(
        &mut a,
        "commit",
        crate::atlas::test_inputs::update_road(&moved),
    );
    assert_eq!(next["objects"][0]["edgeSections"], r["edgeSections"]);
    assert_eq!(counter(&a), 7);
    let mut road: Road = serde_json::from_value(r).unwrap();
    road.nodes.push(Node {
        id: "node-99".into(),
        point: [300.0, 0.0],
        incoming: None,
        outgoing: None,
    });
    road.edge_sections.push(road.edge_sections[0].clone());
    assert!(validate_road_identity(&road).is_err());
}
#[test]
fn all_floor_union_and_spatial_index_follow_cells_pose_undo_and_redo() {
    let mut a = AtlasApplication::new().unwrap();
    let id = edit(&mut a, "commit", create(0.0))["objects"][0]["id"]
        .as_str()
        .unwrap()
        .to_owned();
    edit(
        &mut a,
        "commit",
        json!({"type":"room","buildingId":id,"intent":{"kind":"draw","floor":-1,"cells":[[8,8],[8,9]]}}),
    );
    let h = a.house(&id).unwrap();
    assert_eq!(h.contours.len(), 1);
    assert_eq!(h.occupancy_contours.len(), 2);
    assert_eq!(h.occupancy_bounds, [0.0, 0.0, 45.0, 50.0]);
    let roof_bounds = FullObject::House(h.clone()).bounds();
    assert_eq!(roof_bounds, [0.0, 0.0, 10.0, 10.0]);
    let index = |a: &AtlasApplication| -> Bounds {
        a.db.query_row("SELECT s.min_x,s.min_y,s.max_x,s.max_y FROM occupancy_spatial s JOIN objects o ON s.key=o.rowid WHERE o.id=?",[&id],|r|Ok([r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?])).unwrap()
    };
    assert_eq!(index(&a), h.occupancy_bounds);
    edit(
        &mut a,
        "commit",
        json!({"type":"transformHouse","id":id,"transform":{"x":20,"y":30,"angle":0}}),
    );
    assert_eq!(index(&a), [20.0, 30.0, 65.0, 80.0]);
    a.history(false).unwrap();
    assert_eq!(index(&a), h.occupancy_bounds);
    a.history(true).unwrap();
    assert_eq!(index(&a), [20.0, 30.0, 65.0, 80.0]);
    edit(&mut a, "commit", json!({"type":"delete","id":id}));
    assert_eq!(
        a.db.query_row("SELECT count(*) FROM occupancy_spatial", [], |r| r
            .get::<_, i64>(0))
            .unwrap(),
        0
    );
}
#[test]
fn headers_reject_hidden_payloads_and_owner_queries_are_indexed_without_interiors() {
    let mut a = AtlasApplication::new().unwrap();
    let p = Parcel {
        id: "parcel-100".into(),
        source: ParcelSource::Detached {},
        polygon: vec![[0.0, 0.0], [100.0, 0.0], [100.0, 100.0], [0.0, 100.0]],
        frame: Transform {
            x: 0.0,
            y: 0.0,
            angle: 0.0,
        },
    };
    storage::write_object(&a.db, &FullObject::Parcel(p.clone()), false).unwrap();
    let mut h = interior::new_house("house-101".into(), p.frame.clone(), 2, 2, 0).unwrap();
    h.placement = Placement::Parcel {
        parcel_id: p.id.clone(),
        grid_pose: GridPose {
            x_cells: 0,
            y_cells: 0,
            quarter_turns: QuarterTurns(0),
        },
    };
    storage::write_object(&a.db, &FullObject::House(h.clone()), true).unwrap();
    let body = serde_json::to_value(SceneObject::House(h.header())).unwrap();
    assert!(body.get("cells").is_none() && body.get("rooms").is_none());
    for field in ["cells", "rooms", "connections", "roomCounter"] {
        let mut bad = body.clone();
        bad[field] = json!([]);
        assert!(
            storage::parse_house_parts(&bad.to_string(), &json!(h.metadata()).to_string()).is_err()
        );
    }
    let mut second = h.clone();
    second.id = "house-102".into();
    assert!(storage::write_object(&a.db, &FullObject::House(second), false).is_err());
    let plan:String=a.db.query_row("EXPLAIN QUERY PLAN SELECT body FROM objects WHERE kind='house' AND json_extract(body,'$.placement.kind')='parcel' AND json_extract(body,'$.placement.parcelId')=?",[&p.id],|r|r.get(3)).unwrap();
    assert!(plan.contains("house_parcel_owner"), "{plan}");
    a.db.flush_prepared_statement_cache();
    a.db.authorizer(Some(|ctx: AuthContext<'_>| match ctx.action {
        AuthAction::Read { table_name, .. }
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
    let scene=a.request("scene",json!({"bounds":[1000,1000,1010,1010],"context":{"kind":"parcel","parcelId":p.id},"selectedId":h.id})).unwrap();
    assert_eq!(
        scene["contextState"],
        json!({"exists":true,"parcelId":p.id,"houseId":h.id})
    );
    assert_eq!(scene["selectionState"], scene["contextState"]);
    assert_eq!(scene["objects"].as_array().unwrap().len(), 2);
    let empty=a.request("scene",json!({"bounds":[1000,1000,1010,1010],"context":{"kind":"parcel","parcelId":"missing"}})).unwrap();
    assert_eq!(empty["contextState"]["exists"], false);
}
