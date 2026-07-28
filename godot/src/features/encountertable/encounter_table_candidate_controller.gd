class_name EncounterTableCandidateController
extends Node

## Latest-wins weighted candidate reads across Encounter Table and Creature owners.

const FileCampaignRegistry = preload("res://godot/src/platform/persistence/file_campaign_registry.gd")
const FileCampaignStore = preload("res://godot/src/platform/persistence/file_campaign_store.gd")
const SharedDefinitionStore = preload("res://godot/src/platform/persistence/shared_definition_store.gd")
const EncounterTableKnowledge = preload("res://godot/src/features/encountertable/encounter_table_knowledge.gd")

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


func query(table_ids: Array, maximum_xp: int = 0) -> Dictionary:
	_mutex.lock()
	_latest_epoch += 1
	var request := {
		"epoch": _latest_epoch,
		"table_ids": table_ids.duplicate(),
		"maximum_xp": maximum_xp,
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
	var start_error := _thread.start(_run_query.bind(request.duplicate(true)))
	if start_error != OK:
		_thread = null
		_mutex.lock()
		_active_request.clear()
		_mutex.unlock()
		return {"ok": false, "status": "worker_error", "error": "Encounter-Table-Kandidaten konnten nicht geladen werden."}
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
			var read := store.read_partition(EncounterTableKnowledge.OWNER, campaign_state)
			if not read.get("ok", false):
				result = read
			else:
				var model := EncounterTableKnowledge.new()
				var memberships := model.memberships_for_tables(
					read.get("payload", model.empty_payload()),
					request["table_ids"],
					Callable(self, "_cancelled_from_worker")
				)
				if not memberships.get("ok", false):
					result = memberships
				else:
					result = _resolve_candidates(
						memberships["memberships"],
						int(registry_state.get("shared_definitions_generation", 0)),
						int(request["maximum_xp"])
					)
					if result.get("ok", false):
						var confirmed: Dictionary = registry.load_state()
						if (
							not confirmed.get("ok", false)
							or confirmed.get("active_campaign_id", "") != campaign_id
							or int(confirmed.get("generation", -1)) != int(registry_state.get("generation", -2))
							or int(confirmed.get("shared_definitions_generation", -1))
							!= int(registry_state.get("shared_definitions_generation", -2))
						):
							result = {"ok": false, "status": "stale", "error": "Campaign oder Creature-Katalog änderten sich während der Kandidatenabfrage."}
						else:
							result["campaign_id"] = campaign_id
							result["campaign_generation"] = campaign_state["generation"]
							result["shared_definitions_generation"] = registry_state["shared_definitions_generation"]
	result["epoch"] = request["epoch"]
	result["request"] = request.duplicate(true)
	call_deferred("_finish_on_main", result)


func _resolve_candidates(memberships: Array, generation: int, maximum_xp: int) -> Dictionary:
	if memberships.is_empty():
		return {"ok": true, "status": "empty", "rows": [], "total": 0}
	var creature_ids: Array = []
	var seen_creatures := {}
	for membership in memberships:
		if _cancelled_from_worker():
			return {"ok": false, "status": "cancelled", "error": "Encounter-Table-Abfrage wurde ersetzt."}
		var creature_id := str(membership["creature_id"])
		if not seen_creatures.has(creature_id):
			seen_creatures[creature_id] = true
			creature_ids.append(creature_id)
	var definitions := SharedDefinitionStore.new(_data_root).definitions_for_refs(
		creature_ids,
		generation,
		Callable(self, "_cancelled_from_worker")
	)
	if not definitions.get("ok", false):
		return definitions
	var definitions_by_id := {}
	for definition in definitions["definitions"]:
		if definition.get("kind", "") != "creature":
			return _failure("Encounter Table verweist auf keine Creature-Definition: %s" % definition.get("definition_id", ""))
		definitions_by_id[str(definition["definition_id"])] = definition
	var aggregated := {}
	for membership in memberships:
		var creature_id := str(membership["creature_id"])
		var table_id := str(membership["table_id"])
		var candidate: Dictionary = aggregated.get(creature_id, {
			"creature_id": creature_id,
			"weight": 0,
			"source_table_ids": [],
			"table_weights": {},
		})
		candidate["weight"] = maxi(int(candidate["weight"]), int(membership["weight"]))
		candidate["source_table_ids"].append(table_id)
		candidate["table_weights"][table_id] = int(membership["weight"])
		aggregated[creature_id] = candidate
	var rows: Array = []
	for creature_id_value in aggregated:
		if _cancelled_from_worker():
			return {"ok": false, "status": "cancelled", "error": "Encounter-Table-Abfrage wurde ersetzt."}
		var creature_id := str(creature_id_value)
		var definition: Dictionary = definitions_by_id[creature_id]
		var projected := _candidate_from_definition(definition, aggregated[creature_id])
		if not projected.get("ok", false):
			return projected
		var row: Dictionary = projected["candidate"]
		if maximum_xp > 0 and int(row["xp"]) > maximum_xp:
			continue
		rows.append(row)
	rows.sort_custom(func(left: Dictionary, right: Dictionary) -> bool:
		if int(left["xp"]) != int(right["xp"]):
			return int(left["xp"]) < int(right["xp"])
		var left_name := str(left["name"]).to_lower()
		var right_name := str(right["name"]).to_lower()
		if left_name == right_name:
			return str(left["creature_id"]) < str(right["creature_id"])
		return left_name < right_name
	)
	return {
		"ok": true,
		"status": "empty" if rows.is_empty() else "ready",
		"rows": rows,
		"total": rows.size(),
	}


func _candidate_from_definition(definition: Dictionary, aggregate: Dictionary) -> Dictionary:
	var content: Dictionary = definition.get("content", {})
	for field in ["xp", "hit_points", "armor_class", "legendary_action_count"]:
		if not _non_negative_whole_number(content.get(field, null)):
			return _failure("Creature %s besitzt keine vollständigen Kandidatenfakten." % definition["definition_id"])
	if not _whole_number(content.get("initiative_bonus", null)):
		return _failure("Creature %s besitzt keine vollständigen Kandidatenfakten." % definition["definition_id"])
	for field in ["hit_dice_count", "hit_dice_sides"]:
		if content.get(field, null) != null and not _positive_whole_number(content[field]):
			return _failure("Creature %s besitzt ungültige Trefferwürfel-Fakten." % definition["definition_id"])
	if content.get("hit_dice_modifier", null) != null and not _whole_number(content["hit_dice_modifier"]):
		return _failure("Creature %s besitzt ungültige Trefferwürfel-Fakten." % definition["definition_id"])
	if (
		not content.get("creature_type", null) is String
		or str(content.get("creature_type", "")).is_empty()
		or not content.get("challenge_rating", null) is String
		or str(content.get("challenge_rating", "")).is_empty()
	):
		return _failure("Creature %s besitzt keine vollständigen Kandidatenfakten." % definition["definition_id"])
	var source_table_ids: Array = aggregate["source_table_ids"].duplicate()
	source_table_ids.sort()
	return {
		"ok": true,
		"candidate": {
			"creature_id": definition["definition_id"],
			"name": definition["name"],
			"creature_type": content["creature_type"],
			"challenge_rating": content["challenge_rating"],
			"xp": int(content["xp"]),
			"hit_points": int(content["hit_points"]),
			"hit_dice_count": content.get("hit_dice_count"),
			"hit_dice_sides": content.get("hit_dice_sides"),
			"hit_dice_modifier": content.get("hit_dice_modifier"),
			"armor_class": int(content["armor_class"]),
			"initiative_bonus": int(content["initiative_bonus"]),
			"legendary_action_count": int(content["legendary_action_count"]),
			"weight": int(aggregate["weight"]),
			"source_table_ids": source_table_ids,
			"table_weights": aggregate["table_weights"].duplicate(true),
			"source_label": "Encounter-Tabelle",
		},
	}


func _whole_number(value: Variant) -> bool:
	if not value is int and not value is float:
		return false
	return is_equal_approx(float(value), roundf(float(value)))


func _non_negative_whole_number(value: Variant) -> bool:
	return _whole_number(value) and float(value) >= 0


func _positive_whole_number(value: Variant) -> bool:
	return _whole_number(value) and float(value) > 0


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


func _failure(message: String) -> Dictionary:
	return {"ok": false, "status": "invalid", "error": message}


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
