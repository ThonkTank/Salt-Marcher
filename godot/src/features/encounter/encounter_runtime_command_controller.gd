class_name EncounterRuntimeCommandController
extends "res://godot/src/app/campaign_partition_command_controller.gd"

## Encounter runtime commands over the same owner partition as saved plans.

const FileCampaignRegistry = preload("res://godot/src/platform/persistence/file_campaign_registry.gd")
const SharedDefinitionStore = preload("res://godot/src/platform/persistence/shared_definition_store.gd")
const EncounterPlanKnowledge = preload("res://godot/src/features/encounter/encounter_plan_knowledge.gd")
const EncounterRuntimeKnowledge = preload("res://godot/src/features/encounter/encounter_runtime_knowledge.gd")
const PartyRoster = preload("res://godot/src/features/party/party_roster.gd")
const SceneKnowledge = preload("res://godot/src/features/scene/scene_knowledge.gd")

var _encounter_data_root: String


func _init(data_root: String, runtime_coordinator) -> void:
	_encounter_data_root = data_root.trim_suffix("/")
	super(
		data_root,
		runtime_coordinator,
		EncounterPlanKnowledge.OWNER,
		Callable(self, "_empty_payload"),
		Callable(self, "_apply_runtime_command")
	)


func open_saved_plan(plan_id: String, context_id: String = EncounterRuntimeKnowledge.MANUAL_CONTEXT_ID) -> Dictionary:
	return start_command({"operation": "open_plan", "plan_id": plan_id, "context_id": context_id})


func open_initiative(context_id: String = EncounterRuntimeKnowledge.MANUAL_CONTEXT_ID) -> Dictionary:
	return start_command({"operation": "open_initiative", "context_id": context_id})


func set_initiative(combatant_id: String, value: int, context_id: String = EncounterRuntimeKnowledge.MANUAL_CONTEXT_ID) -> Dictionary:
	return start_command({"operation": "set_initiative", "combatant_id": combatant_id, "value": value, "context_id": context_id})


func roll_all_initiative(rolls: Dictionary, context_id: String = EncounterRuntimeKnowledge.MANUAL_CONTEXT_ID) -> Dictionary:
	return start_command({"operation": "roll_all", "rolls": rolls.duplicate(true), "context_id": context_id})


func confirm_initiative(context_id: String = EncounterRuntimeKnowledge.MANUAL_CONTEXT_ID) -> Dictionary:
	return start_command({"operation": "confirm_initiative", "context_id": context_id})


func advance_turn(context_id: String = EncounterRuntimeKnowledge.MANUAL_CONTEXT_ID) -> Dictionary:
	return start_command({"operation": "advance_turn", "context_id": context_id})


func mutate_hp(combatant_id: String, amount: int, healing: bool, context_id: String = EncounterRuntimeKnowledge.MANUAL_CONTEXT_ID) -> Dictionary:
	return start_command({
		"operation": "mutate_hp",
		"combatant_id": combatant_id,
		"amount": amount,
		"healing": healing,
		"context_id": context_id,
	})


func set_combat_initiative(combatant_id: String, value: int, context_id: String = EncounterRuntimeKnowledge.MANUAL_CONTEXT_ID) -> Dictionary:
	return start_command({"operation": "set_combat_initiative", "combatant_id": combatant_id, "value": value, "context_id": context_id})


func end_combat(context_id: String = EncounterRuntimeKnowledge.MANUAL_CONTEXT_ID) -> Dictionary:
	return start_command({"operation": "end_combat", "context_id": context_id})


func award_xp(context_id: String = EncounterRuntimeKnowledge.MANUAL_CONTEXT_ID) -> Dictionary:
	return start_command({"operation": "award_xp", "context_id": context_id})


func return_to_builder(context_id: String = EncounterRuntimeKnowledge.MANUAL_CONTEXT_ID) -> Dictionary:
	return start_command({"operation": "return_to_builder", "context_id": context_id})


func _empty_payload() -> Dictionary:
	return EncounterPlanKnowledge.new().empty_payload()


func _empty_party_payload() -> Dictionary:
	return PartyRoster.new().empty_payload()


func _empty_scene_payload() -> Dictionary:
	return SceneKnowledge.new().empty_payload()


func _supporting_payload_factories_for(_request: Dictionary) -> Dictionary:
	return {
		PartyRoster.OWNER: Callable(self, "_empty_party_payload"),
		SceneKnowledge.OWNER: Callable(self, "_empty_scene_payload"),
	}


func _apply_runtime_command(payload: Dictionary, request: Dictionary) -> Dictionary:
	var owner_validation := EncounterPlanKnowledge.new().validate_payload(payload)
	if not owner_validation.get("ok", false):
		return owner_validation
	payload = owner_validation["payload"]
	var model := EncounterRuntimeKnowledge.new()
	var context_id := str(request.get("context_id", EncounterRuntimeKnowledge.MANUAL_CONTEXT_ID))
	var result: Dictionary
	match request["operation"]:
		"open_plan":
			var prepared := _prepare_plan_roster(payload, str(request["plan_id"]), request)
			if not prepared.get("ok", false):
				return prepared
			result = model.open_saved_plan(payload, str(request["plan_id"]), prepared["roster"], context_id)
		"open_initiative":
			var party := _active_party(request, context_id)
			if not party.get("ok", false):
				return party
			result = model.open_initiative(payload, party["active"], context_id)
		"set_initiative":
			result = model.set_initiative(payload, str(request["combatant_id"]), int(request["value"]), context_id)
		"roll_all":
			result = model.roll_all_initiative(payload, request["rolls"], context_id)
		"confirm_initiative":
			result = model.confirm_initiative(payload, context_id)
		"advance_turn":
			result = model.advance_turn(payload, context_id)
		"mutate_hp":
			result = model.mutate_hp(payload, str(request["combatant_id"]), int(request["amount"]), bool(request["healing"]), context_id)
		"set_combat_initiative":
			result = model.set_combat_initiative(payload, str(request["combatant_id"]), int(request["value"]), context_id)
		"end_combat":
			result = model.end_combat(payload, context_id)
		"award_xp":
			return _award_xp(payload, request)
		"return_to_builder":
			result = model.return_to_builder(payload, context_id)
		_:
			return {"ok": false, "status": "invalid", "error": "Unbekannte Encounter-Laufzeitänderung."}
	return _validated_result(result)


func _prepare_plan_roster(payload: Dictionary, plan_id: String, request: Dictionary) -> Dictionary:
	var plan := EncounterPlanKnowledge.new().read_plan(payload, plan_id)
	if not plan.get("ok", false):
		return plan
	var registry_state := FileCampaignRegistry.new(_encounter_data_root).load_state()
	if (
		not registry_state.get("ok", false)
		or registry_state.get("active_campaign_id", "") != request.get("campaign_id", "")
		or int(registry_state.get("generation", -1)) != int(request.get("activation_generation", -2))
	):
		return {"ok": false, "status": "stale", "error": "Die aktive Campaign änderte sich vor dem Öffnen des Encounters."}
	var creature_ids: Array = []
	for roster_entry in plan["record"]["roster"]:
		creature_ids.append(str(roster_entry["creature_id"]))
	var definitions := SharedDefinitionStore.new(_encounter_data_root).definitions_for_refs(
		creature_ids,
		int(registry_state.get("shared_definitions_generation", 0))
	)
	if not definitions.get("ok", false):
		return {"ok": false, "status": str(definitions.get("status", "invalid")), "error": "Der Encounter enthält eine fehlende oder beschädigte Creature.", "cause": definitions}
	var definitions_by_id := {}
	for definition_value in definitions["definitions"]:
		var definition: Dictionary = definition_value
		if definition.get("kind", "") != "creature" or not definition.get("content", null) is Dictionary:
			return _invalid_creature()
		definitions_by_id[str(definition["definition_id"])] = definition
	var prepared_roster: Array = []
	for saved_entry in plan["record"]["roster"]:
		var creature_id := str(saved_entry["creature_id"])
		var definition: Dictionary = definitions_by_id[creature_id]
		var content: Dictionary = definition["content"]
		if not _valid_creature_content(content):
			return _invalid_creature()
		prepared_roster.append({
			"creature_id": creature_id,
			"name": str(definition["name"]),
			"last_known_name": str(saved_entry["last_known_name"]),
			"quantity": int(saved_entry["quantity"]),
			"challenge_rating": str(content["challenge_rating"]),
			"xp": int(content["xp"]),
			"hit_points": int(content["hit_points"]),
			"armor_class": int(content["armor_class"]),
			"initiative_bonus": int(content["initiative_bonus"]),
		})
	var confirmed_registry := FileCampaignRegistry.new(_encounter_data_root).load_state()
	if (
		not confirmed_registry.get("ok", false)
		or confirmed_registry.get("active_campaign_id", "") != request.get("campaign_id", "")
		or int(confirmed_registry.get("generation", -1)) != int(request.get("activation_generation", -2))
		or int(confirmed_registry.get("shared_definitions_generation", -1))
		!= int(registry_state.get("shared_definitions_generation", -2))
	):
		return {"ok": false, "status": "stale", "error": "Die aktive Campaign oder Creature-Generation änderte sich während des Öffnens."}
	return {"ok": true, "roster": prepared_roster}


func _active_party(request: Dictionary, context_id: String) -> Dictionary:
	var party_payload: Dictionary = request.get("supporting_payloads", {}).get(PartyRoster.OWNER, PartyRoster.new().empty_payload())
	var snapshot := PartyRoster.new().snapshot(party_payload, "", false, PartyRoster.MAX_SEARCH_PAGE_SIZE)
	if not snapshot.get("ok", false):
		return snapshot
	if context_id == EncounterRuntimeKnowledge.MANUAL_CONTEXT_ID:
		return {"ok": true, "active": snapshot["active"]}
	var scene_payload: Dictionary = request.get("supporting_payloads", {}).get(SceneKnowledge.OWNER, SceneKnowledge.new().empty_payload())
	var scene_validation := SceneKnowledge.new().validate_payload(scene_payload)
	if not scene_validation.get("ok", false):
		return scene_validation
	var assigned := {}
	for scene_id_value in scene_validation["payload"]["scenes"]:
		var scene: Dictionary = scene_validation["payload"]["scenes"][scene_id_value]
		if SceneKnowledge.new().encounter_context_id(str(scene["scene_id"])) == context_id:
			for character_id in scene["party_member_ids"]:
				assigned[character_id] = true
			break
	var active: Array = []
	for member in snapshot["active"]:
		if assigned.has(member["character_id"]):
			active.append(member.duplicate(true))
	return {"ok": true, "active": active}


func _award_xp(encounter_payload: Dictionary, request: Dictionary) -> Dictionary:
	var runtime := EncounterRuntimeKnowledge.new()
	var context_id := str(request.get("context_id", EncounterRuntimeKnowledge.MANUAL_CONTEXT_ID))
	var snapshot := runtime.snapshot(encounter_payload, context_id)
	if not snapshot.get("ok", false):
		return snapshot
	var result_state: Dictionary = snapshot["context"]["result"]
	if snapshot["context"]["mode"] != "results" or bool(result_state["xp_awarded"]):
		return {"ok": false, "status": "invalid", "error": "Dieses Kampfergebnis kann keine XP mehr verteilen."}
	var party_payload: Dictionary = request.get("supporting_payloads", {}).get(PartyRoster.OWNER, PartyRoster.new().empty_payload())
	var party_change := PartyRoster.new().adjust_xp(
		party_payload,
		result_state["party_member_ids"],
		int(result_state["per_player_xp"])
	)
	if not party_change.get("ok", false):
		return party_change
	var encounter_change := runtime.mark_xp_awarded(encounter_payload, context_id)
	var validated := _validated_result(encounter_change)
	if not validated.get("ok", false):
		return validated
	validated["partition_updates"] = {
		EncounterPlanKnowledge.OWNER: validated["payload"],
		PartyRoster.OWNER: party_change["payload"],
	}
	validated["party_applied_by_id"] = party_change["applied_by_id"]
	return validated


func _validated_result(result: Dictionary) -> Dictionary:
	if not result.get("ok", false):
		return result
	var validation := EncounterPlanKnowledge.new().validate_payload(result.get("payload", null))
	if not validation.get("ok", false):
		return validation
	result["payload"] = validation["payload"]
	return result


func _valid_creature_content(content: Dictionary) -> bool:
	return (
		content.get("challenge_rating", null) is String
		and not str(content["challenge_rating"]).strip_edges().is_empty()
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


func _invalid_creature() -> Dictionary:
	return {"ok": false, "status": "invalid", "error": "Creature-Fakten für den laufenden Encounter sind unvollständig."}
