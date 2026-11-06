//! Shared fixture serializer for the explicit update command (not a wire dispatcher).
use serde::Serialize;
use serde_json::{json, Value};
pub fn update_road(road: &impl Serialize) -> Value {
    let r = serde_json::to_value(road).unwrap();
    json!({"type":"updateRoad", "roadId":r["id"], "road":{
        "name":r["name"], "width":r["width"], "material":r["material"],
        "nodes":r["nodes"]
    }})
}
