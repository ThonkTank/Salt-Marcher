var script_class = "tool"

const REQUEST_PATH = "user://codex-selection-probe-request.json"
var elapsed = 0.0
var last_request_id = ""

func start():
    print("CODEX_SELECTION_PROBE " + to_json({
        "event": "ready",
        "active_mods": Script.GetActiveMods()
    }))

func update(delta):
    elapsed += delta
    if elapsed < 0.5:
        return
    elapsed = 0.0
    var file = File.new()
    if not file.file_exists(REQUEST_PATH):
        return
    if file.open(REQUEST_PATH, File.READ) != OK:
        print("CODEX_SELECTION_PROBE cannot open request")
        return
    var parsed = JSON.parse(file.get_as_text())
    file.close()
    if parsed.error != OK:
        print("CODEX_SELECTION_PROBE invalid request: " + parsed.error_string)
        return
    var request = parsed.result
    if request["id"] == last_request_id:
        return
    last_request_id = request["id"]
    var selection = Global.Editor.Tools["SelectTool"]
    var selected = []
    for node in selection.Selectables.keys():
        var detail = {
            "type": selection.Selectables[node],
            "node": str(node),
            "global_position": str(node.global_position),
            "global_rotation": node.global_rotation,
            "scale": str(node.scale)
        }
        if detail["type"] == 7:
            detail["polygon"] = str(node.polygon)
        selected.append(detail)
    print("CODEX_SELECTION_PROBE " + to_json({
        "event": "snapshot",
        "id": last_request_id,
        "fixture": request.get("fixture", ""),
        "active_mods": Script.GetActiveMods(),
        "filter": selection.Filter,
        "layer_filter": selection.LayerFilter,
        "is_drawing": selection.isDrawing,
        "transform_mode": selection.transformMode,
        "transform_corner": selection.transformCorner,
        "box_begin": str(selection.boxBegin),
        "box_end": str(selection.boxEnd),
        "selected": selected
    }))
