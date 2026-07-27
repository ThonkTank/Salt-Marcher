class_name CampaignRuntimeTransitionController
extends Node

## Runs Campaign create/switch plus accepted-write drain away from the UI thread.

signal transition_started(kind: String)
signal transition_completed(kind: String, result: Dictionary)
signal transition_recovered(result: Dictionary)

var _coordinator
var _drain_timeout_msec: int
var _thread: Thread
var _active_kind := ""
var _recovery_pending := false
var _mutex := Mutex.new()


func _init(coordinator, drain_timeout_msec: int = 10_000) -> void:
	_coordinator = coordinator
	_drain_timeout_msec = drain_timeout_msec


func switch_to(campaign_id: String, expected_registry_generation: int) -> Dictionary:
	return _start("switch", {
		"campaign_id": campaign_id,
		"expected_registry_generation": expected_registry_generation,
	})


func create_and_switch(name: String, expected_registry_generation: int) -> Dictionary:
	return _start("create", {
		"name": name,
		"expected_registry_generation": expected_registry_generation,
	})


func is_active() -> bool:
	_mutex.lock()
	var active := not _active_kind.is_empty() or _recovery_pending
	_mutex.unlock()
	return active


func active_kind() -> String:
	_mutex.lock()
	var kind := _active_kind
	_mutex.unlock()
	return kind


func _start(kind: String, request: Dictionary) -> Dictionary:
	if _coordinator == null:
		return {"ok": false, "status": "coordinator_required", "error": "Campaign-Runtime ist nicht verfügbar."}
	_mutex.lock()
	if not _active_kind.is_empty():
		var active := _active_kind
		_mutex.unlock()
		return {
			"ok": false,
			"status": "transition_busy",
			"error": "Campaign-Übergang %s läuft bereits." % active,
		}
	if _recovery_pending:
		_mutex.unlock()
		return {
			"ok": false,
			"status": "transition_recovery_pending",
			"error": "Die Quell-Campaign wird nach einem Drain-Timeout noch sicher fortgesetzt.",
		}
	_active_kind = kind
	_mutex.unlock()
	_thread = Thread.new()
	var start_error := _thread.start(_run.bind(kind, request.duplicate(true)))
	if start_error != OK:
		_mutex.lock()
		_active_kind = ""
		_mutex.unlock()
		_thread = null
		return {
			"ok": false,
			"status": "transition_worker_error",
			"error": "Campaign-Übergang konnte nicht gestartet werden.",
		}
	transition_started.emit(kind)
	return {"ok": true, "status": "accepted", "kind": kind}


func _run(kind: String, request: Dictionary) -> Dictionary:
	match kind:
		"switch":
			return _coordinator.switch_to(
				str(request["campaign_id"]),
				int(request["expected_registry_generation"]),
				_drain_timeout_msec
			)
		"create":
			return _coordinator.create_and_switch(
				str(request["name"]),
				int(request["expected_registry_generation"]),
				_drain_timeout_msec
			)
	return {"ok": false, "status": "unknown_transition", "error": "Unbekannter Campaign-Übergang."}


func _process(_delta: float) -> void:
	if _thread == null:
		_recover_timed_out_transition()
		return
	if _thread.is_alive():
		return
	var result: Dictionary = _thread.wait_to_finish()
	_thread = null
	_coordinator.flush_backup_notifications()
	_mutex.lock()
	var kind := _active_kind
	_active_kind = ""
	_recovery_pending = result.get("status", "") == "drain_timeout"
	_mutex.unlock()
	transition_completed.emit(kind, result)


func _recover_timed_out_transition() -> void:
	_mutex.lock()
	var pending := _recovery_pending
	_mutex.unlock()
	if not pending:
		return
	var resumed: Dictionary = _coordinator.resume_current_after_cancelled_transition()
	if resumed.get("status", "") == "drain_pending":
		return
	_coordinator.flush_backup_notifications()
	_mutex.lock()
	_recovery_pending = false
	_mutex.unlock()
	transition_recovered.emit(resumed)


func _exit_tree() -> void:
	if _thread != null:
		_thread.wait_to_finish()
		_thread = null
		_coordinator.flush_backup_notifications()
		_mutex.lock()
		_active_kind = ""
		_mutex.unlock()
