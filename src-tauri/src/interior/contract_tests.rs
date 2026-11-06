use super::*;
use serde_json::{json, Value};

fn roundtrip<T: serde::Serialize + serde::de::DeserializeOwned>(wire: Value) {
    let value: T = serde_json::from_value(wire.clone()).unwrap();
    assert_eq!(serde_json::to_value(value).unwrap(), wire);
}
#[test]
fn model_wire_fields_shapes_offsets_and_nullable_room_are_unchanged() {
    roundtrip::<Room>(
        json!({"id":"room-7","name":"Raum","floor":-1,"buildingId":"house-real","created":7}),
    );
    roundtrip::<Cell>(json!({"floor":-1,"x":-2,"y":3,"roomId":"room-7"}));
    for axis in ["horizontal", "vertical"] {
        for kind in ["door", "passage"] {
            let shape = json!({"type":"opening","kind":kind,"axis":axis});
            roundtrip::<ConnectionShape>(shape);
            for to_room in [Value::Null, json!("room-8")] {
                let base = json!({"id":"connection-9","created":9,"fromRoom":"room-7","toRoom":to_room,"floor":-1,"x":-2,"y":3,"type":"opening","kind":kind,"axis":axis});
                roundtrip::<Connection>(base.clone());
                for offset in [0.0, 0.5] {
                    let mut wire = base.clone();
                    wire["offset"] = json!(offset);
                    roundtrip::<InteriorConnection>(wire);
                }
            }
        }
    }
    for direction in ["north", "east", "south", "west"] {
        roundtrip::<ConnectionShape>(json!({"type":"stairs","direction":direction,"length":3}));
        roundtrip::<StairGeometry>(
            json!({"floor":-1,"x":-2,"y":3,"direction":direction,"length":64}),
        );
        let base = json!({"id":"connection-9","created":9,"fromRoom":"room-7","toRoom":"room-8","floor":-1,"x":-2,"y":3,"type":"stairs","direction":direction,"length":3});
        roundtrip::<Connection>(base.clone());
        let mut wire = base;
        wire["offset"] = json!(0.0);
        roundtrip::<InteriorConnection>(wire);
    }
}
#[test]
fn intent_fields_defaults_and_strict_authored_values() {
    for kind in ["draw", "erase"] {
        roundtrip::<RoomIntent>(json!({"kind":kind,"floor":-1,"cells":[[2,3]]}));
    }
    roundtrip::<RoomIntent>(json!({"kind":"assign","floor":-1,"cells":[[2,3]],"roomId":"room-7"}));
    roundtrip::<RoomIntent>(json!({"kind":"rename","roomId":"room-7","name":"Keller"}));
    roundtrip::<RoomIntent>(json!({"kind":"move","roomId":"room-7","dx":-2,"dy":3}));
    roundtrip::<ConnectionIntent>(
        json!({"action":"createOpening","floor":-1,"x":2,"y":3,"kind":"door","axis":"horizontal"}),
    );
    roundtrip::<ConnectionIntent>(
        json!({"action":"convert","connectionId":"connection-9","kind":"passage"}),
    );
    roundtrip::<ConnectionIntent>(json!({"action":"delete","connectionId":"connection-9"}));
    let missing = json!({"action":"createStairs","floor":-1,"x":2,"y":3,"direction":"east"});
    let value: ConnectionIntent = serde_json::from_value(missing.clone()).unwrap();
    let mut explicit = missing;
    explicit["length"] = json!(3);
    assert_eq!(serde_json::to_value(value).unwrap(), explicit);
    roundtrip::<ConnectionIntent>(explicit);
    assert!(
        serde_json::from_value::<ConnectionShape>(json!({"type":"stairs","direction":"east"}))
            .is_err()
    );
    assert!(serde_json::from_value::<StairGeometry>(
        json!({"floor":0,"x":0,"y":0,"direction":"east"})
    )
    .is_err());
    assert!(serde_json::from_value::<ConnectionIntent>(
        json!({"action":"createStairs","floor":0,"x":0,"y":0,"toFloor":1,"toX":2,"toY":0})
    )
    .is_err());
    let unknown_room_field =
        json!({"id":"r","name":"R","floor":0,"buildingId":"h","created":0,"extra":true});
    assert!(serde_json::from_value::<Room>(unknown_room_field).is_err());
}
#[test]
fn component_order_uses_size_then_smallest_y_x_and_four_neighbors() {
    let cells = [(8, 0), (9, 0), (0, 2), (1, 2), (-1, -1), (5, 5), (6, 6)]
        .into_iter()
        .collect();
    let parts = cell_components(&cells);
    assert_eq!(
        parts,
        vec![
            [(8, 0), (9, 0)].into_iter().collect(),
            [(0, 2), (1, 2)].into_iter().collect(),
            [(-1, -1)].into_iter().collect(),
            [(5, 5)].into_iter().collect(),
            [(6, 6)].into_iter().collect()
        ]
    );
}
