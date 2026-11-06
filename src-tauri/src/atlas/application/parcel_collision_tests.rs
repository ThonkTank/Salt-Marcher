use super::application_test_support::{request_edit as edit, *};
use super::*;
use rusqlite::hooks::{AuthAction, AuthContext, Authorization};

fn house(a: &mut AtlasApplication) -> String {
    edit(a,"commit",json!({"type":"createHouse","parcelId":null,"transform":{"x":0,"y":0,"angle":0},"width":2,"depth":2}))["objects"][0]["id"].as_str().unwrap().to_owned()
}
fn parcel(x: f64, y: f64) -> Parcel {
    Parcel {
        id: "parcel-700".into(),
        source: ParcelSource::Detached {},
        polygon: vec![[x, y], [x + 10.0, y], [x + 10.0, y + 10.0], [x, y + 10.0]],
        frame: Transform { x, y, angle: 0.0 },
    }
}

#[test]
fn basement_expansion_into_existing_empty_parcel_rejects_whole_edit() {
    let mut a = AtlasApplication::new().unwrap();
    let id = house(&mut a);
    let p = parcel(40.0, 40.0);
    storage::write_object(&a.db, &FullObject::Parcel(p), false).unwrap();
    let before = a.house(&id).unwrap();
    let status = json!(a.status());
    let intent =
        json!({"type":"room","buildingId":id,"intent":{"kind":"draw","floor":-1,"cells":[[8,8]]}});
    let preview = edit(&mut a, "preview", intent.clone());
    assert_eq!(preview["valid"], false);
    assert!(preview["reason"].as_str().unwrap().contains("parcel-700"));
    assert!(a
        .request("commit", json!({"version":a.status(),"intent":intent}))
        .is_err());
    assert_eq!(json!(a.status()), status);
    assert_eq!(a.house(&id).unwrap(), before);
}

#[test]
fn new_parcel_over_existing_basement_uses_occupancy_rtree_and_headers_only() {
    let mut a = AtlasApplication::new().unwrap();
    let id = house(&mut a);
    edit(
        &mut a,
        "commit",
        json!({"type":"room","buildingId":id,"intent":{"kind":"draw","floor":-1,"cells":[[8,8]]}}),
    );
    let p = parcel(40.0, 40.0);
    let scene = SceneObject::Parcel(p.clone());
    assert!(a.query(scene.bounds()).unwrap().is_empty());
    a.db.flush_prepared_statement_cache();
    a.db.authorizer(Some(|ctx: AuthContext<'_>| match ctx.action {
        AuthAction::Read { table_name, .. }
            if ["house_cells", "local_cells"].contains(&table_name) =>
        {
            Authorization::Deny
        }
        _ => Authorization::Allow,
    }));
    let nearby = a.query_collision_headers(scene.bounds()).unwrap();
    assert_eq!(nearby.len(), 1);
    assert_eq!(nearby[0].id(), id);
    assert!(conflict(&scene, &nearby[0]).unwrap());
    assert!(conflict(&nearby[0], &scene).unwrap());
    assert!(a
        .collision(&scene, &[], std::slice::from_ref(&scene))
        .is_err());
    let details:Vec<String>=a.db.prepare("EXPLAIN QUERY PLAN SELECT key FROM spatial WHERE min_x<=50 AND max_x>=40 AND min_y<=50 AND max_y>=40 UNION SELECT key FROM occupancy_spatial WHERE min_x<=50 AND max_x>=40 AND min_y<=50 AND max_y>=40").unwrap().query_map([],|row|row.get(3)).unwrap().map(|r|r.unwrap()).collect();
    assert!(
        details.iter().any(|d| d.contains("spatial VIRTUAL TABLE")),
        "{details:?}"
    );
    assert!(
        details
            .iter()
            .any(|d| d.contains("occupancy_spatial VIRTUAL TABLE")),
        "{details:?}"
    );
}

#[test]
fn header_only_transform_blocks_foreign_parcel_and_basement_world_overflow() {
    let mut a = AtlasApplication::new().unwrap();
    let id = house(&mut a);
    edit(
        &mut a,
        "commit",
        json!({"type":"room","buildingId":id,"intent":{"kind":"draw","floor":-1,"cells":[[8,8]]}}),
    );
    storage::write_object(&a.db, &FullObject::Parcel(parcel(20.0, 20.0)), false).unwrap();
    let before = json!(a.status());
    a.db.flush_prepared_statement_cache();
    a.db.authorizer(Some(|ctx: AuthContext<'_>| match ctx.action {
        AuthAction::Read { table_name, .. }
            if ["house_cells", "local_cells"].contains(&table_name) =>
        {
            Authorization::Deny
        }
        _ => Authorization::Allow,
    }));
    for transform in [
        json!({"x":-20,"y":-20,"angle":0}),
        json!({"x":99_999_980,"y":0,"angle":0}),
    ] {
        let preview = edit(
            &mut a,
            "preview",
            json!({"type":"transformHouse","id":id,"transform":transform}),
        );
        assert_eq!(preview["valid"], false, "{preview}");
        assert_eq!(json!(a.status()), before);
    }
}
