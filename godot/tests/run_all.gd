extends SceneTree

const FileCampaignRegistry = preload("res://godot/src/platform/persistence/file_campaign_registry.gd")
const CampaignDesk = preload("res://godot/src/ui/campaign_desk.gd")

var _failures: Array[String] = []


func _init() -> void:
	call_deferred("_run_tests")


func _run_tests() -> void:
	var root := "user://saltmarcher-tests/%s" % Time.get_ticks_usec()
	var registry := FileCampaignRegistry.new(root)

	var empty := registry.load_state()
	_expect(empty.get("ok", false), "fresh registry loads")
	_expect(empty.get("generation", -1) == 0, "fresh registry starts at generation zero")
	_expect(empty.get("campaigns", [1]).is_empty(), "fresh registry has no campaigns")

	var invalid := registry.create_campaign("   ")
	_expect(not invalid.get("ok", true), "blank campaign name is rejected")

	var first := registry.create_campaign("Salzpfad")
	_expect(first.get("ok", false), "first campaign is created")
	var first_id := str(first.get("campaign_id", ""))
	_expect(not first_id.is_empty(), "first campaign receives a stable identity")
	_expect(FileAccess.file_exists(registry.campaign_manifest_path(first_id)), "campaign manifest exists")
	var manifest_file := FileAccess.open(registry.campaign_manifest_path(first_id), FileAccess.READ)
	var manifest_parser := JSON.new()
	_expect(manifest_parser.parse(manifest_file.get_as_text()) == OK, "campaign manifest is valid JSON")
	manifest_file.close()
	_expect(manifest_parser.data.get("format", "") == "saltmarcher.campaign-manifest.v1", "campaign manifest is versioned")
	_expect(not str(manifest_parser.data.get("payload_sha256", "")).is_empty(), "campaign manifest is checksummed")
	_expect(first.get("state", {}).get("generation", -1) == 1, "create commits generation one")
	_expect(first.get("state", {}).get("active_campaign_id", "") == first_id, "created campaign is active")

	var second := registry.create_campaign("Nordmark")
	_expect(second.get("ok", false), "second campaign is created")
	var second_id := str(second.get("campaign_id", ""))
	_expect(second.get("state", {}).get("generation", -1) == 2, "second create advances generation")
	_expect(second.get("state", {}).get("campaigns", []).size() == 2, "both campaigns are registered")

	var stale := registry.activate_campaign(first_id, 1)
	_expect(not stale.get("ok", true) and stale.get("status", "") == "stale", "stale activation is rejected")

	var activated := registry.activate_campaign(first_id, 2)
	_expect(activated.get("ok", false), "campaign activation succeeds")
	_expect(activated.get("state", {}).get("generation", -1) == 3, "activation advances generation")
	_expect(activated.get("state", {}).get("active_campaign_id", "") == first_id, "selected campaign becomes active")

	var reloaded := FileCampaignRegistry.new(root).load_state()
	_expect(reloaded.get("ok", false), "registry survives restart")
	_expect(reloaded.get("active_campaign_id", "") == first_id, "active campaign survives restart")

	var latest_path := registry.generation_path(3)
	var corrupt := FileAccess.open(latest_path, FileAccess.WRITE)
	corrupt.store_string("{corrupted")
	corrupt.close()
	var recovered := FileCampaignRegistry.new(root).load_state()
	_expect(recovered.get("ok", false), "registry recovers from a damaged newest generation")
	_expect(recovered.get("recovered", false), "recovery is disclosed")
	_expect(recovered.get("generation", -1) == 2, "newest valid generation is recovered")
	_expect(recovered.get("active_campaign_id", "") == second_id, "recovered state is internally consistent")

	await _run_campaign_desk_journey()

	if _failures.is_empty():
		print("SaltMarcher Godot foundation: all tests passed")
		quit(0)
	else:
		for failure in _failures:
			push_error(failure)
		quit(1)


func _run_campaign_desk_journey() -> void:
	var data_root := "user://saltmarcher-ui-tests/%s" % Time.get_ticks_usec()
	var registry := FileCampaignRegistry.new(data_root)
	var desk := CampaignDesk.new()
	desk.registry = registry
	root.add_child(desk)
	await process_frame
	await process_frame

	var name_input := desk.find_child("CampaignNameInput", true, false) as LineEdit
	var create_button := desk.find_child("CreateCampaignButton", true, false) as Button
	_expect(name_input != null and create_button != null, "campaign desk exposes its keyboard creation controls")
	if name_input == null or create_button == null:
		desk.queue_free()
		return

	name_input.text = "Tischrunde"
	name_input.text_changed.emit(name_input.text)
	_expect(not create_button.disabled, "visible-name input enables campaign creation")
	name_input.text_submitted.emit(name_input.text)
	await process_frame
	var after_first := registry.load_state()
	_expect(after_first.get("campaigns", []).size() == 1, "Enter creates a campaign through the Godot production UI")
	var first_ui_id := str(after_first.get("active_campaign_id", ""))

	name_input.text = "Nebenpfad"
	name_input.text_changed.emit(name_input.text)
	name_input.text_submitted.emit(name_input.text)
	await process_frame
	var after_second := registry.load_state()
	_expect(after_second.get("campaigns", []).size() == 2, "campaign desk refreshes after a second creation")
	_expect(after_second.get("active_campaign_id", "") != first_ui_id, "newly created campaign becomes active")

	var campaign_list := desk.find_child("CampaignList", true, false) as VBoxContainer
	var selectable: Button = null
	for child in campaign_list.get_children():
		if child is Button and not child.disabled:
			selectable = child
			break
	_expect(selectable != null, "campaign desk renders another campaign as selectable")
	if selectable != null:
		selectable.pressed.emit()
		await process_frame
		var after_switch := registry.load_state()
		_expect(after_switch.get("active_campaign_id", "") == first_ui_id, "campaign button switches the active campaign")

	desk.queue_free()
	await process_frame


func _expect(condition: bool, message: String) -> void:
	if not condition:
		_failures.append(message)
