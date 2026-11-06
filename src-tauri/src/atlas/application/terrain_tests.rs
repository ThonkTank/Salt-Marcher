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
    a.db.execute_batch("CREATE TEMP TRIGGER fail_terrain BEFORE INSERT ON terrain_lod BEGIN SELECT RAISE(ABORT,'injected'); END;").unwrap();
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
