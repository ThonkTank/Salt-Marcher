use super::application_test_support::*;
use super::*;

#[test]
fn change_hint_order_is_stable_across_repeated_multi_house_deltas() {
    let after = ["house-z", "house-a", "house-m", "house-b"]
        .into_iter()
        .map(|id| {
            let mut house = fixture();
            house.id = id.into();
            FullObject::House(house)
        })
        .collect();
    let delta = Delta {
        before: vec![],
        after,
    };
    let first = serde_json::to_value(changes(&delta)).unwrap();
    for _ in 0..32 {
        assert_eq!(serde_json::to_value(changes(&delta)).unwrap(), first);
    }
    assert_eq!(
        first["metadata"],
        json!(["house-a", "house-b", "house-m", "house-z"])
    );
}
#[test]
fn precise_hints_cover_cell_ownership_metadata_and_house_lifecycle() {
    let old = fixture();
    let mut edited = old.clone();
    edited.cells.retain(|c| (c.floor, c.x, c.y) != (0, 2, 3));
    edited
        .cells
        .iter_mut()
        .find(|c| (c.floor, c.x, c.y) == (0, 7, 8))
        .unwrap()
        .room_id = "new-room".into();
    let h = hints(Some(&old), Some(&edited));
    assert_coverage(Some(&old), Some(&edited), &h);
    assert_eq!(h.interiors.len(), 1);
    assert_eq!(h.interiors[0].floor, 0);
    assert_eq!(h.interiors[0].bounds, [2.0, 3.0, 7.0, 8.0]);
    assert!(h.metadata.is_empty());
    let reversed = hints(Some(&edited), Some(&old));
    assert_coverage(Some(&edited), Some(&old), &reversed);
    assert_eq!(
        serde_json::to_value(&h).unwrap(),
        serde_json::to_value(&reversed).unwrap()
    );
    for (a, b) in [(None, Some(&old)), (Some(&old), None)] {
        let h = hints(a, b);
        assert_coverage(a, b, &h);
        assert_eq!(h.interiors.len(), 3);
    }
    let mut meta = old.clone();
    meta.rooms[0].name = "Basement".into();
    let h = hints(Some(&old), Some(&meta));
    assert_coverage(Some(&old), Some(&meta), &h);
    assert!(h.interiors.is_empty());
    meta = old.clone();
    meta.connections.push(InteriorConnection {
        base: crate::interior::Connection {
            id: "door".into(),
            created: 0,
            from_room: "r0".into(),
            to_room: None,
            floor: 0,
            x: 0,
            y: 0,
            shape: crate::interior::ConnectionShape::Opening {
                kind: crate::interior::ConnectionKind::Door,
                axis: crate::interior::Axis::Vertical,
            },
        },
        offset: 0.0,
    });
    let h = hints(Some(&old), Some(&meta));
    assert_coverage(Some(&old), Some(&meta), &h);
    assert!(h.interiors.is_empty());
    let mut moved = old.clone();
    moved.transform.x = 10.0;
    let h = hints(Some(&old), Some(&moved));
    assert_coverage(Some(&old), Some(&moved), &h);
    assert!(h.interiors.is_empty() && h.metadata.is_empty());
    assert_eq!(h.world.len(), 2);
}
#[test]
fn status_hints_follow_commit_undo_redo_and_branch() {
    let mut a = AtlasApplication::new().unwrap();
    let id = request_edit(
        &mut a,
        "commit",
        json!({"type":"createHouse","parcelId":null,"transform":{"x":0,"y":0,"angle":0},"width":4,"depth":4}),
    )["objects"][0]["id"]
        .as_str()
        .unwrap()
        .to_owned();
    assert_eq!(a.status().changes.unwrap().interiors.len(), 1);
    let action =
        json!({"type":"room","buildingId":id,"intent":{"kind":"draw","floor":0,"cells":[[4,3]]}});
    request_edit(&mut a, "commit", action);
    let committed = serde_json::to_value(a.status().changes.unwrap()).unwrap();
    assert_eq!(
        committed["interiors"][0]["bounds"],
        json!([4.0, 3.0, 4.0, 3.0])
    );
    history(&mut a, false);
    let undone = serde_json::to_value(a.status().changes.unwrap()).unwrap();
    assert_eq!(undone["interiors"], committed["interiors"]);
    assert_eq!(undone["metadata"], committed["metadata"]);
    assert_eq!(undone["world"][0], committed["world"][1]);
    assert_eq!(undone["world"][1], committed["world"][0]);
    history(&mut a, true);
    assert_eq!(
        serde_json::to_value(a.status().changes.unwrap()).unwrap(),
        committed
    );
    history(&mut a, false);
    request_edit(
        &mut a,
        "commit",
        json!({"type":"room","buildingId":id,"intent":{"kind":"rename","roomId":"room-0","name":"Kitchen"}}),
    );
    let branch = a.status();
    assert!(!branch.can_redo);
    assert!(branch.changes.as_ref().unwrap().interiors.is_empty());
    assert_eq!(branch.changes.unwrap().metadata, vec![id.clone()]);
    request_edit(&mut a, "commit", json!({"type":"delete", "id":id}));
    let deleted = serde_json::to_value(a.status().changes.unwrap()).unwrap();
    assert_eq!(
        deleted["interiors"][0]["bounds"],
        json!([0.0, 0.0, 3.0, 3.0])
    );
    assert_eq!(deleted["metadata"], json!([id]));
    history(&mut a, false);
    let restored = serde_json::to_value(a.status().changes.unwrap()).unwrap();
    assert_eq!(restored["interiors"], deleted["interiors"]);
    assert_eq!(restored["metadata"], deleted["metadata"]);
    history(&mut a, true);
    assert_eq!(
        serde_json::to_value(a.status().changes.unwrap()).unwrap(),
        deleted
    );
}
