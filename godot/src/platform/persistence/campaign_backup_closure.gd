class_name CampaignBackupClosure
extends RefCounted

## Content-addressed immutable Campaign recovery points with isolated restore proof.

const ImmutableJsonFiles = preload("res://godot/src/platform/persistence/immutable_json_files.gd")
const FileCampaignStore = preload("res://godot/src/platform/persistence/file_campaign_store.gd")
const StorageCapacityGuard = preload("res://godot/src/platform/persistence/storage_capacity_guard.gd")

const POINT_FORMAT_ID := "saltmarcher.campaign-backup-point.v1"
const CHUNK_SIZE := 1024 * 1024
const MAX_FILE_COUNT := 2_000_000
const MAX_SAFE_BYTES := 0x3fffffffffffffff

var _data_root: String
var _files: ImmutableJsonFiles
var _capacity_guard


func _init(data_root: String, capacity_guard = null) -> void:
	_data_root = data_root.trim_suffix("/")
	_capacity_guard = capacity_guard if capacity_guard != null else StorageCapacityGuard.new()
	_files = ImmutableJsonFiles.new(Callable(), _capacity_guard)


func create_restore_tested_point(
	campaign_id: String,
	created_at_unix: int = -1
) -> Dictionary:
	var store := FileCampaignStore.new(_data_root, campaign_id)
	var state := store.load_state()
	if not state.get("ok", false):
		return _failure("Campaign ist nicht sicher genug lesbar, um einen Recovery-Punkt zu erstellen.")
	var points_error := _files.ensure_directory(_points_directory(campaign_id))
	if points_error != OK:
		return _failure("Recovery-Punkt-Verzeichnis konnte nicht erstellt werden.")
	var campaign_root := store.campaign_directory()
	var inventory := _inventory(_files.absolute(campaign_root))
	if not inventory.get("ok", false):
		return inventory
	var prepared := _store_missing_blobs(campaign_id, campaign_root, inventory["files"])
	if not prepared.get("ok", false):
		return prepared
	var closing_inventory := _inventory(_files.absolute(campaign_root))
	if (
		not closing_inventory.get("ok", false)
		or _files.canonical_json(closing_inventory["files"]) != _files.canonical_json(inventory["files"])
	):
		collect_unreferenced_blobs(campaign_id)
		return _failure("Campaign wurde während der Recovery-Punkt-Erstellung verändert; der Punkt wurde verworfen.")
	var point_time := created_at_unix if created_at_unix >= 0 else int(Time.get_unix_time_from_system())
	var backup_id := "generation-%020d-%s" % [int(state["generation"]), _files.new_identity()]
	var payload := {
		"backup_id": backup_id,
		"campaign_id": campaign_id,
		"campaign_generation": str(state["generation"]),
		"created_at_utc": Time.get_datetime_string_from_unix_time(point_time),
		"created_at_unix": str(point_time),
		"logical_bytes": str(inventory["total_bytes"]),
		"files": inventory["files"],
		"restore_tested": false,
	}
	var validation := _restore_test_payload(payload, "verify")
	if not validation.get("ok", false):
		collect_unreferenced_blobs(campaign_id)
		return validation
	payload["restore_tested"] = true
	var write := _files.write_new_json(
		point_path(campaign_id, backup_id),
		_envelope(payload),
		"backup_point"
	)
	if not write.get("ok", false):
		collect_unreferenced_blobs(campaign_id)
		return write
	return {
		"ok": true,
		"status": "backup_verified",
		"backup": payload,
		"unique_bytes_stored": prepared["unique_bytes_stored"],
		"reused_file_count": prepared["reused_file_count"],
	}


func list_points(campaign_id: String) -> Dictionary:
	var points_directory := _points_directory(campaign_id)
	var directory_error := _files.ensure_directory(points_directory)
	if directory_error != OK:
		return _failure("Recovery-Punkt-Verzeichnis ist nicht verfügbar.")
	var directory := DirAccess.open(_files.absolute(points_directory))
	if directory == null:
		return _failure("Recovery-Punkt-Verzeichnis ist nicht lesbar.")
	var points: Array = []
	var rejected: Array = []
	directory.list_dir_begin()
	var file_name := directory.get_next()
	while not file_name.is_empty():
		if not directory.current_is_dir() and file_name.ends_with(".verified.json"):
			var backup_id := file_name.trim_suffix(".verified.json")
			var point := read_point(campaign_id, backup_id)
			if point.get("ok", false):
				points.append(point["backup"])
			else:
				rejected.append({"point": file_name, "error": point.get("error", "Recovery-Punkt ist beschädigt.")})
		file_name = directory.get_next()
	directory.list_dir_end()
	points.sort_custom(func(left: Dictionary, right: Dictionary) -> bool:
		var left_generation := str(left["campaign_generation"]).to_int()
		var right_generation := str(right["campaign_generation"]).to_int()
		return left_generation > right_generation or (
			left_generation == right_generation and str(left["backup_id"]) > str(right["backup_id"])
		)
	)
	return {"ok": true, "backups": points, "rejected_backups": rejected}


func read_point(campaign_id: String, backup_id: String) -> Dictionary:
	if not _safe_id(campaign_id) or not _safe_id(backup_id):
		return _failure("Ungültige Recovery-Punkt-Identität.")
	var read := _files.read_json(point_path(campaign_id, backup_id))
	if not read.get("ok", false) or not read.get("value") is Dictionary:
		return _failure("Recovery-Punkt-Beleg ist nicht lesbar.")
	var document: Dictionary = read["value"]
	if document.get("format", "") != POINT_FORMAT_ID or not document.get("payload") is Dictionary:
		return _failure("Recovery-Punkt besitzt ein unbekanntes Format.")
	var payload: Dictionary = document["payload"]
	if document.get("payload_sha256", "") != _files.checksum(payload):
		return _failure("Recovery-Punkt-Beleg besitzt eine ungültige Prüfsumme.")
	var payload_validation := _validate_payload(payload, campaign_id, backup_id)
	if not payload_validation.get("ok", false):
		return payload_validation
	var blob_validation := _validate_blobs(payload["files"], campaign_id)
	if not blob_validation.get("ok", false):
		return blob_validation
	return {"ok": true, "backup": payload.duplicate(true)}


func stage_point(campaign_id: String, backup_id: String, purpose: String) -> Dictionary:
	if not _safe_segment(purpose):
		return _failure("Ungültiger Recovery-Staging-Zweck.")
	var point := read_point(campaign_id, backup_id)
	if not point.get("ok", false):
		return point
	var payload: Dictionary = point["backup"]
	return _stage_payload(payload, purpose)


func _stage_payload(payload: Dictionary, purpose: String) -> Dictionary:
	var campaign_id := str(payload["campaign_id"])
	var staging_root := _data_root + "/staging/%s-%s" % [purpose, _files.new_identity()]
	var staged_campaign := staging_root + "/campaign"
	var admission: Dictionary = _capacity_guard.admit(staged_campaign, str(payload["logical_bytes"]).to_int())
	if not admission.get("ok", false):
		return admission
	var stage_error := _files.ensure_directory(staged_campaign)
	if stage_error != OK:
		return _failure("Recovery-Punkt-Staging konnte nicht erstellt werden.")
	for entry in payload["files"]:
		var destination := staged_campaign + "/" + str(entry["path"])
		var parent_error := _files.ensure_directory(destination.get_base_dir())
		if parent_error != OK:
			discard_staging(staging_root)
			return _failure("Recovery-Punkt-Dateipfad konnte nicht vorbereitet werden.")
		var copied := _copy_file(
			blob_path(campaign_id, str(entry["sha256"])),
			destination,
			str(entry["sha256"]),
			str(entry["size"]).to_int()
		)
		if not copied.get("ok", false):
			discard_staging(staging_root)
			return copied
	var staged_store := FileCampaignStore.new(_data_root, campaign_id, Callable(), staged_campaign)
	var state := staged_store.load_state()
	if (
		not state.get("ok", false)
		or int(state.get("generation", -1)) != str(payload["campaign_generation"]).to_int()
		or state.get("identity", {}).get("campaign_id", "") != campaign_id
	):
		discard_staging(staging_root)
		return _failure("Rekonstruierter Recovery-Punkt besteht die semantische Campaign-Validierung nicht.")
	return {
		"ok": true,
		"backup": payload,
		"state": state,
		"staging_root": staging_root,
		"staged_campaign": staged_campaign,
	}


func discard_staging(staging_root: String) -> void:
	var owned_prefix := _files.absolute(_data_root + "/staging/")
	var absolute_staging := _files.absolute(staging_root)
	if absolute_staging.begins_with(owned_prefix):
		_files.remove_tree(staging_root)


func collect_unreferenced_blobs(campaign_id: String) -> Dictionary:
	var listed := list_points(campaign_id)
	if not listed.get("ok", false):
		return listed
	if not listed["rejected_backups"].is_empty():
		return {
			"ok": true,
			"status": "blob_collection_deferred",
			"removed_blob_count": 0,
			"removed_bytes": 0,
			"rejected_backups": listed["rejected_backups"],
		}
	var referenced: Dictionary = {}
	for point in listed["backups"]:
		for entry in point["files"]:
			referenced[str(entry["sha256"])] = true
	var blobs_directory := _blobs_directory(campaign_id)
	if not DirAccess.dir_exists_absolute(_files.absolute(blobs_directory)):
		return {"ok": true, "status": "blobs_current", "removed_blob_count": 0, "removed_bytes": 0}
	var removed_count := 0
	var removed_bytes := 0
	for file_name in DirAccess.get_files_at(_files.absolute(blobs_directory)):
		if not file_name.ends_with(".blob"):
			continue
		var checksum := file_name.trim_suffix(".blob")
		if referenced.has(checksum):
			continue
		var path := _files.absolute(blobs_directory + "/" + file_name)
		removed_bytes += FileAccess.get_size(path)
		if DirAccess.remove_absolute(path) != OK:
			return _failure("Nicht referenzierter Backup-Blob konnte nicht freigegeben werden.")
		removed_count += 1
	return {
		"ok": true,
		"status": "unreferenced_blobs_collected",
		"removed_blob_count": removed_count,
		"removed_bytes": removed_bytes,
	}


func point_path(campaign_id: String, backup_id: String) -> String:
	return _points_directory(campaign_id) + "/" + backup_id + ".verified.json"


func blob_path(campaign_id: String, checksum: String) -> String:
	return _blobs_directory(campaign_id) + "/" + checksum + ".blob"


func _restore_test_payload(payload: Dictionary, purpose: String) -> Dictionary:
	var staged := _stage_payload(payload, purpose)
	if not staged.get("ok", false):
		return staged
	discard_staging(staged["staging_root"])
	return {"ok": true}


func _store_missing_blobs(campaign_id: String, campaign_root: String, entries: Array) -> Dictionary:
	var missing_bytes := 0
	var missing: Array = []
	var reused := 0
	var scheduled_checksums: Dictionary = {}
	for entry in entries:
		var checksum := str(entry["sha256"])
		var blob := blob_path(campaign_id, checksum)
		var absolute_blob := _files.absolute(blob)
		if FileAccess.file_exists(absolute_blob):
			if FileAccess.get_size(absolute_blob) != str(entry["size"]).to_int() or FileAccess.get_sha256(absolute_blob) != checksum:
				return _failure("Content-addressed Backup-Blob ist beschädigt und wird nicht überschrieben.")
			reused += 1
		else:
			if scheduled_checksums.has(checksum):
				reused += 1
			else:
				scheduled_checksums[checksum] = true
				missing.append(entry)
				missing_bytes += str(entry["size"]).to_int()
	var admission: Dictionary = _capacity_guard.admit(_blobs_directory(campaign_id), missing_bytes)
	if not admission.get("ok", false):
		return admission
	var directory_error := _files.ensure_directory(_blobs_directory(campaign_id))
	if directory_error != OK:
		return _failure("Backup-Blob-Verzeichnis konnte nicht erstellt werden.")
	for entry in missing:
		var source := campaign_root + "/" + str(entry["path"])
		var destination := blob_path(campaign_id, str(entry["sha256"]))
		var pending := destination + ".pending-" + _files.new_identity()
		var copied := _copy_file(source, pending, str(entry["sha256"]), str(entry["size"]).to_int())
		if not copied.get("ok", false):
			DirAccess.remove_absolute(_files.absolute(pending))
			return copied
		var rename_error := DirAccess.rename_absolute(_files.absolute(pending), _files.absolute(destination))
		if rename_error != OK:
			DirAccess.remove_absolute(_files.absolute(pending))
			var absolute_destination := _files.absolute(destination)
			if (
				not FileAccess.file_exists(absolute_destination)
				or FileAccess.get_size(absolute_destination) != str(entry["size"]).to_int()
				or FileAccess.get_sha256(absolute_destination) != str(entry["sha256"])
			):
				return _failure("Backup-Blob konnte nicht atomar veröffentlicht werden.")
	return {
		"ok": true,
		"unique_bytes_stored": missing_bytes,
		"reused_file_count": reused,
	}


func _copy_file(
	source_path: String,
	destination_path: String,
	expected_checksum: String,
	expected_size: int
) -> Dictionary:
	var source := FileAccess.open(_files.absolute(source_path), FileAccess.READ)
	if source == null or source.get_length() != expected_size:
		if source != null:
			source.close()
		return _failure("Backup-Quelldatei ist nicht in der erwarteten Größe lesbar.")
	var output := FileAccess.open(_files.absolute(destination_path), FileAccess.WRITE)
	if output == null:
		source.close()
		return _failure("Backup-Zieldatei konnte nicht geöffnet werden.")
	var hashing := HashingContext.new()
	hashing.start(HashingContext.HASH_SHA256)
	while source.get_position() < source.get_length():
		var chunk := source.get_buffer(mini(CHUNK_SIZE, source.get_length() - source.get_position()))
		if chunk.is_empty():
			source.close()
			output.close()
			return _failure("Backup-Datei wurde nicht vollständig übertragen.")
		output.store_buffer(chunk)
		hashing.update(chunk)
	source.close()
	output.flush()
	var write_error := output.get_error()
	output.close()
	if write_error != OK or hashing.finish().hex_encode() != expected_checksum:
		return _failure("Backup-Datei besteht die Übertragungsprüfung nicht.")
	return {"ok": true}


func _inventory(root_path: String) -> Dictionary:
	var paths: Array[String] = []
	var collected := _collect_paths(root_path, "", paths)
	if not collected.get("ok", false):
		return collected
	paths.sort()
	if paths.size() > MAX_FILE_COUNT:
		return _failure("Campaign überschreitet die zulässige Backup-Dateianzahl.")
	var entries: Array = []
	var total_bytes := 0
	for relative_path in paths:
		var absolute_path := root_path + "/" + relative_path
		var size := FileAccess.get_size(absolute_path)
		var checksum := FileAccess.get_sha256(absolute_path)
		if checksum.length() != 64:
			return _failure("Campaign-Datei konnte nicht für das Backup gelesen werden.")
		total_bytes += size
		if total_bytes > MAX_SAFE_BYTES:
			return _failure("Campaign überschreitet die sicher darstellbare Backup-Gesamtgröße.")
		entries.append({"path": relative_path, "size": str(size), "sha256": checksum})
	return {"ok": true, "files": entries, "total_bytes": total_bytes}


func _collect_paths(root_path: String, relative_dir: String, output: Array[String]) -> Dictionary:
	var absolute_dir := root_path if relative_dir.is_empty() else root_path + "/" + relative_dir
	var directory := DirAccess.open(absolute_dir)
	if directory == null:
		return _failure("Campaign-Verzeichnis ist während des Backups nicht lesbar.")
	directory.list_dir_begin()
	var name := directory.get_next()
	while not name.is_empty():
		var relative_path := name if relative_dir.is_empty() else relative_dir + "/" + name
		if directory.is_link(name):
			directory.list_dir_end()
			return _failure("Campaign-Backup folgt keinen symbolischen Links.")
		if directory.current_is_dir():
			var nested := _collect_paths(root_path, relative_path, output)
			if not nested.get("ok", false):
				directory.list_dir_end()
				return nested
		elif not name.contains(".pending-"):
			if not _safe_relative_path(relative_path):
				directory.list_dir_end()
				return _failure("Campaign enthält einen nicht portablen Backup-Dateipfad.")
			output.append(relative_path)
		name = directory.get_next()
	directory.list_dir_end()
	return {"ok": true}


func _validate_payload(payload: Dictionary, campaign_id: String, backup_id: String) -> Dictionary:
	if (
		payload.get("campaign_id", "") != campaign_id
		or payload.get("backup_id", "") != backup_id
		or payload.get("restore_tested", false) != true
	):
		return _failure("Recovery-Punkt-Beleg und angeforderte Identität widersprechen sich.")
	for field in ["campaign_generation", "created_at_unix", "logical_bytes"]:
		if not str(payload.get(field, "")).is_valid_int() or str(payload[field]).to_int() < 0:
			return _failure("Recovery-Punkt besitzt ein ungültiges numerisches Feld.")
	if not payload.get("files") is Array or payload["files"].size() > MAX_FILE_COUNT:
		return _failure("Recovery-Punkt besitzt keine gültige Dateiliste.")
	var paths: Dictionary = {}
	var total_bytes := 0
	for entry_value in payload["files"]:
		if not entry_value is Dictionary:
			return _failure("Recovery-Punkt enthält einen ungültigen Dateieintrag.")
		var entry: Dictionary = entry_value
		var path := str(entry.get("path", ""))
		var size := str(entry.get("size", ""))
		var checksum := str(entry.get("sha256", ""))
		if not _safe_relative_path(path) or paths.has(path) or not size.is_valid_int() or size.to_int() < 0 or not _valid_sha256(checksum):
			return _failure("Recovery-Punkt enthält unsichere Datei-Metadaten.")
		paths[path] = true
		total_bytes += size.to_int()
		if total_bytes > MAX_SAFE_BYTES:
			return _failure("Recovery-Punkt überschreitet die sichere Gesamtgröße.")
	if total_bytes != str(payload["logical_bytes"]).to_int():
		return _failure("Recovery-Punkt-Gesamtgröße widerspricht seiner Dateiliste.")
	return {"ok": true}


func _validate_blobs(entries: Array, campaign_id: String = "") -> Dictionary:
	if campaign_id.is_empty() and not entries.is_empty():
		return _failure("Campaign-Identität fehlt für die Backup-Blob-Validierung.")
	for entry in entries:
		var checksum := str(entry["sha256"])
		var path := _files.absolute(blob_path(campaign_id, checksum))
		if (
			not FileAccess.file_exists(path)
			or FileAccess.get_size(path) != str(entry["size"]).to_int()
			or FileAccess.get_sha256(path) != checksum
		):
			return _failure("Recovery-Punkt referenziert einen fehlenden oder beschädigten Backup-Blob.")
	return {"ok": true}


func _points_directory(campaign_id: String) -> String:
	return _data_root + "/backups/campaigns/" + campaign_id + "/points"


func _blobs_directory(_campaign_id: String) -> String:
	return _data_root + "/backups/campaigns/" + _campaign_id + "/blobs/sha256"


func _envelope(payload: Dictionary) -> Dictionary:
	return {"format": POINT_FORMAT_ID, "payload": payload, "payload_sha256": _files.checksum(payload)}


func _safe_relative_path(path: String) -> bool:
	if path.is_empty() or path.begins_with("/") or path.contains("\\") or path.contains(":") or path.to_utf8_buffer().has(0):
		return false
	for segment in path.split("/", false):
		if not _safe_segment(segment):
			return false
	return true


func _safe_segment(segment: String) -> bool:
	if segment.is_empty() or segment == "." or segment == ".." or segment.ends_with(".") or segment.ends_with(" "):
		return false
	var stem := segment.get_basename().to_upper()
	if stem in ["CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9"]:
		return false
	for index in segment.length():
		if segment.unicode_at(index) < 32:
			return false
	return true


func _safe_id(value: String) -> bool:
	if value.is_empty() or value.length() > 128:
		return false
	for index in value.length():
		var code := value.unicode_at(index)
		if not ((code >= 97 and code <= 122) or (code >= 48 and code <= 57) or code == 45):
			return false
	return true


func _valid_sha256(value: String) -> bool:
	if value.length() != 64:
		return false
	for index in value.length():
		var code := value.unicode_at(index)
		if not ((code >= 48 and code <= 57) or (code >= 97 and code <= 102)):
			return false
	return true


func _failure(message: String) -> Dictionary:
	return {"ok": false, "status": "backup_error", "error": message}
