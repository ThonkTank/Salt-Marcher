extends SceneTree

const CreatureImportService = preload("res://godot/src/features/creatures/creature_import_service.gd")

var _data_root := "user://salt-marcher"


func _init() -> void:
	for argument in OS.get_cmdline_user_args():
		if argument.begins_with("--data-root="):
			_data_root = argument.trim_prefix("--data-root=")
	call_deferred("_run")


func _run() -> void:
	print("Monster-Import · Open5e V2 · srd-2014")
	var result := CreatureImportService.new(_data_root).import_public_corpus(_on_progress)
	if result.get("ok", false):
		print("Importiert: %d Monster · Shared Definitions Generation %d" % [
			int(result.get("creature_count", 0)),
			int(result.get("shared_definitions_generation", -1)),
		])
		quit(0)
		return
	printerr("Monster-Import fehlgeschlagen: %s" % result.get("error", result.get("status", "unbekannt")))
	quit(1)


func _on_progress(completed: int, total: int) -> void:
	print("Abruf: %d/%d" % [completed, total])
