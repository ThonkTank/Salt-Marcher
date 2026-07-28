extends SceneTree

const ItemImportService = preload("res://godot/src/features/items/item_import_service.gd")

var _data_root := "user://salt-marcher"


func _init() -> void:
	for argument in OS.get_cmdline_user_args():
		if argument.begins_with("--data-root="):
			_data_root = argument.trim_prefix("--data-root=").strip_edges()
	if _data_root.is_empty():
		push_error("Items-Import benötigt ein nicht-leeres --data-root.")
		quit(2)
		return
	call_deferred("_run_import")


func _run_import() -> void:
	print("Lade den vollständigen öffentlichen 2014-SRD-Items-Korpus …")
	var result := ItemImportService.new(_data_root).import_public_corpus(_on_fetch_progress)
	if not result.get("ok", false):
		push_error("Items-Import fehlgeschlagen [%s]: %s" % [
			str(result.get("status", "failure")),
			str(result.get("error", "Unbekannter Fehler.")),
		])
		quit(1)
		return
	print("Items-Import veröffentlicht: %d Equipment, %d Magic Items, Generation %d" % [
		int(result["equipment_count"]),
		int(result["magic_item_count"]),
		int(result["shared_definitions_generation"]),
	])
	quit(0)


func _on_fetch_progress(completed: int, total: int) -> void:
	if completed == total or completed % 25 == 0:
		print("Item-Details geladen: %d/%d" % [completed, total])
