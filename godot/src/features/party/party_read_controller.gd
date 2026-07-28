class_name PartyReadController
extends Node

## Bounded latest-wins read lane for the active Campaign's Party owner partition.

const FileCampaignRegistry = preload("res://godot/src/platform/persistence/file_campaign_registry.gd")
const FileCampaignStore = preload("res://godot/src/platform/persistence/file_campaign_store.gd")
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


func query(search_text: String = "", include_deleted: bool = false) -> Dictionary:
	_mutex.lock()
	_latest_epoch += 1
	var request := {
		"epoch": _latest_epoch,
		"search_text": search_text,
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
	var result := {
		"active_count": 0 if _active_request.is_empty() else 1,
		"pending_count": 0 if _pending_request.is_empty() else 1,
		"worker_handle_count": 1 if _thread != null else 0,
		"latest_epoch": _latest_epoch,
	}
	_mutex.unlock()
	return result


func _start_active_request(request: Dictionary) -> Dictionary:
	_thread = Thread.new()
	var start_error := _thread.start(_run_query.bind(request.duplicate(true)))
	if start_error != OK:
		_thread = null
		_mutex.lock()
		_active_request.clear()
		_mutex.unlock()
		return {"ok": false, "status": "worker_error", "error": "Party-Abfrage konnte nicht gestartet werden."}
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
			var read := store.read_partition(PartyRoster.OWNER, campaign_state)
			if not read.get("ok", false):
				result = read
			else:
				var model := PartyRoster.new()
				result = model.snapshot(
					read.get("payload", model.empty_payload()),
					str(request["search_text"]),
					bool(request["include_deleted"]),
					PartyRoster.MAX_SEARCH_PAGE_SIZE,
					Callable(self, "_cancelled_from_worker")
				)
				if result.get("ok", false):
					var confirmed: Dictionary = registry.load_state()
					if (
						not confirmed.get("ok", false)
						or confirmed.get("active_campaign_id", "") != campaign_id
						or int(confirmed.get("generation", -1)) != int(registry_state.get("generation", -2))
					):
						result = {"ok": false, "status": "stale", "error": "Die aktive Campaign änderte sich während der Party-Abfrage."}
					else:
						result["campaign_id"] = campaign_id
						result["campaign_generation"] = campaign_state["generation"]
	result["epoch"] = request["epoch"]
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
