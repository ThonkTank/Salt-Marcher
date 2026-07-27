extends SceneTree

const FileCampaignRegistry = preload("res://godot/src/platform/persistence/file_campaign_registry.gd")
const FileCampaignStore = preload("res://godot/src/platform/persistence/file_campaign_store.gd")
const CampaignBundle = preload("res://godot/src/platform/portability/campaign_bundle.gd")
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
	_run_campaign_store_contract(root, first_id)

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
	var continued := registry.activate_campaign(first_id, 2)
	_expect(continued.get("ok", false), "registry can continue after recovering an immutable corrupt generation")
	_expect(continued.get("state", {}).get("generation", -1) == 4, "registry never overwrites the corrupt generation")
	_expect(continued.get("state", {}).get("parent_generation", -1) == 2, "recovery continuation points to the safe parent")

	var trashed := registry.trash_campaign(first_id, 4)
	_expect(trashed.get("ok", false), "Campaign moves into recoverable trash")
	_expect(trashed.get("state", {}).get("generation", -1) == 5, "trash operation commits a registry generation")
	_expect(trashed.get("state", {}).get("active_campaign_id", "missing") == "", "trashing the active Campaign clears the active pointer")
	_expect(not DirAccess.dir_exists_absolute(ProjectSettings.globalize_path(root + "/campaigns/" + first_id)), "trashed Campaign leaves the live Campaign root")
	var trash_entry_id := str(trashed.get("trash_entry_id", ""))
	_expect(DirAccess.dir_exists_absolute(ProjectSettings.globalize_path(registry.trash_entry_path(trash_entry_id))), "complete Campaign root exists in recoverable trash")
	var trash_list := registry.list_trashed_campaigns()
	_expect(trash_list.get("ok", false) and trash_list.get("entries", []).size() == 1, "recoverable trash lists the Campaign")
	_expect(trash_list.get("entries", [])[0].get("campaign_id", "") == first_id, "trash preserves original Campaign identity")

	var stale_restore := registry.restore_trashed_campaign(trash_entry_id, 4)
	_expect(not stale_restore.get("ok", true) and stale_restore.get("status", "") == "stale", "stale trash restore is rejected")
	var restored := registry.restore_trashed_campaign(trash_entry_id, 5)
	_expect(restored.get("ok", false), "recoverable Campaign restores")
	_expect(restored.get("state", {}).get("generation", -1) == 6, "restore commits a new registry generation")
	_expect(restored.get("campaign_id", "") == first_id, "restore retains Campaign identity")
	var restored_store := FileCampaignStore.new(root, first_id).load_state()
	_expect(restored_store.get("ok", false) and restored_store.get("generation", -1) == 4, "restore retains complete Campaign generations and safe parent")
	_run_portability_contract(root, registry, first_id)

	_run_registry_fault_contract()

	await _run_campaign_desk_journey()

	if _failures.is_empty():
		print("SaltMarcher Godot persistence and UI: all tests passed")
		quit(0)
	else:
		for failure in _failures:
			push_error(failure)
		quit(1)


func _run_campaign_store_contract(data_root: String, campaign_id: String) -> void:
	var store := FileCampaignStore.new(data_root, campaign_id)
	var initial := store.load_state()
	_expect(initial.get("ok", false), "new campaign has a readable Campaign generation")
	_expect(initial.get("generation", -1) == 1, "new campaign starts at Campaign generation one")
	_expect(initial.get("partition_refs", {"unexpected": true}).is_empty(), "new campaign starts without capability partitions")

	var runtime := store.default_runtime_state()
	runtime["focused_workspace"] = "world"
	var committed := store.commit(1, {
		"world": {
			"objects": [
				{"id": "place-1", "kind": "place", "name": "Salzhafen"},
			],
		},
	}, runtime)
	_expect(committed.get("ok", false), "Campaign partition commit succeeds")
	_expect(committed.get("state", {}).get("generation", -1) == 2, "Campaign commit advances generation")
	_expect(committed.get("state", {}).get("runtime", {}).get("focused_workspace", "") == "world", "Campaign runtime state commits atomically")
	var world := store.read_partition("world", committed.get("state", {}))
	_expect(world.get("ok", false) and world.get("present", false), "committed Campaign partition is readable")
	_expect(world.get("payload", {}).get("objects", [])[0].get("name", "") == "Salzhafen", "Campaign partition preserves semantic payload")

	var stale := store.commit(1, {}, runtime)
	_expect(not stale.get("ok", true) and stale.get("status", "") == "stale", "stale Campaign commit is rejected")

	var world_ref: String = str(committed.get("state", {}).get("partition_refs", {}).get("world", {}).get("path", ""))
	runtime["focused_workspace"] = "scene"
	var third := store.commit(2, {
		"scene": {"running": [], "focused_scene_id": ""},
	}, runtime)
	_expect(third.get("ok", false), "second owner can join the Campaign generation")
	_expect(third.get("state", {}).get("partition_refs", {}).get("world", {}).get("path", "") == world_ref, "unchanged owner partition is reused by reference")

	var corrupt := FileAccess.open(store.commit_path(3), FileAccess.WRITE)
	corrupt.store_string("{damaged")
	corrupt.close()
	var recovered := FileCampaignStore.new(data_root, campaign_id).load_state()
	_expect(recovered.get("ok", false), "Campaign store recovers from a damaged newest generation")
	_expect(recovered.get("recovered", false), "Campaign recovery is disclosed")
	_expect(recovered.get("generation", -1) == 2, "Campaign recovery selects newest fully valid generation")
	_expect(recovered.get("runtime", {}).get("focused_workspace", "") == "world", "Campaign recovery restores matching runtime state")

	var resumed := store.commit(2, {}, recovered["runtime"])
	_expect(resumed.get("ok", false), "Campaign store can commit after recovery")
	_expect(resumed.get("state", {}).get("generation", -1) == 4, "Campaign recovery continuation preserves damaged evidence")
	_expect(resumed.get("state", {}).get("parent_generation", -1) == 2, "Campaign recovery continuation names its safe parent")

	var invalid_owner := store.commit(4, {"../escape": {}}, resumed.get("state", {}).get("runtime", {}))
	_expect(not invalid_owner.get("ok", true), "unsafe capability owner is rejected before publication")


func _run_registry_fault_contract() -> void:
	var data_root := "user://saltmarcher-fault-tests/%s" % Time.get_ticks_usec()
	var fail_before_rename := func(operation: String, phase: String, _path: String) -> bool:
		return operation == "registry_commit" and phase == "before_rename"
	var failing_registry := FileCampaignRegistry.new(data_root, fail_before_rename)
	var failed := failing_registry.create_campaign("Nicht veröffentlicht")
	_expect(not failed.get("ok", true), "registry rename failure is surfaced")
	var after_failure := FileCampaignRegistry.new(data_root).load_state()
	_expect(after_failure.get("ok", false) and after_failure.get("campaigns", [1]).is_empty(), "failed registry publication exposes no Campaign row")

	var reconcile_root := "user://saltmarcher-ambiguous-tests/%s" % Time.get_ticks_usec()
	var fail_after_rename := func(operation: String, phase: String, _path: String) -> bool:
		return operation == "registry_commit" and phase == "after_rename"
	var ambiguous_registry := FileCampaignRegistry.new(reconcile_root, fail_after_rename)
	var reconciled := ambiguous_registry.create_campaign("Nachgelesen")
	_expect(reconciled.get("ok", false), "registry reconciles an interrupted post-rename acknowledgement")
	_expect(reconciled.get("state", {}).get("campaigns", []).size() == 1, "reconciled registry commit is not duplicated or lost")

	var rollback_root := "user://saltmarcher-trash-rollback-tests/%s" % Time.get_ticks_usec()
	var fault_state := {"fail_registry": false}
	var deletion_fault := func(operation: String, phase: String, _path: String) -> bool:
		return fault_state["fail_registry"] and operation == "registry_commit" and phase == "before_rename"
	var rollback_registry := FileCampaignRegistry.new(rollback_root, deletion_fault)
	var rollback_created := rollback_registry.create_campaign("Bleibt erhalten")
	var rollback_id := str(rollback_created.get("campaign_id", ""))
	fault_state["fail_registry"] = true
	var rollback_delete := rollback_registry.trash_campaign(rollback_id, 1)
	_expect(not rollback_delete.get("ok", true), "trash publication failure is surfaced")
	fault_state["fail_registry"] = false
	var rollback_state := rollback_registry.load_state()
	_expect(rollback_state.get("ok", false) and rollback_state.get("campaigns", []).size() == 1, "failed trash publication restores the live registry row")
	_expect(DirAccess.dir_exists_absolute(ProjectSettings.globalize_path(rollback_root + "/campaigns/" + rollback_id)), "failed trash publication restores the complete Campaign root")


func _run_portability_contract(source_root: String, source_registry, source_campaign_id: String) -> void:
	var bundle_path := source_root + "/exports/salzpfad.saltmarcher"
	var exporter := CampaignBundle.new(source_root, source_registry)
	var exported := exporter.export_campaign(source_campaign_id, bundle_path)
	_expect(exported.get("ok", false), "complete Campaign bundle exports")
	_expect(exported.get("file_count", 0) >= 5, "Campaign bundle contains identity, generations, and owner partitions")
	_expect(FileAccess.file_exists(bundle_path), "Campaign bundle is one portable file")
	var duplicate_export := exporter.export_campaign(source_campaign_id, bundle_path)
	_expect(not duplicate_export.get("ok", true), "Campaign export never overwrites an existing bundle")

	var target_root := "user://saltmarcher-import-tests/%s" % Time.get_ticks_usec()
	var target_registry := FileCampaignRegistry.new(target_root)
	var importer := CampaignBundle.new(target_root, target_registry)
	var imported := importer.import_campaign(bundle_path, 0)
	_expect(imported.get("ok", false), "current-format Campaign bundle imports: %s" % imported.get("error", "no error detail"))
	if not imported.get("ok", false):
		return
	var imported_id := str(imported.get("campaign_id", ""))
	_expect(not imported_id.is_empty() and imported_id != source_campaign_id, "import creates a new independent Campaign identity")
	var imported_registry := target_registry.load_state()
	_expect(imported_registry.get("campaigns", []).size() == 1, "import registers exactly one new Campaign")
	_expect(imported_registry.get("active_campaign_id", "missing") == "", "import does not silently replace the active Campaign")
	var stale_import := importer.import_campaign(bundle_path, 0)
	_expect(not stale_import.get("ok", true) and stale_import.get("status", "") == "stale", "stale import registration is rejected atomically")
	var after_stale_import := target_registry.load_state()
	_expect(after_stale_import.get("campaigns", []).size() == 1, "stale import leaves no extra registered Campaign")

	var imported_store := FileCampaignStore.new(target_root, imported_id)
	var imported_state := imported_store.load_state()
	_expect(imported_state.get("ok", false) and imported_state.get("generation", -1) == 4, "import preserves the exact safe Campaign generation")
	_expect(imported_state.get("runtime", {}).get("focused_workspace", "") == "world", "import preserves resumable Campaign runtime state")
	var imported_world := imported_store.read_partition("world", imported_state)
	var imported_objects: Array = imported_world.get("payload", {}).get("objects", [])
	_expect(not imported_objects.is_empty() and imported_objects[0].get("name", "") == "Salzhafen", "import preserves owner-partition semantics")

	var source_world := FileCampaignStore.new(source_root, source_campaign_id).read_partition("world")
	var changed_runtime: Dictionary = imported_state["runtime"].duplicate(true)
	changed_runtime["focused_workspace"] = "imported-only"
	var changed_import := imported_store.commit(4, {
		"world": {"objects": [{"id": "place-1", "kind": "place", "name": "Andere Küste"}]},
	}, changed_runtime)
	_expect(changed_import.get("ok", false), "imported Campaign is independently writable")
	var source_after_change := FileCampaignStore.new(source_root, source_campaign_id).read_partition("world")
	_expect(source_after_change.get("payload", {}) == source_world.get("payload", {}), "imported Campaign mutation cannot change source Campaign truth")

	var original_bundle := FileAccess.open(bundle_path, FileAccess.READ)
	var damaged_bytes := original_bundle.get_buffer(original_bundle.get_length())
	original_bundle.close()
	damaged_bytes[damaged_bytes.size() - 1] = damaged_bytes[damaged_bytes.size() - 1] ^ 0xff
	var damaged_path := source_root + "/exports/damaged.saltmarcher"
	var damaged_file := FileAccess.open(damaged_path, FileAccess.WRITE)
	damaged_file.store_buffer(damaged_bytes)
	damaged_file.close()
	var rejected := importer.import_campaign(damaged_path, 1)
	_expect(not rejected.get("ok", true), "damaged Campaign bundle is rejected")
	var after_rejection := target_registry.load_state()
	_expect(after_rejection.get("generation", -1) == 1 and after_rejection.get("campaigns", []).size() == 1, "rejected import leaves existing registry truth unchanged")

	var unsafe_path_bundle := source_root + "/exports/unsafe-path.saltmarcher"
	_write_invalid_bundle(unsafe_path_bundle, "../escape.json", "0", "0".repeat(64))
	var unsafe_path_rejection := importer.import_campaign(unsafe_path_bundle, 1)
	_expect(not unsafe_path_rejection.get("ok", true), "import rejects parent-traversal paths before extraction")
	var oversized_bundle := source_root + "/exports/oversized.saltmarcher"
	_write_invalid_bundle(
		oversized_bundle,
		"objects/world/oversized.json",
		str(CampaignBundle.MAX_SAFE_BYTES),
		"0".repeat(64)
	)
	var oversized_rejection := importer.import_campaign(oversized_bundle, 1)
	_expect(not oversized_rejection.get("ok", true), "import rejects oversized entries before allocation")
	var after_untrusted_rejections := target_registry.load_state()
	_expect(after_untrusted_rejections.get("generation", -1) == 1, "untrusted import rejection mutates no registry generation")


func _write_invalid_bundle(path: String, entry_path: String, entry_size: String, checksum: String) -> void:
	var payload := {
		"source_campaign_id": "source",
		"name": "Untrusted",
		"created_at_utc": "2026-07-27T00:00:00Z",
		"campaign_generation": "1",
		"exported_at_utc": "2026-07-27T00:00:00Z",
		"shared_definitions": [],
		"files": [{"path": entry_path, "size": entry_size, "sha256": checksum}],
	}
	var manifest := {
		"format": CampaignBundle.FORMAT_ID,
		"payload": payload,
		"payload_sha256": JSON.stringify(payload, "", true, true).sha256_text(),
	}
	var manifest_bytes := (JSON.stringify(manifest, "", true, true) + "\n").to_utf8_buffer()
	var file := FileAccess.open(path, FileAccess.WRITE)
	file.store_buffer(CampaignBundle.MAGIC.to_utf8_buffer())
	file.store_64(manifest_bytes.size())
	file.store_buffer(manifest_bytes)
	file.close()


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
