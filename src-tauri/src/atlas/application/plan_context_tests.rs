use super::application_test_support::{request_edit as request, *};
use super::*;
use crate::atlas::test_inputs::update_road;
use plan_context::{HeaderPostState, HeaderSpatialIndex, PlanContext};
use rusqlite::hooks::{AuthAction, AuthContext, Authorization};
use std::collections::BTreeSet;

fn create(count: usize) -> Value {
    json!({"type":"createRoad","road":{"name":"Prepared","width":10,"material":"earth","nodes":[{"point":[0,0],"incoming":null,"outgoing":null},{"point":[count as f64 * 10.0,0],"incoming":null,"outgoing":null}]},"population":{"side":"both","setback":5,"gap":10,"minWidth":2,"maxWidth":2,"minDepth":2,"maxDepth":2,"seed":17,"parcelDepth":40}})
}
fn area(id: &str, x: f64, y: f64, material: &str) -> SceneObject {
    SceneObject::Area(Area {
        id: id.into(),
        material: material.into(),
        points: vec![[x, y], [x + 10.0, y], [x + 10.0, y + 10.0], [x, y + 10.0]],
        order: 0,
    })
}
fn parcel(id: &str, x: f64, y: f64) -> SceneObject {
    SceneObject::Parcel(Parcel {
        id: id.into(),
        source: ParcelSource::Detached {},
        polygon: vec![[x, y], [x + 20.0, y], [x + 20.0, y + 20.0], [x, y + 20.0]],
        frame: Transform { x, y, angle: 0.0 },
    })
}
fn house(id: &str, x: f64, y: f64) -> HouseHeader {
    interior::new_house(id.into(), Transform { x, y, angle: 0.0 }, 2, 2, 0)
        .unwrap()
        .header()
}

#[test]
fn population_and_follow_are_deterministic() {
    for count in [10, 200] {
        let mut previous = None;
        for _ in 0..2 {
            let mut app = AtlasApplication::new().unwrap();
            let mut outputs: Vec<Value> = Vec::new();
            let mut action = create(count);
            for follow in [false, true] {
                if follow {
                    let mut road = outputs[0]["objects"]
                        .as_array()
                        .unwrap()
                        .iter()
                        .find(|object| object["kind"] == "road")
                        .unwrap()
                        .clone();
                    for node in road["nodes"].as_array_mut().unwrap() {
                        node["point"][1] = json!(3.0);
                    }
                    action = update_road(&road);
                }
                let before = serde_json::to_value(app.status()).unwrap();
                let mut expected = None;
                for command in ["preview", "commit"] {
                    let response = request(&mut app, command, action.clone());

                    assert_eq!(response["valid"], true);
                    let objects = response["objects"].as_array().unwrap();
                    for kind in ["parcel", "house"] {
                        assert_eq!(
                            objects
                                .iter()
                                .filter(|object| object["kind"] == kind)
                                .count(),
                            count
                        );
                    }

                    if let Some(ref expected) = expected {
                        assert_eq!(&response["objects"], expected);
                    } else {
                        assert_eq!(serde_json::to_value(app.status()).unwrap(), before);
                        expected = Some(response["objects"].clone());
                    }
                    outputs.push(json!({"objects":response["objects"]}));
                }
            }
            if let Some(ref previous) = previous {
                assert_eq!(&outputs, previous);
            } else {
                previous = Some(outputs);
            }
        }
    }
}

#[test]
fn spatial_index_matches_bruteforce_mixed_conflict_sets_including_holes_caps_and_basements() {
    for [dx, dy] in [[0.0, 0.0], [123.125, -345.25], [4_999_000.0, -4_999_000.0]] {
        let mut owner = house("house-owner", dx, dy);
        owner.placement = Placement::Parcel {
            parcel_id: "parcel-owner".into(),
            grid_pose: GridPose {
                x_cells: 0,
                y_cells: 0,
                quarter_turns: QuarterTurns(0),
            },
        };
        let mut basement = house("house-basement", dx + 100.0, dy);
        basement.occupancy_contours = vec![vec![
            LocalPoint([8.0, 8.0]),
            LocalPoint([10.0, 8.0]),
            LocalPoint([10.0, 10.0]),
            LocalPoint([8.0, 10.0]),
        ]];
        basement.occupancy_bounds =
            occupancy_bounds(&basement.occupancy_contours, &basement.transform);
        let mut donut = interior::new_house(
            "house-hole".into(),
            Transform {
                x: dx + 200.0,
                y: dy,
                angle: 0.0,
            },
            3,
            3,
            0,
        )
        .unwrap();
        donut.cells.retain(|c| c.x != 1 || c.y != 1);
        donut.contours = contours(&donut.cells);
        donut.occupancy_contours = occupancy_contours(&donut.cells);
        donut.occupancy_bounds = occupancy_bounds(&donut.occupancy_contours, &donut.transform);
        let nodes = vec![
            Node {
                id: "node-a".into(),
                point: [dx + 300.0, dy],
                incoming: None,
                outgoing: None,
            },
            Node {
                id: "node-b".into(),
                point: [dx + 310.0, dy],
                incoming: None,
                outgoing: None,
            },
        ];
        let road = Road {
            id: "road-cap".into(),
            name: "Caps".into(),
            width: 4.0,
            material: crate::atlas::model::RoadMaterial::Earth,
            path: road_path(&nodes).unwrap(),
            nodes,
            edge_sections: vec!["section-a".into()],
            sections: vec![RoadSection {
                id: "section-a".into(),
                populated_sides: vec![],
            }],
            population_recipe: None,
        };
        let objects = vec![
            parcel("parcel-owner", dx, dy),
            SceneObject::House(owner),
            SceneObject::House(house("house-foreign", dx, dy)),
            SceneObject::House(house("house-touch", dx + 10.0, dy)),
            area("area-water", dx + 5.0, dy + 5.0, "water"),
            area("area-grass", dx, dy, "grass"),
            SceneObject::House(basement),
            parcel("parcel-basement", dx + 140.0, dy + 40.0),
            SceneObject::House(donut.header()),
            // Entirely inside the roof/occupancy hole.
            SceneObject::Area(Area {
                id: "area-hole".into(),
                material: "water".into(),
                points: vec![
                    [dx + 206.0, dy + 6.0],
                    [dx + 209.0, dy + 6.0],
                    [dx + 209.0, dy + 9.0],
                    [dx + 206.0, dy + 9.0],
                ],
                order: 0,
            }),
            SceneObject::Road(road),
            SceneObject::House(house("house-cap", dx + 311.0, dy)),
            area("area-road-water", dx + 303.0, dy - 5.0, "water"),
        ];
        let brute: BTreeSet<_> = (0..objects.len())
            .flat_map(|i| (i + 1..objects.len()).map(move |j| (i, j)))
            .filter(|&(i, j)| conflict(&objects[i], &objects[j]).unwrap())
            .collect();
        let index = HeaderSpatialIndex::bulk_load(&objects);
        let indexed: BTreeSet<_> = objects
            .iter()
            .enumerate()
            .flat_map(|(i, h)| {
                index
                    .query(collision_bounds(h))
                    .into_iter()
                    .filter(move |&j| j > i)
                    .map(move |j| (i, j))
            })
            .filter(|&(i, j)| conflict(&objects[i], &objects[j]).unwrap())
            .collect();
        assert_eq!(brute, indexed);
        assert!(!brute.contains(&(0, 1)), "owner exemption");
        assert!(brute.contains(&(0, 2)), "foreign occupancy");
        assert!(!brute.contains(&(2, 3)), "boundary contact");
        assert!(brute.contains(&(6, 7)), "basement outside roof bounds");
        assert!(!brute.contains(&(8, 9)), "hole");
        assert!(brute.contains(&(10, 11)), "round cap");
        assert!(brute.contains(&(10, 12)), "water");
        let mut incremental = HeaderSpatialIndex::default();
        for (i, h) in objects.iter().enumerate().rev() {
            incremental.insert(h, i);
        }
        for h in &objects {
            assert_eq!(
                index.query(collision_bounds(h)),
                incremental.query(collision_bounds(h))
            );
        }
    }
}

#[test]
fn preview_matches_commit_and_fresh_curves_are_recomputed() {
    let mut a = AtlasApplication::new().unwrap();

    let p = request(&mut a, "preview", create(50));

    let created = request(&mut a, "commit", create(50));
    assert_eq!(p["objects"], created["objects"]);
    let mut road = created["objects"]
        .as_array()
        .unwrap()
        .iter()
        .find(|h| h["kind"] == "road")
        .unwrap()
        .clone();
    for n in road["nodes"].as_array_mut().unwrap() {
        n["point"][1] = json!(3.0);
    }

    assert_eq!(
        request(&mut a, "preview", update_road(&road))["valid"],
        true
    );

    // A second request for the same road identity must prepare its own curve.
    let mut blank = AtlasApplication::new().unwrap();
    let mut input = create(10);
    input["population"] = Value::Null;
    let original = request(&mut blank, "commit", input)["objects"][0].clone();
    let mut paths = vec![];
    for height in [15.0, 35.0] {
        let mut r = original.clone();
        r["nodes"][0]["outgoing"] = json!([30, height]);

        let p = request(&mut blank, "preview", update_road(&r));
        assert_eq!(p["valid"], true);

        paths.push(p["objects"][0]["path"].clone());
    }
    assert_ne!(paths[0], paths[1]);
}

#[test]
fn staged_validation_is_header_only_and_excludes_own_ids() {
    let mut a = AtlasApplication::new().unwrap();
    request(&mut a, "commit", create(200));
    a.db.flush_prepared_statement_cache();
    a.db.authorizer(Some(|ctx: AuthContext<'_>| match ctx.action {
        AuthAction::Read { table_name, .. }
            if ["house_cells", "local_cells"].contains(&table_name) =>
        {
            Authorization::Deny
        }
        AuthAction::Read {
            table_name: "objects",
            column_name: "metadata",
            ..
        } => Authorization::Deny,
        _ => Authorization::Allow,
    }));

    plan_context::validate_staged_document(&a, &mut HashMap::new()).unwrap();
}

#[test]
fn live_conflicts_have_stable_precedence() {
    let a = AtlasApplication::new().unwrap();
    let after: Vec<_> = (0..12)
        .map(|i| area(&format!("area-{i}"), 0.0, 0.0, "grass"))
        .collect();
    let state = HeaderPostState::new([], after).unwrap();

    plan_context::validate_poststate(&state, &mut PlanContext::new(&a)).unwrap();
    storage::write_object(
        &a.db,
        &FullObject::Area(match area("area-live-first", 0.0, 0.0, "water") {
            SceneObject::Area(a) => a,
            _ => unreachable!(),
        }),
        false,
    )
    .unwrap();
    storage::write_object(
        &a.db,
        &FullObject::Area(match area("area-live-second", 0.0, 0.0, "water") {
            SceneObject::Area(a) => a,
            _ => unreachable!(),
        }),
        false,
    )
    .unwrap();
    let state = HeaderPostState::new(
        [],
        vec![
            SceneObject::House(house("house-new", 0.0, 0.0)),
            area("area-after", 0.0, 0.0, "water"),
        ],
    )
    .unwrap();
    let error = plan_context::validate_poststate(&state, &mut PlanContext::new(&a)).unwrap_err();
    assert_eq!(
        error.issue.unwrap().object_ids,
        vec!["house-new", "area-live-first"]
    );
}

#[test]
fn scattered_mutations_query_individual_regions_and_cache_repeated_live_headers() {
    let a = AtlasApplication::new().unwrap();
    let middle = area("area-middle", 0.0, 0.0, "grass");
    if let SceneObject::Area(h) = middle {
        storage::write_object(&a.db, &FullObject::Area(h), false).unwrap();
    }
    a.db.execute(
        "UPDATE objects SET body='invalid JSON' WHERE id='area-middle'",
        [],
    )
    .unwrap();
    let state = HeaderPostState::new(
        [],
        vec![
            area("area-left", -1000.0, 0.0, "grass"),
            area("area-right", 1000.0, 0.0, "grass"),
        ],
    )
    .unwrap();

    plan_context::validate_poststate(&state, &mut PlanContext::new(&a)).unwrap();

    a.db.execute("DELETE FROM objects", []).unwrap();
    if let SceneObject::Area(h) = area("area-live", 0.0, 0.0, "grass") {
        storage::write_object(&a.db, &FullObject::Area(h), false).unwrap();
    }
    let state = HeaderPostState::new(
        [],
        vec![
            area("area-a", 0.0, 0.0, "grass"),
            area("area-b", 1.0, 0.0, "grass"),
        ],
    )
    .unwrap();

    plan_context::validate_poststate(&state, &mut PlanContext::new(&a)).unwrap();
}

#[test]
fn validator_rederives_offered_source_geometry_and_rejects_geometry_changes_after_prepare() {
    let mut a = AtlasApplication::new().unwrap();
    let created = request(&mut a, "commit", create(10));
    let mut r: Road = serde_json::from_value(
        created["objects"]
            .as_array()
            .unwrap()
            .iter()
            .find(|o| o["kind"] == "road")
            .unwrap()
            .clone(),
    )
    .unwrap();
    let SceneObject::Parcel(mut p) = serde_json::from_value(
        created["objects"]
            .as_array()
            .unwrap()
            .iter()
            .find(|o| o["kind"] == "parcel")
            .unwrap()
            .clone(),
    )
    .unwrap() else {
        unreachable!()
    };
    p.frame.x += 0.25;
    let state = HeaderPostState::new([p.id.clone()], vec![SceneObject::Parcel(p)]).unwrap();
    assert_eq!(
        plan_context::validate_poststate(&state, &mut PlanContext::new(&a))
            .unwrap_err()
            .issue
            .unwrap()
            .code,
        IssueCode::ParcelGeometry
    );
    let mut context = PlanContext::new(&a);
    context.register_final_road(&mut r).unwrap();
    r.sections[0].populated_sides.clear();
    context.register_final_road(&mut r).unwrap();
    r.nodes[1].point[1] += 1.0;
    assert!(context.register_final_road(&mut r).is_err());
}

#[test]
fn poststate_after_wins_deleted_ids_are_absent_and_owner_replacement_is_not_double_counted() {
    let a = AtlasApplication::new().unwrap();
    let SceneObject::Parcel(p) = parcel("parcel-1", 0.0, 0.0) else {
        unreachable!()
    };
    storage::write_object(&a.db, &FullObject::Parcel(p.clone()), false).unwrap();
    let mut old = interior::new_house("house-2".into(), p.frame.clone(), 2, 2, 0).unwrap();
    old.placement = Placement::Parcel {
        parcel_id: p.id.clone(),
        grid_pose: GridPose {
            x_cells: 0,
            y_cells: 0,
            quarter_turns: QuarterTurns(0),
        },
    };
    storage::write_object(&a.db, &FullObject::House(old.clone()), true).unwrap();
    let mut new = old.header();
    new.id = "house-3".into();
    let state =
        HeaderPostState::new([old.id.clone()], vec![SceneObject::House(new.clone())]).unwrap();
    plan_context::validate_poststate(&state, &mut PlanContext::new(&a)).unwrap();
    let state = HeaderPostState::new([], vec![SceneObject::House(new.clone())]).unwrap();
    assert_eq!(
        plan_context::validate_poststate(&state, &mut PlanContext::new(&a))
            .unwrap_err()
            .issue
            .unwrap()
            .code,
        IssueCode::OccupiedParcel
    );
    let state = HeaderPostState::new(
        [old.id.clone(), p.id.clone()],
        vec![SceneObject::House(new.clone())],
    )
    .unwrap();
    assert_eq!(
        plan_context::validate_poststate(&state, &mut PlanContext::new(&a))
            .unwrap_err()
            .issue
            .unwrap()
            .code,
        IssueCode::ParcelContainment
    );
    // After must beat the deleted Before-ID and the live version of this parcel.
    let mut moved = p;
    moved.frame.x = 5.0;
    new.transform = parcel_geometry::parcel_house_transform(
        &moved.frame,
        &GridPose {
            x_cells: 0,
            y_cells: 0,
            quarter_turns: QuarterTurns(0),
        },
    )
    .unwrap();
    new.occupancy_bounds = occupancy_bounds(&new.occupancy_contours, &new.transform);
    let state = HeaderPostState::new(
        [old.id, moved.id.clone()],
        vec![SceneObject::House(new), SceneObject::Parcel(moved)],
    )
    .unwrap();
    plan_context::validate_poststate(&state, &mut PlanContext::new(&a)).unwrap();
}
