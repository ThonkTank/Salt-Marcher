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
    a.db.flush_prepared_statement_cache();
    a.db.authorizer(Some(|ctx: AuthContext<'_>| match ctx.action {
        AuthAction::Read {
            table_name: "house_cells" | "local_cells",
            ..
        } => Authorization::Deny,
        _ => Authorization::Allow,
    }));
    assert_eq!(density(&mut a)[1]["features"][0]["important"], true);
    a.db.authorizer(None::<fn(AuthContext<'_>) -> Authorization>);
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

fn test_house(id: &str, x: f64, y: f64, side: f64, important: bool) -> FullObject {
    let mut h = fixture();
    h.id = id.into();
    h.name = id.into();
    h.cells.clear();
    h.rooms.clear();
    h.transform.x = x;
    h.transform.y = y;
    h.important_place = important;
    h.contours = vec![vec![
        LocalPoint([0.0, 0.0]),
        LocalPoint([side / 5.0, 0.0]),
        LocalPoint([side / 5.0, side / 5.0]),
        LocalPoint([0.0, side / 5.0]),
    ]];
    h.occupancy_contours = h.contours.clone();
    h.occupancy_bounds = occupancy_bounds(&h.occupancy_contours, &h.transform);
    FullObject::House(h)
}

fn test_road(id: &str, width: f64, path: Vec<[f64; 2]>) -> FullObject {
    FullObject::Road(Road {
        id: id.into(),
        name: id.into(),
        width,
        material: crate::atlas::model::RoadMaterial::Stone,
        nodes: vec![],
        path,
        edge_sections: vec![],
        sections: vec![],
        population_recipe: None,
    })
}

fn test_area(id: &str, x: f64) -> FullObject {
    FullObject::Area(Area {
        id: id.into(),
        material: "water".into(),
        points: vec![[x, 10.0], [x + 10.0, 10.0], [x + 10.0, 20.0], [x, 20.0]],
        order: 7,
    })
}

fn test_scenery(id: &str, x: f64) -> FullObject {
    use crate::atlas::scenery::{Biome, Scenery, SceneryAsset};
    FullObject::Scenery(Scenery {
        id: id.into(),
        biome: Biome::Forest,
        assets: vec![SceneryAsset {
            point: [x, 10.0],
            size: 5.0,
            angle: 0.0,
            variant: 0,
        }],
    })
}

fn put(a: &AtlasApplication, object: FullObject) {
    storage::write_object(&a.db, &object, false).unwrap();
}

#[test]
fn multi_tile_projection_cache_matches_uncached_and_is_request_local() {
    use map_tiles::{project_feature, projection_count, MapTilesArgs};
    let a = AtlasApplication::new().unwrap();
    put(&a, test_house("house-a", -5.0, 0.0, 20.0, true));
    put(
        &a,
        test_road(
            "road-a",
            4.0,
            vec![[-600.0, 1.0], [0.0, 20.0], [700.0, 1.0]],
        ),
    );
    put(&a, test_area("area-a", -5.0));
    put(&a, test_scenery("scenery-a", -5.0));
    a.db.flush_prepared_statement_cache();
    a.db.authorizer(Some(|ctx: AuthContext<'_>| match ctx.action {
        AuthAction::Read {
            table_name: "house_cells" | "local_cells",
            ..
        } => Authorization::Deny,
        _ => Authorization::Allow,
    }));
    for level in [0, 2, 3, 20] {
        for coords in [
            vec![],
            vec![[0, 0]],
            vec![[-1, 0], [0, 0], [1, 0]],
            vec![[1, 0], [-1, 0], [0, 0], [-1, 0]],
        ] {
            let args = MapTilesArgs {
                level,
                tiles: coords,
            };
            projection_count(true);
            let cached = a.map_tiles(args.clone()).unwrap();
            let cached_count = projection_count(true);
            let uncached = a
                .map_tiles_with(args.clone(), |_, body, size| {
                    let object = serde_json::from_str(&body).map_err(storage_error)?;
                    Ok(project_feature(object, size))
                })
                .unwrap();
            let uncached_count = projection_count(true);
            let occurrences: Vec<_> = cached
                .tiles
                .iter()
                .flat_map(|tile| tile.features.iter().map(|feature| feature.id.clone()))
                .collect();
            let unique = occurrences.iter().collect::<HashSet<_>>().len();
            assert_eq!(cached_count, unique);
            assert_eq!(uncached_count, occurrences.len());
            assert_eq!(
                serde_json::to_value(&cached).unwrap(),
                serde_json::to_value(&uncached).unwrap()
            );
            let second = a.map_tiles(args.clone()).unwrap();
            assert_eq!(projection_count(true), unique);
            assert_eq!(
                serde_json::to_value(&cached).unwrap(),
                serde_json::to_value(&second).unwrap()
            );
            for (tile, coord) in cached.tiles.iter().zip(args.tiles) {
                let single = a
                    .map_tiles(MapTilesArgs {
                        level,
                        tiles: vec![coord],
                    })
                    .unwrap();
                assert_eq!(
                    serde_json::to_value(tile).unwrap(),
                    serde_json::to_value(&single.tiles[0]).unwrap()
                );
            }
            projection_count(true);
            if level == 0 && occurrences.len() > 4 {
                assert!(occurrences.len() > unique);
                eprintln!("fixture level 0: U={unique}, V={}", occurrences.len());
            }
        }
    }
    a.db.authorizer(None::<fn(AuthContext<'_>) -> Authorization>);
}

#[test]
fn fixed_projector_geometry_and_point_cap() {
    use map_tiles::project_feature;
    let FullObject::House(mut h) = test_house("rotated", 10.0, 20.0, 10.0, true) else {
        unreachable!()
    };
    h.transform.angle = std::f64::consts::FRAC_PI_2;
    h.contours = vec![
        vec![
            LocalPoint([0.0, 0.0]),
            LocalPoint([2.0, 0.0]),
            LocalPoint([2.0, 2.0]),
            LocalPoint([0.0, 2.0]),
        ],
        vec![
            LocalPoint([0.5, 0.5]),
            LocalPoint([1.0, 0.5]),
            LocalPoint([1.0, 1.0]),
        ],
        vec![
            LocalPoint([3.0, 0.0]),
            LocalPoint([4.0, 0.0]),
            LocalPoint([4.0, 1.0]),
        ],
    ];
    let projected = project_feature(SceneObject::House(h.header()), 16.0).unwrap();
    let expected = [
        vec![[10.0, 20.0], [10.0, 30.0], [0.0, 30.0], [0.0, 20.0]],
        vec![[7.5, 22.5], [7.5, 25.0], [5.0, 25.0]],
        vec![[10.0, 35.0], [10.0, 40.0], [5.0, 40.0]],
    ];
    for (actual, expected) in projected.paths.iter().zip(expected.iter()) {
        for (a, e) in actual.iter().zip(expected) {
            assert!((a[0] - e[0]).abs() < 1e-9 && (a[1] - e[1]).abs() < 1e-9);
        }
    }
    assert_eq!(projected.color, "#123456");
    assert!(projected.important);
    let road = test_road(
        "turn",
        4.0,
        vec![
            [0.0, 0.0],
            [10.0, 0.0],
            [10.0, 10.0],
            [20.0, 10.0],
            [20.0, 20.0],
        ],
    );
    let feature = project_feature(SceneObject::from(&road), 16.0).unwrap();
    assert_eq!(
        feature.paths[0],
        vec![
            [0.0, 0.0],
            [10.0, 0.0],
            [10.0, 10.0],
            [20.0, 10.0],
            [20.0, 20.0]
        ]
    );
    assert_eq!(feature.color, "#aaa9a3");
    let FullObject::Area(mut area) = test_area("water", 0.0) else {
        unreachable!()
    };
    area.points.push([0.0, 10.0]);
    let area = FullObject::Area(area);
    let feature = project_feature(SceneObject::from(&area), 16.0).unwrap();
    assert_eq!(
        feature.paths[0],
        vec![
            [0.0, 10.0],
            [10.0, 10.0],
            [10.0, 20.0],
            [0.0, 20.0],
            [0.0, 10.0]
        ]
    );
    assert_eq!(feature.color, "#91bcc5");
    let FullObject::Scenery(mut scenery) = test_scenery("trees", 0.0) else {
        unreachable!()
    };
    scenery.assets.push(crate::atlas::scenery::SceneryAsset {
        point: [20.0, 10.0],
        size: 0.5,
        angle: 0.0,
        variant: 0,
    });
    let feature = project_feature(SceneObject::Scenery(scenery), 16.0).unwrap();
    assert_eq!(feature.color, "#477148");
    assert_eq!(feature.paths.len(), 1);
    assert_eq!(feature.paths[0].len(), 8);
    assert_eq!(feature.paths[0][0], [5.0, 10.0]);
    let mut many = match test_scenery("many", 0.0) {
        FullObject::Scenery(s) => s,
        _ => unreachable!(),
    };
    many.assets = (0..1025)
        .map(|i| crate::atlas::scenery::SceneryAsset {
            point: [i as f64, 0.0],
            size: if i == 3 { 0.5 } else { 5.0 },
            angle: 0.0,
            variant: 0,
        })
        .collect();
    let selected = project_feature(SceneObject::Scenery(many), 16.0).unwrap();
    assert_eq!(selected.paths.len(), 341);
    assert_eq!(selected.paths[0][0], [5.0, 0.0]);
    assert_eq!(selected.paths[1][0], [11.0, 0.0]);
    h.transform.angle = 0.0;
    h.contours = (0..1025)
        .map(|i| {
            let x = i as f64;
            vec![
                LocalPoint([x, 0.0]),
                LocalPoint([x + 0.5, 0.0]),
                LocalPoint([x + 0.5, 1.0]),
                LocalPoint([x, 1.0]),
            ]
        })
        .collect();
    let bounds = SceneObject::House(h.header()).bounds();
    let feature = project_feature(SceneObject::House(h.header()), 16.0).unwrap();
    assert_eq!(
        feature.paths,
        vec![vec![[
            (bounds[0] + bounds[2]) / 2.0,
            (bounds[1] + bounds[3]) / 2.0
        ]]]
    );
    let path: Vec<_> = (0..5000)
        .map(|i| [i as f64, if i % 2 == 0 { 0.0 } else { 0.1 }])
        .collect();
    let feature = project_feature(SceneObject::from(&test_road("long", 1.0, path)), 16.0).unwrap();
    assert!(feature.paths[0].len() <= 4096);
    assert_eq!(feature.paths[0].first(), Some(&[0.0, 0.0]));
    assert_eq!(feature.paths[0].last(), Some(&[4999.0, 0.1]));
    assert!(feature.paths[0].windows(2).all(|w| w[0][0] < w[1][0]));
}

#[test]
fn selection_budgets_ties_density_and_neighbor_tiles_are_independent() {
    let a = AtlasApplication::new().unwrap();
    a.db.execute_batch("BEGIN").unwrap();
    for (prefix, x) in [("a", 100.0), ("b", 800.0)] {
        for i in 0..130 {
            put(&a, test_area(&format!("{prefix}-area-{i:03}"), x));
            put(&a, test_scenery(&format!("{prefix}-scenery-{i:03}"), x));
            put(
                &a,
                test_road(
                    &format!("{prefix}-road-{i:03}"),
                    2.0,
                    vec![[x, 10.0], [x + 10.0, 10.0]],
                ),
            );
            put(
                &a,
                test_house(&format!("{prefix}-house-{i:03}"), x, 10.0, 10.0, false),
            );
        }
    }
    put(&a, test_house("z-small", 300.0, 10.0, 5.0, false));
    a.db.execute_batch("COMMIT").unwrap();
    let response = a
        .map_tiles(map_tiles::MapTilesArgs {
            level: 0,
            tiles: vec![[0, 0], [1, 0]],
        })
        .unwrap();
    for (tile, prefix) in response.tiles.iter().zip(["a", "b"]) {
        assert_eq!(tile.features.len(), 4 * 128);
        for (kind_index, kind) in ["area", "scenery", "road", "house"].iter().enumerate() {
            let part = &tile.features[kind_index * 128..(kind_index + 1) * 128];
            assert!(part.iter().all(|f| f.kind == *kind));
            let expected: Vec<_> = (0..128)
                .map(|i| format!("{prefix}-{kind}-{i:03}"))
                .collect();
            assert_eq!(
                part.iter().map(|f| f.id.clone()).collect::<Vec<_>>(),
                expected
            );
        }
    }
    assert!(response.tiles[0]
        .density
        .iter()
        .any(|d| d[0] == 18.0 && d[1] == 0.0 && (d[2] - 25.0 / 256.0).abs() < 1e-12));
    assert!(!response.tiles[0].features.iter().any(|f| f.id == "z-small"));
}

#[test]
fn fixed_house_filter_priority_and_road_sql_rank() {
    let a = AtlasApplication::new().unwrap();
    put(&a, test_house("important", 10.0, 10.0, 5.0, true));
    put(&a, test_house("large", 30.0, 10.0, 96.0, false));
    put(&a, test_house("small", 150.0, 10.0, 10.0, false));
    // Bounds include half-width: SQL ranks A as 2*102=204 and B as 4*57=228.
    // The feature rank uses the diagonal rather than the longest side.
    put(
        &a,
        test_road("road-a", 2.0, vec![[0.0, 200.0], [100.0, 300.0]]),
    );
    put(
        &a,
        test_road("road-b", 4.0, vec![[0.0, 220.0], [53.0, 220.0]]),
    );
    for level in [2, 3] {
        let result = a
            .map_tiles(map_tiles::MapTilesArgs {
                level,
                tiles: vec![[0, 0]],
            })
            .unwrap();
        let ids = |kind: &str| {
            result.tiles[0]
                .features
                .iter()
                .filter(|f| f.kind == kind)
                .map(|f| f.id.as_str())
                .collect::<Vec<_>>()
        };
        assert_eq!(ids("road"), ["road-b", "road-a"]);
        if level == 2 {
            assert_eq!(ids("house"), ["important", "large", "small"]);
        } else {
            assert_eq!(ids("house"), ["important", "large"]);
        }
        let road = result.tiles[0]
            .features
            .iter()
            .find(|f| f.id == "road-b")
            .unwrap();
        assert!((road.rank - 4.0 * 57.0_f64.hypot(4.0)).abs() < 1e-9);
        let other = result.tiles[0]
            .features
            .iter()
            .find(|f| f.id == "road-a")
            .unwrap();
        assert!(road.rank < other.rank);
    }
}
