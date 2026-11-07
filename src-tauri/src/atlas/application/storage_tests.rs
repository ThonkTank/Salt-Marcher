use super::application_test_support::*;
use super::*;
use crate::atlas::test_inputs::update_road;
use rusqlite::hooks::{AuthAction, AuthContext, Authorization};

fn edit(a: &mut AtlasApplication, intent: Value) -> Value {
    a.request("commit", json!({"version":a.status(),"intent":intent}))
        .unwrap()
}
fn settings() -> Value {
    json!({"side":"both","setback":5,"gap":20,"minWidth":4,"maxWidth":4,"minDepth":4,"maxDepth":4,"seed":1,"parcelDepth":80})
}
fn road(a: &mut AtlasApplication, y: f64, populated: bool) -> Value {
    let mut intent = json!({"type":"createRoad","road":{"name":"Road","width":10,"material":"earth","nodes":[{"point":[0,y],"incoming":null,"outgoing":null},{"point":[160,y],"incoming":null,"outgoing":null}]},"population":null});
    if populated {
        intent["population"] = settings();
    }
    edit(a, intent)
}
fn fixture() -> AtlasApplication {
    let mut a = AtlasApplication::new().unwrap();
    road(&mut a, 0.0, true);
    road(&mut a, 500.0, false);
    a
}
fn live_document() -> AtlasApplication {
    let mut a = AtlasApplication::new().unwrap();
    for x in [1000, 1100] {
        edit(
            &mut a,
            json!({"type":"createHouse","parcelId":null,"transform":{"x":x,"y":1000,"angle":0},"width":2,"depth":2}),
        );
    }
    a.history(false).unwrap();
    a
}
fn reject_sqls(sqls: &[&str]) {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("candidate.saltatlas");
    fixture().save(&path).unwrap();
    let pristine = std::fs::read(&path).unwrap();
    let mut live = live_document();
    let before = dump(&live);
    for sql in sqls {
        std::fs::write(&path, &pristine).unwrap();
        let db = Connection::open(&path).unwrap();
        db.execute_batch("PRAGMA foreign_keys=OFF; PRAGMA ignore_check_constraints=ON;")
            .unwrap();
        db.execute_batch(sql).unwrap();
        drop(db);
        let corrupted = std::fs::read(&path).unwrap();
        assert!(live.open(&path).is_err(), "accepted corruption: {sql}");
        assert_eq!(dump(&live), before, "changed live document: {sql}");
        assert_eq!(
            std::fs::read(&path).unwrap(),
            corrupted,
            "repaired source: {sql}"
        );
    }
    live.history(true).unwrap();
    live.history(false).unwrap();
    // Revision changes, but the preserved history and complete data remain usable.
    assert_eq!(objects(&live).len(), 1);
}
fn corrupt_objects(mutator: impl FnOnce(&mut Vec<FullObject>)) -> String {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("geometry.saltatlas");
    let mut source = fixture();
    let mut all = objects(&source);
    mutator(&mut all);
    for object in all {
        storage::write_object(&source.db, &object, true).unwrap();
    }
    source.save(&path).unwrap();
    let mut live = live_document();
    let before = dump(&live);
    let corrupted = std::fs::read(&path).unwrap();
    let error = live.open(&path).expect_err("accepted corrupted objects");
    assert_eq!(dump(&live), before);
    assert_eq!(std::fs::read(&path).unwrap(), corrupted);
    error.message
}

#[test]
fn snapshot_schema_and_exact_metadata_row_are_required() {
    reject_sqls(&[
        "PRAGMA user_version=9",
        "CREATE INDEX extra ON objects(kind)",
        "CREATE VIEW extra AS SELECT * FROM objects",
        "CREATE TRIGGER extra AFTER INSERT ON objects BEGIN SELECT 1; END",
        "CREATE TABLE extra(payload TEXT)",
        "CREATE TABLE extra(payload TEXT); PRAGMA writable_schema=ON; UPDATE sqlite_schema SET name='sqlite_custom',tbl_name='sqlite_custom',sql='CREATE TABLE sqlite_custom(payload TEXT)' WHERE name='extra'",
        "ALTER TABLE objects ADD COLUMN hidden TEXT",
        "DELETE FROM document_meta",
        "INSERT INTO document_meta VALUES(2,10000)",
        "UPDATE document_meta SET singleton=2",
        "UPDATE document_meta SET next_identity=0",
        "UPDATE document_meta SET next_identity=1",
        "UPDATE document_meta SET next_identity=9223372036854775807",
    ]);
}

#[test]
fn both_rtrees_require_complete_canonical_conservative_float_boxes() {
    let corruptions = [
        "DELETE FROM spatial WHERE key=(SELECT rowid FROM objects LIMIT 1)",
        "INSERT INTO spatial VALUES(999999,0,1,0,1)",
        "UPDATE spatial SET min_x=min_x-1 WHERE key=(SELECT rowid FROM objects LIMIT 1)",
        "UPDATE spatial SET max_x=max_x-1 WHERE key=(SELECT rowid FROM objects LIMIT 1)",
        "DELETE FROM occupancy_spatial WHERE key=(SELECT rowid FROM objects WHERE kind='house' LIMIT 1)",
        "INSERT INTO occupancy_spatial VALUES(999999,0,1,0,1)",
        "INSERT INTO occupancy_spatial SELECT rowid,min_x,max_x,min_y,max_y FROM objects WHERE kind='parcel' LIMIT 1",
        "UPDATE occupancy_spatial SET min_x=min_x-1 WHERE key=(SELECT rowid FROM objects WHERE kind='house' LIMIT 1)",
        "UPDATE occupancy_spatial SET max_x=max_x-1 WHERE key=(SELECT rowid FROM objects WHERE kind='house' LIMIT 1)",
    ];
    for sql in corruptions {
        let a = fixture();
        let expected = fixture();
        a.db.execute_batch(sql).unwrap();
        assert!(
            validate_rtree(&a.db, &expected.db, "spatial", false).is_err()
                || validate_rtree(&a.db, &expected.db, "occupancy_spatial", true).is_err(),
            "accepted working-index corruption: {sql}"
        );
    }
}

#[test]
fn strict_nested_fields_duplicates_payloads_and_owner_references_are_rejected() {
    reject_sqls(&[
        "UPDATE objects SET body=json_set(body,'$.material','water') WHERE kind='road'",
        "UPDATE objects SET body=json_set(body,'$.populationRecipe.settings.side','middle') WHERE kind='road' AND json_extract(body,'$.populationRecipe') IS NOT NULL",
        "UPDATE objects SET body=json_set(body,'$.extra',1) WHERE kind='road'",
        "UPDATE objects SET body=replace(body,'\"id\":\"node-2\"','\"id\":\"node-2\",\"id\":\"node-2\"') WHERE kind='road'",
        "UPDATE objects SET body='{\"kind\":\"house\",'||substr(body,2) WHERE kind='house'",
        "UPDATE objects SET body=replace(body,'\"name\":\"Erdgeschoss\"','\"name\":\"Erdgeschoss\",\"name\":\"Erdgeschoss\"') WHERE kind='house'",
        "UPDATE house_cells SET payload=replace(payload,'\"x\":0','\"x\":0,\"x\":0')",
        "UPDATE objects SET body=json_set(body,'$.nodes[0].extra',1) WHERE kind='road'",
        "UPDATE objects SET body=json_set(body,'$.sections[0].extra',1) WHERE kind='road'",
        "UPDATE objects SET body=json_set(body,'$.populationRecipe.extra',1) WHERE kind='road' AND json_extract(body,'$.populationRecipe') IS NOT NULL",
        "UPDATE objects SET body=json_set(body,'$.populationRecipe.settings.extra',1) WHERE kind='road' AND json_extract(body,'$.populationRecipe') IS NOT NULL",
        "UPDATE objects SET body=json_set(body,'$.source.extra',1) WHERE kind='parcel'",
        "UPDATE objects SET body=json_set(body,'$.populationRecipe.algorithmVersion',1) WHERE kind='road' AND json_extract(body,'$.populationRecipe') IS NOT NULL",
        "UPDATE objects SET body=replace(body,'\"xCells\":','\"xCells\":0,\"xCells\":') WHERE kind='house'",
        "UPDATE objects SET body=replace(body,'\"offset\":','\"offset\":0,\"offset\":') WHERE kind='house'",
        "UPDATE objects SET body=json_set(body,'$.placement.extra',1) WHERE kind='house'",
        "UPDATE objects SET body=json_set(body,'$.placement.gridPose.extra',1) WHERE kind='house'",
        "UPDATE objects SET body=json_set(body,'$.roomCounter',0) WHERE kind='house'",
        "UPDATE objects SET body=json_set(body,'$.connectionCounter',0) WHERE kind='house'",
        "UPDATE objects SET body=json_set(body,'$.rooms[0].extra',1) WHERE kind='house'",
        "UPDATE objects SET body=json_set(body,'$.connections[0].extra',1) WHERE kind='house'",
        "UPDATE house_cells SET payload=json_set(payload,'$[0].extra',1)",
        "DELETE FROM house_cells WHERE building_id=(SELECT id FROM objects WHERE kind='house' LIMIT 1)",
        "INSERT INTO house_cells VALUES('house-99999','[]')",
        "INSERT INTO house_cells SELECT id,'[]' FROM objects WHERE kind='road' LIMIT 1",
        "UPDATE objects SET body=json_set(body,'$.placement.parcelId','parcel-99999') WHERE kind='house'",
        "UPDATE objects SET body=json_set(body,'$.placement.parcelId',(SELECT id FROM objects WHERE kind='road' LIMIT 1)) WHERE kind='house'",
        "UPDATE objects SET body=json_set(body,'$.occupancyBounds',json('[0,0,1,1]')) WHERE kind='house'",
        "UPDATE objects SET body=json_set(body,'$.path',json('[]')) WHERE kind='road'",
        "UPDATE objects SET body=json_set(body,'$.polygon',json('[]')) WHERE kind='parcel'",
        "UPDATE objects SET body=json_set(body,'$.transform',json('{\"x\":0,\"y\":0,\"angle\":0}')) WHERE kind='house'",
        "UPDATE objects SET kind='area' WHERE kind='road'",
        "UPDATE objects SET id='road-99999' WHERE id=(SELECT id FROM objects WHERE kind='road' LIMIT 1)",
    ]);
}

#[test]
fn staged_relations_reject_manipulated_parcel_frames_polygon_sources_and_gridposes() {
    assert!(corrupt_objects(|all| {
        let FullObject::Parcel(p) = all.iter_mut().find(|o| o.kind() == "parcel").unwrap() else {
            unreachable!()
        };
        let ParcelSource::Road { road_id, .. } = &mut p.source else {
            unreachable!()
        };
        *road_id = "road-99999".into();
    })
    .contains("Straßenabschnitt"));
    assert!(corrupt_objects(|all| {
        let FullObject::Parcel(p) = all.iter_mut().find(|o| o.kind() == "parcel").unwrap() else {
            unreachable!()
        };
        let ParcelSource::Road { section_id, .. } = &mut p.source else {
            unreachable!()
        };
        *section_id = "section-99999".into();
    })
    .contains("Straßenabschnitt"));
    assert!(corrupt_objects(|all| {
        let FullObject::House(h) = all.iter_mut().find(|o| o.kind() == "house").unwrap() else {
            unreachable!()
        };
        let Placement::Parcel { grid_pose, .. } = &mut h.placement else {
            unreachable!()
        };
        grid_pose.x_cells += 1000;
    })
    .contains("Ownerparzelle"));
    assert!(corrupt_objects(|all| {
        let house_index = all.iter().position(|o| o.kind() == "house").unwrap();
        let FullObject::House(h) = &all[house_index] else {
            unreachable!()
        };
        let Placement::Parcel { parcel_id, .. } = &h.placement else {
            unreachable!()
        };
        let FullObject::Parcel(parcel) = all.iter().find(|o| o.id() == parcel_id).unwrap() else {
            unreachable!()
        };
        let pose = GridPose {
            x_cells: 1000,
            y_cells: 0,
            quarter_turns: QuarterTurns(0),
        };
        let transform = parcel_geometry::parcel_house_transform(&parcel.frame, &pose).unwrap();
        let FullObject::House(h) = &mut all[house_index] else {
            unreachable!()
        };
        if let Placement::Parcel { grid_pose, .. } = &mut h.placement {
            *grid_pose = pose;
        }
        h.transform = transform;
        h.occupancy_bounds = occupancy_bounds(&h.occupancy_contours, &h.transform);
    })
    .contains("Ownerparzelle"));
}

#[test]
fn derived_working_caches_do_not_cross_the_snapshot_boundary() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("caches.saltatlas");
    let mut a = fixture();
    let expected = objects(&a);
    for object in &expected {
        let mut o = object.clone();
        match &mut o {
            FullObject::House(h) => {
                h.contours.clear();
                h.occupancy_contours.clear();
                h.occupancy_bounds = [0.0; 4];
                h.transform.x += 0.00001;
            }
            FullObject::Road(r) => r.path[0][0] += 1.0,
            FullObject::Parcel(p) => {
                p.frame.x += 1.0;
                p.polygon[1][0] += 0.5;
            }
            _ => {}
        }
        storage::write_object(&a.db, &o, true).unwrap();
    }
    a.save(&path).unwrap();
    let mut b = AtlasApplication::new().unwrap();
    b.open(&path).unwrap();
    assert_eq!(objects(&b), expected);
}

#[test]
fn global_node_and_section_identity_format_and_uniqueness_cross_road_boundaries() {
    for prefix in ["node", "section"] {
        assert!(corrupt_objects(|all| {
            let mut roads = all.iter_mut().filter_map(|o| {
                if let FullObject::Road(r) = o {
                    Some(r)
                } else {
                    None
                }
            });
            let first = roads.next().unwrap();
            let second = roads.next().unwrap();
            if prefix == "node" {
                second.nodes[0].id = first.nodes[0].id.clone();
            } else {
                second.sections[0].id = first.sections[0].id.clone();
                second.edge_sections[0] = first.sections[0].id.clone();
            }
        })
        .contains("globale Identität"));
    }
    for id in [
        "node-0",
        "node-01",
        "node--1",
        "node-9223372036854775808",
        "section-1",
    ] {
        corrupt_objects(|all| {
            let FullObject::Road(r) = all.iter_mut().find(|o| o.kind() == "road").unwrap() else {
                unreachable!()
            };
            r.nodes[0].id = id.into();
        });
    }
    reject_sqls(&["UPDATE document_meta SET next_identity=(SELECT max(CAST(substr(value->>'$.id',9) AS INTEGER)) FROM objects,json_each(objects.body,'$.sections') WHERE kind='road')"]);
}

#[test]
fn population_provenance_settings_and_section_blocks_are_validated() {
    corrupt_objects(|all| {
        let FullObject::Road(r) = all
            .iter_mut()
            .find(|o| matches!(o,FullObject::Road(r) if r.population_recipe.is_some()))
            .unwrap()
        else {
            unreachable!()
        };
        r.sections[0].populated_sides.clear();
    });
    corrupt_objects(|all| {
        let FullObject::Road(r) = all
            .iter_mut()
            .find(|o| matches!(o,FullObject::Road(r) if r.population_recipe.is_some()))
            .unwrap()
        else {
            unreachable!()
        };
        r.population_recipe = None;
    });
    corrupt_objects(|all| {
        let FullObject::Road(r) = all
            .iter_mut()
            .find(|o| matches!(o,FullObject::Road(r) if r.population_recipe.is_some()))
            .unwrap()
        else {
            unreachable!()
        };
        r.population_recipe.as_mut().unwrap().settings.max_width = 0;
    });
    corrupt_objects(|all| {
        let FullObject::Road(r) = all.iter_mut().find(|o| o.kind() == "road").unwrap() else {
            unreachable!()
        };
        r.sections[0].populated_sides = vec![Side::Left, Side::Left];
    });
    corrupt_objects(|all| {
        let FullObject::Road(r) = all.iter_mut().find(|o| o.kind() == "road").unwrap() else {
            unreachable!()
        };
        let a = r.sections[0].id.clone();
        r.nodes.insert(
            1,
            Node {
                id: "node-90001".into(),
                point: [40.0, r.nodes[0].point[1]],
                incoming: None,
                outgoing: None,
            },
        );
        r.nodes.insert(
            2,
            Node {
                id: "node-90002".into(),
                point: [80.0, r.nodes[0].point[1]],
                incoming: None,
                outgoing: None,
            },
        );
        r.sections.push(RoadSection {
            id: "section-90003".into(),
            populated_sides: vec![],
        });
        r.edge_sections = vec![a.clone(), "section-90003".into(), a];
        r.path = road_path(&r.nodes).unwrap();
    });
}

#[test]
fn arbitrary_row_order_sparse_rowids_and_outward_float_rounding_roundtrip() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("unordered.saltatlas");
    let mut a = AtlasApplication::new().unwrap();
    let mut action = json!({"type":"createRoad","road":{"name":"Decimal","width":10.7,"material":"earth","nodes":[{"point":[0.3,0.7],"incoming":null,"outgoing":null},{"point":[160.3,0.7],"incoming":null,"outgoing":null}]},"population":settings()});
    action["population"]["setback"] = json!(5.3);
    edit(&mut a, action);
    let expected = objects(&a);
    a.save(&path).unwrap();
    let db = Connection::open(&path).unwrap();
    db.execute_batch("CREATE TEMP TABLE reordered AS SELECT * FROM objects; DELETE FROM objects; INSERT INTO objects SELECT * FROM reordered ORDER BY CASE kind WHEN 'house' THEN 0 WHEN 'parcel' THEN 1 ELSE 2 END,id DESC;").unwrap();
    let rounded:bool=a.db.query_row("SELECT EXISTS(SELECT 1 FROM spatial s JOIN objects o ON o.rowid=s.key WHERE s.min_x<o.min_x OR s.max_x>o.max_x OR s.min_y<o.min_y OR s.max_y>o.max_y)",[],|r|r.get(0)).unwrap();
    assert!(rounded);
    drop(db);
    let mut b = AtlasApplication::new().unwrap();
    b.open(&path).unwrap();
    assert_eq!(objects(&b), expected);
    assert!(!b.status().can_undo && !b.status().can_redo && !b.status().dirty);
}

#[test]
fn counter_checks_nested_suffixes_preserves_holes_and_new_topology_never_reuses_identity() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("counter.saltatlas");
    let mut a = AtlasApplication::new().unwrap();
    let r = road(&mut a, 0.0, false)["objects"][0].clone();
    let old_ids: HashSet<_> = r["nodes"]
        .as_array()
        .unwrap()
        .iter()
        .map(|n| n["id"].clone())
        .chain(
            r["sections"]
                .as_array()
                .unwrap()
                .iter()
                .map(|s| s["id"].clone()),
        )
        .map(|v| v.as_str().unwrap().to_owned())
        .collect();
    a.save(&path).unwrap();
    let db = Connection::open(&path).unwrap();
    // next_identity exceeds every top-level ID but equals a nested section ID.
    db.execute("UPDATE document_meta SET next_identity=4", [])
        .unwrap();
    drop(db);
    assert!(a.open(&path).is_err());
    a.db.execute("UPDATE document_meta SET next_identity=9000", [])
        .unwrap();
    a.save(&path).unwrap();
    let mut b = AtlasApplication::new().unwrap();
    b.open(&path).unwrap();
    let split = edit(
        &mut b,
        json!({"type":"insertRoadNode","roadId":r["id"],"afterNodeId":r["nodes"][0]["id"],"t":0.5}),
    );
    assert_eq!(split["objects"][0]["nodes"][1]["id"], "node-9000");
    edit(
        &mut b,
        json!({"type":"extendRoad","roadId":r["id"],"end":"end","nodes":[{"point":[320,0],"incoming":null,"outgoing":null}],"endpointHandle":null,"population":null}),
    );
    let FullObject::Road(r) = b.object(r["id"].as_str().unwrap()).unwrap() else {
        unreachable!()
    };
    assert!(r
        .nodes
        .iter()
        .filter(|n| !old_ids.contains(&n.id))
        .all(|n| n.id.strip_prefix("node-").unwrap().parse::<u64>().unwrap() >= 9000));
    assert!(r
        .sections
        .iter()
        .filter(|s| !old_ids.contains(&s.id))
        .all(|s| s
            .id
            .strip_prefix("section-")
            .unwrap()
            .parse::<u64>()
            .unwrap()
            >= 9000));
}

#[test]
fn compound_save_roundtrips_empty_detached_quarter_turned_and_authored_interiors() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("complete compound.saltatlas");
    let mut a = AtlasApplication::new().unwrap();
    let created = road(&mut a, 0.0, true);
    let r = created["objects"]
        .as_array()
        .unwrap()
        .iter()
        .find(|o| o["kind"] == "road")
        .unwrap()
        .clone();
    let parcels: Vec<_> = objects(&a)
        .into_iter()
        .filter_map(|o| {
            if let FullObject::Parcel(p) = o {
                Some(p)
            } else {
                None
            }
        })
        .collect();
    let detached = parcels
        .iter()
        .find(|p| {
            matches!(
                &p.source,
                ParcelSource::Road {
                    side: Side::Left,
                    ..
                }
            )
        })
        .unwrap();
    let empty = parcels.iter().find(|p| p.id != detached.id).unwrap();
    let grid = parcels
        .iter()
        .find(|p| p.id != detached.id && p.id != empty.id)
        .unwrap();
    edit(&mut a, json!({"type":"detachParcel","id":detached.id}));
    let empty_house = a.house_header_for_parcel(&empty.id).unwrap().unwrap();
    edit(&mut a, json!({"type":"delete","id":empty_house.id}));
    let grid_house = a.house_header_for_parcel(&grid.id).unwrap().unwrap();
    let pose = GridPose {
        x_cells: 2,
        y_cells: 1,
        quarter_turns: QuarterTurns(1),
    };
    let transform = parcel_geometry::parcel_house_transform(&grid.frame, &pose).unwrap();
    edit(
        &mut a,
        json!({"type":"transformHouse","id":grid_house.id,"transform":transform}),
    );
    for (floor, cells) in [
        (-1, json!([[0, 0], [1, 0]])),
        (1, json!([[0, 0], [1, 0]])),
        (0, json!([[0, -2], [1, -2]])),
    ] {
        edit(
            &mut a,
            json!({"type":"room","buildingId":grid_house.id,"intent":{"kind":"draw","floor":floor,"cells":cells}}),
        );
    }
    edit(
        &mut a,
        json!({"type":"room","buildingId":grid_house.id,"intent":{"kind":"rename","roomId":"room-0","name":"Authored room"}}),
    );
    // Keep a physical stair and a genuinely internal opening in the same
    // authored parcel snapshot as the detached/empty/quarter-turned owners.
    edit(
        &mut a,
        json!({"type":"room","buildingId":grid_house.id,"intent":{"kind":"draw","floor":0,"cells":[[0,-1],[1,-1]]}}),
    );
    edit(
        &mut a,
        json!({"type":"connection","buildingId":grid_house.id,"intent":{"action":"createOpening","floor":0,"x":0,"y":0,"axis":"horizontal","kind":"passage"}}),
    );
    edit(
        &mut a,
        json!({"type":"connection","buildingId":grid_house.id,"intent":{"action":"createStairs","floor":0,"x":0,"y":0,"direction":"east","length":2}}),
    );
    edit(
        &mut a,
        json!({"type":"roof","id":grid_house.id,"roof":"#123456"}),
    );
    let authored_connections = a.house(&grid_house.id).unwrap().connections;
    assert!(authored_connections.iter().any(|c| matches!(
        c.shape,
        crate::interior::ConnectionShape::Opening { .. }
    ) && c.base.to_room.is_some()));
    assert!(authored_connections
        .iter()
        .any(|c| matches!(c.shape, crate::interior::ConnectionShape::Stairs { .. })));
    let free=edit(&mut a,json!({"type":"createHouse","parcelId":null,"transform":{"x":1000,"y":1000,"angle":0},"width":4,"depth":3}))["objects"][0]["id"].as_str().unwrap().to_owned();
    edit(
        &mut a,
        json!({"type":"room","buildingId":free,"intent":{"kind":"draw","floor":1,"cells":[[0,0],[1,0],[2,0]]}}),
    );
    edit(
        &mut a,
        json!({"type":"connection","buildingId":free,"intent":{"action":"createStairs","floor":0,"x":0,"y":0,"direction":"east","length":3}}),
    );
    let interior_before = a.house(&grid_house.id).unwrap();
    let mut moved = r.clone();
    for node in moved["nodes"].as_array_mut().unwrap() {
        node["point"][1] = json!(200);
    }
    edit(&mut a, update_road(&moved));
    edit(
        &mut a,
        json!({"type":"extendRoad","roadId":r["id"],"end":"end","nodes":[{"point":[320,200],"incoming":null,"outgoing":null}],"endpointHandle":null,"population":settings()}),
    );
    let expected = objects(&a);
    let counter: i64 =
        a.db.query_row("SELECT next_identity FROM document_meta", [], |r| r.get(0))
            .unwrap();
    a.save(&path).unwrap();
    let saved_headers = snapshot_rows(&path);
    let saved_payloads = payload_rows(&path);
    let disk = Connection::open(&path).unwrap();
    let history: i64 = disk
        .query_row(
            "SELECT count(*) FROM sqlite_schema WHERE name='history'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(history, 0);
    let persisted_counter: i64 = disk
        .query_row("SELECT next_identity FROM document_meta", [], |r| r.get(0))
        .unwrap();
    assert_eq!(persisted_counter, counter);
    drop(disk);
    let mut b = AtlasApplication::new().unwrap();
    b.open(&path).unwrap();
    assert_eq!(objects(&b), expected);
    assert!(b.house_header_for_parcel(&empty.id).unwrap().is_none());
    assert!(matches!(
        b.object(&detached.id).unwrap(),
        FullObject::Parcel(Parcel {
            source: ParcelSource::Detached {},
            ..
        })
    ));
    let authored = b.house(&grid_house.id).unwrap();
    assert_eq!(authored.placement, interior_before.placement);
    assert_eq!(authored.cells, interior_before.cells);
    assert_eq!(authored.rooms, interior_before.rooms);
    assert_eq!(authored.connections, interior_before.connections);
    assert!(!b.status().dirty && !b.status().can_undo && !b.status().can_redo);
    b.save(&path).unwrap();
    assert_eq!(snapshot_rows(&path), saved_headers);
    assert_eq!(payload_rows(&path), saved_payloads);
    a.open(&path).unwrap();
    assert_eq!(objects(&a), expected);
}

#[test]
fn high_unsigned_area_order_sets_separate_next_state_and_overflow_preserves_live_session() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("area-order.saltatlas");
    let mut a = AtlasApplication::new().unwrap();
    let created = edit(
        &mut a,
        json!({"type":"createArea","area":{"material":"earth","points":[[0,0],[10,0],[10,10],[0,10]]}}),
    );
    let id = created["objects"][0]["id"].as_str().unwrap();
    let FullObject::Area(mut area) = a.object(id).unwrap() else {
        unreachable!()
    };
    let order = i64::MAX as u64 + 100;
    area.order = order;
    storage::write_object(&a.db, &FullObject::Area(area.clone()), true).unwrap();
    a.save(&path).unwrap();
    let mut b = live_document();
    b.open(&path).unwrap();
    assert_eq!(b.next_state, order + 1);
    let created = edit(
        &mut b,
        json!({"type":"createArea","area":{"material":"grass","points":[[20,0],[30,0],[30,10],[20,10]]}}),
    );
    assert_eq!(created["objects"][0]["order"], order + 1);
    assert_eq!(created["objects"][0]["id"], "area-2");
    assert_eq!(b.next_state, order + 2);
    b.history(false).unwrap();
    b.history(true).unwrap();
    area.order = u64::MAX;
    storage::write_object(&a.db, &FullObject::Area(area), true).unwrap();
    a.save(&path).unwrap();
    let before = dump(&b);
    assert!(b
        .open(&path)
        .unwrap_err()
        .message
        .contains("Zustände erschöpft"));
    assert_eq!(dump(&b), before);
}

#[test]
fn save_replaces_existing_file_and_failed_save_preserves_document_and_target() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("replace.saltatlas");
    let mut a = fixture();
    std::fs::write(&path, b"previous file").unwrap();
    a.save(&path).unwrap();
    let bytes = std::fs::read(&path).unwrap();
    assert_eq!(&bytes[..16], b"SQLite format 3\0");
    let mut b = AtlasApplication::new().unwrap();
    b.open(&path).unwrap();
    assert_eq!(objects(&a), objects(&b));
    road(&mut a, 1000.0, false);
    let before = dump(&a);
    let failed_path = dir.path().join("target-directory.saltatlas");
    std::fs::create_dir(&failed_path).unwrap();
    std::fs::write(failed_path.join("keep"), b"keep").unwrap();
    assert!(a.save(&failed_path).is_err());
    assert_eq!(dump(&a), before);
    assert_eq!(std::fs::read(&path).unwrap(), bytes);
    assert_eq!(std::fs::read(failed_path.join("keep")).unwrap(), b"keep");
    a.save(&path).unwrap();
    b.open(&path).unwrap();
    assert_eq!(objects(&a), objects(&b));
}

#[test]
fn scene_owner_closure_and_empty_missing_states_never_read_cells_or_interior_metadata() {
    let mut a = fixture();
    let all = objects(&a);
    let house = all
        .iter()
        .find_map(|o| {
            if let FullObject::House(h) = o {
                Some(h.clone())
            } else {
                None
            }
        })
        .unwrap();
    let Placement::Parcel { parcel_id, .. } = &house.placement else {
        unreachable!()
    };
    let other = all
        .iter()
        .find_map(|o| {
            if let FullObject::House(h) = o {
                (h.id != house.id).then_some(h.clone())
            } else {
                None
            }
        })
        .unwrap();
    let Placement::Parcel {
        parcel_id: empty_id,
        ..
    } = &other.placement
    else {
        unreachable!()
    };
    let selected = all
        .iter()
        .find_map(|o| match o {
            FullObject::House(h) if h.id != house.id && h.id != other.id => Some(h.clone()),
            _ => None,
        })
        .unwrap();
    let Placement::Parcel {
        parcel_id: selected_parcel,
        ..
    } = &selected.placement
    else {
        unreachable!()
    };
    edit(&mut a, json!({"type":"delete","id":other.id}));
    a.db.flush_prepared_statement_cache();
    a.db.authorizer(Some(|ctx: AuthContext<'_>| match ctx.action {
        AuthAction::Read {
            table_name: "objects",
            column_name: "metadata",
        } => Authorization::Deny,
        AuthAction::Read { table_name, .. }
        | AuthAction::Update { table_name, .. }
        | AuthAction::Insert { table_name }
        | AuthAction::Delete { table_name }
            if ["house_cells", "local_cells"].contains(&table_name) =>
        {
            Authorization::Deny
        }
        _ => Authorization::Allow,
    }));
    for context in [
        json!({"kind":"exterior"}),
        json!({"kind":"house","houseId":house.id}),
        json!({"kind":"parcel","parcelId":parcel_id}),
    ] {
        let scene = a
            .request(
                "scene",
                json!({"bounds":[9000,9000,9010,9010],"context":context,"selectedId":house.id}),
            )
            .unwrap();
        assert_eq!(
            scene["selectionState"],
            json!({"exists":true,"parcelId":parcel_id,"houseId":house.id})
        );
        assert_eq!(scene["status"]["revision"], a.status().revision);
        let objects = scene["objects"].as_array().unwrap();
        assert_eq!(objects.len(), 2);
        assert!(objects.iter().any(|o| o["id"] == house.id));
        assert!(objects.iter().any(|o| o["id"] == *parcel_id));
        assert!(objects
            .iter()
            .all(|o| o.get("cells").is_none() && o.get("rooms").is_none()));
    }
    let empty = a.request("scene",json!({"bounds":[9000,9000,9010,9010],"context":{"kind":"parcel","parcelId":empty_id},"selectedId":other.id})).unwrap();
    assert_eq!(
        empty["contextState"],
        json!({"exists":true,"parcelId":empty_id,"houseId":null})
    );
    assert_eq!(
        empty["selectionState"],
        json!({"exists":false,"parcelId":null,"houseId":null})
    );
    assert_eq!(empty["objects"].as_array().unwrap().len(), 1);
    let independent = a.request("scene",json!({"bounds":[9000,9000,9010,9010],"context":{"kind":"parcel","parcelId":parcel_id},"selectedId":selected.id})).unwrap();
    assert_eq!(independent["objects"].as_array().unwrap().len(), 4);
    assert_eq!(
        independent["contextState"],
        json!({"exists":true,"parcelId":parcel_id,"houseId":house.id})
    );
    assert_eq!(
        independent["selectionState"],
        json!({"exists":true,"parcelId":selected_parcel,"houseId":selected.id})
    );
}

#[test]
fn extreme_interior_integers_reject_without_arithmetic_panics() {
    reject_sqls(&[
        "UPDATE house_cells SET payload=json_set(payload,'$[0].x',9223372036854775807)",
        "UPDATE objects SET body=json_set(body,'$.connections[0].x',9223372036854775807) WHERE kind='house'",
        "UPDATE objects SET body=json_set(body,'$.connections[0].y',-9223372036854775808) WHERE kind='house'",
    ]);
}

#[test]
fn reopening_two_hundred_bound_parcels_counts_staged_objects_exactly_once() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("limit.saltatlas");
    let mut a = AtlasApplication::new().unwrap();
    let mut s = settings();
    s["gap"] = json!(0);
    for key in ["minWidth", "maxWidth", "minDepth", "maxDepth"] {
        s[key] = json!(1);
    }
    edit(
        &mut a,
        json!({"type":"createRoad","road":{"name":"Limit","width":10,"material":"earth","nodes":[{"point":[0,0],"incoming":null,"outgoing":null},{"point":[1010,0],"incoming":null,"outgoing":null}]},"population":s}),
    );
    let all = objects(&a);
    assert_eq!(all.iter().filter(|o| o.kind() == "parcel").count(), 200);
    // Empty parcels must still count, and must still pass a valid reopen.
    for object in all.iter().filter(|o| o.kind() == "house").take(2) {
        edit(&mut a, json!({"type":"delete","id":object.id()}));
    }
    a.save(&path).unwrap();
    let mut b = AtlasApplication::new().unwrap();
    b.open(&path).unwrap();
    assert_eq!(objects(&b), objects(&a));
    let FullObject::Parcel(mut extra) = all.iter().find(|o| o.kind() == "parcel").unwrap().clone()
    else {
        unreachable!()
    };
    extra.id = "parcel-99999".into();
    let road = all
        .iter()
        .find_map(|o| {
            if let FullObject::Road(r) = o {
                Some(r)
            } else {
                None
            }
        })
        .unwrap();
    if let ParcelSource::Road {
        side, start, end, ..
    } = &mut extra.source
    {
        *side = Side::Right;
        *start = 1000.0 / 1010.0;
        *end = 1.0;
    }
    let geometry = parcel_geometry::derive_parcel(road, &extra.source).unwrap();
    extra.polygon = geometry.polygon;
    extra.frame = geometry.frame;
    storage::write_object(&a.db, &FullObject::Parcel(extra), true).unwrap();
    a.db.execute("UPDATE document_meta SET next_identity=100000", [])
        .unwrap();
    a.save(&path).unwrap();
    let before = dump(&b);
    let error = b.open(&path).unwrap_err();
    assert!(
        error
            .issue
            .as_ref()
            .is_some_and(|issue| issue.code == IssueCode::Limit),
        "{}",
        error.message
    );
    assert_eq!(dump(&b), before);
}

#[test]
fn duplicate_owner_rows_are_rejected_without_any_persisted_owner_index() {
    reject_sqls(&["UPDATE objects SET body=json_set(body,'$.placement.parcelId',(SELECT json_extract(body,'$.placement.parcelId') FROM objects WHERE kind='house' ORDER BY id LIMIT 1)) WHERE kind='house'"]);
}

#[test]
fn oblique_road_follow_after_manual_quarter_turns_roundtrips_without_drift() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("oblique.saltatlas");
    for angle in [0.17_f64, 1.3, 2.9, -2.2] {
        let mut a = fixture();
        let r = objects(&a)
            .into_iter()
            .find_map(|o| match o {
                FullObject::Road(r) if r.population_recipe.is_some() => Some(r),
                _ => None,
            })
            .unwrap();
        let parcels = a.parcel_headers_for_road(&r.id).unwrap();
        for (i, p) in parcels.iter().enumerate() {
            let h = a.house_header_for_parcel(&p.id).unwrap().unwrap();
            let q = (i % 4) as u8;
            let pose = GridPose {
                x_cells: if q == 1 || q == 2 { 2 } else { -2 },
                y_cells: if q >= 2 { 5 } else { 1 },
                quarter_turns: QuarterTurns(q),
            };
            let transform = parcel_geometry::parcel_house_transform(&p.frame, &pose).unwrap();
            edit(
                &mut a,
                json!({"type":"transformHouse","id":h.id,"transform":transform}),
            );
        }
        let before = objects(&a);
        let mut rotated = r.clone();
        for n in &mut rotated.nodes {
            let [x, y] = n.point;
            n.point = [
                x * angle.cos() - y * angle.sin() + 1000.125,
                x * angle.sin() + y * angle.cos() - 1000.375,
            ];
        }
        let intent = update_road(&rotated);
        let preview = a
            .request("preview", json!({"version":a.status(),"intent":intent}))
            .unwrap();
        assert_eq!(preview["valid"], true, "{angle}: {preview}");
        let committed = edit(&mut a, intent);
        assert_eq!(preview["objects"], committed["objects"]);
        let after = objects(&a);
        for o in &before {
            if let FullObject::House(h) = o {
                let n = a.house(&h.id).unwrap();
                assert_eq!(n.placement, h.placement);
                assert_eq!(n.cells, h.cells);
                assert_eq!(n.rooms, h.rooms);
                assert_eq!(n.connections, h.connections);
            }
        }
        a.history(false).unwrap();
        assert_eq!(objects(&a), before);
        a.history(true).unwrap();
        assert_eq!(objects(&a), after);
        a.save(&path).unwrap();
        let mut b = AtlasApplication::new().unwrap();
        b.open(&path).unwrap();
        assert_eq!(objects(&b), after);
        let unchanged = update_road(&b.road(&r.id).unwrap());
        let revision = b.status().revision;
        assert_eq!(edit(&mut b, unchanged)["changed"], false);
        assert_eq!(b.status().revision, revision);
    }
}

#[test]
fn structurally_equivalent_ddl_accepts_comments_case_whitespace_and_extra_checks() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("equivalent.saltatlas");
    let mut a = fixture();
    a.save(&path).unwrap();
    let db = Connection::open(&path).unwrap();
    db.execute_batch(
        "ALTER TABLE document_meta RENAME TO old_meta;
        ALTER TABLE objects RENAME TO old_objects;
        ALTER TABLE house_cells RENAME TO old_cells;
        create /* a different spelling */ table document_meta (
          singleton integer not null primary key,
          next_identity integer not null check(next_identity>0)
        ) without rowid, strict;
        CREATE TABLE OBJECTS(ID text not null primary key asc collate binary,
          KIND text not null,BODY text not null) strict, without rowid;
        create table house_cells(building_id text primary key not null,
          payload text not null) without rowid, strict;
        INSERT INTO document_meta SELECT * FROM old_meta;
        INSERT INTO objects SELECT * FROM old_objects;
        INSERT INTO house_cells SELECT * FROM old_cells;
        DROP TABLE old_meta; DROP TABLE old_objects; DROP TABLE old_cells;",
    )
    .unwrap();
    drop(db);
    let mut b = AtlasApplication::new().unwrap();
    b.open(&path).unwrap();
    assert_eq!(objects(&a), objects(&b));
}

#[test]
fn structural_schema_rejects_pk_collation_direction_defaults_hidden_and_storage_variants() {
    // Each table replacement preserves the same rows. Rejection must concern
    // the structural contract, independent of data/DDL formatting.
    for definition in [
        "id TEXT PRIMARY KEY NOT NULL COLLATE NOCASE,kind TEXT NOT NULL,body TEXT NOT NULL) STRICT, WITHOUT ROWID",
        "id TEXT PRIMARY KEY DESC NOT NULL,kind TEXT NOT NULL,body TEXT NOT NULL) STRICT, WITHOUT ROWID",
        "id TEXT PRIMARY KEY NOT NULL,kind TEXT NOT NULL,body TEXT NOT NULL UNIQUE) STRICT, WITHOUT ROWID",
        "id TEXT PRIMARY KEY NOT NULL,kind TEXT NOT NULL,body TEXT NOT NULL DEFAULT '{}') STRICT, WITHOUT ROWID",
        "id TEXT PRIMARY KEY NOT NULL,kind TEXT NOT NULL,body TEXT NOT NULL,extra TEXT GENERATED ALWAYS AS (kind) VIRTUAL) STRICT, WITHOUT ROWID",
        "id TEXT PRIMARY KEY NOT NULL,kind TEXT NOT NULL,body TEXT NOT NULL) WITHOUT ROWID",
        "id TEXT PRIMARY KEY NOT NULL,kind TEXT NOT NULL,body TEXT NOT NULL) STRICT",
        "id TEXT PRIMARY KEY,kind TEXT NOT NULL,body TEXT NOT NULL) STRICT",
        "id TEXT PRIMARY KEY NOT NULL,kind TEXT NOT NULL,body ANY NOT NULL) STRICT, WITHOUT ROWID",
        "id TEXT PRIMARY KEY NOT NULL,body TEXT NOT NULL,kind TEXT NOT NULL) STRICT, WITHOUT ROWID",
        "id TEXT PRIMARY KEY NOT NULL,kind TEXT NOT NULL REFERENCES document_meta(singleton),body TEXT NOT NULL) STRICT, WITHOUT ROWID",
    ] {
        let dir=tempfile::tempdir().unwrap();let path=dir.path().join("schema.saltatlas");
        fixture().save(&path).unwrap();let db=Connection::open(&path).unwrap();
        db.execute_batch(&format!("PRAGMA foreign_keys=OFF; ALTER TABLE objects RENAME TO old_objects; CREATE TABLE objects({definition}; INSERT INTO objects(id,kind,body) SELECT id,kind,body FROM old_objects; DROP TABLE old_objects;")).unwrap();
        drop(db);
        let corrupted=std::fs::read(&path).unwrap();
        let mut live=live_document();let before=dump(&live);
        assert!(live.open(&path).is_err(),"accepted {definition}");
        assert_eq!(dump(&live),before);
        assert_eq!(std::fs::read(&path).unwrap(),corrupted);
    }
}

#[test]
fn half_export_failure_keeps_existing_target_bytes_state_history_and_session() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("atomic.saltatlas");
    let mut a = fixture();
    a.save(&path).unwrap();
    road(&mut a, 1000.0, false);
    let bytes = std::fs::read(&path).unwrap();
    let before = dump(&a);
    let count: usize =
        a.db.query_row("SELECT count(*) FROM objects", [], |r| r.get(0))
            .unwrap();
    let mut exported = 0;
    let error = a
        .save_snapshot(&path, |n| {
            exported = n;
            if n == count / 2 {
                Err(storage_error("injected halfway export failure"))
            } else {
                Ok(())
            }
        })
        .unwrap_err();
    assert_eq!(error.category, ErrorCategory::Storage);
    assert_eq!(exported, count / 2);
    assert_eq!(std::fs::read(&path).unwrap(), bytes);
    assert_eq!(dump(&a), before);
    assert_eq!(std::fs::read_dir(dir.path()).unwrap().count(), 1);
    a.history(false).unwrap();
    a.history(true).unwrap();
    a.save(&path).unwrap();
}

#[test]
fn authoritative_roundtrip_preserves_detached_ulp_empty_parcels_poses_cells_and_relations() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("authoritative.saltatlas");
    let second = dir.path().join("again.saltatlas");
    let mut a = fixture();
    let h = objects(&a)
        .into_iter()
        .find_map(|o| {
            if let FullObject::House(h) = o {
                Some(h)
            } else {
                None
            }
        })
        .unwrap();
    let Placement::Parcel { parcel_id, .. } = &h.placement else {
        unreachable!()
    };
    edit(&mut a, json!({"type":"detachParcel","id":parcel_id}));
    let another = objects(&a)
        .into_iter()
        .find(|o| o.kind() == "house" && o.id() != h.id)
        .unwrap();
    edit(&mut a, json!({"type":"delete","id":another.id()}));
    edit(
        &mut a,
        json!({"type":"createHouse","parcelId":null,"transform":{"x":1000.125,"y":2000.375,"angle":0.17},"width":2,"depth":2}),
    );
    // Frozen detached coordinates are authoritative even one ULP apart.
    let FullObject::Parcel(mut p) = a.object(parcel_id).unwrap() else {
        unreachable!()
    };
    p.frame.angle = f64::from_bits(p.frame.angle.to_bits() + 1);
    let mut detached_house = a.house(&h.id).unwrap();
    let Placement::Parcel { grid_pose, .. } = &detached_house.placement else {
        unreachable!()
    };
    detached_house.transform =
        parcel_geometry::parcel_house_transform(&p.frame, grid_pose).unwrap();
    detached_house.occupancy_bounds = occupancy_bounds(
        &detached_house.occupancy_contours,
        &detached_house.transform,
    );
    storage::write_object(&a.db, &FullObject::Parcel(p), false).unwrap();
    storage::write_object(&a.db, &FullObject::House(detached_house), false).unwrap();
    // Perturb only a redundant bound world transform by one ULP. It is absent
    // from the file and must be recomputed canonically without a new tolerance.
    let mut cache = a.house(&h.id).unwrap();
    cache.transform.x = f64::from_bits(cache.transform.x.to_bits() + 1);
    cache.occupancy_bounds = occupancy_bounds(&cache.occupancy_contours, &cache.transform);
    storage::write_object(&a.db, &FullObject::House(cache), false).unwrap();
    a.db.execute("UPDATE house_cells SET payload='  '||payload||char(10)", [])
        .unwrap();
    a.save(&path).unwrap();
    let rows = snapshot_rows(&path);
    let cells = payload_rows(&path);
    for (_, kind, body) in &rows {
        let v: Value = serde_json::from_str(body).unwrap();
        assert!(
            v.get("path").is_none()
                && v.get("contours").is_none()
                && v.get("bounds").is_none()
                && v.get("cells").is_none()
        );
        if kind == "house" && v["placement"]["kind"] == "parcel" {
            assert!(v.get("transform").is_none() && v["placement"].get("transform").is_none());
        }
        if kind == "parcel" && v["source"]["kind"] == "road" {
            assert!(v.get("polygon").is_none() && v.get("frame").is_none());
        }
    }
    let mut b = AtlasApplication::new().unwrap();
    b.open(&path).unwrap();
    b.save(&second).unwrap();
    assert_eq!(snapshot_rows(&second), rows);
    assert_eq!(payload_rows(&second), cells);
    assert!(!b.status().dirty && !b.status().can_undo && !b.status().can_redo);
    let loaded = b.house(&h.id).unwrap();
    let FullObject::Parcel(p) = b.object(parcel_id).unwrap() else {
        unreachable!()
    };
    let Placement::Parcel { grid_pose, .. } = &loaded.placement else {
        unreachable!()
    };
    assert_eq!(
        loaded.transform,
        parcel_geometry::parcel_house_transform(&p.frame, grid_pose).unwrap()
    );
    let pristine = std::fs::read(&path).unwrap();
    let before = dump(&b);
    for sql in [
        "UPDATE objects SET body=json_set(body,'$.source.frame.extra',1) WHERE kind='parcel' AND json_extract(body,'$.source.kind')='detached'",
        "UPDATE objects SET body=json_set(body,'$.source.extra',1) WHERE kind='parcel' AND json_extract(body,'$.source.kind')='detached'",
        "UPDATE objects SET body=json_set(body,'$.placement.transform.extra',1) WHERE kind='house' AND json_extract(body,'$.placement.kind')='free'",
        "UPDATE objects SET body=replace(body,'\"x\":1000.125','\"x\":1000.125,\"x\":1000.125') WHERE kind='house' AND json_extract(body,'$.placement.kind')='free'",
    ] {
        std::fs::write(&path,&pristine).unwrap();
        let db=Connection::open(&path).unwrap();assert!(db.execute(sql,[]).unwrap()>0);drop(db);
        let corrupted=std::fs::read(&path).unwrap();
        assert!(b.open(&path).is_err(),"accepted {sql}");
        assert_eq!(dump(&b),before);assert_eq!(std::fs::read(&path).unwrap(),corrupted);
    }
}

#[test]
fn high_orders_and_global_ids_restore_future_counters_and_reject_overflow() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("counters.saltatlas");
    let mut a = AtlasApplication::new().unwrap();
    let area = FullObject::Area(Area {
        id: "area-9007199254740991".into(),
        material: "grass".into(),
        points: vec![[0.0, 0.0], [20.0, 0.0], [20.0, 20.0], [0.0, 20.0]],
        order: u64::MAX - 2,
    });
    storage::write_object(&a.db, &area, false).unwrap();
    a.db.execute(
        "UPDATE document_meta SET next_identity=9007199254740992",
        [],
    )
    .unwrap();
    a.save(&path).unwrap();
    let mut b = AtlasApplication::new().unwrap();
    b.open(&path).unwrap();
    assert_eq!(b.next_state, u64::MAX - 1);
    let result = edit(
        &mut b,
        json!({"type":"createArea","area":{"material":"grass","points":[[100,0],[120,0],[120,20],[100,20]]}}),
    );
    assert_eq!(result["objects"][0]["id"], "area-9007199254740992");
    assert_eq!(result["objects"][0]["order"], json!(u64::MAX - 1));
    b.save(&path).unwrap();
    let db = Connection::open(&path).unwrap();
    db.execute(
        "UPDATE objects SET body=json_set(body,'$.order',json('18446744073709551615'))",
        [],
    )
    .unwrap();
    drop(db);
    let before = dump(&b);
    assert!(b.open(&path).is_err());
    assert_eq!(dump(&b), before);
}

#[test]
fn multiple_large_houses_stream_one_payload_at_a_time_without_a_global_cell_cap() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("large.saltatlas");
    let mut a = AtlasApplication::new().unwrap();
    for (index, width, depth) in [(1, 320, 320), (2, 128, 128)] {
        let mut h = interior::new_house(
            format!("house-{index}"),
            Transform {
                x: index as f64 * 3000.0,
                y: 0.0,
                angle: 0.0,
            },
            2,
            2,
            0,
        )
        .unwrap();
        h.cells = (0..depth)
            .flat_map(|y| {
                (0..width).map(move |x| crate::interior::Cell {
                    floor: 0,
                    x,
                    y,
                    room_id: "room-0".into(),
                })
            })
            .collect();
        h.contours = contours(&h.cells);
        h.occupancy_contours = occupancy_contours(&h.cells);
        h.occupancy_bounds = occupancy_bounds(&h.occupancy_contours, &h.transform);
        storage::write_object(&a.db, &FullObject::House(h), true).unwrap();
    }
    a.db.execute("UPDATE document_meta SET next_identity=3", [])
        .unwrap();
    // Export may copy raw payloads, but must never assemble a FullHouse or read
    // the local cell index. Denying those index reads independently enforces it.
    a.db.flush_prepared_statement_cache();
    a.db.authorizer(Some(|ctx: AuthContext<'_>| match ctx.action {
        AuthAction::Read {
            table_name: "local_cells",
            ..
        } => Authorization::Deny,
        _ => Authorization::Allow,
    }));
    persistence::payload_metrics::reset();
    a.save(&path).unwrap();
    assert_eq!(persistence::payload_metrics::counts(), (0, 1, 2));
    a.db.authorizer(None::<fn(AuthContext<'_>) -> Authorization>);
    let mut b = AtlasApplication::new().unwrap();
    persistence::payload_metrics::reset();
    b.open(&path).unwrap();
    assert_eq!(persistence::payload_metrics::counts(), (0, 1, 2));
    assert_eq!(b.house("house-1").unwrap().cells.len(), 102400);
    assert_eq!(b.house("house-2").unwrap().cells.len(), 16384);
    let second = dir.path().join("again.saltatlas");
    b.save(&second).unwrap();
    assert_eq!(payload_rows(&path), payload_rows(&second));
}

#[test]
fn height_import_late_failures_preserve_active_session_and_source() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("invalid-heights.saltatlas");
    let live_path = dir.path().join("active.saltatlas");
    let mut source = AtlasApplication::new().unwrap();
    terrain_store::write_points(&source.db, &[(-1, -1, 0.1)]).unwrap();
    world_terrain_store::apply(
        &source.db,
        &world_terrain_store::WorldTerrainDelta {
            level: 1,
            before: vec![],
            after: vec![(-1, -1, Some(0.2))],
        },
        true,
    )
    .unwrap();
    source.save(&path).unwrap();
    let pristine = std::fs::read(&path).unwrap();
    let mut live = live_document();
    terrain_store::write_points(&live.db, &[(-5, 3, 11.2)]).unwrap();
    world_terrain_store::apply(
        &live.db,
        &world_terrain_store::WorldTerrainDelta {
            level: 2,
            before: vec![],
            after: vec![(1, -2, Some(-4.5))],
        },
        true,
    )
    .unwrap();
    live.save(&live_path).unwrap();
    edit(
        &mut live,
        json!({"type":"createHouse","parcelId":null,"transform":{"x":2000,"y":2000,"angle":0},"width":2,"depth":2}),
    );
    live.history(false).unwrap();
    let before = dump(&live);
    let heights = super::terrain_tests::height_rows(&live.db);
    for sql in [
        "INSERT INTO terrain VALUES(20000001,0,1.0)",
        "INSERT INTO terrain_layers VALUES(2,20000000,0,1.0)",
        "INSERT INTO ground_tiles VALUES(0,0,0,x'01')",
    ] {
        std::fs::write(&path, &pristine).unwrap();
        let db = Connection::open(&path).unwrap();
        db.execute(sql, []).unwrap();
        drop(db);
        let bytes = std::fs::read(&path).unwrap();
        assert!(live.open(&path).is_err(), "accepted {sql}");
        assert_eq!(dump(&live), before, "active session changed: {sql}");
        assert_eq!(super::terrain_tests::height_rows(&live.db), heights);
        assert_eq!(std::fs::read(&path).unwrap(), bytes);
    }
    live.history(true).unwrap();
    live.history(false).unwrap();
    assert_eq!(super::terrain_tests::height_rows(&live.db), heights);
}
