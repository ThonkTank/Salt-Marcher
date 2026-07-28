class_name CampaignPortabilityController
extends Node

## Runs one observable Campaign transfer away from the Godot main thread.

const CampaignBundle = preload("res://godot/src/platform/portability/campaign_bundle.gd")

signal operation_started(kind: String)
signal progress_changed(progress: Dictionary)
signal operation_completed(kind: String, result: Dictionary)

var _data_root: String
var _registry
var _capacity_guard
var _bundle_factory: Callable
var _thread: Thread
var _mutex := Mutex.new()
var _cancel_requested := false
var _active_kind := ""


func _init(
	data_root: String,
	registry,
	capacity_guard = null,
	bundle_factory: Callable = Callable()
) -> void:
	_data_root = data_root.trim_suffix("/")
	_registry = registry
	_capacity_guard = capacity_guard
	_bundle_factory = bundle_factory


func export_campaign(campaign_id: String, destination_path: String) -> Dictionary:
	return _start("export", {
		"campaign_id": campaign_id,
		"destination_path": destination_path,
	})


func import_campaign(bundle_path: String, expected_registry_generation: int) -> Dictionary:
	return _start("import", {
		"bundle_path": bundle_path,
		"expected_registry_generation": expected_registry_generation,
	})


func resolve_import(
	import_id: String,
	expected_registry_generation: int,
	decisions: Dictionary
) -> Dictionary:
	return _start("resolve_import", {
		"import_id": import_id,
		"expected_registry_generation": expected_registry_generation,
		"decisions": decisions.duplicate(true),
	})


func discard_import(import_id: String) -> Dictionary:
	return _start("discard_import", {"import_id": import_id})


func cancel_active() -> Dictionary:
	_mutex.lock()
	var active := not _active_kind.is_empty()
	if active:
		_cancel_requested = true
	_mutex.unlock()
	if not active:
		return {"ok": false, "status": "idle", "error": "Kein Transfer ist aktiv."}
	return {"ok": true, "status": "cancellation_requested"}


func is_active() -> bool:
	_mutex.lock()
	var active := not _active_kind.is_empty()
	_mutex.unlock()
	return active


func active_kind() -> String:
	_mutex.lock()
	var kind := _active_kind
	_mutex.unlock()
	return kind


func resource_snapshot() -> Dictionary:
	_mutex.lock()
	var snapshot := {
		"active": not _active_kind.is_empty(),
		"active_kind": _active_kind,
		"cancellation_requested": _cancel_requested,
		"worker_handle_count": 1 if _thread != null else 0,
		"pending_operation_count": 0,
	}
	_mutex.unlock()
	return snapshot


func _start(kind: String, arguments: Dictionary) -> Dictionary:
	_mutex.lock()
	if not _active_kind.is_empty():
		var active := _active_kind
		_mutex.unlock()
		return {
			"ok": false,
			"status": "busy",
			"error": "Transfer %s läuft bereits; zuerst abschließen oder abbrechen." % active,
		}
	_active_kind = kind
	_cancel_requested = false
	_mutex.unlock()
	_thread = Thread.new()
	var start_error := _thread.start(_run_operation.bind(kind, arguments.duplicate(true)))
	if start_error != OK:
		_mutex.lock()
		_active_kind = ""
		_mutex.unlock()
		_thread = null
		return {"ok": false, "status": "worker_error", "error": "Transfer-Worker konnte nicht gestartet werden."}
	operation_started.emit(kind)
	return {"ok": true, "status": "started", "kind": kind}


func _run_operation(kind: String, arguments: Dictionary) -> void:
	var bundle = (
		_bundle_factory.call(_data_root, _registry, _capacity_guard)
		if _bundle_factory.is_valid()
		else CampaignBundle.new(_data_root, _registry, _capacity_guard)
	)
	if bundle == null:
		call_deferred("_finish_on_main", kind, {
			"ok": false,
			"status": "worker_error",
			"error": "Transfer-Worker besitzt keinen ausführbaren Portabilitätspfad.",
		})
		return
	var progress := Callable(self, "_progress_from_worker")
	var cancellation := Callable(self, "_cancelled_from_worker")
	var result: Dictionary
	match kind:
		"export":
			result = bundle.export_campaign(
				str(arguments["campaign_id"]),
				str(arguments["destination_path"]),
				progress,
				cancellation
			)
		"import":
			result = bundle.import_campaign(
				str(arguments["bundle_path"]),
				int(arguments["expected_registry_generation"]),
				progress,
				cancellation
			)
		"resolve_import":
			result = bundle.resolve_import(
				str(arguments["import_id"]),
				int(arguments["expected_registry_generation"]),
				arguments["decisions"],
				progress,
				cancellation
			)
		"discard_import":
			result = bundle.discard_import(str(arguments["import_id"]))
		_:
			result = {"ok": false, "status": "worker_error", "error": "Unbekannter Transferauftrag."}
	call_deferred("_finish_on_main", kind, result)


func _progress_from_worker(progress: Dictionary) -> void:
	call_deferred("_publish_progress", progress.duplicate(true))


func _cancelled_from_worker() -> bool:
	_mutex.lock()
	var cancelled := _cancel_requested
	_mutex.unlock()
	return cancelled


func _publish_progress(progress: Dictionary) -> void:
	if is_active():
		progress_changed.emit(progress)


func _finish_on_main(kind: String, result: Dictionary) -> void:
	if _thread != null:
		_thread.wait_to_finish()
		_thread = null
	_mutex.lock()
	_active_kind = ""
	_cancel_requested = false
	_mutex.unlock()
	operation_completed.emit(kind, result)


func _exit_tree() -> void:
	if not is_active():
		return
	cancel_active()
	if _thread != null:
		_thread.wait_to_finish()
		_thread = null
	_mutex.lock()
	_active_kind = ""
	_cancel_requested = false
	_mutex.unlock()
