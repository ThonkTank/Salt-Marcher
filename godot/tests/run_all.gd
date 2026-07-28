extends SceneTree

const FileCampaignRegistry = preload("res://godot/src/platform/persistence/file_campaign_registry.gd")
const FileCampaignStore = preload("res://godot/src/platform/persistence/file_campaign_store.gd")
const CampaignBackupManager = preload("res://godot/src/platform/persistence/campaign_backup_manager.gd")
const CampaignBackupClosure = preload("res://godot/src/platform/persistence/campaign_backup_closure.gd")
const CampaignBundle = preload("res://godot/src/platform/portability/campaign_bundle.gd")
const SharedDefinitionStore = preload("res://godot/src/platform/persistence/shared_definition_store.gd")
const CampaignDesk = preload("res://godot/src/ui/campaign_desk.gd")
const MainShell = preload("res://godot/src/ui/main_shell.gd")
const CatalogWorkspace = preload("res://godot/src/ui/catalog_workspace.gd")
const CatalogBrowseController = preload("res://godot/src/features/catalog/catalog_browse_controller.gd")
const WorldPlannerKnowledge = preload("res://godot/src/features/worldplanner/world_planner_knowledge.gd")
const WorldPlannerCommandController = preload("res://godot/src/features/worldplanner/world_planner_command_controller.gd")
const WorldPlannerDetailReadController = preload("res://godot/src/features/worldplanner/world_planner_detail_read_controller.gd")
const WorldPlannerNarrativeReadController = preload("res://godot/src/features/worldplanner/world_planner_narrative_read_controller.gd")
const WorldPlannerReferenceOptionsController = preload("res://godot/src/features/worldplanner/world_planner_reference_options_controller.gd")
const WorldPlannerNarrativeThreads = preload("res://godot/src/ui/world_planner_narrative_threads.gd")
const WorldPlannerReferencePicker = preload("res://godot/src/ui/world_planner_reference_picker.gd")
const CampaignRuntimeCoordinator = preload("res://godot/src/app/campaign_runtime_coordinator.gd")
const CampaignRuntimeSession = preload("res://godot/src/app/campaign_runtime_session.gd")
const CampaignPortabilityController = preload("res://godot/src/app/campaign_portability_controller.gd")
const CampaignRuntimeTransitionController = preload("res://godot/src/app/campaign_runtime_transition_controller.gd")
const CampaignBackupScheduler = preload("res://godot/src/app/campaign_backup_scheduler.gd")
const CampaignCompactionScheduler = preload("res://godot/src/app/campaign_compaction_scheduler.gd")
const PartyRoster = preload("res://godot/src/features/party/party_roster.gd")
const PartyCommandController = preload("res://godot/src/features/party/party_command_controller.gd")
const PartyReadController = preload("res://godot/src/features/party/party_read_controller.gd")
const PartyTopBar = preload("res://godot/src/ui/party_top_bar.gd")
const PartyAdventuringDay = preload("res://godot/src/features/party/party_adventuring_day.gd")
const AdventuringDayCalculationController = preload("res://godot/src/features/party/adventuring_day_calculation_controller.gd")
const AdventuringDayTopBar = preload("res://godot/src/ui/adventuring_day_top_bar.gd")
const StorageCapacityGuard = preload("res://godot/src/platform/persistence/storage_capacity_guard.gd")
const PlatformVolumeCapacityProbe = preload("res://godot/src/platform/persistence/platform_volume_capacity_probe.gd")

var _failures: Array[String] = []


class PortabilityCancellationProbe:
	extends RefCounted

	var mode: String
	var publication_state: Dictionary
	var publication_mutex: Mutex


	func _init(next_mode: String, shared_state: Dictionary, shared_mutex: Mutex) -> void:
		mode = next_mode
		publication_state = shared_state
		publication_mutex = shared_mutex


	func export_campaign(
		_campaign_id: String,
		_destination_path: String,
		progress: Callable,
		cancellation: Callable
	) -> Dictionary:
		progress.call({"phase": "started", "completed": 0, "total": 3})
		for _attempt in 500:
			if cancellation.call():
				return _cancelled()
			if mode != "early":
				break
			OS.delay_msec(1)
		progress.call({"phase": "middle", "completed": 1, "total": 3})
		for _attempt in 500:
			if cancellation.call():
				return _cancelled()
			if mode != "mid":
				break
			OS.delay_msec(1)
		publication_mutex.lock()
		publication_state["count"] = int(publication_state.get("count", 0)) + 1
		publication_mutex.unlock()
		progress.call({"phase": "committed", "completed": 3, "total": 3})
		OS.delay_msec(30)
		return {"ok": true, "status": "exported", "publication_count": 1}


	func _cancelled() -> Dictionary:
		return {"ok": false, "status": "cancelled"}


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
	_run_binary_content_contract()
	await _run_adventuring_day_contract()
	await _run_party_roster_contract()
	await _run_world_planner_knowledge_contract()
	await _run_catalog_foundation_contract()

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
		await _run_portability_controller_resource_contract()
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
	_expect(initial.get("asset_refs", {"unexpected": true}).is_empty(), "new campaign starts without asset references")
	_expect(initial.get("chunk_refs", {"unexpected": true}).is_empty(), "new campaign starts without chunk references")

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


func _run_adventuring_day_contract() -> void:
	var model := PartyAdventuringDay.new()
	var level_three := model.budget_for_level(3)
	_expect(
		level_three.get("total_budget_xp", -1) == 1_200
		and level_three.get("first_short_rest_xp", -1) == 400
		and level_three.get("second_short_rest_xp", -1) == 800,
		"Adventuring Day preserves the level budget and thirds policy"
	)
	var budget := model.calculate([3, 3, 4, 4], 5_800)
	_expect(
		budget.get("ok", false)
		and budget.get("budget", {}).get("total_budget_xp", -1) == 5_800
		and budget.get("budget", {}).get("first_short_rest_xp", -1) == 1_933
		and budget.get("budget", {}).get("second_short_rest_xp", -1) == 3_867
		and budget.get("progress", {}).get("short_rests", -1) == 2
		and budget.get("progress", {}).get("long_rests", -1) == 1
		and is_equal_approx(float(budget.get("progress", {}).get("total_days", -1.0)), 1.0),
		"Adventuring Day calculates one complete mixed-level budget with exact rest milestones"
	)
	_expect(
		model.calculate_rows([{"level": 1, "count": 3}], 1).get("progress", {}).get("per_character_awarded_xp", -1) == 1,
		"equal Adventuring Day XP shares use the binding ceiling rule"
	)
	var progress := model.calculate([3, 3, 4, 4], 7_200)
	var level_up_events: Array = progress.get("progress", {}).get("events", []).filter(func(event: Dictionary) -> bool:
		return event.get("type", "") == "level_up"
	)
	_expect(
		level_up_events.size() == 1
		and level_up_events[0].get("group_xp", -1) == 7_197
		and level_up_events[0].get("new_level", -1) == 4
		and level_up_events[0].get("affected_characters", -1) == 2
		and level_up_events[0].get("partial_day", false),
		"Adventuring Day groups level-ups at the ceiling-share breakpoint on the correct partial-day timeline"
	)
	_expect(
		progress.get("provenance", {}).get("rule_profile_id", "") == PartyAdventuringDay.RULE_PROFILE_ID
		and "equal-xp-shares-ceiling" in str(progress.get("provenance", {}).get("rounding_rule_id", ""))
		and progress.get("provenance", {}).get("inputs", {}).get("level_counts", []).size() == 2,
		"Adventuring Day publishes offline rule profile, normalized inputs, and rounding provenance"
	)
	var summary := model.summary([
		{"character_id": "pc.one", "level": 3, "xp_since_long_rest": 350, "short_rests_taken_since_long_rest": 0},
		{"character_id": "pc.two", "level": 3, "xp_since_long_rest": 500, "short_rests_taken_since_long_rest": 1},
	])
	_expect(
		summary.get("status", "") == "ready"
		and summary.get("remaining_to_short_rest", -1) == 175
		and summary.get("remaining_to_long_rest", -1) == 775
		and summary.get("consumed_xp", -1) == 850
		and summary.get("consumed_percent", -1) == 35
		and summary.get("cadence", [])[0].get("urgency", "") == "soon",
		"active Party summary derives averaged rest cadence without mutating Roster progress"
	)
	_expect(
		model.summary([{"character_id": "pc.unknown", "level": null}]).get("status", "") == "incomplete_levels",
		"automatic active-Party budget refuses to invent a missing authored level"
	)
	_expect(
		not model.calculate([], 0).get("ok", true)
		and not model.calculate([21], 0).get("ok", true)
		and not model.calculate([1], -1).get("ok", true),
		"Adventuring Day rejects empty, out-of-range, and negative calculation inputs"
	)
	var large_cohort := model.calculate_rows([{"level": 20, "count": 100_000}], 0)
	_expect(
		large_cohort.get("ok", false)
		and large_cohort.get("budget", {}).get("character_count", -1) == 100_000
		and large_cohort.get("budget", {}).get("total_budget_xp", -1) == 4_000_000_000,
		"counted Adventuring Day cohorts avoid an artificial character-content cap"
	)
	var reference_durations_usec: Array[int] = []
	for _run in 20:
		var started_usec := Time.get_ticks_usec()
		var reference := model.calculate_rows([
			{"level": 3, "count": 2},
			{"level": 4, "count": 2},
		], 11_600)
		reference_durations_usec.append(Time.get_ticks_usec() - started_usec)
		_expect(reference.get("ok", false), "Adventuring Day reference workload remains deterministic")
	reference_durations_usec.sort()
	_expect(
		reference_durations_usec[18] < 2_000_000,
		"Adventuring Day 20-run reference workload stays below the two-second p95 product budget"
	)

	var controller := AdventuringDayCalculationController.new()
	root.add_child(controller)
	var results: Array = []
	controller.result_published.connect(func(result: Dictionary) -> void: results.append(result.duplicate(true)))
	var first := controller.calculate([20], PartyAdventuringDay.MAX_GROUP_XP)
	var replacement := controller.calculate([3], 1_200)
	_expect(
		first.get("status", "") == "started" and replacement.get("status", "") == "queued",
		"Adventuring Day calculation admits one active and one latest-wins request"
	)
	for _attempt in 2400:
		if not controller.is_active():
			break
		await create_timer(0.001).timeout
	await process_frame
	_expect(
		results.size() == 1
		and results[0].get("request", {}).get("rows", []) == [{"level": 3, "count": 1}]
		and results[0].get("progress", {}).get("long_rests", -1) == 1,
		"superseded Adventuring Day work cannot publish over the latest calculation"
	)
	var resources := controller.resource_snapshot()
	_expect(
		resources.get("active_count", -1) == 0
		and resources.get("pending_count", -1) == 0
		and resources.get("worker_handle_count", -1) == 0,
		"Adventuring Day calculation releases worker and pending state"
	)
	controller.queue_free()
	await process_frame


func _run_party_roster_contract() -> void:
	var model := PartyRoster.new()
	var payload := model.empty_payload()
	var first := model.create_character(payload, "Iria", {}, "pc.iria", "2026-07-28T12:00:00Z")
	_expect(
		first.get("ok", false)
		and first.get("character", {}).get("level", 1) == null
		and first.get("character", {}).get("player_name", "sentinel") == null
		and first.get("character", {}).get("membership", "") == "reserve"
		and first.get("character", {}).get("travel", {}).get("kind", "") == "detached",
		"Party name-only creation preserves optional absence and does not activate or attach the PC"
	)
	var attached_without_location: Dictionary = first.get("payload", {}).duplicate(true)
	attached_without_location["characters"]["pc.iria"]["travel"]["attached_to_party_token"] = true
	_expect(
		model.validate_payload(attached_without_location).get("ok", false),
		"Party token attachment remains valid before a concrete travel location exists"
	)
	payload = first.get("payload", payload)
	var namesake := model.create_character(
		payload,
		"Iria",
		{"player_name": "Nela", "level": 2},
		"pc.iria.two",
		"2026-07-28T12:00:01Z"
	)
	_expect(namesake.get("ok", false), "Party allows same-named PCs with independent stable Roster identities")
	payload = namesake.get("payload", payload)
	var updated := model.update_character(
		payload,
		"pc.iria",
		"Iria Salzweg",
		{"player_name": "Mika", "level": 4, "passive_perception": 15, "armor_class": 17},
		"2026-07-28T12:00:02Z"
	)
	_expect(
		updated.get("ok", false)
		and updated.get("character", {}).get("current_xp", -1) == 2_700
		and updated.get("character", {}).get("passive_perception", -1) == 15,
		"Party edit applies optional combat facts and establishes the authored level XP floor"
	)
	payload = updated.get("payload", payload)
	var activated := model.set_membership(payload, "pc.iria", "active", "2026-07-28T12:00:03Z")
	_expect(activated.get("ok", false), "current Party membership changes through an explicit owner command")
	payload = activated.get("payload", payload)
	var filtered := model.snapshot(payload, "Nela")
	_expect(
		filtered.get("roster", []).size() == 1
		and filtered.get("active", []).size() == 1
		and filtered.get("summary", {}).get("active_count", -1) == 1,
		"Roster search does not filter or redefine current Party truth"
	)
	var bounded := model.snapshot(payload, "Iria", false, 1)
	_expect(
		bounded.get("roster", []).size() == 1 and bounded.get("matched", -1) == 2,
		"bounded Party search reports all matches separately from returned rows"
	)
	var awarded := model.adjust_xp(payload, ["pc.iria"], 500, "2026-07-28T12:00:04Z")
	payload = awarded.get("payload", payload)
	var corrected := model.adjust_xp(payload, ["pc.iria"], -10_000, "2026-07-28T12:00:05Z")
	_expect(
		awarded.get("applied_by_id", {}).get("pc.iria", -1) == 500
		and corrected.get("applied_by_id", {}).get("pc.iria", 1) == -500
		and corrected.get("payload", {}).get("characters", {}).get("pc.iria", {}).get("current_xp", -1) == 2_700,
		"negative XP correction stops at the currently authored level floor"
	)
	payload = corrected.get("payload", payload)
	var new_award := model.adjust_xp(payload, ["pc.iria"], 300, "2026-07-28T12:00:06Z")
	payload = new_award.get("payload", payload)
	var short_rest := model.perform_rest(payload, "short", "2026-07-28T12:00:07Z")
	var rested_character: Dictionary = short_rest.get("payload", {}).get("characters", {}).get("pc.iria", {})
	_expect(
		rested_character.get("xp_since_long_rest", -1) == 300
		and rested_character.get("xp_since_short_rest", -1) == 0
		and rested_character.get("short_rests_taken_since_long_rest", -1) == 1,
		"short rest resets only short-rest progress for active Party members"
	)
	payload = short_rest.get("payload", payload)
	var long_rest := model.perform_rest(payload, "long", "2026-07-28T12:00:08Z")
	rested_character = long_rest.get("payload", {}).get("characters", {}).get("pc.iria", {})
	_expect(
		rested_character.get("xp_since_long_rest", -1) == 0
		and rested_character.get("short_rests_taken_since_long_rest", -1) == 0,
		"long rest resets both rest-progress windows for active Party members"
	)
	payload = long_rest.get("payload", payload)
	var trashed := model.trash_character(payload, "pc.iria", "2026-07-28T12:00:09Z")
	var restored := model.restore_character(trashed.get("payload", {}), "pc.iria", "2026-07-28T12:00:10Z")
	_expect(
		restored.get("ok", false)
		and restored.get("character", {}).get("character_id", "") == "pc.iria"
		and restored.get("character", {}).get("membership", "") == "reserve"
		and restored.get("character", {}).get("travel", {}).get("kind", "") == "detached",
		"Party restore preserves identity but never silently rejoins current Party or travel"
	)
	_expect(not model.create_character(restored.get("payload", {}), " ").get("ok", true), "Party rejects blank names without publishing a candidate")
	_expect(not model.update_character(restored.get("payload", {}), "pc.iria", "Iria", {"level": 21}).get("ok", true), "Party rejects out-of-range optional facts without mutation")

	var data_root := "user://saltmarcher-party-runtime/%s" % Time.get_ticks_usec()
	var registry := FileCampaignRegistry.new(data_root)
	var created := registry.create_campaign("Party Runtime")
	var campaign_id := str(created.get("campaign_id", ""))
	var coordinator := CampaignRuntimeCoordinator.new(data_root, registry)
	_expect(coordinator.open_durable_active().get("ok", false), "Party runtime opens the serial Campaign writer")
	var commands := PartyCommandController.new(data_root, coordinator)
	root.add_child(commands)
	var completions: Array = []
	commands.command_completed.connect(func(result: Dictionary) -> void: completions.append(result.duplicate(true)))
	commands.create_character("Kael", {"player_name": "Nela", "level": 3})
	for _attempt in 1200:
		if not completions.is_empty():
			break
		await create_timer(0.001).timeout
	_expect(completions.size() == 1 and completions[0].get("status", "") == "created", "Party command publishes through the shared asynchronous partition writer")
	var persisted := FileCampaignStore.new(data_root, campaign_id).read_partition(PartyRoster.OWNER)
	var persisted_snapshot := model.snapshot(persisted.get("payload", {}))
	_expect(
		persisted_snapshot.get("roster", []).size() == 1
		and persisted_snapshot.get("roster", [])[0].get("player_name", "") == "Nela",
		"Party owner partition survives an independent store reopen and JSON round trip"
	)
	var reads := PartyReadController.new(data_root)
	root.add_child(reads)
	var read_results: Array = []
	reads.result_published.connect(func(result: Dictionary) -> void: read_results.append(result.duplicate(true)))
	var first_read := reads.query("")
	var replacement_read := reads.query("Kael")
	_expect(first_read.get("status", "") == "started" and replacement_read.get("status", "") == "queued", "Party read lane admits one active and one latest-wins request")
	for _attempt in 1200:
		if not reads.is_active():
			break
		await create_timer(0.001).timeout
	await process_frame
	_expect(read_results.size() == 1 and read_results[0].get("roster", []).size() == 1, "Party read lane suppresses superseded result publication")
	var read_resources := reads.resource_snapshot()
	_expect(read_resources.get("worker_handle_count", -1) == 0 and read_resources.get("pending_count", -1) == 0, "Party read lane releases worker and pending state")
	reads.queue_free()
	await process_frame

	var shell := MainShell.new()
	shell.data_root = data_root
	shell.registry = registry
	shell.runtime_coordinator = coordinator
	root.add_child(shell)
	await process_frame
	var party_top_bar := shell.find_child("PartyTrigger", true, false).get_parent() as PartyTopBar
	for _attempt in 600:
		if party_top_bar.snapshot().get("status", "") in ["ready", "empty"]:
			break
		await create_timer(0.001).timeout
	_expect(party_top_bar != null and party_top_bar.trigger_button().text == "Keine aktuelle Party", "production shell exposes Party as a compact top-bar surface, not a route")
	party_top_bar.open_popup()
	var create_button := party_top_bar.find_child("PartyCreate", true, false) as Button
	create_button.pressed.emit()
	var editor := party_top_bar.find_child("PartyEditor", true, false) as Window
	var editor_name := party_top_bar.find_child("PartyEditorName", true, false) as LineEdit
	var editor_player := party_top_bar.find_child("PartyEditorPlayer", true, false) as LineEdit
	var editor_level := party_top_bar.find_child("PartyEditorLevel", true, false) as LineEdit
	editor_name.text = "Kael"
	editor_player.text = "Jonas"
	editor_level.text = "3"
	var editor_save := party_top_bar.find_child("PartyEditorSave", true, false) as Button
	editor_save.pressed.emit()
	for _attempt in 1200:
		if party_top_bar.snapshot().get("summary", {}).get("roster_count", -1) == 2:
			break
		await create_timer(0.001).timeout
	_expect(
		party_top_bar.snapshot().get("summary", {}).get("roster_count", -1) == 2
		and not editor.visible,
		"Party top-bar editor creates a reserve namesake and closes only after terminal success"
	)
	var ui_character_id := ""
	for character in party_top_bar.snapshot().get("roster", []):
		if character.get("player_name", "") == "Jonas":
			ui_character_id = str(character["character_id"])
	var roster_list := party_top_bar.find_child("PartyRosterList", true, false) as VBoxContainer
	var membership_button: Button
	for button in roster_list.find_children("PartyMembershipAction", "Button", true, false):
		if str(button.get_meta("character_id", "")) == ui_character_id:
			membership_button = button
	var membership_clicked := membership_button != null
	if membership_clicked:
		membership_button.pressed.emit()
	for _attempt in 1200:
		if party_top_bar.snapshot().get("summary", {}).get("active_count", -1) == 1:
			break
		await create_timer(0.001).timeout
	_expect(membership_clicked and party_top_bar.trigger_button().text.begins_with("1 SC"), "Party top-bar membership action explicitly updates the current Party summary")
	var adventuring_day := shell.find_child("AdventuringDayTrigger", true, false).get_parent() as AdventuringDayTopBar
	for _attempt in 1200:
		if adventuring_day.snapshot().get("summary", {}).get("status", "") == "ready":
			break
		await create_timer(0.001).timeout
	_expect(
		adventuring_day != null and adventuring_day.trigger_button().text == "SR 400 · LR 1200",
		"separate Adventuring Day trigger derives the active Party rest budget"
	)
	adventuring_day.open_popup()
	_expect(
		adventuring_day.snapshot().get("party_refresh_pending", false)
		and adventuring_day.trigger_button().text == "Lädt …",
		"opening Adventuring Day marks the prior Party budget non-final until refreshed readback"
	)
	var progress_mode := adventuring_day.find_child("AdventuringDayProgressMode", true, false) as Button
	progress_mode.pressed.emit()
	var total_xp := adventuring_day.find_child("AdventuringDayTotalXp", true, false) as LineEdit
	total_xp.text = "1200"
	total_xp.text_submitted.emit("1200")
	for _attempt in 1200:
		if adventuring_day.snapshot().get("calculation", {}).get("progress", {}).get("total_group_xp", -1) == 1_200:
			break
		await create_timer(0.001).timeout
	_expect(
		adventuring_day.snapshot().get("mode", "") == "progress"
		and adventuring_day.snapshot().get("calculation", {}).get("progress", {}).get("total_days", -1.0) == 1.0
		and adventuring_day.find_child("AdventuringDayTimeline", true, false).get_child_count() == 3,
		"Adventuring Day popup maps group XP to two Short Rests and one Long Rest"
	)
	var add_day_row := adventuring_day.find_child("AdventuringDayAddRow", true, false) as Button
	add_day_row.pressed.emit()
	for _attempt in 1200:
		if not adventuring_day.snapshot().get("loading", true):
			break
		await create_timer(0.001).timeout
	_expect(
		adventuring_day.snapshot().get("source", "") == "custom"
		and adventuring_day.snapshot().get("rows", []).size() == 2
		and party_top_bar.snapshot().get("summary", {}).get("roster_count", -1) == 2
		and party_top_bar.snapshot().get("summary", {}).get("active_count", -1) == 1,
		"custom Adventuring Day rows remain local and never mutate Party Roster truth"
	)
	var large_count := adventuring_day.find_child("AdventuringDayCount0", true, false) as LineEdit
	large_count.text = "500"
	large_count.text_submitted.emit("500")
	for _attempt in 1200:
		if adventuring_day.snapshot().get("calculation", {}).get("progress", {}).get("party_size", -1) == 501:
			break
		await create_timer(0.001).timeout
	_expect(
		adventuring_day.snapshot().get("calculation", {}).get("ok", false)
		and adventuring_day.snapshot().get("calculation", {}).get("progress", {}).get("party_size", -1) == 501
		and party_top_bar.snapshot().get("summary", {}).get("active_count", -1) == 1,
		"large counted custom cohorts calculate without expanding controls or mutating Party truth"
	)
	var active_list := party_top_bar.find_child("PartyActiveList", true, false) as VBoxContainer
	var xp_button: Button
	for button in active_list.find_children("", "Button", true, false):
		if button.text == "+100 XP" and str(button.get_meta("character_id", "")) == ui_character_id:
			xp_button = button
			break
	var xp_clicked := xp_button != null
	if xp_clicked:
		xp_button.pressed.emit()
	for _attempt in 1200:
		var active_rows: Array = party_top_bar.snapshot().get("active", [])
		if not active_rows.is_empty() and active_rows[0].get("current_xp", -1) == 1_000:
			break
		await create_timer(0.001).timeout
	_expect(xp_clicked and party_top_bar.snapshot().get("active", [])[0].get("current_xp", -1) == 1_000, "Party top-bar XP action refreshes durable current-Party progress above the authored level floor")
	var short_rest_button := party_top_bar.find_child("PartyShortRest", true, false) as Button
	short_rest_button.pressed.emit()
	for _attempt in 1200:
		var active_rows: Array = party_top_bar.snapshot().get("active", [])
		if not active_rows.is_empty() and active_rows[0].get("short_rests_taken_since_long_rest", -1) == 1:
			break
		await create_timer(0.001).timeout
	_expect(party_top_bar.snapshot().get("active", [])[0].get("xp_since_short_rest", -1) == 0, "Party top-bar rest action applies only through the Party owner command")
	var next_campaign := coordinator.create_and_switch("Fresh Party Route", int(registry.load_state()["generation"]))
	var campaign_desk := shell.route("campaigns") as CampaignDesk
	if next_campaign.get("ok", false):
		campaign_desk.active_campaign_changed.emit(str(next_campaign.get("registry_state", {}).get("active_campaign_id", "")))
	for _attempt in 1200:
		if party_top_bar.snapshot().get("summary", {}).get("roster_count", -1) == 0:
			break
		await create_timer(0.001).timeout
	_expect(
		next_campaign.get("ok", false)
		and party_top_bar.snapshot().get("summary", {}).get("roster_count", -1) == 0
		and party_top_bar.trigger_button().text == "Keine aktuelle Party"
		and adventuring_day.trigger_button().text == "Kein Rastbudget",
		"successful Campaign transitions refresh both persistent Party-owned top-bar triggers"
	)
	shell.queue_free()
	commands.queue_free()
	await process_frame
	await process_frame
	coordinator.revoke_current(-1)


func _run_catalog_foundation_contract() -> void:
	var data_root := "user://saltmarcher-catalog-foundation/%s" % Time.get_ticks_usec()
	var registry := FileCampaignRegistry.new(data_root)
	var definitions := SharedDefinitionStore.new(data_root)
	var catalog_definitions: Array = [
		{"definition_id": "creature.wolf", "kind": "creature", "name": "Wolf", "content": {"armor_class": 12}},
		{"definition_id": "creature.worg", "kind": "creature", "name": "Worg", "content": {"armor_class": 13}},
		{"definition_id": "item.rope", "kind": "item", "name": "Rope", "content": {"weight": 10}},
	]
	for index in range(55):
		catalog_definitions.append({
			"definition_id": "creature.fixture.%03d" % index,
			"kind": "creature",
			"name": "Bestie %03d" % index,
			"content": {"fixture_index": index},
		})
	var prepared := definitions.prepare_generation(0, catalog_definitions)
	_expect(prepared.get("ok", false), "Catalog fixture prepares typed Shared Definitions")
	var published := registry.publish_shared_definitions_generation(int(prepared.get("generation", -1)), 0)
	_expect(published.get("ok", false), "Catalog fixture atomically selects its Shared-Definition generation")
	var campaign_created := registry.create_campaign("Katalog Campaign")
	_expect(campaign_created.get("ok", false), "Catalog fixture creates an active Campaign for Campaign-owned providers")
	var catalog_campaign_id := str(campaign_created.get("campaign_id", ""))
	var world_model := WorldPlannerKnowledge.new()
	var world_payload := world_model.empty_payload()
	world_payload = world_model.create_record(
		world_payload, "faction", "Hafenrat", {}, "faction.harbor", "2026-07-28T11:00:00Z"
	).get("payload", world_payload)
	world_payload = world_model.create_record(
		world_payload,
		"place",
		"Nordkai",
		{"faction_ids": ["faction.harbor"]},
		"place.north-quay",
		"2026-07-28T11:00:01Z"
	).get("payload", world_payload)
	var catalog_store := FileCampaignStore.new(data_root, catalog_campaign_id)
	var catalog_state := catalog_store.load_state()
	var seeded_world := catalog_store.commit(
		int(catalog_state["generation"]),
		{WorldPlannerKnowledge.OWNER: world_payload},
		catalog_state["runtime"]
	)
	_expect(seeded_world.get("ok", false), "Catalog fixture seeds provider-owned faction and place choices")
	var runtime_coordinator := CampaignRuntimeCoordinator.new(data_root, registry)
	_expect(runtime_coordinator.open_durable_active().get("ok", false), "Catalog fixture opens its active Campaign writer")
	var first_page := definitions.query_catalog(int(prepared["generation"]), "creature", "wo", 0, 1)
	_expect(
		first_page.get("ok", false)
		and first_page.get("total", -1) == 2
		and first_page.get("rows", []).size() == 1
		and first_page.get("rows", [])[0].get("definition_id", "") == "creature.wolf",
		"Catalog provider returns deterministic stable-id search and bounded paging"
	)
	var invalid_page := definitions.query_catalog(int(prepared["generation"]), "creature", "", 0, 201)
	_expect(not invalid_page.get("ok", true), "Catalog provider rejects an unbounded page")
	var identity_descending := definitions.query_catalog(
		int(prepared["generation"]), "creature", "", 0, 3, "identity", false
	)
	_expect(
		identity_descending.get("rows", []).map(func(row: Dictionary) -> String: return row["definition_id"])
		== ["creature.worg", "creature.wolf", "creature.fixture.054"],
		"Shared Definitions sort stably before bounded paging in either direction"
	)
	_expect(
		not definitions.query_catalog(int(prepared["generation"]), "creature", "", 0, 50, "unknown").get("ok", true),
		"Shared Definitions reject an unknown Catalog sort key"
	)

	var controller := CatalogBrowseController.new(data_root, registry)
	root.add_child(controller)
	var results: Array = []
	controller.result_published.connect(func(result: Dictionary) -> void:
		results.append(result.duplicate(true))
	)
	var first_query := controller.query("creatures", "creature", "w", 0, 50, false, "name", true)
	var replacement_query := controller.query("creatures", "creature", "worg", 0, 50, false, "identity", false)
	_expect(first_query.get("status", "") == "started" and replacement_query.get("status", "") == "queued", "Catalog controller admits one read and one latest-wins pending request")
	for _attempt in 600:
		if not controller.is_active():
			break
		await create_timer(0.001).timeout
	await process_frame
	_expect(
		results.size() == 1
		and results[0].get("rows", [])[0].get("definition_id", "") == "creature.worg"
		and results[0].get("sort_key", "") == "identity"
		and not results[0].get("sort_ascending", true),
		"Catalog controller suppresses superseded readback and publishes only the latest ordered query"
	)
	var controller_resources := controller.resource_snapshot()
	_expect(
		int(controller_resources.get("active_count", -1)) == 0
		and int(controller_resources.get("pending_count", -1)) == 0
		and int(controller_resources.get("worker_handle_count", -1)) == 0,
		"Catalog controller releases read worker and pending state after publication"
	)
	controller.queue_free()
	await process_frame
	var option_controller := WorldPlannerReferenceOptionsController.new(data_root)
	root.add_child(option_controller)
	var option_results: Array = []
	option_controller.result_published.connect(func(result: Dictionary) -> void: option_results.append(result.duplicate(true)))
	var first_option_query := option_controller.query("npc.creature", "creature", "w")
	var replacement_option_query := option_controller.query("npc.creature", "creature", "worg")
	_expect(
		first_option_query.get("status", "") == "started" and replacement_option_query.get("status", "") == "queued",
		"reference options admit one provider read and one latest pending search"
	)
	for _attempt in 600:
		if option_results.size() == 1 and not option_controller.is_active():
			break
		await create_timer(0.001).timeout
	_expect(
		option_results.size() == 1
		and option_results[0].get("rows", [])[0].get("reference_id", "") == "creature.worg",
		"reference options publish only the latest normalized Creature result"
	)
	option_results.clear()
	option_controller.query("npc.faction", "faction", "hafen")
	for _attempt in 600:
		if option_results.size() == 1:
			break
		await create_timer(0.001).timeout
	_expect(
		option_results.size() == 1
		and option_results[0].get("rows", [])[0].get("reference_id", "") == "faction.harbor",
		"reference options query active Campaign-owned entities without exposing storage"
	)
	var option_resources := option_controller.resource_snapshot()
	_expect(
		option_resources.get("active_count", -1) == 0
		and option_resources.get("pending_count", -1) == 0
		and option_resources.get("worker_handle_count", -1) == 0,
		"reference option lane releases worker and pending state"
	)
	option_controller.queue_free()
	await process_frame
	var item_reference: Dictionary = prepared.get("state", {}).get("definitions", {}).get("item.rope", {})
	var damaged_item_path := data_root + "/installation/shared-definitions/" + str(item_reference.get("path", ""))
	var damaged_item := FileAccess.open(damaged_item_path, FileAccess.WRITE)
	damaged_item.store_string("{damaged")
	damaged_item.close()
	_expect(registry.load_state().get("ok", false), "one damaged Shared Definition does not block registry or Campaign opening")
	_expect(definitions.query_catalog(int(prepared["generation"]), "creature", "", 0, 50).get("ok", false), "damaged Item definition does not block independent Creature metadata browsing")
	_expect(not definitions.read_definition("item.rope", int(prepared["generation"])).get("ok", true), "selected damaged Shared Definition fails exact object validation")

	var shell := MainShell.new()
	shell.data_root = data_root
	shell.registry = registry
	shell.runtime_coordinator = runtime_coordinator
	root.add_child(shell)
	await process_frame
	_expect(shell.show_route("catalog").get("ok", false) and shell.active_route() == "catalog", "production shell exposes one native Katalog route")
	var catalog := shell.route("catalog") as CatalogWorkspace
	for _attempt in 600:
		if catalog.section_snapshot("creatures").get("status", "") in ["ready", "empty"]:
			break
		await create_timer(0.001).timeout
	var initial_creature_state := catalog.section_snapshot("creatures")
	_expect(
		initial_creature_state.get("status", "") == "ready"
		and initial_creature_state.get("total", -1) == 57
		and initial_creature_state.get("rows", []).size() == 50,
		"opening Katalog after initial hidden-route cancellation publishes the first bounded page"
	)
	var selector := catalog.find_child("CatalogSectionSelector", true, false)
	_expect(selector != null and selector.get_child_count() == 7, "native Katalog exposes all seven persistent sections")
	var next_page := catalog.find_child("CatalogNextPage", true, false) as Button
	var previous_page := catalog.find_child("CatalogPreviousPage", true, false) as Button
	var page_label := catalog.find_child("CatalogPageLabel", true, false) as Label
	_expect(not next_page.disabled and previous_page.disabled and page_label.text == "Seite 1/2", "shared Catalog footer exposes truthful first-page navigation")
	next_page.pressed.emit()
	_expect(catalog.section_snapshot("creatures").get("page", -1) == 1, "Catalog paging acknowledges locally before provider completion")
	for _attempt in 600:
		var state := catalog.section_snapshot("creatures")
		if state.get("status", "") == "ready" and state.get("page", -1) == 1:
			break
		await create_timer(0.001).timeout
	var second_page_state := catalog.section_snapshot("creatures")
	_expect(
		second_page_state.get("rows", []).size() == 7
		and page_label.text == "Seite 2/2"
		and next_page.disabled
		and not previous_page.disabled,
		"Catalog renders the bounded final page and updates both navigation boundaries"
	)
	var result_list := catalog.find_child("CatalogResults", true, false) as VBoxContainer
	var selected_page_button := result_list.find_child("CatalogResultName", true, false) as Button
	selected_page_button.pressed.emit()
	var retained_selection_id := str(catalog.section_snapshot("creatures").get("selected_id", ""))
	var identity_header := catalog.find_child("CatalogSortIdentity", true, false) as Button
	identity_header.pressed.emit()
	_expect(
		catalog.section_snapshot("creatures").get("page", -1) == 0
		and catalog.section_snapshot("creatures").get("sort_key", "") == "identity"
		and catalog.section_snapshot("creatures").get("selected_id", "") == retained_selection_id,
		"header sorting resets paging immediately without discarding the stable selection"
	)
	for _attempt in 600:
		var state := catalog.section_snapshot("creatures")
		if state.get("status", "") == "ready" and state.get("sort_key", "") == "identity":
			break
		await create_timer(0.001).timeout
	identity_header.pressed.emit()
	for _attempt in 600:
		var state := catalog.section_snapshot("creatures")
		if state.get("status", "") == "ready" and not state.get("sort_ascending", true):
			break
		await create_timer(0.001).timeout
	var descending_state := catalog.section_snapshot("creatures")
	_expect(
		descending_state.get("rows", [])[0].get("definition_id", "") == "creature.worg"
		and identity_header.text == "Kennung ↓",
		"the active column header is the only sort control and exposes descending direction"
	)
	next_page.pressed.emit()
	for _attempt in 600:
		var state := catalog.section_snapshot("creatures")
		if state.get("status", "") == "ready" and state.get("page", -1) == 1:
			break
		await create_timer(0.001).timeout
	catalog.select_section("items")
	catalog.select_section("creatures")
	_expect(
		catalog.section_snapshot("creatures").get("page", -1) == 1
		and catalog.section_snapshot("creatures").get("sort_key", "") == "identity"
		and not catalog.section_snapshot("creatures").get("sort_ascending", true),
		"Catalog section switching retains sort direction and page state"
	)
	var search := catalog.search_input()
	search.text = "worg"
	search.text_changed.emit(search.text)
	search.text_submitted.emit(search.text)
	for _attempt in 600:
		var state := catalog.section_snapshot("creatures")
		if state.get("status", "") == "ready" and state.get("rows", []).size() == 1:
			break
		await create_timer(0.001).timeout
	var creature_state := catalog.section_snapshot("creatures")
	_expect(creature_state.get("rows", [])[0].get("definition_id", "") == "creature.worg", "native Katalog searches the selected provider through its background controller")
	catalog.select_section("items")
	catalog.select_section("creatures")
	_expect(catalog.search_input().text == "worg", "Katalog section switching retains unfinished search state")
	var npc_selection := catalog.select_section("npcs")
	_expect(npc_selection.get("status", "") == "selected", "native Katalog routes NPCs to their Campaign-owned provider")
	for _attempt in 600:
		if catalog.section_snapshot("npcs").get("status", "") == "empty":
			break
		await create_timer(0.001).timeout
	_expect(catalog.section_snapshot("npcs").get("status", "") == "empty", "empty Campaign NPC provider is a ready empty state")
	var create_button := catalog.find_child("CatalogCreate", true, false) as Button
	create_button.pressed.emit()
	var record_name := catalog.find_child("CatalogRecordName", true, false) as LineEdit
	var record_notes := catalog.find_child("CatalogRecordNotes", true, false) as TextEdit
	record_name.text = "Mira Salzhand"
	record_notes.text = "Kennt jede Ebbe am Nordkai."
	var record_dialog := catalog.find_child("CatalogRecordDialog", true, false) as ConfirmationDialog
	record_dialog.confirmed.emit()
	record_dialog.hide()
	for _attempt in 1200:
		var npc_state := catalog.section_snapshot("npcs")
		if npc_state.get("status", "") == "ready" and npc_state.get("rows", []).size() == 1:
			break
		await create_timer(0.001).timeout
	var npc_state := catalog.section_snapshot("npcs")
	_expect(
		npc_state.get("status", "") == "ready"
		and npc_state.get("rows", [])[0].get("name", "") == "Mira Salzhand"
		and npc_state.get("rows", [])[0].get("notes", "") == "Kennt jede Ebbe am Nordkai.",
		"native Katalog name-only create persists through provider command and refreshes provider readback"
	)
	var stable_npc_id := str(npc_state.get("rows", [])[0].get("reference_id", ""))
	result_list = catalog.find_child("CatalogResults", true, false) as VBoxContainer
	var npc_row_button := result_list.find_child("CatalogResultName", true, false) as Button
	npc_row_button.pressed.emit()
	for _attempt in 600:
		if catalog.detail_snapshot().get("status", "") == "ready":
			break
		await create_timer(0.001).timeout
	_expect(
		catalog.detail_snapshot().get("record", {}).get("lifecycle_status", "") == "active"
		and catalog.detail_snapshot().get("record", {}).get("disposition_modifier", -1) == 0,
		"selected NPC loads its full owner detail without copying typed fields into the Catalog row"
	)
	var narrative_threads := catalog.find_child("WorldPlannerNarrativeThreads", true, false) as WorldPlannerNarrativeThreads
	for _attempt in 600:
		if narrative_threads.snapshot().get("status", "") == "empty":
			break
		await create_timer(0.001).timeout
	_expect(narrative_threads.visible and narrative_threads.snapshot().get("status", "") == "empty", "selecting a World Planner row opens its empty narrative dossier without another route")
	var create_quest := narrative_threads.find_child("NarrativeCreateQuest", true, false) as Button
	create_quest.pressed.emit()
	var narrative_name := narrative_threads.find_child("NarrativeName", true, false) as LineEdit
	var narrative_notes := narrative_threads.find_child("NarrativeNotes", true, false) as TextEdit
	var narrative_editor := narrative_threads.find_child("NarrativeEditor", true, false) as ConfirmationDialog
	narrative_name.text = "Die Glocke bei Ebbe"
	narrative_notes.text = "Mira kennt den Weg zum versunkenen Glockensteg."
	narrative_editor.confirmed.emit()
	narrative_editor.hide()
	for _attempt in 1200:
		if narrative_threads.snapshot().get("rows", []).size() == 1:
			break
		await create_timer(0.001).timeout
	var narrative_state := narrative_threads.snapshot()
	var stable_quest_id := str(narrative_state.get("rows", [])[0].get("reference_id", ""))
	_expect(
		narrative_state.get("rows", [])[0].get("kind", "") == "quest"
		and narrative_state.get("rows", [])[0].get("resolution_state", "") == "open"
		and catalog.section_snapshot("npcs").get("selected_id", "") == stable_npc_id,
		"production Inspector creates one open Quest attached to the selected NPC without changing Catalog selection"
	)
	var thread_list := narrative_threads.find_child("NarrativeThreadList", true, false) as VBoxContainer
	var close_button: Button
	for button in thread_list.find_children("", "Button", true, false):
		if button.text == "Schließen":
			close_button = button
			break
	_expect(close_button != null, "open Quest exposes an explicit close action")
	if close_button != null:
		close_button.pressed.emit()
	for _attempt in 1200:
		if narrative_threads.snapshot().get("rows", [])[0].get("resolution_state", "") == "closed":
			break
		await create_timer(0.001).timeout
	_expect(narrative_threads.snapshot().get("rows", [])[0].get("resolution_state", "") == "closed", "Quest resolution is a manual explicit open/closed command")
	thread_list = narrative_threads.find_child("NarrativeThreadList", true, false) as VBoxContainer
	var narrative_trash_button: Button
	for button in thread_list.find_children("", "Button", true, false):
		if button.text == "Papierkorb":
			narrative_trash_button = button
			break
	_expect(narrative_trash_button != null, "active narrative thread exposes recoverable trash")
	if narrative_trash_button != null:
		narrative_trash_button.pressed.emit()
	var narrative_delete := narrative_threads.find_child("NarrativeDeleteDialog", true, false) as ConfirmationDialog
	narrative_delete.confirmed.emit()
	narrative_delete.hide()
	for _attempt in 1200:
		if narrative_threads.snapshot().get("status", "") == "empty":
			break
		await create_timer(0.001).timeout
	var narrative_trash_toggle := narrative_threads.find_child("NarrativeTrashToggle", true, false) as CheckButton
	narrative_trash_toggle.set_pressed_no_signal(true)
	narrative_trash_toggle.toggled.emit(true)
	for _attempt in 600:
		if narrative_threads.snapshot().get("rows", []).size() == 1:
			break
		await create_timer(0.001).timeout
	_expect(narrative_threads.snapshot().get("rows", [])[0].get("reference_id", "") == stable_quest_id, "narrative trash exposes the same stable Quest identity")
	thread_list = narrative_threads.find_child("NarrativeThreadList", true, false) as VBoxContainer
	var narrative_restore_button: Button
	for button in thread_list.find_children("", "Button", true, false):
		if button.text == "Wiederherstellen":
			narrative_restore_button = button
			break
	_expect(narrative_restore_button != null, "trashed narrative thread exposes restore")
	if narrative_restore_button != null:
		narrative_restore_button.pressed.emit()
	for _attempt in 1200:
		if narrative_threads.snapshot().get("status", "") == "empty":
			break
		await create_timer(0.001).timeout
	narrative_trash_toggle.set_pressed_no_signal(false)
	narrative_trash_toggle.toggled.emit(false)
	for _attempt in 600:
		if narrative_threads.snapshot().get("rows", []).size() == 1:
			break
		await create_timer(0.001).timeout
	_expect(
		narrative_threads.snapshot().get("rows", [])[0].get("reference_id", "") == stable_quest_id
		and narrative_threads.snapshot().get("rows", [])[0].get("resolution_state", "") == "closed",
		"restoring a narrative thread preserves identity and manual resolution state"
	)
	var edit_button := catalog.find_child("CatalogEdit", true, false) as Button
	edit_button.pressed.emit()
	record_notes.text = "Kennt jede Ebbe und jeden Lotsen."
	var record_appearance := catalog.find_child("CatalogRecordAppearance", true, false) as TextEdit
	var record_behavior := catalog.find_child("CatalogRecordBehavior", true, false) as TextEdit
	var record_history := catalog.find_child("CatalogRecordHistory", true, false) as TextEdit
	var record_disposition := catalog.find_child("CatalogRecordNpcDisposition", true, false) as SpinBox
	record_appearance.text = "Salzgrauer Mantel und Messingkompass."
	record_behavior.text = "Spricht leise und prüft jede Strömung zweimal."
	record_history.text = "War Lotsin des Hafenrats."
	record_disposition.value = 12
	var reference_picker := catalog.find_child("WorldPlannerReferencePicker", true, false) as WorldPlannerReferencePicker
	var choose_creature := catalog.find_child("CatalogReferenceChooseCreatureId", true, false) as Button
	choose_creature.pressed.emit()
	for _attempt in 600:
		if reference_picker.snapshot().get("status", "") == "ready" and reference_picker.snapshot().get("rows", []).size() == 50:
			break
		await create_timer(0.001).timeout
	var picker_next := reference_picker.find_child("ReferencePickerNext", true, false) as Button
	_expect(not picker_next.disabled and picker_next.visible, "reference picker exposes bounded pagination for long provider option sets")
	picker_next.pressed.emit()
	for _attempt in 600:
		if reference_picker.snapshot().get("status", "") == "ready" and reference_picker.snapshot().get("page", -1) == 1:
			break
		await create_timer(0.001).timeout
	_expect(
		reference_picker.snapshot().get("rows", []).size() == 7,
		"reference picker renders only the bounded final provider page"
	)
	var picker_search := reference_picker.find_child("ReferencePickerSearch", true, false) as LineEdit
	picker_search.text = "worg"
	picker_search.text_changed.emit(picker_search.text)
	picker_search.text_submitted.emit(picker_search.text)
	for _attempt in 600:
		if reference_picker.snapshot().get("status", "") == "ready" and reference_picker.snapshot().get("rows", []).size() == 1:
			break
		await create_timer(0.001).timeout
	var picker_results := reference_picker.find_child("ReferencePickerResults", true, false) as VBoxContainer
	var creature_choice := picker_results.find_child("ReferencePickerChoice", true, false) as CheckButton
	_expect(creature_choice != null and creature_choice.text.contains("Worg"), "NPC statblock picker searches the Creature provider instead of accepting a raw ID")
	if creature_choice != null:
		creature_choice.toggled.emit(true)
	reference_picker.confirmed.emit()
	reference_picker.hide()
	var choose_faction := catalog.find_child("CatalogReferenceChooseFactionId", true, false) as Button
	choose_faction.pressed.emit()
	for _attempt in 600:
		if reference_picker.snapshot().get("status", "") == "ready" and reference_picker.snapshot().get("rows", []).size() == 1:
			break
		await create_timer(0.001).timeout
	picker_results = reference_picker.find_child("ReferencePickerResults", true, false) as VBoxContainer
	var faction_choice := picker_results.find_child("ReferencePickerChoice", true, false) as CheckButton
	_expect(faction_choice != null and faction_choice.text.contains("Hafenrat"), "NPC faction picker reads active World Planner choices")
	if faction_choice != null:
		faction_choice.toggled.emit(true)
	reference_picker.confirmed.emit()
	reference_picker.hide()
	var choose_place := catalog.find_child("CatalogReferenceChooseLastPlaceId", true, false) as Button
	choose_place.pressed.emit()
	for _attempt in 600:
		if reference_picker.snapshot().get("status", "") == "ready" and reference_picker.snapshot().get("rows", []).size() == 1:
			break
		await create_timer(0.001).timeout
	picker_results = reference_picker.find_child("ReferencePickerResults", true, false) as VBoxContainer
	var place_choice := picker_results.find_child("ReferencePickerChoice", true, false) as CheckButton
	_expect(place_choice != null and place_choice.text.contains("Nordkai"), "NPC last-place picker reads active World Planner choices")
	if place_choice != null:
		place_choice.toggled.emit(true)
	reference_picker.confirmed.emit()
	reference_picker.hide()
	record_dialog.confirmed.emit()
	record_dialog.hide()
	for _attempt in 1200:
		npc_state = catalog.section_snapshot("npcs")
		if npc_state.get("status", "") == "ready" and npc_state.get("rows", [])[0].get("notes", "") == "Kennt jede Ebbe und jeden Lotsen.":
			break
		await create_timer(0.001).timeout
	for _attempt in 600:
		if catalog.detail_snapshot().get("record", {}).get("appearance", "") == "Salzgrauer Mantel und Messingkompass.":
			break
		await create_timer(0.001).timeout
	var rich_npc_detail: Dictionary = catalog.detail_snapshot().get("record", {})
	_expect(
		npc_state.get("rows", [])[0].get("notes", "") == "Kennt jede Ebbe und jeden Lotsen."
		and rich_npc_detail.get("behavior", "") == "Spricht leise und prüft jede Strömung zweimal."
		and rich_npc_detail.get("history", "") == "War Lotsin des Hafenrats."
		and rich_npc_detail.get("disposition_modifier", 0) == 12
		and rich_npc_detail.get("creature_id", "") == "creature.worg"
		and rich_npc_detail.get("faction_id", "") == "faction.harbor"
		and rich_npc_detail.get("last_place_id", "") == "place.north-quay"
		and catalog.section_snapshot("npcs").get("selected_id", "") == stable_npc_id,
		"native Inspector edit round-trips rich NPC truth and provider-selected references while preserving selection"
	)
	var lifecycle_button := catalog.find_child("CatalogLifecycle", true, false) as Button
	_expect(lifecycle_button.visible and lifecycle_button.text == "Als besiegt markieren", "active NPC exposes an explicit lifecycle action")
	lifecycle_button.pressed.emit()
	var lifecycle_dialog := catalog.find_child("CatalogLifecycleDialog", true, false) as ConfirmationDialog
	lifecycle_dialog.confirmed.emit()
	lifecycle_dialog.hide()
	for _attempt in 1200:
		if catalog.detail_snapshot().get("record", {}).get("lifecycle_status", "") == "defeated":
			break
		await create_timer(0.001).timeout
	_expect(
		catalog.detail_snapshot().get("record", {}).get("lifecycle_status", "") == "defeated"
		and lifecycle_button.text == "Reaktivieren",
		"explicit lifecycle confirmation publishes defeated NPC truth and exposes reactivation"
	)
	lifecycle_button.pressed.emit()
	lifecycle_dialog.confirmed.emit()
	lifecycle_dialog.hide()
	for _attempt in 1200:
		if catalog.detail_snapshot().get("record", {}).get("lifecycle_status", "") == "active":
			break
		await create_timer(0.001).timeout
	_expect(catalog.detail_snapshot().get("record", {}).get("lifecycle_status", "") == "active", "reactivation restores NPC availability through an explicit command")
	var trash_button := catalog.find_child("CatalogTrash", true, false) as Button
	trash_button.pressed.emit()
	var delete_dialog := catalog.find_child("CatalogDeleteDialog", true, false) as ConfirmationDialog
	delete_dialog.confirmed.emit()
	delete_dialog.hide()
	for _attempt in 1200:
		npc_state = catalog.section_snapshot("npcs")
		if npc_state.get("status", "") == "empty":
			break
		await create_timer(0.001).timeout
	_expect(npc_state.get("status", "") == "empty", "native Katalog removes a trashed NPC from the active provider view")
	var trash_toggle := catalog.find_child("CatalogTrashToggle", true, false) as CheckButton
	trash_toggle.set_pressed_no_signal(true)
	trash_toggle.toggled.emit(true)
	for _attempt in 600:
		npc_state = catalog.section_snapshot("npcs")
		if npc_state.get("status", "") == "ready":
			break
		await create_timer(0.001).timeout
	_expect(npc_state.get("rows", [])[0].get("reference_id", "") == stable_npc_id, "native Katalog exposes the same stable NPC identity in recoverable trash")
	catalog.call("_select_row", npc_state.get("rows", [])[0])
	var restore_button := catalog.find_child("CatalogRestore", true, false) as Button
	restore_button.pressed.emit()
	for _attempt in 1200:
		npc_state = catalog.section_snapshot("npcs")
		if npc_state.get("status", "") == "empty":
			break
		await create_timer(0.001).timeout
	trash_toggle.set_pressed_no_signal(false)
	trash_toggle.toggled.emit(false)
	for _attempt in 600:
		npc_state = catalog.section_snapshot("npcs")
		if npc_state.get("status", "") == "ready":
			break
		await create_timer(0.001).timeout
	_expect(npc_state.get("rows", [])[0].get("reference_id", "") == stable_npc_id, "native Katalog restores the NPC with its original stable identity")
	catalog.call("_select_row", npc_state.get("rows", [])[0])
	for _attempt in 600:
		if narrative_threads.snapshot().get("rows", []).size() == 1:
			break
		await create_timer(0.001).timeout
	_expect(
		narrative_threads.snapshot().get("rows", [])[0].get("reference_id", "") == stable_quest_id,
		"restoring the NPC atomically reattaches its surviving Quest thread"
	)
	catalog.select_section("places")
	for _attempt in 600:
		if catalog.section_snapshot("places").get("status", "") == "ready":
			break
		await create_timer(0.001).timeout
	var place_state := catalog.section_snapshot("places")
	catalog.call("_select_row", place_state.get("rows", [])[0])
	for _attempt in 600:
		if catalog.detail_snapshot().get("status", "") == "ready":
			break
		await create_timer(0.001).timeout
	_expect(
		catalog.detail_snapshot().get("record", {}).get("faction_ids", []) == ["faction.harbor"],
		"place detail reads its existing provider-owned faction relationship"
	)
	edit_button.pressed.emit()
	var choose_place_factions := catalog.find_child("CatalogReferenceChooseFactionIds", true, false) as Button
	choose_place_factions.pressed.emit()
	for _attempt in 600:
		if reference_picker.snapshot().get("status", "") == "ready":
			break
		await create_timer(0.001).timeout
	var clear_references := reference_picker.find_child("ReferencePickerClear", true, false) as Button
	clear_references.pressed.emit()
	reference_picker.confirmed.emit()
	reference_picker.hide()
	record_dialog.confirmed.emit()
	record_dialog.hide()
	for _attempt in 1200:
		if catalog.detail_snapshot().get("record", {}).get("faction_ids", ["pending"]).is_empty():
			break
		await create_timer(0.001).timeout
	_expect(
		catalog.detail_snapshot().get("record", {}).get("faction_ids", ["pending"]).is_empty(),
		"multi-reference picker removes a place-faction relationship without deleting either endpoint"
	)
	edit_button.pressed.emit()
	choose_place_factions.pressed.emit()
	for _attempt in 600:
		if reference_picker.snapshot().get("status", "") == "ready":
			break
		await create_timer(0.001).timeout
	picker_results = reference_picker.find_child("ReferencePickerResults", true, false) as VBoxContainer
	faction_choice = picker_results.find_child("ReferencePickerChoice", true, false) as CheckButton
	if faction_choice != null:
		faction_choice.toggled.emit(true)
	reference_picker.confirmed.emit()
	reference_picker.hide()
	record_dialog.confirmed.emit()
	record_dialog.hide()
	for _attempt in 1200:
		if "faction.harbor" in catalog.detail_snapshot().get("record", {}).get("faction_ids", []):
			break
		await create_timer(0.001).timeout
	_expect(
		"faction.harbor" in catalog.detail_snapshot().get("record", {}).get("faction_ids", []),
		"multi-reference picker restores the place-faction relationship through the serial owner writer"
	)
	var unavailable := catalog.select_section("encounters")
	_expect(unavailable.get("status", "") == "unavailable", "remaining unmigrated Katalog provider stays explicit and side-effect free")
	create_button.pressed.emit()
	var footer := catalog.find_child("CatalogFooter", true, false) as Label
	_expect(footer.text.contains("noch nicht verfügbar"), "unavailable provider creation remains side-effect free and truthful")
	shell.queue_free()
	await process_frame
	await process_frame
	runtime_coordinator.revoke_current(-1)


func _run_world_planner_knowledge_contract() -> void:
	var model := WorldPlannerKnowledge.new()
	var payload := model.empty_payload()
	var faction := model.create_record(payload, "faction", "Hafenrat", {}, "faction.harbor", "2026-07-28T10:00:00Z")
	_expect(faction.get("ok", false), "World Planner creates a name-only faction with stable identity")
	payload = faction.get("payload", payload)
	var duplicate_faction := model.create_record(payload, "faction", "Hafenrat", {}, "faction.harbor.two", "2026-07-28T10:00:01Z")
	_expect(duplicate_faction.get("ok", false), "World Planner allows independently identified records with the same name")
	payload = duplicate_faction.get("payload", payload)
	var place := model.create_record(
		payload,
		"place",
		"Nordkai",
		{"notes": "Niedrige Lagerhäuser", "faction_ids": ["faction.harbor"]},
		"place.north-quay",
		"2026-07-28T10:00:02Z"
	)
	payload = place.get("payload", payload)
	var npc := model.create_record(
		payload,
		"npc",
		"Mira",
		{"faction_id": "faction.harbor", "last_place_id": "place.north-quay"},
		"npc.mira",
		"2026-07-28T10:00:03Z"
	)
	_expect(place.get("ok", false) and npc.get("ok", false), "World Planner accepts typed optional faction and place links")
	payload = npc.get("payload", payload)
	var renamed := model.update_record(
		payload,
		"npc.mira",
		{
			"name": "Mira Salzhand",
			"notes": "Kennt jede Ebbe.",
			"appearance": "Salzgrauer Mantel",
			"behavior": "Prüft jede Strömung zweimal.",
			"history": "War Lotsin des Hafenrats.",
			"disposition_modifier": 12,
		},
		"2026-07-28T10:00:04Z"
	)
	_expect(renamed.get("ok", false) and renamed.get("record", {}).get("notes", "") == "Kennt jede Ebbe.", "World Planner edits provider-owned display and note truth")
	payload = renamed.get("payload", payload)
	var npc_detail := model.read_entity(payload, "npc.mira")
	_expect(
		npc_detail.get("ok", false)
		and npc_detail.get("record", {}).get("appearance", "") == "Salzgrauer Mantel"
		and npc_detail.get("record", {}).get("disposition_modifier", 0) == 12,
		"World Planner detail read returns the complete typed entity without widening Catalog rows"
	)
	_expect(not model.read_entity(payload, "npc.mira", true).get("ok", true), "active and deleted entity detail views remain distinct")
	var quest := model.create_record(
		payload,
		"quest",
		"Die Glocke bei Ebbe",
		{
			"notes": "Mira kennt den Weg zum versunkenen Glockensteg.",
			"subject_refs": [
				{"kind": "npc", "record_id": "npc.mira"},
				{"kind": "place", "record_id": "place.north-quay"},
			],
			"contributor_ids": ["pc.ada", "pc.borin"],
			"rewards": [
				{"kind": "xp", "amount": 301},
				{"kind": "item", "definition_id": "item.salt-key", "quantity": 1},
			],
		},
		"quest.tide-bell",
		"2026-07-28T10:00:05Z"
	)
	_expect(quest.get("ok", false), "World Planner creates a note-first Quest with typed subjects, contributors, and stored rewards")
	payload = quest.get("payload", payload)
	var rumour := model.create_record(
		payload,
		"rumour",
		"Schwarze Segel",
		{
			"notes": "Der Hafenrat zahlt für Sichtungen.",
			"subject_refs": [{"kind": "faction", "record_id": "faction.harbor"}],
		},
		"rumour.black-sails",
		"2026-07-28T10:00:06Z"
	)
	_expect(rumour.get("ok", false), "World Planner creates a note-first rumour attached to one world subject")
	payload = rumour.get("payload", payload)
	var npc_threads := model.query_narratives_for_subject(payload, "npc.mira")
	_expect(
		npc_threads.get("ok", false)
		and npc_threads.get("total", -1) == 1
		and npc_threads.get("rows", [])[0].get("reference_id", "") == "quest.tide-bell"
		and npc_threads.get("rows", [])[0].get("contributor_ids", []) == ["pc.ada", "pc.borin"]
		and npc_threads.get("rows", [])[0].get("rewards", []).size() == 2,
		"subject dossier returns complete structured narrative truth without distributing rewards"
	)
	var closed_quest := model.update_record(payload, "quest.tide-bell", {"resolution_state": "closed"}, "2026-07-28T10:00:07Z")
	_expect(closed_quest.get("ok", false) and closed_quest.get("record", {}).get("resolution_state", "") == "closed", "Quest resolution is an explicit manual state transition")
	payload = closed_quest.get("payload", payload)
	_expect(
		not model.update_record(payload, "quest.tide-bell", {"completion_condition": "automatic"}).get("ok", true),
		"World Planner rejects autonomous completion graphs outside the note-first contract"
	)
	_expect(
		not model.update_record(payload, "rumour.black-sails", {"contributor_ids": ["pc.ada"]}).get("ok", true),
		"rumours reject Quest-only contributor assignment"
	)
	_expect(
		not model.update_record(payload, "quest.tide-bell", {"rewards": [{"kind": "xp", "amount": 0}]}).get("ok", true),
		"narrative reward storage rejects non-positive quantities before publication"
	)
	var trashed := model.trash_record(payload, "faction.harbor", "2026-07-28T10:00:08Z")
	var trashed_payload: Dictionary = trashed.get("payload", {})
	_expect(
		trashed.get("ok", false)
		and trashed.get("removed_link_count", -1) == 3
		and trashed_payload.get("records", {}).get("npc.mira", {}).get("faction_id", "missing") == ""
		and trashed_payload.get("records", {}).get("npc.mira", {}).get("updated_at_utc", "") == "2026-07-28T10:00:08Z"
		and not "faction.harbor" in trashed_payload.get("records", {}).get("place.north-quay", {}).get("faction_ids", [])
		and trashed_payload.get("records", {}).get("rumour.black-sails", {}).get("subject_refs", []).is_empty(),
		"trashing a faction atomically removes entity and narrative links and timestamps changed dependents"
	)
	var active_factions := model.query(trashed_payload, "faction", "", 0, 50)
	var deleted_factions := model.query(trashed_payload, "faction", "", 0, 50, true)
	_expect(active_factions.get("total", -1) == 1 and deleted_factions.get("total", -1) == 1, "active and recoverable-trash provider views remain distinct")
	var factions_by_identity_desc := model.query(trashed_payload, "faction", "", 0, 50, false, "identity", false)
	_expect(
		factions_by_identity_desc.get("rows", [])[0].get("reference_id", "") == "faction.harbor.two"
		and not factions_by_identity_desc.get("sort_ascending", true),
		"World Planner applies the same stable sort contract before paging"
	)
	var restored := model.restore_record(trashed_payload, "faction.harbor", "2026-07-28T10:00:09Z")
	var restored_payload: Dictionary = restored.get("payload", {})
	_expect(
		restored.get("ok", false)
		and restored.get("record", {}).get("record_id", "") == "faction.harbor"
		and restored.get("restored_link_count", -1) == 3
		and restored_payload.get("records", {}).get("npc.mira", {}).get("faction_id", "") == "faction.harbor"
		and restored_payload.get("records", {}).get("npc.mira", {}).get("updated_at_utc", "") == "2026-07-28T10:00:09Z"
		and "faction.harbor" in restored_payload.get("records", {}).get("place.north-quay", {}).get("faction_ids", [])
		and restored_payload.get("records", {}).get("rumour.black-sails", {}).get("subject_refs", [])[0].get("record_id", "") == "faction.harbor",
		"restore preserves identity and safely reattaches entity and narrative links"
	)
	var trashed_quest := model.trash_record(restored_payload, "quest.tide-bell", "2026-07-28T10:00:10Z")
	var deleted_npc_threads := model.query_narratives_for_subject(trashed_quest.get("payload", {}), "npc.mira", true)
	_expect(
		trashed_quest.get("ok", false)
		and deleted_npc_threads.get("total", -1) == 1
		and deleted_npc_threads.get("rows", [])[0].get("resolution_state", "") == "closed",
		"narrative trash preserves stable identity and manual resolution state for recovery"
	)
	var restored_quest := model.restore_record(trashed_quest.get("payload", {}), "quest.tide-bell", "2026-07-28T10:00:11Z")
	var restored_quest_payload: Dictionary = restored_quest.get("payload", {})
	_expect(
		restored_quest.get("ok", false)
		and restored_quest.get("record", {}).get("record_id", "") == "quest.tide-bell"
		and model.query_narratives_for_subject(restored_quest_payload, "place.north-quay").get("total", -1) == 1,
		"restoring a Quest preserves identity and every still-valid subject attachment"
	)
	var trashed_npc := model.trash_record(restored_quest_payload, "npc.mira", "2026-07-28T10:00:12Z")
	_expect(
		trashed_npc.get("ok", false)
		and trashed_npc.get("removed_link_count", -1) == 1
		and trashed_npc.get("payload", {}).get("records", {}).get("quest.tide-bell", {}).get("subject_refs", []).size() == 1
		and model.read_entity(trashed_npc.get("payload", {}), "npc.mira", true).get("record", {}).get("appearance", "") == "Salzgrauer Mantel",
		"trashing a narrative subject atomically removes only that subject attachment"
	)
	var restored_npc := model.restore_record(trashed_npc.get("payload", {}), "npc.mira", "2026-07-28T10:00:13Z")
	var final_payload: Dictionary = restored_npc.get("payload", {})
	_expect(
		restored_npc.get("restored_link_count", -1) == 1
		and model.query_narratives_for_subject(final_payload, "npc.mira").get("rows", [])[0].get("reference_id", "") == "quest.tide-bell",
		"restoring a subject atomically reattaches its surviving narrative thread"
	)
	_expect(not model.update_record(final_payload, "npc.mira", {"name": "   "}).get("ok", true), "World Planner rejects an invalid edit without a replacement payload")
	_expect(not model.query({"format": "damaged", "records": {}, "trash": {}}, "npc").get("ok", true), "malformed World Planner payload fails only its provider read")

	var data_root := "user://saltmarcher-world-planner-runtime/%s" % Time.get_ticks_usec()
	var registry := FileCampaignRegistry.new(data_root)
	var created := registry.create_campaign("World Planner Runtime")
	var campaign_id := str(created.get("campaign_id", ""))
	var coordinator := CampaignRuntimeCoordinator.new(data_root, registry)
	_expect(coordinator.open_durable_active().get("ok", false), "World Planner runtime opens its serial Campaign writer")
	var commands := WorldPlannerCommandController.new(data_root, coordinator)
	root.add_child(commands)
	var completions: Array = []
	commands.command_completed.connect(func(result: Dictionary) -> void: completions.append(result.duplicate(true)))
	var started := commands.create_record("place", "Salzgasse")
	_expect(started.get("status", "") == "started", "World Planner command prepares a name-only mutation off the scene-tree thread")
	for _attempt in 1200:
		if not completions.is_empty():
			break
		await create_timer(0.001).timeout
	_expect(completions.size() == 1 and completions[0].get("ok", false) and completions[0].get("status", "") == "created", "World Planner command publishes through the accepted asynchronous Campaign writer")
	var persisted := FileCampaignStore.new(data_root, campaign_id).read_partition(WorldPlannerKnowledge.OWNER)
	var persisted_query := model.query(persisted.get("payload", {}), "place", "salz", 0, 50)
	_expect(persisted.get("ok", false) and persisted_query.get("total", -1) == 1, "World Planner owner partition survives an independent store reopen")
	var persisted_place_id := str(persisted_query.get("rows", [])[0].get("reference_id", ""))
	var detail_reader := WorldPlannerDetailReadController.new(data_root)
	root.add_child(detail_reader)
	var detail_results: Array = []
	detail_reader.result_published.connect(func(result: Dictionary) -> void: detail_results.append(result.duplicate(true)))
	var first_detail_read := detail_reader.query(persisted_place_id, true)
	var replacement_detail_read := detail_reader.query(persisted_place_id, false)
	_expect(
		first_detail_read.get("status", "") == "started" and replacement_detail_read.get("status", "") == "queued",
		"World Planner detail lane bounds rapid replacement to one active and one latest pending request"
	)
	for _attempt in 1200:
		if detail_results.size() == 1 and not detail_reader.is_active():
			break
		await create_timer(0.001).timeout
	_expect(
		detail_results.size() == 1
		and detail_results[0].get("record", {}).get("record_id", "") == persisted_place_id
		and not detail_results[0].get("request", {}).get("include_deleted", true),
		"World Planner detail lane publishes only the latest full record after independent reopen"
	)
	var detail_resources := detail_reader.resource_snapshot()
	_expect(
		detail_resources.get("active_count", -1) == 0
		and detail_resources.get("pending_count", -1) == 0
		and detail_resources.get("worker_handle_count", -1) == 0,
		"World Planner detail lane releases all worker state after publication"
	)
	detail_reader.queue_free()
	await process_frame
	completions.clear()
	var narrative_started := commands.create_narrative("rumour", "Kalte Lichter", "Nur bei Springflut sichtbar.", "place", persisted_place_id)
	_expect(narrative_started.get("status", "") == "started", "typed narrative command enters the shared serial Campaign writer")
	for _attempt in 1200:
		if not completions.is_empty():
			break
		await create_timer(0.001).timeout
	var persisted_with_narrative := FileCampaignStore.new(data_root, campaign_id).read_partition(WorldPlannerKnowledge.OWNER)
	var reopened_threads := model.query_narratives_for_subject(persisted_with_narrative.get("payload", {}), persisted_place_id)
	_expect(
		completions.size() == 1
		and completions[0].get("ok", false)
		and reopened_threads.get("total", -1) == 1
		and reopened_threads.get("rows", [])[0].get("name", "") == "Kalte Lichter",
		"narrative command truth survives an independent Campaign store reopen"
	)
	var narrative_reader := WorldPlannerNarrativeReadController.new(data_root)
	root.add_child(narrative_reader)
	var narrative_results: Array = []
	narrative_reader.result_published.connect(func(result: Dictionary) -> void: narrative_results.append(result.duplicate(true)))
	var first_read := narrative_reader.query(persisted_place_id, true)
	var replacement_read := narrative_reader.query(persisted_place_id, false)
	_expect(
		first_read.get("status", "") == "started" and replacement_read.get("status", "") == "queued",
		"narrative read lane bounds rapid replacement to one active and one latest pending request"
	)
	for _attempt in 1200:
		if narrative_results.size() == 1 and not narrative_reader.is_active():
			break
		await create_timer(0.001).timeout
	_expect(
		narrative_results.size() == 1
		and not narrative_results[0].get("request", {}).get("include_deleted", true)
		and narrative_results[0].get("rows", []).size() == 1,
		"narrative read lane publishes only the latest requested dossier view"
	)
	var narrative_resources := narrative_reader.resource_snapshot()
	_expect(
		narrative_resources.get("active_count", -1) == 0
		and narrative_resources.get("pending_count", -1) == 0
		and narrative_resources.get("worker_handle_count", -1) == 0,
		"narrative read lane releases all worker state after publication"
	)
	narrative_reader.queue_free()
	await process_frame
	var session_state: Dictionary = coordinator.current_session().snapshot()["campaign_state"]
	var external_advance := FileCampaignStore.new(data_root, campaign_id).commit(
		int(session_state["generation"]),
		{"external-proof": {"marker": true}},
		session_state["runtime"]
	)
	_expect(external_advance.get("ok", false), "World Planner stale-write fixture advances durable Campaign truth outside its captured session")
	completions.clear()
	commands.create_record("faction", "Darf nicht erscheinen")
	for _attempt in 1200:
		if not completions.is_empty():
			break
		await create_timer(0.001).timeout
	var after_stale := FileCampaignStore.new(data_root, campaign_id)
	var stale_partition := after_stale.read_partition(WorldPlannerKnowledge.OWNER)
	_expect(
		completions.size() == 1
		and not completions[0].get("ok", true)
		and completions[0].get("status", "") == "stale"
		and after_stale.load_state().get("generation", -1) == external_advance.get("state", {}).get("generation", -2)
		and model.query(stale_partition.get("payload", {}), "faction").get("total", -1) == 0,
		"World Planner command rejects stale Campaign generation without publishing its candidate"
	)
	var resources := commands.resource_snapshot()
	_expect(not resources.get("busy", true) and resources.get("worker_handle_count", -1) == 0 and resources.get("ticket_count", -1) == 0, "World Planner command releases worker and write-ticket state after completion")
	commands.queue_free()
	await process_frame
	coordinator.revoke_current(-1)


func _run_binary_content_contract() -> void:
	var data_root := "user://saltmarcher-binary-content-tests/%s" % Time.get_ticks_usec()
	var registry := FileCampaignRegistry.new(data_root)
	var created := registry.create_campaign("Binary Closure")
	var campaign_id := str(created.get("campaign_id", ""))
	var store := FileCampaignStore.new(data_root, campaign_id)
	var source_path := data_root + "/sources/table-map.png"
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(source_path.get_base_dir()))
	var source_bytes := PackedByteArray()
	source_bytes.resize(1024 * 1024 + 17)
	source_bytes.fill(0x5a)
	source_bytes[0] = 0x89
	source_bytes[1] = 0x50
	source_bytes[2] = 0x4e
	source_bytes[3] = 0x47
	var source_file := FileAccess.open(source_path, FileAccess.WRITE)
	source_file.store_buffer(source_bytes)
	source_file.close()
	var initial := store.load_state()
	var invalid_name := store.commit(
		1,
		{},
		initial["runtime"],
		[],
		0,
		null,
		{"asset.map": {"source_path": source_path, "file_name": "CON.png", "media_kind": "map"}}
	)
	_expect(not invalid_name.get("ok", true), "asset commit rejects a non-portable target filename before publication")
	_expect(store.load_state().get("generation", -1) == 1, "rejected asset metadata publishes no Campaign generation")
	var first_chunk_bytes := "chunk-one".to_utf8_buffer()
	var first_binary_commit := store.commit(
		1,
		{},
		initial["runtime"],
		[],
		0,
		null,
		{
			"asset.map": {
				"source_path": source_path,
				"file_name": "table-map.png",
				"media_kind": "map",
			},
		},
		[],
		{
			"hex": {
				"q0_r0": {
					"bytes": first_chunk_bytes,
					"chunk_format": "saltmarcher.hex-chunk.v1",
				},
			},
		}
	)
	_expect(first_binary_commit.get("ok", false), "Campaign commit atomically publishes one streamed asset and one binary chunk reference")
	var generation_two: Dictionary = first_binary_commit.get("state", {})
	var first_asset_ref: Dictionary = generation_two.get("asset_refs", {}).get("asset.map", {})
	var first_chunk_ref: Dictionary = generation_two.get("chunk_refs", {}).get("hex", {}).get("q0_r0", {})
	_expect(
		first_asset_ref.get("asset_id", "") == "asset.map"
		and first_asset_ref.get("original_file_name", "") == "table-map.png"
		and first_asset_ref.get("size", "") == str(source_bytes.size()),
		"asset manifest preserves stable identity, original filename, and lossless byte size"
	)
	var asset_inspection := store.inspect_asset("asset.map", generation_two)
	_expect(asset_inspection.get("ok", false) and asset_inspection.get("present", false), "committed asset passes exact size and checksum inspection")
	var first_chunk := store.read_chunk("hex", "q0_r0", generation_two)
	_expect(first_chunk.get("ok", false) and first_chunk.get("bytes", PackedByteArray()) == first_chunk_bytes, "committed chunk round-trips exact bytes through its stable coordinate")
	var stale_binary := store.commit(
		1,
		{},
		generation_two["runtime"],
		[],
		0,
		null,
		{
			"asset.stale": {
				"bytes": "must-not-publish".to_utf8_buffer(),
				"file_name": "stale.bin",
				"media_kind": "other",
			},
		}
	)
	_expect(not stale_binary.get("ok", true) and stale_binary.get("status", "") == "stale", "stale binary mutation is rejected before content publication")
	_expect(not DirAccess.dir_exists_absolute(ProjectSettings.globalize_path(store.campaign_directory() + "/assets/asset.stale")), "stale binary mutation creates no asset artifact")

	var second_asset_bytes := PackedByteArray([0x89, 0x50, 0x4e, 0x47, 9, 8, 7, 6])
	var second_chunk_bytes := "chunk-two".to_utf8_buffer()
	var second_binary_commit := store.commit(
		2,
		{},
		generation_two["runtime"],
		[],
		0,
		null,
		{
			"asset.map": {
				"bytes": second_asset_bytes,
				"file_name": "table-map.png",
				"media_kind": "map",
			},
		},
		[],
		{
			"hex": {
				"q0_r0": {
					"bytes": second_chunk_bytes,
					"chunk_format": "saltmarcher.hex-chunk.v1",
				},
			},
		}
	)
	_expect(second_binary_commit.get("ok", false), "asset and chunk updates publish fresh immutable content revisions")
	var generation_three: Dictionary = second_binary_commit.get("state", {})
	var second_asset_ref: Dictionary = generation_three.get("asset_refs", {}).get("asset.map", {})
	var second_chunk_ref: Dictionary = generation_three.get("chunk_refs", {}).get("hex", {}).get("q0_r0", {})
	_expect(first_asset_ref.get("path", "") != second_asset_ref.get("path", ""), "stable asset identity points to a fresh immutable content path after update")
	_expect(first_chunk_ref.get("path", "") != second_chunk_ref.get("path", ""), "stable chunk coordinate points to a fresh immutable content path after update")
	_expect(FileAccess.file_exists(ProjectSettings.globalize_path(store.campaign_directory() + "/" + str(first_asset_ref["path"]))), "asset update retains prior bytes for local generation fallback")
	_expect(FileAccess.file_exists(ProjectSettings.globalize_path(store.campaign_directory() + "/" + str(first_chunk_ref["path"]))), "chunk update retains prior bytes for local generation fallback")

	var history_backup := CampaignBackupManager.new(data_root, registry).create_restore_tested_backup(campaign_id, 7000)
	_expect(history_backup.get("ok", false), "restore-tested backup closes over referenced assets and chunks")
	var bundle_path := data_root + "/exports/binary-closure.saltmarcher"
	var exported := CampaignBundle.new(data_root, registry).export_campaign(campaign_id, bundle_path)
	_expect(exported.get("ok", false), "complete Campaign export includes intact asset and chunk bytes")
	var imported := CampaignBundle.new(data_root, registry).import_campaign(bundle_path, 1)
	_expect(imported.get("ok", false), "complete Campaign import republishes the binary closure under an independent identity")
	var imported_id := str(imported.get("campaign_id", ""))
	var imported_store := FileCampaignStore.new(data_root, imported_id)
	var imported_state := imported_store.load_state()
	_expect(imported_store.inspect_asset("asset.map", imported_state).get("ok", false), "imported asset remains independently intact")
	_expect(imported_store.read_chunk("hex", "q0_r0", imported_state).get("bytes", PackedByteArray()) == second_chunk_bytes, "imported chunk remains byte-exact")

	var removed := store.commit(
		3,
		{},
		generation_three["runtime"],
		[],
		0,
		null,
		{},
		["asset.map"],
		{},
		{"hex": ["q0_r0"]}
	)
	_expect(removed.get("ok", false) and removed.get("state", {}).get("asset_refs", {}).is_empty(), "asset removal publishes only a new manifest without deleting fallback bytes")
	_expect(removed.get("state", {}).get("chunk_refs", {}).is_empty(), "chunk removal publishes only a new manifest without deleting fallback bytes")
	var advanced := removed
	for expected_generation in [4, 5]:
		advanced = store.commit(expected_generation, {}, advanced["state"]["runtime"])
		_expect(advanced.get("ok", false), "binary-compaction fixture advances generation %d" % (expected_generation + 1))
	var generation_six: Dictionary = advanced.get("state", {})
	var current_backup := CampaignBackupManager.new(data_root, registry).create_restore_tested_backup(campaign_id, 7100)
	_expect(current_backup.get("ok", false), "binary compaction receives an exact current restore-tested point")
	var compacted := CampaignBackupManager.new(data_root, registry).compact_campaign_history(campaign_id, 6, true, 3, 7200)
	_expect(compacted.get("ok", false) and compacted.get("status", "") == "campaign_compacted", "Campaign compaction collects asset and chunk revisions unreachable from retained local generations")
	for binary_ref in [first_asset_ref, second_asset_ref, first_chunk_ref, second_chunk_ref]:
		_expect(
			not FileAccess.file_exists(ProjectSettings.globalize_path(store.campaign_directory() + "/" + str(binary_ref["path"]))),
			"binary compaction removes unreachable path %s" % binary_ref["path"]
		)
	_expect(store.load_state().get("generation", -1) == generation_six.get("generation", -2), "binary compaction preserves current semantic Campaign truth")
	var staged_history := CampaignBackupClosure.new(data_root).stage_point(
		campaign_id,
		str(history_backup.get("backup", {}).get("backup_id", "")),
		"binary-history-proof"
	)
	_expect(staged_history.get("ok", false), "pre-removal recovery point reconstructs compacted historical binary bytes")
	if staged_history.get("ok", false):
		var staged_store := FileCampaignStore.new(data_root, campaign_id, Callable(), staged_history["staged_campaign"])
		var staged_state: Dictionary = staged_history["state"]
		_expect(staged_store.inspect_asset("asset.map", staged_state).get("ok", false), "historical recovery retains its asset revision")
		_expect(staged_store.read_chunk("hex", "q0_r0", staged_state).get("bytes", PackedByteArray()) == second_chunk_bytes, "historical recovery retains its chunk revision")
		CampaignBackupClosure.new(data_root).discard_staging(staged_history["staging_root"])

	var imported_asset_ref: Dictionary = imported_state.get("asset_refs", {}).get("asset.map", {})
	var imported_asset_path := imported_store.campaign_directory() + "/" + str(imported_asset_ref.get("path", ""))
	var damaged_asset := FileAccess.open(imported_asset_path, FileAccess.WRITE)
	damaged_asset.store_buffer(PackedByteArray([0, 1, 2]))
	damaged_asset.close()
	_expect(imported_store.load_state().get("ok", false), "damaged optional media does not block core Campaign open")
	_expect(imported_store.inspect_asset("asset.map").get("status", "") == "asset_damaged", "damaged asset is isolated and named explicitly")
	_expect(imported_store.read_chunk("hex", "q0_r0").get("ok", false), "unaffected chunk remains usable beside damaged media")
	var rejected_export := CampaignBundle.new(data_root, registry).export_campaign(imported_id, data_root + "/exports/damaged.saltmarcher")
	_expect(not rejected_export.get("ok", true), "complete export refuses a damaged asset closure")
	var rejected_backup := CampaignBackupManager.new(data_root, registry).create_restore_tested_backup(imported_id, 7300)
	_expect(not rejected_backup.get("ok", true), "complete recovery point refuses a damaged asset closure")

	var pressure_root := "user://saltmarcher-binary-pressure-tests/%s" % Time.get_ticks_usec()
	var pressure_registry := FileCampaignRegistry.new(pressure_root)
	var pressure_created := pressure_registry.create_campaign("Binary Pressure")
	var pressure_id := str(pressure_created.get("campaign_id", ""))
	var binary_pressure_guard := StorageCapacityGuard.new(func(_path: String) -> Dictionary:
		return {
			"ok": true,
			"available_bytes": 2 * 1024 * 1024 * 1024,
			"volume_capacity_bytes": -1,
		}
	)
	var pressure_store := FileCampaignStore.new(pressure_root, pressure_id, Callable(), "", binary_pressure_guard)
	var pressure_state := pressure_store.load_state()
	var pressured_asset := pressure_store.commit(
		1,
		{},
		pressure_state["runtime"],
		[],
		0,
		null,
		{
			"asset.pressure": {
				"bytes": "blocked-asset".to_utf8_buffer(),
				"file_name": "blocked.bin",
				"media_kind": "other",
			},
		}
	)
	_expect(not pressured_asset.get("ok", true) and pressured_asset.get("status", "") == "storage_pressure", "binary asset is rejected before publication when the storage reserve is reached")
	_expect(_directory_has_no_files(pressure_store.campaign_directory() + "/assets/asset.pressure"), "rejected low-space asset leaves no final or pending file")
	var pressured_chunk := pressure_store.commit(
		1,
		{},
		pressure_state["runtime"],
		[],
		0,
		null,
		{},
		[],
		{
			"world": {
				"pressure": {
					"bytes": "blocked-chunk".to_utf8_buffer(),
					"chunk_format": "saltmarcher.world-chunk.v1",
				},
			},
		}
	)
	_expect(not pressured_chunk.get("ok", true) and pressured_chunk.get("status", "") == "storage_pressure", "binary chunk is rejected before publication when the storage reserve is reached")
	_expect(_directory_has_no_files(pressure_store.campaign_directory() + "/chunks/world/pressure"), "rejected low-space chunk leaves no final or pending file")
	_expect(pressure_store.load_state().get("generation", -1) == 1, "binary storage-pressure failures leave Campaign truth unchanged")

	for fault_operation in ["campaign_asset", "campaign_chunk"]:
		var fault_root := "user://saltmarcher-binary-fault-tests/%s-%s" % [fault_operation, Time.get_ticks_usec()]
		var fault_registry := FileCampaignRegistry.new(fault_root)
		var fault_created := fault_registry.create_campaign("Binary Fault")
		var fault_id := str(fault_created.get("campaign_id", ""))
		var binary_fault := func(operation: String, phase: String, _path: String) -> bool:
			return operation == fault_operation and phase == "before_rename"
		var fault_store := FileCampaignStore.new(fault_root, fault_id, binary_fault)
		var fault_state := fault_store.load_state()
		var fault_result: Dictionary
		var fault_directory: String
		if fault_operation == "campaign_asset":
			fault_result = fault_store.commit(
				1,
				{},
				fault_state["runtime"],
				[],
				0,
				null,
				{
					"asset.fault": {
						"bytes": "faulted-asset".to_utf8_buffer(),
						"file_name": "faulted.bin",
						"media_kind": "other",
					},
				}
			)
			fault_directory = fault_store.campaign_directory() + "/assets/asset.fault"
		else:
			fault_result = fault_store.commit(
				1,
				{},
				fault_state["runtime"],
				[],
				0,
				null,
				{},
				[],
				{
					"world": {
						"fault": {
							"bytes": "faulted-chunk".to_utf8_buffer(),
							"chunk_format": "saltmarcher.world-chunk.v1",
						},
					},
				}
			)
			fault_directory = fault_store.campaign_directory() + "/chunks/world/fault"
		_expect(not fault_result.get("ok", true), "%s rename fault is surfaced" % fault_operation)
		_expect(_directory_has_no_files(fault_directory), "%s rename fault removes its pending binary" % fault_operation)
		_expect(fault_store.load_state().get("generation", -1) == 1, "%s rename fault publishes no Campaign generation" % fault_operation)

	var runtime_root := "user://saltmarcher-binary-runtime-tests/%s" % Time.get_ticks_usec()
	var runtime_registry := FileCampaignRegistry.new(runtime_root)
	var runtime_created := runtime_registry.create_campaign("Binary Runtime")
	var runtime_id := str(runtime_created.get("campaign_id", ""))
	var runtime_coordinator := CampaignRuntimeCoordinator.new(runtime_root, runtime_registry)
	runtime_coordinator.open_durable_active()
	var runtime_state: Dictionary = runtime_coordinator.current_session().snapshot()["campaign_state"]["runtime"].duplicate(true)
	var binary_ticket := runtime_coordinator.submit_current_commit(
		1,
		1,
		{},
		runtime_state,
		[],
		{
			"asset.audio": {
				"bytes": "audio-bytes".to_utf8_buffer(),
				"file_name": "table-theme.ogg",
				"media_kind": "audio",
			},
		},
		[],
		{
			"dungeon": {
				"level0_x0_y0": {
					"bytes": "dungeon-chunk".to_utf8_buffer(),
					"chunk_format": "saltmarcher.dungeon-chunk.v1",
				},
			},
		}
	)
	_expect(binary_ticket.get("status", "") == "accepted", "production runtime accepts asset and chunk changes through its serial asynchronous writer")
	var binary_terminal: Dictionary = {}
	for _attempt in 300:
		binary_terminal = runtime_coordinator.poll_current_commit(str(binary_ticket.get("ticket_id", "")))
		if binary_terminal.get("status", "") == "completed":
			break
		OS.delay_msec(2)
	_expect(binary_terminal.get("result", {}).get("ok", false), "production runtime publishes asset and chunk changes atomically with Campaign generation")
	var runtime_store := FileCampaignStore.new(runtime_root, runtime_id)
	_expect(runtime_store.inspect_asset("asset.audio").get("ok", false), "production runtime asset remains readable after terminal write")
	_expect(runtime_store.read_chunk("dungeon", "level0_x0_y0").get("bytes", PackedByteArray()) == "dungeon-chunk".to_utf8_buffer(), "production runtime chunk remains byte-exact after terminal write")
	runtime_coordinator.revoke_current(-1)


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
	var cancelled_export_path := source_root + "/exports/cancelled.saltmarcher"
	var cancel_export := {"requested": false}
	var cancelled_export := exporter.export_campaign(
		source_campaign_id,
		cancelled_export_path,
		func(update: Dictionary) -> void:
			if update.get("phase", "") == "writing":
				cancel_export["requested"] = true,
		func() -> bool: return bool(cancel_export["requested"])
	)
	_expect(cancelled_export.get("status", "") == "cancelled", "production Campaign export cancels after partial bundle writing")
	_expect(not FileAccess.file_exists(cancelled_export_path), "cancelled production export publishes no bundle")
	_expect(_has_no_files_with_prefix(cancelled_export_path.get_base_dir(), "cancelled.saltmarcher.pending-"), "cancelled production export removes its pending bundle bytes")

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


func _run_portability_controller_resource_contract() -> void:
	var data_root := "user://saltmarcher-portability-controller-resource/%s" % Time.get_ticks_usec()
	var registry := FileCampaignRegistry.new(data_root)
	var publication_state := {"count": 0}
	var publication_mutex := Mutex.new()
	var next_mode := {"value": "early"}
	var controller := CampaignPortabilityController.new(
		data_root,
		registry,
		null,
		func(_root: String, _registry, _guard):
			return PortabilityCancellationProbe.new(
				str(next_mode["value"]),
				publication_state,
				publication_mutex
			)
	)
	root.add_child(controller)
	var progress_events: Array = []
	var completions: Array = []
	controller.progress_changed.connect(func(progress: Dictionary) -> void:
		progress_events.append(progress.duplicate(true))
	)
	controller.operation_completed.connect(func(kind: String, result: Dictionary) -> void:
		completions.append({"kind": kind, "result": result.duplicate(true)})
	)

	next_mode["value"] = "early"
	controller.export_campaign("warmup", data_root + "/warmup.saltmarcher")
	controller.cancel_active()
	for _attempt in 600:
		if not controller.is_active():
			break
		await create_timer(0.001).timeout
	await process_frame
	progress_events.clear()
	completions.clear()
	var baseline_rss := _resident_memory_bytes()
	var request_ack_usec: Array[int] = []
	var terminal_cleanup_usec: Array[int] = []
	var expected_publications := 0
	var modes: Array[String] = []
	for index in 20:
		modes.append("early" if index < 7 else ("mid" if index < 14 else "commit_boundary"))
	for cycle in modes.size():
		var mode := modes[cycle]
		next_mode["value"] = mode
		progress_events.clear()
		var completion_count_before := completions.size()
		var started := controller.export_campaign(
			"cycle-%d" % cycle,
			data_root + "/cycle-%d.saltmarcher" % cycle
		)
		_expect(started.get("status", "") == "started", "cancellation cycle %d starts exactly one portability worker" % cycle)
		if mode == "mid":
			for _attempt in 600:
				if _progress_has_phase(progress_events, "middle"):
					break
				await create_timer(0.001).timeout
		elif mode == "commit_boundary":
			for _attempt in 600:
				if _progress_has_phase(progress_events, "committed"):
					break
				await create_timer(0.001).timeout
			expected_publications += 1
		var cancel_started_usec := Time.get_ticks_usec()
		var cancellation := controller.cancel_active()
		request_ack_usec.append(Time.get_ticks_usec() - cancel_started_usec)
		_expect(cancellation.get("status", "") == "cancellation_requested", "cancellation cycle %d acknowledges the active request" % cycle)
		for _attempt in 10_000:
			if not controller.is_active():
				break
			await create_timer(0.001).timeout
		terminal_cleanup_usec.append(Time.get_ticks_usec() - cancel_started_usec)
		await process_frame
		_expect(completions.size() == completion_count_before + 1, "cancellation cycle %d emits exactly one terminal result" % cycle)
		if completions.size() > completion_count_before:
			var terminal: Dictionary = completions.back()["result"]
			var expected_status := "exported" if mode == "commit_boundary" else "cancelled"
			_expect(terminal.get("status", "") == expected_status, "cancellation cycle %d preserves its linearized %s result" % [cycle, expected_status])
		var resources := controller.resource_snapshot()
		_expect(
			not resources.get("active", true)
			and int(resources.get("worker_handle_count", -1)) == 0
			and int(resources.get("pending_operation_count", -1)) == 0,
			"cancellation cycle %d releases its worker handle and queue state" % cycle
		)
	publication_mutex.lock()
	var publication_count := int(publication_state.get("count", -1))
	publication_mutex.unlock()
	_expect(publication_count == expected_publications, "twenty cancellation cycles publish only post-commit-boundary results exactly once")
	request_ack_usec.sort()
	terminal_cleanup_usec.sort()
	_expect(request_ack_usec[18] <= 1_000_000, "cancellation request acknowledgement p95 remains within one second")
	_expect(terminal_cleanup_usec[18] <= 10_000_000, "cancellation terminal cleanup p95 remains within ten seconds")
	await process_frame
	await process_frame
	var final_rss := _resident_memory_bytes()
	if baseline_rss > 0 and final_rss > 0:
		_expect(final_rss <= int(float(baseline_rss) * 1.10), "twenty cancellation cycles return Linux resident memory within ten percent of steady state")
	controller.queue_free()
	await process_frame


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


func _progress_has_phase(events: Array, phase: String) -> bool:
	for event in events:
		if str(event.get("phase", "")) == phase:
			return true
	return false


func _resident_memory_bytes() -> int:
	var status := FileAccess.open("/proc/self/status", FileAccess.READ)
	if status == null:
		return -1
	var contents := status.get_as_text()
	status.close()
	for line in contents.split("\n"):
		if not line.begins_with("VmRSS:"):
			continue
		var fields := line.split(" ", false)
		if fields.size() >= 2 and str(fields[1]).is_valid_int():
			return str(fields[1]).to_int() * 1024
	return -1


func _has_no_child_directories(path: String) -> bool:
	var absolute_path := ProjectSettings.globalize_path(path)
	return (
		not DirAccess.dir_exists_absolute(absolute_path)
		or DirAccess.get_directories_at(absolute_path).is_empty()
	)


func _directory_has_no_files(path: String) -> bool:
	var absolute_path := ProjectSettings.globalize_path(path)
	return (
		not DirAccess.dir_exists_absolute(absolute_path)
		or DirAccess.get_files_at(absolute_path).is_empty()
	)


func _has_no_files_with_prefix(path: String, prefix: String) -> bool:
	var absolute_path := ProjectSettings.globalize_path(path)
	if not DirAccess.dir_exists_absolute(absolute_path):
		return true
	for file_name in DirAccess.get_files_at(absolute_path):
		if file_name.begins_with(prefix):
			return false
	return true
