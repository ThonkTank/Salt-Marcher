class_name CampaignBackupManager
extends RefCounted

## Immutable Campaign backups which count only after isolated restore validation.

const ImmutableJsonFiles = preload("res://godot/src/platform/persistence/immutable_json_files.gd")
const FileCampaignStore = preload("res://godot/src/platform/persistence/file_campaign_store.gd")
const CampaignBundle = preload("res://godot/src/platform/portability/campaign_bundle.gd")

const RECEIPT_FORMAT_ID := "saltmarcher.campaign-backup-receipt.v1"

var _data_root: String
var _registry
var _files: ImmutableJsonFiles
var _portability: CampaignBundle


func _init(data_root: String, registry) -> void:
	_data_root = data_root.trim_suffix("/")
	_registry = registry
	_files = ImmutableJsonFiles.new()
	_portability = CampaignBundle.new(_data_root, registry)


func create_restore_tested_backup(campaign_id: String) -> Dictionary:
	var store := FileCampaignStore.new(_data_root, campaign_id)
	var state := store.load_state()
	if not state.get("ok", false):
		return _failure("Campaign ist nicht sicher genug lesbar, um ein vollständiges Backup zu erstellen.")
	var backup_directory := _backup_directory(campaign_id)
	var directory_error := _files.ensure_directory(backup_directory)
	if directory_error != OK:
		return _failure("Campaign-Backupverzeichnis konnte nicht erstellt werden.")

	var backup_id := "generation-%020d-%s" % [int(state["generation"]), _files.new_identity()]
	var bundle_name := backup_id + ".saltmarcher"
	var bundle_path := backup_directory + "/" + bundle_name
	var exported := _portability.export_campaign(campaign_id, bundle_path)
	if not exported.get("ok", false):
		return exported
	var validation := _portability.validate_bundle(bundle_path)
	if (
		not validation.get("ok", false)
		or validation.get("source_campaign_id", "") != campaign_id
		or int(validation.get("campaign_generation", -1)) != int(state["generation"])
	):
		DirAccess.remove_absolute(_files.absolute(bundle_path))
		return _failure("Campaign-Backup bestand den isolierten Restore-Test nicht.")

	var absolute_bundle := _files.absolute(bundle_path)
	var bundle_checksum := FileAccess.get_sha256(absolute_bundle)
	var bundle_size := FileAccess.get_size(absolute_bundle)
	if bundle_checksum.length() != 64 or bundle_size <= 0:
		DirAccess.remove_absolute(absolute_bundle)
		return _failure("Campaign-Backup konnte nach dem Restore-Test nicht bestätigt werden.")
	var receipt_payload := {
		"backup_id": backup_id,
		"campaign_id": campaign_id,
		"campaign_generation": str(state["generation"]),
		"created_at_utc": Time.get_datetime_string_from_system(true),
		"bundle_name": bundle_name,
		"bundle_size": str(bundle_size),
		"bundle_sha256": bundle_checksum,
		"restore_tested": true,
	}
	var receipt := _files.write_new_json(
		backup_directory + "/" + backup_id + ".verified.json",
		_envelope(receipt_payload),
		"backup_receipt"
	)
	if not receipt.get("ok", false):
		DirAccess.remove_absolute(absolute_bundle)
		return receipt
	return {
		"ok": true,
		"status": "backup_verified",
		"backup": receipt_payload,
	}


func list_backups(campaign_id: String) -> Dictionary:
	var backup_directory := _backup_directory(campaign_id)
	var directory_error := _files.ensure_directory(backup_directory)
	if directory_error != OK:
		return _failure("Campaign-Backupverzeichnis ist nicht verfügbar.")
	var directory := DirAccess.open(_files.absolute(backup_directory))
	if directory == null:
		return _failure("Campaign-Backupverzeichnis ist nicht lesbar.")
	var backups: Array = []
	var rejected: Array = []
	directory.list_dir_begin()
	var file_name := directory.get_next()
	while not file_name.is_empty():
		if not directory.current_is_dir() and file_name.ends_with(".verified.json"):
			var receipt := _read_receipt(campaign_id, file_name.trim_suffix(".verified.json"))
			if receipt.get("ok", false):
				backups.append(receipt["backup"])
			else:
				rejected.append({"receipt": file_name, "error": receipt.get("error", "Backup ist beschädigt.")})
		file_name = directory.get_next()
	directory.list_dir_end()
	backups.sort_custom(func(left: Dictionary, right: Dictionary) -> bool:
		var left_generation := str(left["campaign_generation"]).to_int()
		var right_generation := str(right["campaign_generation"]).to_int()
		return left_generation > right_generation or (
			left_generation == right_generation and str(left["backup_id"]) > str(right["backup_id"])
		)
	)
	return {"ok": true, "backups": backups, "rejected_backups": rejected}


func restore_backup(
	campaign_id: String,
	backup_id: String,
	expected_campaign_generation: int,
	activation_is_revoked: bool
) -> Dictionary:
	if not activation_is_revoked:
		return _failure("Campaign-Restore erfordert zuvor widerrufene Schreibautorität.")
	var current_store := FileCampaignStore.new(_data_root, campaign_id)
	var current := current_store.load_state()
	if not current.get("ok", false):
		return _failure("Aktuelle Campaign ist nicht sicher für einen kontrollierten Restore geöffnet.")
	if int(current["generation"]) != expected_campaign_generation:
		return {"ok": false, "status": "stale", "error": "Campaign wurde inzwischen geändert.", "state": current}
	var receipt := _read_receipt(campaign_id, backup_id)
	if not receipt.get("ok", false):
		return receipt
	var backup: Dictionary = receipt["backup"]
	var bundle_path: String = _backup_directory(campaign_id) + "/" + str(backup["bundle_name"])
	var staged := _portability.stage_validated_bundle(bundle_path, "restore")
	if not staged.get("ok", false):
		return staged
	if staged["payload"].get("source_campaign_id", "") != campaign_id:
		_portability.discard_staging(staged["staging_root"])
		return _failure("Backup gehört zu einer anderen Campaign.")

	var staged_store := FileCampaignStore.new(
		_data_root,
		campaign_id,
		Callable(),
		staged["staged_campaign"]
	)
	var staged_state: Dictionary = staged["state"]
	var recovery_commit := staged_store.commit(
		int(staged_state["generation"]),
		{},
		staged_state["runtime"],
		[],
		expected_campaign_generation + 1
	)
	if not recovery_commit.get("ok", false):
		_portability.discard_staging(staged["staging_root"])
		return _failure("Backup konnte nicht als neue Recovery-Generation vorbereitet werden.")

	var restore_id := _files.new_identity()
	var retained_root := _data_root + "/recovery/campaigns/%s/%s" % [campaign_id, restore_id]
	var retained_original := retained_root + "/original"
	var retained_error := _files.ensure_directory(retained_root)
	if retained_error != OK:
		_portability.discard_staging(staged["staging_root"])
		return _failure("Recovery-Aufbewahrung konnte nicht vorbereitet werden.")
	var live_campaign := _data_root + "/campaigns/" + campaign_id
	var move_original := DirAccess.rename_absolute(
		_files.absolute(live_campaign),
		_files.absolute(retained_original)
	)
	if move_original != OK:
		_portability.discard_staging(staged["staging_root"])
		return _failure("Aktuelle Campaign konnte nicht unverändert für den Restore aufbewahrt werden.")
	var promote := DirAccess.rename_absolute(
		_files.absolute(staged["staged_campaign"]),
		_files.absolute(live_campaign)
	)
	if promote != OK:
		DirAccess.rename_absolute(_files.absolute(retained_original), _files.absolute(live_campaign))
		_portability.discard_staging(staged["staging_root"])
		return _failure("Restore-Campaign konnte nicht veröffentlicht werden.")
	var restored := FileCampaignStore.new(_data_root, campaign_id).load_state()
	if (
		not restored.get("ok", false)
		or int(restored.get("generation", -1)) != int(recovery_commit["state"]["generation"])
	):
		var rejected_restore: String = str(staged["staging_root"]) + "/rejected"
		_files.ensure_directory(staged["staging_root"])
		DirAccess.rename_absolute(_files.absolute(live_campaign), _files.absolute(rejected_restore))
		DirAccess.rename_absolute(_files.absolute(retained_original), _files.absolute(live_campaign))
		_portability.discard_staging(staged["staging_root"])
		return _failure("Veröffentlichter Restore bestand die abschließende Campaign-Validierung nicht.")
	_portability.discard_staging(staged["staging_root"])
	return {
		"ok": true,
		"status": "restored",
		"state": restored,
		"backup_id": backup_id,
		"retained_original_id": restore_id,
		"retained_original_path": retained_original,
	}


func restore_latest_safe_backup(
	campaign_id: String,
	expected_campaign_generation: int,
	activation_is_revoked: bool
) -> Dictionary:
	var listed := list_backups(campaign_id)
	if not listed.get("ok", false):
		return listed
	for backup in listed["backups"]:
		var restored := restore_backup(
			campaign_id,
			backup["backup_id"],
			expected_campaign_generation,
			activation_is_revoked
		)
		if restored.get("ok", false):
			return restored
	return _failure("Kein restore-getestetes Campaign-Backup konnte geöffnet werden.")


func _read_receipt(campaign_id: String, backup_id: String) -> Dictionary:
	if not _safe_id(backup_id):
		return _failure("Ungültige Backup-Identität.")
	var receipt_path := _backup_directory(campaign_id) + "/" + backup_id + ".verified.json"
	var read := _files.read_json(receipt_path)
	if not read.get("ok", false) or not read.get("value") is Dictionary:
		return _failure("Backup-Beleg ist nicht lesbar.")
	var document: Dictionary = read["value"]
	if document.get("format", "") != RECEIPT_FORMAT_ID or not document.get("payload") is Dictionary:
		return _failure("Backup-Beleg besitzt ein unbekanntes Format.")
	var payload: Dictionary = document["payload"]
	if document.get("payload_sha256", "") != _files.checksum(payload):
		return _failure("Backup-Beleg besitzt eine ungültige Prüfsumme.")
	if payload.get("backup_id", "") != backup_id or payload.get("campaign_id", "") != campaign_id or payload.get("restore_tested", false) != true:
		return _failure("Backup-Beleg und angefordertes Backup widersprechen sich.")
	var bundle_name := str(payload.get("bundle_name", ""))
	if bundle_name != backup_id + ".saltmarcher":
		return _failure("Backup-Beleg enthält keinen sicheren Bundle-Namen.")
	var bundle_path := _files.absolute(_backup_directory(campaign_id) + "/" + bundle_name)
	if not FileAccess.file_exists(bundle_path):
		return _failure("Bestätigtes Backup-Bundle fehlt.")
	if str(payload.get("bundle_size", "")).to_int() != FileAccess.get_size(bundle_path):
		return _failure("Backup-Bundle-Größe stimmt nicht mit dem Beleg überein.")
	if payload.get("bundle_sha256", "") != FileAccess.get_sha256(bundle_path):
		return _failure("Backup-Bundle-Prüfsumme stimmt nicht mit dem Beleg überein.")
	return {"ok": true, "backup": payload.duplicate(true)}


func _envelope(payload: Dictionary) -> Dictionary:
	return {
		"format": RECEIPT_FORMAT_ID,
		"payload": payload,
		"payload_sha256": _files.checksum(payload),
	}


func _backup_directory(campaign_id: String) -> String:
	return _data_root + "/backups/campaigns/" + campaign_id


func _safe_id(value: String) -> bool:
	if value.is_empty() or value.length() > 128:
		return false
	for index in value.length():
		var code := value.unicode_at(index)
		var allowed := (code >= 97 and code <= 122) or (code >= 48 and code <= 57) or code == 45
		if not allowed:
			return false
	return true


func _failure(message: String) -> Dictionary:
	return {"ok": false, "status": "backup_error", "error": message}
