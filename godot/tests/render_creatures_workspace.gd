extends SceneTree

const FileCampaignRegistry = preload("res://godot/src/platform/persistence/file_campaign_registry.gd")
const MainShell = preload("res://godot/src/ui/main_shell.gd")
const CatalogWorkspace = preload("res://godot/src/ui/catalog_workspace.gd")

var _data_root := "user://salt-marcher"
var _output_path := "/tmp/saltmarcher-creatures-workspace.png"


func _init() -> void:
	for argument in OS.get_cmdline_user_args():
		if argument.begins_with("--data-root="):
			_data_root = argument.trim_prefix("--data-root=")
		elif argument.begins_with("--output="):
			_output_path = argument.trim_prefix("--output=")
	call_deferred("_render")


func _render() -> void:
	root.size = Vector2i(1366, 768)
	var shell := MainShell.new()
	shell.data_root = _data_root
	shell.registry = FileCampaignRegistry.new(_data_root)
	root.add_child(shell)
	await process_frame
	shell.show_route("catalog")
	var catalog := shell.route("catalog") as CatalogWorkspace
	catalog.select_section("creatures")
	for _attempt in 1800:
		if catalog.section_snapshot("creatures").get("status", "") in ["ready", "empty", "unavailable", "incompatible", "failed"]:
			break
		await create_timer(0.001).timeout
	var rows: Array = catalog.section_snapshot("creatures").get("rows", [])
	if not rows.is_empty():
		catalog.call("_select_row", rows[0])
		for _attempt in 1800:
			if catalog.detail_snapshot().get("status", "") in ["ready", "failed", "incompatible", "storage_error"]:
				break
			await create_timer(0.001).timeout
	await process_frame
	await process_frame
	var error := root.get_texture().get_image().save_png(_output_path)
	if error != OK:
		push_error("Monster-Workspace-Render konnte nicht gespeichert werden: %d" % error)
		quit(1)
		return
	print("Monster-Workspace-Render: %s" % _output_path)
	quit(0)
