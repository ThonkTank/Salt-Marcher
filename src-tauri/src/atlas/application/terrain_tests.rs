use super::application_test_support::*;
use super::*;
use crate::atlas::terrain::{self, Brush, BrushMode, Foundation, Grid, Platform};
fn stroke(points: Value) -> Value {
    json!({"type":"terrainStroke","brush":{"mode":"raise","radius":25,"amount":5,"strength":0.25,"target":10,"points":points},"view":{"level":0,"tiles":[[0,0]]}})
}
fn tile(a: &mut AtlasApplication) -> Value {
    a.request("terrainTiles", json!({"level":0,"tiles":[[0,0]]}))
        .unwrap()
}
#[test]
fn terrain_preview_history_water_and_file_roundtrip() {
    let mut a = AtlasApplication::new().unwrap();
    let before = a.status();
    let intent = stroke(json!([[10, 10], [30, 10]]));
    let preview = request_edit(&mut a, "preview", intent.clone());
    assert_eq!(a.status().revision, before.revision);
    assert!(preview["terrain"]["points"].as_array().unwrap().len() > 1);
    let committed = request_edit(&mut a, "commit", intent);
    assert_eq!(preview["terrain"], committed["terrain"]);
    let raised = tile(&mut a)["tiles"].clone();
    assert!(raised[0]["heights"][2 * 33 + 2].as_f64().unwrap() > terrain::BASE);
    history(&mut a, false);
    assert_eq!(
        tile(&mut a)["tiles"][0]["heights"][2 * 33 + 2],
        terrain::BASE
    );
    history(&mut a, true);
    assert_eq!(tile(&mut a)["tiles"], raised);
    request_edit(
        &mut a,
        "commit",
        json!({"type":"waterStroke","brush":{"mode":"lower","radius":25,"amount":5,"strength":0.25,"target":10,"points":[[80,80]]}}),
    );
    request_edit(
        &mut a,
        "commit",
        json!({"type":"createHouse","parcelId":null,"transform":{"x":0,"y":0,"angle":0},"width":4,"depth":4}),
    );
    let id = a
        .all_scene_headers()
        .unwrap()
        .iter()
        .find_map(|o| {
            if let SceneObject::House(h) = o {
                Some(h.id.clone())
            } else {
                None
            }
        })
        .unwrap();
    request_edit(
        &mut a,
        "commit",
        json!({"type":"setFoundation","id":id,"foundation":{"height":3,"transition":20}}),
    );
    let surface = tile(&mut a);
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("terrain.saltatlas");
    a.save(&path).unwrap();
    a.open(&path).unwrap();
    assert_eq!(tile(&mut a)["tiles"], surface["tiles"]);
    assert!(!tile(&mut a)["tiles"][0]["waters"]
        .as_array()
        .unwrap()
        .is_empty());
    assert_eq!(a.house(&id).unwrap().foundation.height, 3.0);
}
#[test]
fn terrain_rejection_noop_and_sql_failure_are_atomic() {
    let mut a = AtlasApplication::new().unwrap();
    let mut intent = stroke(json!([[0, 0]]));
    intent["brush"]["radius"] = json!(0);
    let status = a.status();
    assert!(a
        .request("commit", json!({"version":status,"intent":intent}))
        .is_err());
    assert_eq!(a.status().revision, 0);
    let mut noop = stroke(json!([[0, 0]]));
    noop["brush"]["mode"] = json!("flatten");
    noop["brush"]["target"] = json!(terrain::BASE);
    let no = request_edit(&mut a, "commit", noop);
    assert_eq!(no["changed"], false);
    a.db.execute_batch("CREATE TEMP TRIGGER fail_terrain BEFORE INSERT ON terrain BEGIN SELECT RAISE(ABORT,'injected'); END;").unwrap();
    assert!(a
        .request(
            "commit",
            json!({"version":a.status(),"intent":stroke(json!([[0,0]]))})
        )
        .is_err());
    assert_eq!(a.status().revision, 0);
    assert_eq!(
        a.db.query_row("SELECT count(*) FROM terrain", [], |r| r.get::<_, i64>(0))
            .unwrap(),
        0
    );
}
#[test]
fn platforms_follow_natural_ground_without_accumulating() {
    let rings = vec![vec![[0., 0.], [20., 0.], [20., 20.], [0., 20.]]];
    let mut g = Grid::new();
    g.insert((1, 1), 25.0);
    let p = Platform::new(rings.clone(), &g, Foundation::default());
    assert_eq!(p.level, 25.0);
    assert_eq!(
        terrain::surface(10., [15., 15.], std::slice::from_ref(&p)),
        25.0
    );
    assert_eq!(
        terrain::surface(10., [40., 10.], std::slice::from_ref(&p)),
        10.0
    );
    let mid = terrain::surface(10., [25., 10.], &[p]);
    assert!(mid > terrain::BASE && mid < 25.);
    let p = Platform::new(rings.clone(), &g, Foundation::default());
    assert_eq!(p.level, 25.0);
    g.insert((1, 1), 5.0);
    assert_eq!(Platform::new(rings, &g, Foundation::default()).level, 5.0);
}
#[test]
fn foundations_move_delete_and_undo_without_reading_cells() {
    use rusqlite::hooks::{AuthAction, AuthContext, Authorization};
    let mut a = AtlasApplication::new().unwrap();
    request_edit(&mut a, "commit", stroke(json!([[0, 0]])));
    let created = request_edit(
        &mut a,
        "commit",
        json!({"type":"createHouse","parcelId":null,"transform":{"x":0,"y":0,"angle":0},"width":4,"depth":4}),
    );
    let id = created["objects"][0]["id"].as_str().unwrap().to_owned();
    let original = tile(&mut a)["tiles"].clone();
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
        json!({"type":"transformHouse","id":id,"transform":{"x":70,"y":70,"angle":0}}),
    );
    let moved = tile(&mut a)["tiles"].clone();
    assert_ne!(original, moved);
    history(&mut a, false);
    assert_eq!(tile(&mut a)["tiles"], original);
    a.db.authorizer(None::<fn(AuthContext<'_>) -> Authorization>);
    request_edit(&mut a, "commit", json!({"type":"delete","id":id}));
    assert_ne!(tile(&mut a)["tiles"], original);
    history(&mut a, false);
    assert_eq!(tile(&mut a)["tiles"], original);
}
#[test]
fn stroke_sampling_modes_limits_and_negative_tiles() {
    let brush = Brush {
        resolution: None,
        roughness: None,
        mode: BrushMode::Raise,
        radius: 25.,
        amount: 1.,
        strength: 0.25,
        target: terrain::BASE - 6.,
        points: vec![[-20., -10.], [30., -10.]],
    };
    let mut a = Grid::new();
    terrain::stroke(&mut a, &brush).unwrap();
    let mut b = Grid::new();
    let mut split = brush.clone();
    split.points = vec![[-20., -10.], [0., -10.], [30., -10.]];
    terrain::stroke(&mut b, &split).unwrap();
    assert_eq!(a, b);
    let raised = terrain::height(&a, [0., -10.]);
    assert!(raised > terrain::BASE);
    for mode in [BrushMode::Lower, BrushMode::Smooth, BrushMode::Flatten] {
        let mut b = brush.clone();
        b.mode = mode;
        terrain::stroke(&mut a, &b).unwrap();
    }
    assert!(terrain::height(&a, [0., -10.]) < raised);
    let mut too_long = brush;
    too_long.points = vec![[-5e6, 0.], [5e6, 0.]];
    assert!(terrain::stroke(&mut Grid::new(), &too_long).is_err());
    let mut app = AtlasApplication::new().unwrap();
    assert!(app
        .request("terrainTiles", json!({"level":0,"tiles":[[i32::MAX,0]]}))
        .is_err());
    assert!(app
        .request("terrainTiles", json!({"level":22,"tiles":[]}))
        .is_err());
}

#[test]
fn terrain_import_rejects_invalid_points_without_replacing_session() {
    let mut a = AtlasApplication::new().unwrap();
    request_edit(&mut a, "commit", stroke(json!([[10, 10]])));
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("invalid.saltatlas");
    a.save(&path).unwrap();
    let before = a.status();
    let db = Connection::open(&path).unwrap();
    db.execute("UPDATE terrain SET z=100001", []).unwrap();
    drop(db);
    assert!(a.open(&path).is_err());
    assert_eq!(a.status().session_id, before.session_id);
    assert_eq!(a.status().revision, before.revision);
}
#[test]
fn neighboring_platforms_do_not_raise_each_other() {
    let square = |x| vec![vec![[x, 0.], [x + 20., 0.], [x + 20., 20.], [x, 20.]]];
    let mut g = Grid::new();
    g.insert((1, 1), 30.0);
    let high = Platform::new(
        square(0.),
        &g,
        Foundation {
            height: 1.,
            transition: 30.,
        },
    );
    let low = Platform::new(square(25.), &g, Foundation::default());
    assert_eq!(high.level, 30.);
    assert_eq!(low.level, terrain::BASE);
    assert_eq!(
        terrain::surface(10., [30., 10.], &[high.clone(), low.clone()]),
        terrain::BASE
    );
    assert_eq!(
        terrain::surface(10., [30., 10.], &[low, high]),
        terrain::BASE
    );
}

#[test]
fn coarse_preview_matches_committed_height_pyramid() {
    let mut a = AtlasApplication::new().unwrap();
    let mut intent = stroke(json!([[-10, 10], [80, 25]]));
    intent["view"] = json!({"level":3,"tiles":[[-1,0],[0,0]]});
    let preview = request_edit(&mut a, "preview", intent.clone());
    request_edit(&mut a, "commit", intent);
    let confirmed = a
        .request("terrainTiles", json!({"level":3,"tiles":[[-1,0],[0,0]]}))
        .unwrap();
    for (planned, actual) in preview["terrain"]["surface"]["tiles"]
        .as_array()
        .unwrap()
        .iter()
        .zip(confirmed["tiles"].as_array().unwrap())
    {
        for (p, a) in planned["heights"]
            .as_array()
            .unwrap()
            .iter()
            .zip(actual["heights"].as_array().unwrap())
        {
            assert!((p.as_f64().unwrap() - a.as_f64().unwrap()).abs() < 1e-10);
        }
    }
}

#[test]
fn multi_tile_platform_cache_keeps_local_order_and_never_reads_cells() {
    use rusqlite::hooks::{AuthAction, AuthContext, Authorization};
    let mut a = AtlasApplication::new().unwrap();
    let create = |a: &mut AtlasApplication, x| -> String {
        request_edit(a, "commit", json!({"type":"createHouse","parcelId":null,"transform":{"x":x,"y":0,"angle":0},"width":1,"depth":1}))["objects"][0]["id"].as_str().unwrap().to_owned()
    };
    let first = create(&mut a, 0);
    let second = create(&mut a, 600);
    let basement = create(&mut a, 1200);
    request_edit(
        &mut a,
        "commit",
        json!({"type":"setFoundation","id":first,"foundation":{"height":3,"transition":0}}),
    );
    request_edit(
        &mut a,
        "commit",
        json!({"type":"setFoundation","id":second,"foundation":{"height":7,"transition":500}}),
    );
    request_edit(
        &mut a,
        "commit",
        json!({"type":"room","buildingId":basement,"intent":{"kind":"draw","floor":-1,"cells":[[0,0]]}}),
    );
    request_edit(
        &mut a,
        "commit",
        json!({"type":"room","buildingId":basement,"intent":{"kind":"erase","floor":0,"cells":[[0,0]]}}),
    );
    assert!(a.house(&basement).unwrap().contours.is_empty());
    a.db.flush_prepared_statement_cache();
    a.db.authorizer(Some(|ctx: AuthContext<'_>| match ctx.action {
        AuthAction::Read {
            table_name: "house_cells" | "local_cells",
            ..
        } => Authorization::Deny,
        _ => Authorization::Allow,
    }));
    for level in [0, 1, 5, 6] {
        let coords = [[5, 0], [0, 0], [1, 0], [20, 0]];
        let multi = a
            .request("terrainTiles", json!({"level":level,"tiles":coords}))
            .unwrap();
        let reverse: Vec<_> = coords.iter().rev().copied().collect();
        let reversed = a
            .request("terrainTiles", json!({"level":level,"tiles":reverse}))
            .unwrap();
        for (i, xy) in coords.iter().enumerate() {
            let single = a
                .request("terrainTiles", json!({"level":level,"tiles":[xy]}))
                .unwrap();
            assert_eq!(multi["tiles"][i], single["tiles"][0]);
            assert_eq!(multi["tiles"][i], reversed["tiles"][3 - i]);
            let tops = multi["tiles"][i]["foundationTops"].as_array().unwrap();
            assert!(!tops.iter().any(|v| v[0] == basement));
            if level == 6 {
                assert!(tops.is_empty());
            }
        }
        if level == 0 {
            let ids = |tile: &Value| {
                tile["foundationTops"]
                    .as_array()
                    .unwrap()
                    .iter()
                    .map(|v| v[0].as_str().unwrap().to_owned())
                    .collect::<Vec<_>>()
            };
            assert_eq!(ids(&multi["tiles"][0]), vec![second.clone()]);
            assert_eq!(ids(&multi["tiles"][1]), vec![first.clone(), second.clone()]);
        }
    }
    a.db.authorizer(None::<fn(AuthContext<'_>) -> Authorization>);
}

#[test]
fn level_zero_uses_mixed_layers_without_overview_read() {
    use rusqlite::hooks::{AuthAction, AuthContext, Authorization};
    let mut a = AtlasApplication::new().unwrap();
    request_edit(
        &mut a,
        "commit",
        json!({"type":"terrainStroke","brush":{"resolution":4,"mode":"land","radius":1000,"amount":20,"strength":1,"target":40,"points":[[0,0]]},"view":null}),
    );
    request_edit(&mut a, "commit", stroke(json!([[0, 0]])));
    let expected = tile(&mut a)["tiles"].clone();
    assert!(expected[0]["heights"][0].as_f64().unwrap() > 10.);
    a.db.flush_prepared_statement_cache();
    a.db.authorizer(Some(|ctx: AuthContext<'_>| match ctx.action {
        AuthAction::Read {
            table_name: "house_cells" | "local_cells",
            ..
        } => Authorization::Deny,
        _ => Authorization::Allow,
    }));
    assert_eq!(tile(&mut a)["tiles"], expected);
    a.db.authorizer(None::<fn(AuthContext<'_>) -> Authorization>);
}

// Compare authoritative samples and the sole derived height index.
type HeightRow = (i64, i64, i64, i64, u64, i64);
pub(super) fn height_rows(db: &Connection) -> Vec<Vec<HeightRow>> {
    terrain_blocks::refresh(db).unwrap();
    [
        "SELECT 0,0,x,y,z,1 FROM terrain ORDER BY x,y",
        "SELECT level,0,x,y,z,1 FROM terrain_layers ORDER BY level,x,y",
        "SELECT source,depth,x,y,low,n FROM terrain_blocks ORDER BY source,depth,x,y",
        "SELECT source,depth,x,y,high,n FROM terrain_blocks ORDER BY source,depth,x,y",
    ]
    .iter()
    .map(|sql| {
        let mut q = db.prepare(sql).unwrap();
        q.query_map([], |r| {
            Ok((
                r.get(0)?,
                r.get(1)?,
                r.get(2)?,
                r.get(3)?,
                r.get::<_, f64>(4)?.to_bits(),
                r.get(5)?,
            ))
        })
        .unwrap()
        .collect::<rusqlite::Result<Vec<_>>>()
        .unwrap()
    })
    .collect()
}

#[test]
fn height_rebuild_matches_canonical_import_and_actual_open() {
    use rusqlite::params;
    let mut reference = AtlasApplication::new().unwrap();
    let mut direct = AtlasApplication::new().unwrap();
    let values = [-100_000.0, -100.0, 0.0, 0.1, 100.0, 100_000.0, -0.2, 0.3];
    for source in [1_u8, 3, 20, 21] {
        for x in -3_i32..=3 {
            for y in -3_i32..=3 {
                if (x + y).rem_euclid(3) == 0 {
                    continue;
                }
                let z = values[((x + 3) * 7 + y + 3) as usize % values.len()];
                world_terrain_store::apply(
                    &reference.db,
                    &world_terrain_store::WorldTerrainDelta {
                        level: source,
                        before: vec![],
                        after: vec![(x, y, Some(z))],
                    },
                    true,
                )
                .unwrap();
                direct
                    .db
                    .execute(
                        "INSERT INTO terrain_layers VALUES(?,?,?,?)",
                        params![source, x, y, z],
                    )
                    .unwrap();
            }
        }
    }
    for x in -9_i32..=9 {
        for y in -9_i32..=9 {
            if (x + y).rem_euclid(4) == 0 {
                continue;
            }
            let z = values[((x + 9) * 19 + y + 9) as usize % values.len()];
            terrain_store::write_points(&reference.db, &[(x, y, z)]).unwrap();
            direct
                .db
                .execute("INSERT INTO terrain VALUES(?,?,?)", params![x, y, z])
                .unwrap();
        }
    }
    terrain_blocks::rebuild(&direct.db).unwrap();
    let expected = height_rows(&reference.db);
    assert_eq!(height_rows(&direct.db), expected);
    terrain_blocks::rebuild(&direct.db).unwrap();
    assert_eq!(height_rows(&direct.db), expected);
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("heights.saltatlas");
    direct.save(&path).unwrap();
    let mut opened = AtlasApplication::new().unwrap();
    opened.open(&path).unwrap();
    assert_eq!(height_rows(&opened.db), expected);
    for level in [0, 1, 5, 6, 21] {
        let query = json!({"level":level,"tiles":[[-1,-1],[-1,0],[0,-1],[0,0]]});
        assert_eq!(
            reference.request("terrainTiles", query.clone()).unwrap()["tiles"],
            opened.request("terrainTiles", query).unwrap()["tiles"]
        );
    }
    let second = dir.path().join("heights-again.saltatlas");
    opened.save(&second).unwrap();
    let mut reopened = AtlasApplication::new().unwrap();
    reopened.open(&second).unwrap();
    assert_eq!(height_rows(&reopened.db), expected);
    direct
        .db
        .execute_batch("DELETE FROM terrain; DELETE FROM terrain_layers;")
        .unwrap();
    terrain_blocks::rebuild(&direct.db).unwrap();
    assert!(height_rows(&direct.db).iter().all(Vec::is_empty));
}

#[test]
fn height_sql_shift_matches_euclidean_parents() {
    let db = Connection::open_in_memory().unwrap();
    let mut q = db.prepare("SELECT ?1 >> ?3, ?2 >> ?3").unwrap();
    for shift in 1..=21 {
        let factor = 1_i32 << shift;
        let values = [
            -20_000_000,
            -factor - 1,
            -factor,
            -factor + 1,
            -3,
            -2,
            -1,
            0,
            1,
            factor - 1,
            factor,
            factor + 1,
            20_000_000,
        ];
        for x in values {
            for y in values {
                let actual: (i32, i32) = q
                    .query_row(rusqlite::params![x, y, shift], |r| {
                        Ok((r.get(0)?, r.get(1)?))
                    })
                    .unwrap();
                assert_eq!(actual, (x.div_euclid(factor), y.div_euclid(factor)));
            }
        }
    }
}

#[test]
fn height_authors_only_dirty_blocks_and_rebuild_rolls_back_failure() {
    use rusqlite::params;
    let reference = AtlasApplication::new().unwrap();
    let direct = AtlasApplication::new().unwrap();
    let old_start = reference.db.total_changes();
    for x in -8..8 {
        for y in -8..8 {
            terrain_store::write_points(&reference.db, &[(x, y, 0.1)]).unwrap();
            direct
                .db
                .execute("INSERT INTO terrain VALUES(?,?,?)", params![x, y, 0.1])
                .unwrap();
            for source in [1_u8, 3] {
                world_terrain_store::apply(
                    &reference.db,
                    &world_terrain_store::WorldTerrainDelta {
                        level: source,
                        before: vec![],
                        after: vec![(x, y, Some(0.1))],
                    },
                    true,
                )
                .unwrap();
                direct
                    .db
                    .execute(
                        "INSERT INTO terrain_layers VALUES(?,?,?,?)",
                        params![source, x, y, 0.1],
                    )
                    .unwrap();
            }
        }
    }
    let dirty_marks: u64 = reference
        .db
        .query_row("SELECT count(*) FROM terrain_dirty_blocks", [], |r| {
            r.get(0)
        })
        .unwrap();
    // Author writes only mark affected blocks; no per-author overview pyramid.
    let extra_writes = reference.db.total_changes() - old_start - 3 * 256 - dirty_marks;
    assert_eq!(extra_writes, 0);
    terrain_blocks::rebuild(&direct.db).unwrap();
    let snapshot = height_rows(&direct.db);
    assert_eq!(snapshot, height_rows(&reference.db));
    terrain_blocks::rebuild(&direct.db).unwrap();
    assert_eq!(height_rows(&direct.db), snapshot);
    direct.db.execute_batch("CREATE TEMP TRIGGER fail_height_rebuild BEFORE INSERT ON terrain_blocks BEGIN SELECT RAISE(ABORT,'injected'); END;").unwrap();
    {
        let tx = direct.db.unchecked_transaction().unwrap();
        assert!(terrain_blocks::rebuild(&tx).is_err());
        tx.rollback().unwrap();
    }
    assert_eq!(height_rows(&direct.db), snapshot);
    direct.db.execute_batch("DROP TRIGGER fail_height_rebuild; DELETE FROM terrain WHERE x=-8 AND y=-8; UPDATE terrain_layers SET z=9 WHERE level=1 AND x=-8 AND y=-8;").unwrap();
    terrain_blocks::rebuild(&direct.db).unwrap();
    terrain_store::write_samples(&reference.db, &[(-8, -8, None)]).unwrap();
    world_terrain_store::apply(
        &reference.db,
        &world_terrain_store::WorldTerrainDelta {
            level: 1,
            before: vec![],
            after: vec![(-8, -8, Some(9.0))],
        },
        true,
    )
    .unwrap();
    // Historical edit order can differ in float bits; compare to a fresh rebuild.
    terrain_blocks::rebuild(&reference.db).unwrap();
    assert_eq!(height_rows(&direct.db), height_rows(&reference.db));
}

#[test]
fn mixed_heights_and_river_survive_open_in_reconstruction_order() {
    let mut a = AtlasApplication::new().unwrap();
    request_edit(
        &mut a,
        "commit",
        json!({"type":"terrainStroke","brush":{"mode":"raise","radius":25,"amount":5,"strength":0.25,"target":10,"points":[[10,20],[100,20]]},"view":{"level":0,"tiles":[[0,0]]}}),
    );
    request_edit(
        &mut a,
        "commit",
        json!({"type":"terrainStroke","brush":{"resolution":2,"mode":"land","radius":100,"amount":20,"strength":1,"target":40,"points":[[0,0]]},"view":{"level":2,"tiles":[]}}),
    );
    request_edit(
        &mut a,
        "commit",
        json!({"type":"riverEdit","view":{"level":0,"tiles":[[0,0]]},"action":{"kind":"put","id":null,"name":"Fluss","nodes":[{"id":"","point":[10,20],"width":20},{"id":"","point":[100,20],"width":20}],"settings":{"tolerance":0,"roughness":0,"meander":40,"sourceFade":false,"seed":1},"reverse":false,"automatic":true,"snap":2}}),
    );
    let rivers = river_store::local(&a.db, [-1000., -1000., 1000., 1000.]).unwrap();
    let tiles = a
        .request("terrainTiles", json!({"level":0,"tiles":[[0,0]]}))
        .unwrap()["tiles"]
        .clone();
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("mixed.saltatlas");
    a.save(&path).unwrap();
    a.open(&path).unwrap();
    assert_eq!(
        river_store::local(&a.db, [-1000., -1000., 1000., 1000.]).unwrap(),
        rivers
    );
    assert_eq!(
        a.request("terrainTiles", json!({"level":0,"tiles":[[0,0]]}))
            .unwrap()["tiles"],
        tiles
    );
}

#[test]
fn height_rebuild_keeps_unrelated_tables_and_history() {
    let mut a = AtlasApplication::new().unwrap();
    request_edit(
        &mut a,
        "commit",
        json!({"type":"createHouse","parcelId":null,"transform":{"x":1000,"y":1000,"angle":0},"width":2,"depth":2}),
    );
    a.db.execute(
        "INSERT INTO ground_tiles VALUES(0,0,?1)",
        [vec![17_u8; crate::atlas::ground::BYTES]],
    )
    .unwrap();
    terrain_store::write_points(&a.db, &[(-1, 0, 0.1)]).unwrap();
    world_terrain_store::apply(
        &a.db,
        &world_terrain_store::WorldTerrainDelta {
            level: 1,
            before: vec![],
            after: vec![(0, 0, Some(0.2))],
        },
        true,
    )
    .unwrap();
    let before = dump(&a);
    let ground: Vec<u8> =
        a.db.query_row(
            "SELECT pixels FROM ground_tiles WHERE x=0 AND y=0",
            [],
            |r| r.get(0),
        )
        .unwrap();
    let density: Vec<(i32, i32, i32, u64, i64)> = {
        let mut q =
            a.db.prepare("SELECT level,x,y,mass,n FROM map_density ORDER BY level,x,y")
                .unwrap();
        q.query_map([], |r| {
            Ok((
                r.get(0)?,
                r.get(1)?,
                r.get(2)?,
                r.get::<_, f64>(3)?.to_bits(),
                r.get(4)?,
            ))
        })
        .unwrap()
        .collect::<rusqlite::Result<_>>()
        .unwrap()
    };
    let authors = height_rows(&a.db);
    terrain_blocks::rebuild(&a.db).unwrap();
    assert_eq!(dump(&a), before);
    assert_eq!(
        a.db.query_row(
            "SELECT pixels FROM ground_tiles WHERE x=0 AND y=0",
            [],
            |r| r.get::<_, Vec<u8>>(0)
        )
        .unwrap(),
        ground
    );
    let mut q =
        a.db.prepare("SELECT level,x,y,mass,n FROM map_density ORDER BY level,x,y")
            .unwrap();
    let after: Vec<(i32, i32, i32, u64, i64)> = q
        .query_map([], |r| {
            Ok((
                r.get(0)?,
                r.get(1)?,
                r.get(2)?,
                r.get::<_, f64>(3)?.to_bits(),
                r.get(4)?,
            ))
        })
        .unwrap()
        .collect::<rusqlite::Result<_>>()
        .unwrap();
    assert!(!density.is_empty());
    assert_eq!(after, density);
    assert_eq!(&height_rows(&a.db)[..2], &authors[..2]);
}

#[test]
fn versioned_surface_points_match_raster_nodes_and_foundation_influences() {
    use base64::{engine::general_purpose::STANDARD, Engine};
    let mut app = AtlasApplication::new().unwrap();
    request_edit(&mut app, "commit", stroke(json!([[10, 10], [40, 10]])));
    let house = request_edit(
        &mut app,
        "commit",
        json!({"type":"createHouse","parcelId":null,"transform":{"x":10,"y":10,"angle":0},"width":4,"depth":4}),
    );
    let id = house["objects"][0]["id"].as_str().unwrap();
    request_edit(
        &mut app,
        "commit",
        json!({"type":"setFoundation","id":id,"foundation":{"height":3,"transition":20}}),
    );
    let version: crate::atlas::Version = serde_json::from_value(json!(app.status())).unwrap();
    let points = vec![[10., 10.], [12.5, 12.5], [20., 20.], [40., 40.]];
    let values = app
        .surface_points(terrain::SurfacePointsArgs {
            version: version.clone(),
            points: points.clone(),
        })
        .unwrap();
    let view = app
        .terrain_tiles(terrain::TerrainArgs {
            pixels: Some(64),
            contour_interval: None,
            level: 0,
            tiles: vec![[0, 0]],
        })
        .unwrap();
    let bytes = STANDARD
        .decode(&view.tiles[0].raster.as_ref().unwrap().heights)
        .unwrap();
    for (p, z) in points.iter().zip(values.heights) {
        let i = ((p[1] / 2.5) as usize * 65 + (p[0] / 2.5) as usize) * 4;
        let actual = f32::from_le_bytes(bytes[i..i + 4].try_into().unwrap());
        assert_eq!(actual, z as f32);
    }
    let wire = serde_json::to_value(&view).unwrap();
    assert!(wire["tiles"][0].get("field").is_none());
    assert!(wire["tiles"][0].get("surfaceOffsets").is_none());
    assert!(wire["tiles"][0]["raster"].get("heights").is_none());
    request_edit(&mut app, "commit", stroke(json!([[10, 10]])));
    assert!(app
        .surface_points(terrain::SurfacePointsArgs { version, points })
        .is_err());
    assert!(app
        .surface_points(terrain::SurfacePointsArgs {
            version: serde_json::from_value(json!(app.status())).unwrap(),
            points: vec![[0., 0.]; 65]
        })
        .is_err());
}

#[test]
fn brush_author_reads_ignore_distant_rows_in_the_same_columns() {
    use std::sync::{
        atomic::{AtomicUsize, Ordering},
        Arc,
    };
    for level in [0, 4, 21] {
        let a = AtlasApplication::new().unwrap();
        let factor = 2f64.powi(level as i32);
        let regions = [[-80. * factor, -80. * factor, 80. * factor, 80. * factor]];
        let insert = if level == 0 {
            "INSERT INTO terrain VALUES(?1,?2,?3)"
        } else {
            "INSERT INTO terrain_layers VALUES(?4,?1,?2,?3)"
        };
        for y in -2..=2 {
            if level == 0 {
                a.db.execute(insert, rusqlite::params![0, y, 10.]).unwrap();
            } else {
                a.db.execute(insert, rusqlite::params![0, y, 10., level])
                    .unwrap();
            }
        }
        let read = || {
            let steps = Arc::new(AtomicUsize::new(0));
            let count = steps.clone();
            a.db.progress_handler(
                100,
                Some(move || {
                    count.fetch_add(1, Ordering::Relaxed);
                    false
                }),
            );
            let grid = terrain_store::brush_grid(&a.db, &regions, level).unwrap();
            a.db.progress_handler(0, None::<fn() -> bool>);
            (grid, steps.load(Ordering::Relaxed))
        };
        let (before, budget) = read();
        for y in 10000..12000 {
            if level == 0 {
                a.db.execute(insert, rusqlite::params![0, y, 10.]).unwrap();
            } else {
                a.db.execute(insert, rusqlite::params![0, y, 10., level])
                    .unwrap();
            }
        }
        let (after, actual) = read();
        assert_eq!(before, after);
        assert!(
            actual <= budget + 20,
            "source {level}: {budget} -> {actual} VM batches"
        );
    }
}

#[test]
fn brush_author_blocks_match_rectangular_reference_and_deduplicate_sources() {
    use std::sync::{
        atomic::{AtomicUsize, Ordering},
        Arc,
    };
    let a = AtlasApplication::new().unwrap();
    for level in 0..=21 {
        for y in (-40..=40).step_by(3) {
            for x in (-40..=40).step_by(3) {
                let z = ((x * 7 + y * 13 + level) % 29) as f64;
                a.db.execute(
                    "INSERT INTO terrain_layers VALUES(?,?,?,?)",
                    rusqlite::params![level, x, y, z],
                )
                .unwrap();
                if level == 0 {
                    a.db.execute(
                        "INSERT INTO terrain VALUES(?,?,?)",
                        rusqlite::params![x, y, z + 1.],
                    )
                    .unwrap();
                }
            }
        }
    }
    for min in [0, 1, 4, 21] {
        let factor = 2f64.powi(min as i32);
        let regions: Vec<_> = [
            [-160., -160., 0., 0.],
            [-80., -80., 80., 80.],
            [80., -160., 160., -80.],
            [-160., 80., -80., 160.],
        ]
        .map(|b| b.map(|v| v * factor))
        .into();
        let mut reference = Grid::new();
        for &b in &regions {
            if min == 0 {
                reference.merge(terrain_store::grid(&a.db, b).unwrap());
            } else {
                reference.merge(Grid {
                    points: Default::default(),
                    layers: world_terrain_store::read_from(&a.db, b, min).unwrap(),
                });
            }
        }
        let read = |regions: &[crate::atlas::Bounds]| {
            let count = Arc::new(AtomicUsize::new(0));
            let steps = count.clone();
            a.db.progress_handler(
                100,
                Some(move || {
                    steps.fetch_add(1, Ordering::Relaxed);
                    false
                }),
            );
            let result = terrain_store::brush_grid(&a.db, regions, min).unwrap();
            a.db.progress_handler(0, None::<fn() -> bool>);
            (result, count.load(Ordering::Relaxed))
        };
        let (actual, work) = read(&regions);
        assert_eq!(actual, reference, "source {min}");
        let repeated: Vec<_> = regions
            .iter()
            .copied()
            .cycle()
            .take(regions.len() * 32)
            .collect();
        let (actual, repeated_work) = read(&repeated);
        assert_eq!(actual, reference);
        assert!(
            repeated_work <= work + 1,
            "source {min}: {work} -> {repeated_work}"
        );
    }
}
