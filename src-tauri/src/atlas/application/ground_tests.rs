use super::{application_test_support::*, *};
fn stroke(mode: &str) -> Value {
    json!({"type":"groundStroke","brush":{"mode":mode,"tip":"soft","color":[100,180,60],"diameter":30,"opacity":1,"flow":1,"seed":1,"points":[[63,0,0],[65,0,250]]},"view":{"level":0,"tiles":[[0,0],[1,0]]}})
}
fn tiles(a: &mut AtlasApplication, level: u8) -> Value {
    a.request("groundTiles", json!({"level":level,"tiles":[[0,0],[1,0]]}))
        .unwrap()["tiles"]
        .clone()
}
#[test]
fn ground_preview_history_halo_and_file_roundtrip() {
    let mut a = AtlasApplication::new().unwrap();
    let blank = tiles(&mut a, 0);
    let preview = request_edit(&mut a, "preview", stroke("paint"));
    assert_eq!(a.status().revision, 0);
    let commit = request_edit(&mut a, "commit", stroke("paint"));
    assert_eq!(preview["ground"]["tiles"], commit["ground"]["tiles"]);
    let painted = tiles(&mut a, 0);
    assert_ne!(painted, blank);
    assert_eq!(painted, commit["ground"]["tiles"]);
    // Left tile's right halo is the right tile's first interior pixel.
    let decoded: Vec<crate::atlas::ground::GroundTile> =
        serde_json::from_value(painted.clone()).unwrap();
    for y in 0..66 {
        for c in 0..4 {
            assert_eq!(
                decoded[0].pixels[(y * 66 + 65) * 4 + c],
                decoded[1].pixels[(y * 66 + 1) * 4 + c]
            );
        }
    }
    let overview = tiles(&mut a, 2);
    history(&mut a, false);
    assert_eq!(tiles(&mut a, 0), blank);
    history(&mut a, true);
    assert_eq!(tiles(&mut a, 0), painted);
    request_edit(&mut a, "commit", stroke("erase"));
    assert_ne!(tiles(&mut a, 0), painted);
    history(&mut a, false);
    assert_eq!(tiles(&mut a, 0), painted);
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("ground.saltatlas");
    a.save(&path).unwrap();
    a.open(&path).unwrap();
    assert_eq!(tiles(&mut a, 0), painted);
    assert_eq!(tiles(&mut a, 2), overview);
    assert_eq!(
        a.db.query_row("SELECT count(*) FROM terrain", [], |r| r.get::<_, i64>(0))
            .unwrap(),
        0
    );
    request_edit(
        &mut a,
        "commit",
        json!({"type":"createHouse","parcelId":null,"transform":{"x":63,"y":0,"angle":0},"width":4,"depth":4}),
    );
}
#[test]
fn ground_noop_failure_and_invalid_file_are_atomic() {
    let mut a = AtlasApplication::new().unwrap();
    assert_eq!(
        request_edit(&mut a, "commit", stroke("erase"))["changed"],
        false
    );
    a.db.execute_batch("CREATE TEMP TRIGGER fail_ground BEFORE INSERT ON ground_lod BEGIN SELECT RAISE(ABORT,'injected'); END;").unwrap();
    assert!(a
        .request(
            "commit",
            json!({"version":a.status(),"intent":stroke("paint")})
        )
        .is_err());
    assert_eq!(a.status().revision, 0);
    assert_eq!(
        a.db.query_row("SELECT count(*) FROM ground_tiles", [], |r| r
            .get::<_, i64>(0))
            .unwrap(),
        0
    );
    a.db.execute_batch("DROP TRIGGER fail_ground").unwrap();
    request_edit(&mut a, "commit", stroke("paint"));
    let before = tiles(&mut a, 0);
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("bad.saltatlas");
    a.save(&path).unwrap();
    let db = Connection::open(&path).unwrap();
    db.execute("UPDATE ground_tiles SET pixels=x'0102'", [])
        .unwrap();
    drop(db);
    assert!(a.open(&path).is_err());
    assert_eq!(tiles(&mut a, 0), before);
}
