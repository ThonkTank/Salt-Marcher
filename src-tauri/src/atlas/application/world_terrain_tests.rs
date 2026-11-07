use super::{application_test_support::*, *};
use crate::atlas::terrain;
fn stroke(mode: &str, level: u8, p: [f64; 2], radius: f64) -> Value {
    json!({"type":"terrainStroke","brush":{"resolution":level,"mode":mode,"radius":radius,"amount":20,"strength":1,"target":40,"points":[p]},"view":{"level":level,"tiles":[]}})
}
fn height(a: &AtlasApplication, p: [f64; 2]) -> f64 {
    terrain::height(
        &terrain_store::grid(&a.db, [p[0] - 5., p[1] - 5., p[0] + 5., p[1] + 5.]).unwrap(),
        p,
    )
}
#[test]
fn world_land_refinement_history_and_roundtrip() {
    let mut a = AtlasApplication::new().unwrap();
    let p = [50_000_000., -50_000_000.];
    assert_eq!(height(&a, p), -100.);
    let intent = stroke("land", 16, p, 2_000_000.);
    let before = a.status();
    let preview = request_edit(&mut a, "preview", intent.clone());
    assert_eq!(a.status().revision, before.revision);
    assert_eq!(height(&a, p), -100.);
    let commit = request_edit(&mut a, "commit", intent);
    assert_eq!(preview["terrain"], commit["terrain"]);
    assert!((height(&a, p) - 10.).abs() < 1e-8);
    let count: i64 =
        a.db.query_row("SELECT count(*) FROM terrain_layers", [], |r| r.get(0))
            .unwrap();
    assert!(count < 500);
    assert_eq!(
        a.db.query_row("SELECT count(*) FROM terrain", [], |r| r.get::<_, i64>(0))
            .unwrap(),
        0
    );
    request_edit(&mut a, "commit", stroke("raise", 0, p, 25.));
    let detailed = height(&a, p);
    request_edit(&mut a, "commit", stroke("sea", 16, p, 2_000_000.));
    assert!((height(&a, p) - detailed).abs() < 1e-10);
    assert!(height(&a, [p[0] + 1000., p[1]]) < 0.);
    history(&mut a, false);
    history(&mut a, false);
    assert!((height(&a, p) - 10.).abs() < 1e-8);
    assert_eq!(
        a.db.query_row("SELECT count(*) FROM terrain", [], |r| r.get::<_, i64>(0))
            .unwrap(),
        0
    );
    history(&mut a, true);
    history(&mut a, true);
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("world.saltatlas");
    a.save(&path).unwrap();
    a.open(&path).unwrap();
    assert!((height(&a, p) - detailed).abs() < 1e-10);
    let view = a
        .request("terrainTiles", json!({"level":18,"tiles":[[1,-2]]}))
        .unwrap();
    assert_eq!(view["tiles"][0]["heights"].as_array().unwrap().len(), 1089);
}
#[test]
fn world_edges_seams_and_preview_sql_rollback() {
    let mut a = AtlasApplication::new().unwrap();
    let p = [-320., 0.];
    request_edit(&mut a, "commit", stroke("land", 2, p, 100.));
    let tiles = a
        .request(
            "terrainTiles",
            json!({"level":2,"tiles":[[-1,-1],[-1,0],[0,0]]}),
        )
        .unwrap();
    let t = tiles["tiles"].as_array().unwrap();
    for x in 0..=32 {
        assert_eq!(t[0]["heights"][32 * 33 + x], t[1]["heights"][x]);
    }
    let revision = a.status().revision;
    a.db.execute_batch("CREATE TEMP TRIGGER broken_world BEFORE INSERT ON terrain_layers BEGIN SELECT RAISE(ABORT,'world failure'); END;").unwrap();
    let result = a.request(
        "commit",
        json!({"version":a.status(),"intent":stroke("raise",3,p,100.)}),
    );
    assert!(result.is_err());
    assert_eq!(a.status().revision, revision);
    assert!((height(&a, p) - 10.).abs() < 1e-10);
    a.db.execute_batch("DROP TRIGGER broken_world").unwrap();
    let result = a.request(
        "commit",
        json!({"version":a.status(),"intent":stroke("land",4,[100_000_001.,0.],100.)}),
    );
    assert!(result.is_err());
    assert_eq!(a.status().revision, revision);
}
#[test]
fn world_overview_never_reads_house_cells_and_respects_local_heights() {
    use rusqlite::hooks::{AuthAction, AuthContext, Authorization};
    let mut a = AtlasApplication::new().unwrap();
    request_edit(&mut a, "commit", stroke("land", 4, [0., 0.], 1000.));
    request_edit(&mut a, "commit", stroke("raise", 0, [0., 0.], 20.));
    a.db.flush_prepared_statement_cache();
    a.db.authorizer(Some(|c: AuthContext<'_>| match c.action {
        AuthAction::Read {
            table_name: "house_cells" | "local_cells",
            ..
        } => Authorization::Deny,
        _ => Authorization::Allow,
    }));
    let view = a
        .request("terrainTiles", json!({"level":5,"tiles":[[0,0]]}))
        .unwrap();
    let z = view["tiles"][0]["heights"][0].as_f64().unwrap();
    assert!(
        (10.0..=30.).contains(&z),
        "no double-counted coarse height: {z}"
    );
    a.request("mapTiles", json!({"level":18,"tiles":[[-1,-1],[0,0]]}))
        .unwrap();
}

#[test]
#[ignore = "world benchmark; writes evidence under target/diagnostics"]
fn world_scale_benchmark() {
    use crate::atlas::regions::*;
    use std::time::Instant;
    let output = std::path::PathBuf::from("target/diagnostics/world");
    std::fs::create_dir_all(&output).unwrap();
    let mut a = AtlasApplication::new().unwrap();
    for p in [
        [-40_000_000., -20_000_000.],
        [20_000_000., 10_000_000.],
        [50_000_000., -30_000_000.],
    ] {
        request_edit(&mut a, "commit", stroke("land", 18, p, 9_000_000.));
    }
    a.db.execute_batch("BEGIN").unwrap();
    for i in 0..10000 {
        let x = f64::from(i % 100) * 1_000_000. - 50_000_000.;
        let y = f64::from(i / 100) * 1_000_000. - 50_000_000.;
        let d = 500. + f64::from(i % 10) * 100.;
        region_store::put(
            &a.db,
            &Region {
                id: format!("region-{}", i + 1),
                name: format!("Ort {}", i + 1),
                rank_id: "builtin-rank-19".into(),
                polygons: vec![RegionPolygon {
                    outer: vec![[x, y], [x + d, y], [x + d, y + d], [x, y + d]],
                    holes: vec![],
                }],
                style: RegionStyle {
                    color: "#6087b5".into(),
                    opacity: 0.15,
                    width: 2.,
                    dash: RegionDash::Solid,
                },
                label: RegionLabel {
                    anchor: None,
                    min_scale: None,
                    max_scale: None,
                },
            },
        )
        .unwrap();
    }
    a.db.execute("UPDATE document_meta SET next_identity=10001", [])
        .unwrap();
    a.db.execute_batch("COMMIT").unwrap();
    a.save(&output.join("world-10000.saltatlas")).unwrap();
    let start = Instant::now();
    a.open(&output.join("world-10000.saltatlas")).unwrap();
    let open = start.elapsed();
    let mut times = vec![];
    let mut bytes = 0;
    for _ in 0..10 {
        let start = Instant::now();
        let regions = a.request("regions", json!({"version":a.status(),"bounds":[-100000000,-100000000,100000000,100000000],"ids":[],"rankIds":["builtin-rank-19"],"detail":null,"scale":0.000005,"exact":false})).unwrap();
        assert!(regions["regions"].as_array().unwrap().len() <= 1000);
        assert!(regions["summaries"].as_array().unwrap().len() <= 1000);
        let tiles: Vec<_> = (-3..=2)
            .flat_map(|y| (-3..=2).map(move |x| [x, y]))
            .collect();
        let terrain = a
            .request("terrainTiles", json!({"level":18,"tiles":tiles}))
            .unwrap();
        let map = a
            .request("mapTiles", json!({"level":18,"tiles":[[-1,-1],[0,0]]}))
            .unwrap();
        bytes = serde_json::to_vec(&(regions, terrain, map)).unwrap().len();
        times.push(start.elapsed().as_secs_f64());
    }
    let log = format!("regions=10000\ncontinents=3\nopen_seconds={}\nread_seconds={times:?}\npayload_bytes={bytes}\n", open.as_secs_f64());
    std::fs::write(output.join("benchmark.txt"), &log).unwrap();
    eprintln!("{log}");
    assert!(bytes < 2_000_000);
}
