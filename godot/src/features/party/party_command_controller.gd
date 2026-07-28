class_name PartyCommandController
extends "res://godot/src/app/campaign_partition_command_controller.gd"

## Party command vocabulary over the shared Campaign partition lane.

const PartyRoster = preload("res://godot/src/features/party/party_roster.gd")


func _init(data_root: String, runtime_coordinator) -> void:
	super(
		data_root,
		runtime_coordinator,
		PartyRoster.OWNER,
		Callable(self, "_empty_payload"),
		Callable(self, "_apply_party_command")
	)


func create_character(name: String, fields: Dictionary = {}) -> Dictionary:
	return start_command({"operation": "create", "name": name, "fields": fields.duplicate(true)})


func update_character(character_id: String, name: String, fields: Dictionary = {}) -> Dictionary:
	return start_command({"operation": "update", "character_id": character_id, "name": name, "fields": fields.duplicate(true)})


func adjust_xp(character_ids: Array, delta: int) -> Dictionary:
	return start_command({"operation": "xp", "character_ids": character_ids.duplicate(), "delta": delta})


func perform_rest(rest_type: String) -> Dictionary:
	return start_command({"operation": "rest", "rest_type": rest_type})


func restore_character(character_id: String) -> Dictionary:
	return start_command({"operation": "restore", "character_id": character_id})


func _empty_payload() -> Dictionary:
	return PartyRoster.new().empty_payload()


func _apply_party_command(payload: Dictionary, request: Dictionary) -> Dictionary:
	var model := PartyRoster.new()
	match request["operation"]:
		"create":
			return model.create_character(payload, str(request["name"]), request["fields"])
		"update":
			return model.update_character(payload, str(request["character_id"]), str(request["name"]), request["fields"])
		"xp":
			return model.adjust_xp(payload, request["character_ids"], int(request["delta"]))
		"rest":
			return model.perform_rest(payload, str(request["rest_type"]))
		"restore":
			return model.restore_character(payload, str(request["character_id"]))
		_:
			return {"ok": false, "status": "invalid", "error": "Unbekannte Party-Änderung."}
