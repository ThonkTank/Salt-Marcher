class_name AdventuringDayCalculationController
extends Node

## One-active/one-latest-pending worker lane for pure Party calculations.

const PartyAdventuringDay = preload("res://godot/src/features/party/party_adventuring_day.gd")

signal calculation_started(request: Dictionary)
signal result_published(result: Dictionary)

var _thread: Thread
var _mutex := Mutex.new()
var _active_request: Dictionary = {}
var _pending_request: Dictionary = {}
var _cancel_active := false
var _latest_epoch := 0


func calculate(levels: Array, total_group_xp: int) -> Dictionary:
	var validation := PartyAdventuringDay.new().validate_request(levels, total_group_xp)
	if not validation.get("ok", false):
		return validation
	return _admit(validation["rows"], validation["total_group_xp"])


func calculate_rows(rows: Array, total_group_xp: int) -> Dictionary:
	var validation := PartyAdventuringDay.new().validate_rows(rows, total_group_xp)
	if not validation.get("ok", false):
		return validation
	return _admit(validation["rows"], validation["total_group_xp"])


func _admit(rows: Array, total_group_xp: int) -> Dictionary:
	_mutex.lock()
	_latest_epoch += 1
	var request := {
		"epoch": _latest_epoch,
		"rows": rows.duplicate(true),
		"total_group_xp": total_group_xp,
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
	var snapshot := {
		"active_count": 0 if _active_request.is_empty() else 1,
		"pending_count": 0 if _pending_request.is_empty() else 1,
		"worker_handle_count": 1 if _thread != null else 0,
		"latest_epoch": _latest_epoch,
	}
	_mutex.unlock()
	return snapshot


func _start(request: Dictionary) -> Dictionary:
	_thread = Thread.new()
	var error := _thread.start(_calculate_on_worker.bind(request.duplicate(true)))
	if error != OK:
		_thread = null
		_mutex.lock()
		_active_request.clear()
		_mutex.unlock()
		return {"ok": false, "status": "worker_error", "error": "Rastbudget konnte nicht berechnet werden."}
	calculation_started.emit(request.duplicate(true))
	return {"ok": true, "status": "started", "epoch": request["epoch"]}


func _calculate_on_worker(request: Dictionary) -> void:
	var result := PartyAdventuringDay.new().calculate_rows(
		request["rows"],
		request["total_group_xp"],
		Callable(self, "_cancelled_from_worker")
	)
	result["epoch"] = request["epoch"]
	result["request"] = request.duplicate(true)
	call_deferred("_finish_on_main", result)


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
