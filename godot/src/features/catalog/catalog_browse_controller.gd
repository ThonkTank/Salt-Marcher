class_name CatalogBrowseController
extends Node

## Runs one Shared-Definition catalog read with one latest-wins pending request.

const SharedDefinitionStore = preload("res://godot/src/platform/persistence/shared_definition_store.gd")
const FileCampaignRegistry = preload("res://godot/src/platform/persistence/file_campaign_registry.gd")

signal query_started(request: Dictionary)
signal result_published(result: Dictionary)

var _data_root: String
var _thread: Thread
var _mutex := Mutex.new()
var _active_request: Dictionary = {}
var _pending_request: Dictionary = {}
var _cancel_active := false
var _latest_epoch := 0


func _init(data_root: String, registry) -> void:
	_data_root = data_root.trim_suffix("/")
	if registry == null:
		push_warning("CatalogBrowseController wurde ohne Registry-Komposition erstellt.")


func query(
	section_id: String,
	kind: String,
	search_text: String,
	offset: int = 0,
	limit: int = 50
) -> Dictionary:
	_mutex.lock()
	_latest_epoch += 1
	var request := {
		"epoch": _latest_epoch,
		"section_id": section_id,
		"kind": kind,
		"search_text": search_text,
		"offset": offset,
		"limit": limit,
	}
	if not _active_request.is_empty():
		_pending_request = request
		_cancel_active = true
		_mutex.unlock()
		return {"ok": true, "status": "queued", "epoch": request["epoch"]}
	_active_request = request
	_cancel_active = false
	_mutex.unlock()
	return _start_active_request(request)


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


func _start_active_request(request: Dictionary) -> Dictionary:
	_thread = Thread.new()
	var start_error := _thread.start(_run_query.bind(request.duplicate(true)))
	if start_error != OK:
		_thread = null
		_mutex.lock()
		_active_request.clear()
		_mutex.unlock()
		return {
			"ok": false,
			"status": "worker_error",
			"error": "Katalogabfrage konnte nicht gestartet werden.",
		}
	query_started.emit(request.duplicate(true))
	return {"ok": true, "status": "started", "epoch": request["epoch"]}


func _run_query(request: Dictionary) -> void:
	var registry_state: Dictionary = FileCampaignRegistry.new(_data_root).load_state()
	var result: Dictionary
	if not registry_state.get("ok", false):
		result = registry_state
	else:
		result = SharedDefinitionStore.new(_data_root).query_catalog(
			int(registry_state.get("shared_definitions_generation", 0)),
			str(request["kind"]),
			str(request["search_text"]),
			int(request["offset"]),
			int(request["limit"]),
			Callable(self, "_cancelled_from_worker")
		)
	result["epoch"] = request["epoch"]
	result["section_id"] = request["section_id"]
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
		_start_active_request(next_request)


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
