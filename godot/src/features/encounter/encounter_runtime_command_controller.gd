class_name EncounterRuntimeCommandController
extends "res://godot/src/app/campaign_partition_command_controller.gd"

## Encounter runtime commands over the same owner partition as saved plans.

const FileCampaignRegistry = preload("res://godot/src/platform/persistence/file_campaign_registry.gd")
const SharedDefinitionStore = preload("res://godot/src/platform/persistence/shared_definition_store.gd")
const EncounterPlanKnowledge = preload("res://godot/src/features/encounter/encounter_plan_knowledge.gd")
const EncounterRuntimeKnowledge = preload("res://godot/src/features/encounter/encounter_runtime_knowledge.gd")
const EncounterGenerationPolicy = preload("res://godot/src/features/encounter/encounter_generation_policy.gd")
const EncounterTableKnowledge = preload("res://godot/src/features/encountertable/encounter_table_knowledge.gd")
const PartyRoster = preload("res://godot/src/features/party/party_roster.gd")
const SceneKnowledge = preload("res://godot/src/features/scene/scene_knowledge.gd")
const WorldPlannerKnowledge = preload("res://godot/src/features/worldplanner/world_planner_knowledge.gd")

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


func add_creature(creature_id: String, context_id: String = EncounterRuntimeKnowledge.MANUAL_CONTEXT_ID) -> Dictionary:
	return start_command({"operation": "add_creature", "creature_id": creature_id, "context_id": context_id})


func adjust_roster_quantity(slot_id: String, delta: int, context_id: String = EncounterRuntimeKnowledge.MANUAL_CONTEXT_ID) -> Dictionary:
	return start_command({"operation": "adjust_roster_quantity", "slot_id": slot_id, "delta": delta, "context_id": context_id})


func remove_roster_slot(slot_id: String, context_id: String = EncounterRuntimeKnowledge.MANUAL_CONTEXT_ID) -> Dictionary:
	return start_command({"operation": "remove_roster_slot", "slot_id": slot_id, "context_id": context_id})


func undo_roster_removal(context_id: String = EncounterRuntimeKnowledge.MANUAL_CONTEXT_ID) -> Dictionary:
	return start_command({"operation": "undo_roster_removal", "context_id": context_id})


func update_pool_filters(pool_filters: Dictionary, context_id: String = EncounterRuntimeKnowledge.MANUAL_CONTEXT_ID) -> Dictionary:
	return start_command({"operation": "update_pool_filters", "pool_filters": pool_filters.duplicate(true), "context_id": context_id})


func update_catalog_filters(catalog_filters: Dictionary, context_id: String = EncounterRuntimeKnowledge.MANUAL_CONTEXT_ID) -> Dictionary:
	return start_command({"operation": "update_catalog_filters", "catalog_filters": catalog_filters.duplicate(true), "context_id": context_id})


func update_source_filters(source_filters: Dictionary, context_id: String = EncounterRuntimeKnowledge.MANUAL_CONTEXT_ID) -> Dictionary:
	return start_command({"operation": "update_source_filters", "source_filters": source_filters.duplicate(true), "context_id": context_id})


func update_tuning(tuning: Dictionary, context_id: String = EncounterRuntimeKnowledge.MANUAL_CONTEXT_ID) -> Dictionary:
	return start_command({"operation": "update_tuning", "tuning": tuning.duplicate(true), "context_id": context_id})


func generate_alternatives(tuning: Dictionary, context_id: String = EncounterRuntimeKnowledge.MANUAL_CONTEXT_ID) -> Dictionary:
	return start_command({"operation": "generate_alternatives", "tuning": tuning.duplicate(true), "context_id": context_id})


func select_generated_alternative(index: int, context_id: String = EncounterRuntimeKnowledge.MANUAL_CONTEXT_ID) -> Dictionary:
	return start_command({"operation": "select_generated_alternative", "index": index, "context_id": context_id})


func clear_generation_history(context_id: String = EncounterRuntimeKnowledge.MANUAL_CONTEXT_ID) -> Dictionary:
	return start_command({"operation": "clear_generation_history", "context_id": context_id})


func save_current_plan(name: String, context_id: String = EncounterRuntimeKnowledge.MANUAL_CONTEXT_ID) -> Dictionary:
	return start_command({"operation": "save_current_plan", "name": name, "context_id": context_id})


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


func _empty_encounter_table_payload() -> Dictionary:
	return EncounterTableKnowledge.new().empty_payload()


func _empty_world_planner_payload() -> Dictionary:
	return WorldPlannerKnowledge.new().empty_payload()


func _supporting_payload_factories_for(request: Dictionary) -> Dictionary:
	var factories := {
		PartyRoster.OWNER: Callable(self, "_empty_party_payload"),
		SceneKnowledge.OWNER: Callable(self, "_empty_scene_payload"),
	}
	if request.get("operation", "") == "generate_alternatives":
		factories[EncounterTableKnowledge.OWNER] = Callable(self, "_empty_encounter_table_payload")
		factories[WorldPlannerKnowledge.OWNER] = Callable(self, "_empty_world_planner_payload")
	return factories


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
		"add_creature":
			var prepared := _prepare_creature(str(request["creature_id"]), request)
			if not prepared.get("ok", false):
				return prepared
			result = model.add_creature(payload, prepared["creature"], context_id)
		"adjust_roster_quantity":
			result = model.adjust_roster_quantity(payload, str(request["slot_id"]), int(request["delta"]), context_id)
		"remove_roster_slot":
			result = model.remove_roster_slot(payload, str(request["slot_id"]), context_id)
		"undo_roster_removal":
			result = model.undo_roster_removal(payload, context_id)
		"update_pool_filters":
			result = model.update_pool_filters(payload, request["pool_filters"], context_id)
		"update_catalog_filters":
			result = model.update_catalog_filters(payload, request["catalog_filters"], context_id)
		"update_source_filters":
			result = model.update_source_filters(payload, request["source_filters"], context_id)
		"update_tuning":
			result = model.update_tuning(payload, request["tuning"], context_id)
		"generate_alternatives":
			return _generate_alternatives(payload, request, context_id)
		"select_generated_alternative":
			result = model.select_generated_alternative(payload, int(request["index"]), context_id)
		"clear_generation_history":
			result = model.clear_generation_history(payload, context_id)
		"save_current_plan":
			return _save_current_plan(payload, request, context_id)
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


func _prepare_creature(creature_id: String, request: Dictionary) -> Dictionary:
	var registry_state := FileCampaignRegistry.new(_encounter_data_root).load_state()
	if (
		not registry_state.get("ok", false)
		or registry_state.get("active_campaign_id", "") != request.get("campaign_id", "")
		or int(registry_state.get("generation", -1)) != int(request.get("activation_generation", -2))
	):
		return {"ok": false, "status": "stale", "error": "Die aktive Campaign änderte sich vor der Encounter-Übergabe."}
	var definitions := SharedDefinitionStore.new(_encounter_data_root).definitions_for_refs(
		[creature_id],
		int(registry_state.get("shared_definitions_generation", 0))
	)
	if not definitions.get("ok", false) or definitions.get("definitions", []).size() != 1:
		return {"ok": false, "status": str(definitions.get("status", "missing")), "error": "Das gewählte Monster fehlt im aktuellen Creature-Katalog."}
	var definition: Dictionary = definitions["definitions"][0]
	var content = definition.get("content", null)
	if definition.get("kind", "") != "creature" or not content is Dictionary or not _valid_creature_content(content):
		return _invalid_creature()
	var confirmed := FileCampaignRegistry.new(_encounter_data_root).load_state()
	if (
		not confirmed.get("ok", false)
		or confirmed.get("active_campaign_id", "") != request.get("campaign_id", "")
		or int(confirmed.get("generation", -1)) != int(request.get("activation_generation", -2))
		or int(confirmed.get("shared_definitions_generation", -1)) != int(registry_state.get("shared_definitions_generation", -2))
	):
		return {"ok": false, "status": "stale", "error": "Die aktive Campaign oder Creature-Generation änderte sich während der Encounter-Übergabe."}
	return {"ok": true, "creature": {
		"creature_id": str(definition["definition_id"]),
		"name": str(definition["name"]),
		"last_known_name": str(definition["name"]),
		"quantity": 1,
		"challenge_rating": str(content["challenge_rating"]),
		"xp": int(content["xp"]),
		"hit_points": int(content["hit_points"]),
		"armor_class": int(content["armor_class"]),
		"initiative_bonus": int(content["initiative_bonus"]),
	}}


func _generate_alternatives(payload: Dictionary, request: Dictionary, context_id: String) -> Dictionary:
	var runtime := EncounterRuntimeKnowledge.new()
	var tuning_update := runtime.update_tuning(payload, request["tuning"], context_id)
	if not tuning_update.get("ok", false):
		return tuning_update
	var working_payload: Dictionary = tuning_update.get("payload", payload)
	var runtime_snapshot := runtime.snapshot(working_payload, context_id)
	if not runtime_snapshot.get("ok", false) or runtime_snapshot["context"]["mode"] != "builder":
		return {"ok": false, "status": "invalid", "error": "Encounter-Vorschläge können nur in der manuellen Aufstellung erzeugt werden."}
	var party := _active_party(request, context_id)
	if not party.get("ok", false):
		return party
	var levels: Array = []
	for member in party["active"]:
		if member.get("level") == null:
			return {"ok": false, "status": "UNRESOLVABLE", "error": "Jedes aktive Party-Mitglied braucht für die Generierung eine Stufe."}
		levels.append(int(member["level"]))
	var registry_state := FileCampaignRegistry.new(_encounter_data_root).load_state()
	if (
		not registry_state.get("ok", false)
		or registry_state.get("active_campaign_id", "") != request.get("campaign_id", "")
		or int(registry_state.get("generation", -1)) != int(request.get("activation_generation", -2))
	):
		return {"ok": false, "status": "stale", "error": "Die aktive Campaign änderte sich vor der Encounter-Generierung."}
	var definitions := SharedDefinitionStore.new(_encounter_data_root).definitions_of_kind(
		int(registry_state.get("shared_definitions_generation", 0)), "creature"
	)
	if not definitions.get("ok", false):
		return definitions
	var builder_inputs: Dictionary = runtime_snapshot["context"]["builder_inputs"]
	var source_constraints := _generation_source_constraints(builder_inputs["pool_filters"], request)
	if not source_constraints.get("ok", false):
		return source_constraints
	var policy_request: Dictionary = builder_inputs.duplicate(true)
	policy_request["source_constraints"] = source_constraints["source_constraints"]
	var generated := EncounterGenerationPolicy.new().generate_alternatives(
		levels,
		definitions.get("definitions", []),
		policy_request
	)
	if not generated.get("ok", false):
		return generated
	var confirmed := FileCampaignRegistry.new(_encounter_data_root).load_state()
	if (
		not confirmed.get("ok", false)
		or confirmed.get("active_campaign_id", "") != request.get("campaign_id", "")
		or int(confirmed.get("generation", -1)) != int(request.get("activation_generation", -2))
		or int(confirmed.get("shared_definitions_generation", -1)) != int(registry_state.get("shared_definitions_generation", -2))
	):
		return {"ok": false, "status": "stale", "error": "Die aktive Campaign oder Creature-Generation änderte sich während der Encounter-Generierung."}
	return _validated_result(runtime.apply_generated_alternatives(
		working_payload,
		generated["alternatives"],
		generated["diagnostics"],
		context_id
	))


func _generation_source_constraints(pool_filters: Dictionary, request: Dictionary) -> Dictionary:
	var direct_table_ids: Array = pool_filters["encounter_table_ids"].duplicate()
	var selected_faction_ids: Array = pool_filters["faction_ids"].duplicate()
	var location_id := str(pool_filters["location_id"])
	var source_active := not direct_table_ids.is_empty() or not selected_faction_ids.is_empty() or not location_id.is_empty()
	if not source_active:
		return {"ok": true, "source_constraints": {
			"active": false,
			"allowed_creature_ids": [],
			"weights": {},
			"maximum_quantities": {},
			"table_ids": [],
			"faction_ids": [],
			"location_id": "",
			"linked_loot_table_ids": [],
			"loot_conflict": false,
		}}
	var supporting: Dictionary = request.get("supporting_payloads", {})
	var world := WorldPlannerKnowledge.new().generation_sources(
		supporting.get(WorldPlannerKnowledge.OWNER, WorldPlannerKnowledge.new().empty_payload()),
		selected_faction_ids,
		location_id
	)
	if not world.get("ok", false):
		return world
	var world_constrained := bool(world["constrained"])
	var effective_table_ids: Array = []
	if not direct_table_ids.is_empty() and world_constrained:
		for table_id in direct_table_ids:
			if table_id in world["table_ids"]:
				effective_table_ids.append(table_id)
	elif not direct_table_ids.is_empty():
		effective_table_ids = direct_table_ids
	else:
		effective_table_ids = world["table_ids"].duplicate()
	effective_table_ids.sort()
	if effective_table_ids.is_empty():
		return {"ok": false, "status": "NO_CREATURES", "error": "Die gewählten Tabellen-, Fraktions- und Ortsquellen besitzen keine gemeinsame Encounter-Tabelle."}
	var table_source := EncounterTableKnowledge.new().generation_source(
		supporting.get(EncounterTableKnowledge.OWNER, EncounterTableKnowledge.new().empty_payload()),
		effective_table_ids
	)
	if not table_source.get("ok", false):
		return table_source
	if table_source["creature_ids"].is_empty():
		return {"ok": false, "status": "NO_CREATURES", "error": "Die gewählten Encounter-Tabellen enthalten keine Monster."}
	return {"ok": true, "source_constraints": {
		"active": true,
		"allowed_creature_ids": table_source["creature_ids"],
		"weights": table_source["weights"],
		"maximum_quantities": world["stock_limits"],
		"table_ids": effective_table_ids,
		"faction_ids": world["faction_ids"],
		"location_id": location_id,
		"linked_loot_table_ids": table_source["linked_loot_table_ids"],
		"loot_conflict": table_source["loot_conflict"],
	}}


func _save_current_plan(payload: Dictionary, request: Dictionary, context_id: String) -> Dictionary:
	var runtime := EncounterRuntimeKnowledge.new()
	var runtime_snapshot := runtime.snapshot(payload, context_id)
	if not runtime_snapshot.get("ok", false):
		return runtime_snapshot
	var context: Dictionary = runtime_snapshot["context"]
	if context_id != EncounterRuntimeKnowledge.MANUAL_CONTEXT_ID or context["mode"] != "builder" or context["roster"].is_empty():
		return {"ok": false, "status": "invalid", "error": "Nur eine nicht leere manuelle Aufstellung kann gespeichert werden."}
	var registry_state := FileCampaignRegistry.new(_encounter_data_root).load_state()
	if (
		not registry_state.get("ok", false)
		or registry_state.get("active_campaign_id", "") != request.get("campaign_id", "")
		or int(registry_state.get("generation", -1)) != int(request.get("activation_generation", -2))
	):
		return {"ok": false, "status": "stale", "error": "Die aktive Campaign änderte sich vor dem Speichern der Aufstellung."}
	var creature_ids: Array = []
	for entry in context["roster"]:
		creature_ids.append(str(entry["creature_id"]))
	var definitions := SharedDefinitionStore.new(_encounter_data_root).definitions_for_refs(
		creature_ids,
		int(registry_state.get("shared_definitions_generation", 0))
	)
	if not definitions.get("ok", false) or definitions.get("definitions", []).size() != creature_ids.size():
		return {"ok": false, "status": "missing", "error": "Die aktuelle Aufstellung verweist auf fehlende Creature-Fakten."}
	var current_names := {}
	for definition in definitions["definitions"]:
		if definition.get("kind", "") != "creature":
			return _invalid_creature()
		current_names[str(definition["definition_id"])] = str(definition["name"])
	var confirmed := FileCampaignRegistry.new(_encounter_data_root).load_state()
	if (
		not confirmed.get("ok", false)
		or confirmed.get("active_campaign_id", "") != request.get("campaign_id", "")
		or int(confirmed.get("generation", -1)) != int(request.get("activation_generation", -2))
		or int(confirmed.get("shared_definitions_generation", -1)) != int(registry_state.get("shared_definitions_generation", -2))
	):
		return {"ok": false, "status": "stale", "error": "Die aktive Campaign oder Creature-Generation änderte sich während des Speicherns."}
	var saved_roster: Array = []
	for entry in context["roster"]:
		saved_roster.append({
			"creature_id": entry["creature_id"],
			"quantity": int(entry["quantity"]),
			"last_known_name": current_names[str(entry["creature_id"])],
		})
	var generated_label := ""
	var generation: Dictionary = context["generation"]
	if not generation["alternatives"].is_empty():
		generated_label = str(generation["alternatives"][int(generation["selected_index"])]["label"])
	var created := EncounterPlanKnowledge.new().create_plan(
		payload,
		str(request.get("name", "")),
		saved_roster,
		"",
		"",
		generated_label
	)
	if not created.get("ok", false):
		return created
	var marked := runtime.mark_current_saved(
		created["payload"], str(created["record"]["record_id"]), context_id
	)
	if marked.get("ok", false):
		marked["record"] = created["record"]
	return _validated_result(marked)


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
