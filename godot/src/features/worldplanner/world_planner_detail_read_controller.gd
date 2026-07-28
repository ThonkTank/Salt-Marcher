class_name WorldPlannerDetailReadController
extends Node

## Latest-wins read lane for one full World Planner entity record.

const FileCampaignRegistry = preload("res://godot/src/platform/persistence/file_campaign_registry.gd")
const FileCampaignStore = preload("res://godot/src/platform/persistence/file_campaign_store.gd")
const SharedDefinitionStore = preload("res://godot/src/platform/persistence/shared_definition_store.gd")
const WorldPlannerKnowledge = preload("res://godot/src/features/worldplanner/world_planner_knowledge.gd")

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


func query(record_id: String, include_deleted: bool = false) -> Dictionary:
	_mutex.lock()
	_latest_epoch += 1
	var request := {
		"epoch": _latest_epoch,
		"record_id": record_id,
		"include_deleted": include_deleted,
	}
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
		return {"ok": false, "status": "worker_error", "error": "World-Planner-Details konnten nicht geladen werden."}
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
			var read := store.read_partition(WorldPlannerKnowledge.OWNER, campaign_state)
			if not read.get("ok", false):
				result = read
			else:
				var model := WorldPlannerKnowledge.new()
				result = model.read_entity(
					read.get("payload", model.empty_payload()),
					str(request["record_id"]),
					bool(request["include_deleted"]),
					Callable(self, "_cancelled_from_worker")
				)
				if result.get("ok", false) and result.get("record", {}).get("kind", "") == "faction":
					var inventory_labels := _resolve_inventory_labels(
						result["record"],
						int(registry_state.get("shared_definitions_generation", 0))
					)
					if not inventory_labels.get("ok", false):
						result = inventory_labels
					else:
						result["inventory_labels"] = inventory_labels["labels"]
						result["missing_inventory_definition_ids"] = inventory_labels["missing_definition_ids"]
				if result.get("ok", false):
					var confirmed: Dictionary = registry.load_state()
					if (
						not confirmed.get("ok", false)
						or confirmed.get("active_campaign_id", "") != campaign_id
						or int(confirmed.get("generation", -1)) != int(registry_state.get("generation", -2))
						or int(confirmed.get("shared_definitions_generation", -1))
						!= int(registry_state.get("shared_definitions_generation", -2))
					):
						result = {"ok": false, "status": "stale", "error": "Die aktive Campaign änderte sich während der Detailabfrage."}
					else:
						result["campaign_id"] = campaign_id
						result["campaign_generation"] = campaign_state["generation"]
	result["epoch"] = request["epoch"]
	result["request"] = request.duplicate(true)
	call_deferred("_finish_on_main", result)


func _resolve_inventory_labels(record: Dictionary, generation: int) -> Dictionary:
	var creature_ids: Array = record.get("inventory_limits", {}).keys()
	var labels := SharedDefinitionStore.new(_data_root).reference_labels(
		creature_ids,
		generation,
		"creature",
		Callable(self, "_cancelled_from_worker")
	)
	if not labels.get("ok", false):
		return labels
	for creature_id_value in labels.get("missing_definition_ids", []):
		var creature_id := str(creature_id_value)
		labels["labels"][creature_id] = "%s · Referenz fehlt" % creature_id
	return labels


func _cancelled_from_worker() -> bool:
	_mutex.lock()
	var cancelled := _cancel_active
	_mutex.unlock()
	return cancelled


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
	_mutex.lock()
	_active_request.clear()
	_pending_request.clear()
	_cancel_active = false
	_mutex.unlock()
