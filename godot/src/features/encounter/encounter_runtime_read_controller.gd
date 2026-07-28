class_name EncounterRuntimeReadController
extends Node

## Latest-wins projection of saved plans, active Party facts, and one focused
## Encounter runtime context.

const FileCampaignRegistry = preload("res://godot/src/platform/persistence/file_campaign_registry.gd")
const FileCampaignStore = preload("res://godot/src/platform/persistence/file_campaign_store.gd")
const EncounterPlanKnowledge = preload("res://godot/src/features/encounter/encounter_plan_knowledge.gd")
const EncounterRuntimeKnowledge = preload("res://godot/src/features/encounter/encounter_runtime_knowledge.gd")
const PartyRoster = preload("res://godot/src/features/party/party_roster.gd")

signal query_started(request: Dictionary)
signal result_published(result: Dictionary)

var _data_root: String
var _thread: Thread
var _mutex := Mutex.new()
var _active_request: Dictionary = {}
var _pending_request: Dictionary = {}
var _cancel_active := false
var _latest_epoch := 0


func _init(data_root: String) -> void:
	_data_root = data_root.trim_suffix("/")


func query(search_text: String = "") -> Dictionary:
	_mutex.lock()
	_latest_epoch += 1
	var request := {"epoch": _latest_epoch, "search_text": search_text}
	if not _active_request.is_empty():
		_pending_request = request
		_cancel_active = true
		_mutex.unlock()
		return {"ok": true, "status": "queued", "epoch": request["epoch"]}
	_active_request = request
	_cancel_active = false
	_mutex.unlock()
	return _start(request)


func cancel_all() -> Dictionary:
	_mutex.lock()
	_latest_epoch += 1
	_pending_request.clear()
	_cancel_active = not _active_request.is_empty()
	var active := not _active_request.is_empty()
	_mutex.unlock()
	return {"ok": true, "status": "cancellation_requested" if active else "idle"}


func is_active() -> bool:
	_mutex.lock()
	var active := not _active_request.is_empty()
	_mutex.unlock()
	return active


func resource_snapshot() -> Dictionary:
	_mutex.lock()
	var result := {
		"active_count": 0 if _active_request.is_empty() else 1,
		"pending_count": 0 if _pending_request.is_empty() else 1,
		"worker_handle_count": 1 if _thread != null else 0,
		"latest_epoch": _latest_epoch,
	}
	_mutex.unlock()
	return result


func _start(request: Dictionary) -> Dictionary:
	_thread = Thread.new()
	var start_error := _thread.start(_run_query.bind(request.duplicate(true)))
	if start_error != OK:
		_thread = null
		_mutex.lock()
		_active_request.clear()
		_mutex.unlock()
		return {"ok": false, "status": "worker_error", "error": "Encounter-Laufzeit konnte nicht geladen werden."}
	query_started.emit(request.duplicate(true))
	return {"ok": true, "status": "started", "epoch": request["epoch"]}


func _run_query(request: Dictionary) -> void:
	var registry := FileCampaignRegistry.new(_data_root)
	var registry_state: Dictionary = registry.load_state()
	var result: Dictionary
	var campaign_id := str(registry_state.get("active_campaign_id", ""))
	if not registry_state.get("ok", false):
		result = registry_state
	elif campaign_id.is_empty():
		result = {"ok": false, "status": "campaign_required", "error": "Wähle zuerst eine Campaign."}
	else:
		var store := FileCampaignStore.new(_data_root, campaign_id)
		var campaign_state := store.load_state()
		if not campaign_state.get("ok", false):
			result = campaign_state
		else:
			result = _project(store, campaign_state, request)
			if result.get("ok", false):
				var confirmed_registry: Dictionary = registry.load_state()
				var confirmed_campaign: Dictionary = store.load_state()
				if (
					not confirmed_registry.get("ok", false)
					or confirmed_registry.get("active_campaign_id", "") != campaign_id
					or int(confirmed_registry.get("generation", -1)) != int(registry_state.get("generation", -2))
					or not confirmed_campaign.get("ok", false)
					or int(confirmed_campaign.get("generation", -1)) != int(campaign_state.get("generation", -2))
				):
					result = {"ok": false, "status": "stale", "error": "Die Campaign änderte sich während der Encounter-Abfrage."}
				else:
					result["campaign_id"] = campaign_id
					result["campaign_generation"] = int(campaign_state["generation"])
	result["epoch"] = request["epoch"]
	call_deferred("_finish_on_main", result)


func _project(store, campaign_state: Dictionary, request: Dictionary) -> Dictionary:
	var encounter_model := EncounterPlanKnowledge.new()
	var encounter_read: Dictionary = store.read_partition(EncounterPlanKnowledge.OWNER, campaign_state)
	if not encounter_read.get("ok", false):
		return encounter_read
	var encounter_payload: Dictionary = encounter_read.get("payload", encounter_model.empty_payload())
	var encounter_validation := encounter_model.validate_payload(encounter_payload)
	if not encounter_validation.get("ok", false):
		return encounter_validation
	if _cancelled_from_worker():
		return _cancelled_result()
	var party_model := PartyRoster.new()
	var party_read: Dictionary = store.read_partition(PartyRoster.OWNER, campaign_state)
	if not party_read.get("ok", false):
		return party_read
	var party_snapshot := party_model.snapshot(
		party_read.get("payload", party_model.empty_payload()),
		"",
		false,
		PartyRoster.MAX_SEARCH_PAGE_SIZE,
		Callable(self, "_cancelled_from_worker")
	)
	if not party_snapshot.get("ok", false):
		return party_snapshot
	var plans := encounter_model.query(
		encounter_validation["payload"],
		str(request["search_text"]),
		0,
		EncounterPlanKnowledge.MAX_PAGE_SIZE,
		false,
		"name",
		true,
		Callable(self, "_cancelled_from_worker")
	)
	if not plans.get("ok", false):
		return plans
	var runtime := EncounterRuntimeKnowledge.new().snapshot(encounter_validation["payload"])
	if not runtime.get("ok", false):
		return runtime
	return {
		"ok": true,
		"status": runtime["status"],
		"plans": plans["rows"],
		"plan_total": plans["total"],
		"search_text": request["search_text"],
		"active_party": party_snapshot["active"],
		"party_summary": party_snapshot["summary"],
		"context": runtime["context"],
	}


func _cancelled_from_worker() -> bool:
	_mutex.lock()
	var cancelled := _cancel_active
	_mutex.unlock()
	return cancelled


func _cancelled_result() -> Dictionary:
	return {"ok": false, "status": "cancelled", "error": "Encounter-Abfrage wurde ersetzt."}


func _finish_on_main(result: Dictionary) -> void:
	if _thread != null:
		_thread.wait_to_finish()
		_thread = null
	_mutex.lock()
	var finished_epoch := int(_active_request.get("epoch", -1))
	var publish := finished_epoch == _latest_epoch and int(result.get("epoch", -2)) == finished_epoch
	_active_request.clear()
	_cancel_active = false
	var next_request: Dictionary = _pending_request.duplicate(true)
	_pending_request.clear()
	if not next_request.is_empty():
		_active_request = next_request
	_mutex.unlock()
	if publish:
		result_published.emit(result.duplicate(true))
	if not next_request.is_empty():
		_start(next_request)


func _exit_tree() -> void:
	cancel_all()
	if _thread != null:
		_thread.wait_to_finish()
		_thread = null
