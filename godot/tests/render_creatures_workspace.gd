extends SceneTree

const FileCampaignRegistry = preload("res://godot/src/platform/persistence/file_campaign_registry.gd")
const FileCampaignStore = preload("res://godot/src/platform/persistence/file_campaign_store.gd")
const CampaignRuntimeCoordinator = preload("res://godot/src/app/campaign_runtime_coordinator.gd")
const EncounterPlanKnowledge = preload("res://godot/src/features/encounter/encounter_plan_knowledge.gd")
const EncounterRuntimeKnowledge = preload("res://godot/src/features/encounter/encounter_runtime_knowledge.gd")
const MainShell = preload("res://godot/src/ui/main_shell.gd")
const CatalogWorkspace = preload("res://godot/src/ui/catalog_workspace.gd")

var _data_root := "user://salt-marcher"
var _output_path := "/tmp/saltmarcher-creatures-workspace.png"
var _fixture_sources := false


func _init() -> void:
	for argument in OS.get_cmdline_user_args():
		if argument.begins_with("--data-root="):
			_data_root = argument.trim_prefix("--data-root=")
		elif argument.begins_with("--output="):
			_output_path = argument.trim_prefix("--output=")
		elif argument == "--fixture-sources":
			_fixture_sources = true
	call_deferred("_render")


func _render() -> void:
	root.size = Vector2i(1366, 768)
	if _fixture_sources:
		_data_root = "user://saltmarcher-render-catalog/%s" % Time.get_ticks_usec()
		var fixture := _prepare_source_fixture()
		if not fixture.get("ok", false):
			push_error("Catalog-Quellen-Fixture fehlgeschlagen: %s" % fixture.get("error", "Unbekannter Fehler"))
			quit(1)
			return
	var shell := MainShell.new()
	shell.data_root = _data_root
	shell.registry = FileCampaignRegistry.new(_data_root)
	if _fixture_sources:
		shell.runtime_coordinator = CampaignRuntimeCoordinator.new(_data_root, shell.registry)
		var opened: Dictionary = shell.runtime_coordinator.open_durable_active()
		if not opened.get("ok", false):
			push_error("Catalog-Quellen-Campaign konnte nicht geöffnet werden.")
			quit(1)
			return
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


func _prepare_source_fixture() -> Dictionary:
	var registry := FileCampaignRegistry.new(_data_root)
	var created := registry.create_campaign("Grauhafen-Quellen")
	if not created.get("ok", false):
		return created
	var store := FileCampaignStore.new(_data_root, str(created["campaign_id"]))
	var state := store.load_state()
	if not state.get("ok", false):
		return state
	var encounter_payload := EncounterPlanKnowledge.new().empty_payload()
	encounter_payload = EncounterRuntimeKnowledge.new().update_source_filters(encounter_payload, {
		"encounter_table_ids": ["encounter_table.harbor", "encounter_table.docks"],
		"faction_ids": ["faction.harbor"],
		"location_id": "place.gray-harbor",
	}).get("payload", encounter_payload)
	return store.commit(
		int(state["generation"]),
		{EncounterPlanKnowledge.OWNER: encounter_payload},
		state["runtime"]
	)
