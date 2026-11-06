use super::*;
use crate::atlas::{
    geometry::{point_segment, road_path},
    RoadSection,
};

pub(super) fn road(points: &[Point]) -> Road {
    let nodes: Vec<_> = points
        .iter()
        .enumerate()
        .map(|(i, &point)| Node {
            id: format!("node-{}", i + 1),
            point,
            incoming: None,
            outgoing: None,
        })
        .collect();
    Road {
        id: "road-1".into(),
        name: "Test".into(),
        width: 10.0,
        material: crate::atlas::model::RoadMaterial::Earth,
        path: road_path(&nodes).unwrap_or_default(),
        edge_sections: vec!["section-1".into(); nodes.len() - 1],
        sections: vec![RoadSection {
            id: "section-1".into(),
            populated_sides: vec![],
        }],
        nodes,
        population_recipe: None,
    }
}
fn rect(x: f64, y: f64, w: f64, h: f64) -> Vec<Point> {
    vec![[x, y], [x + w, y], [x + w, y + h], [x, y + h]]
}
fn parcel(points: Vec<Point>) -> Parcel {
    Parcel {
        id: "parcel-1".into(),
        source: ParcelSource::Detached {},
        polygon: points,
        frame: Transform {
            x: 0.0,
            y: 0.0,
            angle: 0.0,
        },
    }
}
fn source(road: &Road, side: Side) -> ParcelSource {
    ParcelSource::Road {
        road_id: road.id.clone(),
        section_id: "section-1".into(),
        side,
        start: 0.2,
        end: 0.8,
        setback: 2.75,
        depth: 20.0,
    }
}
fn close(a: f64, b: f64) {
    assert!((a - b).abs() < 1e-8, "{a} != {b}");
}

#[test]
fn directed_straight_sides_front_frame_and_unrounded_setback() {
    let r = road(&[[0.0, 0.0], [100.0, 0.0]]);
    for side in [Side::Left, Side::Right] {
        let g = derive_parcel(&r, &source(&r, side)).unwrap();
        assert_eq!(g.polygon.len(), 4);
        close(g.frame.x, 50.0);
        close(g.frame.y, if side == Side::Left { -7.75 } else { 7.75 });
        let y = sub(
            world(LocalPoint([0.0, 1.0]), &g.frame),
            [g.frame.x, g.frame.y],
        );
        close(y[0], 0.0);
        close(y[1], if side == Side::Left { -5.0 } else { 5.0 });
        assert_eq!(g.polygon, canonical_polygon(g.polygon.clone()).unwrap());
        assert_ne!(g.polygon.first(), g.polygon.last());
    }
}

#[test]
fn curved_sides_use_front_arc_midpoint_and_join_bisector() {
    let r = road(&[[0.0, 0.0], [100.0, 0.0], [100.0, 100.0]]);
    for side in [Side::Left, Side::Right] {
        let mut s = source(&r, side);
        if let ParcelSource::Road {
            start,
            end,
            setback,
            ..
        } = &mut s
        {
            *start = 0.0;
            *end = 1.0;
            *setback = 0.0;
        }
        let g = derive_parcel(&r, &s).unwrap();
        let front = offset_chain(&r.path, side, 5.0).unwrap();
        let table = arc_table(&front).unwrap();
        let m = sample_arc(&table, table.total_length() / 2.0).unwrap();
        close(g.frame.x, m.point[0]);
        close(g.frame.y, m.point[1]);
        close(m.tangent[0], 0.5_f64.sqrt());
        close(m.tangent[1], 0.5_f64.sqrt());
        assert_ne!(
            [g.frame.x, g.frame.y],
            sample_arc(&arc_table(&r.path).unwrap(), 100.0)
                .unwrap()
                .point
        );
    }
}

#[test]
fn miter_limit_hairpins_and_reversing_offsets_are_rejected() {
    let turn = 2.0 * 0.25_f64.acos();
    let path = |angle: f64| {
        vec![
            [0.0, 0.0],
            [1000.0, 0.0],
            [1000.0 + 1000.0 * angle.cos(), 1000.0 * angle.sin()],
        ]
    };
    assert!(offset_chain(&path(turn - 1e-5), Side::Left, 1.0).is_ok());
    assert!(offset_chain(&path(turn + 1e-5), Side::Left, 1.0).is_err());
    assert!(offset_chain(&[[0.0, 0.0], [100.0, 0.0], [0.0, 0.0]], Side::Left, 1.0).is_err());
    assert!(derive_parcel(
        &road(&[[0.0, 0.0], [10.0, 0.0], [10.0, 10.0]]),
        &ParcelSource::Road {
            road_id: "road-1".into(),
            section_id: "section-1".into(),
            side: Side::Right,
            start: 0.0,
            end: 1.0,
            setback: 0.0,
            depth: 20.0
        }
    )
    .is_err());
}

#[test]
fn canonical_polygons_reject_crossings_touches_zero_area_and_complexity() {
    let mut rotated = rect(10.0, 20.0, 5.0, 7.0);
    rotated.reverse();
    rotated.rotate_left(2);
    assert_eq!(
        canonical_polygon(rotated).unwrap(),
        rect(10.0, 20.0, 5.0, 7.0)
    );
    for invalid in [
        vec![[0.0, 0.0], [10.0, 10.0], [0.0, 10.0], [10.0, 0.0]],
        vec![[0.0, 0.0], [10.0, 0.0], [5.0, 0.0]],
        vec![
            [0.0, 0.0],
            [10.0, 0.0],
            [10.0, 10.0],
            [5.0, 5.0],
            [0.0, 10.0],
            [5.0, 5.0],
        ],
        vec![[0.0, 0.0], [10.0, 0.0], [10.0, 10.0], [0.0, 0.0]],
        rect(100_000_000.0, 0.0, 1.0, 1.0),
    ] {
        assert!(canonical_polygon(invalid).is_err());
    }
    let many = (0..2049)
        .map(|i| {
            let a = f64::from(i) * TAU / 2049.0;
            [a.cos(), a.sin()]
        })
        .collect();
    assert!(canonical_polygon(many).is_err());
}

#[test]
fn section_identity_order_zero_edges_and_shared_complexity_budget() {
    let mut r = road(&[[0.0, 0.0], [0.0, 0.0], [100.0, 0.0], [200.0, 0.0]]);
    assert_eq!(
        section_path(&r, "section-1").unwrap(),
        vec![[0.0, 0.0], [100.0, 0.0], [200.0, 0.0]]
    );
    r.edge_sections[2] = "section-2".into();
    r.sections.insert(
        0,
        RoadSection {
            id: "section-2".into(),
            populated_sides: vec![],
        },
    );
    assert_eq!(
        section_paths(&r)
            .unwrap()
            .iter()
            .map(|s| s.0.as_str())
            .collect::<Vec<_>>(),
        ["section-1", "section-2"]
    );
    assert!(section_path(&r, "missing").is_err());
    assert!(section_path(&road(&[[0.0, 0.0], [0.0, 0.0]]), "section-1").is_err());
    assert!(arc_table(&vec![[0.0, 0.0]; MAX_SAMPLES + 1]).is_err());
    let mut complex = road(
        &(0..512)
            .map(|i| [f64::from(i) * 1000.0, 0.0])
            .collect::<Vec<_>>(),
    );
    for node in &mut complex.nodes {
        node.incoming = Some([node.point[0], -10_000.0]);
        node.outgoing = Some([node.point[0], 10_000.0]);
    }
    assert!(section_paths(&complex).is_err());
}

#[test]
fn containment_checks_edges_across_concavities_not_only_corners() {
    let p = parcel(vec![
        [0.0, 0.0],
        [30.0, 0.0],
        [30.0, 30.0],
        [20.0, 30.0],
        [20.0, 10.0],
        [10.0, 10.0],
        [10.0, 30.0],
        [0.0, 30.0],
    ]);
    let occupancy = rect(5.0, 20.0, 20.0, 5.0);
    assert!(occupancy
        .iter()
        .all(|&point| contains(std::slice::from_ref(&p.polygon), point)));
    assert!(!covers_rings(&[p.polygon], &[occupancy]).unwrap());
}

#[test]
fn ring_nesting_retains_holes_islands_disjoint_and_point_touching_rooms() {
    let mut rings = vec![
        rect(5.0, 5.0, 20.0, 20.0),
        rect(40.0, 0.0, 5.0, 5.0),
        rect(10.0, 10.0, 10.0, 10.0),
        rect(0.0, 0.0, 30.0, 30.0),
    ];
    rings[0].reverse();
    rings[3].reverse();
    let geometry = rings_geometry(&rings).unwrap();
    assert_eq!(geometry.0.len(), 3);
    close(geometry.unsigned_area(), 625.0);
    assert!(!interiors_intersect(&rings, &[rect(6.0, 6.0, 2.0, 2.0)]).unwrap());
    assert!(interiors_intersect(&rings, &[rect(11.0, 11.0, 2.0, 2.0)]).unwrap());
    let point_touch = vec![rect(0.0, 0.0, 5.0, 5.0), rect(5.0, 5.0, 5.0, 5.0)];
    close(rings_geometry(&point_touch).unwrap().unsigned_area(), 50.0);
}

#[test]
fn every_three_by_three_cell_occupancy_has_the_expected_polygon_area() {
    // Exercise the actual cell-derived boundaries, including diagonal contacts
    // between holes and exterior rings, rather than hand-written rectangles.
    for mask in 1_u16..512 {
        let cells: Vec<_> = (0..9)
            .filter(|i| mask & (1 << i) != 0)
            .map(|i| crate::interior::Cell {
                floor: if i % 2 == 0 { -1 } else { 1 },
                x: i % 3,
                y: i / 3,
                room_id: "room".into(),
            })
            .collect();
        let occupied = occupancy_contours(&cells);
        let world_rings = occupancy_world(
            &occupied,
            &Transform {
                x: 0.0,
                y: 0.0,
                angle: 0.0,
            },
        );
        let geometry = rings_geometry(&world_rings)
            .unwrap_or_else(|error| panic!("mask {mask}: {}", error.message));
        close(
            geometry.unsigned_area(),
            f64::from(mask.count_ones()) * 25.0,
        );
        for i in 0..9 {
            let centre = geo::Point::new(
                (f64::from(i % 3) + 0.5) * 5.0,
                (f64::from(i / 3) + 0.5) * 5.0,
            );
            assert_eq!(
                geometry.contains(&centre),
                mask & (1 << i) != 0,
                "mask {mask}, cell {i}"
            );
        }
    }
}

#[test]
fn covers_accepts_quarter_epsilon_noise_and_rejects_four_epsilon_at_world_edge() {
    for x in [0.0, 4_999_950.0] {
        let p = vec![rect(x, 0.0, 10.0, 10.0)];
        let epsilon = predicate_epsilon(&p, &p);
        assert!(covers_rings(&p, &p).unwrap());
        assert!(covers_rings(&p, &[rect(x + 0.25 * epsilon, 0.0, 10.0, 10.0)]).unwrap());
        assert!(!covers_rings(&p, &[rect(x + 4.0 * epsilon, 0.0, 10.0, 10.0)]).unwrap());
    }
}

#[test]
fn intersection_includes_equality_enclosure_and_area_tolerance() {
    for x in [0.0, 4_999_950.0] {
        let a = vec![rect(x, 0.0, 10.0, 10.0)];
        let e = predicate_epsilon(&a, &a);
        assert!(interiors_intersect(&a, &a).unwrap());
        assert!(interiors_intersect(&a, &[rect(x + 1.0, 1.0, 2.0, 2.0)]).unwrap());
        assert!(!interiors_intersect(&a, &[rect(x + 10.0, 0.0, 10.0, 10.0)]).unwrap());
        assert!(!interiors_intersect(&a, &[rect(x + 10.0 - 2.0 * e, 0.0, 10.0, 10.0)]).unwrap());
        assert!(interiors_intersect(&a, &[rect(x + 10.0 - 8.0 * e, 0.0, 10.0, 10.0)]).unwrap());
    }
}

#[test]
fn integral_grid_composition_inverse_tolerance_and_rotated_boundary_contacts() {
    for base in [[12.75, -8.25], [4_999_900.0, -4_999_900.0]] {
        let frame = Transform {
            x: base[0],
            y: base[1],
            angle: 0.731,
        };
        for quarter in 0..4 {
            let pose = GridPose {
                x_cells: -3,
                y_cells: 2,
                quarter_turns: QuarterTurns(quarter),
            };
            let transform = parcel_house_transform(&frame, &pose).unwrap();
            let (actual, canonical) = parcel_grid_pose(&frame, &transform).unwrap();
            assert_eq!(actual, pose);
            assert_eq!(canonical, transform);
            let mut noisy = transform.clone();
            noisy.x += 5.0 * 0.25 * GRID_TOLERANCE_CELLS;
            noisy.angle += 0.25 * GRID_TOLERANCE_RADIANS;
            assert_eq!(parcel_grid_pose(&frame, &noisy).unwrap().0, pose);
            let mut half_cell = transform.clone();
            half_cell.x += 2.5;
            assert!(parcel_grid_pose(&frame, &half_cell).is_err());
            let mut off_grid = transform.clone();
            off_grid.x += 5.0 * 4.0 * GRID_TOLERANCE_CELLS * frame.angle.cos();
            off_grid.y += 5.0 * 4.0 * GRID_TOLERANCE_CELLS * frame.angle.sin();
            assert!(parcel_grid_pose(&frame, &off_grid).is_err());
            let mut eighth_turn = transform.clone();
            eighth_turn.angle += PI / 4.0;
            assert!(parcel_grid_pose(&frame, &eighth_turn).is_err());
            let mut wrong_angle = transform.clone();
            wrong_angle.angle += 4.0 * GRID_TOLERANCE_RADIANS;
            assert!(parcel_grid_pose(&frame, &wrong_angle).is_err());
        }
        let a = rect(0.0, 0.0, 2.0, 2.0)
            .iter()
            .map(|p| LocalPoint(*p))
            .collect::<Vec<_>>();
        let next = parcel_house_transform(
            &frame,
            &GridPose {
                x_cells: 4,
                y_cells: 0,
                quarter_turns: QuarterTurns(1),
            },
        )
        .unwrap();
        let previous = parcel_house_transform(
            &frame,
            &GridPose {
                x_cells: 0,
                y_cells: 0,
                quarter_turns: QuarterTurns(0),
            },
        )
        .unwrap();
        assert!(!interiors_intersect(
            &occupancy_world(std::slice::from_ref(&a), &previous),
            &occupancy_world(&[a], &next)
        )
        .unwrap());
    }
}

#[test]
fn basement_occupancy_and_owner_exception_are_symmetric() {
    let p = parcel(rect(20.0, 20.0, 10.0, 10.0));
    let cells = vec![crate::interior::Cell {
        floor: -1,
        x: 4,
        y: 4,
        room_id: "room-1".into(),
    }];
    assert!(contours(&cells).is_empty());
    let occupied = occupancy_contours(&cells);
    let t = Transform {
        x: 0.0,
        y: 0.0,
        angle: 0.0,
    };
    let placement = Placement::Free {};
    assert!(parcel_conflict(
        &p,
        Obstacle::House {
            id: "house-1",
            placement: &placement,
            contours: &[],
            occupancy_contours: &occupied,
            transform: &t
        }
    )
    .unwrap());
    assert!(house_conflict(&placement, &occupied, &t, Obstacle::Parcel(&p)).unwrap());
    // Hidden basements also block water; roof visibility is irrelevant to collision.
    assert!(house_conflict(&placement, &occupied, &t, Obstacle::Water(&p.polygon)).unwrap());
    assert!(house_conflict(
        &placement,
        &occupied,
        &t,
        Obstacle::House {
            id: "other",
            placement: &placement,
            contours: &[],
            occupancy_contours: &occupied,
            transform: &t
        }
    )
    .unwrap());
    let crossing = road(&[[15.0, 22.0], [35.0, 22.0]]);
    assert!(house_conflict(&placement, &occupied, &t, Obstacle::Road(&crossing)).unwrap());
    let owner = Placement::Parcel {
        parcel_id: p.id.clone(),
        grid_pose: GridPose {
            x_cells: 0,
            y_cells: 0,
            quarter_turns: QuarterTurns(0),
        },
    };
    assert!(!parcel_occupancy_conflict(&p, &owner, &occupied, &t).unwrap());
    assert!(covers_occupancy(&p, &occupied, &t).unwrap());
    assert!(!covers_occupancy(&p, &occupied, &Transform { x: 10.0, ..t }).unwrap());
}

#[test]
fn water_roads_and_round_road_caps_are_obstacles_but_boundary_contact_is_legal() {
    let r = road(&[[0.0, 0.0], [100.0, 0.0]]);
    assert!(!parcel_conflict(&parcel(rect(20.0, 5.0, 10.0, 10.0)), Obstacle::Road(&r)).unwrap());
    assert!(parcel_conflict(&parcel(rect(20.0, 4.0, 10.0, 10.0)), Obstacle::Road(&r)).unwrap());
    assert!(parcel_conflict(&parcel(rect(-4.0, -1.0, 1.0, 2.0)), Obstacle::Road(&r)).unwrap());
    assert!(parcel_conflict(
        &parcel(rect(0.0, 0.0, 10.0, 10.0)),
        Obstacle::Water(&rect(1.0, 1.0, 2.0, 2.0))
    )
    .unwrap());
}

#[test]
fn split_bezier_retains_section_identity_and_flattening_error_bound() {
    let control = [[0.0, 0.0], [80.0, -40.0], [140.0, 40.0], [240.0, 0.0]];
    let mut r = road(&[control[0], control[3]]);
    r.nodes[0].outgoing = Some(control[1]);
    r.nodes[1].incoming = Some(control[2]);
    let original = section_path(&r, "section-1").unwrap();
    let [left, right] = split_bezier(control, 0.413).unwrap();
    r.nodes[0].outgoing = Some(left[1]);
    r.nodes[1].incoming = Some(right[2]);
    r.nodes.insert(
        1,
        Node {
            id: "node-3".into(),
            point: left[3],
            incoming: Some(left[2]),
            outgoing: Some(right[1]),
        },
    );
    r.edge_sections.push("section-1".into());
    let split = section_path(&r, "section-1").unwrap();
    assert_eq!(r.nodes[0].id, "node-1");
    assert_eq!(r.nodes[2].id, "node-2");
    assert_eq!(r.sections.len(), 1);
    let distance_to = |p: Point, path: &[Point]| {
        path.windows(2)
            .map(|w| point_segment(p, w[0], w[1]))
            .fold(f64::INFINITY, f64::min)
    };
    for i in 0..=10_000 {
        let t = f64::from(i) / 10_000.0;
        let u = 1.0 - t;
        let p = add(
            add(mul(control[0], u * u * u), mul(control[1], 3.0 * u * u * t)),
            add(mul(control[2], 3.0 * u * t * t), mul(control[3], t * t * t)),
        );
        assert!(distance_to(p, &original) <= 0.05);
        assert!(distance_to(p, &split) <= 0.05);
    }
    for (a, b) in [(&original, &split), (&split, &original)] {
        for w in a.windows(2) {
            for i in 0..=10 {
                let p = add(w[0], mul(sub(w[1], w[0]), f64::from(i) / 10.0));
                assert!(distance_to(p, b) <= 0.10);
            }
        }
    }
    for side in [Side::Left, Side::Right] {
        let mut s = source(&r, side);
        if let ParcelSource::Road { start, end, .. } = &mut s {
            *start = 0.0;
            *end = 1.0;
        }
        let derived = derive_parcel(&r, &s).unwrap();
        assert_eq!(derived, derive_parcel(&r, &s).unwrap());
    }
    assert!(split_bezier(control, 0.0).is_err());
}

// Frozen pre-R2 section-path algorithm; compare independent outputs rather than
// comparing the new wrappers to their own PreparedRoadGeometry implementation.
fn reference_section_paths(road: &Road) -> Result<Vec<(String, Vec<Point>)>> {
    validate_road_identity(road)?;
    ensure(
        (2..=512).contains(&road.nodes.len()),
        "Straße benötigt 2–512 Punkte",
    )?;
    let mut paths: Vec<(String, Vec<Point>)> = vec![];
    let mut samples = 1;
    for (index, nodes) in road.nodes.windows(2).enumerate() {
        let mut path = vec![nodes[0].point];
        for node in nodes {
            ensure(
                valid_point(node.point)
                    && node.incoming.is_none_or(valid_point)
                    && node.outgoing.is_none_or(valid_point),
                "Ungültiger Straßenpunkt",
            )?;
        }
        geometry::flatten(
            nodes[0].point,
            nodes[0].outgoing.unwrap_or(nodes[0].point),
            nodes[1].incoming.unwrap_or(nodes[1].point),
            nodes[1].point,
            0,
            &mut path,
        )?;
        samples += path.len() - 1;
        ensure(samples <= MAX_SAMPLES, "Straße ist zu komplex")?;
        let id = &road.edge_sections[index];
        if paths.last().is_none_or(|(previous, _)| previous != id) {
            paths.push((id.clone(), vec![path[0]]));
        }
        let points = &mut paths.last_mut().unwrap().1;
        for point in path.into_iter().skip(1) {
            if distance(*points.last().unwrap(), point) >= EPS {
                points.push(point);
            }
        }
    }
    for (_, path) in &paths {
        ensure(path.len() >= 2, "Straßenabschnitt hat keine Länge")?;
    }
    Ok(paths)
}

#[test]
fn prepared_products_match_frozen_full_and_section_paths_at_zero_edges_and_section_boundaries() {
    for offset in [0.0, 4_900_000.0] {
        let mut r = road(&[
            [offset, 0.0],
            [offset, 0.0],
            [offset + 100.0, 10.0],
            [offset + 100.0, 10.0],
            [offset + 250.0, 0.0],
        ]);
        r.nodes[1].outgoing = Some([offset + 30.0, -15.0]);
        r.nodes[2].incoming = Some([offset + 80.0, 30.0]);
        r.edge_sections = vec![
            "section-b".into(),
            "section-b".into(),
            "section-a".into(),
            "section-a".into(),
        ];
        r.sections = vec![
            RoadSection {
                id: "section-a".into(),
                populated_sides: vec![],
            },
            RoadSection {
                id: "section-b".into(),
                populated_sides: vec![],
            },
        ];
        let prepared = PreparedRoadGeometry::new(&r).unwrap();
        assert_eq!(prepared.path(), road_path(&r.nodes).unwrap());
        assert_eq!(
            prepared
                .sections()
                .map(|(id, t)| (id.to_owned(), t.points().to_vec()))
                .collect::<Vec<_>>(),
            reference_section_paths(&r).unwrap()
        );
        assert_eq!(
            prepared.sections().map(|(id, _)| id).collect::<Vec<_>>(),
            vec!["section-b", "section-a"]
        );
    }
    // Near-duplicate samples straddle two edges; sections reset their retained
    // sample while full-path dedup keeps its previous sample across the join.
    let mut r = road(&[[0.0, 0.0], [EPS * 0.6, 0.0], [EPS * 1.2, 0.0], [20.0, 0.0]]);
    let prepared = PreparedRoadGeometry::new(&r).unwrap();
    assert_eq!(prepared.path(), road_path(&r.nodes).unwrap());
    assert_eq!(
        section_paths(&r).unwrap(),
        reference_section_paths(&r).unwrap()
    );
    r.nodes[1].outgoing = Some([4.0, 8.0]);
    assert_eq!(
        PreparedRoadGeometry::new(&r).unwrap().path(),
        road_path(&r.nodes).unwrap()
    );
    // A whole zero-length logical section must still be rejected.
    let mut r = road(&[[0.0, 0.0], [0.0, 0.0], [10.0, 0.0]]);
    r.edge_sections = vec!["zero".into(), "positive".into()];
    r.sections = vec![
        RoadSection {
            id: "zero".into(),
            populated_sides: vec![],
        },
        RoadSection {
            id: "positive".into(),
            populated_sides: vec![],
        },
    ];
    assert!(reference_section_paths(&r).is_err());
    assert!(PreparedRoadGeometry::new(&r).is_err());
}

#[test]
fn prepared_products_preserve_raw_road_sample_budget_across_sections() {
    let points: Vec<_> = (0..512).map(|i| [f64::from(i) * 100.0, 0.0]).collect();
    let mut r = road(&points);
    for (i, node) in r.nodes.iter_mut().enumerate() {
        node.incoming = Some([
            node.point[0] - 30.0,
            if i % 2 == 0 { 10_000.0 } else { -10_000.0 },
        ]);
        node.outgoing = Some([
            node.point[0] + 30.0,
            if i % 2 == 0 { -10_000.0 } else { 10_000.0 },
        ]);
    }
    r.edge_sections = (0..511).map(|i| format!("section-{i}")).collect();
    r.sections = r
        .edge_sections
        .iter()
        .map(|id| RoadSection {
            id: id.clone(),
            populated_sides: vec![],
        })
        .collect();
    assert!(road_path(&r.nodes).is_err());
    assert!(reference_section_paths(&r).is_err());
    assert!(PreparedRoadGeometry::new(&r).is_err());
    let mut r = road(&[[0.0, 0.0], [100.0, 0.0]]);
    for node in &mut r.nodes {
        node.incoming = Some([f64::NAN, 0.0]);
    }
    assert!(road_path(&r.nodes).is_err());
    assert!(reference_section_paths(&r).is_err());
    assert!(PreparedRoadGeometry::new(&r).is_err());
}
