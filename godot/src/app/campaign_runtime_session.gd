class_name CampaignRuntimeSession
extends RefCounted

## One admitted Campaign writer bound to one durable activation generation.

const MAX_UNCOLLECTED_WRITE_RESULTS := 1024

var _campaign_id: String
var _activation_generation: int
var _store
var _completion_notifier: Callable
var _state: Dictionary
var _admitted := true
var _mutex := Mutex.new()
var _worker_join_mutex := Mutex.new()
var _worker := Thread.new()
var _write_in_flight := false
var _active_ticket_id := ""
var _next_ticket_number := 1
var _completed_results: Dictionary = {}


func _init(
	campaign_id: String,
	activation_generation: int,
	store,
	initial_state: Dictionary,
	completion_notifier: Callable = Callable()
) -> void:
	_campaign_id = campaign_id
	_activation_generation = activation_generation
	_store = store
	_state = initial_state.duplicate(true)
	_completion_notifier = completion_notifier


func commit(
	expected_activation_generation: int,
	expected_campaign_generation: int,
	partition_changes: Dictionary,
	runtime_state: Dictionary,
	removed_partitions: Array[String] = []
) -> Dictionary:
	_collect_finished_worker()
	_mutex.lock()
	if not _admitted:
		var revoked := {
			"ok": false,
			"status": "revoked",
			"error": "Diese Campaign-Laufzeit besitzt keine Schreibautorität mehr.",
		}
		_mutex.unlock()
		return revoked
	if _write_in_flight:
		_mutex.unlock()
		return {
			"ok": false,
			"status": "write_in_flight",
			"error": "Eine akzeptierte Campaign-Schreibarbeit ist noch nicht abgeschlossen.",
		}
	if expected_activation_generation != _activation_generation:
		var stale_activation := {
			"ok": false,
			"status": "stale_activation",
			"error": "Die Campaign-Aktivierung wurde inzwischen ersetzt.",
		}
		_mutex.unlock()
		return stale_activation
	if expected_campaign_generation != int(_state["generation"]):
		var stale := {
			"ok": false,
			"status": "stale",
			"error": "Die Campaign wurde inzwischen geändert.",
			"state": _snapshot_locked(),
		}
		_mutex.unlock()
		return stale
	_write_in_flight = true
	_mutex.unlock()
	var committed: Dictionary = _store.commit(
		expected_campaign_generation,
		partition_changes,
		runtime_state,
		removed_partitions
	)
	_mutex.lock()
	if committed.get("ok", false):
		_state = committed["state"].duplicate(true)
	_write_in_flight = false
	_mutex.unlock()
	return committed


func submit_commit(
	expected_activation_generation: int,
	expected_campaign_generation: int,
	partition_changes: Dictionary,
	runtime_state: Dictionary,
	removed_partitions: Array[String] = []
) -> Dictionary:
	_collect_finished_worker()
	_mutex.lock()
	if not _admitted:
		_mutex.unlock()
		return {"ok": false, "status": "revoked", "error": "Diese Campaign-Laufzeit besitzt keine Schreibautorität mehr."}
	if _write_in_flight:
		_mutex.unlock()
		return {"ok": false, "status": "write_in_flight", "error": "Es ist bereits eine Campaign-Schreibarbeit akzeptiert."}
	if _completed_results.size() >= MAX_UNCOLLECTED_WRITE_RESULTS:
		_mutex.unlock()
		return {
			"ok": false,
			"status": "write_results_pending",
			"error": "Abgeschlossene Campaign-Schreibergebnisse müssen vor weiterer Arbeit abgeholt werden.",
		}
	if expected_activation_generation != _activation_generation:
		_mutex.unlock()
		return {"ok": false, "status": "stale_activation", "error": "Die Campaign-Aktivierung wurde inzwischen ersetzt."}
	if expected_campaign_generation != int(_state["generation"]):
		var stale_state := _snapshot_locked()
		_mutex.unlock()
		return {"ok": false, "status": "stale", "error": "Die Campaign wurde inzwischen geändert.", "state": stale_state}
	var ticket_id := "write-%020d" % _next_ticket_number
	_next_ticket_number += 1
	_active_ticket_id = ticket_id
	_write_in_flight = true
	_mutex.unlock()
	var start_error := _worker.start(_run_async_commit.bind(
		ticket_id,
		expected_campaign_generation,
		partition_changes.duplicate(true),
		runtime_state.duplicate(true),
		removed_partitions.duplicate()
	))
	if start_error != OK:
		_mutex.lock()
		_write_in_flight = false
		_active_ticket_id = ""
		_mutex.unlock()
		return {
			"ok": false,
			"status": "write_worker_error",
			"error": "Akzeptierte Campaign-Schreibarbeit konnte nicht gestartet werden.",
		}
	return {
		"ok": true,
		"status": "accepted",
		"ticket_id": ticket_id,
		"campaign_id": _campaign_id,
		"expected_campaign_generation": expected_campaign_generation,
	}


func poll_commit(ticket_id: String) -> Dictionary:
	_collect_finished_worker()
	_mutex.lock()
	if _completed_results.has(ticket_id):
		var completed: Dictionary = _completed_results[ticket_id]
		_completed_results.erase(ticket_id)
		_mutex.unlock()
		return completed.duplicate(true)
	if _active_ticket_id == ticket_id and _write_in_flight:
		_mutex.unlock()
		return {"ok": true, "status": "pending", "ticket_id": ticket_id}
	_mutex.unlock()
	return {"ok": false, "status": "unknown_ticket", "error": "Campaign-Schreibticket ist nicht bekannt."}


func drain_and_revoke(timeout_msec: int = 10_000) -> Dictionary:
	if timeout_msec < -1:
		return {"ok": false, "status": "invalid_timeout", "error": "Drain-Timeout muss -1 oder nicht negativ sein."}
	_mutex.lock()
	_admitted = false
	_mutex.unlock()
	var started_usec := Time.get_ticks_usec()
	while true:
		_collect_finished_worker()
		_mutex.lock()
		var busy := _write_in_flight
		var active_ticket := _active_ticket_id
		_mutex.unlock()
		if not busy:
			break
		var elapsed_msec := (Time.get_ticks_usec() - started_usec) / 1000
		if timeout_msec >= 0 and elapsed_msec >= timeout_msec:
			return {
				"ok": false,
				"status": "drain_timeout",
				"error": "Akzeptierte Campaign-Schreibarbeit läuft nach dem sicheren Switch-Timeout noch.",
				"campaign_id": _campaign_id,
				"ticket_id": active_ticket,
				"retry_available": true,
				"cancel_switch_available": true,
			}
		OS.delay_msec(1)
	_mutex.lock()
	var accepted_results: Array = _completed_results.values().duplicate(true)
	_completed_results.clear()
	var campaign_generation := int(_state["generation"])
	_mutex.unlock()
	var failed_results: Array = []
	for completed in accepted_results:
		if not completed.get("result", {}).get("ok", false):
			failed_results.append(completed)
	if not failed_results.is_empty():
		return {
			"ok": false,
			"status": "accepted_write_failed",
			"error": "Eine akzeptierte Campaign-Schreibarbeit ist vor dem Switch fehlgeschlagen.",
			"campaign_id": _campaign_id,
			"campaign_generation": campaign_generation,
			"accepted_write_results": accepted_results,
		}
	return {
		"ok": true,
		"status": "revoked",
		"campaign_id": _campaign_id,
		"campaign_generation": campaign_generation,
		"accepted_write_results": accepted_results,
	}


func resume_after_precommit_failure() -> Dictionary:
	_collect_finished_worker()
	_mutex.lock()
	if _admitted:
		_mutex.unlock()
		return {"ok": true, "status": "already_admitted"}
	if _write_in_flight:
		_mutex.unlock()
		return {
			"ok": false,
			"status": "drain_pending",
			"error": "Campaign kann erst nach Abschluss der akzeptierten Schreibarbeit fortgesetzt werden.",
		}
	_admitted = true
	var completed: Array = _completed_results.values().duplicate(true)
	_completed_results.clear()
	_mutex.unlock()
	return {"ok": true, "status": "resumed", "accepted_write_results": completed}


func snapshot() -> Dictionary:
	_collect_finished_worker()
	_mutex.lock()
	var result := _snapshot_locked()
	_mutex.unlock()
	return result


func _snapshot_locked() -> Dictionary:
	return {
		"campaign_id": _campaign_id,
		"activation_generation": _activation_generation,
		"admitted": _admitted,
		"write_in_flight": _write_in_flight,
		"active_ticket_id": _active_ticket_id,
		"uncollected_write_results": _completed_results.size(),
		"campaign_state": _state.duplicate(true),
	}


func campaign_id() -> String:
	return _campaign_id


func activation_generation() -> int:
	return _activation_generation


func campaign_generation() -> int:
	_mutex.lock()
	var generation := int(_state["generation"])
	_mutex.unlock()
	return generation


func admitted() -> bool:
	_mutex.lock()
	var value := _admitted
	_mutex.unlock()
	return value


func _run_async_commit(
	ticket_id: String,
	expected_campaign_generation: int,
	partition_changes: Dictionary,
	runtime_state: Dictionary,
	removed_partitions: Array[String]
) -> Dictionary:
	var committed: Dictionary = _store.commit(
		expected_campaign_generation,
		partition_changes,
		runtime_state,
		removed_partitions
	)
	if committed.get("ok", false) and _completion_notifier.is_valid():
		_completion_notifier.call(_campaign_id, int(committed.get("state", {}).get("generation", -1)))
	_mutex.lock()
	if committed.get("ok", false):
		_state = committed["state"].duplicate(true)
	var completed := {
		"ok": true,
		"status": "completed",
		"ticket_id": ticket_id,
		"result": committed.duplicate(true),
	}
	_completed_results[ticket_id] = completed
	_active_ticket_id = ""
	_write_in_flight = false
	_mutex.unlock()
	return completed


func _collect_finished_worker() -> void:
	_worker_join_mutex.lock()
	if _worker.is_started() and not _worker.is_alive():
		_worker.wait_to_finish()
	_worker_join_mutex.unlock()
