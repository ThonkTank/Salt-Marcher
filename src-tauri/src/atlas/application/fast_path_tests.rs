use super::application_test_support::*;
use super::*;
use rusqlite::hooks::{AuthAction, AuthContext, Authorization};

#[test]
fn tile_contract_separates_metadata_and_skips_lower_query() {
    let mut a = AtlasApplication::new().unwrap();
    let id = request_edit(
        &mut a,
        "commit",
        json!({"type":"createHouse","parcelId":null,"transform":{"x":0,"y":0,"angle":0},"width":4,"depth":4}),
    )["objects"][0]["id"]
        .as_str()
        .unwrap()
        .to_owned();
    a.db.flush_prepared_statement_cache();
    a.db.authorizer(Some(|ctx: AuthContext<'_>| match ctx.action {
        AuthAction::Function { function_name }
            if function_name.eq_ignore_ascii_case("row_number") =>
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
    let args = json!({"buildingId":id,"floor":0,"bounds":[0,0,3,3],"includeLower":false});
    let tile = a.request("interiorTile", args.clone()).unwrap();
    assert_eq!(tile["includeLower"], false);
    assert_eq!(tile["cells"].as_array().unwrap().len(), 16);
    assert_eq!(tile["lower"], json!([]));
    assert!(tile.get("rooms").is_none());
    let mut lower_args = args;
    lower_args["includeLower"] = json!(true);
    assert!(a.request("interiorTile", lower_args).is_err());
    a.db.authorizer(None::<fn(AuthContext<'_>) -> Authorization>);
    let metadata = a
        .request("interiorMetadata", json!({"buildingId":id}))
        .unwrap();
    assert_eq!(metadata["rooms"].as_array().unwrap().len(), 1);
    assert!(metadata.get("cells").is_none());
    assert!(a
        .request(
            "interiorTile",
            json!({"buildingId":id,"floor":0,"bounds":[0,0,3,3]})
        )
        .is_err());
}
#[test]
fn partial_house_cannot_deserialize_as_full_and_computed_variants_are_distinct() {
    let mut a = AtlasApplication::new().unwrap();
    let id = request_edit(
        &mut a,
        "commit",
        json!({"type":"createHouse","parcelId":null,"transform":{"x":0,"y":0,"angle":0},"width":2,"depth":2}),
    )["objects"][0]["id"]
        .as_str()
        .unwrap()
        .to_owned();
    let full = a.house(&id).unwrap();
    let mut value = serde_json::to_value(&full).unwrap();
    for field in [
        "cells",
        "rooms",
        "connections",
        "roomCounter",
        "connectionCounter",
    ] {
        let removed = value.as_object_mut().unwrap().remove(field).unwrap();
        assert!(
            serde_json::from_value::<FullHouse>(value.clone()).is_err(),
            "missing {field}"
        );
        value.as_object_mut().unwrap().insert(field.into(), removed);
    }
    let patch: Intent =
        serde_json::from_value(json!({"type":"rename","id":id,"name":"Inn"})).unwrap();
    let change = a.compute(&patch).unwrap().change;
    assert_eq!(change.fields.len(), 1);
    assert!(change.geometry.before.is_empty() && change.geometry.after.is_empty());
    let noop: Intent =
        serde_json::from_value(json!({"type":"rename","id":id,"name":full.name})).unwrap();
    assert!(a.compute(&noop).unwrap().change.is_empty());
    let geometry: Intent = serde_json::from_value(
        json!({"type":"room","buildingId":id,"intent":{"kind":"draw","floor":0,"cells":[[4,4]]}}),
    )
    .unwrap();
    let change = a.compute(&geometry).unwrap().change;
    assert!(change.fields.is_empty());
    assert!(!change.geometry.after.is_empty());
}
#[test]
fn geometry_history_collision_branch_and_file_preserve_exact_house() {
    let mut a = AtlasApplication::new().unwrap();
    let id = request_edit(
        &mut a,
        "commit",
        json!({"type":"createHouse","parcelId":null,"transform":{"x":0,"y":0,"angle":0},"width":4,"depth":4}),
    )["objects"][0]["id"]
        .as_str()
        .unwrap()
        .to_owned();
    request_edit(
        &mut a,
        "commit",
        json!({"type":"createHouse","parcelId":null,"transform":{"x":25,"y":0,"angle":0},"width":4,"depth":4}),
    );
    let mut states = vec![a.house(&id).unwrap()];
    for i in 0..101 {
        let kind = if i % 2 == 0 { "draw" } else { "erase" };
        let action =
            json!({"type":"room","buildingId":id,"intent":{"kind":kind,"floor":0,"cells":[[4,0]]}});
        let preview = request_edit(&mut a, "preview", action.clone());
        assert_eq!(preview["valid"], true);
        let committed = request_edit(&mut a, "commit", action);
        assert_eq!(preview["objects"], committed["objects"]);
        assert_eq!(committed["changed"], true);
        states.push(a.house(&id).unwrap());
    }
    let before = a.house(&id).unwrap();
    let status = serde_json::to_value(a.status()).unwrap();
    let history_rows: Vec<(i64, String)> = {
        let mut q =
            a.db.prepare("SELECT seq,body FROM history ORDER BY seq")
                .unwrap();
        q.query_map([], |r| Ok((r.get(0)?, r.get(1)?)))
            .unwrap()
            .collect::<rusqlite::Result<_>>()
            .unwrap()
    };
    let collision =
        json!({"type":"room","buildingId":id,"intent":{"kind":"draw","floor":0,"cells":[[5,0]]}});
    assert_eq!(
        request_edit(&mut a, "preview", collision.clone())["valid"],
        false
    );
    assert!(a
        .request("commit", json!({"version":a.status(),"intent":collision}))
        .is_err());
    assert_eq!(a.house(&id).unwrap(), before);
    assert_eq!(serde_json::to_value(a.status()).unwrap(), status);
    let after_rows: Vec<(i64, String)> = {
        let mut q =
            a.db.prepare("SELECT seq,body FROM history ORDER BY seq")
                .unwrap();
        q.query_map([], |r| Ok((r.get(0)?, r.get(1)?)))
            .unwrap()
            .collect::<rusqlite::Result<_>>()
            .unwrap()
    };
    assert_eq!(history_rows, after_rows);
    for index in (1..=100).rev() {
        history(&mut a, false);
        assert_eq!(a.house(&id).unwrap(), states[index]);
    }
    assert!(!a.status().can_undo);
    for state in states.iter().skip(2) {
        history(&mut a, true);
        assert_eq!(&a.house(&id).unwrap(), state);
    }
    assert!(!a.status().can_redo);
    history(&mut a, false);
    let unchanged = storage_tests::dump(&a);
    for intent in [
        json!({"type":"room","buildingId":id,"intent":{"kind":"move","roomId":"room-0","dx":0,"dy":0}}),
        json!({"type":"connection","buildingId":id,"intent":{"action":"convert","connectionId":"connection-0","kind":"door"}}),
        json!({"type":"room","buildingId":id,"intent":{"kind":"assign","floor":0,"roomId":"room-0","cells":[[100,100]]}}),
    ] {
        assert_eq!(request_edit(&mut a, "commit", intent)["changed"], false);
        assert_eq!(storage_tests::dump(&a), unchanged);
        assert!(a.status().can_redo);
    }
    let branch =
        json!({"type":"room","buildingId":id,"intent":{"kind":"draw","floor":-1,"cells":[[0,0]]}});
    request_edit(&mut a, "commit", branch);
    assert!(!a.status().can_redo);
    let branched = a.house(&id).unwrap();
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("geometry.saltatlas");
    a.save(&path).unwrap();
    let mut reopened = AtlasApplication::new().unwrap();
    reopened.open(&path).unwrap();
    assert_eq!(reopened.house(&id).unwrap(), branched);
}

#[test]
fn small_changes_never_touch_cell_tables_or_geometry_and_use_compact_history() {
    for width in [8, 128] {
        let mut a = AtlasApplication::new().unwrap();
        let id = request_edit(&mut a, "commit", json!({"type":"createHouse","parcelId":null,"transform":{"x":0,"y":0,"angle":0},"width":width,"depth":width}))["objects"][0]["id"].as_str().unwrap().to_owned();

        // Reprepare statements under the authorizer. Fail on any access, not merely writes.
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

        let actions = [
            json!({"type":"rename","id":id,"name":"Inn"}),
            json!({"type":"roof","id":id,"roof":"#123456"}),
            json!({"type":"room","buildingId":id,"intent":{"kind":"rename","roomId":"room-0","name":"Kitchen"}}),
            json!({"type":"transformHouse","id":id,"transform":{"x":5,"y":10,"angle":0.1}}),
        ];
        for action in actions {
            let preview = request_edit(&mut a, "preview", action.clone());
            let committed = request_edit(&mut a, "commit", action.clone());
            assert_eq!(preview["objects"], committed["objects"]);
            assert_eq!(committed["changed"], true);
            let revision = a.revision;
            assert_eq!(request_edit(&mut a, "commit", action)["changed"], false);
            assert_eq!(a.revision, revision);
            history(&mut a, false);
            history(&mut a, true);
        }
        let sizes: Vec<i64> =
            a.db.prepare("SELECT length(body) FROM history WHERE seq>1 ORDER BY seq")
                .unwrap()
                .query_map([], |r| r.get(0))
                .unwrap()
                .map(|x| x.unwrap())
                .collect();
        assert_eq!(sizes.len(), 4);
        assert!(sizes.iter().all(|n| *n < 500), "{sizes:?}");
    }
}
