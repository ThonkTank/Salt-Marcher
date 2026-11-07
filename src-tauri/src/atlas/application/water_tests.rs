use super::{application_test_support::*, *};
use crate::atlas::{terrain, water};
fn paint(points: Value, radius: f64) -> Value {
    json!({"type":"waterStroke","brush":{"mode":"lower","radius":radius,"amount":5,"strength":1,"target":10,"points":points},"view":{"level":0,"tiles":[[0,0]]}})
}
fn all(a: &AtlasApplication) -> Vec<water::WaterBody> {
    water_store::local(&a.db, [-1000., -1000., 1000., 1000.]).unwrap()
}
fn height_edit(points: Value, mode: &str, amount: f64, radius: f64) -> Value {
    json!({"type":"terrainStroke","brush":{"mode":mode,"radius":radius,"amount":amount,"strength":1,"target":10,"points":points}})
}
#[test]
fn water_preview_history_and_file_are_one_atomic_edit() {
    let mut a = dry_world();
    let i = paint(json!([[40, 40], [80, 40]]), 20.);
    let p = request_edit(&mut a, "preview", i.clone());
    assert_eq!(p["valid"], true);
    assert!(all(&a).is_empty());
    let c = request_edit(&mut a, "commit", i);
    assert_eq!(p["terrain"], c["terrain"]);
    let waters = all(&a);
    assert_eq!(waters.len(), 1);
    assert_eq!(waters[0].level, 10.);
    assert_eq!(
        p["terrain"]["surface"]["tiles"][0]["waters"],
        serde_json::to_value(&waters).unwrap()
    );
    let g = terrain_store::grid(&a.db, [0., 0., 160., 160.]).unwrap();
    assert!(terrain::height(&g, [40., 40.]) < 10.);
    history(&mut a, false);
    assert!(all(&a).is_empty());
    assert!(terrain_store::grid(&a.db, [0., 0., 160., 160.])
        .unwrap()
        .is_empty());
    history(&mut a, true);
    assert_eq!(all(&a), waters);
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("water.saltatlas");
    a.save(&path).unwrap();
    a.open(&path).unwrap();
    assert_eq!(all(&a), waters);
    assert_eq!(terrain_store::grid(&a.db, [0., 0., 160., 160.]).unwrap(), g);
}
#[test]
fn raised_island_loses_water_permanently() {
    let mut a = dry_world();
    request_edit(&mut a, "commit", paint(json!([[40, 40]]), 30.));
    assert_eq!(water::level_at(&all(&a), [40., 40.]), Some(10.));
    request_edit(
        &mut a,
        "commit",
        height_edit(json!([[40, 40]]), "raise", 30., 15.),
    );
    assert_eq!(water::level_at(&all(&a), [40., 40.]), None);
    request_edit(
        &mut a,
        "commit",
        height_edit(json!([[40, 40]]), "lower", 30., 15.),
    );
    assert_eq!(water::level_at(&all(&a), [40., 40.]), None);
    history(&mut a, false);
    history(&mut a, false);
    assert_eq!(water::level_at(&all(&a), [40., 40.]), Some(10.));
}
#[test]
fn water_joins_at_lowest_existing_level_and_overpainting_deepens() {
    let mut a = dry_world();
    request_edit(&mut a, "commit", paint(json!([[20, 40]]), 15.));
    request_edit(
        &mut a,
        "commit",
        height_edit(json!([[100, 40]]), "lower", 3., 25.),
    );
    let lower_level = terrain::height(
        &terrain_store::grid(&a.db, [80., 20., 120., 60.]).unwrap(),
        [100., 40.],
    );
    request_edit(&mut a, "commit", paint(json!([[100, 40]]), 15.));
    assert_eq!(all(&a).len(), 2);
    request_edit(&mut a, "commit", paint(json!([[20, 40], [100, 40]]), 15.));
    assert!(all(&a).iter().all(|w| (w.level - lower_level).abs() < 1e-8));
    let before = terrain::height(
        &terrain_store::grid(&a.db, [0., 0., 160., 160.]).unwrap(),
        [100., 40.],
    );
    request_edit(&mut a, "commit", paint(json!([[100, 40]]), 15.));
    let after = terrain::height(
        &terrain_store::grid(&a.db, [0., 0., 160., 160.]).unwrap(),
        [100., 40.],
    );
    assert!(after < before);
}
#[test]
fn water_sql_failure_and_invalid_brush_do_not_publish() {
    let mut a = dry_world();
    a.db.execute_batch("CREATE TEMP TRIGGER fail_water BEFORE INSERT ON waters BEGIN SELECT RAISE(ABORT,'injected'); END;").unwrap();
    assert!(a
        .request(
            "commit",
            json!({"version":a.status(),"intent":paint(json!([[40,40]]),20.)})
        )
        .is_err());
    assert_eq!(a.status().revision, 0);
    assert!(all(&a).is_empty());
    assert!(terrain_store::grid(&a.db, [0., 0., 160., 160.])
        .unwrap()
        .is_empty());
    let mut bad = paint(json!([[40, 40]]), 20.);
    bad["brush"]["amount"] = json!(-1);
    assert!(a
        .request("commit", json!({"version":a.status(),"intent":bad}))
        .is_err());
}
#[test]
fn water_coast_raises_low_ground_and_import_rejects_corruption() {
    let mut a = dry_world();
    request_edit(
        &mut a,
        "commit",
        height_edit(json!([[80, 40]]), "lower", 8., 25.),
    );
    request_edit(&mut a, "commit", paint(json!([[40, 40], [60, 40]]), 20.));
    let grid = terrain_store::grid(&a.db, [0., 0., 160., 160.]).unwrap();
    assert!(terrain::height(&grid, [80., 40.]) > 2.);
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("bad.saltatlas");
    a.save(&path).unwrap();
    let session = a.status().session_id;
    let db = Connection::open(&path).unwrap();
    db.execute("UPDATE waters SET body=json_set(body,'$.level',100001)", [])
        .unwrap();
    drop(db);
    assert!(a.open(&path).is_err());
    assert_eq!(a.status().session_id, session);
}
#[test]
fn water_and_river_share_contact_level_and_survive_roundtrip() {
    let mut a = dry_world();
    let river = json!({"type":"riverEdit","view":null,"action":{"kind":"put","id":null,"name":"Zufluss","nodes":[{"id":"","point":[10,40],"width":10},{"id":"","point":[100,40],"width":10}],"settings":{"tolerance":0,"roughness":0,"meander":40,"sourceFade":false,"seed":1},"reverse":false,"automatic":true,"snap":2}});
    request_edit(&mut a, "commit", river);
    // The river bed is below its water: painting on the river must inherit its water, not its bed.
    request_edit(&mut a, "commit", paint(json!([[90, 40]]), 25.));
    let waters = all(&a);
    assert!(waters.iter().all(|w| w.level == 10.));
    let rivers = river_store::local(&a.db, [-100., -100., 200., 200.]).unwrap();
    assert_eq!(rivers[0].samples.last().unwrap().water, 10.);
    assert!(rivers[0]
        .samples
        .windows(2)
        .all(|p| p[0].water >= p[1].water));
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("mouth.saltatlas");
    a.save(&path).unwrap();
    a.open(&path).unwrap();
    assert_eq!(all(&a), waters);
    assert_eq!(
        river_store::local(&a.db, [-100., -100., 200., 200.]).unwrap(),
        rivers
    );
}
#[test]
fn lake_boundary_propagates_backwater_upstream_without_a_global_floor() {
    use crate::atlas::rivers::*;
    let mut a = dry_world();
    request_edit(
        &mut a,
        "commit",
        json!({"type":"riverEdit","view":null,"action":{"kind":"put","id":null,"name":"Fluss","nodes":[{"id":"","point":[0,0],"width":10},{"id":"","point":[100,0],"width":10}],"settings":{"tolerance":0,"roughness":0,"meander":40,"sourceFade":false,"seed":1},"reverse":false,"automatic":true,"snap":2}}),
    );
    let r = river_store::local(&a.db, [-100., -100., 200., 200.]).unwrap()[0]
        .river
        .clone();
    let raised = profiles(
        vec![r.clone()],
        &mut |p| Ok((p[0] >= 80.).then_some(20.)),
        &mut |_| Ok(10.),
    )
    .unwrap();
    assert!(raised[0].samples.iter().all(|s| s.water == 20.));
    let below_zero = profiles(vec![r], &mut |_| Ok(None), &mut |_| Ok(-30.)).unwrap();
    assert!(below_zero[0].samples.iter().all(|s| s.water == -30.));
}
#[test]
fn subgrid_repainting_without_height_changes_is_a_noop() {
    let mut a = dry_world();
    request_edit(&mut a, "commit", paint(json!([[40, 40]]), 30.));
    let revision = a.status().revision;
    let waters = all(&a);
    let no = request_edit(&mut a, "commit", paint(json!([[42, 42]]), 0.1));
    assert_eq!(no["changed"], false);
    assert_eq!(a.status().revision, revision);
    assert_eq!(all(&a), waters);
}
#[test]
fn water_extent_and_exact_shoreline_contact_include_the_full_polygon() {
    let mut a = dry_world();
    request_edit(&mut a, "commit", paint(json!([[40, 40]]), 30.));
    let waters = all(&a);
    let boundary = waters[0].polygons[0].outer[0];
    assert_eq!(water::level_at(&waters, boundary), Some(10.));
    let bounds = crate::atlas::regions::bounds(&water::geometry(&waters[0])).unwrap();
    let extent = a.extent().unwrap().unwrap();
    assert!(
        extent[0] <= bounds[0]
            && extent[1] <= bounds[1]
            && extent[2] >= bounds[2]
            && extent[3] >= bounds[3]
    );
}

fn dry_world() -> AtlasApplication {
    let a = AtlasApplication::new().unwrap();
    // Local lake scenarios explicitly begin on land in the ocean-first world.
    super::world_terrain_store::apply(
        &a.db,
        &super::world_terrain_store::WorldTerrainDelta {
            level: 10,
            before: vec![],
            after: (-2..=2)
                .flat_map(|y| (-2..=2).map(move |x| (x, y, Some(10.))))
                .collect(),
        },
        true,
    )
    .unwrap();
    a
}

#[test]
fn direct_sections_restore_water_contours_in_one_history_action() {
    let mut a = dry_world();
    request_edit(&mut a, "commit", paint(json!([[0, 0], [30, 0]]), 30.));
    let before = all(&a);
    let cursor = a.cursor;
    a.request("beginTerrainStroke", json!({"version":a.status(),"strokeId":"water-history","brush":{"resolution":0,"mode":"raise","radius":20,"amount":30,"strength":1,"target":10,"points":[[0,0]]},"view":null})).unwrap();
    a.request("appendTerrainStroke", json!({"sessionId":a.session,"strokeId":"water-history","sequence":1,"points":[[30,0]],"view":null})).unwrap();
    let after = all(&a);
    assert_ne!(before, after);
    assert_eq!(a.cursor, cursor + 1);
    history(&mut a, false);
    assert_eq!(all(&a), before);
    history(&mut a, true);
    assert_eq!(all(&a), after);
}

#[test]
fn water_followup_without_candidates_never_reads_height_authors() {
    use rusqlite::hooks::{AuthAction, AuthContext, Authorization};
    for distant_water in [false, true] {
        let a = AtlasApplication::new().unwrap();
        if distant_water {
            water_store::put(
                &a.db,
                &water::WaterBody {
                    id: "distant".into(),
                    level: 0.,
                    polygons: vec![crate::atlas::regions::RegionPolygon {
                        outer: vec![
                            [10000., 10000.],
                            [10010., 10000.],
                            [10010., 10010.],
                            [10000., 10010.],
                        ],
                        holes: vec![],
                    }],
                },
            )
            .unwrap();
        }
        a.db.authorizer(Some(|context: AuthContext<'_>| {
            if matches!(
                context.action,
                AuthAction::Read {
                    table_name: "terrain" | "terrain_layers",
                    ..
                }
            ) {
                Authorization::Deny
            } else {
                Authorization::Allow
            }
        }));
        let mut computed = crate::atlas::change::Computed::default();
        computed.change.terrain = Some(terrain::TerrainDelta {
            before: vec![(0, 0, terrain::BASE)],
            after: vec![(0, 0, 10.)],
            missing_before: vec![(0, 0)],
        });
        a.trim_water(&mut computed).unwrap();
        assert!(computed.change.waters.is_none());
        assert!(computed.next_identity.is_none());
    }
}

#[test]
fn oversized_world_water_followup_rejects_before_reading_authors() {
    use rusqlite::hooks::{AuthAction, AuthContext, Authorization};
    let a = AtlasApplication::new().unwrap();
    water_store::put(
        &a.db,
        &water::WaterBody {
            id: "oversized".into(),
            level: 0.,
            polygons: vec![crate::atlas::regions::RegionPolygon {
                outer: vec![[0., 0.], [2000., 0.], [2000., 2000.], [0., 2000.]],
                holes: vec![],
            }],
        },
    )
    .unwrap();
    a.db.authorizer(Some(|context: AuthContext<'_>| {
        if matches!(
            context.action,
            AuthAction::Read {
                table_name: "terrain" | "terrain_layers",
                ..
            }
        ) {
            Authorization::Deny
        } else {
            Authorization::Allow
        }
    }));
    let mut computed = crate::atlas::change::Computed::default();
    computed.change.world_terrain = Some(world_terrain_store::WorldTerrainDelta {
        level: 10,
        before: vec![(0, 0, None)],
        after: vec![(0, 0, Some(10.))],
    });
    let error = a.trim_water(&mut computed).unwrap_err();
    assert_eq!(
        error.category,
        crate::atlas::errors::ErrorCategory::InvalidInput
    );
    assert_eq!(error.message, "Gewässernachführung zu groß");
    assert!(computed.change.waters.is_none());
    assert!(computed.next_identity.is_none());
}

#[test]
fn world_water_outside_changed_support_never_reads_authors() {
    use rusqlite::hooks::{AuthAction, AuthContext, Authorization};
    for (level, points, b) in [
        (
            4,
            (0..=100).map(|i| (i, i)).collect::<Vec<_>>(),
            [1000., 5000., 3000., 7000.],
        ),
        (1, vec![(0, 0), (15, 15)], [40., 90., 80., 130.]),
        (1, vec![(-16, -16), (-1, -1)], [-120., -70., -80., -30.]),
        (1, vec![(0, 0)], [25., 25., 50., 50.]),
    ] {
        let a = AtlasApplication::new().unwrap();
        water_store::put(
            &a.db,
            &water::WaterBody {
                id: "off-path".into(),
                level: 0.,
                polygons: vec![crate::atlas::regions::RegionPolygon {
                    outer: vec![[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]]],
                    holes: vec![],
                }],
            },
        )
        .unwrap();
        a.db.authorizer(Some(|context: AuthContext<'_>| {
            if matches!(
                context.action,
                AuthAction::Read {
                    table_name: "terrain" | "terrain_layers",
                    ..
                } | AuthAction::Read {
                    table_name: "waters",
                    column_name: "body",
                    ..
                }
            ) {
                Authorization::Deny
            } else {
                Authorization::Allow
            }
        }));
        let mut computed = crate::atlas::change::Computed::default();
        computed.change.world_terrain = Some(world_terrain_store::WorldTerrainDelta {
            level,
            before: vec![],
            after: points.into_iter().map(|(x, y)| (x, y, Some(10.))).collect(),
        });
        a.trim_water(&mut computed).unwrap();
        assert!(computed.change.waters.is_none());
        assert!(computed.next_identity.is_none());
    }
}

fn large_lake(a: &AtlasApplication) -> water::WaterBody {
    let water = water::WaterBody {
        id: "wide-lake".into(),
        level: -90.,
        polygons: vec![crate::atlas::regions::RegionPolygon {
            outer: vec![
                [-2000., -2000.],
                [2000., -2000.],
                [2000., 2000.],
                [-2000., 2000.],
            ],
            holes: vec![],
        }],
    };
    water_store::put(&a.db, &water).unwrap();
    water
}

#[test]
fn world_water_uses_canonical_heights_without_materializing_local_authors() {
    for (level, x, y, local) in [
        (1, 0, 0, false),
        (1, -16, -17, true),
        (3, 16, -1, false),
        (5, 0, 0, false),
    ] {
        let a = AtlasApplication::new().unwrap();
        let water = large_lake(&a);
        let cx = x * (1 << level);
        let cy = y * (1 << level);
        if local {
            terrain_store::write_points(&a.db, &[(cx, cy, terrain::BASE)]).unwrap();
        }
        let mut computed = crate::atlas::change::Computed::default();
        let delta = world_terrain_store::WorldTerrainDelta {
            level,
            before: vec![(x, y, None)],
            after: vec![(x, y, Some(100.))],
        };
        world_terrain_store::apply(&a.db, &delta, true).unwrap();
        computed.change.world_terrain = Some(delta);
        a.trim_water(&mut computed).unwrap();
        let grid = terrain_store::grid(&a.db, [-2000., -2000., 2000., 2000.]).unwrap();
        let radius = 2 * (1 << level);
        let cells = (cx - radius - 1..=cx + radius)
            .flat_map(|x| (cy - radius - 1..=cy + radius).map(move |y| (x, y)))
            .collect();
        let expected = crate::atlas::regions::authored(water::trim(&water, &grid, &cells));
        assert_ne!(expected, water.polygons);
        if level == 1 && !local {
            let mut resampled = grid.clone();
            for sx in cx - radius - 3..=cx + radius + 3 {
                for sy in cy - radius - 3..=cy + radius + 3 {
                    resampled.insert((sx, sy), terrain::at(&grid, sx, sy));
                }
            }
            assert_ne!(
                expected,
                crate::atlas::regions::authored(water::trim(&water, &resampled, &cells)),
                "The fixture must detect the old second interpolation of inherited heights"
            );
        }
        let change = computed.change.waters.unwrap();
        assert_eq!(change.before, vec![water]);
        assert_eq!(change.after.len(), 1);
        assert_eq!(change.after[0].polygons, expected);
        assert_eq!(grid.points.len(), usize::from(local));
        assert!(computed.change.terrain.is_none());
    }
}

fn begin_world_raise(a: &mut AtlasApplication) -> crate::atlas::Result<Value> {
    a.request("beginTerrainStroke", json!({"version":a.status(),"strokeId":"world-water","brush":{"resolution":1,"mode":"raise","radius":20,"amount":100,"strength":1,"target":10,"points":[[0,0]]},"view":null}))
}

#[test]
fn world_sections_trim_large_lake_and_history_restores_missing_authors() {
    let mut a = AtlasApplication::new().unwrap();
    let water = large_lake(&a);
    begin_world_raise(&mut a).unwrap();
    a.request("appendTerrainStroke", json!({"sessionId":a.session,"strokeId":"world-water","sequence":1,"points":[[100,0]],"view":null})).unwrap();
    let after = all(&a);
    let authors = world_terrain_store::read(&a.db, [-2000., -2000., 2000., 2000.]).unwrap();
    assert_ne!(after, vec![water.clone()]);
    assert_eq!(a.cursor, 1);
    history(&mut a, false);
    assert_eq!(all(&a), vec![water]);
    assert!(
        world_terrain_store::read(&a.db, [-2000., -2000., 2000., 2000.])
            .unwrap()
            .is_empty()
    );
    history(&mut a, true);
    assert_eq!(all(&a), after);
    assert_eq!(
        world_terrain_store::read(&a.db, [-2000., -2000., 2000., 2000.]).unwrap(),
        authors
    );
}

#[test]
fn world_water_failure_rolls_back_authors_and_contours() {
    let mut a = AtlasApplication::new().unwrap();
    let water = large_lake(&a);
    a.db.execute_batch("CREATE TEMP TRIGGER fail_water BEFORE INSERT ON waters BEGIN SELECT RAISE(ABORT,'injected'); END;").unwrap();
    let status = a.status();
    assert!(begin_world_raise(&mut a).is_err());
    assert_eq!(
        serde_json::to_value(a.status()).unwrap(),
        serde_json::to_value(status).unwrap()
    );
    assert_eq!(all(&a), vec![water]);
    assert!(
        world_terrain_store::read(&a.db, [-2000., -2000., 2000., 2000.])
            .unwrap()
            .is_empty()
    );
    assert!(terrain_store::grid(&a.db, [-100., -100., 100., 100.])
        .unwrap()
        .points
        .is_empty());
}

#[test]
fn world_water_budget_counts_union_not_overlapping_supports() {
    let a = AtlasApplication::new().unwrap();
    large_lake(&a);
    let delta = world_terrain_store::WorldTerrainDelta {
        level: 4,
        before: vec![],
        after: (0..5)
            .flat_map(|x| (0..5).map(move |y| (x, y, Some(-99.))))
            .collect(),
    };
    world_terrain_store::apply(&a.db, &delta, true).unwrap();
    let mut computed = crate::atlas::change::Computed::default();
    computed.change.world_terrain = Some(delta);
    // 25 supports each touch 66x66 local cells (>100000 in total),
    // but their union contains only 130x130 cells. The lake remains wet.
    a.trim_water(&mut computed).unwrap();
    assert!(computed.change.waters.is_none());
}

#[test]
fn confirmed_split_water_tiles_equal_fresh_reads_with_unaffected_lakes() {
    let mut a = AtlasApplication::new().unwrap();
    request_edit(&mut a, "commit", paint(json!([[40, 40], [120, 40]]), 20.));
    request_edit(&mut a, "commit", paint(json!([[120, 120]]), 10.));
    let before = all(&a);
    assert_eq!(before.len(), 2);
    let view = json!({"level":0,"tiles":[[0,0]],"pixels":32});
    a.request("beginTerrainStroke", json!({"version":a.status(),"strokeId":"split-water","brush":{"resolution":0,"mode":"raise","radius":10,"amount":100,"strength":1,"target":10,"points":[[80,10]]},"view":view})).unwrap();
    let reply = a.request("appendTerrainStroke", json!({"sessionId":a.session,"strokeId":"split-water","sequence":1,"points":[[80,70]],"view":view})).unwrap();
    let after = all(&a);
    assert_eq!(after.len(), 3);
    let fresh = a.request("terrainTiles", view).unwrap();
    assert_eq!(reply["surface"]["tiles"], fresh["tiles"]);
    history(&mut a, false);
    assert_eq!(all(&a), before);
    history(&mut a, true);
    assert_eq!(all(&a), after);
}
