class_name SceneCommandController
extends "res://godot/src/app/campaign_partition_command_controller.gd"

## Serial Scene writer. Every Scene mutation and its complete Encounter-context
## synchronization publish in one Campaign generation.

const FileCampaignRegistry = preload("res://godot/src/platform/persistence/file_campaign_registry.gd")
const SharedDefinitionStore = preload("res://godot/src/platform/persistence/shared_definition_store.gd")
const SceneKnowledge = preload("res://godot/src/features/scene/scene_knowledge.gd")
const EncounterPlanKnowledge = preload("res://godot/src/features/encounter/encounter_plan_knowledge.gd")
const EncounterRuntimeKnowledge = preload("res://godot/src/features/encounter/encounter_runtime_knowledge.gd")
const PartyRoster = preload("res://godot/src/features/party/party_roster.gd")
const WorldPlannerKnowledge = preload("res://godot/src/features/worldplanner/world_planner_knowledge.gd")

var _scene_data_root: String


func _init(data_root: String, runtime_coordinator) -> void:
	_scene_data_root = data_root.trim_suffix("/")
	super(
		data_root,
		runtime_coordinator,
		SceneKnowledge.OWNER,
		Callable(self, "_empty_payload"),
		Callable(self, "_apply_scene_command")
	)


func initialize() -> Dictionary:
	return start_command({"operation": "initialize"})


func refresh_foreign_facts() -> Dictionary:
	return start_command({"operation": "refresh"})


func focus_scene(scene_id: String) -> Dictionary:
	return start_command({"operation": "focus", "scene_id": scene_id})


func move_pc(character_id: String, destination_scene_id: String = "") -> Dictionary:
	return start_command({"operation": "move_pc", "character_id": character_id, "destination_scene_id": destination_scene_id})


func update_notes(scene_id: String, notes: String) -> Dictionary:
	return start_command({"operation": "update_notes", "scene_id": scene_id, "notes": notes})


func set_party_membership(character_id: String, membership: String) -> Dictionary:
	return start_command({"operation": "party_membership", "character_id": character_id, "membership": membership})


func trash_party_character(character_id: String) -> Dictionary:
	return start_command({"operation": "party_trash", "character_id": character_id})


func assign_npc(scene_id: String, npc_id: String) -> Dictionary:
	return start_command({"operation": "assign_npc", "scene_id": scene_id, "npc_id": npc_id})


func unassign_npc(npc_id: String) -> Dictionary:
	return start_command({"operation": "unassign_npc", "npc_id": npc_id})


func set_location(scene_id: String, location_id: String) -> Dictionary:
	return start_command({"operation": "set_location", "scene_id": scene_id, "location_id": location_id})


func assign_mob(scene_id: String, creature_id: String, count: int) -> Dictionary:
	return start_command({"operation": "assign_mob", "scene_id": scene_id, "creature_id": creature_id, "count": count})


func assign_mob_to_focused(creature_id: String, count: int = 1) -> Dictionary:
	return start_command({"operation": "assign_mob_focused", "creature_id": creature_id, "count": count})


func unassign_mob(scene_id: String, creature_id: String) -> Dictionary:
	return start_command({"operation": "unassign_mob", "scene_id": scene_id, "creature_id": creature_id})


func set_participant_state(
	scene_id: String,
	kind: String,
	ref_id: String,
	defeated: bool,
	notes: String
) -> Dictionary:
	return start_command({
		"operation": "set_participant_state",
		"scene_id": scene_id,
		"kind": kind,
		"ref_id": ref_id,
		"defeated": defeated,
		"notes": notes,
	})


func _empty_payload() -> Dictionary:
	return SceneKnowledge.new().empty_payload()


func _empty_party_payload() -> Dictionary:
	return PartyRoster.new().empty_payload()


func _empty_world_payload() -> Dictionary:
	return WorldPlannerKnowledge.new().empty_payload()


func _empty_encounter_payload() -> Dictionary:
	return EncounterPlanKnowledge.new().empty_payload()


func _supporting_payload_factories_for(_request: Dictionary) -> Dictionary:
	return {
		PartyRoster.OWNER: Callable(self, "_empty_party_payload"),
		WorldPlannerKnowledge.OWNER: Callable(self, "_empty_world_payload"),
		EncounterPlanKnowledge.OWNER: Callable(self, "_empty_encounter_payload"),
	}


func _apply_scene_command(payload: Dictionary, request: Dictionary) -> Dictionary:
	var model := SceneKnowledge.new()
	var validation := model.validate_payload(payload)
	if not validation.get("ok", false):
		return validation
	payload = validation["payload"]
	var supporting: Dictionary = request.get("supporting_payloads", {})
	var party_payload: Dictionary = supporting.get(PartyRoster.OWNER, _empty_party_payload())
	var party_mutation: Dictionary = {}
	match str(request.get("operation", "")):
		"party_membership":
			party_mutation = PartyRoster.new().set_membership(
				party_payload,
				str(request.get("character_id", "")),
				str(request.get("membership", ""))
			)
		"party_trash":
			party_mutation = PartyRoster.new().trash_character(
				party_payload,
				str(request.get("character_id", ""))
			)
	if not party_mutation.is_empty():
		if not party_mutation.get("ok", false):
			return party_mutation
		party_payload = party_mutation["payload"]
	var party := _party_snapshot(party_payload)
	if not party.get("ok", false):
		return party
	var world_validation := WorldPlannerKnowledge.new().validate_payload(
		supporting.get(WorldPlannerKnowledge.OWNER, _empty_world_payload())
	)
	if not world_validation.get("ok", false):
		return world_validation
	var encounter_validation := EncounterPlanKnowledge.new().validate_payload(
		supporting.get(EncounterPlanKnowledge.OWNER, _empty_encounter_payload())
	)
	if not encounter_validation.get("ok", false):
		return encounter_validation
	var synchronized_party := model.synchronize_active_party(payload, party["active_ids"])
	if not synchronized_party.get("ok", false):
		return synchronized_party
	payload = synchronized_party["payload"]
	var result: Dictionary
	match str(request.get("operation", "")):
		"initialize":
			result = model.initialize(payload, party["active_ids"])
		"refresh":
			result = synchronized_party
		"focus":
			result = model.focus_scene(payload, str(request.get("scene_id", "")))
		"move_pc":
			result = model.move_pc(payload, str(request.get("character_id", "")), str(request.get("destination_scene_id", "")))
		"update_notes":
			result = model.update_notes(payload, str(request.get("scene_id", "")), str(request.get("notes", "")))
		"party_membership", "party_trash":
			result = synchronized_party
			result["status"] = party_mutation["status"]
		"assign_npc":
			var npc_id := str(request.get("npc_id", ""))
			if not _active_world_record(world_validation["payload"], npc_id, "npc"):
				return _failure("Nur aktive World-Planner-NPCs können einer Szene zugeordnet werden.", "missing")
			result = model.assign_npc(payload, str(request.get("scene_id", "")), npc_id)
		"unassign_npc":
			result = model.unassign_npc(payload, str(request.get("npc_id", "")))
		"set_location":
			var location_id := str(request.get("location_id", ""))
			if not location_id.is_empty() and not _active_world_record(world_validation["payload"], location_id, "place"):
				return _failure("Scene-Ort fehlt im aktiven World Planner.", "missing")
			result = model.set_location(payload, str(request.get("scene_id", "")), location_id)
		"assign_mob":
			var scene_id := str(request.get("scene_id", payload["focused_scene_id"]))
			result = model.assign_mob(payload, scene_id, str(request.get("creature_id", "")), int(request.get("count", 0)))
		"assign_mob_focused":
			result = model.add_mob(
				payload,
				str(payload["focused_scene_id"]),
				str(request.get("creature_id", "")),
				int(request.get("count", 0))
			)
		"unassign_mob":
			result = model.unassign_mob(payload, str(request.get("scene_id", "")), str(request.get("creature_id", "")))
		"set_participant_state":
			result = model.set_participant_state(
				payload,
				str(request.get("scene_id", "")),
				str(request.get("kind", "")),
				str(request.get("ref_id", "")),
				bool(request.get("defeated", false)),
				str(request.get("notes", ""))
			)
		_:
			return _failure("Unbekannte Scene-Änderung.")
	if not result.get("ok", false):
		return result
	var scene_payload: Dictionary = result.get("payload", payload)
	var encounter_payload: Dictionary = encounter_validation["payload"]
	var synchronized := _synchronize_encounter(
		scene_payload,
		encounter_payload,
		party,
		world_validation["payload"],
		request
	)
	if not synchronized.get("ok", false):
		return synchronized
	if party_mutation.is_empty() and result.get("no_write", false) and synchronized.get("no_write", false):
		result["no_write"] = true
		return result
	result.erase("no_write")
	result["partition_updates"] = {
		SceneKnowledge.OWNER: scene_payload,
		EncounterPlanKnowledge.OWNER: synchronized["payload"],
	}
	if not party_mutation.is_empty():
		result["partition_updates"][PartyRoster.OWNER] = party_payload
	result["encounter_context_id"] = SceneKnowledge.new().encounter_context_id(scene_payload["focused_scene_id"])
	result["encounter_status"] = synchronized["status"]
	return result


func _synchronize_encounter(
	scene_payload: Dictionary,
	encounter_payload: Dictionary,
	party: Dictionary,
	world_payload: Dictionary,
	request: Dictionary
) -> Dictionary:
	var facts := _resolved_encounter_facts(scene_payload, encounter_payload, party, world_payload, request)
	if not facts.get("ok", false):
		return facts
	var focused_context_id := SceneKnowledge.new().encounter_context_id(str(scene_payload["focused_scene_id"]))
	return EncounterRuntimeKnowledge.new().synchronize_contexts(
		encounter_payload,
		int(scene_payload["revision"]),
		focused_context_id,
		facts["specs"]
	)


func _resolved_encounter_facts(
	scene_payload: Dictionary,
	encounter_payload: Dictionary,
	party: Dictionary,
	world_payload: Dictionary,
	request: Dictionary
) -> Dictionary:
	var creature_ids: Array = []
	for scene_id_value in scene_payload["scenes"]:
		var scene: Dictionary = scene_payload["scenes"][scene_id_value]
		for mob in scene["mobs"]:
			creature_ids.append(str(mob["creature_id"]))
		for npc_id in scene["npc_ids"]:
			var npc: Dictionary = world_payload["records"].get(npc_id, {})
			var creature_id := str(npc.get("creature_id", ""))
			if not _npc_role(npc, world_payload["records"]).is_empty() and not creature_id.is_empty():
				creature_ids.append(creature_id)
	var unique_ids: Array = []
	var seen := {}
	for id_value in creature_ids:
		var id := str(id_value)
		if not seen.has(id):
			seen[id] = true
			unique_ids.append(id)
	var registry := FileCampaignRegistry.new(_scene_data_root)
	var registry_state := registry.load_state()
	if (
		not registry_state.get("ok", false)
		or registry_state.get("active_campaign_id", "") != request.get("campaign_id", "")
		or int(registry_state.get("generation", -1)) != int(request.get("activation_generation", -2))
	):
		return _failure("Die aktive Campaign änderte sich vor der Scene-Synchronisierung.", "stale")
	var definitions_by_id := {}
	if not unique_ids.is_empty():
		var definitions := SharedDefinitionStore.new(_scene_data_root).definitions_for_refs(
			unique_ids,
			int(registry_state.get("shared_definitions_generation", 0))
		)
		if not definitions.get("ok", false):
			return _failure("Eine Scene-Creature fehlt oder ist beschädigt.", str(definitions.get("status", "invalid")))
		for value in definitions["definitions"]:
			var definition: Dictionary = value
			if definition.get("kind", "") != "creature" or not _valid_creature_definition(definition):
				return _failure("Scene-Creature besitzt unvollständige Kampfwerte.")
			definitions_by_id[str(definition["definition_id"])] = definition
	var specs: Array = []
	for scene_id_value in scene_payload["scenes"]:
		var scene: Dictionary = scene_payload["scenes"][scene_id_value]
		var roster: Array = []
		for mob in scene["mobs"]:
			roster.append(_runtime_roster_entry(
				"scene-mob.%s" % mob["assignment_id"],
				"enemy",
				definitions_by_id[str(mob["creature_id"])],
				int(mob["count"]),
				str(definitions_by_id[str(mob["creature_id"])]["name"])
			))
		for npc_id in scene["npc_ids"]:
			var npc: Dictionary = world_payload["records"].get(npc_id, {})
			var creature_id := str(npc.get("creature_id", ""))
			var role := _npc_role(npc, world_payload["records"])
			if role.is_empty() or creature_id.is_empty() or not definitions_by_id.has(creature_id):
				continue
			roster.append(_runtime_roster_entry(
				"scene-npc.%s" % npc_id,
				role,
				definitions_by_id[creature_id],
				1,
				str(npc.get("name", definitions_by_id[creature_id]["name"]))
			))
		var party_rows: Array = []
		for pc_id in scene["party_member_ids"]:
			if party["by_id"].has(pc_id):
				party_rows.append(party["by_id"][pc_id].duplicate(true))
		specs.append({
			"context_id": SceneKnowledge.new().encounter_context_id(str(scene["scene_id"])),
			"active_plan_id": "",
			"party": party_rows,
			"roster": roster,
		})
	var confirmed := registry.load_state()
	if (
		not confirmed.get("ok", false)
		or confirmed.get("active_campaign_id", "") != request.get("campaign_id", "")
		or int(confirmed.get("generation", -1)) != int(request.get("activation_generation", -2))
		or int(confirmed.get("shared_definitions_generation", -1)) != int(registry_state.get("shared_definitions_generation", -2))
	):
		return _failure("Campaign oder Creature-Generation änderte sich während der Scene-Synchronisierung.", "stale")
	return {"ok": true, "specs": specs}


func _party_snapshot(payload: Dictionary) -> Dictionary:
	var snapshot := PartyRoster.new().snapshot(payload, "", false, PartyRoster.MAX_SEARCH_PAGE_SIZE)
	if not snapshot.get("ok", false):
		return snapshot
	var active_ids: Array = []
	var by_id := {}
	for member in snapshot["active"]:
		var id := str(member["character_id"])
		active_ids.append(id)
		by_id[id] = member.duplicate(true)
	return {"ok": true, "active": snapshot["active"], "active_ids": active_ids, "by_id": by_id}


func _active_world_record(payload: Dictionary, record_id: String, kind: String) -> bool:
	if not payload["records"].has(record_id):
		return false
	var record: Dictionary = payload["records"][record_id]
	if record.get("kind", "") != kind:
		return false
	return kind != "npc" or record.get("lifecycle_status", "") == "active"


func _npc_role(npc: Dictionary, records: Dictionary) -> String:
	if npc.get("kind", "") != "npc" or npc.get("lifecycle_status", "") != "active":
		return ""
	var effective := int(npc.get("disposition_modifier", 0))
	var faction_id := str(npc.get("faction_id", ""))
	if records.has(faction_id) and records[faction_id].get("kind", "") == "faction":
		effective += int(records[faction_id].get("disposition_base", 0))
	effective = clampi(effective, -50, 50)
	if effective <= -15:
		return "enemy"
	if effective >= 15:
		return "ally"
	return ""


func _runtime_roster_entry(slot_id: String, kind: String, definition: Dictionary, quantity: int, last_known_name: String) -> Dictionary:
	var content: Dictionary = definition["content"]
	return {
		"slot_id": slot_id,
		"kind": kind,
		"creature_id": str(definition["definition_id"]),
		"name": str(definition["name"]),
		"last_known_name": last_known_name,
		"quantity": quantity,
		"challenge_rating": str(content["challenge_rating"]),
		"xp": int(content["xp"]),
		"hit_points": int(content["hit_points"]),
		"armor_class": int(content["armor_class"]),
		"initiative_bonus": int(content["initiative_bonus"]),
	}


func _valid_creature_definition(definition: Dictionary) -> bool:
	if not definition.get("content", null) is Dictionary:
		return false
	var content: Dictionary = definition["content"]
	return (
		definition.get("definition_id", null) is String
		and definition.get("name", null) is String
		and content.get("challenge_rating", null) is String
		and _positive_integer(content.get("xp", null))
		and _nonnegative_integer(content.get("hit_points", null))
		and _nonnegative_integer(content.get("armor_class", null))
		and _integer(content.get("initiative_bonus", null))
	)


func _integer(value: Variant) -> bool:
	return (value is int or value is float) and is_finite(float(value)) and is_equal_approx(float(value), roundf(float(value)))


func _nonnegative_integer(value: Variant) -> bool:
	return _integer(value) and int(value) >= 0


func _positive_integer(value: Variant) -> bool:
	return _integer(value) and int(value) > 0


func _failure(message: String, status: String = "invalid") -> Dictionary:
	return {"ok": false, "status": status, "error": message}
