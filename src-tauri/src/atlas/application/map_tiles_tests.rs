use super::application_test_support::*;
use super::*;
use rusqlite::hooks::{AuthAction, AuthContext, Authorization};

fn house(a: &mut AtlasApplication, x: f64, y: f64) -> String {
    request_edit(a,"commit",json!({"type":"createHouse","parcelId":null,"transform":{"x":x,"y":y,"angle":0},"width":4,"depth":4}))["objects"][0]["id"].as_str().unwrap().into()
}
fn density(a: &mut AtlasApplication) -> Value {
    a.request("mapTiles", json!({"level":4,"tiles":[[-1,-1],[0,0],[1,1]]}))
        .unwrap()["tiles"]
        .clone()
}
#[test]
fn city_index_tracks_moves_deletion_and_history_without_cells() {
    let mut a = AtlasApplication::new().unwrap();
    let id = house(&mut a, -40.0, -40.0);
    let first = density(&mut a);
    assert_eq!(first[0]["density"].as_array().unwrap().len(), 1);
    a.db.flush_prepared_statement_cache();
    a.db.authorizer(Some(|ctx: AuthContext<'_>| match ctx.action {
        AuthAction::Read {
            table_name: "house_cells" | "local_cells",
            ..
        } => Authorization::Deny,
        _ => Authorization::Allow,
    }));
    request_edit(
        &mut a,
        "commit",
        json!({"type":"importantPlace","id":id,"value":true}),
    );
    request_edit(
        &mut a,
        "commit",
        json!({"type":"rename","id":id,"name":"Rathaus"}),
    );
    let named = density(&mut a);
    assert_eq!(named[0]["features"][0]["name"], "Rathaus");
    assert_eq!(named[0]["features"][0]["important"], true);
    request_edit(
        &mut a,
        "commit",
        json!({"type":"transformHouse","id":id,"transform":{"x":100,"y":100,"angle":0}}),
    );
    let moved = density(&mut a);
    assert!(moved[0]["density"].as_array().unwrap().is_empty());
    assert_eq!(moved[1]["density"].as_array().unwrap().len(), 1);
    history(&mut a, false);
    assert_eq!(density(&mut a), named);
    history(&mut a, true);
    assert_eq!(density(&mut a), moved);
    a.db.authorizer(None::<fn(AuthContext<'_>) -> Authorization>);
    request_edit(&mut a, "commit", json!({"type":"delete","id":id}));
    assert!(density(&mut a)
        .as_array()
        .unwrap()
        .iter()
        .all(|t| t["density"].as_array().unwrap().is_empty()));
    history(&mut a, false);
    assert_eq!(density(&mut a), moved);
}
#[test]
fn important_place_roundtrips_and_invalid_tile_requests_are_rejected() {
    let mut a = AtlasApplication::new().unwrap();
    let id = house(&mut a, 0.0, 0.0);
    request_edit(
        &mut a,
        "commit",
        json!({"type":"importantPlace","id":id,"value":true}),
    );
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("city.saltatlas");
    a.save(&path).unwrap();
    a.open(&path).unwrap();
    assert!(a.house(&id).unwrap().important_place);
    assert_eq!(density(&mut a)[1]["features"][0]["important"], true);
    assert!(a
        .request("mapTiles", json!({"level":21,"tiles":[]}))
        .is_err());
    assert!(a
        .request("mapTiles", json!({"level":0,"tiles":vec![[0,0];65]}))
        .is_err());
    assert!(a
        .request("mapTiles", json!({"level":0,"tiles":[[i32::MAX,0]]}))
        .is_err());
}

/// Reproducible, opt-in city fixture and timing evidence. No source fixture blobs.
#[test]
#[ignore = "large-city benchmark; writes evidence under target/diagnostics"]
fn city_scale_benchmark() {
    use std::time::Instant;
    let output = std::path::PathBuf::from(
        std::env::var_os("ATLAS_CITY_DIR").unwrap_or_else(|| "target/diagnostics/city".into()),
    );
    std::fs::create_dir_all(&output).unwrap();
    for count in [100_000, 250_000] {
        let mut a = AtlasApplication::new().unwrap();
        let mut h = fixture();
        h.cells.clear();
        h.rooms.clear();
        h.room_counter = 1;
        h.contours = vec![vec![
            LocalPoint([0.0, 0.0]),
            LocalPoint([4.0, 0.0]),
            LocalPoint([4.0, 4.0]),
            LocalPoint([0.0, 4.0]),
        ]];
        h.occupancy_contours = h.contours.clone();
        let start = Instant::now();
        a.db.execute_batch("BEGIN").unwrap();
        for i in 0..count {
            h.id = format!("house-{}", i + 1);
            h.name = format!("Haus {}", i + 1);
            h.transform.x = f64::from(i % 500) * 40.0 - 10000.0;
            h.transform.y = f64::from(i / 500) * 40.0 - 10000.0;
            h.important_place = i % 10000 == 0;
            h.occupancy_bounds = occupancy_bounds(&h.occupancy_contours, &h.transform);
            h.rooms = vec![crate::interior::Room {
                id: "room-1".into(),
                name: "Raum 1".into(),
                floor: 0,
                building_id: h.id.clone(),
                created: 0,
            }];
            h.cells = (0..4)
                .flat_map(|x| {
                    (0..4).map(move |y| crate::interior::Cell {
                        floor: 0,
                        x,
                        y,
                        room_id: "room-1".into(),
                    })
                })
                .collect();
            storage::write_object(&a.db, &FullObject::House(h.clone()), true).unwrap();
        }
        a.db.execute_batch("COMMIT").unwrap();
        a.db.execute(
            "UPDATE document_meta SET next_identity=?",
            [i64::from(count) + 1],
        )
        .unwrap();
        for i in (0..count / 500).step_by(20) {
            let y = -9970 + i * 40;
            request_edit(
                &mut a,
                "commit",
                json!({"type":"createRoad","road":{"name":format!("{}. Stadtallee",i/20+1),"width":16,"material":"stone","nodes":[{"point":[-10020,y],"incoming":null,"outgoing":null},{"point":[10020,y],"incoming":null,"outgoing":null}]},"population":null}),
            );
        }
        request_edit(
            &mut a,
            "commit",
            json!({"type":"createArea","area":{"material":"water","points":[[-10800,-10500],[-10300,-10500],[-10300,10500],[-10800,10500]]}}),
        );
        let build = start.elapsed();
        let mut times = vec![];
        let mut payload = 0;
        for _ in 0..10 {
            let start = Instant::now();
            let result = a
                .map_tiles(map_tiles::MapTilesArgs {
                    level: 7,
                    tiles: vec![[-1, -1], [0, -1], [-1, 0], [0, 0]],
                })
                .unwrap();
            let bytes = serde_json::to_vec(&result).unwrap();
            payload = bytes.len();
            times.push(start.elapsed().as_secs_f64());
        }
        let log=format!("buildings={count}\nbuild_seconds={}\nread_seconds={times:?}\npayload_bytes={payload}\n",build.as_secs_f64());
        std::fs::write(output.join(format!("benchmark-{count}.txt")), &log).unwrap();
        eprintln!("{log}");
        assert!(payload < 2_000_000, "overview payload must stay bounded");
        a.save(&output.join(format!("city-{count}.saltatlas")))
            .unwrap();
    }
}

#[test]
fn exact_scene_refuses_overload_instead_of_truncating() {
    let mut a = AtlasApplication::new().unwrap();
    a.db.execute_batch("BEGIN").unwrap();
    for i in 0..5001 {
        let area = FullObject::Area(Area {
            id: format!("area-{i}"),
            material: "grass".into(),
            points: vec![[0.0, 0.0], [1.0, 0.0], [1.0, 1.0]],
            order: i,
        });
        storage::write_object(&a.db, &area, false).unwrap();
    }
    a.db.execute_batch("COMMIT").unwrap();
    let error = a
        .request(
            "scene",
            json!({"bounds":[0,0,2,2],"context":{"kind":"exterior"}}),
        )
        .unwrap_err();
    assert!(error.to_string().contains("hineinzoomen"));
    let overview = a
        .request("mapTiles", json!({"level":1,"tiles":[[0,0]]}))
        .unwrap();
    assert!(overview["tiles"][0]["features"].as_array().unwrap().len() <= 128);
}
