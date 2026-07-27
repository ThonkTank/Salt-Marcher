class_name CampaignRuntimeCoordinator
extends RefCounted

## Prepares Campaign state before pointer commit and owns the sole admitted session.

const FileCampaignStore = preload("res://godot/src/platform/persistence/file_campaign_store.gd")
const CampaignRuntimeSession = preload("res://godot/src/app/campaign_runtime_session.gd")

var _data_root: String
var _registry
var _current: CampaignRuntimeSession


func _init(data_root: String, registry) -> void:
	_data_root = data_root.trim_suffix("/")
	_registry = registry


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
		prepared["state"]
	)
	return {
		"ok": true,
		"status": "opened",
		"session": _current,
		"registry_state": registry_state,
	}


func switch_to(campaign_id: String, expected_registry_generation: int) -> Dictionary:
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
		var revoked := prior.drain_and_revoke()
		if not revoked.get("ok", false):
			return _recovery("Die aktuelle Campaign konnte nicht sicher angehalten werden.", revoked)

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
		prepared["state"]
	)
	return {
		"ok": true,
		"status": "switched",
		"session": _current,
		"registry_state": committed_registry,
		"prior_session": prior,
	}


func create_and_switch(name: String, expected_registry_generation: int) -> Dictionary:
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
		var revoked := prior.drain_and_revoke()
		if not revoked.get("ok", false):
			return _recovery("Die aktuelle Campaign konnte nicht sicher angehalten werden.", revoked)
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
		prepared["state"]
	)
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
	return _current.commit(
		expected_activation_generation,
		expected_campaign_generation,
		partition_changes,
		runtime_state,
		removed_partitions
	)


func revoke_current() -> Dictionary:
	if _current == null:
		return {"ok": true, "status": "no_session"}
	return _current.drain_and_revoke()


func current_session() -> CampaignRuntimeSession:
	return _current


func _prepare(campaign_id: String) -> Dictionary:
	var store := FileCampaignStore.new(_data_root, campaign_id)
	var state := store.load_state()
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
