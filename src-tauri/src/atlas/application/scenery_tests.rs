use super::application_test_support::*;
use super::*;
fn stroke() -> Value {
    json!({"type":"sceneryStroke","brush":{"biome":"forest","radius":30,"density":0.7,"size":8,"seed":17,"points":[[10,10],[70,30]]}})
}
#[test]
fn scenery_preview_atomic_history_delete_and_file_roundtrip() {
    let mut a = AtlasApplication::new().unwrap();
    let intent = stroke();
    let preview = request_edit(&mut a, "preview", intent.clone());
    assert_eq!(a.status().revision, 0);
    let committed = request_edit(&mut a, "commit", intent);
    assert_eq!(preview["objects"], committed["objects"]);
    let objects = a.all_scene_headers().unwrap();
    assert_eq!(objects.len(), 1);
    let SceneObject::Scenery(s) = &objects[0] else {
        panic!("missing scenery")
    };
    assert!(s.assets.len() > 1);
    let id = s.id.clone();
    history(&mut a, false);
    assert!(a.all_scene_headers().unwrap().is_empty());
    history(&mut a, true);
    assert_eq!(objects, a.all_scene_headers().unwrap());
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("scenery.saltatlas");
    a.save(&path).unwrap();
    a.open(&path).unwrap();
    assert_eq!(objects, a.all_scene_headers().unwrap());
    let overview = a
        .request("mapTiles", json!({"level":0,"tiles":[[0,0]]}))
        .unwrap();
    assert!(overview.to_string().contains("scenery"));
    request_edit(&mut a, "commit", json!({"type":"delete","id":id}));
    assert!(a.all_scene_headers().unwrap().is_empty());
    history(&mut a, false);
    assert_eq!(objects, a.all_scene_headers().unwrap());
}
#[test]
fn scenery_errors_leave_identity_and_document_unchanged() {
    let mut a = AtlasApplication::new().unwrap();
    let mut bad = stroke();
    bad["brush"]["size"] = json!(0);
    assert!(a
        .request("commit", json!({"version":a.status(),"intent":bad}))
        .is_err());
    assert_eq!(a.status().revision, 0);
    let result = request_edit(&mut a, "commit", stroke());
    assert_eq!(result["objects"][0]["id"], "scenery-1");
}
