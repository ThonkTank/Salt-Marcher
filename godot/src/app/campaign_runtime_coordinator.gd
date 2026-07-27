class_name CampaignRuntimeCoordinator
extends RefCounted

## Prepares Campaign state before pointer commit and owns the sole admitted session.

const FileCampaignStore = preload("res://godot/src/platform/persistence/file_campaign_store.gd")
const CampaignRuntimeSession = preload("res://godot/src/app/campaign_runtime_session.gd")

var _data_root: String
var _registry
var _current: CampaignRuntimeSession
var _backup_notifier: Callable
var _store_factory: Callable
var _notification_mutex := Mutex.new()
var _pending_backup_notifications: Array = []


func _init(data_root: String, registry, store_factory: Callable = Callable()) -> void:
	_data_root = data_root.trim_suffix("/")
	_registry = registry
	_store_factory = store_factory


func open_durable_active() -> Dictionary:
	var registry_state: Dictionary = _registry.load_state()
	if not registry_state.get("ok", false):
		return _recovery("Campaign-Registry ist nicht sicher lesbar.", registry_state)
	var campaign_id := str(registry_state.get("active_campaign_id", ""))
	if campaign_id.is_empty():
		_current = null
		return {"ok": true, "status": "campaign_required", "registry_state": registry_state}
	var prepared := _prepare(campaign_id)
	if not prepared.get("ok", false):
		return _recovery("Die dauerhaft aktive Campaign kann nicht sicher geöffnet werden.", prepared)
	_current = CampaignRuntimeSession.new(
		campaign_id,
		int(registry_state["generation"]),
		prepared["store"],
		prepared["state"],
		Callable(self, "_notify_confirmed_generation_values")
	)
	return {
		"ok": true,
		"status": "opened",
		"session": _current,
		"registry_state": registry_state,
	}


func switch_to(
	campaign_id: String,
	expected_registry_generation: int,
	drain_timeout_msec: int = 10_000
) -> Dictionary:
	var registry_state: Dictionary = _registry.load_state()
	if not registry_state.get("ok", false):
		return _recovery("Campaign-Registry ist nicht sicher lesbar.", registry_state)
	if int(registry_state["generation"]) != expected_registry_generation:
		return {
			"ok": false,
			"status": "stale",
			"error": "Die Campaign-Liste wurde inzwischen geändert.",
			"registry_state": registry_state,
		}
	if registry_state.get("active_campaign_id", "") == campaign_id and _current != null and _current.campaign_id() == campaign_id:
		return {"ok": true, "status": "unchanged", "session": _current, "registry_state": registry_state}

	var prepared := _prepare(campaign_id)
	if not prepared.get("ok", false):
		return {
			"ok": false,
			"status": "target_unready",
			"error": "Die Ziel-Campaign kann nicht sicher geöffnet werden.",
			"cause": prepared,
		}
	var prior := _current
	if prior != null:
		var revoked := prior.drain_and_revoke(drain_timeout_msec)
		_flush_backup_notifications_if_main_thread()
		if not revoked.get("ok", false):
			if revoked.get("status", "") == "accepted_write_failed":
				prior.resume_after_precommit_failure()
			revoked["session"] = prior
			revoked["registry_state"] = registry_state
			return revoked

	var pointer_commit: Dictionary = _registry.activate_campaign(campaign_id, expected_registry_generation)
	if not pointer_commit.get("ok", false):
		if prior != null:
			prior.resume_after_precommit_failure()
		return pointer_commit
	var committed_registry: Dictionary = pointer_commit["state"]
	_current = CampaignRuntimeSession.new(
		campaign_id,
		int(committed_registry["generation"]),
		prepared["store"],
		prepared["state"],
		Callable(self, "_notify_confirmed_generation_values")
	)
	return {
		"ok": true,
		"status": "switched",
		"session": _current,
		"registry_state": committed_registry,
		"prior_session": prior,
	}


func create_and_switch(
	name: String,
	expected_registry_generation: int,
	drain_timeout_msec: int = 10_000
) -> Dictionary:
	var registry_state: Dictionary = _registry.load_state()
	if not registry_state.get("ok", false):
		return _recovery("Campaign-Registry ist nicht sicher lesbar.", registry_state)
	if int(registry_state["generation"]) != expected_registry_generation:
		return {
			"ok": false,
			"status": "stale",
			"error": "Die Campaign-Liste wurde inzwischen geändert.",
			"registry_state": registry_state,
		}
	var prior := _current
	if prior != null:
		var revoked := prior.drain_and_revoke(drain_timeout_msec)
		_flush_backup_notifications_if_main_thread()
		if not revoked.get("ok", false):
			if revoked.get("status", "") == "accepted_write_failed":
				prior.resume_after_precommit_failure()
			revoked["session"] = prior
			revoked["registry_state"] = registry_state
			return revoked
	var created: Dictionary = _registry.create_campaign(name, expected_registry_generation)
	if not created.get("ok", false):
		if prior != null:
			prior.resume_after_precommit_failure()
		return created
	var campaign_id := str(created["campaign_id"])
	var prepared := _prepare(campaign_id)
	if not prepared.get("ok", false):
		return _recovery("Die neu registrierte Campaign kann nicht sicher geöffnet werden.", prepared)
	var committed_registry: Dictionary = created["state"]
	_current = CampaignRuntimeSession.new(
		campaign_id,
		int(committed_registry["generation"]),
		prepared["store"],
		prepared["state"],
		Callable(self, "_notify_confirmed_generation_values")
	)
	_notify_confirmed_generation(_current)
	return {
		"ok": true,
		"status": "created",
		"campaign_id": campaign_id,
		"session": _current,
		"registry_state": committed_registry,
		"prior_session": prior,
	}


func commit_current(
	expected_activation_generation: int,
	expected_campaign_generation: int,
	partition_changes: Dictionary,
	runtime_state: Dictionary,
	removed_partitions: Array[String] = []
) -> Dictionary:
	if _current == null:
		return {"ok": false, "status": "campaign_required", "error": "Keine Campaign ist aktiv."}
	var committed := _current.commit(
		expected_activation_generation,
		expected_campaign_generation,
		partition_changes,
		runtime_state,
		removed_partitions
	)
	if committed.get("ok", false):
		_notify_confirmed_generation(_current)
	return committed


func submit_current_commit(
	expected_activation_generation: int,
	expected_campaign_generation: int,
	partition_changes: Dictionary,
	runtime_state: Dictionary,
	removed_partitions: Array[String] = []
) -> Dictionary:
	if _current == null:
		return {"ok": false, "status": "campaign_required", "error": "Keine Campaign ist aktiv."}
	return _current.submit_commit(
		expected_activation_generation,
		expected_campaign_generation,
		partition_changes,
		runtime_state,
		removed_partitions
	)


func poll_current_commit(ticket_id: String) -> Dictionary:
	if _current == null:
		return {"ok": false, "status": "campaign_required", "error": "Keine Campaign ist aktiv."}
	var polled := _current.poll_commit(ticket_id)
	_flush_backup_notifications_if_main_thread()
	return polled


func set_backup_notifier(notifier: Callable) -> void:
	_backup_notifier = notifier
	_flush_backup_notifications_if_main_thread()


func flush_backup_notifications() -> void:
	_notification_mutex.lock()
	if not _backup_notifier.is_valid():
		_notification_mutex.unlock()
		return
	var pending: Array = _pending_backup_notifications.duplicate(true)
	_pending_backup_notifications.clear()
	_notification_mutex.unlock()
	for notification in pending:
		_backup_notifier.call(notification["campaign_id"], notification["campaign_generation"])


func revoke_current(drain_timeout_msec: int = 10_000) -> Dictionary:
	if _current == null:
		return {"ok": true, "status": "no_session"}
	var revoked := _current.drain_and_revoke(drain_timeout_msec)
	_flush_backup_notifications_if_main_thread()
	return revoked


func resume_current_after_cancelled_transition() -> Dictionary:
	if _current == null:
		return {"ok": true, "status": "no_session"}
	var resumed := _current.resume_after_precommit_failure()
	_flush_backup_notifications_if_main_thread()
	return resumed


func current_session() -> CampaignRuntimeSession:
	return _current


func _prepare(campaign_id: String) -> Dictionary:
	var store = (
		_store_factory.call(_data_root, campaign_id)
		if _store_factory.is_valid()
		else FileCampaignStore.new(_data_root, campaign_id)
	)
	if store == null:
		return {"ok": false, "status": "store_unavailable", "error": "Campaign-Speicher konnte nicht vorbereitet werden."}
	var state: Dictionary = store.load_state()
	if not state.get("ok", false):
		return state
	return {"ok": true, "store": store, "state": state}


func _recovery(message: String, cause: Dictionary) -> Dictionary:
	return {
		"ok": false,
		"status": "recovery_required",
		"error": message,
		"cause": cause,
		"session": _current,
	}


func _notify_confirmed_generation(session: CampaignRuntimeSession) -> void:
	_notify_confirmed_generation_values(session.campaign_id(), session.campaign_generation())


func _notify_confirmed_generation_values(campaign_id: String, campaign_generation: int) -> void:
	if Thread.is_main_thread() and _backup_notifier.is_valid():
		_backup_notifier.call(campaign_id, campaign_generation)
		return
	_notification_mutex.lock()
	_pending_backup_notifications.append({
		"campaign_id": campaign_id,
		"campaign_generation": campaign_generation,
	})
	_notification_mutex.unlock()


func _flush_backup_notifications_if_main_thread() -> void:
	if Thread.is_main_thread():
		flush_backup_notifications()
