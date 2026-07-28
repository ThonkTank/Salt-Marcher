class_name SessionGenerationRunCommandController
extends "res://godot/src/app/campaign_partition_command_controller.gd"

## Serial Campaign writer for one complete immutable Session Generation run.

const SessionGenerationRunKnowledge = preload("res://godot/src/features/sessiongeneration/session_generation_run_knowledge.gd")


func _init(data_root: String, runtime_coordinator) -> void:
	super(
		data_root,
		runtime_coordinator,
		SessionGenerationRunKnowledge.OWNER,
		Callable(self, "_empty_payload"),
		Callable(self, "_apply_commit_command")
	)


func commit_run(run: Dictionary) -> Dictionary:
	return start_command({"operation": "commit_run", "run": run.duplicate(true)})


func _empty_payload() -> Dictionary:
	return SessionGenerationRunKnowledge.new().empty_payload()


func _apply_commit_command(payload: Dictionary, request: Dictionary) -> Dictionary:
	if request.get("operation", "") != "commit_run":
		return {"ok": false, "status": "INVALID_REQUEST", "error": "Unbekannte Session-Generation-Änderung."}
	return SessionGenerationRunKnowledge.new().commit_run(payload, request.get("run", {}))
