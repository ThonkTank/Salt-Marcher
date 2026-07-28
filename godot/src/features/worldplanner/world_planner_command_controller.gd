class_name WorldPlannerCommandController
extends "res://godot/src/app/campaign_partition_command_controller.gd"

## World Planner command vocabulary over the shared Campaign partition lane.

const WorldPlannerKnowledge = preload("res://godot/src/features/worldplanner/world_planner_knowledge.gd")


func _init(data_root: String, runtime_coordinator) -> void:
	super(
		data_root,
		runtime_coordinator,
		WorldPlannerKnowledge.OWNER,
		Callable(self, "_empty_payload"),
		Callable(self, "_apply_world_planner_command")
	)


func create_record(kind: String, name: String, fields: Dictionary = {}) -> Dictionary:
	return start_command({"operation": "create", "kind": kind, "name": name, "fields": fields.duplicate(true)})


func update_record(record_id: String, fields: Dictionary) -> Dictionary:
	return start_command({"operation": "update", "record_id": record_id, "fields": fields.duplicate(true)})


func trash_record(record_id: String) -> Dictionary:
	return start_command({"operation": "trash", "record_id": record_id})


func restore_record(record_id: String) -> Dictionary:
	return start_command({"operation": "restore", "record_id": record_id})


func _empty_payload() -> Dictionary:
	return WorldPlannerKnowledge.new().empty_payload()


func _apply_world_planner_command(payload: Dictionary, request: Dictionary) -> Dictionary:
	var model := WorldPlannerKnowledge.new()
	match request["operation"]:
		"create":
			return model.create_record(payload, str(request["kind"]), str(request["name"]), request["fields"])
		"update":
			return model.update_record(payload, str(request["record_id"]), request["fields"])
		"trash":
			return model.trash_record(payload, str(request["record_id"]))
		"restore":
			return model.restore_record(payload, str(request["record_id"]))
		_:
			return {"ok": false, "status": "invalid", "error": "Unbekannte World-Planner-Änderung."}
