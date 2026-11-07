use crate::interior::*;

use crate::interior::test_support::House;

fn opening(x: i64, y: i64, axis: Axis) -> ConnectionIntent {
    ConnectionIntent::CreateOpening {
        floor: 0,
        x,
        y,
        axis,
        kind: ConnectionKind::Door,
    }
}
fn stairs(floor: i64, x: i64, y: i64, direction: StairDirection, length: u8) -> ConnectionIntent {
    ConnectionIntent::CreateStairs {
        floor,
        x,
        y,
        direction,
        length,
    }
}

#[test]
fn openings_on_both_sides_and_axes_keep_exact_endpoints() {
    for (axis, a, b, anchor) in [
        (Axis::Vertical, (0, 0), (1, 0), (1, 0)),
        (Axis::Horizontal, (0, 0), (0, 1), (0, 1)),
    ] {
        let mut h = House::new();
        h.room(0, &[a]);
        h.room(0, &[b]);
        h.edit_connection(opening(anchor.0, anchor.1, axis.clone()));
        let c = &h.connections[0];
        assert_eq!(
            (&*c.from_room, c.to_room.as_deref(), c.offset),
            ("room-1", Some("room-0"), 0.0)
        );
        for p in [(-1, 0), (2, 0)] {
            let mut exterior = House::new();
            let cell = if axis == Axis::Vertical {
                (p.0, 0)
            } else {
                (0, p.0)
            };
            exterior.room(0, &[cell]);
            let edge = if axis == Axis::Vertical {
                (p.1, 0)
            } else {
                (0, p.1)
            };
            // p=(-1,0) uses the negative side of edge 0; p=(2,0) is replaced below.
            let edge = if p.0 == 2 { cell } else { edge };
            exterior.edit_connection(opening(edge.0, edge.1, axis.clone()));
            assert_eq!(exterior.connections[0].from_room, "room-0");
            assert_eq!(exterior.connections[0].to_room, None);
        }
    }
}

#[test]
fn create_convert_noop_delete_preserve_identity_offset_and_counters() {
    let mut h = House::new();
    h.room(0, &[(0, 0), (1, 0), (2, 0)]);
    h.edit_connection(opening(0, 0, Axis::Horizontal));
    assert_eq!(
        (
            h.connections[0].id.as_str(),
            h.connections[0].created,
            h.connection_counter
        ),
        ("connection-0", 0, 1)
    );
    h.connections[0].offset = 0.5;
    let convert = ConnectionIntent::Convert {
        connection_id: "connection-0".into(),
        kind: ConnectionKind::Passage,
    };
    assert!(h.edit_connection(convert.clone()).changed);
    assert_eq!(
        (
            h.connections[0].created,
            h.connections[0].offset,
            h.connection_counter
        ),
        (0, 0.5, 1)
    );
    assert!(!h.edit_connection(convert).changed);
    h.edit_connection(ConnectionIntent::Delete {
        connection_id: "connection-0".into(),
    });
    assert!(h.connections.is_empty());
    assert_eq!(h.connection_counter, 1);
    h.connection_error(
        ConnectionIntent::Delete {
            connection_id: "connection-0".into(),
        },
        "Connection not found",
        InteriorErrorCategory::InvalidInput,
    );
}

#[test]
fn duplicate_precedes_wall_and_allocation_and_half_overlap_is_atomic() {
    let mut h = House::new();
    h.room(0, &[(0, 0), (1, 0), (2, 0)]);
    h.edit_connection(opening(0, 0, Axis::Horizontal));
    h.connections[0].offset = 0.5;
    h.connection_counter = i64::MAX;
    h.connection_error(
        opening(0, 0, Axis::Horizontal),
        "Duplicate wall opening",
        InteriorErrorCategory::InvalidInput,
    );
    h.connection_counter = 1;
    h.connection_error(
        opening(1, 0, Axis::Horizontal),
        "Überlappende Wandöffnungen",
        InteriorErrorCategory::InvalidInput,
    );
    h.edit_connection(opening(2, 0, Axis::Horizontal));
    assert_eq!(
        (h.connections[1].id.as_str(), h.connections[1].offset),
        ("connection-1", 0.0)
    );
}

#[test]
fn noops_canonicalize_without_repairing_low_counters() {
    let mut h = House::new();
    h.room(0, &[(0, 0), (1, 0)]);
    h.edit_connection(opening(0, 0, Axis::Horizontal));
    h.room_counter = -8;
    h.connection_counter = -9;
    h.cells.reverse();
    let same = ConnectionIntent::Convert {
        connection_id: "connection-0".into(),
        kind: ConnectionKind::Door,
    };
    assert!(h.edit_connection(same.clone()).changed);
    assert_eq!((h.room_counter, h.connection_counter), (-8, -9));
    assert!(!h.edit_connection(same).changed);
    h.edit_connection(ConnectionIntent::Convert {
        connection_id: "connection-0".into(),
        kind: ConnectionKind::Passage,
    });
    assert_eq!((h.room_counter, h.connection_counter), (1, 1));
}

#[test]
fn syntactic_ids_are_skipped_and_counter_exhaustion_is_storage_compatible() {
    let mut h = House::new();
    h.room(0, &[(0, 0), (1, 0), (2, 0)]);
    h.edit_connection(opening(0, 0, Axis::Horizontal));
    h.connections[0].base.id = "connection-1".into();
    h.edit_connection(opening(1, 0, Axis::Horizontal));
    assert_eq!(
        (
            h.connections[1].id.as_str(),
            h.connections[1].created,
            h.connection_counter
        ),
        ("connection-2", 2, 3)
    );
    h.connection_counter = i64::MAX;
    h.connection_error(
        opening(2, 0, Axis::Horizontal),
        "Identity counter exhausted",
        InteriorErrorCategory::Storage,
    );
}

#[test]
fn stair_directions_lengths_and_basement_full_footprints() {
    for direction in [
        StairDirection::North,
        StairDirection::East,
        StairDirection::South,
        StairDirection::West,
    ] {
        for length in [2, 3, 64] {
            let geometry = StairGeometry {
                floor: -1,
                x: 10,
                y: 20,
                direction,
                length,
            };
            let footprint = geometry.footprint().unwrap();
            let points: Vec<_> = footprint
                .iter()
                .take(usize::from(length))
                .map(|&(_, x, y)| (x, y))
                .collect();
            let mut h = House::new();
            h.room(-1, &points);
            h.room(0, &points);
            h.edit_connection(stairs(-1, 10, 20, direction, length));
            let c = &h.connections[0];
            assert_eq!(
                (
                    c.from_room.as_str(),
                    c.to_room.as_deref(),
                    c.floor,
                    c.offset
                ),
                ("room-0", Some("room-1"), -1, 0.0)
            );
            assert_eq!(c.stair_geometry().unwrap(), geometry);
            h.connection_error(
                ConnectionIntent::Convert {
                    connection_id: c.id.clone(),
                    kind: ConnectionKind::Door,
                },
                "Only doors and passages can be converted",
                InteriorErrorCategory::InvalidInput,
            );
        }
    }
}

#[test]
fn stairs_reject_holes_and_multiple_rooms_on_either_floor() {
    for floor in [0, 1] {
        let mut h = House::new();
        let full = [(0, 0), (1, 0), (2, 0), (0, 1), (1, 1), (2, 1)];
        let hole = [(0, 0), (2, 0), (0, 1), (1, 1), (2, 1)];
        h.room(0, if floor == 0 { &hole } else { &full });
        h.room(1, if floor == 1 { &hole } else { &full });
        h.connection_error(
            stairs(0, 0, 0, StairDirection::East, 3),
            "Stairs require occupied footprints",
            InteriorErrorCategory::InvalidInput,
        );
        h.room(floor, &[(1, 0)]);
        h.connection_error(
            stairs(0, 0, 0, StairDirection::East, 3),
            "Stair footprint must lie in one room per floor",
            InteriorErrorCategory::InvalidInput,
        );
    }
}

#[test]
fn stair_overlap_on_single_shared_floor_and_delete_releases_footprint() {
    let mut h = House::new();
    for floor in [-1, 0, 1] {
        h.room(floor, &[(0, 0), (1, 0), (2, 0)]);
    }
    h.edit_connection(stairs(-1, 0, 0, StairDirection::East, 3));
    h.connection_error(
        stairs(0, 0, 0, StairDirection::East, 3),
        "Stair footprints overlap",
        InteriorErrorCategory::InvalidInput,
    );
    h.edit_connection(ConnectionIntent::Delete {
        connection_id: "connection-0".into(),
    });
    h.edit_connection(stairs(0, 0, 0, StairDirection::East, 3));
    assert_eq!(h.connections[0].id, "connection-1");
}

#[test]
fn intent_geometry_errors_precede_counter_exhaustion_and_do_not_mutate() {
    let mut h = House::new();
    h.room(0, &[(0, 0), (1, 0)]);
    h.connection_counter = i64::MAX;
    h.connection_error(
        opening(1, 0, Axis::Vertical),
        "Opening must border distinct rooms or exterior",
        InteriorErrorCategory::InvalidInput,
    );
    h.connection_error(
        opening(100, 100, Axis::Vertical),
        "Opening must border distinct rooms or exterior",
        InteriorErrorCategory::InvalidInput,
    );
    h.connection_error(
        opening(i64::MIN, 0, Axis::Vertical),
        "Invalid opening",
        InteriorErrorCategory::InvalidInput,
    );
    for length in [1, 65] {
        h.connection_error(
            stairs(0, 0, 0, StairDirection::East, length),
            "Invalid stair geometry",
            InteriorErrorCategory::InvalidInput,
        );
    }
    h.connection_error(
        stairs(i64::from(i32::MAX), 0, 0, StairDirection::East, 2),
        "Invalid stair floor",
        InteriorErrorCategory::InvalidInput,
    );
    h.connection_error(
        stairs(0, i64::MAX, 0, StairDirection::East, 2),
        "Invalid stair coordinates",
        InteriorErrorCategory::InvalidInput,
    );
}
