class_name FileCampaignRegistry
extends RefCounted

## Installation-scoped Campaign registry backed by immutable, checksummed JSON generations.
## A generation becomes visible only after its complete file has been flushed and renamed.

const FORMAT_ID := "saltmarcher.campaign-registry.v1"
const CAMPAIGN_FORMAT_ID := "saltmarcher.campaign-manifest.v1"
const MAX_NAME_LENGTH := 160

var _data_root: String
var _registry_dir: String
var _campaigns_dir: String


func _init(data_root: String = "user://salt-marcher") -> void:
	_data_root = data_root.trim_suffix("/")
	_registry_dir = _data_root + "/installation/registry"
	_campaigns_dir = _data_root + "/campaigns"


func load_state() -> Dictionary:
	var directory_error := _ensure_directory(_registry_dir)
	if directory_error != OK:
		return _failure("Registry-Verzeichnis konnte nicht geöffnet werden: %s" % error_string(directory_error))

	var generations := _available_generations()
	if generations.is_empty():
		return {
			"ok": true,
			"recovered": false,
			"recovery_message": "",
			"generation": 0,
			"active_campaign_id": "",
			"campaigns": [],
		}

	generations.reverse()
	var rejected := 0
	for generation in generations:
		var candidate := _read_generation(generation)
		if candidate.get("ok", false):
			var state: Dictionary = candidate["state"]
			state["recovered"] = rejected > 0
			state["recovery_message"] = (
				"Die jüngste beschädigte Registry-Version wurde verworfen; Generation %d ist aktiv."
				% generation if rejected > 0 else ""
			)
			return state
		rejected += 1

	return _failure("Keine unverfälschte Campaign-Registry konnte wiederhergestellt werden.")


func create_campaign(raw_name: String) -> Dictionary:
	var name := raw_name.strip_edges()
	if name.is_empty():
		return _operation_failure("Der Name braucht mindestens ein sichtbares Zeichen.")
	if name.length() > MAX_NAME_LENGTH:
		return _operation_failure("Der Name darf höchstens %d Zeichen enthalten." % MAX_NAME_LENGTH)

	var current := load_state()
	if not current.get("ok", false):
		return current

	var campaign_id := _new_campaign_id()
	var campaign_directory := _campaigns_dir + "/" + campaign_id
	var directory_error := _ensure_directory(campaign_directory)
	if directory_error != OK:
		return _operation_failure("Campaign-Verzeichnis konnte nicht erstellt werden: %s" % error_string(directory_error))

	var created_at := Time.get_datetime_string_from_system(true)
	var campaign_payload := {
		"campaign_id": campaign_id,
		"name": name,
		"created_at_utc": created_at,
		"features": {},
	}
	var campaign_manifest := {
		"format": CAMPAIGN_FORMAT_ID,
		"payload": campaign_payload,
		"payload_sha256": _checksum(campaign_payload),
	}
	var manifest_result := _write_new_json(
		campaign_directory + "/manifest.json",
		campaign_manifest
	)
	if not manifest_result.get("ok", false):
		return manifest_result
	var manifest_validation := _validate_campaign_manifest(campaign_id)
	if not manifest_validation.get("ok", false):
		return manifest_validation

	var campaigns: Array = current["campaigns"].duplicate(true)
	campaigns.append({
		"id": campaign_id,
		"name": name,
		"created_at_utc": created_at,
	})
	_sort_campaigns(campaigns)

	var next_state := {
		"generation": int(current["generation"]) + 1,
		"active_campaign_id": campaign_id,
		"campaigns": campaigns,
	}
	var commit := _commit_generation(next_state)
	if not commit.get("ok", false):
		return commit
	commit["campaign_id"] = campaign_id
	commit["status"] = "created"
	return commit


func activate_campaign(campaign_id: String, expected_generation: int) -> Dictionary:
	var current := load_state()
	if not current.get("ok", false):
		return current
	if int(current["generation"]) != expected_generation:
		return {
			"ok": false,
			"status": "stale",
			"error": "Die Campaign-Liste wurde inzwischen geändert. Bitte erneut auswählen.",
			"state": current,
		}
	if not _contains_campaign(current["campaigns"], campaign_id):
		return _operation_failure("Die ausgewählte Campaign existiert nicht mehr.")
	if current["active_campaign_id"] == campaign_id:
		return {"ok": true, "status": "unchanged", "state": current}

	var next_state := {
		"generation": expected_generation + 1,
		"active_campaign_id": campaign_id,
		"campaigns": current["campaigns"].duplicate(true),
	}
	var commit := _commit_generation(next_state)
	if commit.get("ok", false):
		commit["status"] = "activated"
	return commit


func generation_path(generation: int) -> String:
	return _registry_dir + "/generation-%020d.json" % generation


func campaign_manifest_path(campaign_id: String) -> String:
	return _campaigns_dir + "/" + campaign_id + "/manifest.json"


func _available_generations() -> Array[int]:
	var result: Array[int] = []
	var directory := DirAccess.open(_absolute(_registry_dir))
	if directory == null:
		return result
	directory.list_dir_begin()
	var file_name := directory.get_next()
	while not file_name.is_empty():
		if not directory.current_is_dir() and file_name.begins_with("generation-") and file_name.ends_with(".json"):
			var raw_generation := file_name.trim_prefix("generation-").trim_suffix(".json")
			if raw_generation.is_valid_int():
				result.append(raw_generation.to_int())
		file_name = directory.get_next()
	directory.list_dir_end()
	result.sort()
	return result


func _read_generation(generation: int) -> Dictionary:
	var file := FileAccess.open(_absolute(generation_path(generation)), FileAccess.READ)
	if file == null:
		return _failure("Registry-Generation %d ist nicht lesbar." % generation)
	var raw := file.get_as_text()
	file.close()
	var parser := JSON.new()
	if parser.parse(raw) != OK:
		return _failure("Registry-Generation %d enthält kein gültiges JSON." % generation)
	var decoded = parser.data
	if not decoded is Dictionary:
		return _failure("Registry-Generation %d enthält kein gültiges Dokument." % generation)
	if decoded.get("format", "") != FORMAT_ID:
		return _failure("Registry-Generation %d hat ein unbekanntes Format." % generation)
	var payload = decoded.get("payload")
	if not payload is Dictionary:
		return _failure("Registry-Generation %d enthält keinen Payload." % generation)
	var expected_checksum := _checksum(payload)
	if decoded.get("payload_sha256", "") != expected_checksum:
		return _failure("Registry-Generation %d hat eine ungültige Prüfsumme." % generation)
	if not str(payload.get("generation", "")).is_valid_int():
		return _failure("Registry-Generation %d hat keine gültige Generation." % generation)
	if str(payload["generation"]).to_int() != generation:
		return _failure("Registry-Dateiname und Inhalt widersprechen sich.")
	var validation := _validate_payload(payload)
	if not validation.get("ok", false):
		return validation
	return {
		"ok": true,
		"state": {
			"ok": true,
			"generation": generation,
			"active_campaign_id": payload["active_campaign_id"],
			"campaigns": payload["campaigns"].duplicate(true),
		},
	}


func _validate_payload(payload: Dictionary) -> Dictionary:
	var campaigns = payload.get("campaigns")
	if not campaigns is Array:
		return _failure("Campaign-Registry enthält keine gültige Campaign-Liste.")
	var known_ids := {}
	for campaign in campaigns:
		if not campaign is Dictionary:
			return _failure("Campaign-Registry enthält einen ungültigen Eintrag.")
		var campaign_id := str(campaign.get("id", ""))
		var name := str(campaign.get("name", "")).strip_edges()
		if campaign_id.is_empty() or name.is_empty() or known_ids.has(campaign_id):
			return _failure("Campaign-Registry enthält eine ungültige oder doppelte Identität.")
		var manifest_validation := _validate_campaign_manifest(campaign_id)
		if not manifest_validation.get("ok", false):
			return manifest_validation
		known_ids[campaign_id] = true
	var active_id := str(payload.get("active_campaign_id", ""))
	if not active_id.is_empty() and not known_ids.has(active_id):
		return _failure("Die aktive Campaign verweist auf keine registrierte Campaign.")
	return {"ok": true}


func _validate_campaign_manifest(campaign_id: String) -> Dictionary:
	var path := _absolute(campaign_manifest_path(campaign_id))
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return _failure("Campaign %s fehlt auf dem Datenträger." % campaign_id)
	var parser := JSON.new()
	var parse_error := parser.parse(file.get_as_text())
	file.close()
	if parse_error != OK or not parser.data is Dictionary:
		return _failure("Campaign %s hat kein gültiges Manifest." % campaign_id)
	var manifest: Dictionary = parser.data
	if manifest.get("format", "") != CAMPAIGN_FORMAT_ID:
		return _failure("Campaign %s hat ein unbekanntes Format." % campaign_id)
	var payload = manifest.get("payload")
	if not payload is Dictionary:
		return _failure("Campaign %s hat keinen gültigen Manifest-Payload." % campaign_id)
	if manifest.get("payload_sha256", "") != _checksum(payload):
		return _failure("Campaign %s hat eine ungültige Manifest-Prüfsumme." % campaign_id)
	if payload.get("campaign_id", "") != campaign_id:
		return _failure("Campaign-Verzeichnis und Manifest-Identität widersprechen sich.")
	if str(payload.get("name", "")).strip_edges().is_empty():
		return _failure("Campaign %s hat keinen gültigen Namen." % campaign_id)
	return {"ok": true}


func _commit_generation(state: Dictionary) -> Dictionary:
	var payload := {
		"generation": str(state["generation"]),
		"active_campaign_id": state["active_campaign_id"],
		"campaigns": state["campaigns"],
	}
	var envelope := {
		"format": FORMAT_ID,
		"payload": payload,
		"payload_sha256": _checksum(payload),
	}
	var result := _write_new_json(generation_path(int(state["generation"])), envelope)
	if not result.get("ok", false):
		return result
	var committed := load_state()
	if not committed.get("ok", false) or int(committed.get("generation", -1)) != int(state["generation"]):
		return _operation_failure("Die neue Registry-Generation konnte nicht bestätigt werden.")
	return {"ok": true, "state": committed}


func _write_new_json(path: String, value: Dictionary) -> Dictionary:
	var absolute_path := _absolute(path)
	if FileAccess.file_exists(absolute_path):
		return _operation_failure("Ein unveränderliches Persistenzdokument würde überschrieben.")
	var temporary_path := absolute_path + ".pending-%s" % _new_campaign_id()
	var file := FileAccess.open(temporary_path, FileAccess.WRITE)
	if file == null:
		return _operation_failure("Persistenzdokument konnte nicht geschrieben werden: %s" % error_string(FileAccess.get_open_error()))
	file.store_string(JSON.stringify(value, "  ", true, true) + "\n")
	file.flush()
	var write_error := file.get_error()
	file.close()
	if write_error != OK:
		return _operation_failure("Persistenzdokument konnte nicht vollständig geschrieben werden: %s" % error_string(write_error))
	var rename_error := DirAccess.rename_absolute(temporary_path, absolute_path)
	if rename_error != OK:
		return _operation_failure("Persistenzdokument konnte nicht veröffentlicht werden: %s" % error_string(rename_error))
	return {"ok": true}


func _checksum(payload: Dictionary) -> String:
	return JSON.stringify(payload, "", true, true).sha256_text()


func _new_campaign_id() -> String:
	var bytes := Crypto.new().generate_random_bytes(16)
	bytes[6] = (bytes[6] & 0x0f) | 0x40
	bytes[8] = (bytes[8] & 0x3f) | 0x80
	var value := bytes.hex_encode()
	return "%s-%s-%s-%s-%s" % [
		value.substr(0, 8),
		value.substr(8, 4),
		value.substr(12, 4),
		value.substr(16, 4),
		value.substr(20, 12),
	]


func _sort_campaigns(campaigns: Array) -> void:
	campaigns.sort_custom(func(left: Dictionary, right: Dictionary) -> bool:
		var left_name := str(left["name"]).to_lower()
		var right_name := str(right["name"]).to_lower()
		return left_name < right_name or (left_name == right_name and str(left["id"]) < str(right["id"]))
	)


func _contains_campaign(campaigns: Array, campaign_id: String) -> bool:
	for campaign in campaigns:
		if campaign is Dictionary and campaign.get("id", "") == campaign_id:
			return true
	return false


func _ensure_directory(path: String) -> Error:
	return DirAccess.make_dir_recursive_absolute(_absolute(path))


func _absolute(path: String) -> String:
	return ProjectSettings.globalize_path(path)


func _failure(message: String) -> Dictionary:
	return {"ok": false, "error": message}


func _operation_failure(message: String) -> Dictionary:
	return {"ok": false, "status": "storage_error", "error": message}
