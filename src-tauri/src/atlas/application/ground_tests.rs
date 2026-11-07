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

type GroundRows = Vec<(u8, i32, i32, Vec<u8>)>;
fn ground_rows(db: &Connection) -> GroundRows {
    let mut q = db.prepare("SELECT 0,x,y,pixels FROM ground_tiles UNION ALL SELECT level,x,y,pixels FROM ground_lod ORDER BY 1,2,3").unwrap();
    q.query_map([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)))
        .unwrap()
        .collect::<rusqlite::Result<_>>()
        .unwrap()
}
fn fixture_tile(seed: u8) -> Vec<u8> {
    let mut pixels = vec![0; crate::atlas::ground::BYTES];
    for (i, p) in pixels.as_chunks_mut::<4>().0.iter_mut().enumerate() {
        let alpha = [1, 2, 254, 255][(i + seed as usize) % 4];
        p.copy_from_slice(&[alpha / 2, alpha / 3, alpha, alpha]);
    }
    pixels
}
#[test]
fn ground_downsample_has_fixed_rounding_and_quadrants() {
    use crate::atlas::ground::{downsample_quadrant, BYTES};
    let mut child = vec![0; BYTES];
    child[0..4].copy_from_slice(&[1, 2, 3, 4]);
    child[4..8].copy_from_slice(&[1, 2, 3, 4]);
    child[256..260].copy_from_slice(&[0, 1, 2, 3]);
    child[260..264].copy_from_slice(&[0, 0, 1, 2]);
    for cy in 0..2 {
        for cx in 0..2 {
            let mut parent = vec![0; BYTES];
            downsample_quadrant(&mut parent, &child, cx, cy);
            let i = (cy * 32 * 64 + cx * 32) * 4;
            assert_eq!(&parent[i..i + 4], &[1, 1, 2, 3]);
            assert_eq!(parent.iter().filter(|&&v| v != 0).count(), 4);
        }
    }
}
#[test]
fn ground_rebuild_matches_incremental_and_finalizes_each_parent_once() {
    use crate::atlas::ground::GroundTile;
    use std::collections::BTreeSet;
    let direct = AtlasApplication::new().unwrap();
    let reference = AtlasApplication::new().unwrap();
    for (i, (x, y)) in [
        (-1_562_500, 2),
        (-3, -3),
        (-2, -3),
        (-3, -2),
        (-2, -2),
        (-1, 0),
        (0, -1),
        (0, 0),
        (1, 1),
        (3, 4),
        (1_562_500, -1_562_500),
    ]
    .into_iter()
    .enumerate()
    {
        direct
            .db
            .execute(
                "INSERT INTO ground_tiles VALUES(?,?,?)",
                params![x, y, fixture_tile(i as u8)],
            )
            .unwrap();
    }
    let mut weak = vec![0u8; crate::atlas::ground::BYTES];
    weak[3] = 1;
    direct
        .db
        .execute(
            "INSERT INTO ground_tiles VALUES(?,?,?)",
            params![10, 10, weak],
        )
        .unwrap();
    {
        let mut q = direct
            .db
            .prepare("SELECT x,y,pixels FROM ground_tiles ORDER BY x,y")
            .unwrap();
        let rows = q
            .query_map([], |r| {
                Ok(GroundTile {
                    x: r.get(0)?,
                    y: r.get(1)?,
                    pixels: r.get(2)?,
                })
            })
            .unwrap();
        for row in rows {
            ground_store::write(&reference.db, &[row.unwrap()]).unwrap();
        }
    }
    ground_store::take_finished();
    ground_store::rebuild_overview(&direct.db).unwrap();
    let actual = ground_store::take_finished();
    let expected_rows = ground_rows(&reference.db);
    assert_eq!(ground_rows(&direct.db), expected_rows);
    let mut expected = BTreeSet::new();
    for level in 1..=24 {
        for (_, x, y, _) in expected_rows.iter().filter(|r| r.0 == level - 1) {
            expected.insert((level, x.div_euclid(2), y.div_euclid(2)));
        }
    }
    assert_eq!(actual.len(), expected.len());
    assert_eq!(actual.into_iter().collect::<BTreeSet<_>>(), expected);
    ground_store::rebuild_overview(&direct.db).unwrap();
    assert_eq!(ground_rows(&direct.db), expected_rows);
    direct
        .db
        .execute("DELETE FROM ground_tiles WHERE x=-3 AND y=-3", [])
        .unwrap();
    direct
        .db
        .execute(
            "UPDATE ground_tiles SET pixels=? WHERE x=0 AND y=0",
            [fixture_tile(19)],
        )
        .unwrap();
    ground_store::rebuild_overview(&direct.db).unwrap();
    reference
        .db
        .execute("DELETE FROM ground_tiles", [])
        .unwrap();
    reference.db.execute("DELETE FROM ground_lod", []).unwrap();
    {
        let mut q = direct
            .db
            .prepare("SELECT x,y,pixels FROM ground_tiles ORDER BY x,y")
            .unwrap();
        for row in q
            .query_map([], |r| {
                Ok(GroundTile {
                    x: r.get(0)?,
                    y: r.get(1)?,
                    pixels: r.get(2)?,
                })
            })
            .unwrap()
        {
            ground_store::write(&reference.db, &[row.unwrap()]).unwrap();
        }
    }
    assert_eq!(ground_rows(&direct.db), ground_rows(&reference.db));
    let before = ground_rows(&direct.db);
    direct.db.execute_batch("CREATE TEMP TRIGGER fail_rebuild BEFORE INSERT ON ground_lod BEGIN SELECT RAISE(ABORT,'injected'); END; BEGIN").unwrap();
    assert!(ground_store::rebuild_overview(&direct.db).is_err());
    direct
        .db
        .execute_batch("ROLLBACK; DROP TRIGGER fail_rebuild")
        .unwrap();
    assert_eq!(ground_rows(&direct.db), before);
    direct.db.execute("DELETE FROM ground_tiles", []).unwrap();
    ground_store::rebuild_overview(&direct.db).unwrap();
    assert!(ground_rows(&direct.db).is_empty());
}
#[test]
fn ground_negative_halo_roundtrips_twice() {
    let mut a = AtlasApplication::new().unwrap();
    for (x, y) in [(-2, -1), (-1, -1), (0, -1)] {
        ground_store::write(
            &a.db,
            &[crate::atlas::ground::GroundTile {
                x,
                y,
                pixels: fixture_tile((x + 2) as u8),
            }],
        )
        .unwrap();
    }
    let response = |a: &mut AtlasApplication, level| {
        a.request(
            "groundTiles",
            json!({"level":level,"tiles":[[-2,-1],[-1,-1],[0,-1]]}),
        )
        .unwrap()["tiles"]
            .clone()
    };
    let before: Vec<_> = [0, 1, 2, 24]
        .into_iter()
        .map(|l| response(&mut a, l))
        .collect();
    let decoded: Vec<crate::atlas::ground::GroundTile> =
        serde_json::from_value(before[0].clone()).unwrap();
    for y in 0..66 {
        assert_eq!(
            &decoded[0].pixels[(y * 66 + 65) * 4..(y * 66 + 66) * 4],
            &decoded[1].pixels[(y * 66 + 1) * 4..(y * 66 + 2) * 4]
        );
    }
    let rows = ground_rows(&a.db);
    let dir = tempfile::tempdir().unwrap();
    for name in ["one", "two"] {
        let path = dir.path().join(name);
        a.save(&path).unwrap();
        a.open(&path).unwrap();
        assert_eq!(ground_rows(&a.db), rows);
        for (i, l) in [0, 1, 2, 24].into_iter().enumerate() {
            assert_eq!(response(&mut a, l), before[i]);
        }
    }
}
#[test]
fn ground_late_import_errors_leave_source_and_session_unchanged() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("source");
    let live_path = dir.path().join("live");
    let mut source = AtlasApplication::new().unwrap();
    for x in [-10, -9, -8] {
        ground_store::write(
            &source.db,
            &[crate::atlas::ground::GroundTile {
                x,
                y: 0,
                pixels: fixture_tile(3),
            }],
        )
        .unwrap();
    }
    source.save(&path).unwrap();
    let pristine = std::fs::read(&path).unwrap();
    let mut live = AtlasApplication::new().unwrap();
    request_edit(&mut live, "commit", stroke("paint"));
    live.save(&live_path).unwrap();
    request_edit(&mut live, "commit", stroke("erase"));
    history(&mut live, false);
    let before = dump(&live);
    let ground = ground_rows(&live.db);
    let active_path = live.path.clone();
    let mut nonpremul = vec![0; crate::atlas::ground::BYTES];
    nonpremul[0] = 1;
    for (x, pixels) in [
        (100, vec![1, 2]),
        (100, nonpremul),
        (100, vec![0; crate::atlas::ground::BYTES]),
        (1_562_501, fixture_tile(1)),
    ] {
        std::fs::write(&path, &pristine).unwrap();
        let db = Connection::open(&path).unwrap();
        db.execute("INSERT INTO ground_tiles VALUES(?,0,?)", params![x, pixels])
            .unwrap();
        drop(db);
        let bytes = std::fs::read(&path).unwrap();
        assert!(live.open(&path).is_err());
        assert_eq!(std::fs::read(&path).unwrap(), bytes);
        assert_eq!(dump(&live), before);
        assert_eq!(ground_rows(&live.db), ground);
        assert_eq!(live.path, active_path);
    }
    history(&mut live, true);
    history(&mut live, false);
    assert_eq!(ground_rows(&live.db), ground);
}
