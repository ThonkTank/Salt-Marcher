class_name SessionPlannerWorkspaceController
extends Node

## Bounded latest-wins projection of Session, Party, Encounter, World, and Creature truth.

const FileCampaignRegistry = preload("res://godot/src/platform/persistence/file_campaign_registry.gd")
const FileCampaignStore = preload("res://godot/src/platform/persistence/file_campaign_store.gd")
const SharedDefinitionStore = preload("res://godot/src/platform/persistence/shared_definition_store.gd")
const SessionPlanKnowledge = preload("res://godot/src/features/sessionplanner/session_plan_knowledge.gd")
const PartyRoster = preload("res://godot/src/features/party/party_roster.gd")
const PartyAdventuringDay = preload("res://godot/src/features/party/party_adventuring_day.gd")
const EncounterPlanKnowledge = preload("res://godot/src/features/encounter/encounter_plan_knowledge.gd")
const EncounterGenerationPolicy = preload("res://godot/src/features/encounter/encounter_generation_policy.gd")
const WorldPlannerKnowledge = preload("res://godot/src/features/worldplanner/world_planner_knowledge.gd")

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


func query(encounter_search_text: String = "") -> Dictionary:
	_mutex.lock()
	_latest_epoch += 1
	var request := {"epoch": _latest_epoch, "encounter_search_text": encounter_search_text}
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
	var result := {
		"active_count": 0 if _active_request.is_empty() else 1,
		"pending_count": 0 if _pending_request.is_empty() else 1,
		"worker_handle_count": 1 if _thread != null else 0,
		"latest_epoch": _latest_epoch,
	}
	_mutex.unlock()
	return result


func _start(request: Dictionary) -> Dictionary:
	_thread = Thread.new()
	var error := _thread.start(_run_query.bind(request.duplicate(true)))
	if error != OK:
		_thread = null
		_mutex.lock()
		_active_request.clear()
		_mutex.unlock()
		return {"ok": false, "status": "worker_error", "error": "Session-Planner-Abfrage konnte nicht gestartet werden."}
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
		var campaign_state: Dictionary = store.load_state()
		if not campaign_state.get("ok", false):
			result = campaign_state
		else:
			result = _project(store, campaign_state, registry_state, request)
			if result.get("ok", false):
				var confirmed: Dictionary = registry.load_state()
				if (
					not confirmed.get("ok", false)
					or confirmed.get("active_campaign_id", "") != campaign_id
					or int(confirmed.get("generation", -1)) != int(registry_state.get("generation", -2))
				):
					result = {"ok": false, "status": "stale", "error": "Die aktive Campaign änderte sich während der Session-Abfrage."}
				else:
					result["campaign_id"] = campaign_id
					result["campaign_generation"] = campaign_state["generation"]
	result["epoch"] = request["epoch"]
	call_deferred("_finish_on_main", result)


func _project(store, campaign_state: Dictionary, registry_state: Dictionary, request: Dictionary) -> Dictionary:
	var session_read := _read_or_empty(store, campaign_state, SessionPlanKnowledge.OWNER, SessionPlanKnowledge.new().empty_payload())
	var party_read := _read_or_empty(store, campaign_state, PartyRoster.OWNER, PartyRoster.new().empty_payload())
	var encounter_read := _read_or_empty(store, campaign_state, EncounterPlanKnowledge.OWNER, EncounterPlanKnowledge.new().empty_payload())
	var world_read := _read_or_empty(store, campaign_state, WorldPlannerKnowledge.OWNER, WorldPlannerKnowledge.new().empty_payload())
	for read in [session_read, party_read, encounter_read, world_read]:
		if not read.get("ok", false):
			return read
		if _cancelled_from_worker():
			return _cancelled_result()
	var session_snapshot := SessionPlanKnowledge.new().snapshot(session_read["payload"])
	var party_snapshot := PartyRoster.new().snapshot(party_read["payload"], "", false, 500, Callable(self, "_cancelled_from_worker"))
	var encounter_validation := EncounterPlanKnowledge.new().validate_payload(encounter_read["payload"])
	var world_validation := WorldPlannerKnowledge.new().validate_payload(world_read["payload"])
	for validation in [session_snapshot, party_snapshot, encounter_validation, world_validation]:
		if not validation.get("ok", false):
			return validation
	var result := {
		"ok": true,
		"status": session_snapshot["status"],
		"sessions": session_snapshot["sessions"],
		"current": session_snapshot["current"].duplicate(true),
		"party_candidates": party_snapshot["roster"].duplicate(true),
		"participant_rows": [],
		"missing_participant_ids": [],
		"budget": _empty_budget(),
		"scenes": [],
		"selected_scene": {},
		"encounter_search": {"status": "idle", "rows": [], "has_more": false},
		"locations": [],
	}
	var world_records: Dictionary = world_validation["payload"]["records"]
	var location_names := {}
	for record_id_value in world_records:
		var record: Dictionary = world_records[record_id_value]
		if record["kind"] == "place":
			location_names[str(record_id_value)] = record["name"]
			result["locations"].append({"reference_id": str(record_id_value), "name": record["name"]})
	result["locations"].sort_custom(func(left: Dictionary, right: Dictionary) -> bool:
		return str(left["name"]).naturalnocasecmp_to(str(right["name"])) < 0
	)
	if result["current"].is_empty():
		return result
	var current: Dictionary = result["current"]
	var party_by_id := {}
	for row in party_snapshot["roster"]:
		party_by_id[str(row["character_id"])] = row
	var levels: Array = []
	for participant_id_value in current["participant_ids"]:
		var participant_id := str(participant_id_value)
		if not party_by_id.has(participant_id):
			result["missing_participant_ids"].append(participant_id)
			continue
		var participant: Dictionary = party_by_id[participant_id].duplicate(true)
		result["participant_rows"].append(participant)
		if participant["level"] != null:
			levels.append(int(participant["level"]))
	result["budget"] = _budget(levels, current["participant_ids"].size(), int(current["encounter_days_units"]))
	var attached_ids: Array = []
	for scene in current["scenes"]:
		if not str(scene["encounter_plan_id"]).is_empty() and str(scene["encounter_plan_id"]) not in attached_ids:
			attached_ids.append(str(scene["encounter_plan_id"]))
	var summaries := {}
	if not attached_ids.is_empty() and levels.size() == current["participant_ids"].size() and not levels.is_empty():
		var definitions := SharedDefinitionStore.new(_data_root).definitions_of_kind(
			int(registry_state.get("shared_definitions_generation", 0)),
			"creature",
			Callable(self, "_cancelled_from_worker")
		)
		if definitions.get("ok", false):
			var summary_result := EncounterGenerationPolicy.new().summaries_for_plans(
				attached_ids, encounter_validation["payload"], levels, definitions["definitions"], Callable(self, "_cancelled_from_worker")
			)
			if summary_result.get("ok", false):
				for entry in summary_result["entries"]:
					summaries[entry["requested_plan_id"]] = entry
	var planned_xp := 0
	for scene_value in current["scenes"]:
		var scene: Dictionary = scene_value.duplicate(true)
		var plan_id := str(scene["encounter_plan_id"])
		var record: Dictionary = encounter_validation["payload"]["records"].get(plan_id, {})
		scene["location_name"] = str(location_names.get(scene["location_id"], "Fehlender Ort" if not scene["location_id"].is_empty() else "Kein Ort"))
		scene["encounter_name"] = str(record.get("name", "Fehlender Encounter" if not plan_id.is_empty() else "Kein Encounter"))
		scene["encounter_status"] = "detached" if plan_id.is_empty() else str(summaries.get(plan_id, {}).get("status", "UNRESOLVABLE"))
		scene["encounter_summary"] = summaries.get(plan_id, {}).get("summary", {}).duplicate(true)
		scene["target_xp"] = int(round(float(result["budget"]["scaled_budget_xp"]) * int(scene["allocation_units"]) / SessionPlanKnowledge.ALLOCATION_TOTAL))
		if scene["encounter_status"] == "FOUND":
			planned_xp += int(scene["encounter_summary"]["adjusted_xp"])
		result["scenes"].append(scene)
		if scene["scene_id"] == current["selected_scene_id"]:
			result["selected_scene"] = scene.duplicate(true)
	result["budget"]["planned_xp"] = planned_xp
	result["budget"]["remaining_xp"] = int(result["budget"]["scaled_budget_xp"]) - planned_xp
	result["budget"]["exceeded"] = planned_xp > int(result["budget"]["scaled_budget_xp"])
	var search_text := str(request["encounter_search_text"])
	if search_text.strip_edges().length() >= 2:
		result["encounter_search"] = EncounterPlanKnowledge.new().search_chooser(
			encounter_validation["payload"], search_text, Callable(self, "_cancelled_from_worker")
		)
	elif not search_text.is_empty():
		result["encounter_search"] = {"ok": true, "status": "underlength", "rows": [], "has_more": false}
	return result


func _budget(levels: Array, participant_count: int, day_units: int) -> Dictionary:
	if participant_count == 0:
		return _empty_budget()
	if levels.size() != participant_count:
		var missing := _empty_budget()
		missing["status"] = "incomplete_levels"
		return missing
	var plan := PartyAdventuringDay.new().plan_for_levels(levels)
	var scaled := int((int(plan["total_budget_xp"]) * day_units + SessionPlanKnowledge.DAY_UNITS_PER_DAY / 2) / SessionPlanKnowledge.DAY_UNITS_PER_DAY)
	return {
		"status": "ready",
		"base_budget_xp": plan["total_budget_xp"],
		"scaled_budget_xp": scaled,
		"planned_xp": 0,
		"remaining_xp": scaled,
		"exceeded": false,
		"first_short_rest_xp": int(round(float(scaled) / 3.0)),
		"second_short_rest_xp": int(round(float(scaled) * 2.0 / 3.0)),
	}


func _empty_budget() -> Dictionary:
	return {"status": "empty", "base_budget_xp": 0, "scaled_budget_xp": 0, "planned_xp": 0, "remaining_xp": 0, "exceeded": false, "first_short_rest_xp": 0, "second_short_rest_xp": 0}


func _read_or_empty(store, state: Dictionary, owner: String, empty: Dictionary) -> Dictionary:
	var read: Dictionary = store.read_partition(owner, state)
	if not read.get("ok", false):
		return read
	return {"ok": true, "payload": read.get("payload", empty)}


func _cancelled_from_worker() -> bool:
	_mutex.lock()
	var cancelled := _cancel_active
	_mutex.unlock()
	return cancelled


func _cancelled_result() -> Dictionary:
	return {"ok": false, "status": "cancelled", "error": "Session-Planner-Abfrage wurde ersetzt."}


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
