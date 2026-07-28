class_name EncounterGeneratedBatchCommandController
extends "res://godot/src/app/campaign_partition_command_controller.gd"

## Serial Campaign writer for one complete prepared Encounter batch.

const EncounterPlanKnowledge = preload("res://godot/src/features/encounter/encounter_plan_knowledge.gd")


func _init(data_root: String, runtime_coordinator) -> void:
	super(
		data_root,
		runtime_coordinator,
		EncounterPlanKnowledge.OWNER,
		Callable(self, "_empty_payload"),
		Callable(self, "_apply_generated_batch_command")
	)


func commit_prepared_batch(batch: Dictionary) -> Dictionary:
	return start_command({"operation": "commit_generated_batch", "batch": batch.duplicate(true)})


func _empty_payload() -> Dictionary:
	return EncounterPlanKnowledge.new().empty_payload()


func _apply_generated_batch_command(payload: Dictionary, request: Dictionary) -> Dictionary:
	if request.get("operation", "") != "commit_generated_batch":
		return {"ok": false, "status": "INVALID_REQUEST", "error": "Unbekannte Generated-Encounter-Änderung."}
	return EncounterPlanKnowledge.new().commit_generated_batch(payload, request.get("batch", {}))
