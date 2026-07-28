extends SceneTree

const FileCampaignRegistry = preload("res://godot/src/platform/persistence/file_campaign_registry.gd")
const FileCampaignStore = preload("res://godot/src/platform/persistence/file_campaign_store.gd")
const ImmutableJsonFiles = preload("res://godot/src/platform/persistence/immutable_json_files.gd")
const StorageCapacityGuard = preload("res://godot/src/platform/persistence/storage_capacity_guard.gd")

const CAMPAIGN_COUNT := 1_000
const WARMUP_RUNS := 5
const MEASURED_RUNS := 100
const P95_INDEX := 94
const INTERACTION_BUDGET_USEC := 1_000_000
const TIMEOUT_USEC := 10_000_000


func _init() -> void:
	call_deferred("_run_profile")


func _run_profile() -> void:
	var data_root := "user://saltmarcher-campaign-registry-profile/%s" % Time.get_ticks_usec()
	var capacity_guard := StorageCapacityGuard.new(func(_path: String) -> Dictionary:
		return {
			"ok": true,
			"available_bytes": 100 * 1024 * 1024 * 1024,
			"volume_capacity_bytes": 200 * 1024 * 1024 * 1024,
		}
	)
	var registry := FileCampaignRegistry.new(data_root, Callable(), capacity_guard)
	var campaigns: Array = []
	var fixture_started_usec := Time.get_ticks_usec()
	for index in range(CAMPAIGN_COUNT):
		var campaign_id := "campaign.profile.%04d" % index
		var campaign_name := "Profilroute %04d" % index
		var initialized := FileCampaignStore.new(
			data_root,
			campaign_id,
			Callable(),
			"",
			capacity_guard
		).initialize(campaign_name, "2026-07-28T12:00:00Z")
		if not initialized.get("ok", false):
			_fail("Campaign fixture %d failed: %s" % [index, initialized.get("error", "unknown")], data_root)
			return
		campaigns.append({
			"id": campaign_id,
			"name": campaign_name,
			"created_at_utc": "2026-07-28T12:00:00Z",
		})
		if (index + 1) % 100 == 0:
			print("Campaign registry profile fixture: %d/%d" % [index + 1, CAMPAIGN_COUNT])
	var target_id := str(campaigns.back()["id"])
	if not registry.load_state().get("ok", false):
		_fail("Registry fixture root initialization failed", data_root)
		return
	var committed: Dictionary = registry.call("_commit_generation", {
		"generation": 1,
		"parent_generation": 0,
		"active_campaign_id": target_id,
		"campaigns": campaigns,
		"shared_definitions_generation": 0,
	})
	if not committed.get("ok", false):
		_fail("Registry fixture publication failed: %s" % committed.get("error", "unknown"), data_root)
		return
	var fixture_usec := Time.get_ticks_usec() - fixture_started_usec
	var target_store := FileCampaignStore.new(data_root, target_id, Callable(), "", capacity_guard)

	for _warmup in range(WARMUP_RUNS):
		if not _verify_list(registry.load_state(), target_id) or not _verify_open(target_store.load_state(), target_id):
			_fail("Warmup semantic oracle failed", data_root)
			return

	var list_durations_usec: Array[int] = []
	var open_durations_usec: Array[int] = []
	for _run in range(MEASURED_RUNS):
		var list_started_usec := Time.get_ticks_usec()
		var listed := registry.load_state()
		list_durations_usec.append(Time.get_ticks_usec() - list_started_usec)
		if not _verify_list(listed, target_id):
			_fail("Measured registry-list semantic oracle failed", data_root)
			return

		var open_started_usec := Time.get_ticks_usec()
		var opened := target_store.load_state()
		open_durations_usec.append(Time.get_ticks_usec() - open_started_usec)
		if not _verify_open(opened, target_id):
			_fail("Measured Campaign-open semantic oracle failed", data_root)
			return

	list_durations_usec.sort()
	open_durations_usec.sort()
	var measurement := ImmutableJsonFiles.new().measure_tree(data_root)
	if not measurement.get("ok", false):
		_fail("Fixture measurement failed", data_root)
		return
	var report := {
		"profile": "campaign-registry-scale-v1",
		"fixture": {
			"campaign_count": CAMPAIGN_COUNT,
			"file_count": int(measurement.get("file_count", -1)),
			"total_bytes": int(measurement.get("total_bytes", -1)),
			"creation_usec": fixture_usec,
		},
		"population": {
			"warmups": WARMUP_RUNS,
			"measured_runs": MEASURED_RUNS,
			"p95_index_zero_based": P95_INDEX,
		},
		"registry_list_usec": {
			"p95": list_durations_usec[P95_INDEX],
			"max": list_durations_usec.back(),
			"budget": INTERACTION_BUDGET_USEC,
			"timeout": TIMEOUT_USEC,
		},
		"campaign_open_usec": {
			"p95": open_durations_usec[P95_INDEX],
			"max": open_durations_usec.back(),
			"budget": INTERACTION_BUDGET_USEC,
			"timeout": TIMEOUT_USEC,
		},
		"environment": {
			"godot": Engine.get_version_info().get("string", "unknown"),
			"os": OS.get_name(),
			"distribution": OS.get_distribution_name(),
			"architecture": Engine.get_architecture_name(),
			"processor": OS.get_processor_name(),
			"processor_count": OS.get_processor_count(),
		},
		"semantic_oracle": "1000 exact registry rows plus exact active Campaign identity and generation",
		"passed": (
			list_durations_usec[P95_INDEX] <= INTERACTION_BUDGET_USEC
			and list_durations_usec.back() <= TIMEOUT_USEC
			and open_durations_usec[P95_INDEX] <= INTERACTION_BUDGET_USEC
			and open_durations_usec.back() <= TIMEOUT_USEC
		),
	}
	print("CAMPAIGN_REGISTRY_SCALE_REPORT %s" % JSON.stringify(report))
	var cleanup := ImmutableJsonFiles.new().remove_tree(data_root)
	if not cleanup.get("ok", false):
		push_error("Campaign registry profile fixture cleanup failed")
		quit(1)
		return
	quit(0 if report["passed"] else 1)


func _verify_list(state: Dictionary, target_id: String) -> bool:
	var campaigns: Array = state.get("campaigns", [])
	return (
		state.get("ok", false)
		and int(state.get("generation", -1)) == 1
		and state.get("active_campaign_id", "") == target_id
		and campaigns.size() == CAMPAIGN_COUNT
		and campaigns.front().get("id", "") == "campaign.profile.0000"
		and campaigns.back().get("id", "") == target_id
	)


func _verify_open(state: Dictionary, target_id: String) -> bool:
	return (
		state.get("ok", false)
		and int(state.get("generation", -1)) == 1
		and state.get("identity", {}).get("campaign_id", "") == target_id
	)


func _fail(message: String, data_root: String) -> void:
	push_error(message)
	ImmutableJsonFiles.new().remove_tree(data_root)
	quit(1)
