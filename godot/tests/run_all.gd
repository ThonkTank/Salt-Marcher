extends SceneTree

const FileCampaignRegistry = preload("res://godot/src/platform/persistence/file_campaign_registry.gd")
const FileCampaignStore = preload("res://godot/src/platform/persistence/file_campaign_store.gd")
const CampaignBackupManager = preload("res://godot/src/platform/persistence/campaign_backup_manager.gd")
const CampaignBackupClosure = preload("res://godot/src/platform/persistence/campaign_backup_closure.gd")
const CampaignBundle = preload("res://godot/src/platform/portability/campaign_bundle.gd")
const SharedDefinitionStore = preload("res://godot/src/platform/persistence/shared_definition_store.gd")
const CampaignDesk = preload("res://godot/src/ui/campaign_desk.gd")
const CampaignRuntimeCoordinator = preload("res://godot/src/app/campaign_runtime_coordinator.gd")
const CampaignRuntimeSession = preload("res://godot/src/app/campaign_runtime_session.gd")
const CampaignRuntimeTransitionController = preload("res://godot/src/app/campaign_runtime_transition_controller.gd")
const CampaignBackupScheduler = preload("res://godot/src/app/campaign_backup_scheduler.gd")
const CampaignCompactionScheduler = preload("res://godot/src/app/campaign_compaction_scheduler.gd")
const StorageCapacityGuard = preload("res://godot/src/platform/persistence/storage_capacity_guard.gd")
const PlatformVolumeCapacityProbe = preload("res://godot/src/platform/persistence/platform_volume_capacity_probe.gd")

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
	_expect(restored_store.get("ok", false) and restored_store.get("generation", -1) == 5, "restore retains complete Campaign generations and safe parent")
	var portability_bundle := _run_portability_contract(root, registry, first_id)
	if not portability_bundle.is_empty():
		await _run_campaign_conflict_ui_journey(portability_bundle)

	_run_registry_fault_contract()
	_run_backup_contract()
	await _run_backup_scheduler_contract()
	_run_volume_capacity_probe_contract()
	_run_storage_pressure_contract()
	_run_backup_retention_contract()
	_run_backup_lifecycle_maintenance_contract()
	_run_runtime_coordinator_contract()
	await _run_compaction_scheduler_contract()
	await _run_runtime_transition_controller_contract()
	_run_permanent_deletion_contract()

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
	var numeric_commit := store.commit(2, {
		"world": {
			"objects": [
				{"id": "place-1", "kind": "place", "name": "Salzhafen", "visit_count": 2},
			],
		},
	}, runtime)
	_expect(numeric_commit.get("ok", false), "ordinary numeric capability payload survives canonical JSON readback")
	var numeric_world := store.read_partition("world", numeric_commit.get("state", {}))
	_expect(int(numeric_world.get("payload", {}).get("objects", [])[0].get("visit_count", -1)) == 2, "numeric capability payload preserves its semantic value")

	var stale := store.commit(2, {}, runtime)
	_expect(not stale.get("ok", true) and stale.get("status", "") == "stale", "stale Campaign commit is rejected")

	var world_ref: String = str(numeric_commit.get("state", {}).get("partition_refs", {}).get("world", {}).get("path", ""))
	runtime["focused_workspace"] = "scene"
	var third := store.commit(3, {
		"scene": {"running": [], "focused_scene_id": ""},
	}, runtime)
	_expect(third.get("ok", false), "second owner can join the Campaign generation")
	_expect(third.get("state", {}).get("partition_refs", {}).get("world", {}).get("path", "") == world_ref, "unchanged owner partition is reused by reference")

	var corrupt := FileAccess.open(store.commit_path(4), FileAccess.WRITE)
	corrupt.store_string("{damaged")
	corrupt.close()
	var recovered := FileCampaignStore.new(data_root, campaign_id).load_state()
	_expect(recovered.get("ok", false), "Campaign store recovers from a damaged newest generation")
	_expect(recovered.get("recovered", false), "Campaign recovery is disclosed")
	_expect(recovered.get("generation", -1) == 3, "Campaign recovery selects newest fully valid generation")
	_expect(recovered.get("runtime", {}).get("focused_workspace", "") == "world", "Campaign recovery restores matching runtime state")

	var resumed := store.commit(3, {}, recovered["runtime"])
	_expect(resumed.get("ok", false), "Campaign store can commit after recovery")
	_expect(resumed.get("state", {}).get("generation", -1) == 5, "Campaign recovery continuation preserves damaged evidence")
	_expect(resumed.get("state", {}).get("parent_generation", -1) == 3, "Campaign recovery continuation names its safe parent")

	var invalid_owner := store.commit(5, {"../escape": {}}, resumed.get("state", {}).get("runtime", {}))
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
	_expect(_has_no_child_directories(data_root + "/campaigns"), "failed registry publication leaves no live Campaign orphan")
	_expect(_has_no_child_directories(data_root + "/staging"), "failed registry publication removes its isolated creation staging")

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


func _run_portability_contract(source_root: String, source_registry, source_campaign_id: String) -> String:
	var source_definitions := SharedDefinitionStore.new(source_root)
	var wolf_definition := {
		"definition_id": "creature.wolf",
		"kind": "creature",
		"name": "Wolf",
		"content": {"armor_class": 12, "movement": "40 ft"},
	}
	var prepared_definitions := source_definitions.prepare_generation(0, [wolf_definition])
	_expect(prepared_definitions.get("ok", false), "installation-wide Shared Definition is prepared immutably")
	var renamed_wolf: Dictionary = wolf_definition.duplicate(true)
	renamed_wolf["name"] = "Dire Wolf"
	var renamed_generation := source_definitions.prepare_generation(
		int(prepared_definitions.get("generation", -1)),
		[renamed_wolf]
	)
	var renamed_readback := source_definitions.read_definition(
		"creature.wolf",
		int(renamed_generation.get("generation", -1))
	)
	_expect(renamed_readback.get("ok", false) and renamed_readback.get("definition", {}).get("name", "") == "Dire Wolf", "metadata-only definition edits receive a distinct immutable object and survive readback")
	var source_registry_before_definition: Dictionary = source_registry.load_state()
	var published_definitions: Dictionary = source_registry.publish_shared_definitions_generation(
		int(prepared_definitions.get("generation", -1)),
		int(source_registry_before_definition.get("generation", -1))
	)
	_expect(published_definitions.get("ok", false), "registry atomically selects the installation-wide definition generation")
	var published_rename: Dictionary = source_registry.publish_shared_definitions_generation(
		int(renamed_generation.get("generation", -1)),
		int(published_definitions.get("state", {}).get("generation", -1))
	)
	_expect(published_rename.get("ok", false), "registry accepts only the directly derived definition generation")
	var source_store := FileCampaignStore.new(source_root, source_campaign_id)
	var source_before_ref := source_store.load_state()
	var attached_definition := source_store.commit(
		int(source_before_ref.get("generation", -1)),
		{},
		source_before_ref.get("runtime", {}),
		[],
		0,
		["creature.wolf"]
	)
	_expect(attached_definition.get("ok", false), "Campaign generation references reusable definition identity instead of owning a copy")

	var bundle_path := source_root + "/exports/salzpfad.saltmarcher"
	var exporter := CampaignBundle.new(source_root, source_registry)
	var exported := exporter.export_campaign(source_campaign_id, bundle_path)
	_expect(exported.get("ok", false), "complete Campaign bundle exports")
	_expect(exported.get("shared_definition_count", 0) == 1, "complete Campaign bundle closes over every required Shared Definition")
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
		return ""
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
	_expect(imported_state.get("ok", false) and imported_state.get("generation", -1) == 6, "import preserves the exact safe Campaign generation")
	_expect(imported_state.get("runtime", {}).get("focused_workspace", "") == "world", "import preserves resumable Campaign runtime state")
	_expect(imported_state.get("shared_definition_refs", []) == ["creature.wolf"], "import preserves Shared-Definition references")
	var target_registry_state := target_registry.load_state()
	var imported_definition := SharedDefinitionStore.new(target_root).read_definition(
		"creature.wolf",
		int(target_registry_state.get("shared_definitions_generation", 0))
	)
	_expect(imported_definition.get("ok", false) and int(imported_definition.get("definition", {}).get("content", {}).get("armor_class", -1)) == 12, "missing Shared Definition joins the target installation atomically")
	var imported_world := imported_store.read_partition("world", imported_state)
	var imported_objects: Array = imported_world.get("payload", {}).get("objects", [])
	_expect(not imported_objects.is_empty() and imported_objects[0].get("name", "") == "Salzhafen", "import preserves owner-partition semantics")

	var source_world := FileCampaignStore.new(source_root, source_campaign_id).read_partition("world")
	var changed_runtime: Dictionary = imported_state["runtime"].duplicate(true)
	changed_runtime["focused_workspace"] = "imported-only"
	var changed_import := imported_store.commit(6, {
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
	_run_shared_definition_conflict_contract(bundle_path)
	_run_shared_definition_atomic_failure_contract(bundle_path)
	_run_portability_cancellation_contract(bundle_path)
	return bundle_path


func _run_shared_definition_atomic_failure_contract(bundle_path: String) -> void:
	var target_root := "user://saltmarcher-definition-atomic-failure/%s" % Time.get_ticks_usec()
	var fail_registry := func(operation: String, phase: String, _path: String) -> bool:
		return operation == "registry_commit" and phase == "before_rename"
	var registry := FileCampaignRegistry.new(target_root, fail_registry)
	var importer := CampaignBundle.new(target_root, registry)
	var rejected := importer.import_campaign(bundle_path, 0)
	_expect(not rejected.get("ok", true), "definition-bearing import surfaces registry publication failure")
	var state := FileCampaignRegistry.new(target_root).load_state()
	_expect(state.get("generation", -1) == 0 and state.get("shared_definitions_generation", -1) == 0, "failed registry publication exposes neither Campaign nor Shared Definitions")
	_expect(_has_no_child_directories(target_root + "/campaigns"), "failed definition-bearing import leaves no live Campaign orphan")
	_expect(_has_no_child_directories(target_root + "/staging"), "failed definition-bearing import removes its isolated staging")
	_expect(not FileAccess.file_exists(SharedDefinitionStore.new(target_root).generation_path(1)), "failed definition-bearing import removes its unselected definition generation")
	_expect(_has_no_child_directories(target_root + "/installation/shared-definitions/objects"), "failed definition-bearing import collects objects referenced only by its unselected generation")


func _run_portability_cancellation_contract(bundle_path: String) -> void:
	var target_root := "user://saltmarcher-portability-cancellation/%s" % Time.get_ticks_usec()
	var registry := FileCampaignRegistry.new(target_root)
	var cancellation_state := {"checks": 0}
	var cancel_during_extraction := func() -> bool:
		cancellation_state["checks"] += 1
		return int(cancellation_state["checks"]) >= 4
	var phases: Array[String] = []
	var progress := func(update: Dictionary) -> void:
		phases.append(str(update.get("phase", "")))
	var cancelled := CampaignBundle.new(target_root, registry).import_campaign(
		bundle_path,
		0,
		progress,
		cancel_during_extraction
	)
	_expect(cancelled.get("status", "") == "cancelled", "Campaign import observes cancellation at a natural extraction boundary")
	_expect(registry.load_state().get("generation", -1) == 0, "cancelled Campaign import publishes no registry generation")
	_expect(_has_no_child_directories(target_root + "/staging"), "cancelled Campaign import leaves no unmarked staging operation")
	_expect(_has_no_child_directories(target_root + "/campaigns"), "cancelled Campaign import leaves no live Campaign")
	_expect("validating" in phases, "Campaign import reports observable work before cancellation")

	var definition_root := "user://saltmarcher-definition-cancellation/%s" % Time.get_ticks_usec()
	var cancel_definitions := {"requested": false}
	var definition_progress := func(_update: Dictionary) -> void:
		cancel_definitions["requested"] = true
	var definition_cancellation := func() -> bool:
		return bool(cancel_definitions["requested"])
	var cancelled_definitions := SharedDefinitionStore.new(definition_root).prepare_generation(
		0,
		[
			{"definition_id": "creature.first", "kind": "creature", "name": "First", "content": {"value": 1}},
			{"definition_id": "creature.second", "kind": "creature", "name": "Second", "content": {"value": 2}},
		],
		definition_progress,
		definition_cancellation
	)
	_expect(cancelled_definitions.get("status", "") == "cancelled", "Shared-Definition preparation observes cancellation between immutable objects")
	_expect(not FileAccess.file_exists(SharedDefinitionStore.new(definition_root).generation_path(1)), "cancelled Shared-Definition preparation publishes no generation")
	_expect(_has_no_child_directories(definition_root + "/installation/shared-definitions/objects"), "cancelled Shared-Definition preparation removes its unreferenced objects")


func _run_shared_definition_conflict_contract(bundle_path: String) -> void:
	for choice in ["keep_existing", "use_imported", "retain_both"]:
		var target_root := "user://saltmarcher-definition-conflict-%s/%s" % [choice, Time.get_ticks_usec()]
		var registry := FileCampaignRegistry.new(target_root)
		var created := registry.create_campaign("Bestehende Referenz")
		var existing_campaign_id := str(created.get("campaign_id", ""))
		var local_definition := {
			"definition_id": "creature.wolf",
			"kind": "creature",
			"name": "Wolf",
			"content": {"armor_class": 15, "movement": "30 ft"},
		}
		var definition_store := SharedDefinitionStore.new(target_root)
		var prepared := definition_store.prepare_generation(0, [local_definition])
		var published := registry.publish_shared_definitions_generation(
			int(prepared.get("generation", -1)),
			int(created.get("state", {}).get("generation", -1))
		)
		_expect(published.get("ok", false), "%s fixture publishes conflicting local definition" % choice)
		var existing_store := FileCampaignStore.new(target_root, existing_campaign_id)
		var existing_state := existing_store.load_state()
		var history_payload := {
			"completed_facts": [{"label": "Wolf armor at encounter", "armor_class": 15}],
		}
		var attach := existing_store.commit(
			int(existing_state.get("generation", -1)),
			{"history": history_payload},
			existing_state.get("runtime", {}),
			[],
			0,
			["creature.wolf"]
		)
		_expect(attach.get("ok", false), "%s fixture references conflicting local definition" % choice)

		var importer := CampaignBundle.new(target_root, registry)
		var before_registry := registry.load_state()
		var staged := importer.import_campaign(bundle_path, int(before_registry.get("generation", -1)))
		_expect(staged.get("status", "") == "definition_conflicts", "%s import pauses for explicit Shared-Definition decision" % choice)
		_expect(staged.get("conflicts", []).size() == 1, "%s import reports exactly one definition conflict" % choice)
		_expect(staged.get("conflicts", [])[0].get("affected_existing_campaigns", []).size() == 1, "%s conflict discloses affected existing Campaign" % choice)
		var after_stage := registry.load_state()
		_expect(after_stage.get("generation", -1) == before_registry.get("generation", -2), "%s conflict staging mutates no registry truth" % choice)
		var definition_after_stage := definition_store.read_definition(
			"creature.wolf",
			int(after_stage.get("shared_definitions_generation", 0))
		)
		_expect(int(definition_after_stage.get("definition", {}).get("content", {}).get("armor_class", -1)) == 15, "%s conflict staging mutates no shared definition" % choice)
		var restarted_importer := CampaignBundle.new(target_root, registry)
		var incomplete := restarted_importer.resolve_import(
			str(staged.get("import_id", "")),
			int(before_registry.get("generation", -1)),
			{}
		)
		_expect(not incomplete.get("ok", true), "%s conflict cannot resolve without an explicit choice" % choice)
		var cancelled_resolution := CampaignBundle.new(target_root, registry).resolve_import(
			str(staged.get("import_id", "")),
			int(before_registry.get("generation", -1)),
			{"creature.wolf": choice},
			Callable(),
			func() -> bool: return true
		)
		_expect(cancelled_resolution.get("status", "") == "cancelled", "%s conflict resolution can be cancelled before commit" % choice)
		_expect(registry.load_state().get("generation", -1) == before_registry.get("generation", -2), "%s cancelled conflict resolution leaves installation truth unchanged" % choice)

		var resolved := restarted_importer.resolve_import(
			str(staged.get("import_id", "")),
			int(before_registry.get("generation", -1)),
			{"creature.wolf": choice}
		)
		_expect(resolved.get("ok", false), "%s explicitly resolves and atomically commits import" % choice)
		if not resolved.get("ok", false):
			continue
		var final_registry := registry.load_state()
		var active_generation := int(final_registry.get("shared_definitions_generation", 0))
		var original_definition := definition_store.read_definition("creature.wolf", active_generation)
		var expected_armor := 12 if choice == "use_imported" else 15
		_expect(int(original_definition.get("definition", {}).get("content", {}).get("armor_class", -1)) == expected_armor, "%s publishes the explicitly selected original identity semantics" % choice)
		var imported_id := str(resolved.get("campaign_id", ""))
		var imported_state := FileCampaignStore.new(target_root, imported_id).load_state()
		if choice == "retain_both":
			var retained_id := str(resolved.get("definition_reference_remap", {}).get("creature.wolf", ""))
			_expect(not retained_id.is_empty() and imported_state.get("shared_definition_refs", []) == [retained_id], "retain_both remaps only the imported Campaign to a distinct identity")
			var retained_definition := definition_store.read_definition(retained_id, active_generation)
			_expect(int(retained_definition.get("definition", {}).get("content", {}).get("armor_class", -1)) == 12, "retain_both preserves the imported variant under its new identity")
		else:
			_expect(imported_state.get("shared_definition_refs", []) == ["creature.wolf"], "%s keeps the imported Campaign on the selected shared identity" % choice)
		var history_after := existing_store.read_partition("history")
		_expect(int(history_after.get("payload", {}).get("completed_facts", [])[0].get("armor_class", -1)) == 15, "%s leaves completed history unchanged" % choice)
		if choice == "keep_existing":
			var before_discard := registry.load_state()
			var discard_candidate := CampaignBundle.new(target_root, registry).import_campaign(
				bundle_path,
				int(before_discard.get("generation", -1))
			)
			var discarded := CampaignBundle.new(target_root, registry).discard_import(str(discard_candidate.get("import_id", "")))
			_expect(discarded.get("ok", false), "staged conflict import can be explicitly discarded after restart")
			var discarded_resolution := CampaignBundle.new(target_root, registry).resolve_import(
				str(discard_candidate.get("import_id", "")),
				int(before_discard.get("generation", -1)),
				{"creature.wolf": "keep_existing"}
			)
			_expect(not discarded_resolution.get("ok", true), "discarded conflict import cannot publish later")
			_expect(registry.load_state().get("generation", -1) == before_discard.get("generation", -2), "discarded conflict import leaves installation truth unchanged")


func _run_backup_contract() -> void:
	var data_root := "user://saltmarcher-backup-tests/%s" % Time.get_ticks_usec()
	var registry := FileCampaignRegistry.new(data_root)
	var created := registry.create_campaign("Backup-Pfad")
	var campaign_id := str(created.get("campaign_id", ""))
	var store := FileCampaignStore.new(data_root, campaign_id)
	var runtime := store.default_runtime_state()
	runtime["focused_workspace"] = "before-backup"
	var committed := store.commit(1, {
		"world": {"objects": [{"id": "place-1", "name": "Sicherer Hafen"}]},
	}, runtime)
	_expect(committed.get("ok", false), "backup fixture Campaign commit succeeds")

	var manager := CampaignBackupManager.new(data_root, registry)
	var backup := manager.create_restore_tested_backup(campaign_id)
	_expect(backup.get("ok", false), "Campaign backup is published only after isolated restore test")
	_expect(backup.get("unique_bytes_stored", 0) > 0, "first content-addressed recovery point stores its unique Campaign bytes")
	if not backup.get("ok", false):
		return
	var backup_id := str(backup["backup"]["backup_id"])
	var listed := manager.list_backups(campaign_id)
	_expect(listed.get("ok", false) and listed.get("backups", []).size() == 1, "verified Campaign backup is discoverable")
	_expect(listed.get("backups", [])[0].get("restore_tested", false), "backup receipt records successful restore validation")

	runtime["focused_workspace"] = "after-backup"
	var changed := store.commit(2, {
		"world": {"objects": [{"id": "place-1", "name": "Spätere Änderung"}]},
	}, runtime)
	_expect(changed.get("ok", false), "Campaign can change after backup")
	var not_revoked := manager.restore_backup(campaign_id, backup_id, 3, false)
	_expect(not not_revoked.get("ok", true), "backup restore refuses active write authority")
	var unchanged_before_restore := FileCampaignStore.new(data_root, campaign_id).load_state()
	_expect(unchanged_before_restore.get("generation", -1) == 3, "refused restore leaves live Campaign unchanged")

	var restored := manager.restore_backup(campaign_id, backup_id, 3, true)
	_expect(restored.get("ok", false), "restore-tested Campaign backup restores after authority revocation")
	if not restored.get("ok", false):
		return
	_expect(restored.get("state", {}).get("generation", -1) == 4, "backup restore publishes above the replaced live generation")
	_expect(restored.get("state", {}).get("parent_generation", -1) == 2, "backup restore generation points to the backed-up safe parent")
	var restored_world := FileCampaignStore.new(data_root, campaign_id).read_partition("world")
	var restored_objects: Array = restored_world.get("payload", {}).get("objects", [])
	_expect(not restored_objects.is_empty() and restored_objects[0].get("name", "") == "Sicherer Hafen", "backup restore recovers backed-up semantic truth")
	var retained_path := str(restored.get("retained_original_path", ""))
	var retained_store := FileCampaignStore.new(data_root, campaign_id, Callable(), retained_path).load_state()
	_expect(retained_store.get("ok", false) and retained_store.get("generation", -1) == 3, "backup restore retains the replaced original Campaign unchanged")
	var retained_world := FileCampaignStore.new(data_root, campaign_id, Callable(), retained_path).read_partition("world", retained_store)
	var retained_objects: Array = retained_world.get("payload", {}).get("objects", [])
	_expect(not retained_objects.is_empty() and retained_objects[0].get("name", "") == "Spätere Änderung", "retained original preserves pre-restore truth")

	var second_backup := manager.create_restore_tested_backup(campaign_id)
	_expect(second_backup.get("ok", false), "restored Campaign can produce another restore-tested backup")
	if second_backup.get("ok", false):
		var second_payload: Dictionary = second_backup["backup"]
		_expect(second_backup.get("reused_file_count", 0) > 0 and second_backup.get("unique_bytes_stored", -1) < str(second_payload["logical_bytes"]).to_int(), "later recovery point reuses unchanged content-addressed Campaign bytes")
		var blob_directory := data_root + "/backups/campaigns/%s/blobs/sha256" % campaign_id
		var blob_file_count := 0
		for blob_file in DirAccess.get_files_at(ProjectSettings.globalize_path(blob_directory)):
			if blob_file.ends_with(".blob"):
				blob_file_count += 1
		var total_point_references: int = backup["backup"]["files"].size() + second_payload["files"].size()
		_expect(blob_file_count < total_point_references, "unchanged files across recovery points occupy one physical content-addressed blob")
		var internal_bundle_count := 0
		for backup_file in DirAccess.get_files_at(ProjectSettings.globalize_path(data_root + "/backups/campaigns/" + campaign_id)):
			if backup_file.ends_with(".saltmarcher"):
				internal_bundle_count += 1
		_expect(internal_bundle_count == 0, "internal recovery points no longer duplicate portable full-Campaign bundles")
		var unique_checksum := ""
		for entry in second_payload["files"]:
			if str(entry["path"]).ends_with("generation-%020d.json" % int(second_payload["campaign_generation"])):
				unique_checksum = str(entry["sha256"])
				break
		_expect(not unique_checksum.is_empty(), "damage fixture identifies a generation-local backup blob")
		var second_blob_path := CampaignBackupClosure.new(data_root).blob_path(campaign_id, unique_checksum)
		var second_blob := FileAccess.open(second_blob_path, FileAccess.READ_WRITE)
		var last_position := second_blob.get_length() - 1
		second_blob.seek(last_position)
		var original_byte := second_blob.get_8()
		second_blob.seek(last_position)
		second_blob.store_8(original_byte ^ 0xff)
		second_blob.close()
		var after_damage := manager.list_backups(campaign_id)
		_expect(after_damage.get("backups", []).size() == 1, "damaged verified backup is excluded from safe backup list")
		_expect(after_damage.get("rejected_backups", []).size() == 1, "damaged verified backup is explicitly disclosed")

	var schedule_root := "user://saltmarcher-backup-schedule-tests/%s" % Time.get_ticks_usec()
	var schedule_registry := FileCampaignRegistry.new(schedule_root)
	var scheduled_campaign := schedule_registry.create_campaign("Rolling Recovery")
	var scheduled_id := str(scheduled_campaign.get("campaign_id", ""))
	var schedule_manager := CampaignBackupManager.new(schedule_root, schedule_registry)
	var first_point := schedule_manager.maintain_recovery_point(scheduled_id, 1, 100, 60)
	_expect(first_point.get("ok", false) and first_point.get("status", "") == "backup_verified", "automatic recovery maintenance creates the first restore-tested point")
	var scheduled_store := FileCampaignStore.new(schedule_root, scheduled_id)
	var scheduled_runtime := scheduled_store.default_runtime_state()
	scheduled_runtime["focused_workspace"] = "changed"
	var scheduled_change := scheduled_store.commit(1, {"world": {"objects": []}}, scheduled_runtime)
	_expect(scheduled_change.get("ok", false), "rolling recovery fixture advances Campaign truth")
	var early_check := schedule_manager.maintain_recovery_point(scheduled_id, 2, 159, 60)
	_expect(early_check.get("ok", false) and early_check.get("status", "") == "not_due" and early_check.get("next_due_at_unix", -1) == 160, "rolling recovery waits only until the existing point reaches its age limit")
	var due_check := schedule_manager.maintain_recovery_point(scheduled_id, 2, 160, 60)
	_expect(due_check.get("ok", false) and due_check.get("status", "") == "backup_verified", "rolling recovery protects changed Campaign truth at the 60 second boundary")
	var protected_check := schedule_manager.maintain_recovery_point(scheduled_id, 2, 500, 60)
	_expect(protected_check.get("ok", false) and protected_check.get("status", "") == "current_generation_protected", "unchanged Campaign truth does not create redundant rolling backups")


func _run_backup_scheduler_contract() -> void:
	var data_root := "user://saltmarcher-backup-worker-tests/%s" % Time.get_ticks_usec()
	var registry := FileCampaignRegistry.new(data_root)
	var created := registry.create_campaign("Background Recovery")
	var campaign_id := str(created.get("campaign_id", ""))
	var scheduler := CampaignBackupScheduler.new(data_root, registry)
	root.add_child(scheduler)
	var backups: Dictionary = {}
	for _attempt in 200:
		await create_timer(0.01).timeout
		backups = CampaignBackupManager.new(data_root, registry).list_backups(campaign_id)
		if backups.get("backups", []).size() == 1 and scheduler.pending_count() == 0:
			break
	_expect(backups.get("backups", []).size() == 1, "background backup scheduler protects Campaigns discovered at startup")
	_expect(scheduler.pending_count() == 0, "background backup leaves its queue only after verified recovery publication")
	_expect(scheduler.last_result().get("status", "") == "backup_verified", "background backup scheduler discloses its verified terminal result")
	scheduler.queue_free()
	await process_frame
	await process_frame

	var retry_root := "user://saltmarcher-compaction-scheduler-retry-tests/%s" % Time.get_ticks_usec()
	var retry_registry := FileCampaignRegistry.new(retry_root)
	var retry_created := retry_registry.create_campaign("Compaction Retry")
	var retry_campaign_id := str(retry_created.get("campaign_id", ""))
	var retry_store := FileCampaignStore.new(retry_root, retry_campaign_id)
	for generation in range(2, 5):
		var retry_state := retry_store.load_state()
		retry_store.commit(
			int(retry_state["generation"]),
			{"world": {"revision": generation}},
			retry_state["runtime"]
		)
	CampaignBackupManager.new(retry_root, retry_registry).create_restore_tested_backup(retry_campaign_id, 5000)
	var fail_once := {"armed": true}
	var retry_coordinator := CampaignRuntimeCoordinator.new(
		retry_root,
		retry_registry,
		Callable(),
		func(root_path: String, manager_registry):
			return CampaignBackupManager.new(
				root_path,
				manager_registry,
				null,
				func(operation: String, phase: String, _subject: String) -> bool:
					if fail_once["armed"] and operation == "campaign_compaction" and phase == "after_quarantine_without_rollback":
						fail_once["armed"] = false
						return true
					return false
			)
	)
	retry_coordinator.open_durable_active()
	var retry_scheduler := CampaignCompactionScheduler.new(retry_root, retry_registry, retry_coordinator, 4, 3, 0)
	var retry_results: Array = []
	var retry_authority: Array = []
	retry_scheduler.operation_completed.connect(func(_kind: String, result: Dictionary) -> void:
		retry_results.append(result.duplicate(true))
		retry_authority.append(retry_coordinator.current_session().admitted())
	)
	root.add_child(retry_scheduler)
	for _attempt in 600:
		if retry_results.size() >= 2 and retry_scheduler.pending_count() == 0 and not retry_scheduler.is_active():
			break
		await create_timer(0.005).timeout
	_expect(retry_results.size() == 2 and retry_results[0].get("status", "") == "compaction_interrupted", "automatic compaction surfaces one interrupted quarantine before retry")
	_expect(retry_results.size() == 2 and retry_results[1].get("status", "") == "campaign_compacted", "automatic compaction retries and completes after interrupted quarantine recovery")
	_expect(
		retry_results.size() == 2
		and retry_results[1].get("recovery_events", [])[0].get("status", "") == "compaction_rollback_completed",
		"automatic retry discloses rollback of the interrupted compaction"
	)
	_expect(retry_authority == [true, true], "every failed and successful compaction attempt restores writer authority")
	retry_scheduler.queue_free()
	await process_frame
	await process_frame

	var teardown_root := "user://saltmarcher-compaction-scheduler-teardown-tests/%s" % Time.get_ticks_usec()
	var teardown_registry := FileCampaignRegistry.new(teardown_root)
	var teardown_created := teardown_registry.create_campaign("Compaction Teardown")
	var teardown_campaign_id := str(teardown_created.get("campaign_id", ""))
	var teardown_store := FileCampaignStore.new(teardown_root, teardown_campaign_id)
	for generation in range(2, 5):
		var teardown_state := teardown_store.load_state()
		teardown_store.commit(
			int(teardown_state["generation"]),
			{"world": {"revision": generation}},
			teardown_state["runtime"]
		)
	CampaignBackupManager.new(teardown_root, teardown_registry).create_restore_tested_backup(teardown_campaign_id, 6000)
	var teardown_coordinator := CampaignRuntimeCoordinator.new(
		teardown_root,
		teardown_registry,
		Callable(),
		func(root_path: String, manager_registry):
			return CampaignBackupManager.new(
				root_path,
				manager_registry,
				null,
				func(operation: String, phase: String, _subject: String) -> bool:
					if operation == "campaign_compaction" and phase == "before_quarantine":
						OS.delay_msec(100)
					return false
			)
	)
	teardown_coordinator.open_durable_active()
	var teardown_scheduler := CampaignCompactionScheduler.new(teardown_root, teardown_registry, teardown_coordinator, 4, 3, 0)
	var teardown_starts: Array = []
	teardown_scheduler.operation_started.connect(func(_kind: String, _campaign_id: String) -> void:
		teardown_starts.append(true)
	)
	root.add_child(teardown_scheduler)
	for _attempt in 300:
		if not teardown_starts.is_empty() and teardown_coordinator.active_lifecycle_operation() == "compaction":
			break
		await create_timer(0.005).timeout
	_expect(
		not teardown_starts.is_empty(),
		"teardown fixture reaches active automatic compaction; pending=%d active=%s result=%s"
		% [
			teardown_scheduler.pending_count(),
			teardown_coordinator.active_lifecycle_operation(),
			JSON.stringify(teardown_scheduler.last_result()),
		]
	)
	teardown_scheduler.queue_free()
	await process_frame
	await process_frame
	_expect(teardown_coordinator.current_session().admitted(), "scheduler teardown waits for compaction and restores writer authority")
	_expect(teardown_coordinator.active_lifecycle_operation().is_empty(), "scheduler teardown leaves no lifecycle operation behind")
	var teardown_state_after := teardown_store.load_state()
	_expect(teardown_state_after.get("ok", false) and teardown_state_after.get("generation", -1) == 4, "scheduler teardown preserves active Campaign truth")


func _run_volume_capacity_probe_contract() -> void:
	var root_path := "user://saltmarcher-volume-probe-tests/%s/path with ; shell text" % Time.get_ticks_usec()
	var absolute_path := ProjectSettings.globalize_path(root_path)
	_expect(DirAccess.make_dir_recursive_absolute(absolute_path) == OK, "volume probe fixture creates an existing path")
	var posix_call: Dictionary = {}
	var posix_probe := PlatformVolumeCapacityProbe.new(
		func() -> String: return "Linux",
		func(executable: String, arguments: PackedStringArray) -> Dictionary:
			posix_call["executable"] = executable
			posix_call["arguments"] = arguments
			return {
				"exit_code": 0,
				"output": "Filesystem 1024-blocks Used Available Capacity Mounted on\noverlay 10000000 2500000 7500000 25% /fixture mount\n",
			}
	)
	var posix := posix_probe.probe(absolute_path)
	_expect(posix.get("ok", false) and posix.get("volume_capacity_bytes", -1) == 10_240_000_000, "POSIX probe parses portable 1024-byte total-volume blocks")
	_expect(posix.get("available_bytes", -1) == 7_680_000_000 and posix.get("volume_root", "") == "/fixture mount", "POSIX probe returns one internally consistent free/capacity snapshot")
	_expect(posix_call.get("executable", "") == "/bin/df" and posix_call.get("arguments", PackedStringArray()).size() == 2, "POSIX probe invokes one fixed executable without a shell")
	_expect(str(posix_call.get("arguments", PackedStringArray())[1]) == absolute_path, "POSIX probe passes an unsafe-looking path as one opaque process argument")

	var mac_probe := PlatformVolumeCapacityProbe.new(
		func() -> String: return "macOS",
		func(_executable: String, _arguments: PackedStringArray) -> Dictionary:
			return {
				"exit_code": 0,
				"output": "Filesystem 1024-blocks Used Available Capacity Mounted on\n/dev/disk3s1 200 50 150 25% /\n",
			}
	)
	var mac_result := mac_probe.probe(absolute_path)
	_expect(mac_result.get("ok", false) and mac_result.get("platform", "") == "macOS", "macOS uses the same POSIX portable snapshot contract")

	var windows_call: Dictionary = {}
	var windows_probe := PlatformVolumeCapacityProbe.new(
		func() -> String: return "Windows",
		func(executable: String, arguments: PackedStringArray) -> Dictionary:
			windows_call["executable"] = executable
			windows_call["arguments"] = arguments
			return {"exit_code": 0, "output": "100000000000|90000000000|C:\\\r\n"}
	)
	var windows := windows_probe.probe(absolute_path)
	_expect(windows.get("ok", false) and windows.get("volume_capacity_bytes", -1) == 100_000_000_000, "Windows DriveInfo probe parses invariant 64-bit capacity")
	_expect(windows.get("available_bytes", -1) == 90_000_000_000 and windows.get("volume_root", "") == "C:\\", "Windows DriveInfo probe returns available bytes and the owning root")
	var windows_arguments: PackedStringArray = windows_call.get("arguments", PackedStringArray())
	_expect(windows_call.get("executable", "") == "powershell.exe" and not windows_arguments.is_empty() and str(windows_arguments[windows_arguments.size() - 1]) == absolute_path, "Windows probe passes the path separately from its constant PowerShell program")

	var failed_process := PlatformVolumeCapacityProbe.new(
		func() -> String: return "Linux",
		func(_executable: String, _arguments: PackedStringArray) -> Dictionary:
			return {"exit_code": 127, "output": "missing"}
	).probe(absolute_path)
	_expect(not failed_process.get("ok", true) and failed_process.get("status", "") == "storage_probe_error", "missing platform probe fails closed")
	var contradictory := PlatformVolumeCapacityProbe.new(
		func() -> String: return "Windows",
		func(_executable: String, _arguments: PackedStringArray) -> Dictionary:
			return {"exit_code": 0, "output": "100|101|C:\\"}
	).probe(absolute_path)
	_expect(not contradictory.get("ok", true), "platform probe rejects free space greater than total capacity")
	var unsupported := PlatformVolumeCapacityProbe.new(
		func() -> String: return "Web",
		Callable()
	).probe(absolute_path)
	_expect(not unsupported.get("ok", true), "unsupported non-desktop platform cannot silently fall back to the two-GiB floor")

	var live_started_usec := Time.get_ticks_usec()
	var live_probe := PlatformVolumeCapacityProbe.new().probe(absolute_path)
	var live_elapsed_usec := Time.get_ticks_usec() - live_started_usec
	_expect(live_probe.get("ok", false) and live_probe.get("volume_capacity_bytes", -1) > 0, "production Linux probe resolves the real fixture volume capacity")
	_expect(live_elapsed_usec <= 1_000_000, "production Linux volume admission probe completes within one second")
	var live_admission := StorageCapacityGuard.new().admit(root_path, 0)
	_expect(live_admission.get("ok", false) and live_admission.get("capacity_known", false), "production storage admission enforces a known total-volume reserve")
	if live_admission.get("ok", false):
		var expected_percentage := (int(live_admission["volume_capacity_bytes"]) * 5 + 99) / 100
		_expect(live_admission.get("reserve_bytes", -1) == maxi(2 * 1024 * 1024 * 1024, expected_percentage), "production admission applies the exact greater-of-two-GiB-or-five-percent rule")
	var maximum_int := 0x7fffffffffffffff
	var huge_guard := StorageCapacityGuard.new(func(_path: String) -> Dictionary:
		return {"ok": true, "available_bytes": maximum_int, "volume_capacity_bytes": maximum_int}
	)
	var huge_admission := huge_guard.admit(root_path, 0)
	var expected_huge_reserve := (maximum_int / 100) * 5 + ((maximum_int % 100) * 5 + 99) / 100
	_expect(huge_admission.get("ok", false) and huge_admission.get("reserve_bytes", -1) == expected_huge_reserve, "five-percent reserve remains exact without int64 multiplication overflow")
	var invalid_unknown := StorageCapacityGuard.new(func(_path: String) -> Dictionary:
		return {"ok": true, "available_bytes": 10, "volume_capacity_bytes": -2}
	).admit(root_path, 0)
	_expect(not invalid_unknown.get("ok", true), "capacity guard rejects undeclared negative total-volume sentinels")


func _run_storage_pressure_contract() -> void:
	var gib := 1024 * 1024 * 1024
	var known_guard := StorageCapacityGuard.new(func(_path: String) -> Dictionary:
		return {
			"ok": true,
			"available_bytes": 5 * gib + 100,
			"volume_capacity_bytes": 100 * gib,
		}
	)
	var admitted := known_guard.admit("user://known-capacity/probe", 100)
	_expect(admitted.get("ok", false) and admitted.get("reserve_bytes", 0) == 5 * gib, "storage admission reserves exact five percent when volume capacity is known")
	var rejected := known_guard.admit("user://known-capacity/probe", 101)
	_expect(not rejected.get("ok", true) and rejected.get("status", "") == "storage_pressure", "storage admission rejects the first byte that would consume the reserve")
	_expect(rejected.get("safe_read_available", false) and rejected.get("external_export_available", false) and rejected.get("retry_available", false), "storage-pressure result preserves safe read, external export, and retry")

	var unknown_guard := StorageCapacityGuard.new(func(_path: String) -> Dictionary:
		return {"ok": true, "available_bytes": 2 * gib, "volume_capacity_bytes": -1}
	)
	var unknown_rejection := unknown_guard.admit("user://unknown-capacity/probe", 1)
	_expect(not unknown_rejection.get("ok", true) and unknown_rejection.get("reserve_bytes", 0) == 2 * gib and not unknown_rejection.get("capacity_known", true), "unknown volume capacity fails writes at the two GiB minimum without claiming percentage qualification")

	var data_root := "user://saltmarcher-storage-pressure-tests/%s" % Time.get_ticks_usec()
	var registry := FileCampaignRegistry.new(data_root)
	var created := registry.create_campaign("Pressure Safe")
	var campaign_id := str(created.get("campaign_id", ""))
	var pressure_guard := StorageCapacityGuard.new(func(path: String) -> Dictionary:
		var external := path.contains("external-export")
		return {
			"ok": true,
			"available_bytes": 20 * gib if external else 2 * gib,
			"volume_capacity_bytes": -1,
		}
	)
	var pressured_store := FileCampaignStore.new(data_root, campaign_id, Callable(), "", pressure_guard)
	var before := pressured_store.load_state()
	var failed_commit := pressured_store.commit(
		int(before["generation"]),
		{"world": {"objects": [{"id": "would-not-store"}]}},
		before["runtime"]
	)
	_expect(not failed_commit.get("ok", true) and failed_commit.get("status", "") == "storage_pressure", "Campaign mutation is rejected before unsafe low-space publication")
	var after := FileCampaignStore.new(data_root, campaign_id).load_state()
	_expect(after.get("generation", -1) == before.get("generation", -2) and after.get("partition_refs", {"bad": true}).is_empty(), "low-space rejection leaves prior Campaign truth unchanged and readable")
	var blocked_bundle := data_root + "/blocked-export/campaign.saltmarcher"
	var blocked_export := CampaignBundle.new(data_root, registry, pressure_guard).export_campaign(campaign_id, blocked_bundle)
	_expect(not blocked_export.get("ok", true) and blocked_export.get("status", "") == "storage_pressure", "low-space export is rejected before output publication")
	_expect(not DirAccess.dir_exists_absolute(ProjectSettings.globalize_path(data_root + "/blocked-export")), "rejected low-space export creates no destination or parent")
	var external_bundle := data_root + "/external-export/campaign.saltmarcher"
	var exported := CampaignBundle.new(data_root, registry, pressure_guard).export_campaign(campaign_id, external_bundle)
	_expect(exported.get("ok", false) and FileAccess.file_exists(external_bundle), "safe export to a destination with capacity remains available under local pressure")

	var import_root := "user://saltmarcher-storage-pressure-import-tests/%s" % Time.get_ticks_usec()
	var import_registry := FileCampaignRegistry.new(import_root)
	var blocked_import := CampaignBundle.new(import_root, import_registry, pressure_guard).import_campaign(external_bundle, 0)
	_expect(not blocked_import.get("ok", true) and blocked_import.get("status", "") == "storage_pressure", "low-space import is rejected before extraction")
	_expect(import_registry.load_state().get("generation", -1) == 0, "rejected low-space import leaves registry truth unchanged")
	_expect(_has_no_child_directories(import_root + "/staging"), "rejected low-space import creates no staging operation")

	var create_root := "user://saltmarcher-storage-pressure-create-tests/%s" % Time.get_ticks_usec()
	var pressured_registry := FileCampaignRegistry.new(create_root, Callable(), pressure_guard)
	var blocked_create := pressured_registry.create_campaign("No Partial Campaign")
	_expect(not blocked_create.get("ok", true) and blocked_create.get("status", "") == "storage_pressure", "low-space Campaign creation fails before live publication")
	_expect(pressured_registry.load_state().get("generation", -1) == 0, "low-space Campaign creation publishes no registry generation")
	_expect(_has_no_child_directories(create_root + "/campaigns"), "low-space Campaign creation leaves no live Campaign root")
	_expect(_has_no_child_directories(create_root + "/staging"), "low-space Campaign creation removes its staging root")


func _run_backup_retention_contract() -> void:
	var data_root := "user://saltmarcher-backup-retention-tests/%s" % Time.get_ticks_usec()
	var registry := FileCampaignRegistry.new(data_root)
	var created := registry.create_campaign("Retention")
	var campaign_id := str(created.get("campaign_id", ""))
	var store := FileCampaignStore.new(data_root, campaign_id)
	var manager := CampaignBackupManager.new(data_root, registry)
	var backup_ids: Array[String] = []
	for generation in range(1, 6):
		var backup := manager.create_restore_tested_backup(campaign_id, generation * 60)
		_expect(backup.get("ok", false), "retention fixture creates verified point %d" % generation)
		if backup.get("ok", false):
			backup_ids.append(str(backup["backup"]["backup_id"]))
		if generation < 5:
			var state := store.load_state()
			var runtime: Dictionary = state["runtime"].duplicate(true)
			runtime["focused_workspace"] = "generation-%d" % (generation + 1)
			var committed := store.commit(
				int(state["generation"]),
				{"world": {"revision": generation + 1}},
				runtime
			)
			_expect(
				committed.get("ok", false),
				"retention fixture advances to generation %d: %s" % [
					generation + 1,
					committed.get("error", "unknown error"),
				]
			)
	var before := manager.list_backups(campaign_id)
	_expect(before.get("backups", []).size() == 5, "retention starts with five verified recovery points")

	var crash_after_receipt := CampaignBackupManager.new(
		data_root,
		registry,
		null,
		func(operation: String, phase: String, _subject: String) -> bool:
			return operation == "backup_retention" and phase == "after_receipt_quarantine_without_rollback"
	)
	var receipt_interruption := crash_after_receipt.prune_oldest_verified_backup(campaign_id, 3)
	_expect(receipt_interruption.get("status", "") == "retention_interrupted", "retention fault seam simulates process loss after receipt quarantine")
	var receipt_restart := CampaignBackupManager.new(data_root, registry).list_backups(campaign_id)
	_expect(receipt_restart.get("backups", []).size() == 5, "restart restores an interrupted verified recovery point")
	_expect(receipt_restart.get("retention_recovery_events", [])[0].get("status", "") == "retention_rollback_completed", "restart discloses completed retention rollback")

	var interrupted_manager := CampaignBackupManager.new(
		data_root,
		registry,
		null,
		func(operation: String, phase: String, _subject: String) -> bool:
			return operation == "backup_retention" and phase == "after_receipt_quarantine"
	)
	var interrupted := interrupted_manager.prune_oldest_verified_backup(campaign_id, 3)
	_expect(not interrupted.get("ok", true), "interrupted retention is surfaced as failure")
	var after_interruption := manager.list_backups(campaign_id)
	_expect(after_interruption.get("backups", []).size() == 5, "interrupted retention restores all verified recovery points")

	var pruned := manager.prune_oldest_verified_backup(campaign_id, 3)
	_expect(pruned.get("ok", false) and pruned.get("status", "") == "oldest_verified_backup_pruned", "pressure retention removes exactly the oldest verified point")
	_expect(pruned.get("backup_id", "") == backup_ids[0] and pruned.get("removed_bytes", 0) > 0, "retention reports the exact removed recovery point and bytes")
	var after_prune := manager.list_backups(campaign_id)
	_expect(after_prune.get("backups", []).size() == 4 and after_prune.get("rejected_backups", []).is_empty(), "ordinary retention removes only one verified recovery point")

	var latest := store.load_state()
	var next_runtime: Dictionary = latest["runtime"].duplicate(true)
	next_runtime["focused_workspace"] = "generation-6"
	var next_commit := store.commit(
		int(latest["generation"]),
		{"world": {"revision": 6}},
		next_runtime
	)
	_expect(next_commit.get("ok", false), "pressure-retention fixture creates unprotected changed truth")
	var gib := 1024 * 1024 * 1024
	var pressure_guard := StorageCapacityGuard.new(func(_path: String) -> Dictionary:
		return {"ok": true, "available_bytes": 2 * gib, "volume_capacity_bytes": -1}
	)
	var pressure_manager := CampaignBackupManager.new(data_root, registry, pressure_guard)
	var pressure_result := pressure_manager.maintain_with_pressure_retention(
		campaign_id,
		int(next_commit.get("state", {}).get("generation", 0)),
		360,
		60,
		3
	)
	_expect(not pressure_result.get("ok", true) and pressure_result.get("status", "") == "storage_pressure", "backup pressure remains explicit when one safe prune cannot restore capacity")
	_expect(pressure_result.get("retention", {}).get("status", "") == "oldest_verified_backup_pruned", "storage pressure triggers one conservative verified-backup prune before retry")
	var after_pressure := manager.list_backups(campaign_id)
	_expect(after_pressure.get("backups", []).size() == 3, "pressure retention stops at three verified recovery points")
	var minimum := manager.prune_oldest_verified_backup(campaign_id, 3)
	_expect(minimum.get("ok", false) and minimum.get("status", "") == "retention_minimum_preserved", "retention refuses to cross its verified-point minimum")


func _run_backup_lifecycle_maintenance_contract() -> void:
	var retention_root := "user://saltmarcher-normal-retention-tests/%s" % Time.get_ticks_usec()
	var retention_registry := FileCampaignRegistry.new(retention_root)
	var retention_created := retention_registry.create_campaign("Zeitstufen")
	var retention_id := str(retention_created.get("campaign_id", ""))
	var retention_store := FileCampaignStore.new(retention_root, retention_id)
	var retention_manager := CampaignBackupManager.new(retention_root, retention_registry)
	var point_times := [0, 60, 120, 180, 300, 600, 900, 1200]
	var point_ids: Array[String] = []
	for index in point_times.size():
		var point := retention_manager.create_restore_tested_backup(retention_id, point_times[index])
		_expect(point.get("ok", false), "normal retention fixture creates point %d" % (index + 1))
		if point.get("ok", false):
			point_ids.append(str(point["backup"]["backup_id"]))
		if index < point_times.size() - 1:
			var state := retention_store.load_state()
			var runtime: Dictionary = state["runtime"].duplicate(true)
			runtime["focused_workspace"] = "retention-%d" % (index + 2)
			var commit := retention_store.commit(
				int(state["generation"]),
				{"world": {"retention_revision": index + 2}},
				runtime
			)
			_expect(commit.get("ok", false), "normal retention fixture advances generation %d" % (index + 2))
	var policy := {
		"minimum_verified_points": 3,
		"maximum_verified_points": 5,
		"keep_all_seconds": 180,
		"tiers": [{"until_age_seconds": 1200, "spacing_seconds": 300}],
	}
	var retained := retention_manager.apply_normal_retention(retention_id, 1200, policy)
	_expect(retained.get("ok", false) and retained.get("status", "") == "retention_applied", "normal retention applies configurable time and count tiers")
	_expect(retained.get("removed_backup_ids", []).size() == 3 and retained.get("retained_verified_points", -1) == 5, "normal retention reports its exact bounded point set")
	var retained_list := retention_manager.list_backups(retention_id)
	var retained_ids: Dictionary = {}
	for backup in retained_list.get("backups", []):
		retained_ids[str(backup["backup_id"])] = true
	_expect(retained_ids.size() == 5, "normal retention leaves exactly five verified points")
	for protected_index in range(3, point_ids.size()):
		_expect(retained_ids.has(point_ids[protected_index]), "normal retention preserves selected recent and bucket points")
	var repeated := retention_manager.apply_normal_retention(retention_id, 1200, policy)
	_expect(repeated.get("ok", false) and repeated.get("status", "") == "retention_current" and repeated.get("removed_backup_ids", ["unexpected"]).is_empty(), "normal retention is idempotent")
	var protected_prune := retention_manager.prune_verified_backup(retention_id, point_ids.back(), 3)
	_expect(not protected_prune.get("ok", true), "retention refuses explicit removal of a newest protected point")
	var invalid_policy := retention_manager.apply_normal_retention(retention_id, 1200, {"minimum_verified_points": 1})
	_expect(not invalid_policy.get("ok", true), "retention rejects a policy below the safe recovery minimum")
	var retention_cleanup_fault := CampaignBackupManager.new(
		retention_root,
		retention_registry,
		null,
		func(operation: String, phase: String, _subject: String) -> bool:
			return operation == "backup_retention" and phase == "after_commit_tombstone"
	)
	var retention_cleanup_pending := retention_cleanup_fault.prune_oldest_verified_backup(retention_id, 3)
	_expect(retention_cleanup_pending.get("status", "") == "retention_cleanup_pending", "retention fault seam simulates process loss after durable removal decision")
	var retention_cleanup_restart := CampaignBackupManager.new(retention_root, retention_registry).list_backups(retention_id)
	_expect(retention_cleanup_restart.get("backups", []).size() == 4, "committed retention remains removed after restart")
	_expect(retention_cleanup_restart.get("retention_recovery_events", [])[0].get("status", "") == "retention_cleanup_completed", "retention finishes committed tombstone cleanup after restart")
	var clock_root := "user://saltmarcher-retention-clock-tests/%s" % Time.get_ticks_usec()
	var clock_registry := FileCampaignRegistry.new(clock_root)
	var clock_created := clock_registry.create_campaign("Clock Safe")
	var clock_id := str(clock_created.get("campaign_id", ""))
	var clock_store := FileCampaignStore.new(clock_root, clock_id)
	var clock_manager := CampaignBackupManager.new(clock_root, clock_registry)
	var clock_point_ids: Array[String] = []
	for index in 4:
		var clock_point := clock_manager.create_restore_tested_backup(clock_id, 1000 - index * 100)
		clock_point_ids.append(str(clock_point.get("backup", {}).get("backup_id", "")))
		if index < 3:
			var clock_state := clock_store.load_state()
			clock_store.commit(
				int(clock_state["generation"]),
				{"world": {"revision": index + 2}},
				clock_state["runtime"]
			)
	var clock_retention := clock_manager.apply_normal_retention(clock_id, 2000, {
		"minimum_verified_points": 3,
		"maximum_verified_points": 3,
		"keep_all_seconds": 0,
		"tiers": [{"until_age_seconds": 2000, "spacing_seconds": 2000}],
	})
	_expect(clock_retention.get("ok", false), "retention tolerates a backwards system clock")
	var clock_list := clock_manager.list_backups(clock_id)
	var clock_remaining: Dictionary = {}
	for backup in clock_list.get("backups", []):
		clock_remaining[str(backup["backup_id"])] = true
	_expect(clock_remaining.has(clock_point_ids.back()) and not clock_remaining.has(clock_point_ids.front()), "retention protects newest Campaign generations independently of wall-clock order")

	var compaction_root := "user://saltmarcher-compaction-tests/%s" % Time.get_ticks_usec()
	var compaction_registry := FileCampaignRegistry.new(compaction_root)
	var compaction_created := compaction_registry.create_campaign("Compaction")
	var compaction_id := str(compaction_created.get("campaign_id", ""))
	var compaction_store := FileCampaignStore.new(compaction_root, compaction_id)
	for generation in range(2, 8):
		var state := compaction_store.load_state()
		var runtime: Dictionary = state["runtime"].duplicate(true)
		runtime["focused_workspace"] = "compaction-%d" % generation
		var commit := compaction_store.commit(
			int(state["generation"]),
			{"world": {"revision": generation}},
			runtime
		)
		_expect(commit.get("ok", false), "compaction fixture advances generation %d" % generation)
	var compaction_manager := CampaignBackupManager.new(compaction_root, compaction_registry)
	var protected_backup := compaction_manager.create_restore_tested_backup(compaction_id, 2000)
	_expect(protected_backup.get("ok", false), "compaction fixture creates an exact restore-tested current point")
	var active_refusal := compaction_manager.compact_campaign_history(compaction_id, 7, false)
	_expect(not active_refusal.get("ok", true), "compaction refuses active write authority")
	var interrupted_manager := CampaignBackupManager.new(
		compaction_root,
		compaction_registry,
		null,
		func(operation: String, phase: String, _subject: String) -> bool:
			return operation == "campaign_compaction" and phase == "after_quarantine_without_rollback"
	)
	var interrupted := interrupted_manager.compact_campaign_history(compaction_id, 7, true, 3, 2001)
	_expect(interrupted.get("status", "") == "compaction_interrupted", "compaction fault seam simulates process loss before commit")
	var readable_during_interruption := compaction_store.load_state()
	_expect(readable_during_interruption.get("ok", false) and readable_during_interruption.get("generation", -1) == 7, "interrupted compaction leaves active Campaign truth readable")
	var compacted := CampaignBackupManager.new(compaction_root, compaction_registry).compact_campaign_history(
		compaction_id,
		7,
		true,
		3,
		2002
	)
	_expect(compacted.get("ok", false) and compacted.get("status", "") == "campaign_compacted", "compaction rolls an interrupted quarantine back and completes on retry")
	_expect(compacted.get("recovery_events", [])[0].get("status", "") == "compaction_rollback_completed", "compaction discloses restart rollback")
	_expect(DirAccess.get_files_at(ProjectSettings.globalize_path(compaction_root + "/campaigns/" + compaction_id + "/commits")).size() == 3, "compaction retains exactly the configured local generation floor")
	var compacted_objects := 0
	var object_root := ProjectSettings.globalize_path(compaction_root + "/campaigns/" + compaction_id + "/objects")
	for owner in DirAccess.get_directories_at(object_root):
		compacted_objects += DirAccess.get_files_at(object_root + "/" + owner).size()
	_expect(compacted_objects == 3, "compaction removes only partitions unreachable from retained local generations")
	var after_compaction := compaction_store.load_state()
	_expect(after_compaction.get("ok", false) and after_compaction.get("generation", -1) == 7, "compaction preserves active semantic truth")
	if protected_backup.get("ok", false):
		var staged_original := CampaignBackupClosure.new(compaction_root).stage_point(
			compaction_id,
			str(protected_backup["backup"]["backup_id"]),
			"post-compaction-proof"
		)
		_expect(staged_original.get("ok", false), "pre-compaction recovery point remains independently restorable")
		if staged_original.get("ok", false):
			CampaignBackupClosure.new(compaction_root).discard_staging(staged_original["staging_root"])
	var damaged_latest := FileAccess.open(compaction_store.commit_path(7), FileAccess.WRITE)
	damaged_latest.store_string("{damaged")
	damaged_latest.close()
	var local_fallback := compaction_store.load_state()
	_expect(local_fallback.get("ok", false) and local_fallback.get("generation", -1) == 6 and local_fallback.get("recovered", false), "compaction retains a local corruption fallback")
	var damage_deferred := CampaignBackupManager.new(compaction_root, compaction_registry).compact_campaign_history(compaction_id, 6, true, 2)
	_expect(damage_deferred.get("ok", false) and damage_deferred.get("status", "") == "compaction_deferred_for_damage", "compaction preserves damaged generation evidence")

	var committed_root := "user://saltmarcher-compaction-commit-tests/%s" % Time.get_ticks_usec()
	var committed_registry := FileCampaignRegistry.new(committed_root)
	var committed_created := committed_registry.create_campaign("Committed Compaction")
	var committed_id := str(committed_created.get("campaign_id", ""))
	var committed_store := FileCampaignStore.new(committed_root, committed_id)
	for generation in range(2, 6):
		var state := committed_store.load_state()
		var commit := committed_store.commit(
			int(state["generation"]),
			{"world": {"revision": generation}},
			state["runtime"]
		)
		_expect(commit.get("ok", false), "committed-compaction fixture advances generation %d" % generation)
	var committed_backup := CampaignBackupManager.new(committed_root, committed_registry).create_restore_tested_backup(committed_id, 3000)
	_expect(committed_backup.get("ok", false), "committed-compaction fixture protects current truth")
	var commit_fault_manager := CampaignBackupManager.new(
		committed_root,
		committed_registry,
		null,
		func(operation: String, phase: String, _subject: String) -> bool:
			return operation == "campaign_compaction" and phase == "after_commit_marker"
	)
	var cleanup_pending := commit_fault_manager.compact_campaign_history(committed_id, 5, true, 3, 3001)
	_expect(cleanup_pending.get("status", "") == "compaction_cleanup_pending", "compaction fault seam simulates process loss after durable commit")
	var cleanup_restart := CampaignBackupManager.new(committed_root, committed_registry).compact_campaign_history(committed_id, 5, true, 3, 3002)
	_expect(cleanup_restart.get("ok", false) and cleanup_restart.get("status", "") == "compaction_current", "committed compaction finishes cleanup after restart")
	_expect(cleanup_restart.get("recovery_events", [])[0].get("status", "") == "compaction_cleanup_completed", "compaction discloses committed cleanup completion")


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


func _run_runtime_coordinator_contract() -> void:
	var data_root := "user://saltmarcher-runtime-tests/%s" % Time.get_ticks_usec()
	var registry := FileCampaignRegistry.new(data_root)
	var first := registry.create_campaign("Erste Runtime")
	var first_id := str(first.get("campaign_id", ""))
	var second := registry.create_campaign("Zweite Runtime")
	var second_id := str(second.get("campaign_id", ""))
	var coordinator := CampaignRuntimeCoordinator.new(data_root, registry)
	var opened := coordinator.open_durable_active()
	_expect(opened.get("ok", false), "runtime coordinator opens durable active Campaign")
	var active_session = coordinator.current_session()
	_expect(active_session != null and active_session.campaign_id() == second_id, "runtime coordinator follows durable active pointer")

	var runtime: Dictionary = active_session.snapshot()["campaign_state"]["runtime"].duplicate(true)
	runtime["focused_workspace"] = "session"
	var mutation := coordinator.commit_current(2, 1, {"session": {"timeline": []}}, runtime)
	_expect(mutation.get("ok", false), "admitted runtime commits through activation generation")
	var stale_activation := coordinator.commit_current(1, 2, {}, runtime)
	_expect(not stale_activation.get("ok", true) and stale_activation.get("status", "") == "stale_activation", "stale activation generation cannot mutate Campaign")

	var switched := coordinator.switch_to(first_id, 2)
	_expect(switched.get("ok", false), "runtime coordinator switches to prepared Campaign")
	_expect(switched.get("registry_state", {}).get("active_campaign_id", "") == first_id, "runtime switch commits durable active pointer")
	var first_session = coordinator.current_session()
	_expect(first_session.activation_generation() == 3 and first_session.admitted(), "new runtime owns fresh admitted activation generation")
	var retired_session = switched.get("prior_session")
	var retired_write: Dictionary = retired_session.commit(2, 2, {}, runtime)
	_expect(not retired_write.get("ok", true) and retired_write.get("status", "") == "revoked", "detached runtime cannot publish late work")

	for generation in [1, 2]:
		var corrupt := FileAccess.open(FileCampaignStore.new(data_root, second_id).commit_path(generation), FileAccess.WRITE)
		corrupt.store_string("{damaged")
		corrupt.close()
	var rejected_target := coordinator.switch_to(second_id, 3)
	_expect(not rejected_target.get("ok", true) and rejected_target.get("status", "") == "target_unready", "unreadable target is rejected before pointer commit")
	_expect(coordinator.current_session() == first_session and first_session.admitted(), "target preparation failure preserves current admitted runtime")
	_expect(registry.load_state().get("active_campaign_id", "") == first_id, "target preparation failure leaves durable pointer unchanged")

	var failure_root := "user://saltmarcher-runtime-pointer-failure/%s" % Time.get_ticks_usec()
	var fault_state := {"fail": false}
	var pointer_fault := func(operation: String, phase: String, _path: String) -> bool:
		return fault_state["fail"] and operation == "registry_commit" and phase == "before_rename"
	var failure_registry := FileCampaignRegistry.new(failure_root, pointer_fault)
	var failure_first := failure_registry.create_campaign("Fallback eins")
	var failure_first_id := str(failure_first.get("campaign_id", ""))
	failure_registry.create_campaign("Fallback zwei")
	var failure_coordinator := CampaignRuntimeCoordinator.new(failure_root, failure_registry)
	failure_coordinator.open_durable_active()
	var fallback_session = failure_coordinator.current_session()
	fault_state["fail"] = true
	var failed_switch := failure_coordinator.switch_to(failure_first_id, 2)
	_expect(not failed_switch.get("ok", true), "pointer publication failure is surfaced by runtime coordinator")
	_expect(fallback_session.admitted(), "definite pre-commit pointer failure resumes prior runtime authority")
	_expect(failure_registry.load_state().get("generation", -1) == 2, "failed pointer publication creates no registry generation")

	var drain_root := "user://saltmarcher-runtime-drain-tests/%s" % Time.get_ticks_usec()
	var drain_registry := FileCampaignRegistry.new(drain_root)
	var drain_created := drain_registry.create_campaign("Drain Session")
	var drain_id := str(drain_created.get("campaign_id", ""))
	var delayed_store := FileCampaignStore.new(
		drain_root,
		drain_id,
		func(operation: String, phase: String, _path: String) -> bool:
			if operation == "campaign_commit" and phase == "before_rename":
				OS.delay_msec(80)
			return false
	)
	var drain_session := CampaignRuntimeSession.new(drain_id, 1, delayed_store, delayed_store.load_state())
	var drain_runtime: Dictionary = drain_session.snapshot()["campaign_state"]["runtime"].duplicate(true)
	drain_runtime["focused_workspace"] = "accepted-write"
	var accepted := drain_session.submit_commit(1, 1, {"session": {"timeline": ["accepted"]}}, drain_runtime)
	_expect(accepted.get("ok", false) and accepted.get("status", "") == "accepted", "runtime session returns a stable ticket only after accepting asynchronous write work")
	var competing := drain_session.submit_commit(1, 1, {}, drain_runtime)
	_expect(not competing.get("ok", true) and competing.get("status", "") == "write_in_flight", "runtime session serializes accepted writes")
	var timed_out := drain_session.drain_and_revoke(0)
	_expect(timed_out.get("status", "") == "drain_timeout" and timed_out.get("retry_available", false), "runtime drain times out without publishing a Campaign switch")
	var premature_resume := drain_session.resume_after_precommit_failure()
	_expect(not premature_resume.get("ok", true) and premature_resume.get("status", "") == "drain_pending", "timed-out session cannot resume while accepted work is still running")
	var late_submission := drain_session.submit_commit(1, 1, {}, drain_runtime)
	_expect(not late_submission.get("ok", true) and late_submission.get("status", "") == "revoked", "draining session rejects later submissions immediately")
	var invalid_timeout := drain_session.drain_and_revoke(-2)
	_expect(invalid_timeout.get("status", "") == "invalid_timeout", "runtime drain reserves only minus one for an orderly unbounded shutdown")
	OS.delay_msec(120)
	var drained := drain_session.drain_and_revoke(1000)
	_expect(drained.get("ok", false) and drained.get("accepted_write_results", []).size() == 1, "retry drains the terminal accepted-write result")
	_expect(drain_session.campaign_generation() == 2 and not drain_session.admitted(), "drain preserves the accepted commit and leaves writer authority revoked")
	var resumed_session := drain_session.resume_after_precommit_failure()
	_expect(resumed_session.get("ok", false) and drain_session.admitted(), "cancelled pre-commit transition can resume authority after drain completion")
	var second_ticket := drain_session.submit_commit(1, 2, {"session": {"timeline": ["polled"]}}, drain_runtime)
	var polled: Dictionary = {}
	for _attempt in 200:
		polled = drain_session.poll_commit(str(second_ticket.get("ticket_id", "")))
		if polled.get("status", "") == "completed":
			break
		OS.delay_msec(2)
	_expect(polled.get("status", "") == "completed" and polled.get("result", {}).get("ok", false), "accepted asynchronous write exposes one terminal poll result")
	drain_session.drain_and_revoke()

	var async_switch_root := "user://saltmarcher-runtime-async-switch-tests/%s" % Time.get_ticks_usec()
	var async_switch_registry := FileCampaignRegistry.new(async_switch_root)
	var async_first := async_switch_registry.create_campaign("Async Ziel")
	var async_first_id := str(async_first.get("campaign_id", ""))
	var async_second := async_switch_registry.create_campaign("Async Quelle")
	var async_second_id := str(async_second.get("campaign_id", ""))
	var async_coordinator := CampaignRuntimeCoordinator.new(
		async_switch_root,
		async_switch_registry,
		func(root_path: String, campaign_id: String):
			return FileCampaignStore.new(
				root_path,
				campaign_id,
				func(operation: String, phase: String, _path: String) -> bool:
					if campaign_id == async_second_id and operation == "campaign_commit" and phase == "before_rename":
						OS.delay_msec(60)
					return false
			)
	)
	var backup_notifications: Array = []
	async_coordinator.set_backup_notifier(func(campaign_id: String, generation: int) -> void:
		backup_notifications.append({"campaign_id": campaign_id, "generation": generation})
	)
	async_coordinator.open_durable_active()
	var async_runtime: Dictionary = async_coordinator.current_session().snapshot()["campaign_state"]["runtime"].duplicate(true)
	var switch_write := async_coordinator.submit_current_commit(2, 1, {"session": {"timeline": ["before-switch"]}}, async_runtime)
	_expect(switch_write.get("ok", false), "coordinator accepts off-main write before Campaign switch")
	var drained_switch := async_coordinator.switch_to(async_first_id, 2, 1000)
	_expect(drained_switch.get("ok", false) and drained_switch.get("registry_state", {}).get("active_campaign_id", "") == async_first_id, "Campaign pointer publishes only after accepted write drain")
	var drained_source := FileCampaignStore.new(async_switch_root, async_second_id).read_partition("session")
	_expect(drained_source.get("payload", {}).get("timeline", []) == ["before-switch"], "switch preserves the exact accepted source-Campaign mutation")
	var source_notifications := backup_notifications.filter(func(notification: Dictionary) -> bool:
		return notification.get("campaign_id", "") == async_second_id
	)
	_expect(
		source_notifications.size() == 1 and source_notifications[0].get("generation", -1) == 2,
		"drained accepted commit reaches automatic recovery scheduling exactly once; got %s" % JSON.stringify(backup_notifications)
	)
	var target_notifications := backup_notifications.filter(func(notification: Dictionary) -> bool:
		return notification.get("campaign_id", "") == async_first_id and notification.get("generation", -1) == 1
	)
	_expect(
		not target_notifications.is_empty(),
		"newly active Campaign is scheduled for preservation and compaction assessment"
	)

	var timeout_root := "user://saltmarcher-runtime-timeout-tests/%s" % Time.get_ticks_usec()
	var timeout_registry := FileCampaignRegistry.new(timeout_root)
	var timeout_first := timeout_registry.create_campaign("Timeout Ziel")
	var timeout_first_id := str(timeout_first.get("campaign_id", ""))
	var timeout_second := timeout_registry.create_campaign("Timeout Quelle")
	var timeout_second_id := str(timeout_second.get("campaign_id", ""))
	var timeout_coordinator := CampaignRuntimeCoordinator.new(
		timeout_root,
		timeout_registry,
		func(root_path: String, campaign_id: String):
			return FileCampaignStore.new(
				root_path,
				campaign_id,
				func(operation: String, phase: String, _path: String) -> bool:
					if campaign_id == timeout_second_id and operation == "campaign_commit" and phase == "before_rename":
						OS.delay_msec(120)
					return false
			)
	)
	timeout_coordinator.open_durable_active()
	var timeout_runtime: Dictionary = timeout_coordinator.current_session().snapshot()["campaign_state"]["runtime"].duplicate(true)
	timeout_coordinator.submit_current_commit(2, 1, {"session": {"timeline": ["slow"]}}, timeout_runtime)
	var timeout_switch := timeout_coordinator.switch_to(timeout_first_id, 2, 1)
	_expect(timeout_switch.get("status", "") == "drain_timeout", "coordinator exposes bounded drain timeout literally")
	_expect(timeout_registry.load_state().get("active_campaign_id", "") == timeout_second_id, "drain timeout leaves durable Campaign pointer unchanged")
	_expect(not timeout_coordinator.current_session().admitted(), "timed-out source rejects late writes until retry or cancel")
	_expect(timeout_coordinator.active_lifecycle_operation() == "switch_recovery", "drain timeout retains lifecycle exclusivity until source recovery")
	OS.delay_msec(160)
	var cancelled_timeout := timeout_coordinator.resume_current_after_cancelled_transition()
	_expect(cancelled_timeout.get("ok", false) and timeout_coordinator.current_session().admitted(), "cancelled timed-out switch safely resumes source authority after write completion")
	_expect(timeout_coordinator.active_lifecycle_operation().is_empty(), "source recovery releases retained lifecycle exclusivity")
	var retried_switch := timeout_coordinator.switch_to(timeout_first_id, 2, 1000)
	_expect(retried_switch.get("ok", false), "Campaign switch retries successfully after timed-out accepted work terminates")

	var write_failure_root := "user://saltmarcher-runtime-write-failure-tests/%s" % Time.get_ticks_usec()
	var write_failure_registry := FileCampaignRegistry.new(write_failure_root)
	var write_failure_first := write_failure_registry.create_campaign("Failure Ziel")
	var write_failure_first_id := str(write_failure_first.get("campaign_id", ""))
	var write_failure_second := write_failure_registry.create_campaign("Failure Quelle")
	var write_failure_second_id := str(write_failure_second.get("campaign_id", ""))
	var write_failure_coordinator := CampaignRuntimeCoordinator.new(
		write_failure_root,
		write_failure_registry,
		func(root_path: String, campaign_id: String):
			return FileCampaignStore.new(
				root_path,
				campaign_id,
				func(operation: String, phase: String, _path: String) -> bool:
					return campaign_id == write_failure_second_id and operation == "campaign_commit" and phase == "before_rename"
			)
	)
	write_failure_coordinator.open_durable_active()
	var failed_runtime: Dictionary = write_failure_coordinator.current_session().snapshot()["campaign_state"]["runtime"].duplicate(true)
	write_failure_coordinator.submit_current_commit(2, 1, {"session": {"timeline": ["fails"]}}, failed_runtime)
	var refused_for_write := write_failure_coordinator.switch_to(write_failure_first_id, 2, 1000)
	_expect(refused_for_write.get("status", "") == "accepted_write_failed", "failed accepted write blocks Campaign pointer publication")
	_expect(write_failure_registry.load_state().get("active_campaign_id", "") == write_failure_second_id, "failed accepted write leaves durable pointer on source Campaign")
	_expect(write_failure_coordinator.current_session().admitted(), "failed accepted write resumes source authority for explicit retry")


func _run_compaction_scheduler_contract() -> void:
	var data_root := "user://saltmarcher-compaction-scheduler-tests/%s" % Time.get_ticks_usec()
	var registry := FileCampaignRegistry.new(data_root)
	var created := registry.create_campaign("Automatic Compaction")
	var campaign_id := str(created.get("campaign_id", ""))
	var coordinator := CampaignRuntimeCoordinator.new(
		data_root,
		registry,
		Callable(),
		func(root_path: String, manager_registry):
			return CampaignBackupManager.new(
				root_path,
				manager_registry,
				null,
				func(operation: String, phase: String, _subject: String) -> bool:
					if operation == "campaign_compaction" and phase == "before_quarantine":
						OS.delay_msec(80)
					return false
			)
	)
	coordinator.open_durable_active()
	var shared_maintenance_mutex := Mutex.new()
	var scheduler := CampaignCompactionScheduler.new(data_root, registry, coordinator, 4, 3, 0, shared_maintenance_mutex)
	coordinator.set_backup_notifier(scheduler.note_confirmed_generation)
	root.add_child(scheduler)
	for _attempt in 200:
		if scheduler.pending_count() == 0 and not scheduler.is_active():
			break
		await create_timer(0.005).timeout
	_expect(scheduler.last_result().get("status", "") == "compaction_not_due", "automatic compaction leaves short Campaign history untouched")
	_expect(coordinator.current_session().admitted(), "not-due compaction assessment never revokes active writer authority")
	var desk := CampaignDesk.new()
	desk.data_root = data_root
	desk.registry = registry
	desk.runtime_coordinator = coordinator
	desk.compaction_scheduler = scheduler
	root.add_child(desk)
	await process_frame
	await process_frame
	var maintenance_name_input := desk.find_child("CampaignNameInput", true, false) as LineEdit
	var maintenance_export := desk.find_child("ExportCampaignButton", true, false) as Button
	var maintenance_import := desk.find_child("ImportCampaignButton", true, false) as Button
	var maintenance_cancel := desk.find_child("CancelCampaignTransferButton", true, false) as Button
	var maintenance_status := desk.find_child("CampaignStatus", true, false) as Label

	for expected_generation in range(1, 4):
		var state: Dictionary = coordinator.current_session().snapshot()["campaign_state"]
		var runtime: Dictionary = state["runtime"].duplicate(true)
		runtime["focused_workspace"] = "automatic-compaction-%d" % (expected_generation + 1)
		var committed := coordinator.commit_current(
			1,
			expected_generation,
			{"world": {"revision": expected_generation + 1}},
			runtime
		)
		_expect(committed.get("ok", false), "automatic-compaction fixture advances generation %d" % (expected_generation + 1))
	var protected := CampaignBackupManager.new(data_root, registry).create_restore_tested_backup(campaign_id, 4000)
	_expect(protected.get("ok", false), "automatic compaction receives an exact current recovery point")
	shared_maintenance_mutex.lock()
	scheduler.note_confirmed_generation(campaign_id, 4)
	var starts: Array = []
	var completions: Array = []
	scheduler.operation_started.connect(func(kind: String, started_campaign_id: String) -> void:
		starts.append({"kind": kind, "campaign_id": started_campaign_id})
	)
	scheduler.operation_completed.connect(func(kind: String, result: Dictionary) -> void:
		completions.append({"kind": kind, "result": result.duplicate(true)})
	)
	for _attempt in 300:
		if not starts.is_empty():
			break
		await create_timer(0.005).timeout
	_expect(not starts.is_empty() and coordinator.active_lifecycle_operation().is_empty(), "compaction waits outside lifecycle authority while shared backup maintenance owns the recovery pool")
	shared_maintenance_mutex.unlock()
	for _attempt in 300:
		if coordinator.active_lifecycle_operation() == "compaction":
			break
		await create_timer(0.005).timeout
	_expect(starts.size() == 1 and scheduler.is_active(), "due compaction starts one observable background operation")
	_expect(
		maintenance_name_input != null and not maintenance_name_input.editable
		and maintenance_export != null and maintenance_export.disabled
		and maintenance_import != null and maintenance_import.disabled
		and maintenance_cancel != null and maintenance_cancel.disabled,
		"visible Campaign desk fences create and transfer actions without exposing false cancellation during compaction"
	)
	_expect(
		maintenance_status != null and maintenance_status.text.contains("verdichtet"),
		"visible Campaign desk discloses active local compaction"
	)
	var maintenance_export_attempt := desk.start_export_to_path(data_root + "/exports/during-maintenance.saltmarcher")
	_expect(maintenance_export_attempt.get("status", "") == "maintenance_busy", "programmatic export cannot bypass active compaction fence")
	var competing_switch := coordinator.switch_to(campaign_id, 1)
	_expect(competing_switch.get("status", "") == "lifecycle_busy", "Campaign switch cannot race active compaction lifecycle authority")
	var invalid_resume := coordinator.resume_current_after_cancelled_transition()
	_expect(invalid_resume.get("status", "") == "no_transition_recovery", "transition recovery cannot re-admit a writer during compaction")
	for _attempt in 500:
		if not completions.is_empty() and scheduler.pending_count() == 0 and not scheduler.is_active():
			break
		await create_timer(0.005).timeout
	_expect(
		completions.size() == 1 and completions[0].get("result", {}).get("status", "") == "campaign_compacted",
		"automatic scheduler completes safe active-Campaign compaction"
	)
	_expect(coordinator.current_session().admitted(), "automatic compaction restores active writer authority on completion")
	_expect(coordinator.active_lifecycle_operation().is_empty(), "automatic compaction releases lifecycle exclusivity")
	_expect(maintenance_name_input.editable and not maintenance_export.disabled and not maintenance_import.disabled, "Campaign desk releases its maintenance fence only after terminal completion")
	var commit_count := DirAccess.get_files_at(
		ProjectSettings.globalize_path(data_root + "/campaigns/" + campaign_id + "/commits")
	).size()
	_expect(commit_count == 3, "automatic compaction retains the configured three-generation local fallback")
	var state_after := FileCampaignStore.new(data_root, campaign_id).load_state()
	_expect(state_after.get("ok", false) and state_after.get("generation", -1) == 4, "automatic compaction preserves exact active Campaign truth")

	shared_maintenance_mutex.lock()
	var generation_five_runtime: Dictionary = state_after["runtime"].duplicate(true)
	var generation_five := coordinator.commit_current(
		1,
		4,
		{"world": {"revision": 5}},
		generation_five_runtime
	)
	_expect(generation_five.get("ok", false), "generation-race fixture publishes work before compaction owns lifecycle authority")
	for _attempt in 300:
		if starts.size() >= 2:
			break
		await create_timer(0.005).timeout
	_expect(starts.size() >= 2 and coordinator.active_lifecycle_operation().is_empty(), "due re-compaction waits on shared maintenance before revoking writer authority")
	var generation_six_runtime: Dictionary = generation_five.get("state", {}).get("runtime", {}).duplicate(true)
	var generation_six := coordinator.commit_current(
		1,
		5,
		{"world": {"revision": 6}},
		generation_six_runtime
	)
	_expect(generation_six.get("ok", false), "newer accepted truth can win before delayed compaction lifecycle admission")
	CampaignBackupManager.new(data_root, registry).create_restore_tested_backup(campaign_id, 4100)
	shared_maintenance_mutex.unlock()
	for _attempt in 600:
		if completions.size() >= 3 and scheduler.pending_count() == 0 and not scheduler.is_active():
			break
		await create_timer(0.005).timeout
	_expect(completions.size() >= 2 and completions[1].get("result", {}).get("status", "") == "stale", "superseded compaction emits one terminal stale result and releases its visible fence")
	_expect(completions.size() == 3 and completions[2].get("result", {}).get("status", "") == "campaign_compacted", "scheduler reassesses and compacts the newer protected generation")
	_expect(maintenance_name_input.editable and not maintenance_export.disabled, "generation-race retry leaves no stale maintenance UI fence")
	var generation_race_state := FileCampaignStore.new(data_root, campaign_id).load_state()
	_expect(generation_race_state.get("ok", false) and generation_race_state.get("generation", -1) == 6, "generation-race compaction preserves the newest Campaign truth")
	desk.queue_free()
	scheduler.queue_free()
	await process_frame
	await process_frame


func _run_runtime_transition_controller_contract() -> void:
	var data_root := "user://saltmarcher-runtime-transition-tests/%s" % Time.get_ticks_usec()
	var registry := FileCampaignRegistry.new(data_root)
	var target := registry.create_campaign("Controller Ziel")
	var target_id := str(target.get("campaign_id", ""))
	var source := registry.create_campaign("Controller Quelle")
	var source_id := str(source.get("campaign_id", ""))
	var coordinator := CampaignRuntimeCoordinator.new(
		data_root,
		registry,
		func(root_path: String, campaign_id: String):
			return FileCampaignStore.new(
				root_path,
				campaign_id,
				func(operation: String, phase: String, _path: String) -> bool:
					if campaign_id == source_id and operation == "campaign_commit" and phase == "before_rename":
						OS.delay_msec(120)
					return false
			)
	)
	coordinator.open_durable_active()
	var runtime: Dictionary = coordinator.current_session().snapshot()["campaign_state"]["runtime"].duplicate(true)
	var accepted := coordinator.submit_current_commit(2, 1, {"session": {"timeline": ["controller-drain"]}}, runtime)
	_expect(accepted.get("ok", false), "transition-controller fixture accepts source write")
	var controller := CampaignRuntimeTransitionController.new(coordinator, 1)
	root.add_child(controller)
	var completions: Array = []
	var recoveries: Array = []
	controller.transition_completed.connect(func(kind: String, result: Dictionary) -> void:
		completions.append({"kind": kind, "result": result.duplicate(true)})
	)
	controller.transition_recovered.connect(func(result: Dictionary) -> void:
		recoveries.append(result.duplicate(true))
	)
	var started := controller.switch_to(target_id, 2)
	_expect(started.get("ok", false) and controller.is_active(), "transition controller admits one non-blocking Campaign switch")
	for _attempt in 200:
		if not completions.is_empty():
			break
		await create_timer(0.005).timeout
	_expect(
		completions.size() == 1 and completions[0].get("result", {}).get("status", "") == "drain_timeout",
		"transition controller surfaces its bounded drain timeout on the main thread"
	)
	_expect(registry.load_state().get("active_campaign_id", "") == source_id, "controller timeout leaves the durable pointer on the source Campaign")
	_expect(controller.is_active() and not coordinator.current_session().admitted(), "controller keeps competing actions fenced while timed-out work terminates")
	var competing := controller.switch_to(target_id, 2)
	_expect(competing.get("status", "") == "transition_recovery_pending", "controller refuses a new switch during timeout recovery")
	for _attempt in 300:
		if not recoveries.is_empty():
			break
		await create_timer(0.005).timeout
	_expect(recoveries.size() == 1 and recoveries[0].get("ok", false), "controller automatically resumes source authority after the accepted write terminates")
	_expect(not controller.is_active() and coordinator.current_session().admitted(), "controller releases the UI fence only after source authority is restored")
	var source_partition := FileCampaignStore.new(data_root, source_id).read_partition("session")
	_expect(source_partition.get("payload", {}).get("timeline", []) == ["controller-drain"], "controller recovery preserves the exact accepted source write")
	controller.queue_free()
	await process_frame


func _run_permanent_deletion_contract() -> void:
	var data_root := "user://saltmarcher-permanent-delete-tests/%s" % Time.get_ticks_usec()
	var registry := FileCampaignRegistry.new(data_root)
	var created := registry.create_campaign("Endgültig")
	var campaign_id := str(created.get("campaign_id", ""))
	var trashed := registry.trash_campaign(campaign_id, 1)
	var trash_entry_id := str(trashed.get("trash_entry_id", ""))
	var refused := registry.permanently_delete_trashed_campaign(trash_entry_id, "wrong-confirmation")
	_expect(not refused.get("ok", true), "permanent Campaign deletion requires exact explicit confirmation")
	_expect(DirAccess.dir_exists_absolute(ProjectSettings.globalize_path(registry.trash_entry_path(trash_entry_id))), "refused permanent deletion leaves recoverable trash intact")
	var deleted := registry.permanently_delete_trashed_campaign(trash_entry_id, trash_entry_id)
	_expect(deleted.get("ok", false), "explicit permanent Campaign deletion succeeds")
	_expect(deleted.get("removed_file_count", 0) >= 2 and deleted.get("removed_bytes", 0) > 0, "permanent deletion reports removed material")
	_expect(not DirAccess.dir_exists_absolute(ProjectSettings.globalize_path(registry.trash_entry_path(trash_entry_id))), "permanently deleted Campaign is no longer recoverable")


func _run_campaign_conflict_ui_journey(bundle_path: String) -> void:
	var data_root := "user://saltmarcher-conflict-ui-tests/%s" % Time.get_ticks_usec()
	var registry := FileCampaignRegistry.new(data_root)
	var created := registry.create_campaign("Bestehende Wolfsrunde")
	var existing_campaign_id := str(created.get("campaign_id", ""))
	var definitions := SharedDefinitionStore.new(data_root)
	var prepared := definitions.prepare_generation(0, [{
		"definition_id": "creature.wolf",
		"kind": "creature",
		"name": "Wolf",
		"content": {"armor_class": 17, "movement": "30 ft"},
	}])
	var published := registry.publish_shared_definitions_generation(
		int(prepared.get("generation", -1)),
		int(created.get("state", {}).get("generation", -1))
	)
	var existing_store := FileCampaignStore.new(data_root, existing_campaign_id)
	var existing_state := existing_store.load_state()
	existing_store.commit(
		int(existing_state.get("generation", -1)),
		{},
		existing_state.get("runtime", {}),
		[],
		0,
		["creature.wolf"]
	)
	_expect(published.get("ok", false), "conflict UI fixture publishes its local Shared Definition")

	var desk := CampaignDesk.new()
	desk.data_root = data_root
	desk.registry = registry
	desk.runtime_coordinator = CampaignRuntimeCoordinator.new(data_root, registry)
	desk.runtime_coordinator.open_durable_active()
	root.add_child(desk)
	await process_frame
	await process_frame
	var started := desk.start_import_from_path(bundle_path)
	_expect(started.get("ok", false), "Campaign desk starts a conflicting import")
	for _frame in 300:
		if not desk.portability_controller.is_active():
			break
		await process_frame
	await process_frame
	await process_frame

	var overlay := desk.find_child("DefinitionConflictOverlay", true, false) as Control
	var affected := desk.find_child("DefinitionConflictAffectedCampaigns", true, false) as Label
	var keep_choice := desk.find_child("KeepExistingDefinitionChoice", true, false) as CheckBox
	var imported_choice := desk.find_child("UseImportedDefinitionChoice", true, false) as CheckBox
	var both_choice := desk.find_child("RetainBothDefinitionsChoice", true, false) as CheckBox
	var continue_button := desk.find_child("ContinueConflictingImportButton", true, false) as Button
	var keep_consequence := desk.find_child("KeepExistingDefinitionChoiceConsequence", true, false) as Label
	var imported_consequence := desk.find_child("UseImportedDefinitionChoiceConsequence", true, false) as Label
	var both_consequence := desk.find_child("RetainBothDefinitionsChoiceConsequence", true, false) as Label
	_expect(overlay != null and overlay.visible, "definition conflict opens the blocking production conflict ledger")
	_expect(affected != null and affected.text.contains("Bestehende Wolfsrunde"), "conflict ledger names every affected existing Campaign")
	_expect(
		keep_consequence != null and not keep_consequence.text.is_empty()
		and imported_consequence != null and not imported_consequence.text.is_empty()
		and both_consequence != null and not both_consequence.text.is_empty(),
		"conflict ledger shows all three consequences before a decision"
	)
	_expect(keep_choice != null and keep_choice.has_focus(), "conflict ledger moves keyboard focus to its first explicit choice")
	_expect(continue_button != null and continue_button.disabled, "conflict import cannot continue without an explicit choice")
	if both_choice != null and continue_button != null:
		both_choice.button_pressed = true
		both_choice.toggled.emit(true)
		_expect(not continue_button.disabled, "explicit retain-both choice enables conflict completion")
		continue_button.pressed.emit()
		for _frame in 300:
			if not desk.portability_controller.is_active():
				break
			await process_frame
		await process_frame
	var final_state := registry.load_state()
	_expect(final_state.get("campaigns", []).size() == 2, "conflict ledger atomically completes one independent imported Campaign")
	_expect(overlay != null and not overlay.visible, "successful conflict resolution closes the modal ledger")
	var imported_campaign_id := ""
	for campaign in final_state.get("campaigns", []):
		if campaign.get("id", "") != existing_campaign_id:
			imported_campaign_id = str(campaign.get("id", ""))
	var imported_state := FileCampaignStore.new(data_root, imported_campaign_id).load_state()
	_expect(
		not imported_campaign_id.is_empty()
		and imported_state.get("shared_definition_refs", []).size() == 1
		and imported_state.get("shared_definition_refs", [""])[0] != "creature.wolf",
		"visible retain-both decision remaps only the imported Campaign"
	)
	desk.queue_free()
	await process_frame


func _run_campaign_desk_journey() -> void:
	var data_root := "user://saltmarcher-ui-tests/%s" % Time.get_ticks_usec()
	var registry := FileCampaignRegistry.new(data_root)
	var desk := CampaignDesk.new()
	desk.data_root = data_root
	desk.registry = registry
	desk.runtime_coordinator = CampaignRuntimeCoordinator.new(data_root, registry)
	desk.runtime_coordinator.open_durable_active()
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
	_expect(create_button.disabled and desk.runtime_transition_controller.is_active(), "Campaign creation leaves the UI thread and disables competing Campaign actions")
	var after_first: Dictionary = {}
	for _attempt in 300:
		await create_timer(0.01).timeout
		after_first = registry.load_state()
		if after_first.get("campaigns", []).size() == 1 and not desk.runtime_transition_controller.is_active():
			break
	_expect(after_first.get("campaigns", []).size() == 1, "Enter creates a campaign through the Godot production UI")
	var first_ui_id := str(after_first.get("active_campaign_id", ""))

	name_input.text = "Nebenpfad"
	name_input.text_changed.emit(name_input.text)
	name_input.text_submitted.emit(name_input.text)
	var after_second: Dictionary = {}
	for _attempt in 300:
		await create_timer(0.01).timeout
		after_second = registry.load_state()
		if after_second.get("campaigns", []).size() == 2 and not desk.runtime_transition_controller.is_active():
			break
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
		_expect(desk.runtime_transition_controller.is_active(), "Campaign button starts a non-blocking runtime transition")
		var after_switch: Dictionary = {}
		for _attempt in 300:
			await create_timer(0.01).timeout
			after_switch = registry.load_state()
			if after_switch.get("active_campaign_id", "") == first_ui_id and not desk.runtime_transition_controller.is_active():
				break
		_expect(after_switch.get("active_campaign_id", "") == first_ui_id, "campaign button switches the active campaign")

	var export_button := desk.find_child("ExportCampaignButton", true, false) as Button
	var import_button := desk.find_child("ImportCampaignButton", true, false) as Button
	var cancel_button := desk.find_child("CancelCampaignTransferButton", true, false) as Button
	var transfer_progress := desk.find_child("CampaignTransferProgress", true, false) as ProgressBar
	_expect(export_button != null and import_button != null and cancel_button != null, "Campaign desk exposes keyboard-focusable transfer controls")
	_expect(export_button != null and not export_button.disabled, "active Campaign enables complete export")
	var completed_operations: Array = []
	desk.portability_controller.operation_completed.connect(func(kind: String, result: Dictionary) -> void:
		completed_operations.append({"kind": kind, "result": result.duplicate(true)})
	)
	var ui_bundle_path := data_root + "/exports/ui-roundtrip.saltmarcher"
	var export_started := desk.start_export_to_path(ui_bundle_path)
	_expect(export_started.get("ok", false), "Campaign desk starts export through its production worker")
	_expect(export_button.disabled and import_button.disabled and not cancel_button.disabled, "running transfer disables competing actions and exposes cancellation")
	var competing_transfer := desk.start_import_from_path(ui_bundle_path)
	_expect(competing_transfer.get("status", "") == "busy", "Campaign desk admits at most one portability worker")
	for _frame in 300:
		if not desk.portability_controller.is_active():
			break
		await process_frame
	await process_frame
	_expect(not completed_operations.is_empty() and completed_operations.back().get("kind", "") == "export", "Campaign desk receives worker export completion")
	_expect(completed_operations.back().get("result", {}).get("ok", false) and FileAccess.file_exists(ui_bundle_path), "Campaign desk writes a complete portable bundle")
	_expect(transfer_progress.value > 0, "Campaign desk exposes determinate transfer progress")

	var import_started := desk.start_import_from_path(ui_bundle_path)
	_expect(import_started.get("ok", false), "Campaign desk starts import through its production worker")
	for _frame in 300:
		if not desk.portability_controller.is_active():
			break
		await process_frame
	await process_frame
	var after_ui_import := registry.load_state()
	_expect(after_ui_import.get("campaigns", []).size() == 3, "Campaign desk imports one independent Campaign through the worker")
	_expect(after_ui_import.get("active_campaign_id", "") == first_ui_id, "Campaign desk import does not replace the active Campaign")
	_expect(not export_button.disabled and not import_button.disabled and cancel_button.disabled, "completed transfer restores ordinary Campaign controls")

	desk.queue_free()
	await process_frame


func _expect(condition: bool, message: String) -> void:
	if not condition:
		_failures.append(message)


func _has_no_child_directories(path: String) -> bool:
	var absolute_path := ProjectSettings.globalize_path(path)
	return (
		not DirAccess.dir_exists_absolute(absolute_path)
		or DirAccess.get_directories_at(absolute_path).is_empty()
	)
