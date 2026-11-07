use super::*;
use crate::atlas::{geometry::road_path, interior, Node, RoadSection};

fn road(length: f64) -> Road {
    let nodes = vec![
        Node {
            id: "node-1".into(),
            point: [0.0, 0.0],
            incoming: None,
            outgoing: None,
        },
        Node {
            id: "node-2".into(),
            point: [length, 0.0],
            incoming: None,
            outgoing: None,
        },
    ];
    Road {
        id: "road-1".into(),
        name: "Test".into(),
        width: 10.0,
        material: crate::atlas::model::RoadMaterial::Earth,
        path: road_path(&nodes).unwrap(),
        nodes,
        edge_sections: vec!["section-1-0".into()],
        sections: vec![RoadSection {
            id: "section-1-0".into(),
            populated_sides: vec![],
        }],
        population_recipe: None,
    }
}
fn settings() -> Settings {
    Settings {
        houses: None,
        layout: None,
        side: crate::atlas::population::PopulationSide::Both,
        setback: 5.0,
        gap: 10.0,
        min_width: 4,
        max_width: 7,
        min_depth: 4,
        max_depth: 8,
        seed: 1,
        parcel_depth: None,
    }
}
fn generate(road: &Road, settings: &Settings) -> GeneratedCandidates {
    generate_candidates(road, settings, 0, |_| Ok(vec![])).unwrap()
}

#[test]
fn fnv_and_lcg_v1_match_both_published_reference_vectors() {
    for (side, initial, expected) in [
        (
            Side::Left,
            2_947_722_742,
            [1_456_983_261, 2_727_962_776, 3_569_210_135],
        ),
        (
            Side::Right,
            2_964_500_361,
            [2_345_890_644, 3_646_113_443, 1_505_328_038],
        ),
    ] {
        assert_eq!(parcel_seed(1, "section-1-0", side), initial);
        let mut random = ParcelRandom::for_section_side(1, "section-1-0", side);
        assert_eq!(
            [random.next_u32(), random.next_u32(), random.next_u32()],
            expected
        );
    }
    assert_ne!(
        parcel_seed(1, "abc", Side::Left),
        parcel_seed(1, "abc\0", Side::Left)
    );
    assert_ne!(
        parcel_seed(1, "straße", Side::Left),
        parcel_seed(1, "strasse", Side::Left)
    );
}

fn fixed(width: u32, depth: u32) -> Settings {
    Settings {
        min_width: width,
        max_width: width,
        min_depth: depth,
        max_depth: depth,
        ..settings()
    }
}
fn at_front(slot: &ParcelSlot, gap: f64) -> SceneObject {
    let mut t = slot.geometry.frame.clone();
    // Fully outside the parcel, but closer than the generation-only gap.
    let (sin, cos) = t.angle.sin_cos();
    let back = gap.min(5.0) + 5.0;
    t.x += -back * -sin;
    t.y += -back * cos;
    let mut h = interior::new_house("house-obstacle".into(), t, 1, 1, 0).unwrap();
    h.placement = Placement::Free {};
    SceneObject::House(h.header())
}
fn limited(
    road: &Road,
    settings: &Settings,
    budget: usize,
    nearby: impl FnMut(&ParcelSlot) -> Result<Vec<SceneObject>>,
) -> GeneratedCandidates {
    generate_with_attempt_limit(
        road,
        &parcels::PreparedRoadGeometry::new(road).unwrap(),
        settings,
        0,
        nearby,
        budget,
    )
    .unwrap()
}
#[test]
fn odd_widths_and_canonical_geometry_both_sides() {
    for width in [1, 3, 5] {
        let mut s = fixed(width, 2);
        s.gap = 0.0;
        s.setback = 2.75;
        let r = road(300.0);
        let g = generate(&r, &s);
        assert!(g.diagnostics.is_empty(), "{:?}", g.diagnostics);
        for side in [Side::Left, Side::Right] {
            assert!(g
                .parcels
                .iter()
                .any(|p| p.slot.side == side && p.house.is_some()));
        }
        for accepted in g.parcels {
            let c = &accepted.slot;
            let h = accepted.house.unwrap();
            assert_eq!(h.grid_pose.x_cells, -i64::from(width / 2));
            assert_eq!(h.grid_pose.y_cells, 0);
            assert_eq!(h.grid_pose.quarter_turns, QuarterTurns(0));
            assert_eq!(c.geometry, parcels::derive_parcel(&r, &c.source).unwrap());
            assert!(parcels::covers_occupancy(
                &c.parcel("parcel-test".into()),
                &c.contours(),
                &h.transform
            )
            .unwrap());
            let ParcelSource::Road {
                start,
                end,
                depth,
                setback,
                ..
            } = c.source
            else {
                panic!("source")
            };
            assert!(((end - start) * 300.0 - 5.0 * f64::from(width + width % 2)).abs() < 1e-10);
            assert_eq!(depth, 10.0);
            assert_eq!(setback, 2.75);
        }
    }
}
#[test]
fn rejected_slots_never_shift_three_draws_or_other_side() {
    let r = road(1000.0);
    let s = settings();
    let all = generate(&r, &s);
    let rejected = generate_candidates(&r, &s, 0, |slot| {
        Ok(if slot.side == Side::Left && slot.slot < 3 {
            vec![SceneObject::Parcel(slot.parcel("parcel-obstacle".into()))]
        } else {
            vec![]
        })
    })
    .unwrap();
    assert_eq!(rejected.diagnostics.len(), 3);
    for candidate in &rejected.parcels {
        if let Some(original) = all
            .parcels
            .iter()
            .find(|p| p.slot.side == candidate.slot.side && p.slot.slot == candidate.slot.slot)
        {
            assert_eq!(candidate.slot.roof_index, original.slot.roof_index);
            if candidate.slot.side == Side::Right {
                assert_eq!(candidate, original);
            }
        }
    }
    assert!(rejected.parcels.iter().any(|p| matches!(p.slot.source, ParcelSource::Road { side: Side::Left, start, .. } if start < 0.01)));
    assert_eq!(all, generate(&r, &s));
    assert_eq!(
        (
            all.parcels[0].slot.width,
            all.parcels[0].slot.depth,
            all.parcels[0].slot.roof_index
        ),
        (5, 5, 3)
    );
    let mut other = s;
    other.seed = 2;
    assert_ne!(all.parcels, generate(&r, &other).parcels);
}
#[test]
fn sections_markers_and_new_start_preserve_original_streams() {
    let mut r = road(500.0);
    r.nodes.insert(
        0,
        Node {
            id: "node-3".into(),
            point: [-500.0, 0.0],
            incoming: None,
            outgoing: None,
        },
    );
    r.edge_sections.insert(0, "section-new".into());
    r.sections.push(RoadSection {
        id: "section-new".into(),
        populated_sides: vec![],
    });
    r.path = road_path(&r.nodes).unwrap();
    let g = generate(&r, &settings());
    assert_eq!(
        g.started_sides,
        vec![
            ("section-new".into(), Side::Left),
            ("section-new".into(), Side::Right),
            ("section-1-0".into(), Side::Left),
            ("section-1-0".into(), Side::Right)
        ]
    );
    let original = generate(&road(500.0), &settings());
    for candidate in g
        .parcels
        .iter()
        .filter(|c| c.slot.section_id == "section-1-0")
    {
        if let Some(p) = original
            .parcels
            .iter()
            .find(|p| p.slot.side == candidate.slot.side && p.slot.slot == candidate.slot.slot)
        {
            assert_eq!(p.slot.roof_index, candidate.slot.roof_index);
        }
    }
    for section in &mut r.sections {
        section.populated_sides = vec![Side::Left, Side::Right];
    }
    assert_eq!(generate(&r, &settings()), GeneratedCandidates::default());
}
#[test]
fn insufficient_depth_keeps_empty_parcels_without_pose_attempts() {
    let mut s = fixed(3, 2);
    s.gap = 0.0;
    s.parcel_depth = Some(5.0);
    let g = generate(&road(45.0), &s);
    assert_eq!(g.parcels.len(), 4);
    assert!(g.diagnostics.is_empty());
    assert!(
        g.parcels
            .iter()
            .all(|p| p.house.is_none()
                && p.unplaced == Some(generation::HouseUnplacedCode::NoGridFit))
    );
    assert_eq!(g.attempts, 6);
    assert_eq!(g.started_sides.len(), 2);
    assert_eq!(g.limit, None);
    s.parcel_depth = Some(10.0);
    assert_eq!(generate(&road(45.0), &s).house_count, 4);
    for depth in [Some(4.0), Some(2001.0), Some(f64::NAN)] {
        s.parcel_depth = depth;
        assert!(generate_candidates(&road(100.0), &s, 0, |_| Ok(vec![])).is_err());
    }
}
#[test]
fn finite_lazy_pose_order_including_far_intervals_and_world_epsilon() {
    let slot = generate(&road(100.0), &fixed(2, 2)).parcels.remove(0).slot;
    let mut slot = slot;
    slot.geometry.frame = Transform {
        x: 0.0,
        y: 0.0,
        angle: 0.0,
    };
    slot.geometry.polygon = vec![[-15.0, 0.0], [15.0, 0.0], [15.0, 15.0], [-15.0, 15.0]];
    let poses: Vec<_> = GridPoses::new(&slot)
        .map(|p| [p.x_cells, p.y_cells])
        .collect();
    assert_eq!(
        poses,
        vec![
            [-1, 0],
            [-1, 1],
            [-2, 0],
            [0, 0],
            [-2, 1],
            [0, 1],
            [-3, 0],
            [1, 0],
            [-3, 1],
            [1, 1]
        ]
    );
    slot.geometry.polygon = vec![
        [5e8, 0.0],
        [5e8 + 10.0, 0.0],
        [5e8 + 10.0, 10.0],
        [5e8, 10.0],
    ];
    assert_eq!(
        GridPoses::new(&slot).map(|p| p.x_cells).collect::<Vec<_>>(),
        vec![100_000_000]
    );
    slot.geometry.polygon = vec![
        [-5.0 + 1e-7, 0.0],
        [5.0 - 1e-7, 0.0],
        [5.0 - 1e-7, 10.0],
        [-5.0 + 1e-7, 10.0],
    ];
    assert_eq!(GridPoses::new(&slot).count(), 1);
}
#[test]
fn clearance_moves_inward_and_exhausted_search_keeps_clearance_empty() {
    let r = road(50.0);
    let mut s = fixed(2, 2);
    s.side = crate::atlas::population::PopulationSide::Right;
    s.parcel_depth = Some(40.0);
    let mut queries = 0;
    let g = generate_candidates(&r, &s, 0, |slot| {
        queries += 1;
        Ok(vec![at_front(slot, s.gap)])
    })
    .unwrap();
    assert_eq!(queries, g.parcels.len());
    assert!(g
        .parcels
        .iter()
        .all(|p| p.house.as_ref().unwrap().grid_pose.y_cells > 0));
    s.parcel_depth = Some(10.0);
    let g = generate_candidates(&r, &s, 0, |slot| Ok(vec![at_front(slot, s.gap)])).unwrap();
    assert!(g.parcels.is_empty());
    assert_eq!(g.limit, None);
}
#[test]
fn actual_bound_cell_and_attempt_budgets_keep_unbegun_sides_open() {
    let r = road(10_000.0);
    let s = settings();
    let g = generate_candidates(&r, &s, 199, |_| Ok(vec![])).unwrap();
    assert_eq!(g.parcels.len(), 1);
    assert_eq!(g.limit, Some(generation::GenerationLimit::BoundParcels));
    assert_eq!(g.started_sides, vec![("section-1-0".into(), Side::Left)]);
    let full = generate_candidates(&r, &s, 200, |_| Ok(vec![])).unwrap();
    assert!(full.parcels.is_empty());
    assert!(full.started_sides.is_empty());
    assert!(generate_candidates(&r, &s, 201, |_| Ok(vec![])).is_err());
    let cells = generate(&r, &fixed(64, 64));
    assert_eq!(cells.parcels.len(), 24);
    assert_eq!(cells.cell_count, 98_304);
    assert_eq!(cells.limit, Some(generation::GenerationLimit::NewCells));
    let mut empty = fixed(2, 2);
    empty.parcel_depth = Some(5.0);
    let g = generate(&r, &empty);
    assert_eq!(g.parcels.len(), 200);
    assert_eq!(g.house_count, 0);
    assert_eq!(g.limit, Some(generation::GenerationLimit::BoundParcels));
    let mut tiny = fixed(1, 1);
    tiny.gap = 0.0;
    let attempts = generate_candidates(&road(200_000.0), &tiny, 0, |slot| {
        Ok(vec![SceneObject::Parcel(slot.parcel("obstacle".into()))])
    })
    .unwrap();
    assert_eq!(attempts.attempts, MAX_ATTEMPTS);
    assert!(!attempts.diagnostics.is_empty());
    assert!(attempts.diagnostics.len() < MAX_ATTEMPTS);
    assert!(attempts.parcels.is_empty());
    assert_eq!(attempts.started_sides.len(), 1);
    assert_eq!(attempts.limit, Some(generation::GenerationLimit::Attempts));
}
#[test]
fn final_allowed_pose_completes_fit_or_empty_and_partial_slot_is_discarded() {
    let r = road(20.0);
    let mut s = fixed(2, 2);
    s.gap = 0.0;
    s.side = crate::atlas::population::PopulationSide::Right;
    let unbegun = limited(&r, &s, 0, |_| Ok(vec![]));
    assert!(unbegun.started_sides.is_empty());
    let begun = limited(&r, &s, 1, |_| Ok(vec![]));
    assert_eq!(begun.attempts, 1);
    assert_eq!(begun.started_sides.len(), 1);
    assert!(begun.parcels.is_empty());
    assert!(begun.diagnostics.is_empty());
    // Two slots, each exactly one pose: slot+pose consumes four attempts.
    let fit = limited(&r, &s, 4, |_| Ok(vec![]));
    assert_eq!(fit.parcels.len(), 2);
    assert_eq!(fit.limit, None);
    assert_eq!(fit.attempts, 4);
    let partial = limited(&r, &s, 3, |_| Ok(vec![]));
    assert_eq!(partial.parcels.len(), 1);
    assert_eq!(partial.limit, Some(generation::GenerationLimit::Attempts));
    assert!(partial.diagnostics.is_empty());
    // Each contained pose is clearance-blocked by a house outside the parcel.
    s.gap = 10.0;
    let r = road(40.0);
    s.parcel_depth = Some(10.0);
    s.layout = Some(
        (0..2)
            .map(|i| PlannedParcel {
                key: format!("explicit-{i}"),
                section: 0,
                side: Side::Right,
                start: f64::from(i) / 2.0,
                end: f64::from(i + 1) / 2.0,
                setback: s.setback,
                depth: 10.0,
                width: 2,
                house_depth: 2,
                roof_index: 0,
                excluded: false,
            })
            .collect(),
    );
    let full = generate_candidates(&r, &s, 0, |slot| Ok(vec![at_front(slot, s.gap)])).unwrap();
    assert_eq!(full.parcels.len(), 2);
    assert_eq!(full.house_count, 0);
    let exact = limited(&r, &s, full.attempts, |slot| {
        Ok(vec![at_front(slot, s.gap)])
    });
    assert_eq!(exact, full);
    let partial = limited(&r, &s, full.attempts - 1, |slot| {
        Ok(vec![at_front(slot, s.gap)])
    });
    assert_eq!(partial.parcels.len(), 1);
    assert_eq!(partial.limit, Some(generation::GenerationLimit::Attempts));
    // With no pose in the bounding range, even the last slot attempt completes.
    s.parcel_depth = Some(5.0);
    for p in s.layout.as_mut().unwrap() {
        p.depth = 5.0;
    }
    let nofit = limited(&r, &s, 2, |_| Ok(vec![]));
    assert_eq!(nofit.parcels.len(), 2);
    assert_eq!(nofit.limit, None);
}
#[test]
fn parcel_obstacles_include_basements_water_roads_and_empty_id_owners() {
    let r = road(100.0);
    let s = fixed(2, 2);
    let first = generate(&r, &s).parcels.remove(0);
    let slot = &first.slot;
    let p = slot.parcel(String::new());
    assert!(slot_conflict(&p, Obstacle::Parcel(&p)).unwrap());
    assert!(slot_conflict(&p, Obstacle::Water(&p.polygon)).unwrap());
    let contours = slot.contours();
    let t = &first.house.unwrap().transform;
    let placement = Placement::Parcel {
        parcel_id: String::new(),
        grid_pose: GridPose {
            x_cells: 0,
            y_cells: 0,
            quarter_turns: QuarterTurns(0),
        },
    };
    assert!(slot_conflict(
        &p,
        Obstacle::House {
            id: "",
            placement: &placement,
            contours: &[],
            occupancy_contours: &contours,
            transform: t
        }
    )
    .unwrap());
    assert!(!slot_conflict(&p, Obstacle::Road(&r)).unwrap());
}
#[test]
fn mirrored_mild_curves_populate_both_sides_with_inward_search() {
    let mut inward = false;
    for bend in [-1.0, 1.0] {
        let mut r = road(200.0);
        r.nodes[0].outgoing = Some([50.0, 20.0 * bend]);
        r.nodes[1].incoming = Some([150.0, 20.0 * bend]);
        r.path = road_path(&r.nodes).unwrap();
        let g = generate(&r, &settings());
        assert_eq!(g, generate(&r, &settings()));
        for side in [Side::Left, Side::Right] {
            assert!(
                g.parcels
                    .iter()
                    .any(|p| p.slot.side == side && p.house.is_some()),
                "{:?}",
                g
            );
        }
        for p in g.parcels {
            if let Some(h) = p.house {
                inward |= h.grid_pose.y_cells > 0;
                assert!(h.grid_pose.y_cells >= 0);
                assert_eq!(h.grid_pose.quarter_turns, QuarterTurns(0));
                assert_eq!(
                    p.slot.geometry,
                    parcels::derive_parcel(&r, &p.slot.source).unwrap()
                );
                assert!(parcels::covers_occupancy(
                    &p.slot.parcel("test".into()),
                    &p.slot.contours(),
                    &h.transform
                )
                .unwrap());
            }
        }
    }
    assert!(inward);
    let mut hairpin = road(20.0);
    hairpin.nodes.push(Node {
        id: "node-3".into(),
        point: [0.0, 1.0],
        incoming: None,
        outgoing: None,
    });
    hairpin.edge_sections.push("section-1-0".into());
    hairpin.path = road_path(&hairpin.nodes).unwrap();
    let mut s = fixed(6, 1);
    s.gap = 0.0;
    let g = generate(&hairpin, &s);
    assert!(g.parcels.is_empty());
    assert!(!g.diagnostics.is_empty());
}

#[test]
fn clearance_requires_lateral_shift_when_no_inward_pose_exists() {
    let mut s = fixed(2, 2);
    s.side = crate::atlas::population::PopulationSide::Right;
    s.parcel_depth = Some(10.0);
    let g = generate_candidates(&road(40.0), &s, 0, |slot| {
        let transform = parcels::parcel_house_transform(
            &slot.geometry.frame,
            &GridPose {
                x_cells: -3,
                y_cells: 0,
                quarter_turns: QuarterTurns(0),
            },
        )?;
        Ok(vec![SceneObject::House(
            interior::new_house("house-side".into(), transform, 1, 1, 0)?.header(),
        )])
    })
    .unwrap();
    assert_eq!(g.house_count, 2);
    for p in g.parcels {
        let pose = p.house.unwrap().grid_pose;
        assert_eq!(pose.x_cells, 0);
        assert_eq!(pose.y_cells, 0);
    }
}

#[test]
fn pose_iterator_matches_independent_tuple_sort_for_asymmetric_intervals() {
    let mut slot = generate(&road(20.0), &fixed(2, 2)).parcels.remove(0).slot;
    slot.geometry.frame = Transform {
        x: 0.0,
        y: 0.0,
        angle: 0.0,
    };
    for min_x in -5..=5 {
        for width in 0..=5 {
            for min_y in 0..=2 {
                let max_x = min_x + width;
                let max_y = min_y + 3;
                slot.geometry.polygon = vec![
                    [f64::from(min_x) * 5.0, f64::from(min_y) * 5.0],
                    [f64::from(max_x + 2) * 5.0, f64::from(min_y) * 5.0],
                    [f64::from(max_x + 2) * 5.0, f64::from(max_y + 2) * 5.0],
                    [f64::from(min_x) * 5.0, f64::from(max_y + 2) * 5.0],
                ];
                let mut expected = vec![];
                for x in min_x..=max_x {
                    for y in min_y..=max_y {
                        expected.push([i64::from(x), i64::from(y)]);
                    }
                }
                expected.sort_by_key(|p| ((p[0] + 1).abs(), p[1], p[0]));
                assert_eq!(
                    GridPoses::new(&slot)
                        .map(|p| [p.x_cells, p.y_cells])
                        .collect::<Vec<_>>(),
                    expected
                );
            }
        }
    }
}

#[test]
fn actual_ten_thousand_pose_budget_keeps_complete_prefix_and_queries_each_slot_once() {
    let mut s = fixed(2, 2);
    s.side = crate::atlas::population::PopulationSide::Right;
    s.gap = 1000.0;
    s.parcel_depth = Some(2000.0);
    let mut queries = 0;
    let g = generate_candidates(&road(2020.0), &s, 0, |slot| {
        queries += 1;
        if slot.slot == 0 {
            return Ok(vec![]);
        }
        // A legal foreign house touches the parcel's left edge from outside.
        // Its 2,000-foot roof blocks the central pose columns by clearance.
        let x = slot
            .geometry
            .polygon
            .iter()
            .map(|p| p[0])
            .fold(f64::INFINITY, f64::min)
            - 5.0;
        let transform = Transform {
            x,
            y: slot.geometry.frame.y,
            angle: 0.0,
        };
        Ok(vec![SceneObject::House(
            interior::new_house("house-long".into(), transform, 1, 400, 0)?.header(),
        )])
    })
    .unwrap();
    assert_eq!(queries, 2);
    assert_eq!(g.attempts, MAX_ATTEMPTS);
    assert_eq!(g.limit, Some(generation::GenerationLimit::Attempts));
    assert_eq!(g.parcels.len(), 1);
    assert_eq!(g.house_count, 1);
    assert_eq!(g.cell_count, 4);
    assert!(g.diagnostics.is_empty());
    assert_eq!(g.started_sides, vec![("section-1-0".into(), Side::Right)]);
}

#[test]
fn adaptive_population_uses_short_streets_and_final_remainders() {
    for length in [20.0, 25.0, 60.0, 65.0] {
        let g = generate(&road(length), &settings());
        for side in [Side::Left, Side::Right] {
            let houses: Vec<_> = g
                .parcels
                .iter()
                .filter(|p| p.slot.side == side && p.house.is_some())
                .collect();
            assert!(!houses.is_empty(), "length {length}, side {side:?}");
            let end = houses
                .iter()
                .map(|p| match p.slot.source {
                    ParcelSource::Road { end, .. } => end,
                    _ => unreachable!(),
                })
                .fold(0.0, f64::max);
            assert!((1.0 - end) * length < 20.0, "unused end at {length}: {end}");
        }
        assert_eq!(g.limit, None);
    }
}

#[test]
fn adaptive_population_reduces_plot_depth_before_discarding_buildable_frontage() {
    let r = road(40.0);
    let mut s = fixed(4, 4);
    s.side = PopulationSide::Right;
    s.parcel_depth = Some(80.0);
    let obstacle = SceneObject::Parcel(Parcel {
        id: "rear-obstacle".into(),
        source: ParcelSource::Detached {},
        polygon: vec![
            [-100.0, 40.0],
            [100.0, 40.0],
            [100.0, 100.0],
            [-100.0, 100.0],
        ],
        frame: Transform {
            x: 0.0,
            y: 40.0,
            angle: 0.0,
        },
    });
    let g = generate_candidates(&r, &s, 0, |_| Ok(vec![obstacle.clone()])).unwrap();
    assert_eq!(g.house_count, 1);
    assert!(matches!(g.parcels[0].slot.source, ParcelSource::Road { depth, .. } if depth <= 30.0));
}

#[test]
fn adaptive_population_handles_mirrored_bends_s_curves_and_sharp_corners() {
    for shape in 0..3 {
        for mirror in [-1.0, 1.0] {
            let mut r = road(180.0);
            match shape {
                0 => {
                    r.nodes[0].outgoing = Some([0.0, mirror * 180.0]);
                    r.nodes[1].incoming = Some([180.0, mirror * 180.0]);
                }
                1 => {
                    r.nodes[0].outgoing = Some([60.0, mirror * 180.0]);
                    r.nodes[1].incoming = Some([120.0, -mirror * 180.0]);
                }
                _ => {
                    r.nodes[1].point = [100.0, 0.0];
                    r.nodes.push(Node {
                        id: "corner-end".into(),
                        point: [100.0, mirror * 100.0],
                        incoming: None,
                        outgoing: None,
                    });
                    r.edge_sections.push(r.edge_sections[0].clone());
                }
            }
            r.path = road_path(&r.nodes).unwrap();
            let g = generate(&r, &settings());
            assert_eq!(g.limit, None, "shape {shape}, mirror {mirror}");
            assert_eq!(g, generate(&r, &settings()));
            for side in [Side::Left, Side::Right] {
                assert!(
                    g.parcels
                        .iter()
                        .filter(|p| p.slot.side == side && p.house.is_some())
                        .count()
                        >= 3,
                    "shape {shape}, mirror {mirror}, side {side:?}"
                );
            }
            for (i, p) in g.parcels.iter().enumerate() {
                let h = p.house.as_ref().unwrap();
                assert_eq!(
                    p.slot.geometry,
                    parcels::derive_parcel(&r, &p.slot.source).unwrap()
                );
                assert!(parcels::covers_occupancy(
                    &p.slot.parcel("test".into()),
                    &p.slot.contours(),
                    &h.transform
                )
                .unwrap());
                assert!(!house_conflict(&p.slot, &h.transform, Obstacle::Road(&r), 10.0).unwrap());
                for q in &g.parcels[..i] {
                    assert!(!parcels::parcel_conflict(
                        &p.slot.parcel("p".into()),
                        Obstacle::Parcel(&q.slot.parcel("q".into()))
                    )
                    .unwrap());
                    assert!(!parcels::occupancy_clearance(
                        &p.slot.contours(),
                        &h.transform,
                        &q.slot.contours(),
                        &q.house.as_ref().unwrap().transform,
                        10.0
                    )
                    .unwrap());
                }
            }
        }
    }
}

#[test]
fn adaptive_population_does_not_skip_a_house_sized_strip_after_an_obstacle() {
    let r = road(65.0);
    let mut s = fixed(4, 4);
    s.side = PopulationSide::Right;
    let obstacle = SceneObject::Parcel(Parcel {
        id: "front-obstacle".into(),
        source: ParcelSource::Detached {},
        polygon: vec![[0.0, 10.0], [22.5, 10.0], [22.5, 100.0], [0.0, 100.0]],
        frame: Transform {
            x: 0.0,
            y: 10.0,
            angle: 0.0,
        },
    });
    let g = generate_candidates(&r, &s, 0, |_| Ok(vec![obstacle.clone()])).unwrap();
    assert!(g.house_count > 0);
    assert!(
        matches!(g.parcels[0].slot.source, ParcelSource::Road { start, .. } if (start * 65.0 - 22.5).abs() < 1e-8)
    );
    assert_eq!(g.limit, None);
}

#[test]
fn adaptive_population_fits_inside_a_tight_quarter_circle() {
    for mirror in [-1.0, 1.0] {
        let mut r = road(60.0);
        r.nodes[1].point = [60.0, mirror * 60.0];
        r.nodes[0].outgoing = Some([33.137, 0.0]);
        r.nodes[1].incoming = Some([60.0, mirror * 26.863]);
        r.path = road_path(&r.nodes).unwrap();
        let g = generate(&r, &settings());
        for side in [Side::Left, Side::Right] {
            assert!(
                g.parcels
                    .iter()
                    .any(|p| p.slot.side == side && p.house.is_some()),
                "mirror {mirror}, side {side:?}"
            );
        }
        assert_eq!(g.limit, None);
    }
}

#[test]
fn adaptive_population_uses_widened_frontage_of_a_short_outside_bend() {
    let mut r = road(5.0);
    r.width = 2.0;
    r.nodes[1].point = [5.0, 5.0];
    r.nodes[0].outgoing = Some([2.761, 0.0]);
    r.nodes[1].incoming = Some([5.0, 2.239]);
    r.path = road_path(&r.nodes).unwrap();
    let mut s = fixed(2, 1);
    s.side = PopulationSide::Left;
    s.gap = 0.0;
    s.parcel_depth = Some(20.0);
    let g = generate(&r, &s);
    assert_eq!(g.house_count, 1);
    assert_eq!(g.limit, None);
}
