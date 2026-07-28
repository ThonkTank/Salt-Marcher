class_name CampaignPartitionCommandController
extends Node

## Prepares one owner-partition mutation off-thread and submits it to the admitted Campaign writer.

const FileCampaignStore = preload("res://godot/src/platform/persistence/file_campaign_store.gd")

signal command_started(request: Dictionary)
signal command_completed(result: Dictionary)

var _data_root: String
var _runtime_coordinator
var _owner: String
var _empty_payload_factory: Callable
var _apply_command: Callable
var _thread: Thread
var _active_request: Dictionary = {}
var _ticket_id := ""
var _ticket_session


func _init(
	data_root: String,
	runtime_coordinator,
	owner: String,
	empty_payload_factory: Callable,
	apply_command: Callable
) -> void:
	_data_root = data_root.trim_suffix("/")
	_runtime_coordinator = runtime_coordinator
	_owner = owner
	_empty_payload_factory = empty_payload_factory
	_apply_command = apply_command
	set_process(false)


func start_command(request: Dictionary) -> Dictionary:
	if busy():
		return {"ok": false, "status": "busy", "error": "Eine Campaign-Änderung läuft bereits."}
	if (
		_owner.is_empty()
		or not _empty_payload_factory.is_valid()
		or not _apply_command.is_valid()
	):
		return {"ok": false, "status": "invalid_composition", "error": "Campaign-Owner ist nicht vollständig komponiert."}
	if _runtime_coordinator == null or _runtime_coordinator.current_session() == null:
		return {"ok": false, "status": "campaign_required", "error": "Wähle zuerst eine Campaign."}
	var session = _runtime_coordinator.current_session()
	var snapshot: Dictionary = session.snapshot()
	if not snapshot.get("admitted", false):
		return {"ok": false, "status": "revoked", "error": "Die aktive Campaign wird gerade gewechselt."}
	_active_request = request.duplicate(true)
	_active_request["campaign_id"] = snapshot["campaign_id"]
	_active_request["activation_generation"] = snapshot["activation_generation"]
	_active_request["campaign_generation"] = snapshot["campaign_state"]["generation"]
	_active_request["campaign_state"] = snapshot["campaign_state"].duplicate(true)
	_thread = Thread.new()
	var start_error := _thread.start(_prepare_on_worker.bind(_active_request.duplicate(true)))
	if start_error != OK:
		_thread = null
		_active_request.clear()
		return {"ok": false, "status": "worker_error", "error": "Campaign-Änderung konnte nicht vorbereitet werden."}
	command_started.emit(request.duplicate(true))
	return {"ok": true, "status": "started"}


func busy() -> bool:
	return not _active_request.is_empty()


func resource_snapshot() -> Dictionary:
	return {
		"busy": busy(),
		"worker_handle_count": 1 if _thread != null else 0,
		"ticket_count": 0 if _ticket_id.is_empty() else 1,
	}


func _prepare_on_worker(request: Dictionary) -> void:
	var store := FileCampaignStore.new(_data_root, str(request["campaign_id"]))
	var read := store.read_partition(_owner, request["campaign_state"])
	var result: Dictionary
	if not read.get("ok", false):
		result = read
	else:
		var payload: Dictionary = read.get("payload", _empty_payload_factory.call())
		var worker_request := request.duplicate(true)
		var supporting_payloads := {}
		var supporting_factories := _supporting_payload_factories_for(request)
		for owner_value in supporting_factories:
			var owner := str(owner_value)
			var factory: Callable = supporting_factories[owner_value]
			var supporting_read := store.read_partition(owner, request["campaign_state"])
			if not supporting_read.get("ok", false):
				result = supporting_read
				break
			supporting_payloads[owner] = supporting_read.get("payload", factory.call())
		if result.is_empty():
			worker_request["supporting_payloads"] = supporting_payloads
			result = _apply_command.call(payload, worker_request)
	result["request"] = request.duplicate(true)
	call_deferred("_submit_prepared_on_main", result)


func _supporting_payload_factories_for(_request: Dictionary) -> Dictionary:
	return {}


func _submit_prepared_on_main(prepared: Dictionary) -> void:
	_join_worker()
	if not prepared.get("ok", false):
		_finish(prepared)
		return
	if prepared.get("no_write", false):
		_finish(prepared)
		return
	var request: Dictionary = prepared["request"]
	var state: Dictionary = request["campaign_state"]
	var partition_updates: Dictionary = prepared.get("partition_updates", {_owner: prepared["payload"]})
	var submitted: Dictionary = _runtime_coordinator.submit_current_commit(
		int(request["activation_generation"]),
		int(request["campaign_generation"]),
		partition_updates,
		state["runtime"]
	)
	if not submitted.get("ok", false):
		submitted["request"] = request
		_finish(submitted)
		return
	_ticket_id = str(submitted["ticket_id"])
	_ticket_session = _runtime_coordinator.current_session()
	_active_request["prepared_result"] = prepared.duplicate(true)
	set_process(true)


func _process(_delta: float) -> void:
	if _ticket_id.is_empty():
		set_process(false)
		return
	var polled: Dictionary = _ticket_session.poll_commit(_ticket_id)
	if polled.get("status", "") == "pending":
		return
	if polled.get("status", "") == "unknown_ticket":
		var detached_snapshot: Dictionary = _ticket_session.snapshot()
		var detached_state: Dictionary = detached_snapshot["campaign_state"]
		if int(detached_state.get("parent_generation", -1)) == int(_active_request["campaign_generation"]):
			polled = {"ok": true, "status": "completed", "result": {"ok": true, "state": detached_state}}
	_runtime_coordinator.flush_backup_notifications()
	set_process(false)
	var prepared: Dictionary = _active_request.get("prepared_result", {}).duplicate(true)
	var result: Dictionary = polled.get("result", polled).duplicate(true)
	result["request"] = _active_request.duplicate(true)
	if result.get("ok", false):
		result["status"] = str(prepared.get("status", "completed"))
		for field in prepared:
			if field not in ["ok", "status", "payload", "partition_updates", "request"]:
				result[field] = prepared[field]
	_finish(result)


func _finish(result: Dictionary) -> void:
	_ticket_id = ""
	_ticket_session = null
	_active_request.clear()
	command_completed.emit(result.duplicate(true))


func _join_worker() -> void:
	if _thread != null:
		_thread.wait_to_finish()
		_thread = null


func _exit_tree() -> void:
	_join_worker()
