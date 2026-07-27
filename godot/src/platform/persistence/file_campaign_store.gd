class_name FileCampaignStore
extends RefCounted

## Campaign-scoped immutable generations and owner-isolated partition documents.

const ImmutableJsonFiles = preload("res://godot/src/platform/persistence/immutable_json_files.gd")

const IDENTITY_FORMAT_ID := "saltmarcher.campaign-manifest.v1"
const COMMIT_FORMAT_ID := "saltmarcher.campaign-commit.v1"
const PARTITION_FORMAT_ID := "saltmarcher.capability-partition.v1"

var _data_root: String
var _campaign_id: String
var _campaign_dir: String
var _commits_dir: String
var _objects_dir: String
var _files: ImmutableJsonFiles


func _init(
	data_root: String,
	campaign_id: String,
	fault_injector: Callable = Callable(),
	campaign_directory_override: String = ""
) -> void:
	_data_root = data_root.trim_suffix("/")
	_campaign_id = campaign_id
	_campaign_dir = (
		campaign_directory_override.trim_suffix("/")
		if not campaign_directory_override.is_empty()
		else _data_root + "/campaigns/" + campaign_id
	)
	_commits_dir = _campaign_dir + "/commits"
	_objects_dir = _campaign_dir + "/objects"
	_files = ImmutableJsonFiles.new(fault_injector)


func initialize(name: String, created_at_utc: String) -> Dictionary:
	if name.strip_edges().is_empty() or _campaign_id.is_empty():
		return _failure("Campaign-Identität und Name müssen gültig sein.")
	for directory in [_campaign_dir, _commits_dir, _objects_dir, _campaign_dir + "/assets"]:
		var directory_error := _files.ensure_directory(directory)
		if directory_error != OK:
			return _failure("Campaign-Verzeichnis konnte nicht erstellt werden: %s" % error_string(directory_error))
	if FileAccess.file_exists(_files.absolute(identity_manifest_path())):
		return _failure("Eine Campaign-Identität darf nicht erneut initialisiert werden.")

	var identity_payload := {
		"campaign_id": _campaign_id,
		"name": name.strip_edges(),
		"created_at_utc": created_at_utc,
	}
	var identity_write := _files.write_new_json(
		identity_manifest_path(),
		_envelope(IDENTITY_FORMAT_ID, identity_payload),
		"campaign_identity"
	)
	if not identity_write.get("ok", false):
		if identity_write.get("status", "") != "ambiguous_commit" or not validate_identity().get("ok", false):
			return identity_write
	var identity_validation := validate_identity()
	if not identity_validation.get("ok", false):
		return identity_validation

	var initial_state := {
		"generation": 1,
		"parent_generation": 0,
		"committed_at_utc": created_at_utc,
		"runtime": default_runtime_state(),
		"partition_refs": {},
	}
	var commit := _publish_commit(initial_state)
	if not commit.get("ok", false):
		return commit
	return {"ok": true, "state": commit["state"]}


func validate_identity() -> Dictionary:
	var read := _files.read_json(identity_manifest_path())
	if not read.get("ok", false) or not read.get("value") is Dictionary:
		return _failure("Campaign %s hat kein gültiges Identitätsmanifest." % _campaign_id)
	var manifest: Dictionary = read["value"]
	var envelope_validation := _validate_envelope(manifest, IDENTITY_FORMAT_ID)
	if not envelope_validation.get("ok", false):
		return envelope_validation
	var payload: Dictionary = envelope_validation["payload"]
	if payload.get("campaign_id", "") != _campaign_id:
		return _failure("Campaign-Verzeichnis und Manifest-Identität widersprechen sich.")
	if str(payload.get("name", "")).strip_edges().is_empty():
		return _failure("Campaign %s hat keinen gültigen Namen." % _campaign_id)
	return {"ok": true, "identity": payload.duplicate(true)}


func load_state() -> Dictionary:
	var identity := validate_identity()
	if not identity.get("ok", false):
		return identity
	var directory_error := _files.ensure_directory(_commits_dir)
	if directory_error != OK:
		return _failure("Campaign-Commitverzeichnis ist nicht verfügbar.")
	var generations := _available_generations()
	if generations.is_empty():
		return _failure("Campaign %s besitzt keine bestätigte Generation." % _campaign_id)

	generations.reverse()
	var rejected := 0
	for generation in generations:
		var candidate := _read_commit(generation)
		if candidate.get("ok", false):
			var state: Dictionary = candidate["state"]
			state["ok"] = true
			state["identity"] = identity["identity"]
			state["recovered"] = rejected > 0
			state["recovery_message"] = (
				"Die jüngste beschädigte Campaign-Generation wurde verworfen; Generation %d ist aktiv."
				% generation if rejected > 0 else ""
			)
			return state
		rejected += 1
	return _failure("Keine unverfälschte Generation für Campaign %s ist wiederherstellbar." % _campaign_id)


func commit(
	expected_generation: int,
	partition_changes: Dictionary,
	runtime_state: Dictionary,
	removed_partitions: Array[String] = []
) -> Dictionary:
	var current := load_state()
	if not current.get("ok", false):
		return current
	if int(current["generation"]) != expected_generation:
		return {
			"ok": false,
			"status": "stale",
			"error": "Die Campaign wurde inzwischen geändert. Bitte den aktuellen Stand erneut laden.",
			"state": current,
		}
	if not runtime_state is Dictionary:
		return _failure("Campaign-Laufzeitzustand muss ein Dokument sein.")

	var partition_refs: Dictionary = current["partition_refs"].duplicate(true)
	for owner_value in removed_partitions:
		if not _valid_owner(owner_value):
			return _failure("Ungültiger Capability-Owner: %s" % owner_value)
		partition_refs.erase(owner_value)
	for owner_value in partition_changes:
		var owner := str(owner_value)
		if not _valid_owner(owner):
			return _failure("Ungültiger Capability-Owner: %s" % owner)
		var owner_directory := _objects_dir + "/" + owner
		var directory_error := _files.ensure_directory(owner_directory)
		if directory_error != OK:
			return _failure("Partition-Verzeichnis konnte nicht erstellt werden.")
		var relative_path := "objects/%s/%s.json" % [owner, _files.new_identity()]
		var partition_payload = partition_changes[owner_value]
		var partition_document := {
			"format": PARTITION_FORMAT_ID,
			"owner": owner,
			"payload": partition_payload,
			"payload_sha256": _files.checksum(partition_payload),
		}
		var write := _files.write_new_json(
			_campaign_dir + "/" + relative_path,
			partition_document,
			"campaign_partition"
		)
		if not write.get("ok", false):
			return write
		partition_refs[owner] = {
			"format": PARTITION_FORMAT_ID,
			"path": relative_path,
			"payload_sha256": partition_document["payload_sha256"],
		}

	var next_state := {
		"generation": _next_generation_number(),
		"parent_generation": expected_generation,
		"committed_at_utc": Time.get_datetime_string_from_system(true),
		"runtime": runtime_state.duplicate(true),
		"partition_refs": partition_refs,
	}
	return _publish_commit(next_state)


func read_partition(owner: String, state: Dictionary = {}) -> Dictionary:
	if not _valid_owner(owner):
		return _failure("Ungültiger Capability-Owner: %s" % owner)
	var current := state if not state.is_empty() else load_state()
	if not current.get("ok", false):
		return current
	var refs: Dictionary = current["partition_refs"]
	if not refs.has(owner):
		return {"ok": true, "present": false}
	var partition := _read_partition(owner, refs[owner])
	if not partition.get("ok", false):
		return partition
	return {"ok": true, "present": true, "payload": partition["payload"]}


func identity_manifest_path() -> String:
	return _campaign_dir + "/manifest.json"


func commit_path(generation: int) -> String:
	return _commits_dir + "/generation-%020d.json" % generation


func campaign_directory() -> String:
	return _campaign_dir


func default_runtime_state() -> Dictionary:
	return {
		"focused_workspace": "campaign",
		"focused_running_scene_id": "",
		"active_encounter_id": "",
		"active_travel_context_id": "",
		"pending_reconciliation": [],
	}


func _publish_commit(state: Dictionary) -> Dictionary:
	var payload := {
		"generation": str(state["generation"]),
		"parent_generation": str(state["parent_generation"]),
		"committed_at_utc": state["committed_at_utc"],
		"runtime": state["runtime"],
		"partitions": state["partition_refs"],
	}
	var write := _files.write_new_json(
		commit_path(int(state["generation"])),
		_envelope(COMMIT_FORMAT_ID, payload),
		"campaign_commit"
	)
	if not write.get("ok", false):
		if write.get("status", "") != "ambiguous_commit":
			return write
	var committed := load_state()
	if not committed.get("ok", false) or int(committed.get("generation", -1)) != int(state["generation"]):
		return _failure("Die neue Campaign-Generation konnte nicht bestätigt werden.")
	return {"ok": true, "status": "committed", "state": committed}


func _read_commit(generation: int) -> Dictionary:
	var read := _files.read_json(commit_path(generation))
	if not read.get("ok", false) or not read.get("value") is Dictionary:
		return _failure("Campaign-Generation %d ist nicht lesbar." % generation)
	var envelope_validation := _validate_envelope(read["value"], COMMIT_FORMAT_ID)
	if not envelope_validation.get("ok", false):
		return envelope_validation
	var payload: Dictionary = envelope_validation["payload"]
	if not str(payload.get("generation", "")).is_valid_int() or str(payload["generation"]).to_int() != generation:
		return _failure("Campaign-Generation und Dateiname widersprechen sich.")
	if not str(payload.get("parent_generation", "")).is_valid_int():
		return _failure("Campaign-Generation hat keinen gültigen Vorgänger.")
	var parent_generation := str(payload["parent_generation"]).to_int()
	if parent_generation < 0 or parent_generation >= generation or (generation == 1 and parent_generation != 0):
		return _failure("Campaign-Generation hat keinen gültigen Vorgänger.")
	if not payload.get("runtime") is Dictionary or not payload.get("partitions") is Dictionary:
		return _failure("Campaign-Generation enthält keinen gültigen Laufzeit- oder Partitionsstand.")
	var refs: Dictionary = payload["partitions"]
	for owner_value in refs:
		var owner := str(owner_value)
		if not _valid_owner(owner):
			return _failure("Campaign-Generation enthält einen ungültigen Capability-Owner.")
		var validation := _read_partition(owner, refs[owner_value])
		if not validation.get("ok", false):
			return validation
	return {
		"ok": true,
		"state": {
			"generation": generation,
			"parent_generation": parent_generation,
			"committed_at_utc": payload.get("committed_at_utc", ""),
			"runtime": payload["runtime"].duplicate(true),
			"partition_refs": refs.duplicate(true),
		},
	}


func _read_partition(owner: String, reference: Variant) -> Dictionary:
	if not reference is Dictionary:
		return _failure("Capability-Partition %s hat keine gültige Referenz." % owner)
	var relative_path := str(reference.get("path", ""))
	if not relative_path.begins_with("objects/%s/" % owner) or not relative_path.ends_with(".json"):
		return _failure("Capability-Partition %s verweist außerhalb ihres Owners." % owner)
	if relative_path.contains("..") or relative_path.contains("\\") or relative_path.begins_with("/"):
		return _failure("Capability-Partition %s enthält einen unsicheren Pfad." % owner)
	var read := _files.read_json(_campaign_dir + "/" + relative_path)
	if not read.get("ok", false) or not read.get("value") is Dictionary:
		return _failure("Capability-Partition %s ist nicht lesbar." % owner)
	var document: Dictionary = read["value"]
	if document.get("format", "") != PARTITION_FORMAT_ID or document.get("owner", "") != owner:
		return _failure("Capability-Partition %s hat ein unbekanntes Format oder einen falschen Owner." % owner)
	var payload = document.get("payload")
	var payload_checksum := _files.checksum(payload)
	if document.get("payload_sha256", "") != payload_checksum:
		return _failure("Capability-Partition %s hat eine ungültige Prüfsumme." % owner)
	if reference.get("format", "") != PARTITION_FORMAT_ID or reference.get("payload_sha256", "") != payload_checksum:
		return _failure("Campaign-Generation und Capability-Partition %s widersprechen sich." % owner)
	return {"ok": true, "payload": payload}


func _validate_envelope(document: Dictionary, expected_format: String) -> Dictionary:
	if document.get("format", "") != expected_format:
		return _failure("Persistenzdokument hat ein unbekanntes Format.")
	var payload = document.get("payload")
	if not payload is Dictionary:
		return _failure("Persistenzdokument enthält keinen gültigen Payload.")
	if document.get("payload_sha256", "") != _files.checksum(payload):
		return _failure("Persistenzdokument hat eine ungültige Prüfsumme.")
	return {"ok": true, "payload": payload}


func _envelope(format_id: String, payload: Dictionary) -> Dictionary:
	return {
		"format": format_id,
		"payload": payload,
		"payload_sha256": _files.checksum(payload),
	}


func _available_generations() -> Array[int]:
	var result: Array[int] = []
	var directory := DirAccess.open(_files.absolute(_commits_dir))
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


func _next_generation_number() -> int:
	var generations := _available_generations()
	return 1 if generations.is_empty() else generations.back() + 1


func _valid_owner(owner: String) -> bool:
	if owner.is_empty() or owner.length() > 64:
		return false
	for index in owner.length():
		var code := owner.unicode_at(index)
		var allowed := (code >= 97 and code <= 122) or (code >= 48 and code <= 57) or code == 45 or code == 95
		if not allowed:
			return false
	return true


func _failure(message: String) -> Dictionary:
	return {"ok": false, "status": "storage_error", "error": message}
