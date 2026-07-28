class_name EncounterGeneratedBatchReadController
extends Node

## Latest-wins asynchronous preparation and ordered summary hydration lane.

const FileCampaignRegistry = preload("res://godot/src/platform/persistence/file_campaign_registry.gd")
const FileCampaignStore = preload("res://godot/src/platform/persistence/file_campaign_store.gd")
const SharedDefinitionStore = preload("res://godot/src/platform/persistence/shared_definition_store.gd")
const PartyRoster = preload("res://godot/src/features/party/party_roster.gd")
const EncounterPlanKnowledge = preload("res://godot/src/features/encounter/encounter_plan_knowledge.gd")
const EncounterGenerationPolicy = preload("res://godot/src/features/encounter/encounter_generation_policy.gd")

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


func prepare_batch(source: Dictionary, intents: Array) -> Dictionary:
	return _submit({
		"operation": "prepare",
		"source": source.duplicate(true),
		"intents": intents.duplicate(true),
	})


func load_summaries(plan_ids: Array) -> Dictionary:
	return _submit({"operation": "summaries", "plan_ids": plan_ids.duplicate()})


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


func _submit(request_fields: Dictionary) -> Dictionary:
	_mutex.lock()
	_latest_epoch += 1
	var request: Dictionary = request_fields.duplicate(true)
	request["epoch"] = _latest_epoch
	if not _active_request.is_empty():
		_pending_request = request
		_cancel_active = true
		_mutex.unlock()
		return {"ok": true, "status": "queued", "epoch": request["epoch"]}
	_active_request = request
	_cancel_active = false
	_mutex.unlock()
	return _start(request)


func _start(request: Dictionary) -> Dictionary:
	_thread = Thread.new()
	var start_error := _thread.start(_run_request.bind(request.duplicate(true)))
	if start_error != OK:
		_thread = null
		_mutex.lock()
		_active_request.clear()
		_mutex.unlock()
		return {"ok": false, "status": "worker_error", "error": "Generated Encounter Arbeit konnte nicht gestartet werden."}
	query_started.emit(request.duplicate(true))
	return {"ok": true, "status": "started", "epoch": request["epoch"]}


func _run_request(request: Dictionary) -> void:
	var registry := FileCampaignRegistry.new(_data_root)
	var registry_state: Dictionary = registry.load_state()
	var result: Dictionary
	var campaign_id := str(registry_state.get("active_campaign_id", ""))
	if not registry_state.get("ok", false):
		result = _storage_failure("Campaign-Registry konnte nicht gelesen werden.", registry_state)
	elif campaign_id.is_empty():
		result = {"ok": false, "status": "UNRESOLVABLE", "error": "Wähle zuerst eine Campaign."}
	else:
		var store := FileCampaignStore.new(_data_root, campaign_id)
		var campaign_state := store.load_state()
		if not campaign_state.get("ok", false):
			result = _storage_failure("Campaign konnte nicht gelesen werden.", campaign_state)
		else:
			result = _evaluate(request, registry_state, store, campaign_state)
			if result.get("ok", false):
				var confirmed_registry: Dictionary = registry.load_state()
				var confirmed_campaign: Dictionary = store.load_state()
				if (
					not confirmed_registry.get("ok", false)
					or not confirmed_campaign.get("ok", false)
					or confirmed_registry.get("active_campaign_id", "") != campaign_id
					or int(confirmed_registry.get("generation", -1)) != int(registry_state.get("generation", -2))
					or int(confirmed_registry.get("shared_definitions_generation", -1))
					!= int(registry_state.get("shared_definitions_generation", -2))
					or int(confirmed_campaign.get("generation", -1)) != int(campaign_state.get("generation", -2))
				):
					result = {"ok": false, "status": "STALE", "error": "Campaign, Party oder Creature-Fakten änderten sich während der Encounter-Arbeit."}
				else:
					result["campaign_id"] = campaign_id
					result["campaign_generation"] = campaign_state["generation"]
					result["shared_definitions_generation"] = registry_state["shared_definitions_generation"]
	result["epoch"] = request["epoch"]
	result["operation"] = request.get("operation", "")
	call_deferred("_finish_on_main", result)


func _evaluate(
	request: Dictionary,
	registry_state: Dictionary,
	store,
	campaign_state: Dictionary
) -> Dictionary:
	var party_read: Dictionary = store.read_partition(PartyRoster.OWNER, campaign_state)
	if not party_read.get("ok", false):
		return _storage_failure("Party-Fakten konnten nicht gelesen werden.", party_read)
	var party_model := PartyRoster.new()
	var party := party_model.snapshot(
		party_read.get("payload", party_model.empty_payload()),
		"",
		false,
		PartyRoster.MAX_SEARCH_PAGE_SIZE,
		Callable(self, "_cancelled_from_worker")
	)
	if not party.get("ok", false):
		return party
	var levels: Array = []
	for member in party["active"]:
		if member.get("level", null) == null:
			return {"ok": false, "status": "UNRESOLVABLE", "error": "Jedes aktive Party-Mitglied braucht eine Stufe vor der Encounter-Generierung."}
		levels.append(int(member["level"]))
	if levels.is_empty():
		return {"ok": false, "status": "UNRESOLVABLE", "error": "Die aktive Party enthält keine Mitglieder."}
	var definitions := SharedDefinitionStore.new(_data_root).definitions_of_kind(
		int(registry_state.get("shared_definitions_generation", 0)),
		"creature",
		Callable(self, "_cancelled_from_worker")
	)
	if not definitions.get("ok", false):
		return _storage_failure("Creature-Fakten konnten nicht als vollständiger Snapshot gelesen werden.", definitions)
	var policy := EncounterGenerationPolicy.new()
	if request.get("operation", "") == "prepare":
		return policy.prepare_batch(
			request.get("source", {}),
			request.get("intents", []),
			levels,
			definitions["definitions"],
			Callable(self, "_cancelled_from_worker")
		)
	if request.get("operation", "") == "summaries":
		var encounter_read: Dictionary = store.read_partition(EncounterPlanKnowledge.OWNER, campaign_state)
		if not encounter_read.get("ok", false):
			return _storage_failure("Gespeicherte Encounter konnten nicht gelesen werden.", encounter_read)
		var model := EncounterPlanKnowledge.new()
		var validated := model.validate_payload(encounter_read.get("payload", model.empty_payload()))
		if not validated.get("ok", false):
			return _storage_failure("Gespeicherte Encounter sind beschädigt.", validated)
		return policy.summaries_for_plans(
			request.get("plan_ids", []),
			validated["payload"],
			levels,
			definitions["definitions"],
			Callable(self, "_cancelled_from_worker")
		)
	return {"ok": false, "status": "INVALID_REQUEST", "error": "Unbekannte Generated-Encounter-Abfrage."}


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


func _storage_failure(message: String, cause: Dictionary) -> Dictionary:
	return {"ok": false, "status": "STORAGE_FAILURE", "error": message, "cause": cause}


func _exit_tree() -> void:
	cancel_all()
	if _thread != null:
		_thread.wait_to_finish()
		_thread = null
