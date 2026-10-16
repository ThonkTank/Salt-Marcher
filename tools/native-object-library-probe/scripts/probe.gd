var script_class = "tool"

const REQUEST_PATH = "user://codex-object-library-probe-request.json"
var elapsed = 0.0
var last_request_id = ""

func start():
    print("CODEX_OBJECT_LIBRARY_PROBE " + to_json({
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
        return
    var parsed = JSON.parse(file.get_as_text())
    file.close()
    if parsed.error != OK:
        print("CODEX_OBJECT_LIBRARY_PROBE invalid request")
        return
    var request = parsed.result
    if request["id"] == last_request_id:
        return
    last_request_id = request["id"]
    if request.get("mode", "") != "items":
        return
    var menu = Global.Editor.get_node("VPartition/Panels/HSplit/ObjectLibraryPanel/Margins/VAlign/ObjectsMenu")
    var item_count = menu.get_item_count()
    var items = []
    for index in range(item_count):
        var icon = menu.get_item_icon(index)
        var entry = {
            "index": index,
            "text": menu.get_item_text(index),
            "metadata": str(menu.get_item_metadata(index)),
            "selected": menu.is_selected(index),
            "icon_path": icon.resource_path if icon != null else ""
        }
        if request.get("full", false) or index < 4 or index >= item_count - 4 or index == int(item_count / 2):
            items.append(entry)
    print("CODEX_OBJECT_LIBRARY_PROBE " + to_json({
        "event": "items", "id": last_request_id,
        "active_mods": Script.GetActiveMods(),
        "count": item_count, "items": items
    }))
