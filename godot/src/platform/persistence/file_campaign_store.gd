class_name FileCampaignStore
extends RefCounted

## Campaign-scoped immutable generations and owner-isolated partition documents.

const ImmutableJsonFiles = preload("res://godot/src/platform/persistence/immutable_json_files.gd")

const IDENTITY_FORMAT_ID := "saltmarcher.campaign-manifest.v1"
const COMMIT_FORMAT_ID := "saltmarcher.campaign-commit.v1"
const PARTITION_FORMAT_ID := "saltmarcher.capability-partition.v1"
const ASSET_REFERENCE_FORMAT_ID := "saltmarcher.asset-reference.v1"
const CHUNK_REFERENCE_FORMAT_ID := "saltmarcher.chunk-reference.v1"

var _data_root: String
var _campaign_id: String
var _campaign_dir: String
var _commits_dir: String
var _objects_dir: String
var _assets_dir: String
var _chunks_dir: String
var _files: ImmutableJsonFiles


func _init(
	data_root: String,
	campaign_id: String,
	fault_injector: Callable = Callable(),
	campaign_directory_override: String = "",
	capacity_guard = null
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
	_assets_dir = _campaign_dir + "/assets"
	_chunks_dir = _campaign_dir + "/chunks"
	_files = ImmutableJsonFiles.new(fault_injector, capacity_guard)


func initialize(name: String, created_at_utc: String) -> Dictionary:
	if name.strip_edges().is_empty() or _campaign_id.is_empty():
		return _failure("Campaign-Identität und Name müssen gültig sein.")
	for directory in [_campaign_dir, _commits_dir, _objects_dir, _assets_dir, _chunks_dir]:
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
		"asset_refs": {},
		"chunk_refs": {},
		"shared_definition_refs": [],
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
	removed_partitions: Array[String] = [],
	minimum_next_generation: int = 0,
	shared_definition_refs = null,
	asset_changes: Dictionary = {},
	removed_asset_ids: Array[String] = [],
	chunk_changes: Dictionary = {},
	removed_chunks: Dictionary = {}
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
	var next_definition_refs: Array = current["shared_definition_refs"].duplicate()
	if shared_definition_refs != null:
		var refs_validation := _validate_definition_refs(shared_definition_refs)
		if not refs_validation.get("ok", false):
			return refs_validation
		next_definition_refs = refs_validation["refs"]
	var asset_refs: Dictionary = current.get("asset_refs", {}).duplicate(true)
	for asset_id in removed_asset_ids:
		if not _valid_storage_id(asset_id):
			return _failure("Ungültige Asset-Identität: %s" % asset_id)
		asset_refs.erase(asset_id)
	for asset_id_value in asset_changes:
		var asset_id := str(asset_id_value)
		var asset_write := _write_asset(asset_id, asset_changes[asset_id_value])
		if not asset_write.get("ok", false):
			return asset_write
		asset_refs[asset_id] = asset_write["reference"]

	var chunk_refs: Dictionary = current.get("chunk_refs", {}).duplicate(true)
	for owner_value in removed_chunks:
		var removed_owner := str(owner_value)
		if not _valid_owner(removed_owner) or not removed_chunks[owner_value] is Array:
			return _failure("Ungültige Chunk-Entfernung für Owner %s." % removed_owner)
		var owner_refs: Dictionary = chunk_refs.get(removed_owner, {}).duplicate(true)
		for chunk_id_value in removed_chunks[owner_value]:
			var chunk_id := str(chunk_id_value)
			if not _valid_storage_id(chunk_id):
				return _failure("Ungültige Chunk-Identität: %s" % chunk_id)
			owner_refs.erase(chunk_id)
		if owner_refs.is_empty():
			chunk_refs.erase(removed_owner)
		else:
			chunk_refs[removed_owner] = owner_refs
	for owner_value in chunk_changes:
		var chunk_owner := str(owner_value)
		if not _valid_owner(chunk_owner) or not chunk_changes[owner_value] is Dictionary:
			return _failure("Ungültige Chunk-Änderung für Owner %s." % chunk_owner)
		var next_owner_refs: Dictionary = chunk_refs.get(chunk_owner, {}).duplicate(true)
		for chunk_id_value in chunk_changes[owner_value]:
			var chunk_id := str(chunk_id_value)
			var chunk_write := _write_chunk(
				chunk_owner,
				chunk_id,
				chunk_changes[owner_value][chunk_id_value]
			)
			if not chunk_write.get("ok", false):
				return chunk_write
			next_owner_refs[chunk_id] = chunk_write["reference"]
		chunk_refs[chunk_owner] = next_owner_refs

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
		"generation": maxi(_next_generation_number(), minimum_next_generation),
		"parent_generation": expected_generation,
		"committed_at_utc": Time.get_datetime_string_from_system(true),
		"runtime": runtime_state.duplicate(true),
		"partition_refs": partition_refs,
		"asset_refs": asset_refs,
		"chunk_refs": chunk_refs,
		"shared_definition_refs": next_definition_refs,
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


func inspect_asset(asset_id: String, state: Dictionary = {}) -> Dictionary:
	if not _valid_storage_id(asset_id):
		return _failure("Ungültige Asset-Identität: %s" % asset_id)
	var current := state if not state.is_empty() else load_state()
	if not current.get("ok", false):
		return current
	var refs: Dictionary = current.get("asset_refs", {})
	if not refs.has(asset_id):
		return {"ok": true, "present": false, "asset_id": asset_id}
	var reference_validation := _validate_asset_reference(asset_id, refs[asset_id])
	if not reference_validation.get("ok", false):
		return reference_validation
	var reference: Dictionary = reference_validation["reference"]
	var absolute_path := _files.absolute(_campaign_dir + "/" + str(reference["path"]))
	if not FileAccess.file_exists(absolute_path):
		return {
			"ok": false,
			"status": "asset_missing",
			"error": "Asset %s fehlt; übrige Campaign-Wahrheit bleibt verfügbar." % asset_id,
			"asset_id": asset_id,
			"reference": reference,
		}
	if (
		FileAccess.get_size(absolute_path) != str(reference["size"]).to_int()
		or FileAccess.get_sha256(absolute_path) != str(reference["sha256"])
	):
		return {
			"ok": false,
			"status": "asset_damaged",
			"error": "Asset %s ist beschädigt; übrige Campaign-Wahrheit bleibt verfügbar." % asset_id,
			"asset_id": asset_id,
			"reference": reference,
		}
	return {"ok": true, "present": true, "asset_id": asset_id, "reference": reference}


func read_chunk(owner: String, chunk_id: String, state: Dictionary = {}) -> Dictionary:
	if not _valid_owner(owner) or not _valid_storage_id(chunk_id):
		return _failure("Ungültige Chunk-Adresse %s/%s." % [owner, chunk_id])
	var current := state if not state.is_empty() else load_state()
	if not current.get("ok", false):
		return current
	var owner_refs: Dictionary = current.get("chunk_refs", {}).get(owner, {})
	if not owner_refs.has(chunk_id):
		return {"ok": true, "present": false, "owner": owner, "chunk_id": chunk_id}
	var reference_validation := _validate_chunk_reference(owner, chunk_id, owner_refs[chunk_id])
	if not reference_validation.get("ok", false):
		return reference_validation
	var reference: Dictionary = reference_validation["reference"]
	var absolute_path := _files.absolute(_campaign_dir + "/" + str(reference["path"]))
	if not FileAccess.file_exists(absolute_path):
		return {
			"ok": false,
			"status": "chunk_missing",
			"error": "Chunk %s/%s fehlt." % [owner, chunk_id],
		}
	var file := FileAccess.open(absolute_path, FileAccess.READ)
	if file == null:
		return {
			"ok": false,
			"status": "chunk_unreadable",
			"error": "Chunk %s/%s ist nicht lesbar." % [owner, chunk_id],
		}
	if file.get_length() != str(reference["size"]).to_int():
		if file != null:
			file.close()
		return {
			"ok": false,
			"status": "chunk_damaged",
			"error": "Chunk %s/%s hat eine falsche Größe." % [owner, chunk_id],
		}
	var bytes := file.get_buffer(file.get_length())
	file.close()
	if _sha256_bytes(bytes) != str(reference["sha256"]):
		return {
			"ok": false,
			"status": "chunk_damaged",
			"error": "Chunk %s/%s ist beschädigt." % [owner, chunk_id],
		}
	return {
		"ok": true,
		"present": true,
		"owner": owner,
		"chunk_id": chunk_id,
		"format": reference["chunk_format"],
		"bytes": bytes,
		"reference": reference,
	}


func validate_binary_closure(state: Dictionary = {}) -> Dictionary:
	var current := state if not state.is_empty() else load_state()
	if not current.get("ok", false):
		return current
	for asset_id_value in current.get("asset_refs", {}):
		var asset_result := inspect_asset(str(asset_id_value), current)
		if not asset_result.get("ok", false):
			return asset_result
	for owner_value in current.get("chunk_refs", {}):
		var owner := str(owner_value)
		for chunk_id_value in current["chunk_refs"][owner_value]:
			var chunk_id := str(chunk_id_value)
			var reference_validation := _validate_chunk_reference(
				owner,
				chunk_id,
				current["chunk_refs"][owner_value][chunk_id_value]
			)
			if not reference_validation.get("ok", false):
				return reference_validation
			var reference: Dictionary = reference_validation["reference"]
			var file_validation := _validate_binary_file(reference)
			if not file_validation.get("ok", false):
				return {
					"ok": false,
					"status": file_validation["status"],
					"error": "Chunk %s/%s fehlt oder ist beschädigt." % [owner, chunk_id],
					"owner": owner,
					"chunk_id": chunk_id,
				}
	return {
		"ok": true,
		"status": "binary_closure_valid",
		"asset_count": current.get("asset_refs", {}).size(),
		"chunk_count": _chunk_reference_count(current.get("chunk_refs", {})),
	}


func identity_manifest_path() -> String:
	return _campaign_dir + "/manifest.json"


func commit_path(generation: int) -> String:
	return _commits_dir + "/generation-%020d.json" % generation


func campaign_directory() -> String:
	return _campaign_dir


func generation_inventory() -> Dictionary:
	var identity := validate_identity()
	if not identity.get("ok", false):
		return identity
	var valid: Array = []
	var rejected: Array = []
	for generation in _available_generations():
		var candidate := _read_commit(generation)
		if candidate.get("ok", false):
			valid.append(candidate["state"])
		else:
			rejected.append({
				"generation": generation,
				"error": candidate.get("error", "Campaign-Generation ist beschädigt."),
			})
	return {
		"ok": true,
		"valid_generations": valid,
		"rejected_generations": rejected,
	}


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
		"assets": state.get("asset_refs", {}),
		"chunks": state.get("chunk_refs", {}),
		"shared_definition_refs": state["shared_definition_refs"],
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
	var definition_refs_validation := _validate_definition_refs(payload.get("shared_definition_refs", []))
	if not definition_refs_validation.get("ok", false):
		return definition_refs_validation
	var refs: Dictionary = payload["partitions"]
	for owner_value in refs:
		var owner := str(owner_value)
		if not _valid_owner(owner):
			return _failure("Campaign-Generation enthält einen ungültigen Capability-Owner.")
		var validation := _read_partition(owner, refs[owner_value])
		if not validation.get("ok", false):
			return validation
	var asset_refs_validation := _validate_asset_references(payload.get("assets", {}))
	if not asset_refs_validation.get("ok", false):
		return asset_refs_validation
	var chunk_refs_validation := _validate_chunk_references(payload.get("chunks", {}))
	if not chunk_refs_validation.get("ok", false):
		return chunk_refs_validation
	return {
		"ok": true,
		"state": {
			"generation": generation,
			"parent_generation": parent_generation,
			"committed_at_utc": payload.get("committed_at_utc", ""),
			"runtime": payload["runtime"].duplicate(true),
			"partition_refs": refs.duplicate(true),
			"asset_refs": asset_refs_validation["refs"],
			"chunk_refs": chunk_refs_validation["refs"],
			"shared_definition_refs": definition_refs_validation["refs"],
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


func _write_asset(asset_id: String, change: Variant) -> Dictionary:
	if not _valid_storage_id(asset_id) or not change is Dictionary:
		return _failure("Asset-Änderung besitzt keine gültige Identität oder Beschreibung.")
	var file_name := str(change.get("file_name", ""))
	if not _safe_file_name(file_name):
		return _failure("Asset-Dateiname ist nicht plattformportabel.")
	var media_kind := str(change.get("media_kind", "other"))
	if media_kind not in ["map", "image", "audio", "other"]:
		return _failure("Asset-Medientyp ist unbekannt.")
	var asset_directory := _assets_dir + "/" + asset_id
	if _files.ensure_directory(asset_directory) != OK:
		return _failure("Asset-Verzeichnis konnte nicht vorbereitet werden.")
	var content_id := _files.new_identity()
	var relative_path := "assets/%s/%s-%s" % [asset_id, content_id, file_name]
	var written := _write_binary_change(_campaign_dir + "/" + relative_path, change, "campaign_asset")
	if not written.get("ok", false):
		return written
	return {
		"ok": true,
		"reference": {
			"format": ASSET_REFERENCE_FORMAT_ID,
			"asset_id": asset_id,
			"content_id": content_id,
			"media_kind": media_kind,
			"original_file_name": file_name,
			"path": relative_path,
			"size": str(written["size"]),
			"sha256": written["sha256"],
		},
	}


func _write_chunk(owner: String, chunk_id: String, change: Variant) -> Dictionary:
	if not _valid_owner(owner) or not _valid_storage_id(chunk_id) or not change is Dictionary:
		return _failure("Chunk-Änderung besitzt keine gültige Adresse oder Beschreibung.")
	var chunk_format := str(change.get("chunk_format", ""))
	if not _valid_storage_id(chunk_format):
		return _failure("Chunk-Format besitzt keine stabile Identität.")
	var chunk_directory := _chunks_dir + "/" + owner + "/" + chunk_id
	if _files.ensure_directory(chunk_directory) != OK:
		return _failure("Chunk-Verzeichnis konnte nicht vorbereitet werden.")
	var content_id := _files.new_identity()
	var relative_path := "chunks/%s/%s/%s.bin" % [owner, chunk_id, content_id]
	var written := _write_binary_change(_campaign_dir + "/" + relative_path, change, "campaign_chunk")
	if not written.get("ok", false):
		return written
	return {
		"ok": true,
		"reference": {
			"format": CHUNK_REFERENCE_FORMAT_ID,
			"owner": owner,
			"chunk_id": chunk_id,
			"content_id": content_id,
			"chunk_format": chunk_format,
			"path": relative_path,
			"size": str(written["size"]),
			"sha256": written["sha256"],
		},
	}


func _write_binary_change(path: String, change: Dictionary, operation: String) -> Dictionary:
	var has_source := change.has("source_path")
	var has_bytes := change.has("bytes")
	if has_source == has_bytes:
		return _failure("Binäränderung benötigt genau eine Quelle oder einen Byte-Payload.")
	if has_source:
		var source_path := str(change.get("source_path", ""))
		if source_path.is_empty():
			return _failure("Binärquelle darf nicht leer sein.")
		return _files.write_new_binary_from_file(path, source_path, operation)
	if not change["bytes"] is PackedByteArray:
		return _failure("Binärpayload muss ein PackedByteArray sein.")
	return _files.write_new_binary_bytes(path, change["bytes"], operation)


func _validate_asset_references(value: Variant) -> Dictionary:
	if not value is Dictionary:
		return _failure("Campaign-Generation besitzt keine gültige Asset-Closure.")
	var refs: Dictionary = value
	for asset_id_value in refs:
		var asset_id := str(asset_id_value)
		var validation := _validate_asset_reference(asset_id, refs[asset_id_value])
		if not validation.get("ok", false):
			return validation
	return {"ok": true, "refs": refs.duplicate(true)}


func _validate_asset_reference(asset_id: String, value: Variant) -> Dictionary:
	if not _valid_storage_id(asset_id) or not value is Dictionary:
		return _failure("Campaign-Generation enthält eine ungültige Asset-Referenz.")
	var reference: Dictionary = value
	var file_name := str(reference.get("original_file_name", ""))
	var content_id := str(reference.get("content_id", ""))
	var path := str(reference.get("path", ""))
	if (
		reference.get("format", "") != ASSET_REFERENCE_FORMAT_ID
		or reference.get("asset_id", "") != asset_id
		or not _valid_storage_id(content_id)
		or str(reference.get("media_kind", "")) not in ["map", "image", "audio", "other"]
		or not _safe_file_name(file_name)
		or path != "assets/%s/%s-%s" % [asset_id, content_id, file_name]
		or not _valid_binary_metadata(reference)
	):
		return _failure("Asset-Referenz %s ist strukturell ungültig." % asset_id)
	return {"ok": true, "reference": reference.duplicate(true)}


func _validate_chunk_references(value: Variant) -> Dictionary:
	if not value is Dictionary:
		return _failure("Campaign-Generation besitzt keine gültige Chunk-Closure.")
	var refs: Dictionary = value
	for owner_value in refs:
		var owner := str(owner_value)
		if not _valid_owner(owner) or not refs[owner_value] is Dictionary:
			return _failure("Campaign-Generation enthält einen ungültigen Chunk-Owner.")
		for chunk_id_value in refs[owner_value]:
			var chunk_id := str(chunk_id_value)
			var validation := _validate_chunk_reference(owner, chunk_id, refs[owner_value][chunk_id_value])
			if not validation.get("ok", false):
				return validation
	return {"ok": true, "refs": refs.duplicate(true)}


func _validate_chunk_reference(owner: String, chunk_id: String, value: Variant) -> Dictionary:
	if not _valid_owner(owner) or not _valid_storage_id(chunk_id) or not value is Dictionary:
		return _failure("Campaign-Generation enthält eine ungültige Chunk-Referenz.")
	var reference: Dictionary = value
	var content_id := str(reference.get("content_id", ""))
	var path := str(reference.get("path", ""))
	if (
		reference.get("format", "") != CHUNK_REFERENCE_FORMAT_ID
		or reference.get("owner", "") != owner
		or reference.get("chunk_id", "") != chunk_id
		or not _valid_storage_id(content_id)
		or not _valid_storage_id(str(reference.get("chunk_format", "")))
		or path != "chunks/%s/%s/%s.bin" % [owner, chunk_id, content_id]
		or not _valid_binary_metadata(reference)
	):
		return _failure("Chunk-Referenz %s/%s ist strukturell ungültig." % [owner, chunk_id])
	return {"ok": true, "reference": reference.duplicate(true)}


func _valid_binary_metadata(reference: Dictionary) -> bool:
	var size := str(reference.get("size", ""))
	return size.is_valid_int() and size.to_int() >= 0 and _valid_sha256(str(reference.get("sha256", "")))


func _validate_binary_file(reference: Dictionary) -> Dictionary:
	var absolute_path := _files.absolute(_campaign_dir + "/" + str(reference["path"]))
	if not FileAccess.file_exists(absolute_path):
		return {"ok": false, "status": "binary_missing"}
	if (
		FileAccess.get_size(absolute_path) != str(reference["size"]).to_int()
		or FileAccess.get_sha256(absolute_path) != str(reference["sha256"])
	):
		return {"ok": false, "status": "binary_damaged"}
	return {"ok": true}


func _chunk_reference_count(refs: Dictionary) -> int:
	var count := 0
	for owner_refs in refs.values():
		count += owner_refs.size()
	return count


func _safe_file_name(value: String) -> bool:
	if value.is_empty() or value in [".", ".."] or value.to_utf8_buffer().size() > 180:
		return false
	if value.contains("/") or value.contains("\\") or value.ends_with(".") or value.ends_with(" "):
		return false
	for index in value.length():
		var code := value.unicode_at(index)
		if code < 32 or code in [34, 42, 58, 60, 62, 63, 124]:
			return false
	var stem := str(value.split(".", false)[0]).to_upper()
	if stem in ["CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9"]:
		return false
	return true


func _valid_storage_id(value: String) -> bool:
	if value.is_empty() or value.length() > 128:
		return false
	for index in value.length():
		var code := value.unicode_at(index)
		if not (
			(code >= 48 and code <= 57)
			or (code >= 97 and code <= 122)
			or code in [45, 46, 95]
		):
			return false
	return value not in [".", ".."]


func _valid_sha256(value: String) -> bool:
	if value.length() != 64:
		return false
	for index in value.length():
		var code := value.unicode_at(index)
		if not ((code >= 48 and code <= 57) or (code >= 97 and code <= 102)):
			return false
	return true


func _sha256_bytes(bytes: PackedByteArray) -> String:
	var hashing := HashingContext.new()
	hashing.start(HashingContext.HASH_SHA256)
	hashing.update(bytes)
	return hashing.finish().hex_encode()


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


func _validate_definition_refs(value: Variant) -> Dictionary:
	if not value is Array:
		return _failure("Campaign-Generation enthält keine gültigen Shared-Definition-Referenzen.")
	var known := {}
	var refs: Array = []
	for raw_ref in value:
		var definition_id := str(raw_ref)
		if definition_id.is_empty() or definition_id.length() > 160 or known.has(definition_id):
			return _failure("Campaign-Generation enthält eine ungültige oder doppelte Shared-Definition-Referenz.")
		for index in definition_id.length():
			var code := definition_id.unicode_at(index)
			var allowed := (
				(code >= 97 and code <= 122)
				or (code >= 48 and code <= 57)
				or code == 45
				or code == 46
				or code == 95
			)
			if not allowed:
				return _failure("Campaign-Generation enthält eine ungültige Shared-Definition-Identität.")
		known[definition_id] = true
		refs.append(definition_id)
	refs.sort()
	return {"ok": true, "refs": refs}


func _failure(message: String) -> Dictionary:
	return {"ok": false, "status": "storage_error", "error": message}
