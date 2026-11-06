use super::{application_test_support::*, *};
use crate::atlas::regions::*;
use geo::Area;
fn create(a: &mut AtlasApplication, name: &str, rank: &str) -> String {
    let r = request_edit(
        a,
        "commit",
        json!({"type":"regionEdit","action":{"kind":"create","name":name,"rankId":rank}}),
    );
    r["regions"][0]["id"].as_str().unwrap().into()
}
fn paint(a: &mut AtlasApplication, id: &str, x: f64, radius: f64, erase: bool) -> Value {
    request_edit(
        a,
        "commit",
        json!({"type":"regionStroke","id":id,"points":[[x,0]],"radius":radius,"erase":erase}),
    )
}
fn read(a: &mut AtlasApplication, id: &str) -> Value {
    a.request(
        "regions",
        json!({"version":a.status(),"bounds":null,"ids":[],"rankIds":[],"detail":id,"scale":1}),
    )
    .unwrap()
}
#[test]
fn region_transfer_independent_ranks_and_many_to_many_membership() {
    let mut a = AtlasApplication::new().unwrap();
    let town = create(&mut a, "Stadt", "builtin-rank-5");
    let west = create(&mut a, "West", "builtin-rank-6");
    let east = create(&mut a, "Ost", "builtin-rank-6");
    paint(&mut a, &town, 0.0, 20.0, false);
    paint(&mut a, &west, -10.0, 25.0, false);
    let town_before = region_store::get(&a.db, &town).unwrap();
    let west_before = region_store::get(&a.db, &west).unwrap();
    paint(&mut a, &east, 10.0, 25.0, false);
    let west_after = region_store::get(&a.db, &west).unwrap();
    let east_after = region_store::get(&a.db, &east).unwrap();
    assert_eq!(town_before, region_store::get(&a.db, &town).unwrap());
    assert_eq!(overlap(&geometry(&west_after), &geometry(&east_after)), 0.0);
    assert!(geometry(&west_after).unsigned_area() < geometry(&west_before).unsigned_area());
    let relations = read(&mut a, &town)["relations"].as_array().unwrap().clone();
    assert_eq!(relations.len(), 2);
    assert!(relations.iter().all(|r| r["higher"] == true));
    history(&mut a, false);
    assert_eq!(west_before, region_store::get(&a.db, &west).unwrap());
    history(&mut a, true);
    assert_eq!(west_after, region_store::get(&a.db, &west).unwrap());
    paint(&mut a, &east, 10.0, 100.0, true);
    assert_eq!(town_before, region_store::get(&a.db, &town).unwrap());
    assert!(region_store::get(&a.db, &east).unwrap().polygons.is_empty());
}
#[test]
fn region_holes_islands_preview_roundtrip_and_atomic_failures() {
    let mut a = AtlasApplication::new().unwrap();
    let id = create(&mut a, "Land", "builtin-rank-10");
    paint(&mut a, &id, 0.0, 100.0, false);
    paint(&mut a, &id, 0.0, 20.0, true);
    paint(&mut a, &id, 300.0, 10.0, false);
    let r = region_store::get(&a.db, &id).unwrap();
    assert_eq!(r.polygons.len(), 2);
    assert_eq!(r.polygons.iter().map(|p| p.holes.len()).sum::<usize>(), 1);
    let intent =
        json!({"type":"regionStroke","id":id,"points":[[400,0],[450,0]],"radius":20,"erase":false});
    let preview = request_edit(&mut a, "preview", intent.clone());
    let result = request_edit(&mut a, "commit", intent.clone());
    assert_eq!(preview["regions"], result["regions"]);
    let before = region_store::get(&a.db, &id).unwrap();
    let revision = a.status().revision;
    a.db.execute_batch("CREATE TEMP TRIGGER fail_region BEFORE INSERT ON regions BEGIN SELECT RAISE(ABORT,'injected'); END;").unwrap();
    assert!(a.request("commit",json!({"version":a.status(),"intent":{"type":"regionStroke","id":id,"points":[[800,0]],"radius":10,"erase":false}})).is_err());
    assert_eq!(a.status().revision, revision);
    assert_eq!(before, region_store::get(&a.db, &id).unwrap());
    a.db.execute_batch("DROP TRIGGER fail_region").unwrap();
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("regions.saltatlas");
    a.save(&path).unwrap();
    a.open(&path).unwrap();
    assert_eq!(before, region_store::get(&a.db, &id).unwrap());
    let source = Connection::open(&path).unwrap();
    source
        .execute(
            "UPDATE regions SET body=json_set(body,'$.rankId','missing')",
            [],
        )
        .unwrap();
    let session = a.status().session_id;
    assert!(a.open(&path).is_err());
    assert_eq!(session, a.status().session_id);
}
#[test]
fn region_catalog_reorder_delete_and_no_transitive_membership() {
    let mut a = AtlasApplication::new().unwrap();
    let low = create(&mut a, "A", "builtin-rank-3");
    let mid = create(&mut a, "B", "builtin-rank-4");
    let high = create(&mut a, "C", "builtin-rank-5");
    paint(&mut a, &low, 0.0, 10.0, false);
    paint(&mut a, &mid, 15.0, 10.0, false);
    paint(&mut a, &high, 30.0, 10.0, false);
    let links = read(&mut a, &low);
    assert_eq!(links["relations"].as_array().unwrap().len(), 1);
    assert_eq!(links["relations"][0]["region"]["id"], mid);
    let mut c = region_store::catalog(&a.db).unwrap();
    c.ranks.swap(0, 1);
    request_edit(
        &mut a,
        "commit",
        json!({"type":"regionEdit","action":{"kind":"catalog","catalog":c}}),
    );
    assert_eq!(read(&mut a, &low)["relations"][0]["higher"], false);
    request_edit(
        &mut a,
        "commit",
        json!({"type":"regionEdit","action":{"kind":"deleteRank","id":"builtin-rank-4"}}),
    );
    assert!(region_store::get(&a.db, &mid).is_err());
    assert!(region_store::get(&a.db, &low).is_ok());
    assert!(region_store::get(&a.db, &high).is_ok());
    history(&mut a, false);
    assert!(region_store::get(&a.db, &mid).is_ok());
}
#[test]
fn region_touching_bounds_empty_noop_and_world_limits() {
    let mut a = AtlasApplication::new().unwrap();
    let id = create(&mut a, "A", "builtin-rank-3");
    let before = a.status().revision;
    assert_eq!(paint(&mut a, &id, 0.0, 10.0, true)["changed"], false);
    assert_eq!(before, a.status().revision);
    paint(&mut a, &id, 99_999_999.0, 20.0, false);
    assert!(region_store::get(&a.db, &id)
        .unwrap()
        .polygons
        .iter()
        .flat_map(|p| &p.outer)
        .flatten()
        .all(|v| v.abs() <= 100_000_000.0));
    let g = brush(&[[0.0, 0.0]], 10.0).unwrap();
    let h = brush(&[[20.0, 0.0]], 10.0).unwrap();
    assert_eq!(overlap(&g, &h), 0.0);
    let first = region_store::get(&a.db, &id).unwrap();
    let repeat = paint(&mut a, &id, 99_999_999.0, 20.0, false);
    assert_eq!(repeat["changed"], false);
    assert_eq!(first, region_store::get(&a.db, &id).unwrap());
    let revision = a.status().revision;
    assert!(a.request("commit",json!({"version":a.status(),"intent":{"type":"regionStroke","id":id,"points":[[0,0]],"radius":0,"erase":false}})).is_err());
    assert_eq!(revision, a.status().revision);
}
#[test]
#[ignore = "10,000-region spatial benchmark"]
fn region_ten_thousand_local_read() {
    let mut a = AtlasApplication::new().unwrap();
    let template = create(&mut a, "Fixture", "builtin-rank-3");
    let base = region_store::get(&a.db, &template).unwrap();
    let tx = a.db.unchecked_transaction().unwrap();
    for i in 0..10_000 {
        let mut r = base.clone();
        r.id = format!("region-{}", 100 + i);
        r.rank_id = if i % 2 == 0 {
            "builtin-rank-3"
        } else {
            "builtin-rank-4"
        }
        .into();
        r.polygons = vec![RegionPolygon {
            outer: vec![
                [i as f64 * 50.0, 0.0],
                [i as f64 * 50.0 + 10.0, 0.0],
                [i as f64 * 50.0 + 10.0, 10.0],
                [i as f64 * 50.0, 10.0],
            ],
            holes: vec![],
        }];
        region_store::put(&tx, &r).unwrap();
    }
    tx.execute("UPDATE document_meta SET next_identity=20000", [])
        .unwrap();
    tx.commit().unwrap();
    let start = std::time::Instant::now();
    let r=a.request("regions",json!({"version":a.status(),"bounds":[0,-20,100,20],"ids":[],"rankIds":["builtin-rank-3","builtin-rank-4"],"detail":null,"scale":1})).unwrap();
    assert!(r["regions"].as_array().unwrap().len() <= 3);
    paint(&mut a, "region-100", 0.0, 8.0, false);
    eprintln!("10,000 regions, local read and edit: {:?}", start.elapsed());
    let query:String=a.db.query_row("EXPLAIN QUERY PLAN SELECT key FROM region_spatial WHERE min_x<=100 AND max_x>=0 AND min_y<=20 AND max_y>=-20",[],|r|r.get(3)).unwrap();
    assert!(query.contains("VIRTUAL TABLE INDEX"));
}
