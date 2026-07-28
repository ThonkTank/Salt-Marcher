class_name EncounterPlanCommandController
extends "res://godot/src/app/campaign_partition_command_controller.gd"

## Saved Encounter command vocabulary over the serial Campaign writer.

const FileCampaignRegistry = preload("res://godot/src/platform/persistence/file_campaign_registry.gd")
const SharedDefinitionStore = preload("res://godot/src/platform/persistence/shared_definition_store.gd")
const EncounterPlanKnowledge = preload("res://godot/src/features/encounter/encounter_plan_knowledge.gd")

var _encounter_data_root: String


func _init(data_root: String, runtime_coordinator) -> void:
	_encounter_data_root = data_root.trim_suffix("/")
	super(
		data_root,
		runtime_coordinator,
		EncounterPlanKnowledge.OWNER,
		Callable(self, "_empty_payload"),
		Callable(self, "_apply_encounter_plan_command")
	)


func create_plan(name: String, roster: Array) -> Dictionary:
	return start_command({
		"operation": "create",
		"name": name,
		"roster": roster.duplicate(true),
	})


func update_plan(record_id: String, name: String, roster: Array) -> Dictionary:
	return start_command({
		"operation": "update",
		"record_id": record_id,
		"name": name,
		"roster": roster.duplicate(true),
	})


func trash_plan(record_id: String) -> Dictionary:
	return start_command({"operation": "trash", "record_id": record_id})


func restore_plan(record_id: String) -> Dictionary:
	return start_command({"operation": "restore", "record_id": record_id})


func _empty_payload() -> Dictionary:
	return EncounterPlanKnowledge.new().empty_payload()


func _apply_encounter_plan_command(payload: Dictionary, request: Dictionary) -> Dictionary:
	var model := EncounterPlanKnowledge.new()
	match request["operation"]:
		"create":
			var prepared_create := _resolve_roster(request["roster"], request)
			if not prepared_create.get("ok", false):
				return prepared_create
			return model.create_plan(payload, str(request["name"]), prepared_create["roster"])
		"update":
			var prepared_update := _resolve_roster(request["roster"], request)
			if not prepared_update.get("ok", false):
				return prepared_update
			return model.update_plan(
				payload,
				str(request["record_id"]),
				str(request["name"]),
				prepared_update["roster"]
			)
		"trash":
			return model.trash_plan(payload, str(request["record_id"]))
		"restore":
			return model.restore_plan(payload, str(request["record_id"]))
		_:
			return {"ok": false, "status": "invalid", "error": "Unbekannte Encounter-Plan-Änderung."}


func _resolve_roster(raw_roster: Variant, request: Dictionary) -> Dictionary:
	if not raw_roster is Array or raw_roster.is_empty():
		return {"ok": false, "status": "invalid", "error": "Ein Encounter Plan braucht mindestens ein Monster."}
	var quantities := {}
	var creature_ids: Array = []
	for entry_value in raw_roster:
		if not entry_value is Dictionary:
			return _invalid_roster()
		var creature_id := str(entry_value.get("creature_id", ""))
		var quantity = entry_value.get("quantity", null)
		if creature_id.is_empty() or quantities.has(creature_id) or not quantity is int or int(quantity) <= 0:
			return _invalid_roster()
		quantities[creature_id] = int(quantity)
		creature_ids.append(creature_id)
	var registry_state := FileCampaignRegistry.new(_encounter_data_root).load_state()
	if (
		not registry_state.get("ok", false)
		or registry_state.get("active_campaign_id", "") != request.get("campaign_id", "")
		or int(registry_state.get("generation", -1)) != int(request.get("activation_generation", -2))
	):
		return {
			"ok": false,
			"status": "stale",
			"error": "Die aktive Campaign oder Creature-Generation änderte sich vor dem Speichern.",
		}
	var definitions := SharedDefinitionStore.new(_encounter_data_root).definitions_for_refs(
		creature_ids,
		int(registry_state.get("shared_definitions_generation", 0))
	)
	if not definitions.get("ok", false):
		return {
			"ok": false,
			"status": str(definitions.get("status", "invalid")),
			"error": "Der Encounter-Plan enthält eine fehlende oder beschädigte Creature-Referenz.",
			"cause": definitions,
		}
	var names := {}
	for definition in definitions["definitions"]:
		if definition.get("kind", "") != "creature":
			return _invalid_roster()
		names[str(definition["definition_id"])] = str(definition["name"])
	var roster: Array = []
	for creature_id_value in creature_ids:
		var creature_id := str(creature_id_value)
		roster.append({
			"creature_id": creature_id,
			"quantity": quantities[creature_id],
			"last_known_name": names[creature_id],
		})
	return {"ok": true, "roster": roster}


func _invalid_roster() -> Dictionary:
	return {"ok": false, "status": "invalid", "error": "Encounter-Roster enthält ungültige oder doppelte Monsterzeilen."}
