use super::*;
use crate::interior::{
    Axis, ConnectionKind, ConnectionShape, InteriorErrorCategory, StairDirection,
};

use crate::interior::test_support::House;

fn opening(axis: Axis) -> ConnectionShape {
    ConnectionShape::Opening {
        kind: ConnectionKind::Door,
        axis,
    }
}

#[test]
fn split_tie_uses_y_then_x_and_biggest_remainder_keeps_name() {
    let mut h = House::new();
    let id = h.room(0, &[(0, 0), (1, 0), (2, 0), (0, 1), (2, 1)]);
    h.rooms[0].name = "Kept".into();
    h.edit_room(RoomIntent::Erase {
        floor: 0,
        cells: vec![(1, 0)],
    });
    assert_eq!(
        h.rooms
            .iter()
            .map(|r| (&*r.id, &*r.name, r.created))
            .collect::<Vec<_>>(),
        vec![(&*id, "Kept", 0), ("room-1", "Raum 2", 1)]
    );
    assert_eq!(
        h.cells
            .iter()
            .filter(|c| c.room_id == id)
            .map(|c| (c.x, c.y))
            .collect::<BTreeSet<_>>(),
        BTreeSet::from([(0, 0), (0, 1)])
    );
    let mut h = House::new();
    h.room(0, &[(0, 0), (1, 0), (2, 0), (2, 1)]);
    h.edit_room(RoomIntent::Erase {
        floor: 0,
        cells: vec![(1, 0)],
    });
    assert_eq!(h.cells.iter().filter(|c| c.room_id == "room-0").count(), 2);
}

#[test]
fn merge_oldest_created_ignores_payload_order_and_neighbor_rooms() {
    let mut h = House::new();
    h.room(0, &[(0, 0)]);
    h.room(0, &[(2, 0)]);
    h.room(0, &[(3, 0)]);
    h.rooms.reverse();
    h.edit_room(RoomIntent::Draw {
        floor: 0,
        cells: vec![(0, 0), (1, 0), (2, 0)],
    });
    assert_eq!(
        h.rooms.iter().map(|r| r.id.as_str()).collect::<Vec<_>>(),
        vec!["room-0", "room-2"]
    );
    assert_eq!(h.cells.iter().filter(|c| c.room_id == "room-0").count(), 3);
}

#[test]
fn allocation_skips_original_ids_and_names_even_on_another_floor() {
    let mut h = House::new();
    h.room(0, &[(0, 0)]);
    h.room(1, &[(0, 0)]);
    h.rooms[1].id = "room-2".into();
    h.cells[1].room_id = "room-2".into();
    h.rooms[0].name = "Raum 4".into();
    h.rooms[1].name = "Raum 5".into();
    h.edit_room(RoomIntent::Draw {
        floor: 0,
        cells: vec![(4, 0)],
    });
    assert_eq!(
        (
            &*h.rooms[2].id,
            &*h.rooms[2].name,
            h.rooms[2].created,
            h.room_counter
        ),
        ("room-3", "Raum 6", 3, 4)
    );
}

#[test]
fn assignment_moves_only_occupied_selection_and_splits_sources() {
    let mut h = House::new();
    h.room(0, &[(0, 0), (1, 0), (2, 0)]);
    let target = h.room(0, &[(1, 1)]);
    h.edit_room(RoomIntent::Assign {
        floor: 0,
        cells: vec![(1, 0), (1, 0), (20, 20)],
        room_id: target.clone(),
    });
    assert_eq!(h.rooms.len(), 3);
    assert_eq!(h.cells.len(), 4);
    assert_eq!(h.cells.iter().filter(|c| c.room_id == target).count(), 2);
    assert!(!h.cells.iter().any(|c| c.x == 20));
    let before = h.clone();
    assert!(
        !h.edit_room(RoomIntent::Assign {
            floor: 0,
            cells: vec![(30, 30)],
            room_id: target
        })
        .changed
    );
    assert_eq!(h, before);
}

#[test]
fn selection_limits_precede_dedup_and_errors_leave_counters_unchanged() {
    let mut h = House::new();
    let id = h.room(0, &[(0, 0)]);
    for intent in [
        RoomIntent::Draw {
            floor: 0,
            cells: vec![(0, 0); 100_001],
        },
        RoomIntent::Erase {
            floor: 0,
            cells: vec![(0, 0); 100_001],
        },
        RoomIntent::Assign {
            floor: 0,
            cells: vec![(0, 0); 100_001],
            room_id: id.clone(),
        },
    ] {
        h.room_error(
            intent,
            "Too many selected cells",
            InteriorErrorCategory::InvalidInput,
        );
    }
    assert!(
        !h.edit_room(RoomIntent::Draw {
            floor: 0,
            cells: vec![(0, 0); 100_000]
        })
        .changed
    );
    h.room_error(
        RoomIntent::Draw {
            floor: i64::MAX,
            cells: vec![(0, 0); 100_001],
        },
        "Invalid floor",
        InteriorErrorCategory::InvalidInput,
    );
    h.room_error(
        RoomIntent::Draw {
            floor: 0,
            cells: vec![(1_000_001, 0)],
        },
        "Invalid coordinates",
        InteriorErrorCategory::InvalidInput,
    );
    h.room_error(
        RoomIntent::Draw {
            floor: 0,
            cells: vec![(4, 0), (6, 0)],
        },
        "Draw would create a disconnected room",
        InteriorErrorCategory::InvalidInput,
    );
    h.room_error(
        RoomIntent::Assign {
            floor: 0,
            cells: vec![(0, 0)],
            room_id: "missing".into(),
        },
        "Room not found",
        InteriorErrorCategory::InvalidInput,
    );
}

#[test]
fn canonical_noops_and_low_counters_follow_original_edit_semantics() {
    let mut h = House::new();
    let id = h.room(0, &[(1, 0), (0, 0)]);
    h.room_counter = -4;
    h.connection_counter = -3;
    let result = h.edit_room(RoomIntent::Draw {
        floor: 0,
        cells: vec![],
    });
    assert!(result.changed && result.cells_changed);
    assert_eq!((h.room_counter, h.connection_counter), (-4, -3));
    assert!(
        !h.edit_room(RoomIntent::Move {
            room_id: id.clone(),
            dx: 0,
            dy: 0
        })
        .changed
    );
    h.edit_room(RoomIntent::Rename {
        room_id: id,
        name: "Renamed".into(),
    });
    assert_eq!((h.room_counter, h.connection_counter), (1, 0));
}

#[test]
fn name_and_identity_exhaustion_are_storage_errors() {
    let mut h = House::new();
    h.room(0, &[(0, 0)]);
    h.room_counter = i64::MAX;
    h.room_error(
        RoomIntent::Draw {
            floor: 0,
            cells: vec![(4, 0)],
        },
        "Identity counter exhausted",
        InteriorErrorCategory::Storage,
    );
    h.room_counter = i64::MAX - 1;
    h.room_error(
        RoomIntent::Draw {
            floor: 0,
            cells: vec![(4, 0)],
        },
        "Name counter exhausted",
        InteriorErrorCategory::Storage,
    );
    h.room_counter = 1;
    h.room_error(
        RoomIntent::Rename {
            room_id: "missing".into(),
            name: " ".into(),
        },
        "Room name must contain 1 to 120 characters",
        InteriorErrorCategory::InvalidInput,
    );
    h.edit_room(RoomIntent::Rename {
        room_id: "room-0".into(),
        name: "💧".repeat(120),
    });
    h.room_error(
        RoomIntent::Rename {
            room_id: "room-0".into(),
            name: "💧".repeat(121),
        },
        "Room name must contain 1 to 120 characters",
        InteriorErrorCategory::InvalidInput,
    );
}

#[test]
fn move_self_overlap_no_merge_collision_overflow_and_large_grown_room() {
    let mut h = House::new();
    let id = h.room(0, &[(0, 0), (1, 0), (2, 0)]);
    h.room(0, &[(4, 0)]);
    h.edit_room(RoomIntent::Move {
        room_id: id.clone(),
        dx: 1,
        dy: 0,
    });
    assert_eq!(h.rooms.len(), 2);
    h.room_error(
        RoomIntent::Move {
            room_id: id.clone(),
            dx: 1,
            dy: 0,
        },
        "Room move collision",
        InteriorErrorCategory::InvalidInput,
    );
    h.room_error(
        RoomIntent::Move {
            room_id: id,
            dx: i64::MAX,
            dy: 0,
        },
        "Invalid room move",
        InteriorErrorCategory::InvalidInput,
    );
    let mut h = House::new();
    let id = h.room(0, &[(0, 0)]);
    for start in [1, 50_001] {
        h.edit_room(RoomIntent::Draw {
            floor: 0,
            cells: (start..start + 50_000).map(|x| (x, 0)).collect(),
        });
        // Draw touches the prior room explicitly; adjacency alone does not merge.
        if h.rooms.len() > 1 {
            h.edit_room(RoomIntent::Draw {
                floor: 0,
                cells: vec![(start - 1, 0), (start, 0)],
            });
        }
    }
    assert_eq!(h.cells.len(), 100_001);
    assert_eq!(h.rooms.len(), 1);
    h.edit_room(RoomIntent::Move {
        room_id: id,
        dx: 1,
        dy: -1,
    });
    assert_eq!(h.cells.len(), 100_001);
    assert_eq!(h.cells.first().map(|c| (c.x, c.y)), Some((1, -1)));
}

#[test]
fn move_translates_only_owned_exterior_doors_and_cleans_foreign_target_door() {
    let mut h = House::new();
    let a = h.room(0, &[(0, 0), (1, 0)]);
    let b = h.room(0, &[(4, 0)]);
    h.connection((&a, None), (0, 0, 0), opening(Axis::Horizontal), 0.5);
    h.connection((&b, None), (0, 4, 0), opening(Axis::Vertical), 0.0);
    h.edit_room(RoomIntent::Move {
        room_id: a,
        dx: 2,
        dy: 0,
    });
    assert_eq!(h.connections.len(), 1);
    assert_eq!(
        (
            h.connections[0].x,
            h.connections[0].y,
            h.connections[0].offset
        ),
        (2, 0, 0.5)
    );
}

#[test]
fn shape_edits_retarget_connections_and_remove_unsupported_half_offsets() {
    let mut h = House::new();
    let a = h.room(0, &[(0, 0), (1, 0), (2, 0)]);
    h.connection((&a, None), (0, 2, 1), opening(Axis::Horizontal), 0.0);
    h.connection((&a, None), (0, 0, 0), opening(Axis::Horizontal), 0.5);
    h.edit_room(RoomIntent::Erase {
        floor: 0,
        cells: vec![(1, 0)],
    });
    assert_eq!(h.connections.len(), 1);
    assert_eq!(h.connections[0].from_room, "room-1");
    h.edit_room(RoomIntent::Erase {
        floor: 0,
        cells: vec![(0, 0), (2, 0)],
    });
    assert!(h.rooms.is_empty() && h.cells.is_empty() && h.connections.is_empty());
}

#[test]
fn inner_doors_and_stairs_keep_move_positions_and_original_endpoints() {
    let mut h = House::new();
    let a = h.room(0, &[(0, 0), (1, 0), (2, 0)]);
    let b = h.room(0, &[(0, 1), (1, 1), (2, 1)]);
    let upper = h.room(1, &[(0, 0), (1, 0), (2, 0)]);
    h.connection((&a, Some(&b)), (0, 1, 1), opening(Axis::Horizontal), 0.0);
    h.connection(
        (&a, Some(&upper)),
        (0, 0, 0),
        ConnectionShape::Stairs {
            direction: StairDirection::East,
            length: 3,
        },
        0.0,
    );
    let original = h.clone();
    h.edit_room(RoomIntent::Move {
        room_id: a.clone(),
        dx: 0,
        dy: 0,
    });
    assert_eq!(h.connections, original.connections);
    h.edit_room(RoomIntent::Move {
        room_id: a,
        dx: 1,
        dy: 0,
    });
    assert_eq!(h.connections.len(), 1);
    assert_eq!(h.connections[0].id, "connection-0");
    assert_eq!((h.connections[0].x, h.connections[0].y), (1, 1));
}

#[test]
fn geometry_retargets_stairs_while_holes_remove_them() {
    let mut h = House::new();
    let first = h.room(0, &[(0, 0)]);
    let lower = h.room(0, &[(1, 0), (2, 0), (3, 0)]);
    let upper = h.room(1, &[(1, 0), (2, 0), (3, 0)]);
    h.connection(
        (&lower, Some(&upper)),
        (0, 1, 0),
        ConnectionShape::Stairs {
            direction: StairDirection::East,
            length: 3,
        },
        0.0,
    );
    h.edit_room(RoomIntent::Draw {
        floor: 0,
        cells: vec![(0, 0), (1, 0)],
    });
    assert_eq!(h.connections[0].from_room, first);
    h.edit_room(RoomIntent::Erase {
        floor: 1,
        cells: vec![(2, 0)],
    });
    assert!(h.connections.is_empty());
}
