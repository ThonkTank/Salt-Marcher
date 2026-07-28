class_name WorldPlannerCommandController
extends Node

## Prepares one owner mutation off-thread, then submits it to the serial Campaign writer.

const FileCampaignStore = preload("res://godot/src/platform/persistence/file_campaign_store.gd")
const WorldPlannerKnowledge = preload("res://godot/src/features/worldplanner/world_planner_knowledge.gd")

signal command_started(request: Dictionary)
signal command_completed(result: Dictionary)

var _data_root: String
var _runtime_coordinator
var _thread: Thread
var _active_request: Dictionary = {}
var _ticket_id := ""
var _ticket_session


func _init(data_root: String, runtime_coordinator) -> void:
	_data_root = data_root.trim_suffix("/")
	_runtime_coordinator = runtime_coordinator
	set_process(false)


func create_record(kind: String, name: String, fields: Dictionary = {}) -> Dictionary:
	return _start({"operation": "create", "kind": kind, "name": name, "fields": fields.duplicate(true)})


func update_record(record_id: String, fields: Dictionary) -> Dictionary:
	return _start({"operation": "update", "record_id": record_id, "fields": fields.duplicate(true)})


func trash_record(record_id: String) -> Dictionary:
	return _start({"operation": "trash", "record_id": record_id})


func restore_record(record_id: String) -> Dictionary:
	return _start({"operation": "restore", "record_id": record_id})


func busy() -> bool:
	return not _active_request.is_empty()


func resource_snapshot() -> Dictionary:
	return {
		"busy": busy(),
		"worker_handle_count": 1 if _thread != null else 0,
		"ticket_count": 0 if _ticket_id.is_empty() else 1,
	}


func _start(request: Dictionary) -> Dictionary:
	if busy():
		return {"ok": false, "status": "busy", "error": "Eine World-Planner-Änderung läuft bereits."}
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
		return {"ok": false, "status": "worker_error", "error": "World-Planner-Änderung konnte nicht vorbereitet werden."}
	command_started.emit(request.duplicate(true))
	return {"ok": true, "status": "started"}


func _prepare_on_worker(request: Dictionary) -> void:
	var store := FileCampaignStore.new(_data_root, str(request["campaign_id"]))
	var read := store.read_partition(WorldPlannerKnowledge.OWNER, request["campaign_state"])
	var result: Dictionary
	if not read.get("ok", false):
		result = read
	else:
		var model := WorldPlannerKnowledge.new()
		var payload: Dictionary = read.get("payload", model.empty_payload())
		match request["operation"]:
			"create":
				result = model.create_record(payload, str(request["kind"]), str(request["name"]), request["fields"])
			"update":
				result = model.update_record(payload, str(request["record_id"]), request["fields"])
			"trash":
				result = model.trash_record(payload, str(request["record_id"]))
			"restore":
				result = model.restore_record(payload, str(request["record_id"]))
			_:
				result = {"ok": false, "status": "invalid", "error": "Unbekannte World-Planner-Änderung."}
	result["request"] = request.duplicate(true)
	call_deferred("_submit_prepared_on_main", result)


func _submit_prepared_on_main(prepared: Dictionary) -> void:
	_join_worker()
	if not prepared.get("ok", false):
		_finish(prepared)
		return
	var request: Dictionary = prepared["request"]
	var state: Dictionary = request["campaign_state"]
	var submitted: Dictionary = _runtime_coordinator.submit_current_commit(
		int(request["activation_generation"]),
		int(request["campaign_generation"]),
		{WorldPlannerKnowledge.OWNER: prepared["payload"]},
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
		result["record"] = prepared.get("record", {}).duplicate(true)
		for field in ["removed_link_count", "restored_link_count"]:
			if prepared.has(field):
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
