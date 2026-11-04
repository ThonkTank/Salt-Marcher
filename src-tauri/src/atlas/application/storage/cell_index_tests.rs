//! Exact SQL work and atomic author/index/history behavior for the storage delta.
use super::*;
use crate::atlas::application::storage_tests;
use crate::atlas::ErrorCategory;
use serde_json::{json, Value};

type Mutation = (
    String,
    String,
    i64,
    i64,
    i64,
    Option<String>,
    Option<String>,
);
fn mutation(
    op: &str,
    id: &str,
    floor: i64,
    x: i64,
    y: i64,
    old: Option<&str>,
    new: Option<&str>,
) -> Mutation {
    (
        op.into(),
        id.into(),
        floor,
        x,
        y,
        old.map(str::to_owned),
        new.map(str::to_owned),
    )
}
fn commit(app: &mut AtlasApplication, intent: Value) {
    app.request("commit", json!({"version":app.status(),"intent":intent}))
        .unwrap();
}
fn room(id: &str, intent: Value) -> Value {
    json!({"type":"room","buildingId":id,"intent":intent})
}
fn create(app: &mut AtlasApplication, width: i64, x: i64) -> String {
    let value = app.request("commit", json!({"version":app.status(),"intent":{"type":"createHouse","parcelId":null,"transform":{"x":x,"y":0,"angle":0},"width":width,"depth":1}})).unwrap();
    let id = value["objects"][0]["id"].as_str().unwrap().to_owned();
    for connection in app.house(&id).unwrap().connections {
        commit(
            app,
            json!({"type":"connection","buildingId":id,"intent":{"action":"delete","connectionId":connection.id}}),
        );
    }
    id
}
fn fixture(width: i64) -> (AtlasApplication, String) {
    let mut app = AtlasApplication::new().unwrap();
    let id = create(&mut app, width, 0);
    create(&mut app, 2, 500);
    commit(
        &mut app,
        room(&id, json!({"kind":"draw","floor":-1,"cells":[[0,0],[1,0]]})),
    );
    // This extra floor takes room-1; operation-specific rooms start at room-2.
    install_audit(&app);
    (app, id)
}
fn install_audit(app: &AtlasApplication) {
    app.db.execute_batch("CREATE TEMP TABLE cell_audit(op TEXT,building_id TEXT,floor INTEGER,x INTEGER,y INTEGER,old_room TEXT,new_room TEXT);
        CREATE TEMP TRIGGER audit_insert AFTER INSERT ON local_cells BEGIN INSERT INTO cell_audit VALUES('I',new.building_id,new.floor,new.x,new.y,NULL,new.room_id); END;
        CREATE TEMP TRIGGER audit_delete AFTER DELETE ON local_cells BEGIN INSERT INTO cell_audit VALUES('D',old.building_id,old.floor,old.x,old.y,old.room_id,NULL); END;
        CREATE TEMP TRIGGER audit_update AFTER UPDATE ON local_cells BEGIN INSERT INTO cell_audit VALUES('U',new.building_id,new.floor,new.x,new.y,old.room_id,new.room_id); END;").unwrap();
}
fn audit(app: &AtlasApplication) -> Vec<Mutation> {
    let mut query = app
        .db
        .prepare("SELECT op,building_id,floor,x,y,old_room,new_room FROM cell_audit")
        .unwrap();
    let mut rows = query
        .query_map([], |r| {
            Ok((
                r.get(0)?,
                r.get(1)?,
                r.get(2)?,
                r.get(3)?,
                r.get(4)?,
                r.get(5)?,
                r.get(6)?,
            ))
        })
        .unwrap()
        .collect::<rusqlite::Result<Vec<Mutation>>>()
        .unwrap();
    rows.sort();
    rows
}
fn reset(app: &AtlasApplication) {
    app.db.execute("DELETE FROM cell_audit", []).unwrap();
}
fn assert_index(app: &mut AtlasApplication) {
    for object in storage_tests::objects(app) {
        let FullObject::House(house) = object else {
            continue;
        };
        let mut expected = house.cells.clone();
        expected.sort_by_key(cell_key);
        let mut query = app
            .db
            .prepare(
                "SELECT floor,x,y,room_id FROM local_cells WHERE building_id=? ORDER BY floor,y,x",
            )
            .unwrap();
        let actual = query
            .query_map([&house.id], |r| {
                Ok(Cell {
                    floor: r.get(0)?,
                    x: r.get(1)?,
                    y: r.get(2)?,
                    room_id: r.get(3)?,
                })
            })
            .unwrap()
            .collect::<rusqlite::Result<Vec<_>>>()
            .unwrap();
        assert_eq!(actual, expected);
        drop(query);
        for floor in [-1, 0] {
            let tile = app.request("interiorTile", json!({"buildingId":house.id,"floor":floor,"bounds":[-10,-10,20,20],"includeLower":true})).unwrap();
            let cells: Vec<Cell> = serde_json::from_value(tile["cells"].clone()).unwrap();
            assert_eq!(
                cells,
                expected
                    .iter()
                    .filter(|c| c.floor == floor)
                    .cloned()
                    .collect::<Vec<_>>()
            );
            if floor == 0 {
                let lower: Vec<Cell> = serde_json::from_value(tile["lower"].clone()).unwrap();
                assert_eq!(
                    lower,
                    expected
                        .iter()
                        .filter(|c| c.floor == -1)
                        .cloned()
                        .collect::<Vec<_>>()
                );
            }
        }
    }
}
fn assert_mutations(app: &AtlasApplication, mut expected: Vec<Mutation>) {
    expected.sort();
    assert_eq!(audit(app), expected);
}
fn checked_action(app: &mut AtlasApplication, intent: Value, expected: Vec<Mutation>) {
    let before = storage_tests::objects(app);
    reset(app);
    commit(app, intent);
    assert_mutations(app, expected.clone());
    let after = storage_tests::objects(app);
    assert_index(app);
    reset(app);
    app.request("history", json!({"version":app.status(),"redo":false}))
        .unwrap();
    let reverse = expected
        .iter()
        .map(|m| {
            (
                match m.0.as_str() {
                    "I" => "D",
                    "D" => "I",
                    _ => "U",
                }
                .into(),
                m.1.clone(),
                m.2,
                m.3,
                m.4,
                m.6.clone(),
                m.5.clone(),
            )
        })
        .collect();
    assert_mutations(app, reverse);
    assert_eq!(storage_tests::objects(app), before);
    assert_index(app);
    reset(app);
    app.request("history", json!({"version":app.status(),"redo":true}))
        .unwrap();
    assert_mutations(app, expected);
    assert_eq!(storage_tests::objects(app), after);
    assert_index(app);
}
#[test]
fn draw_and_erase_only_mutate_added_or_removed_keys() {
    let (mut app, id) = fixture(2);
    checked_action(
        &mut app,
        room(&id, json!({"kind":"draw","floor":0,"cells":[[1,0],[2,0]]})),
        vec![mutation("I", &id, 0, 2, 0, None, Some("room-0"))],
    );
    checked_action(
        &mut app,
        room(&id, json!({"kind":"erase","floor":0,"cells":[[2,0]]})),
        vec![mutation("D", &id, 0, 2, 0, Some("room-0"), None)],
    );
}
#[test]
fn assign_changes_room_without_reinserting_coordinates() {
    let (mut app, id) = fixture(3);
    commit(
        &mut app,
        room(&id, json!({"kind":"draw","floor":0,"cells":[[0,1]]})),
    );
    checked_action(
        &mut app,
        room(
            &id,
            json!({"kind":"assign","floor":0,"cells":[[0,0]],"roomId":"room-2"}),
        ),
        vec![mutation("U", &id, 0, 0, 0, Some("room-0"), Some("room-2"))],
    );
}
#[test]
fn merge_and_split_update_surviving_room_assignments() {
    let (mut app, id) = fixture(2);
    commit(
        &mut app,
        room(&id, json!({"kind":"draw","floor":0,"cells":[[3,0],[4,0]]})),
    );
    checked_action(
        &mut app,
        room(
            &id,
            json!({"kind":"draw","floor":0,"cells":[[1,0],[2,0],[3,0]]}),
        ),
        vec![
            mutation("I", &id, 0, 2, 0, None, Some("room-0")),
            mutation("U", &id, 0, 3, 0, Some("room-2"), Some("room-0")),
            mutation("U", &id, 0, 4, 0, Some("room-2"), Some("room-0")),
        ],
    );
    checked_action(
        &mut app,
        room(&id, json!({"kind":"erase","floor":0,"cells":[[2,0]]})),
        vec![
            mutation("D", &id, 0, 2, 0, Some("room-0"), None),
            mutation("U", &id, 0, 3, 0, Some("room-0"), Some("room-3")),
            mutation("U", &id, 0, 4, 0, Some("room-0"), Some("room-3")),
        ],
    );
}
#[test]
fn overlapping_move_keeps_shared_keys_and_other_floors_untouched() {
    let (mut app, id) = fixture(3);
    checked_action(
        &mut app,
        room(&id, json!({"kind":"move","roomId":"room-0","dx":1,"dy":0})),
        vec![
            mutation("D", &id, 0, 0, 0, Some("room-0"), None),
            mutation("I", &id, 0, 3, 0, None, Some("room-0")),
        ],
    );
}
#[test]
fn imported_unsorted_cells_keep_order_through_undo_and_use_index_delta() {
    let (mut app, id) = fixture(3);
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("unsorted.saltatlas");
    app.request("save", json!({"path":path})).unwrap();
    let file = Connection::open(&path).unwrap();
    let mut cells = app.house(&id).unwrap().cells;
    cells.reverse();
    let payload = serde_json::to_string(&cells).unwrap();
    file.execute(
        "UPDATE house_cells SET payload=? WHERE building_id=?",
        params![payload, id],
    )
    .unwrap();
    drop(file);
    // New session initializes its index; install audit on the new connection afterward.
    app.request("open", json!({"path":path})).unwrap();
    assert_eq!(app.house(&id).unwrap().cells, cells);
    install_audit(&app);
    checked_action(
        &mut app,
        room(&id, json!({"kind":"erase","floor":0,"cells":[[2,0]]})),
        vec![mutation("D", &id, 0, 2, 0, Some("room-0"), None)],
    );
    app.request("history", json!({"version":app.status(),"redo":false}))
        .unwrap();
    let restored: String = app
        .db
        .query_row(
            "SELECT payload FROM house_cells WHERE building_id=?",
            [&id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(restored, payload);
}

#[test]
fn index_update_and_delete_failures_rollback_all_author_and_history_state() {
    for operation in ["UPDATE", "DELETE"] {
        let (mut app, id) = fixture(5);
        reset(&app);
        let before = storage_tests::dump(&app);
        app.db.execute_batch(&format!("CREATE TEMP TRIGGER fail_delta BEFORE {operation} ON local_cells BEGIN SELECT RAISE(ABORT,'injected index delta'); END;")).unwrap();
        let error=app.request("commit",json!({"version":app.status(),"intent":room(&id,json!({"kind":"erase","floor":0,"cells":[[2,0]]}))})).unwrap_err();
        assert_eq!(error.category, ErrorCategory::Storage);
        assert_eq!(storage_tests::dump(&app), before);
        assert!(audit(&app).is_empty());
        app.db.execute_batch("DROP TRIGGER fail_delta").unwrap();
        assert_index(&mut app);
    }
}

#[test]
fn missing_index_rows_are_storage_errors_not_silent_repair() {
    for operation in ["update", "delete"] {
        let (mut app, id) = fixture(3);
        commit(
            &mut app,
            room(&id, json!({"kind":"draw","floor":0,"cells":[[0,1]]})),
        );
        app.db
            .execute(
                "DELETE FROM local_cells WHERE building_id=? AND floor=0 AND x=0 AND y=0",
                [&id],
            )
            .unwrap();
        reset(&app);
        let before = storage_tests::dump(&app);
        let intent = if operation == "update" {
            json!({"kind":"assign","floor":0,"cells":[[0,0]],"roomId":"room-2"})
        } else {
            json!({"kind":"erase","floor":0,"cells":[[0,0]]})
        };
        let error = app
            .request(
                "commit",
                json!({"version":app.status(),"intent":room(&id,intent)}),
            )
            .unwrap_err();
        assert_eq!(error.category, ErrorCategory::Storage);
        assert_eq!(storage_tests::dump(&app), before);
        assert!(audit(&app).is_empty());
    }
}

#[test]
fn reordered_payload_preserves_author_order_without_any_index_mutation() {
    let (mut app, id) = fixture(3);
    let original = app.house(&id).unwrap();
    let mut reordered = original.clone();
    reordered.cells.reverse();
    assert_ne!(original.cells, reordered.cells);
    for (before, after) in [(&original, &reordered), (&reordered, &original)] {
        reset(&app);
        let tx = app.db.transaction().unwrap();
        write_delta(
            &tx,
            &[FullObject::House(before.clone())],
            &[FullObject::House(after.clone())],
        )
        .unwrap();
        tx.commit().unwrap();
        assert_mutations(&app, vec![]);
        assert_eq!(app.house(&id).unwrap(), *after);
        let payload: String = app
            .db
            .query_row(
                "SELECT payload FROM house_cells WHERE building_id=?",
                [&id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(payload, serde_json::to_string(&after.cells).unwrap());
        assert_index(&mut app);
    }
}
