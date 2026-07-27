class_name CampaignCompactionScheduler
extends Node

## Automatically compacts only the active Campaign after a bounded history threshold.

const FileCampaignRegistry = preload("res://godot/src/platform/persistence/file_campaign_registry.gd")
const FileCampaignStore = preload("res://godot/src/platform/persistence/file_campaign_store.gd")

const DEFAULT_TRIGGER_GENERATIONS := 64
const DEFAULT_MINIMUM_LOCAL_GENERATIONS := 3
const DEFAULT_RETRY_DELAY_SECONDS := 5

signal operation_started(kind: String, campaign_id: String)
signal operation_completed(kind: String, result: Dictionary)

var _data_root: String
var _registry
var _runtime_coordinator
var _maintenance_mutex: Mutex
var _trigger_generations: int
var _minimum_local_generations: int
var _retry_delay_seconds: int
var _pending: Dictionary = {}
var _worker := Thread.new()
var _worker_mode := ""
var _worker_campaign_id := ""
var _worker_generation := 0
var _last_result: Dictionary = {}


func _init(
	data_root: String = "user://salt-marcher",
	registry = null,
	runtime_coordinator = null,
	trigger_generations: int = DEFAULT_TRIGGER_GENERATIONS,
	minimum_local_generations: int = DEFAULT_MINIMUM_LOCAL_GENERATIONS,
	retry_delay_seconds: int = DEFAULT_RETRY_DELAY_SECONDS,
	maintenance_mutex: Mutex = null
) -> void:
	_data_root = data_root.trim_suffix("/")
	_registry = registry if registry != null else FileCampaignRegistry.new(_data_root)
	_runtime_coordinator = runtime_coordinator
	_maintenance_mutex = maintenance_mutex if maintenance_mutex != null else Mutex.new()
	_trigger_generations = maxi(trigger_generations, minimum_local_generations + 1)
	_minimum_local_generations = maxi(2, minimum_local_generations)
	_retry_delay_seconds = maxi(0, retry_delay_seconds)


func _ready() -> void:
	_bootstrap_active_campaign()
	set_process(true)


func note_confirmed_generation(campaign_id: String, generation: int) -> void:
	if campaign_id.is_empty() or generation <= 0:
		return
	var existing: Dictionary = _pending.get(campaign_id, {})
	_pending[campaign_id] = {
		"generation": maxi(generation, int(existing.get("generation", 0))),
		"due_at_unix": 0,
		"phase": "assess",
	}


func _process(_delta: float) -> void:
	if _runtime_coordinator != null:
		_runtime_coordinator.flush_backup_notifications()
	if _worker.is_started():
		if _worker.is_alive():
			return
		var result: Dictionary = _worker.wait_to_finish()
		_worker = Thread.new()
		_finish_worker(result)
	if _worker.is_started():
		return
	_start_next_due()


func _exit_tree() -> void:
	if _worker.is_started():
		_worker.wait_to_finish()
		_worker = Thread.new()
	_worker_mode = ""
	_worker_campaign_id = ""
	_worker_generation = 0


func pending_count() -> int:
	return _pending.size()


func is_active() -> bool:
	return _worker.is_started()


func last_result() -> Dictionary:
	return _last_result.duplicate(true)


func _bootstrap_active_campaign() -> void:
	var state: Dictionary = _registry.load_state()
	if not state.get("ok", false):
		_last_result = state
		return
	var campaign_id := str(state.get("active_campaign_id", ""))
	if campaign_id.is_empty():
		return
	var campaign_state := FileCampaignStore.new(_data_root, campaign_id).load_state()
	if not campaign_state.get("ok", false):
		_last_result = campaign_state
		return
	note_confirmed_generation(campaign_id, int(campaign_state["generation"]))


func _start_next_due() -> void:
	var now_unix := int(Time.get_unix_time_from_system())
	var campaign_ids: Array = _pending.keys()
	campaign_ids.sort()
	for campaign_id_value in campaign_ids:
		var campaign_id := str(campaign_id_value)
		var pending: Dictionary = _pending[campaign_id]
		if int(pending.get("due_at_unix", 0)) > now_unix:
			continue
		_worker_campaign_id = campaign_id
		_worker_generation = int(pending.get("generation", 0))
		_worker_mode = str(pending.get("phase", "assess"))
		var callable := (
			_run_compaction.bind(campaign_id, _worker_generation, now_unix)
			if _worker_mode == "compact"
			else _assess_compaction.bind(campaign_id, _worker_generation)
		)
		if _worker_mode == "compact":
			operation_started.emit("campaign_compaction", campaign_id)
		var start_error := _worker.start(callable)
		if start_error != OK:
			var failed := {
				"ok": false,
				"status": "compaction_worker_error",
				"error": "Automatische Campaign-Compaction konnte nicht gestartet werden.",
				"campaign_id": campaign_id,
			}
			_finish_worker(failed)
		return


func _assess_compaction(campaign_id: String, observed_generation: int) -> Dictionary:
	var registry_state := FileCampaignRegistry.new(_data_root).load_state()
	if not registry_state.get("ok", false):
		return registry_state
	if str(registry_state.get("active_campaign_id", "")) != campaign_id:
		return {"ok": true, "status": "compaction_not_active", "campaign_id": campaign_id}
	var store := FileCampaignStore.new(_data_root, campaign_id)
	var state: Dictionary = store.load_state()
	if not state.get("ok", false):
		return state
	var generation := int(state["generation"])
	if generation != observed_generation:
		return {
			"ok": false,
			"status": "stale",
			"error": "Campaign änderte sich während der Compaction-Planung.",
			"campaign_id": campaign_id,
			"generation": generation,
		}
	var inventory: Dictionary = store.generation_inventory()
	if not inventory.get("ok", false):
		return inventory
	if not inventory.get("rejected_generations", []).is_empty():
		return {
			"ok": true,
			"status": "compaction_deferred_for_damage",
			"campaign_id": campaign_id,
			"rejected_generations": inventory["rejected_generations"],
		}
	var generation_count: int = inventory.get("valid_generations", []).size()
	if generation_count < _trigger_generations:
		return {
			"ok": true,
			"status": "compaction_not_due",
			"campaign_id": campaign_id,
			"generation": generation,
			"local_generation_count": generation_count,
			"trigger_generation_count": _trigger_generations,
		}
	return {
		"ok": true,
		"status": "compaction_due",
		"campaign_id": campaign_id,
		"generation": generation,
		"local_generation_count": generation_count,
		"trigger_generation_count": _trigger_generations,
	}


func _run_compaction(campaign_id: String, generation: int, now_unix: int) -> Dictionary:
	if _runtime_coordinator == null:
		return {
			"ok": false,
			"status": "runtime_coordinator_required",
			"error": "Automatische Campaign-Compaction benötigt den aktiven Runtime-Coordinator.",
		}
	_maintenance_mutex.lock()
	var result: Dictionary = _runtime_coordinator.compact_current_history_if_matches(
		campaign_id,
		generation,
		_minimum_local_generations,
		now_unix
	)
	_maintenance_mutex.unlock()
	return result


func _finish_worker(result: Dictionary) -> void:
	_last_result = result.duplicate(true)
	var mode := _worker_mode
	var campaign_id := _worker_campaign_id
	var observed_generation := _worker_generation
	_worker_mode = ""
	_worker_campaign_id = ""
	_worker_generation = 0
	if campaign_id.is_empty() or not _pending.has(campaign_id):
		return
	var pending: Dictionary = _pending[campaign_id]
	if mode == "compact":
		operation_completed.emit("campaign_compaction", result)
	if int(pending.get("generation", 0)) > observed_generation:
		pending["phase"] = "assess"
		pending["due_at_unix"] = 0
		_pending[campaign_id] = pending
		return
	var status := str(result.get("status", ""))
	if mode == "assess" and status == "compaction_due":
		pending["phase"] = "compact"
		pending["due_at_unix"] = 0
		_pending[campaign_id] = pending
		return
	if status == "stale" and int(result.get("generation", -1)) > 0:
		pending["generation"] = int(result["generation"])
		pending["phase"] = "assess"
		pending["due_at_unix"] = 0
		_pending[campaign_id] = pending
		return
	if result.get("ok", false) and status in [
		"compaction_not_active",
		"compaction_not_due",
		"compaction_deferred_for_damage",
		"compaction_current",
		"campaign_compacted",
	]:
		_pending.erase(campaign_id)
		return
	pending["phase"] = "assess" if mode == "assess" else "compact"
	pending["due_at_unix"] = int(Time.get_unix_time_from_system()) + _retry_delay_seconds
	_pending[campaign_id] = pending
