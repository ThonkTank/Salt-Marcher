class_name SessionPlanCommandController
extends "res://godot/src/app/campaign_partition_command_controller.gd"

## Revisionsafe Session-Planner commands over the admitted serial Campaign writer.

const SessionCampaignStore = preload("res://godot/src/platform/persistence/file_campaign_store.gd")
const PartyRoster = preload("res://godot/src/features/party/party_roster.gd")
const EncounterPlanKnowledge = preload("res://godot/src/features/encounter/encounter_plan_knowledge.gd")
const WorldPlannerKnowledge = preload("res://godot/src/features/worldplanner/world_planner_knowledge.gd")
const SessionPlanKnowledge = preload("res://godot/src/features/sessionplanner/session_plan_knowledge.gd")

var _session_data_root: String


func _init(data_root: String, runtime_coordinator) -> void:
	_session_data_root = data_root.trim_suffix("/")
	super(
		data_root,
		runtime_coordinator,
		SessionPlanKnowledge.OWNER,
		Callable(self, "_empty_payload"),
		Callable(self, "_apply_session_command")
	)


func create_session(name: String) -> Dictionary:
	return start_command({"operation": "create", "name": name})


func select_session(session_id: String, revision: int) -> Dictionary:
	return _targeted("select", session_id, revision)


func rename_session(session_id: String, revision: int, name: String) -> Dictionary:
	return _targeted("rename", session_id, revision, {"name": name})


func delete_session(session_id: String, revision: int) -> Dictionary:
	return _targeted("delete", session_id, revision)


func set_participants(session_id: String, revision: int, participant_ids: Array) -> Dictionary:
	return _targeted("participants", session_id, revision, {"participant_ids": participant_ids.duplicate()})


func set_encounter_days(session_id: String, revision: int, day_units: int) -> Dictionary:
	return _targeted("days", session_id, revision, {"day_units": day_units})


func add_scene(session_id: String, revision: int) -> Dictionary:
	return _targeted("add_scene", session_id, revision)


func update_scene(session_id: String, revision: int, scene_id: String, title: String, notes: String, location_id: String = "") -> Dictionary:
	return _targeted("update_scene", session_id, revision, {
		"scene_id": scene_id, "title": title, "notes": notes, "location_id": location_id,
	})


func select_scene(session_id: String, revision: int, scene_id: String) -> Dictionary:
	return _targeted("select_scene", session_id, revision, {"scene_id": scene_id})


func save_scene_and_select_scene(session_id: String, revision: int, source_scene_id: String, title: String, notes: String, location_id: String, target_scene_id: String) -> Dictionary:
	return _targeted("save_select_scene", session_id, revision, {
		"source_scene_id": source_scene_id, "title": title, "notes": notes,
		"location_id": location_id, "target_scene_id": target_scene_id,
	})


func save_scene_and_select_session(source_session_id: String, source_revision: int, source_scene_id: String, title: String, notes: String, location_id: String, target_session_id: String, target_revision: int) -> Dictionary:
	return _targeted("save_select_session", source_session_id, source_revision, {
		"source_scene_id": source_scene_id, "title": title, "notes": notes,
		"location_id": location_id, "target_session_id": target_session_id,
		"target_revision": target_revision,
	})


func move_scene(session_id: String, revision: int, scene_id: String, delta: int) -> Dictionary:
	return _targeted("move_scene", session_id, revision, {"scene_id": scene_id, "delta": delta})


func remove_scene(session_id: String, revision: int, scene_id: String) -> Dictionary:
	return _targeted("remove_scene", session_id, revision, {"scene_id": scene_id})


func attach_encounter(session_id: String, revision: int, scene_id: String, plan_id: String) -> Dictionary:
	return _targeted("attach_encounter", session_id, revision, {"scene_id": scene_id, "plan_id": plan_id})


func detach_encounter(session_id: String, revision: int, scene_id: String) -> Dictionary:
	return _targeted("detach_encounter", session_id, revision, {"scene_id": scene_id})


func set_allocation(session_id: String, revision: int, scene_id: String, allocation_units: int) -> Dictionary:
	return _targeted("allocation", session_id, revision, {"scene_id": scene_id, "allocation_units": allocation_units})


func set_rest(session_id: String, revision: int, left_id: String, right_id: String, kind: String) -> Dictionary:
	return _targeted("rest", session_id, revision, {"left_id": left_id, "right_id": right_id, "kind": kind})


func add_loot_note(session_id: String, revision: int, scene_id: String, text: String) -> Dictionary:
	return _targeted("add_loot", session_id, revision, {"scene_id": scene_id, "text": text})


func update_loot_note(session_id: String, revision: int, scene_id: String, note_id: String, text: String) -> Dictionary:
	return _targeted("update_loot", session_id, revision, {"scene_id": scene_id, "note_id": note_id, "text": text})


func remove_loot_note(session_id: String, revision: int, scene_id: String, note_id: String) -> Dictionary:
	return _targeted("remove_loot", session_id, revision, {"scene_id": scene_id, "note_id": note_id})


func _targeted(operation: String, session_id: String, revision: int, extra: Dictionary = {}) -> Dictionary:
	var request := {"operation": operation, "session_id": session_id, "revision": revision}
	request.merge(extra, true)
	return start_command(request)


func _empty_payload() -> Dictionary:
	return SessionPlanKnowledge.new().empty_payload()


func _apply_session_command(payload: Dictionary, request: Dictionary) -> Dictionary:
	var model := SessionPlanKnowledge.new()
	var operation := str(request.get("operation", ""))
	var session_id := str(request.get("session_id", ""))
	var revision := int(request.get("revision", 0))
	match operation:
		"create":
			return model.create_session(payload, str(request["name"]))
		"select":
			return model.select_session(payload, session_id, revision)
		"rename":
			return model.rename_session(payload, session_id, revision, str(request["name"]))
		"delete":
			return model.delete_session(payload, session_id, revision)
		"participants":
			var party_check := _validate_participants(request["participant_ids"], request)
			if not party_check.get("ok", false):
				return party_check
			return model.set_participants(payload, session_id, revision, request["participant_ids"])
		"days":
			return model.set_encounter_days(payload, session_id, revision, int(request["day_units"]))
		"add_scene":
			return model.add_scene(payload, session_id, revision)
		"update_scene":
			var location_id := str(request["location_id"])
			if not location_id.is_empty():
				var location_check := _validate_foreign_record(WorldPlannerKnowledge.OWNER, location_id, "place", request)
				if not location_check.get("ok", false):
					return location_check
			return model.update_scene(payload, session_id, revision, str(request["scene_id"]), str(request["title"]), str(request["notes"]), location_id)
		"select_scene":
			return model.select_scene(payload, session_id, revision, str(request["scene_id"]))
		"save_select_scene":
			var scene_location := str(request["location_id"])
			if not scene_location.is_empty():
				var scene_location_check := _validate_foreign_record(WorldPlannerKnowledge.OWNER, scene_location, "place", request)
				if not scene_location_check.get("ok", false):
					return scene_location_check
			return model.save_scene_and_select_scene(
				payload, session_id, revision, str(request["source_scene_id"]), str(request["title"]),
				str(request["notes"]), scene_location, str(request["target_scene_id"])
			)
		"save_select_session":
			var session_location := str(request["location_id"])
			if not session_location.is_empty():
				var session_location_check := _validate_foreign_record(WorldPlannerKnowledge.OWNER, session_location, "place", request)
				if not session_location_check.get("ok", false):
					return session_location_check
			return model.save_scene_and_select_session(
				payload, session_id, revision, str(request["source_scene_id"]), str(request["title"]),
				str(request["notes"]), session_location, str(request["target_session_id"]), int(request["target_revision"])
			)
		"move_scene":
			return model.move_scene(payload, session_id, revision, str(request["scene_id"]), int(request["delta"]))
		"remove_scene":
			return model.remove_scene(payload, session_id, revision, str(request["scene_id"]))
		"attach_encounter":
			var encounter_check := _validate_foreign_record(EncounterPlanKnowledge.OWNER, str(request["plan_id"]), EncounterPlanKnowledge.KIND, request)
			if not encounter_check.get("ok", false):
				return encounter_check
			return model.attach_encounter(payload, session_id, revision, str(request["scene_id"]), str(request["plan_id"]))
		"detach_encounter":
			return model.detach_encounter(payload, session_id, revision, str(request["scene_id"]))
		"allocation":
			return model.set_allocation(payload, session_id, revision, str(request["scene_id"]), int(request["allocation_units"]))
		"rest":
			return model.set_rest(payload, session_id, revision, str(request["left_id"]), str(request["right_id"]), str(request["kind"]))
		"add_loot":
			return model.add_loot_note(payload, session_id, revision, str(request["scene_id"]), str(request["text"]))
		"update_loot":
			return model.update_loot_note(payload, session_id, revision, str(request["scene_id"]), str(request["note_id"]), str(request["text"]))
		"remove_loot":
			return model.remove_loot_note(payload, session_id, revision, str(request["scene_id"]), str(request["note_id"]))
		_:
			return {"ok": false, "status": "invalid", "error": "Unbekannte Session-Planner-Änderung."}


func _validate_participants(participant_ids: Array, request: Dictionary) -> Dictionary:
	var read := _read_owner(PartyRoster.OWNER, request)
	if not read.get("ok", false):
		return read
	var roster := PartyRoster.new().validate_payload(read.get("payload", PartyRoster.new().empty_payload()))
	if not roster.get("ok", false):
		return roster
	for value in participant_ids:
		if not roster["payload"]["characters"].has(str(value)):
			return {"ok": false, "status": "missing", "error": "Ein Charakter der Planungsgruppe fehlt inzwischen."}
	return {"ok": true}


func _validate_foreign_record(owner: String, record_id: String, expected_kind: String, request: Dictionary) -> Dictionary:
	var read := _read_owner(owner, request)
	if not read.get("ok", false):
		return read
	var payload: Dictionary = read.get("payload", {})
	var validation := (
		EncounterPlanKnowledge.new().validate_payload(payload)
		if owner == EncounterPlanKnowledge.OWNER
		else WorldPlannerKnowledge.new().validate_payload(payload)
	)
	if not validation.get("ok", false):
		return validation
	var records: Dictionary = validation["payload"]["records"]
	if not records.has(record_id) or records[record_id].get("kind", "") != expected_kind:
		return {"ok": false, "status": "missing", "error": "Die verknüpfte Referenz fehlt inzwischen."}
	return {"ok": true}


func _read_owner(owner: String, request: Dictionary) -> Dictionary:
	var store := SessionCampaignStore.new(_session_data_root, str(request["campaign_id"]))
	var read := store.read_partition(owner, request["campaign_state"])
	if not read.get("ok", false):
		return read
	return {"ok": true, "payload": read.get("payload", {})}
