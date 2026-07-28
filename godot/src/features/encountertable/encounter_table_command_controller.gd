class_name EncounterTableCommandController
extends "res://godot/src/app/campaign_partition_command_controller.gd"

## Encounter Table command vocabulary over the serial Campaign writer.

const EncounterTableKnowledge = preload("res://godot/src/features/encountertable/encounter_table_knowledge.gd")
const WorldPlannerKnowledge = preload("res://godot/src/features/worldplanner/world_planner_knowledge.gd")


func _init(data_root: String, runtime_coordinator) -> void:
	super(
		data_root,
		runtime_coordinator,
		EncounterTableKnowledge.OWNER,
		Callable(self, "_empty_payload"),
		Callable(self, "_apply_encounter_table_command")
	)


func create_table(name: String, description: String, entries: Array) -> Dictionary:
	return start_command({
		"operation": "create",
		"name": name,
		"fields": {
			"description": description,
			"entries": entries.duplicate(true),
		},
	})


func update_table(record_id: String, name: String, description: String, entries: Array) -> Dictionary:
	return start_command({
		"operation": "update",
		"record_id": record_id,
		"fields": {
			"name": name,
			"description": description,
			"entries": entries.duplicate(true),
		},
	})


func trash_table(record_id: String) -> Dictionary:
	return start_command({"operation": "trash", "record_id": record_id})


func restore_table(record_id: String) -> Dictionary:
	return start_command({"operation": "restore", "record_id": record_id})


func _empty_payload() -> Dictionary:
	return EncounterTableKnowledge.new().empty_payload()


func _supporting_payload_factories_for(request: Dictionary) -> Dictionary:
	if request.get("operation", "") in ["trash", "restore"]:
		return {WorldPlannerKnowledge.OWNER: Callable(self, "_empty_world_payload")}
	return {}


func _empty_world_payload() -> Dictionary:
	return WorldPlannerKnowledge.new().empty_payload()


func _apply_encounter_table_command(payload: Dictionary, request: Dictionary) -> Dictionary:
	var model := EncounterTableKnowledge.new()
	match request["operation"]:
		"create":
			return model.create_table(payload, str(request["name"]), request["fields"])
		"update":
			return model.update_table(payload, str(request["record_id"]), request["fields"])
		"trash":
			return model.trash_table(
				payload,
				request.get("supporting_payloads", {}).get(WorldPlannerKnowledge.OWNER, {}),
				str(request["record_id"])
			)
		"restore":
			return model.restore_table(
				payload,
				request.get("supporting_payloads", {}).get(WorldPlannerKnowledge.OWNER, {}),
				str(request["record_id"])
			)
		_:
			return {"ok": false, "status": "invalid", "error": "Unbekannte Encounter-Table-Änderung."}
