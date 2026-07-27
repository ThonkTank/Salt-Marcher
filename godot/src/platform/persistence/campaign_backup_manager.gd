class_name CampaignBackupManager
extends RefCounted

## Immutable Campaign backups which count only after isolated restore validation.

const ImmutableJsonFiles = preload("res://godot/src/platform/persistence/immutable_json_files.gd")
const FileCampaignStore = preload("res://godot/src/platform/persistence/file_campaign_store.gd")
const CampaignBundle = preload("res://godot/src/platform/portability/campaign_bundle.gd")
const StorageCapacityGuard = preload("res://godot/src/platform/persistence/storage_capacity_guard.gd")

const RECEIPT_FORMAT_ID := "saltmarcher.campaign-backup-receipt.v1"

var _data_root: String
var _registry
var _files: ImmutableJsonFiles
var _portability: CampaignBundle
var _capacity_guard
var _maintenance_fault_injector: Callable


func _init(
	data_root: String,
	registry,
	capacity_guard = null,
	maintenance_fault_injector: Callable = Callable()
) -> void:
	_data_root = data_root.trim_suffix("/")
	_registry = registry
	_capacity_guard = capacity_guard if capacity_guard != null else StorageCapacityGuard.new()
	_maintenance_fault_injector = maintenance_fault_injector
	_files = ImmutableJsonFiles.new(Callable(), _capacity_guard)
	_portability = CampaignBundle.new(_data_root, registry, _capacity_guard)


func create_restore_tested_backup(campaign_id: String, created_at_unix: int = -1) -> Dictionary:
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
	var receipt_time := created_at_unix if created_at_unix >= 0 else int(Time.get_unix_time_from_system())
	var receipt_payload := {
		"backup_id": backup_id,
		"campaign_id": campaign_id,
		"campaign_generation": str(state["generation"]),
		"created_at_utc": Time.get_datetime_string_from_unix_time(receipt_time),
		"created_at_unix": str(receipt_time),
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


func maintain_recovery_point(
	campaign_id: String,
	observed_generation: int,
	now_unix: int = -1,
	maximum_age_seconds: int = 60
) -> Dictionary:
	if maximum_age_seconds <= 0:
		return _failure("Das Recovery-Point-Intervall muss positiv sein.")
	var current := FileCampaignStore.new(_data_root, campaign_id).load_state()
	if not current.get("ok", false):
		return current
	var current_generation := int(current["generation"])
	if observed_generation > current_generation:
		return {
			"ok": false,
			"status": "stale_observation",
			"error": "Die beobachtete Campaign-Generation ist noch nicht dauerhaft lesbar.",
			"state": current,
		}
	var effective_now := now_unix if now_unix >= 0 else int(Time.get_unix_time_from_system())
	var listed := list_backups(campaign_id)
	if not listed.get("ok", false):
		return listed
	var newest_backup_time := -1
	for backup in listed["backups"]:
		if int(str(backup.get("campaign_generation", "0"))) == current_generation:
			return {
				"ok": true,
				"status": "current_generation_protected",
				"campaign_id": campaign_id,
				"campaign_generation": current_generation,
			}
		newest_backup_time = maxi(newest_backup_time, int(str(backup.get("created_at_unix", "-1"))))
	if newest_backup_time >= 0 and effective_now - newest_backup_time < maximum_age_seconds:
		return {
			"ok": true,
			"status": "not_due",
			"campaign_id": campaign_id,
			"campaign_generation": current_generation,
			"next_due_at_unix": newest_backup_time + maximum_age_seconds,
		}
	var created := create_restore_tested_backup(campaign_id, effective_now)
	if created.get("ok", false):
		created["campaign_generation"] = current_generation
	return created


func maintain_with_pressure_retention(
	campaign_id: String,
	observed_generation: int,
	now_unix: int = -1,
	maximum_age_seconds: int = 60,
	minimum_verified_points: int = 3
) -> Dictionary:
	var maintained := maintain_recovery_point(
		campaign_id,
		observed_generation,
		now_unix,
		maximum_age_seconds
	)
	if maintained.get("status", "") != "storage_pressure":
		return maintained
	var retention := prune_oldest_verified_backup(campaign_id, minimum_verified_points)
	maintained["retention"] = retention
	if retention.get("status", "") != "oldest_verified_backup_pruned":
		return maintained
	var retry := maintain_recovery_point(
		campaign_id,
		observed_generation,
		now_unix,
		maximum_age_seconds
	)
	retry["retention"] = retention
	return retry


func list_backups(campaign_id: String) -> Dictionary:
	var backup_directory := _backup_directory(campaign_id)
	var directory_error := _files.ensure_directory(backup_directory)
	if directory_error != OK:
		return _failure("Campaign-Backupverzeichnis ist nicht verfügbar.")
	var retention_recovery := _recover_retention_quarantines(campaign_id)
	if not retention_recovery.get("ok", false):
		return retention_recovery
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
	return {
		"ok": true,
		"backups": backups,
		"rejected_backups": rejected,
		"retention_recovery_events": retention_recovery["events"],
	}


func prune_oldest_verified_backup(campaign_id: String, minimum_verified_points: int = 3) -> Dictionary:
	if minimum_verified_points < 2:
		return _failure("Retention muss mindestens zwei restore-getestete Recovery-Punkte bewahren.")
	var listed := list_backups(campaign_id)
	if not listed.get("ok", false):
		return listed
	var backups: Array = listed["backups"]
	if backups.size() <= minimum_verified_points:
		return {
			"ok": true,
			"status": "retention_minimum_preserved",
			"campaign_id": campaign_id,
			"retained_verified_points": backups.size(),
			"rejected_backups": listed["rejected_backups"],
		}
	var candidate: Dictionary = backups[backups.size() - 1]
	var backup_id := str(candidate["backup_id"])
	var backup_directory := _backup_directory(campaign_id)
	var receipt_path := backup_directory + "/" + backup_id + ".verified.json"
	var bundle_path := backup_directory + "/" + str(candidate["bundle_name"])
	var quarantine_root := _data_root + "/staging/backup-retention-" + _files.new_identity()
	var quarantine_error := _files.ensure_directory(quarantine_root)
	if quarantine_error != OK:
		return _failure("Backup-Retention konnte keine isolierte Quarantäne vorbereiten.")
	var quarantined_receipt := quarantine_root + "/receipt.verified.json"
	var quarantined_bundle := quarantine_root + "/backup.saltmarcher"
	if _should_fail("backup_retention", "before_quarantine", backup_id):
		_files.remove_tree(quarantine_root)
		return _failure("Backup-Retention wurde vor der Quarantäne unterbrochen.")
	var receipt_move := DirAccess.rename_absolute(
		_files.absolute(receipt_path),
		_files.absolute(quarantined_receipt)
	)
	if receipt_move != OK:
		_files.remove_tree(quarantine_root)
		return _failure("Ältester Backup-Beleg konnte nicht isoliert werden.")
	if _should_fail("backup_retention", "after_receipt_quarantine", backup_id):
		var receipt_rollback := DirAccess.rename_absolute(
			_files.absolute(quarantined_receipt),
			_files.absolute(receipt_path)
		)
		if receipt_rollback != OK:
			return {
				"ok": false,
				"status": "retention_recovery_required",
				"error": "Unterbrochene Backup-Retention konnte den verifizierten Beleg nicht zurücksetzen.",
				"quarantine_path": quarantine_root,
			}
		_files.remove_tree(quarantine_root)
		return _failure("Backup-Retention wurde nach der Belegquarantäne sicher zurückgesetzt.")
	if _should_fail("backup_retention", "after_receipt_quarantine_without_rollback", backup_id):
		return {
			"ok": false,
			"status": "retention_interrupted",
			"error": "Simulierter Prozessverlust nach der Belegquarantäne.",
			"quarantine_path": quarantine_root,
		}
	var bundle_move := DirAccess.rename_absolute(
		_files.absolute(bundle_path),
		_files.absolute(quarantined_bundle)
	)
	if bundle_move != OK:
		var rollback := DirAccess.rename_absolute(
			_files.absolute(quarantined_receipt),
			_files.absolute(receipt_path)
		)
		if rollback != OK:
			return {
				"ok": false,
				"status": "retention_recovery_required",
				"error": "Backup-Bundle blieb live, aber sein Beleg konnte nicht zurückgesetzt werden.",
				"quarantine_path": quarantine_root,
			}
		_files.remove_tree(quarantine_root)
		return _failure("Ältestes Backup-Bundle konnte nicht isoliert werden; der Beleg wurde zurückgesetzt.")
	if _should_fail("backup_retention", "after_bundle_quarantine_without_cleanup", backup_id):
		return {
			"ok": false,
			"status": "retention_interrupted",
			"error": "Simulierter Prozessverlust nach vollständiger Backup-Quarantäne.",
			"quarantine_path": quarantine_root,
		}
	var receipt_size := FileAccess.get_size(_files.absolute(quarantined_receipt))
	var bundle_size := FileAccess.get_size(_files.absolute(quarantined_bundle))
	var removed := _files.remove_tree(quarantine_root)
	if not removed.get("ok", false):
		return {
			"ok": false,
			"status": "retention_delete_incomplete",
			"error": "Backup wurde aus der sicheren Liste isoliert, aber seine Quarantäne konnte nicht vollständig freigegeben werden.",
			"quarantine_path": quarantine_root,
			"cause": removed,
		}
	return {
		"ok": true,
		"status": "oldest_verified_backup_pruned",
		"campaign_id": campaign_id,
		"backup_id": backup_id,
		"removed_bytes": receipt_size + bundle_size,
		"retained_verified_points": backups.size() - 1,
		"rejected_backups": listed["rejected_backups"],
	}


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
	var created_at_unix := str(payload.get("created_at_unix", ""))
	if not created_at_unix.is_valid_int() or created_at_unix.to_int() < 0:
		return _failure("Backup-Beleg enthält keinen gültigen Erstellungszeitpunkt.")
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


func _recover_retention_quarantines(campaign_id: String) -> Dictionary:
	var staging_root := _data_root + "/staging"
	var absolute_staging := _files.absolute(staging_root)
	if not DirAccess.dir_exists_absolute(absolute_staging):
		return {"ok": true, "events": []}
	var directory := DirAccess.open(absolute_staging)
	if directory == null:
		return _failure("Retention-Staging ist nicht lesbar.")
	var quarantine_names: Array[String] = []
	directory.list_dir_begin()
	var discovered_name := directory.get_next()
	while not discovered_name.is_empty():
		if directory.current_is_dir() and discovered_name.begins_with("backup-retention-"):
			quarantine_names.append(discovered_name)
		discovered_name = directory.get_next()
	directory.list_dir_end()
	quarantine_names.sort()
	var events: Array = []
	for name in quarantine_names:
		var recovered := _recover_retention_quarantine(campaign_id, staging_root + "/" + name)
		if not recovered.get("ok", false):
			return recovered
		if recovered.get("handled", false):
			events.append(recovered["event"])
	return {"ok": true, "events": events}


func _recover_retention_quarantine(campaign_id: String, quarantine_root: String) -> Dictionary:
	var absolute_root := _files.absolute(quarantine_root)
	var files := DirAccess.get_files_at(absolute_root)
	if files.is_empty():
		var empty_removed := _files.remove_tree(quarantine_root)
		if not empty_removed.get("ok", false):
			return empty_removed
		return {
			"ok": true,
			"handled": true,
			"event": {"status": "empty_retention_quarantine_removed"},
		}
	if not "receipt.verified.json" in files:
		return {
			"ok": false,
			"status": "retention_recovery_required",
			"error": "Retention-Quarantäne besitzt keinen identifizierbaren Backup-Beleg.",
			"quarantine_path": quarantine_root,
		}
	var receipt := _read_quarantined_receipt(quarantine_root + "/receipt.verified.json")
	if not receipt.get("ok", false):
		return receipt
	var payload: Dictionary = receipt["backup"]
	if payload.get("campaign_id", "") != campaign_id:
		return {"ok": true, "handled": false}
	var backup_id := str(payload["backup_id"])
	var live_receipt := _backup_directory(campaign_id) + "/" + backup_id + ".verified.json"
	var live_bundle := _backup_directory(campaign_id) + "/" + str(payload["bundle_name"])
	var quarantined_bundle := quarantine_root + "/backup.saltmarcher"
	if FileAccess.file_exists(_files.absolute(quarantined_bundle)):
		if (
			FileAccess.file_exists(_files.absolute(live_receipt))
			or FileAccess.file_exists(_files.absolute(live_bundle))
		):
			return {
				"ok": false,
				"status": "retention_recovery_required",
				"error": "Vollständig quarantiniertes Backup kollidiert mit live vorhandenen Backup-Dateien.",
				"quarantine_path": quarantine_root,
			}
		var completed := _files.remove_tree(quarantine_root)
		if not completed.get("ok", false):
			return completed
		return {
			"ok": true,
			"handled": true,
			"event": {"status": "retention_delete_completed", "backup_id": backup_id},
		}
	if FileAccess.file_exists(_files.absolute(live_receipt)):
		return {
			"ok": false,
			"status": "retention_recovery_required",
			"error": "Retention-Quarantäne kollidiert mit einem bereits live vorhandenen Backup-Beleg.",
			"quarantine_path": quarantine_root,
		}
	var absolute_live_bundle := _files.absolute(live_bundle)
	if (
		not FileAccess.file_exists(absolute_live_bundle)
		or FileAccess.get_size(absolute_live_bundle) != str(payload["bundle_size"]).to_int()
		or FileAccess.get_sha256(absolute_live_bundle) != payload["bundle_sha256"]
	):
		return {
			"ok": false,
			"status": "retention_recovery_required",
			"error": "Retention-Quarantäne kann ihren live verbliebenen Backup-Inhalt nicht sicher bestätigen.",
			"quarantine_path": quarantine_root,
		}
	var rollback := DirAccess.rename_absolute(
		_files.absolute(quarantine_root + "/receipt.verified.json"),
		_files.absolute(live_receipt)
	)
	if rollback != OK:
		return {
			"ok": false,
			"status": "retention_recovery_required",
			"error": "Unterbrochener Backup-Beleg konnte nicht in die sichere Liste zurückgeführt werden.",
			"quarantine_path": quarantine_root,
		}
	var cleanup := _files.remove_tree(quarantine_root)
	if not cleanup.get("ok", false):
		return cleanup
	return {
		"ok": true,
		"handled": true,
		"event": {"status": "retention_rollback_completed", "backup_id": backup_id},
	}


func _read_quarantined_receipt(path: String) -> Dictionary:
	var read := _files.read_json(path)
	if not read.get("ok", false) or not read.get("value") is Dictionary:
		return _failure("Retention-Quarantäne enthält keinen lesbaren Backup-Beleg.")
	var document: Dictionary = read["value"]
	if document.get("format", "") != RECEIPT_FORMAT_ID or not document.get("payload") is Dictionary:
		return _failure("Retention-Quarantäne enthält einen unbekannten Backup-Beleg.")
	var payload: Dictionary = document["payload"]
	if document.get("payload_sha256", "") != _files.checksum(payload):
		return _failure("Retention-Quarantäne enthält einen beschädigten Backup-Beleg.")
	var backup_id := str(payload.get("backup_id", ""))
	var campaign_id := str(payload.get("campaign_id", ""))
	if not _safe_id(backup_id) or not _safe_id(campaign_id):
		return _failure("Retention-Quarantäne enthält unsichere Identitäten.")
	if payload.get("bundle_name", "") != backup_id + ".saltmarcher":
		return _failure("Retention-Quarantäne enthält einen widersprüchlichen Bundle-Namen.")
	return {"ok": true, "backup": payload}


func _should_fail(operation: String, phase: String, subject: String) -> bool:
	return _maintenance_fault_injector.is_valid() and bool(
		_maintenance_fault_injector.call(operation, phase, subject)
	)


func _failure(message: String) -> Dictionary:
	return {"ok": false, "status": "backup_error", "error": message}
