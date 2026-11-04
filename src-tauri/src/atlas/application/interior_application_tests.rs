//! Document integration: atomic edits, persistence, ownership and adapter errors.
use super::application_test_support::{request_edit as edit, *};
use super::{storage_tests, *};
use crate::interior::{LocalEdit, RoomIntent};

fn create(a: &mut AtlasApplication) -> String {
    edit(a, "commit", json!({"type":"createHouse","parcelId":null,"transform":{"x":0,"y":0,"angle":0},"width":4,"depth":3}))["objects"][0]["id"]
        .as_str().unwrap().to_owned()
}
fn room(id: &str, intent: Value) -> Value {
    json!({"type":"room", "buildingId":id, "intent":intent})
}
fn history(a: &mut AtlasApplication, redo: bool) {
    a.request("history", json!({"version":a.status(), "redo":redo}))
        .unwrap();
}

#[test]
fn production_solver_survives_session_replacement() {
    {
        let mut a = AtlasApplication::new().unwrap();
        let id = create(&mut a);
        edit(
            &mut a,
            "commit",
            room(&id, json!({"kind":"draw","floor":0,"cells":[[4,0]]})),
        );

        let session = a.session.clone();
        a.request("new", json!({})).unwrap();
        assert_ne!(a.session, session);

        let id = create(&mut a);
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("session.saltatlas");
        a.request("save", json!({"path":path})).unwrap();
        let session = a.session.clone();
        a.request("open", json!({"path":path})).unwrap();
        assert_ne!(a.session, session);
        assert_eq!(a.revision, 0);
        assert!(!a.status().dirty);

        edit(
            &mut a,
            "commit",
            room(&id, json!({"kind":"draw","floor":0,"cells":[[4,0]]})),
        );

        let mut second = AtlasApplication::new().unwrap();
        second.request("open", json!({"path":path})).unwrap();
    }

    let mut a = AtlasApplication::new().unwrap();
    let id = edit(&mut a,"commit",json!({"type":"createHouse","parcelId":null,"transform":{"x":0,"y":0,"angle":0},"width":2,"depth":2}))["objects"][0]["id"].as_str().unwrap().to_owned();
    edit(
        &mut a,
        "commit",
        room(&id, json!({"kind":"move","roomId":"room-0","dx":1,"dy":0})),
    );
}

#[test]
fn real_move_preview_history_and_format11_roundtrip() {
    let mut a = AtlasApplication::new().unwrap();
    let id = create(&mut a);
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("authored.saltatlas");
    a.request("save", json!({"path":path})).unwrap();
    let before_house = a.house(&id).unwrap();
    assert_eq!(before_house.connections[0].offset, 0.5);
    let before = storage_tests::dump(&a);
    let intent = room(&id, json!({"kind":"move","roomId":"room-0","dx":2,"dy":1}));
    let preview = edit(&mut a, "preview", intent.clone());
    assert_eq!(preview["valid"], true);
    assert_eq!(storage_tests::dump(&a), before);

    let revision = a.revision;
    let cursor = a.cursor;
    let committed = edit(&mut a, "commit", intent);
    for field in [
        "version",
        "objects",
        "removed",
        "deletedIds",
        "cascadeCounts",
        "removedConnections",
        "changed",
        "generationSummary",
        "generationDiagnostics",
        "generationLimit",
    ] {
        assert_eq!(preview[field], committed[field], "{field}");
    }

    assert_eq!(a.revision, revision + 1);
    assert_eq!(a.cursor, cursor + 1);
    assert!(a.status().dirty && a.status().can_undo && !a.status().can_redo);
    let moved = a.house(&id).unwrap();
    let mut expected_cells = before_house.cells.clone();
    for cell in &mut expected_cells {
        cell.x += 2;
        cell.y += 1;
    }
    assert_eq!(moved.cells, expected_cells);
    assert_eq!(moved.rooms, before_house.rooms);
    assert_eq!(
        (moved.room_counter, moved.connection_counter),
        (before_house.room_counter, before_house.connection_counter)
    );
    assert_eq!(
        (
            &moved.id,
            &moved.name,
            &moved.roof,
            &moved.placement,
            &moved.transform
        ),
        (
            &before_house.id,
            &before_house.name,
            &before_house.roof,
            &before_house.placement,
            &before_house.transform
        )
    );
    let mut opening = before_house.connections[0].clone();
    opening.base.x += 2;
    opening.base.y += 1;
    assert_eq!(moved.connections, vec![opening]);
    let hints = a.status().changes.unwrap();
    assert_eq!(hints.interiors.len(), 1);
    assert_eq!(hints.interiors[0].building_id, id);
    assert_eq!(hints.interiors[0].floor, 0);
    assert_eq!(hints.interiors[0].bounds, [0.0, 0.0, 5.0, 3.0]);
    let indices_after: Value = storage_tests::dump(&a)[7].clone();
    history(&mut a, false);
    assert_eq!(a.house(&id).unwrap(), before_house);
    assert!(!a.status().dirty && a.status().can_redo);
    history(&mut a, true);
    assert_eq!(a.house(&id).unwrap(), moved);
    assert!(a.status().dirty && !a.status().can_redo);
    // Real redo reconstructs the same objects, payload and both local/spatial indices.
    assert_eq!(
        storage_tests::dump(&a)[7].as_array().unwrap()[0..5],
        indices_after.as_array().unwrap()[0..5]
    );
    a.request("save", json!({"path":path})).unwrap();
    assert!(!a.status().dirty);
    let rows = storage_tests::snapshot_rows(&path);
    let payloads = storage_tests::payload_rows(&path);
    let db = Connection::open(&path).unwrap();
    assert_eq!(
        db.query_row("PRAGMA user_version", [], |r| r.get::<_, i64>(0))
            .unwrap(),
        persistence::FORMAT_VERSION
    );
    let tables: Vec<String> = db
        .prepare("SELECT name FROM sqlite_schema WHERE type='table' ORDER BY name")
        .unwrap()
        .query_map([], |r| r.get(0))
        .unwrap()
        .collect::<rusqlite::Result<_>>()
        .unwrap();
    assert_eq!(
        tables,
        vec![
            "document_meta",
            "house_cells",
            "objects",
            "terrain",
            "terrain_settings"
        ]
    );
    drop(db);
    let session = a.session.clone();
    a.request("open", json!({"path":path})).unwrap();

    assert_ne!(a.session, session);
    assert_eq!(a.revision, 0);
    assert!(!a.status().dirty && !a.status().can_undo && !a.status().can_redo);
    assert_eq!(a.house(&id).unwrap(), moved);
    let second = dir.path().join("again.saltatlas");
    a.request("save", json!({"path":second})).unwrap();
    assert_eq!(storage_tests::snapshot_rows(&second), rows);
    assert_eq!(storage_tests::payload_rows(&second), payloads);
}

#[test]
fn move_rejections_and_late_document_sql_failures_are_atomic() {
    let mut a = AtlasApplication::new().unwrap();
    let id = create(&mut a);
    let cells: Vec<_> = (0..3).flat_map(|y| (0..4).map(move |x| [x, y])).collect();
    edit(
        &mut a,
        "commit",
        room(&id, json!({"kind":"draw","floor":1,"cells":cells})),
    );
    edit(
        &mut a,
        "commit",
        json!({"type":"connection","buildingId":id,"intent":{"action":"createStairs","floor":0,"x":0,"y":1,"direction":"east","length":3}}),
    );
    let house = a.house(&id).unwrap();
    let stair = house
        .connections
        .iter()
        .find(|c| matches!(c.shape, crate::interior::ConnectionShape::Stairs { .. }))
        .unwrap()
        .clone();
    let upper = house
        .rooms
        .iter()
        .find(|r| r.floor == 1)
        .unwrap()
        .id
        .clone();
    let intent = room(&id, json!({"kind":"move","roomId":upper,"dx":5,"dy":0}));
    let preview = edit(&mut a, "preview", intent.clone());
    assert_eq!(
        preview["removedConnections"],
        json!([{"buildingId":id,"connection":stair}])
    );
    let before = storage_tests::dump(&a);
    for trigger in [
        "CREATE TEMP TRIGGER fail_history BEFORE INSERT ON history BEGIN SELECT RAISE(ABORT,'injected history'); END;",
        "CREATE TEMP TRIGGER fail_local_insert BEFORE INSERT ON local_cells BEGIN SELECT RAISE(ABORT,'injected local index'); END;",
    ] {
        a.db.execute_batch(trigger).unwrap();
        let error = a.request("commit",json!({"version":a.status(),"intent":intent})).unwrap_err();
        assert_eq!(error.category,ErrorCategory::Storage);
        assert!(error.issue.is_none());

        assert_eq!(storage_tests::dump(&a),before);
        a.db.execute_batch("DROP TRIGGER IF EXISTS fail_history; DROP TRIGGER IF EXISTS fail_local_insert;").unwrap();
    }
    for invalid in [
        room(&id, json!({"kind":"move","roomId":"missing","dx":1,"dy":0})),
        room(
            &id,
            json!({"kind":"move","roomId":"room-0","dx":9223372036854775807_i64,"dy":0}),
        ),
    ] {
        let preview = edit(&mut a, "preview", invalid.clone());
        assert_eq!(preview["valid"], false);
        let error = a
            .request("commit", json!({"version":a.status(),"intent":invalid}))
            .unwrap_err();
        assert_eq!(error.category, ErrorCategory::InvalidInput);
        assert_eq!(preview["reason"], error.message);
        assert_eq!(preview["issues"], json!([error.issue.unwrap()]));
        assert_eq!(storage_tests::dump(&a), before);
    }
    let committed = edit(&mut a, "commit", intent);
    assert_eq!(
        committed["removedConnections"],
        preview["removedConnections"]
    );
    let moved = a.house(&id).unwrap();
    assert!(!moved.connections.iter().any(|c| c.id == stair.id));
    assert_eq!(a.cursor, before[1].as_i64().unwrap() + 1);
    history(&mut a, false);
    assert_eq!(a.house(&id).unwrap(), house);
    // Zero move is a real no-op; preserve saved redo/history/allocator.
    let unchanged = storage_tests::dump(&a);
    let response = edit(
        &mut a,
        "commit",
        room(&id, json!({"kind":"move","roomId":"room-0","dx":0,"dy":0})),
    );
    assert_eq!(response["changed"], false);
    assert_eq!(storage_tests::dump(&a), unchanged);
    history(&mut a, true);
    assert_eq!(a.house(&id).unwrap(), moved);
}

#[test]
fn roof_and_local_errors_preserve_context_and_precedence() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("order.saltatlas");
    let (house, mut live) = {
        let mut a = AtlasApplication::new().unwrap();
        let id = create(&mut a);
        let cells: Vec<_> = (0..3).flat_map(|y| (0..4).map(move |x| [x, y])).collect();
        edit(
            &mut a,
            "commit",
            room(&id, json!({"kind":"draw","floor":1,"cells":cells})),
        );
        edit(
            &mut a,
            "commit",
            json!({"type":"connection","buildingId":id,"intent":{"action":"createStairs","floor":0,"x":0,"y":1,"direction":"east","length":3}}),
        );
        a.save(&path).unwrap();
        let house = a.house(&id).unwrap();
        edit(
            &mut a,
            "commit",
            room(
                &id,
                json!({"kind":"rename","roomId":"room-0","name":"First edit"}),
            ),
        );
        edit(
            &mut a,
            "commit",
            room(
                &id,
                json!({"kind":"rename","roomId":"room-0","name":"Second edit"}),
            ),
        );
        history(&mut a, false);
        assert!(a.status().dirty && a.status().can_redo);
        (house, a)
    };
    let pristine = std::fs::read(&path).unwrap();
    for (case, expected_validate, expected_edit) in [
        (
            "roof",
            expected_invalid("Invalid metadata", &["house-1"]),
            expected_invalid("Invalid metadata", &["house-1"]),
        ),
        (
            "opening",
            expected_invalid("Ungültiger Öffnungsversatz", &[]),
            expected_invalid("Invalid metadata", &["house-1"]),
        ),
        (
            "counter",
            expected_invalid("Ungültige Innenraumzähler", &[]),
            expected_invalid("Invalid metadata", &["house-1"]),
        ),
        (
            "duplicate",
            AppError::storage("UNIQUE constraint failed: cells.floor, cells.x, cells.y"),
            AppError::storage("UNIQUE constraint failed: cells.floor, cells.x, cells.y"),
        ),
        (
            "cell_fk",
            AppError::storage("FOREIGN KEY constraint failed"),
            AppError::storage("FOREIGN KEY constraint failed"),
        ),
        (
            "internal_fk",
            expected_invalid("Fremde Verbindung", &[]),
            expected_invalid("Fremde Verbindung", &[]),
        ),
        (
            "room_metadata",
            expected_invalid("Invalid metadata", &["house-1"]),
            expected_invalid("Invalid metadata", &["house-1"]),
        ),
        (
            "disconnected",
            expected_invalid("Invalid metadata", &["house-1"]),
            expected_invalid("Invalid metadata", &["house-1"]),
        ),
        (
            "stair_reference",
            expected_invalid("Invalid metadata", &["house-1"]),
            expected_invalid("Invalid metadata", &["house-1"]),
        ),
    ] {
        let mut h = house.clone();
        h.roof = "invalid roof".into();
        match case {
            "roof" => {}
            "opening" => h.connections[0].offset = 0.25,
            "counter" => h.room_counter = 0,
            "duplicate" => h.cells.push(h.cells[0].clone()),
            "cell_fk" => h.cells[0].room_id = "missing".into(),
            "internal_fk" => h.connections[1].base.to_room = Some("missing".into()),
            "room_metadata" => h.rooms[0].name = " ".into(),
            "disconnected" => h.cells[0].x = -10,
            "stair_reference" => {
                for cell in &mut h.cells {
                    if cell.floor == 1 {
                        cell.x += 10;
                    }
                }
            }
            _ => unreachable!(),
        }
        let operation = || {
            LocalEdit::Room(RoomIntent::Move {
                room_id: "room-0".into(),
                dx: 0,
                dy: 0,
            })
        };
        std::fs::write(&path, &pristine).unwrap();
        let db = Connection::open(&path).unwrap();
        let mut body: Value = serde_json::from_str(
            &db.query_row("SELECT body FROM objects WHERE id=?", [&h.id], |r| {
                r.get::<_, String>(0)
            })
            .unwrap(),
        )
        .unwrap();
        body["roof"] = json!(h.roof);
        body["rooms"] = json!(h.rooms);
        body["connections"] = json!(h.connections);
        body["roomCounter"] = json!(h.room_counter);
        db.execute(
            "UPDATE objects SET body=? WHERE id=?",
            params![body.to_string(), h.id],
        )
        .unwrap();
        db.execute(
            "UPDATE house_cells SET payload=? WHERE building_id=?",
            params![serde_json::to_string(&h.cells).unwrap(), h.id],
        )
        .unwrap();
        drop(db);
        let corrupted = std::fs::read(&path).unwrap();
        let before = storage_tests::dump(&live);
        assert_eq!(storage_tests::dump(&live), before, "old {case}");
        assert_eq!(std::fs::read(&path).unwrap(), corrupted);

        {
            assert_eq!(
                interior::validate(&h).unwrap_err(),
                expected_validate,
                "validate {case}"
            );
            assert_eq!(
                interior::edit(&h, operation()).unwrap_err(),
                expected_edit,
                "edit {case}"
            );
            assert_eq!(
                live.open(&path).unwrap_err(),
                expected_validate,
                "open {case}"
            );
            assert_eq!(storage_tests::dump(&live), before, "open {case}");
            assert_eq!(std::fs::read(&path).unwrap(), corrupted);
        }
    }
    // Foreign owners fail without rewriting imported author data.
    std::fs::write(&path, &pristine).unwrap();
    let db = Connection::open(&path).unwrap();
    db.execute(
        "UPDATE objects SET body=json_set(body,'$.rooms[0].buildingId','foreign') WHERE id=?",
        [&house.id],
    )
    .unwrap();
    drop(db);
    let corrupted = std::fs::read(&path).unwrap();
    let before = storage_tests::dump(&live);

    let error = live.open(&path).unwrap_err();
    assert_eq!(error.message, "Invalid room owner");
    assert_eq!(error.issue.unwrap().object_ids, vec![house.id]);

    assert_eq!(storage_tests::dump(&live), before);
    assert_eq!(std::fs::read(&path).unwrap(), corrupted);
    history(&mut live, true);
    history(&mut live, false);
}

#[test]
fn room_rename_retains_metadata_fastpath() {
    use rusqlite::hooks::{AuthAction, AuthContext, Authorization};
    let mut a = AtlasApplication::new().unwrap();
    let id = create(&mut a);

    a.db.flush_prepared_statement_cache();
    a.db.authorizer(Some(|ctx: AuthContext<'_>| match ctx.action {
        AuthAction::Read {
            table_name: "house_cells" | "local_cells",
            ..
        }
        | AuthAction::Insert {
            table_name: "house_cells" | "local_cells",
        }
        | AuthAction::Update {
            table_name: "house_cells" | "local_cells",
            ..
        }
        | AuthAction::Delete {
            table_name: "house_cells" | "local_cells",
        } => Authorization::Deny,
        _ => Authorization::Allow,
    }));
    let intent = room(
        &id,
        json!({"kind":"rename","roomId":"room-0","name":"Renamed"}),
    );
    edit(&mut a, "preview", intent.clone());
    edit(&mut a, "commit", intent.clone());
    assert_eq!(a.status().changes.unwrap().metadata, vec![id]);
    assert!(a.status().changes.unwrap().interiors.is_empty());
    let status = json!(a.status());
    assert_eq!(edit(&mut a, "commit", intent)["changed"], false);
    assert_eq!(json!(a.status()), status);
    history(&mut a, false);
    history(&mut a, true);
    a.db.authorizer(None::<fn(AuthContext<'_>) -> Authorization>);
}

#[test]
fn population_and_final_parcel_founding_use_real_validator() {
    let mut a = AtlasApplication::new().unwrap();
    let result = edit(
        &mut a,
        "commit",
        json!({"type":"createRoad","road":{"name":"Road","width":10,"material":"earth","nodes":[{"point":[0,0],"incoming":null,"outgoing":null},{"point":[160,0],"incoming":null,"outgoing":null}]},"population":{"side":"both","setback":5,"gap":20,"minWidth":4,"maxWidth":4,"minDepth":4,"maxDepth":4,"seed":1,"parcelDepth":80}}),
    );
    let houses: Vec<_> = result["objects"]
        .as_array()
        .unwrap()
        .iter()
        .filter(|o| o["kind"] == "house")
        .collect();
    assert!(!houses.is_empty());

    let id = houses[0]["id"].as_str().unwrap().to_owned();
    let h = a.house(&id).unwrap();
    let Placement::Parcel { parcel_id, .. } = h.placement else {
        unreachable!()
    };
    edit(&mut a, "commit", json!({"type":"delete","id":id}));
    let action =
        json!({"type":"createParcelHouse","parcelId":parcel_id,"floor":-1,"cells":[[0,1],[2,1]]});
    let before = storage_tests::dump(&a);
    let preview = edit(&mut a, "preview", action.clone());
    assert_eq!(preview["valid"], true);
    assert_eq!(storage_tests::dump(&a), before);

    a.db.execute_batch("CREATE TEMP TRIGGER fail_history BEFORE INSERT ON history BEGIN SELECT RAISE(ABORT,'injected founding history'); END;").unwrap();
    let error = a
        .request("commit", json!({"version":a.status(),"intent":action}))
        .unwrap_err();
    assert_eq!(error.category, ErrorCategory::Storage);
    assert_eq!(storage_tests::dump(&a), before);

    a.db.execute_batch("DROP TRIGGER fail_history").unwrap();
    let result = edit(&mut a, "commit", action);
    assert_eq!(result["objects"], preview["objects"]);

    let id = result["objects"][0]["id"].as_str().unwrap();
    let h = a.house(id).unwrap();
    assert_eq!(h.room_counter, 2);
    assert_eq!(h.connection_counter, 0);
    assert_eq!(
        h.rooms
            .iter()
            .map(|r| (&*r.id, r.created, r.floor, &*r.building_id))
            .collect::<Vec<_>>(),
        vec![("room-0", 0, -1, id), ("room-1", 1, -1, id)]
    );
    assert_eq!(
        h.cells
            .iter()
            .map(|c| (c.x, c.y, &*c.room_id))
            .collect::<Vec<_>>(),
        vec![(0, 1, "room-0"), (2, 1, "room-1")]
    );
    assert!(h.contours.is_empty());
    assert!(!h.occupancy_contours.is_empty());
    history(&mut a, false);
    assert!(a.house(id).is_err());
    history(&mut a, true);
    assert_eq!(a.house(id).unwrap(), h);
}

// Each action uses the actual compute, transactional apply and serialized history.
fn checked_action(a: &mut AtlasApplication, intent: Value) -> Value {
    let before = storage_tests::dump(a);
    let before_author = author_state(a);
    let preview = edit(a, "preview", intent.clone());
    assert_eq!(preview["valid"], true, "{preview}");
    assert_eq!(storage_tests::dump(a), before);
    let cursor = a.cursor;
    let revision = a.revision;
    let result = edit(a, "commit", intent);
    for field in [
        "version",
        "objects",
        "removed",
        "deletedIds",
        "cascadeCounts",
        "removedConnections",
        "changed",
        "generationSummary",
        "generationDiagnostics",
        "generationLimit",
    ] {
        assert_eq!(preview[field], result[field], "{field}");
    }
    assert_eq!(result["changed"], true);
    assert_eq!(a.cursor, cursor + 1);
    assert_eq!(a.revision, revision + 1);
    let after_author = author_state(a);
    let next_identity = a.allocator().unwrap().next;
    history(a, false);
    assert_eq!(author_state(a), before_author);
    assert_eq!(a.allocator().unwrap().next, next_identity);
    history(a, true);
    assert_eq!(author_state(a), after_author);
    assert_eq!(a.allocator().unwrap().next, next_identity);
    result
}
// Successful deletion/undo may reassign SQLite rowids. Compare exact stored
// fields and raw payload by authored key, and bind both RTrees to that same ID.
// Rejections still compare the unsorted complete dump including history/allocator.
fn author_state(a: &AtlasApplication) -> Value {
    let snapshot = storage_tests::dump(a);
    let mut tables = snapshot[7].as_array().unwrap()[..3].to_vec();
    for table in &mut tables {
        table[1]
            .as_array_mut()
            .unwrap()
            .sort_by_key(Value::to_string);
    }
    let spatial:Vec<Value>=["spatial","occupancy_spatial"].into_iter().map(|table|{
        let mut q=a.db.prepare(&format!("SELECT o.id,s.min_x,s.max_x,s.min_y,s.max_y FROM {table} s JOIN objects o ON o.rowid=s.key ORDER BY o.id")).unwrap();
        let rows:Vec<_>=q.query_map([],|r|Ok(json!([r.get::<_,String>(0)?,r.get::<_,f64>(1)?,r.get::<_,f64>(2)?,r.get::<_,f64>(3)?,r.get::<_,f64>(4)?]))).unwrap().collect::<rusqlite::Result<_>>().unwrap();
        let count:i64=a.db.query_row(&format!("SELECT count(*) FROM {table}"),[],|r|r.get(0)).unwrap();assert_eq!(count as usize,rows.len());json!([table,rows])
    }).collect();
    json!([tables, spatial])
}
fn reject(a: &mut AtlasApplication, intent: Value) -> AppError {
    let before = storage_tests::dump(a);
    let p = edit(a, "preview", intent.clone());
    assert_eq!(p["valid"], false, "{p}");
    let e = a
        .request("commit", json!({"version":a.status(),"intent":intent}))
        .unwrap_err();
    assert_eq!(e.category, ErrorCategory::InvalidInput);
    assert_eq!(p["reason"], e.message);
    assert_eq!(p["issues"], json!([e.issue.clone().unwrap()]));
    assert_eq!(storage_tests::dump(a), before);
    e
}
fn connection(id: &str, intent: Value) -> Value {
    json!({"type":"connection","buildingId":id,"intent":intent})
}
fn seed(a: &mut AtlasApplication) -> String {
    let id = edit(a,"commit",json!({"type":"createHouse","parcelId":null,"transform":{"x":0,"y":0,"angle":0},"width":1,"depth":1}))["objects"][0]["id"].as_str().unwrap().to_owned();
    for c in a.house(&id).unwrap().connections {
        edit(
            a,
            "commit",
            connection(&id, json!({"action":"delete","connectionId":c.id})),
        );
    }
    id
}
fn draw(a: &mut AtlasApplication, id: &str, floor: i64, cells: &[[i64; 2]]) {
    edit(
        a,
        "commit",
        room(id, json!({"kind":"draw","floor":floor,"cells":cells})),
    );
}
fn tile(a: &mut AtlasApplication, id: &str, floor: i64, bounds: Bounds, lower: bool) -> Value {
    a.request(
        "interiorTile",
        json!({"buildingId":id,"floor":floor,"bounds":bounds,"includeLower":lower}),
    )
    .unwrap()
}
fn metadata(a: &mut AtlasApplication, id: &str) -> Value {
    a.request("interiorMetadata", json!({"buildingId":id}))
        .unwrap()
}
fn cell_rows(a: &AtlasApplication, id: &str) -> Vec<(i64, i64, i64, String)> {
    a.db.prepare("SELECT floor,x,y,room_id FROM local_cells WHERE building_id=? ORDER BY floor,y,x")
        .unwrap()
        .query_map([id], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)))
        .unwrap()
        .collect::<rusqlite::Result<_>>()
        .unwrap()
}
fn payload(a: &AtlasApplication, id: &str) -> String {
    a.db.query_row(
        "SELECT payload FROM house_cells WHERE building_id=?",
        [id],
        |r| r.get(0),
    )
    .unwrap()
}

fn stairs(id: &str, floor: i64, x: i64, y: i64, direction: &str, length: i64) -> Value {
    connection(
        id,
        json!({"action":"createStairs","floor":floor,"x":x,"y":y,"direction":direction,"length":length}),
    )
}

fn stair_fixture(moved_floor: i64, notched: bool) -> (AtlasApplication, String, String) {
    let mut a = AtlasApplication::new().unwrap();
    let id = seed(&mut a);
    for floor in [0, 1] {
        let shape: Vec<_> = if notched && floor == moved_floor {
            (0..5)
                .flat_map(|x| [[x, 0], [x, -2]])
                .chain([[0, -1], [4, -1]])
                .collect()
        } else {
            (-1..=5).map(|x| [x, 0]).collect()
        };
        draw(&mut a, &id, floor, &shape);
    }
    let intent = stairs(&id, 0, 0, 0, "east", 5);
    edit(&mut a, "commit", intent);
    let moving = a
        .house(&id)
        .unwrap()
        .rooms
        .iter()
        .find(|r| r.floor == moved_floor)
        .unwrap()
        .id
        .clone();
    (a, id, moving)
}

#[test]
fn grown_room_move_exceeds_selection_limit_without_truncation() {
    let mut a = AtlasApplication::new().unwrap();
    let id=edit(&mut a,"commit",json!({"type":"createHouse","parcelId":null,"transform":{"x":0,"y":0,"angle":0},"width":100000,"depth":1}))["objects"][0]["id"].as_str().unwrap().to_owned();
    draw(&mut a, &id, 0, &[[99999, 0], [100000, 0]]);
    let before = a.house(&id).unwrap();
    assert_eq!(before.cells.len(), 100001);
    checked_action(
        &mut a,
        room(&id, json!({"kind":"move","roomId":"room-0","dx":1,"dy":0})),
    );
    let after = a.house(&id).unwrap();
    let expected: Vec<_> = before
        .cells
        .iter()
        .cloned()
        .map(|mut c| {
            c.x += 1;
            c
        })
        .collect();
    assert_eq!(after.cells, expected);
    assert_eq!(after.rooms, before.rooms);
    assert_eq!(
        (after.room_counter, after.connection_counter),
        (before.room_counter, before.connection_counter)
    );
    assert_eq!(
        cell_rows(&a, &id),
        after
            .cells
            .iter()
            .map(|c| (c.floor, c.x, c.y, c.room_id.clone()))
            .collect::<Vec<_>>()
    );
    for (x, exists) in [(0, false), (100001, true)] {
        let t = tile(&mut a, &id, 0, [x as f64, 0.0, x as f64, 0.0], false);
        assert_eq!(
            t["cells"].as_array().unwrap().iter().any(|c| c["x"] == x),
            exists
        );
    }
    let big_payload = payload(&a, &id);
    let big_index = cell_rows(&a, &id);
    let big_meta = metadata(&mut a, &id)["rooms"].clone();
    let small=edit(&mut a,"commit",json!({"type":"createHouse","parcelId":null,"transform":{"x":0,"y":100,"angle":0},"width":2,"depth":2}))["objects"][0]["id"].as_str().unwrap().to_owned();
    draw(&mut a, &small, 0, &[[2, 0]]);
    history(&mut a, false);
    draw(&mut a, &small, -1, &[[0, 0]]);
    assert!(!a.status().can_redo);
    assert_eq!(payload(&a, &id), big_payload);
    assert_eq!(cell_rows(&a, &id), big_index);
    assert_eq!(metadata(&mut a, &id)["rooms"], big_meta);
    assert_eq!(a.house(&id).unwrap(), after);
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("grown.saltatlas");
    a.save(&path).unwrap();
    let raw = storage_tests::payload_rows(&path);
    a.open(&path).unwrap();
    assert_eq!(a.house(&id).unwrap(), after);
    let second = dir.path().join("grown-again.saltatlas");
    a.save(&second).unwrap();
    assert_eq!(storage_tests::payload_rows(&second), raw);
}

#[test]
fn roof_occupancy_lower_and_tile_bounds_stay_outer_contracts() {
    let mut a = AtlasApplication::new().unwrap();
    let id = create(&mut a);
    checked_action(
        &mut a,
        room(&id, json!({"kind":"erase","floor":0,"cells":[[1,1]]})),
    );
    let courtyard = a.house(&id).unwrap();
    assert_eq!(courtyard.contours.len(), 2);
    draw(&mut a, &id, 3, &[[10, 10]]);
    let upper = a.house(&id).unwrap();
    assert_eq!(upper.contours.len(), 3);
    draw(&mut a, &id, -9, &[[20, 20]]);
    let basement = a.house(&id).unwrap();
    assert_eq!(basement.contours, upper.contours);
    assert_ne!(basement.occupancy_contours, upper.occupancy_contours);
    for (f, cs) in [
        (-9, vec![[30, 30], [31, 30], [32, 30], [33, 30]]),
        (-2, vec![[30, 30], [31, 30]]),
        (3, vec![[30, 30]]),
        (8, vec![[30, 30]]),
    ] {
        draw(&mut a, &id, f, &cs);
    }
    let t = tile(&mut a, &id, 3, [30.0, 30.0, 30.0, 30.0], true);
    assert_eq!(
        t["lower"]
            .as_array()
            .unwrap()
            .iter()
            .map(|c| (
                c["floor"].as_i64().unwrap(),
                c["x"].as_i64().unwrap(),
                c["y"].as_i64().unwrap(),
                c["roomId"].as_str().unwrap()
            ))
            .collect::<Vec<_>>(),
        vec![(-2, 30, 30, "room-4"), (-2, 31, 30, "room-4")]
    );
    let t = tile(&mut a, &id, 0, [31.0, 30.0, 31.0, 30.0], true);
    assert_eq!(
        t["lower"]
            .as_array()
            .unwrap()
            .iter()
            .map(|c| (c["floor"].as_i64().unwrap(), c["x"].as_i64().unwrap()))
            .collect::<Vec<_>>(),
        vec![(-2, 30), (-2, 31), (-9, 32)]
    );
    assert_eq!(
        tile(
            &mut a,
            &id,
            i64::from(i32::MIN),
            [30.0, 30.0, 30.0, 30.0],
            true
        )["lower"],
        json!([])
    );
    let before = storage_tests::dump(&a);
    for b in [
        json!([1, 0, 0, 0]),
        json!([0, 0, 400, 400]),
        json!([0, 0, 1_000_002, 0]),
        json!([null, 0, 0, 0]),
    ] {
        assert!(a
            .request(
                "interiorTile",
                json!({"buildingId":id,"floor":0,"bounds":b,"includeLower":true})
            )
            .is_err());
        assert_eq!(storage_tests::dump(&a), before);
    }
    for floor in [i64::from(i32::MIN) - 1, i64::from(i32::MAX) + 1] {
        assert!(a
            .request(
                "interiorTile",
                json!({"buildingId":id,"floor":floor,"bounds":[0,0,0,0],"includeLower":true})
            )
            .is_err());
    }
    assert!(a
        .request(
            "interiorTile",
            json!({"buildingId":"missing","floor":0,"bounds":[0,0,0,0],"includeLower":false})
        )
        .is_err());
    for edge in [-1_000_001.0, 1_000_001.0] {
        assert!(
            tile(&mut a, &id, 0, [edge, edge, edge, edge], false)["cells"]
                .as_array()
                .unwrap()
                .is_empty()
        );
    }
    // Exact house area formula: 100000 accepted, next integral width rejected.
    tile(&mut a, &id, 0, [0.0, 0.0, 997.0, 97.0], false);
    assert!(a
        .request(
            "interiorTile",
            json!({"buildingId":id,"floor":0,"bounds":[0,0,998,97],"includeLower":false})
        )
        .is_err());
}

#[test]
fn expansion_collisions_and_parcel_containment_reject_atomically() {
    for (obstacle, floor) in ["house", "road", "water", "parcel"]
        .into_iter()
        .flat_map(|o| [-1, 0].map(|f| (o, f)))
    {
        let mut a = AtlasApplication::new().unwrap();
        let id = seed(&mut a);
        let target = if obstacle == "parcel" {
            let r = edit(
                &mut a,
                "commit",
                json!({"type":"createRoad","road":{"name":"R","width":10,"material":"earth","nodes":[{"point":[100,100],"incoming":null,"outgoing":null},{"point":[260,100],"incoming":null,"outgoing":null}]},"population":{"side":"right","setback":5,"gap":20,"minWidth":4,"maxWidth":4,"minDepth":4,"maxDepth":4,"seed":1,"parcelDepth":80}}),
            );
            let pid = r["objects"]
                .as_array()
                .unwrap()
                .iter()
                .find(|o| o["kind"] == "parcel")
                .unwrap()["id"]
                .as_str()
                .unwrap()
                .to_owned();
            let hid = a.house_header_for_parcel(&pid).unwrap().unwrap().id;
            edit(&mut a, "commit", json!({"type":"delete","id":hid}));
            let FullObject::Parcel(p) = a.object(&pid).unwrap() else {
                unreachable!()
            };
            [
                (p.frame.x / 5.0).round() as i64,
                (p.frame.y / 5.0).round() as i64 + 1,
            ]
        } else {
            match obstacle {
                "house" => {
                    edit(
                        &mut a,
                        "commit",
                        json!({"type":"createHouse","parcelId":null,"transform":{"x":50,"y":50,"angle":0},"width":2,"depth":2}),
                    );
                }
                "road" => {
                    edit(
                        &mut a,
                        "commit",
                        json!({"type":"createRoad","road":{"name":"R","width":10,"material":"earth","nodes":[{"point":[40,52],"incoming":null,"outgoing":null},{"point":[80,52],"incoming":null,"outgoing":null}]},"population":null}),
                    );
                }
                "water" => {
                    edit(
                        &mut a,
                        "commit",
                        json!({"type":"createArea","area":{"material":"water","points":[[49,49],[61,49],[61,61],[49,61]]}}),
                    );
                }
                _ => unreachable!(),
            }
            [10, 10]
        };
        let e = reject(
            &mut a,
            room(&id, json!({"kind":"draw","floor":floor,"cells":[target]})),
        );
        assert_eq!(e.issue.unwrap().code, IssueCode::Collision, "{obstacle}");
    }
    let mut a = AtlasApplication::new().unwrap();
    let result = edit(
        &mut a,
        "commit",
        json!({"type":"createRoad","road":{"name":"R","width":10,"material":"earth","nodes":[{"point":[0,0],"incoming":null,"outgoing":null},{"point":[160,0],"incoming":null,"outgoing":null}]},"population":{"side":"right","setback":5,"gap":20,"minWidth":4,"maxWidth":4,"minDepth":4,"maxDepth":4,"seed":1,"parcelDepth":80}}),
    );
    let id = result["objects"]
        .as_array()
        .unwrap()
        .iter()
        .find(|o| o["kind"] == "house")
        .unwrap()["id"]
        .as_str()
        .unwrap()
        .to_owned();
    let e = reject(
        &mut a,
        room(&id, json!({"kind":"draw","floor":-1,"cells":[[100,100]]})),
    );
    assert_eq!(e.issue.unwrap().code, IssueCode::ParcelContainment);
}

#[test]
fn rejections_noops_and_document_read_failures_are_atomic() {
    use rusqlite::hooks::{AuthAction, AuthContext, Authorization};

    let mut a = AtlasApplication::new().unwrap();
    let id = create(&mut a);
    draw(&mut a, &id, 0, &[[8, 0]]);
    for intent in [
        room(&id, json!({"kind":"move","roomId":"missing","dx":1,"dy":0})),
        room(&id, json!({"kind":"move","roomId":"room-0","dx":8,"dy":0})),
        room(
            &id,
            json!({"kind":"move","roomId":"room-0","dx":i64::MIN,"dy":0}),
        ),
        room(
            &id,
            json!({"kind":"move","roomId":"room-0","dx":i64::MAX,"dy":0}),
        ),
        room(
            &id,
            json!({"kind":"draw","floor":i64::from(i32::MAX)+1,"cells":[[0,0]]}),
        ),
        room(
            &id,
            json!({"kind":"draw","floor":0,"cells":[[1_000_001,0]]}),
        ),
        room(
            &id,
            json!({"kind":"draw","floor":0,"cells":[[10,0],[12,0]]}),
        ),
        room(
            &id,
            json!({"kind":"assign","floor":0,"roomId":"room-0","cells":[[8,0]]}),
        ),
        room(
            &id,
            json!({"kind":"draw","floor":0,"cells":vec![[0,0];100001]}),
        ),
        room(
            &id,
            json!({"kind":"rename","roomId":"room-0","name":"界".repeat(121)}),
        ),
        room(
            &id,
            json!({"kind":"rename","roomId":"room-0","name":"  \t"}),
        ),
        connection(
            &id,
            json!({"action":"createOpening","floor":0,"x":1,"y":0,"axis":"horizontal","kind":"door"}),
        ),
        connection(
            &id,
            json!({"action":"createStairs","floor":0,"x":0,"y":0,"direction":"east","length":1}),
        ),
        connection(
            &id,
            json!({"action":"createStairs","floor":0,"x":0,"y":0,"direction":"east","length":65}),
        ),
        connection(
            &id,
            json!({"action":"createStairs","floor":0,"x":0,"y":0,"direction":"east","length":3}),
        ),
        room(
            "missing",
            json!({"kind":"move","roomId":"missing","dx":1,"dy":0}),
        ),
    ] {
        reject(&mut a, intent);
    }
    let before = storage_tests::dump(&a);
    let invalid = room(&id, json!({"kind":"move","roomId":"missing","dx":1,"dy":0}));
    for cmd in ["preview", "commit"] {
        let mut version = json!(a.status());
        version["revision"] = json!(-1);
        let e = a
            .request(cmd, json!({"version":version,"intent":invalid}))
            .unwrap_err();
        assert_eq!(e.category, ErrorCategory::StaleVersion);
        assert!(e.issue.is_none());
    }

    assert_eq!(storage_tests::dump(&a), before);
    for table in ["document_meta", "house_cells"] {
        a.db.flush_prepared_statement_cache();
        a.db.authorizer(Some(move |ctx: AuthContext<'_>| match ctx.action {
            AuthAction::Read { table_name, .. } if table_name == table => Authorization::Deny,
            _ => Authorization::Allow,
        }));
        for cmd in ["preview", "commit"] {
            let e = a
                .request(cmd, json!({"version":a.status(),"intent":invalid}))
                .unwrap_err();
            assert_eq!(e.category, ErrorCategory::Storage);
            assert!(e.issue.is_none());
        }
        a.db.authorizer(None::<fn(AuthContext<'_>) -> Authorization>);
        assert_eq!(storage_tests::dump(&a), before);
    }
}

#[test]
fn active_connection_wire_defaults_length_and_rejects_free_endpoints() {
    let mut a = AtlasApplication::new().unwrap();
    let id = create(&mut a);
    let area: Vec<_> = (0..3).map(|x| [x, 0]).collect();
    draw(&mut a, &id, 1, &area);
    let before = storage_tests::dump(&a);
    for cmd in ["preview", "commit"] {
        let e=a.request(cmd,json!({"version":a.status(),"intent":connection(&id,json!({"action":"createStairs","floor":0,"x":0,"y":0,"toFloor":1,"toX":2,"toY":0}))})).unwrap_err();
        assert_eq!(e.category, ErrorCategory::InvalidInput);
        assert_eq!(storage_tests::dump(&a), before);
    }

    checked_action(
        &mut a,
        connection(
            &id,
            json!({"action":"createStairs","floor":0,"x":0,"y":0,"direction":"east"}),
        ),
    );
    assert!(a
        .house(&id)
        .unwrap()
        .connections
        .iter()
        .any(|c| json!(c.shape) == json!({"type":"stairs","direction":"east","length":3})));
}

fn mutate_saved_house(path: &Path, id: &str, mutator: impl FnOnce(&mut Value, &mut Value)) {
    let db = Connection::open(path).unwrap();
    let mut body: Value = serde_json::from_str(
        &db.query_row("SELECT body FROM objects WHERE id=?", [id], |r| {
            r.get::<_, String>(0)
        })
        .unwrap(),
    )
    .unwrap();
    let mut cells: Value = serde_json::from_str(
        &db.query_row(
            "SELECT payload FROM house_cells WHERE building_id=?",
            [id],
            |r| r.get::<_, String>(0),
        )
        .unwrap(),
    )
    .unwrap();
    let old_cells = cells.clone();
    mutator(&mut body, &mut cells);
    db.execute(
        "UPDATE objects SET body=? WHERE id=?",
        params![body.to_string(), id],
    )
    .unwrap();
    if cells != old_cells {
        db.execute(
            "UPDATE house_cells SET payload=? WHERE building_id=?",
            params![cells.to_string(), id],
        )
        .unwrap();
    }
}
#[test]
fn format11_corruption_preserves_live_session_and_source() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("late-house.saltatlas");
    let (mut live, id) = {
        let mut a = AtlasApplication::new().unwrap();
        seed(&mut a);
        let id=edit(&mut a,"commit",json!({"type":"createHouse","parcelId":null,"transform":{"x":1000,"y":1000,"angle":0},"width":4,"depth":3}))["objects"][0]["id"].as_str().unwrap().to_owned();
        let area: Vec<_> = (0..3).flat_map(|y| (0..4).map(move |x| [x, y])).collect();
        for f in [1, 2] {
            draw(&mut a, &id, f, &area);
        }
        for (f, y) in [(0, 1), (1, 2)] {
            let intent = stairs(&id, f, 0, y, "east", 3);
            edit(&mut a, "commit", intent);
        }
        a.save(&path).unwrap();
        edit(
            &mut a,
            "commit",
            room(
                &id,
                json!({"kind":"rename","roomId":"room-0","name":"Dirty"}),
            ),
        );
        edit(
            &mut a,
            "commit",
            room(
                &id,
                json!({"kind":"rename","roomId":"room-0","name":"Redo"}),
            ),
        );
        history(&mut a, false);
        assert!(a.status().dirty && a.status().can_redo);
        (a, id)
    };
    let pristine = std::fs::read(&path).unwrap();
    for (label, expected) in [
        ("floor_low", expected_invalid("Ungültige Innenraumkoordinaten", &[])),
        ("floor_high", expected_invalid("Ungültige Innenraumkoordinaten", &[])),
        ("stair_room_min", expected_invalid("Stairs require occupied footprints", &["house-2"])),
        ("stair_room_max", expected_invalid("Stairs require occupied footprints", &["house-2"])),
        ("lower_max", expected_invalid("Invalid stair floor", &["house-2"])),
        ("roomCounter_missing", expected_invalid("missing field `roomCounter`", &[])),
        ("roomCounter_negative", expected_invalid("Ungültige Innenraumzähler", &[])),
        ("roomCounter_equal", expected_invalid("Ungültige Innenraumzähler", &[])),
        ("roomCounter_below", expected_invalid("Ungültige Innenraumzähler", &[])),
        ("connectionCounter_missing", expected_invalid("missing field `connectionCounter`", &[])),
        ("connectionCounter_negative", expected_invalid("Ungültige Innenraumzähler", &[])),
        ("connectionCounter_equal", expected_invalid("Ungültige Innenraumzähler", &[])),
        ("connectionCounter_below", expected_invalid("Ungültige Innenraumzähler", &[])),
        ("duplicate_stair", AppError::storage("UNIQUE constraint failed: stair_footprints.floor, stair_footprints.x, stair_footprints.y")),
        ("reversed_stair", AppError::storage("UNIQUE constraint failed: stair_footprints.floor, stair_footprints.x, stair_footprints.y")),
        ("shared_floor_stair", AppError::storage("UNIQUE constraint failed: stair_footprints.floor, stair_footprints.x, stair_footprints.y")),
        ("owner", expected_invalid("Invalid room owner", &["house-2"])),
        ("cell_reference", AppError::storage("FOREIGN KEY constraint failed")),
        ("connection_reference", expected_invalid("Fremde Verbindung", &[])),
        ("room_id_duplicate", expected_invalid("Fremde Verbindung", &[])),
        ("room_created_duplicate", AppError::storage("UNIQUE constraint failed: rooms.created")),
        ("cell_duplicate", AppError::storage("UNIQUE constraint failed: cells.floor, cells.x, cells.y")),
        ("disconnected", expected_invalid("Room is disconnected", &["house-2"])),
        ("offset", expected_invalid("Ungültiger Öffnungsversatz", &[])),
        ("half_support", expected_invalid("Öffnung liegt nicht vollständig auf einer gemeinsamen Wand", &[])),
        ("room_name121", expected_invalid("Invalid metadata", &["house-2"])),
        ("house_name121", expected_invalid("Ungültiger Gebäudename oder Dachfarbe", &["house-2"])),
        ("room_whitespace", expected_invalid("Invalid metadata", &["house-2"])),
        ("house_whitespace", expected_invalid("Ungültiger Gebäudename oder Dachfarbe", &["house-2"])),
        ("coordinate_low", expected_invalid("Ungültige Innenraumkoordinaten", &[])),
        ("coordinate_high", expected_invalid("Ungültige Innenraumkoordinaten", &[])),
        ("upper_legal_shift", expected_invalid("Stairs require occupied footprints", &["house-2"])),
        ("roof", expected_invalid("Invalid metadata", &["house-2"])),
        ("world", expected_invalid("Ungültige Transformation oder Gebäude außerhalb der Welt", &["house-2"])),
        ("external_collision", AppError { category: ErrorCategory::InvalidInput, message: "Überschneidung mit house-2".into(), issue: Some(Box::new(errors::DomainIssue { code: errors::IssueCode::Collision, object_ids: vec!["house-1".into(), "house-2".into()], message: "Überschneidung mit house-2".into(), geometry: Some(errors::IssueGeometry::Bounds { bounds: [0.0, 0.0, 5.0, 5.0] }) })) }),
    ] {
        std::fs::write(&path, &pristine).unwrap();
        mutate_saved_house(&path, &id, |h, cs| match label {
            "floor_low" | "floor_high" | "stair_room_min" | "stair_room_max" => {
                let f = match label {
                    "floor_low" => i64::from(i32::MIN) - 1,
                    "floor_high" => i64::from(i32::MAX) + 1,
                    "stair_room_min" => i64::from(i32::MIN),
                    _ => i64::from(i32::MAX),
                };
                h["rooms"][2]["floor"] = json!(f);
                for c in cs.as_array_mut().unwrap() {
                    if c["floor"] == 2 {
                        c["floor"] = json!(f);
                    }
                }
            }
            "lower_max" => {
                h["connections"][1]["floor"] = json!(i32::MAX);
            }
            l if l.starts_with("roomCounter_") || l.starts_with("connectionCounter_") => {
                let (field, mode) = l.split_once('_').unwrap();
                if mode == "missing" {
                    h.as_object_mut().unwrap().remove(field);
                } else {
                    let max = 2;
                    h[field] = json!(match mode {
                        "negative" => -1,
                        "equal" => max,
                        _ => max - 1,
                    });
                }
            }
            "duplicate_stair" | "reversed_stair" => {
                let mut c = h["connections"][1].clone();
                c["id"] = json!("connection-3");
                c["created"] = json!(3);
                if label == "reversed_stair" {
                    let from = c["fromRoom"].clone();
                    c["fromRoom"] = c["toRoom"].clone();
                    c["toRoom"] = from;
                    c["floor"] = json!(1);
                    c["x"] = json!(2);
                    c["direction"] = json!("west");
                }
                h["connections"].as_array_mut().unwrap().push(c);
                h["connectionCounter"] = json!(4);
            }
            "shared_floor_stair" => {
                h["connections"][2]["y"] = json!(1);
            }
            "owner" => h["rooms"][0]["buildingId"] = json!("foreign"),
            "cell_reference" => cs[0]["roomId"] = json!("missing"),
            "connection_reference" => h["connections"][1]["toRoom"] = json!("missing"),
            "room_id_duplicate" => h["rooms"][2]["id"] = h["rooms"][1]["id"].clone(),
            "room_created_duplicate" => h["rooms"][2]["created"] = h["rooms"][1]["created"].clone(),
            "cell_duplicate" => {
                let c = cs[0].clone();
                cs.as_array_mut().unwrap().push(c);
            }
            "disconnected" => cs[0]["x"] = json!(-10),
            "offset" => h["connections"][0]["offset"] = json!(0.25),
            "half_support" => {
                cs.as_array_mut()
                    .unwrap()
                    .retain(|c| !(c["floor"] == 0 && c["x"] == 2 && c["y"] == 0));
            }
            "room_name121" => h["rooms"][0]["name"] = json!("界".repeat(121)),
            "house_name121" => h["name"] = json!("界".repeat(121)),
            "room_whitespace" => h["rooms"][0]["name"] = json!(" \t"),
            "house_whitespace" => h["name"] = json!(" \t"),
            "coordinate_low" => cs[0]["x"] = json!(-1_000_001),
            "coordinate_high" => cs[0]["x"] = json!(1_000_001),
            "upper_legal_shift" => {
                for c in cs.as_array_mut().unwrap() {
                    if c["floor"] == 2 {
                        c["x"] = json!(c["x"].as_i64().unwrap() + 20);
                    }
                }
            }
            "roof" => h["roof"] = json!("bad"),
            "world" => h["placement"]["transform"]["x"] = json!(5_000_000),
            "external_collision" => {
                h["placement"]["transform"]["x"] = json!(0);
                h["placement"]["transform"]["y"] = json!(0);
            }
            _ => unreachable!("{label}"),
        });
        let bytes = std::fs::read(&path).unwrap();
        let before = storage_tests::dump(&live);

        let e = live.request("open", json!({"path":path})).unwrap_err();
        assert_eq!(e, expected, "{label}");
        assert_eq!(storage_tests::dump(&live), before, "{label}");
        assert_eq!(std::fs::read(&path).unwrap(), bytes, "{label}");
        history(&mut live, true);
        history(&mut live, false);
    }
    // Valid large local gaps remain authored values; exhaustion is accepted on import,
    // then fails only when the specific allocator is actually needed.
    for field in ["roomCounter", "connectionCounter"] {
        for count in [100_i64, i64::MAX] {
            std::fs::write(&path, &pristine).unwrap();
            mutate_saved_house(&path, &id, |h, _| {
                h[field] = json!(count);
                h["name"] = json!("界".repeat(120));
                h["rooms"][0]["name"] = json!("界".repeat(120));
            });
            let mut a = AtlasApplication::new().unwrap();
            a.open(&path).unwrap();
            let intent = if field == "roomCounter" {
                room(&id, json!({"kind":"draw","floor":4,"cells":[[0,0]]}))
            } else {
                connection(
                    &id,
                    json!({"action":"createOpening","floor":0,"x":0,"y":1,"axis":"vertical","kind":"door"}),
                )
            };
            if count == 100 {
                checked_action(&mut a, intent);
                let h = a.house(&id).unwrap();
                if field == "roomCounter" {
                    assert!(h
                        .rooms
                        .iter()
                        .any(|r| r.id == "room-100" && r.created == 100));
                    assert_eq!(h.room_counter, 101);
                } else {
                    assert!(h
                        .connections
                        .iter()
                        .any(|c| c.id == "connection-100" && c.created == 100));
                    assert_eq!(h.connection_counter, 101);
                }
                let second = dir.path().join("gap.saltatlas");
                a.save(&second).unwrap();
                a.open(&second).unwrap();
                assert_eq!(a.house(&id).unwrap(), h);
            } else {
                let before = storage_tests::dump(&a);
                for cmd in ["preview", "commit"] {
                    let e = a
                        .request(cmd, json!({"version":a.status(),"intent":intent}))
                        .unwrap_err();
                    assert_eq!(e.category, ErrorCategory::Storage);
                    assert!(e.issue.is_none());
                    assert_eq!(storage_tests::dump(&a), before);
                }
            }
        }
    }
    // Isolated no-stair floor/coordinate extrema, and MIN/MIN+1 physical stairs.
    for (floor, x) in [
        (i64::from(i32::MIN), -1_000_000),
        (i64::from(i32::MAX), 1_000_000),
    ] {
        let mut a = AtlasApplication::new().unwrap();
        let id = seed(&mut a);
        draw(&mut a, &id, floor, &[[0, 0]]);
        edit(
            &mut a,
            "commit",
            room(&id, json!({"kind":"erase","floor":0,"cells":[[0,0]]})),
        );
        let p = dir.path().join("edge.saltatlas");
        a.save(&p).unwrap();
        mutate_saved_house(&p, &id, |h, cs| {
            cs[0]["x"] = json!(x);
            h["placement"]["transform"]["x"] = json!(if x > 0 { -5 } else { 0 });
        });
        a.open(&p).unwrap();
        assert_eq!(a.house(&id).unwrap().cells[0].x, x);
    }
    let mut a = AtlasApplication::new().unwrap();
    let id = seed(&mut a);
    for floor in [i64::from(i32::MIN), i64::from(i32::MIN) + 1] {
        draw(&mut a, &id, floor, &[[0, 0], [1, 0], [2, 0]]);
    }
    let intent = stairs(&id, i64::from(i32::MIN), 0, 0, "east", 3);
    edit(&mut a, "commit", intent);
    let p = dir.path().join("min-stair.saltatlas");
    a.save(&p).unwrap();
    let before = a.house(&id).unwrap();
    a.open(&p).unwrap();
    assert_eq!(a.house(&id).unwrap(), before);
}

#[test]
fn parcel_lifecycle_and_cascades_are_single_history_actions() {
    let mut a = AtlasApplication::new().unwrap();
    let result = edit(
        &mut a,
        "commit",
        json!({"type":"createRoad","road":{"name":"R","width":10,"material":"earth","nodes":[{"point":[0,0],"incoming":null,"outgoing":null},{"point":[160,0],"incoming":null,"outgoing":null}]},"population":{"side":"both","setback":5,"gap":20,"minWidth":4,"maxWidth":4,"minDepth":4,"maxDepth":4,"seed":1,"parcelDepth":80}}),
    );
    let road = result["objects"]
        .as_array()
        .unwrap()
        .iter()
        .find(|o| o["kind"] == "road")
        .unwrap()["id"]
        .as_str()
        .unwrap()
        .to_owned();
    let old_id = result["objects"]
        .as_array()
        .unwrap()
        .iter()
        .find(|o| o["kind"] == "house")
        .unwrap()["id"]
        .as_str()
        .unwrap()
        .to_owned();
    let Placement::Parcel { parcel_id, .. } = a.house(&old_id).unwrap().placement else {
        unreachable!()
    };
    checked_action(&mut a, json!({"type":"delete","id":old_id}));
    let result = checked_action(
        &mut a,
        json!({"type":"createParcelHouse","parcelId":parcel_id,"floor":-1,"cells":[[0,1],[2,1]]}),
    );
    let id = result["objects"][0]["id"].as_str().unwrap().to_owned();
    let h = a.house(&id).unwrap();
    assert_eq!(
        h.placement,
        Placement::Parcel {
            parcel_id: parcel_id.clone(),
            grid_pose: GridPose {
                x_cells: 0,
                y_cells: 0,
                quarter_turns: QuarterTurns(0)
            }
        }
    );
    assert_eq!(
        h.rooms
            .iter()
            .map(|r| (&*r.id, r.created, r.floor))
            .collect::<Vec<_>>(),
        vec![("room-0", 0, -1), ("room-1", 1, -1)]
    );
    assert!(h.contours.is_empty());
    let p = a.parcel(&parcel_id).unwrap();
    let Placement::Parcel { grid_pose, .. } = &h.placement else {
        unreachable!()
    };
    assert_eq!(
        h.transform,
        parcel_geometry::parcel_house_transform(&p.frame, grid_pose).unwrap()
    );
    let result = checked_action(
        &mut a,
        room(
            &id,
            json!({"kind":"erase","floor":-1,"cells":[[0,1],[2,1]]}),
        ),
    );
    assert_eq!(result["deletedIds"], json!([id]));
    assert_eq!(result["cascadeCounts"]["houses"], 1);
    assert_eq!(result["cascadeCounts"]["parcels"], 0);
    assert!(a.house_header_for_parcel(&parcel_id).unwrap().is_none());
    assert_eq!(a.parcel(&parcel_id).unwrap(), p);
    let result = checked_action(
        &mut a,
        json!({"type":"createParcelHouse","parcelId":parcel_id,"floor":-1,"cells":[[0,1]]}),
    );
    let fresh = result["objects"][0]["id"].as_str().unwrap().to_owned();
    assert_ne!(fresh, id);
    assert_ne!(fresh, old_id);
    checked_action(&mut a, json!({"type":"detachParcel","id":parcel_id}));
    let retained = a.house(&fresh).unwrap();
    let detached = a.parcel(&parcel_id).unwrap();
    let before = storage_tests::objects(&a);
    let mut expected:Vec<_>=before.iter().filter(|o|match o{FullObject::Road(r)=>r.id==road,FullObject::Parcel(p)=>matches!(&p.source,ParcelSource::Road{road_id,..} if road_id==&road),FullObject::House(h)=>placement_owner(&h.placement).is_some_and(|p|before.iter().any(|o|matches!(o,FullObject::Parcel(q) if q.id==p&&matches!(&q.source,ParcelSource::Road{road_id,..} if road_id==&road)))),_=>false}).map(|o|o.id().to_owned()).collect();
    expected.sort();
    let result = checked_action(&mut a, json!({"type":"delete","id":road}));
    let mut deleted: Vec<_> = result["deletedIds"]
        .as_array()
        .unwrap()
        .iter()
        .map(|v| v.as_str().unwrap().to_owned())
        .collect();
    deleted.sort();
    assert_eq!(deleted, expected);
    assert_eq!(result["cascadeCounts"]["roads"], 1);
    assert_eq!(result["cascadeCounts"]["parcels"].as_u64().unwrap() as usize,before.iter().filter(|o|matches!(o,FullObject::Parcel(p) if matches!(&p.source,ParcelSource::Road{road_id,..} if road_id==&road))).count());
    assert_eq!(a.house(&fresh).unwrap(), retained);
    assert_eq!(a.parcel(&parcel_id).unwrap(), detached);
}

#[test]
fn connection_cycle_and_disconnected_groups_keep_one_authoritative_owner() {
    let mut a = AtlasApplication::new().unwrap();
    let id = seed(&mut a);
    // Three rooms form a cycle: wide top, lower left, lower right.
    draw(&mut a, &id, 0, &[[0, 0], [1, 0]]);
    draw(&mut a, &id, 0, &[[0, 1]]);
    draw(&mut a, &id, 0, &[[1, 1]]);
    for (x, y, axis) in [
        (0, 1, "horizontal"),
        (1, 1, "horizontal"),
        (1, 1, "vertical"),
    ] {
        checked_action(
            &mut a,
            connection(
                &id,
                json!({"action":"createOpening","floor":0,"x":x,"y":y,"axis":axis,"kind":"door"}),
            ),
        );
    }
    let before = a.house(&id).unwrap();
    let rows = cell_rows(&a, &id);
    let raw = payload(&a, &id);
    for c in &before.connections {
        checked_action(
            &mut a,
            connection(
                &id,
                json!({"action":"convert","connectionId":c.id,"kind":"passage"}),
            ),
        );
        checked_action(
            &mut a,
            connection(&id, json!({"action":"delete","connectionId":c.id})),
        );
        let h = a.house(&id).unwrap();
        assert_eq!(h.rooms, before.rooms);
        assert_eq!(
            (&h.id, &h.name, &h.roof),
            (&before.id, &before.name, &before.roof)
        );
        assert_eq!(h.connection_counter, before.connection_counter);
        assert_eq!(cell_rows(&a, &id), rows);
        assert_eq!(payload(&a, &id), raw);
        assert_eq!(a.status().changes.unwrap().metadata, vec![id.clone()]);
        assert!(a.status().changes.unwrap().interiors.is_empty());
    }
    assert!(a.house(&id).unwrap().connections.is_empty());
    assert_eq!(storage_tests::objects(&a).len(), 1);
    for sign in [-1, 1] {
        let (mut a, id, moving) = stair_fixture(0, false);
        let before = a.house(&id).unwrap();
        checked_action(
            &mut a,
            room(
                &id,
                json!({"kind":"move","roomId":moving,"dx":10*sign,"dy":0}),
            ),
        );
        let after = a.house(&id).unwrap();
        assert!(after.connections.is_empty());
        assert_eq!(after.rooms, before.rooms);
        assert_eq!(
            (&after.id, &after.name, &after.roof),
            (&before.id, &before.name, &before.roof)
        );
        assert_eq!(storage_tests::objects(&a).len(), 1);
    }
}

// Outer collision policy is symmetric. A hidden basement must be
// found through occupancy_spatial when an obstacle is added later as well.
#[test]
fn basement_collisions_are_symmetric_and_rejected_on_open() {
    {
        let mut a = AtlasApplication::new().unwrap();
        let id = seed(&mut a);
        draw(&mut a, &id, -1, &[[10, 10]]);
        edit(
            &mut a,
            "commit",
            room(&id, json!({"kind":"erase","floor":0,"cells":[[0,0]]})),
        );
        assert!(a.house(&id).unwrap().contours.is_empty());
        for intent in [
            json!({"type":"createHouse","parcelId":null,"transform":{"x":50,"y":50,"angle":0},"width":1,"depth":1}),
            json!({"type":"createRoad","road":{"name":"R","width":10,"material":"earth","nodes":[{"point":[40,52],"incoming":null,"outgoing":null},{"point":[80,52],"incoming":null,"outgoing":null}]},"population":null}),
            json!({"type":"createArea","area":{"material":"water","points":[[49,49],[56,49],[56,56],[49,56]]}}),
        ] {
            assert_eq!(
                reject(&mut a, intent).issue.unwrap().code,
                IssueCode::Collision
            );
        }
        // Boundary contact stays legal, and rendering still uses the empty roof.
        edit(
            &mut a,
            "commit",
            json!({"type":"createArea","area":{"material":"water","points":[[55,50],[60,50],[60,55],[55,55]]}}),
        );
        let other=edit(&mut a,"commit",json!({"type":"createHouse","parcelId":null,"transform":{"x":1000,"y":1000,"angle":0},"width":1,"depth":1}))["objects"][0]["id"].as_str().unwrap().to_owned();
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("basement.saltatlas");
        a.save(&path).unwrap();
        a.open(&path).unwrap();
        assert!(a.house(&id).unwrap().contours.is_empty());
        mutate_saved_house(&path, &other, |h, _| {
            h["placement"]["transform"]["x"] = json!(50);
            h["placement"]["transform"]["y"] = json!(50);
        });
        let before = storage_tests::dump(&a);
        let bytes = std::fs::read(&path).unwrap();
        let error = a.open(&path).unwrap_err();
        assert_eq!(error.issue.unwrap().code, IssueCode::Collision);
        assert_eq!(storage_tests::dump(&a), before);
        assert_eq!(std::fs::read(&path).unwrap(), bytes);
    }
}

fn expected_invalid(message: &str, ids: &[&str]) -> AppError {
    AppError {
        category: ErrorCategory::InvalidInput,
        message: message.into(),
        issue: Some(Box::new(errors::DomainIssue {
            code: errors::IssueCode::InvalidInput,
            object_ids: ids.iter().map(|id| (*id).into()).collect(),
            message: message.into(),
            geometry: None,
        })),
    }
}

#[test]
fn half_offset_overlap_preserves_empty_adapter_error_context() {
    let h = interior::new_house(
        "house-oracle".into(),
        Transform {
            x: 0.0,
            y: 0.0,
            angle: 0.0,
        },
        4,
        3,
        0,
    )
    .unwrap();
    let before = h.clone();
    let intent = serde_json::from_value(
        json!({"action":"createOpening","floor":0,"x":2,"y":0,"axis":"horizontal","kind":"door"}),
    )
    .unwrap();
    let error = interior::edit(&h, LocalEdit::Connection(intent)).unwrap_err();
    assert_eq!(error, errors::invalid("Überlappende Wandöffnungen"));
    assert_eq!(h, before);
}

#[test]
fn outer_roof_validation_is_separate_from_pure_interior_input() {
    let mut h = interior::new_house(
        "roof-boundary".into(),
        Transform {
            x: 0.0,
            y: 0.0,
            angle: 0.0,
        },
        3,
        3,
        0,
    )
    .unwrap();
    h.roof = "invalid roof".into();
    assert_eq!(
        interior::validate(&h).unwrap_err().message,
        "Invalid metadata"
    );
    crate::interior::validate(crate::interior::InteriorInput {
        house_id: &h.id,
        rooms: &h.rooms,
        cells: &h.cells,
        connections: &h.connections,
        room_counter: h.room_counter,
        connection_counter: h.connection_counter,
    })
    .unwrap();
}
