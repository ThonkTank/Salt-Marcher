class_name CampaignRuntimeSession
extends RefCounted

## One admitted Campaign writer bound to one durable activation generation.

var _campaign_id: String
var _activation_generation: int
var _store
var _state: Dictionary
var _admitted := true


func _init(
	campaign_id: String,
	activation_generation: int,
	store,
	initial_state: Dictionary
) -> void:
	_campaign_id = campaign_id
	_activation_generation = activation_generation
	_store = store
	_state = initial_state.duplicate(true)


func commit(
	expected_activation_generation: int,
	expected_campaign_generation: int,
	partition_changes: Dictionary,
	runtime_state: Dictionary,
	removed_partitions: Array[String] = []
) -> Dictionary:
	if not _admitted:
		return {
			"ok": false,
			"status": "revoked",
			"error": "Diese Campaign-Laufzeit besitzt keine Schreibautorität mehr.",
		}
	if expected_activation_generation != _activation_generation:
		return {
			"ok": false,
			"status": "stale_activation",
			"error": "Die Campaign-Aktivierung wurde inzwischen ersetzt.",
		}
	if expected_campaign_generation != int(_state["generation"]):
		return {
			"ok": false,
			"status": "stale",
			"error": "Die Campaign wurde inzwischen geändert.",
			"state": snapshot(),
		}
	var committed: Dictionary = _store.commit(
		expected_campaign_generation,
		partition_changes,
		runtime_state,
		removed_partitions
	)
	if committed.get("ok", false):
		_state = committed["state"].duplicate(true)
	return committed


func drain_and_revoke() -> Dictionary:
	_admitted = false
	return {
		"ok": true,
		"status": "revoked",
		"campaign_id": _campaign_id,
		"campaign_generation": _state["generation"],
	}


func resume_after_precommit_failure() -> Dictionary:
	if _admitted:
		return {"ok": true, "status": "already_admitted"}
	_admitted = true
	return {"ok": true, "status": "resumed"}


func snapshot() -> Dictionary:
	return {
		"campaign_id": _campaign_id,
		"activation_generation": _activation_generation,
		"admitted": _admitted,
		"campaign_state": _state.duplicate(true),
	}


func campaign_id() -> String:
	return _campaign_id


func activation_generation() -> int:
	return _activation_generation


func campaign_generation() -> int:
	return int(_state["generation"])


func admitted() -> bool:
	return _admitted
