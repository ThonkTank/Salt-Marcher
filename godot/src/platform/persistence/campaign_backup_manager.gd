class_name CampaignBackupManager
extends RefCounted

## Immutable Campaign backups which count only after isolated restore validation.

const ImmutableJsonFiles = preload("res://godot/src/platform/persistence/immutable_json_files.gd")
const FileCampaignStore = preload("res://godot/src/platform/persistence/file_campaign_store.gd")
const CampaignBackupClosure = preload("res://godot/src/platform/persistence/campaign_backup_closure.gd")
const StorageCapacityGuard = preload("res://godot/src/platform/persistence/storage_capacity_guard.gd")

var _data_root: String
var _registry
var _files: ImmutableJsonFiles
var _closure: CampaignBackupClosure
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
	_closure = CampaignBackupClosure.new(_data_root, _capacity_guard)


func create_restore_tested_backup(campaign_id: String, created_at_unix: int = -1) -> Dictionary:
	return _closure.create_restore_tested_point(campaign_id, created_at_unix)


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
	var retention_recovery := _recover_retention_quarantines(campaign_id)
	if not retention_recovery.get("ok", false):
		return retention_recovery
	var listed := _closure.list_points(campaign_id)
	if not listed.get("ok", false):
		return listed
	listed["retention_recovery_events"] = retention_recovery["events"]
	return listed


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
	var point_path := _closure.point_path(campaign_id, backup_id)
	var quarantine_root := _data_root + "/staging/backup-retention-" + _files.new_identity()
	var quarantine_error := _files.ensure_directory(quarantine_root)
	if quarantine_error != OK:
		return _failure("Backup-Retention konnte keine isolierte Quarantäne vorbereiten.")
	var quarantined_point := quarantine_root + "/point.verified.json"
	if _should_fail("backup_retention", "before_quarantine", backup_id):
		_files.remove_tree(quarantine_root)
		return _failure("Backup-Retention wurde vor der Quarantäne unterbrochen.")
	var point_move := DirAccess.rename_absolute(
		_files.absolute(point_path),
		_files.absolute(quarantined_point)
	)
	if point_move != OK:
		_files.remove_tree(quarantine_root)
		return _failure("Ältester Recovery-Punkt konnte nicht isoliert werden.")
	if _should_fail("backup_retention", "after_receipt_quarantine", backup_id):
		var point_rollback := DirAccess.rename_absolute(
			_files.absolute(quarantined_point),
			_files.absolute(point_path)
		)
		if point_rollback != OK:
			return {
				"ok": false,
				"status": "retention_recovery_required",
				"error": "Unterbrochene Backup-Retention konnte den verifizierten Recovery-Punkt nicht zurücksetzen.",
				"quarantine_path": quarantine_root,
			}
		_files.remove_tree(quarantine_root)
		return _failure("Backup-Retention wurde nach der Punktquarantäne sicher zurückgesetzt.")
	if _should_fail("backup_retention", "after_receipt_quarantine_without_rollback", backup_id):
		return {
			"ok": false,
			"status": "retention_interrupted",
			"error": "Simulierter Prozessverlust nach der Punktquarantäne.",
			"quarantine_path": quarantine_root,
		}
	var point_size := FileAccess.get_size(_files.absolute(quarantined_point))
	var removed := _files.remove_tree(quarantine_root)
	if not removed.get("ok", false):
		return {
			"ok": false,
			"status": "retention_delete_incomplete",
			"error": "Recovery-Punkt wurde aus der sicheren Liste isoliert, aber seine Quarantäne konnte nicht vollständig freigegeben werden.",
			"quarantine_path": quarantine_root,
			"cause": removed,
		}
	var collection := _closure.collect_unreferenced_blobs(campaign_id)
	return {
		"ok": true,
		"status": "oldest_verified_backup_pruned",
		"campaign_id": campaign_id,
		"backup_id": backup_id,
		"removed_bytes": point_size + int(collection.get("removed_bytes", 0)),
		"retained_verified_points": backups.size() - 1,
		"rejected_backups": listed["rejected_backups"],
		"blob_collection": collection,
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
	var staged := _closure.stage_point(campaign_id, backup_id, "restore")
	if not staged.get("ok", false):
		return staged

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
		_closure.discard_staging(staged["staging_root"])
		return _failure("Backup konnte nicht als neue Recovery-Generation vorbereitet werden.")

	var restore_id := _files.new_identity()
	var retained_root := _data_root + "/recovery/campaigns/%s/%s" % [campaign_id, restore_id]
	var retained_original := retained_root + "/original"
	var retained_error := _files.ensure_directory(retained_root)
	if retained_error != OK:
		_closure.discard_staging(staged["staging_root"])
		return _failure("Recovery-Aufbewahrung konnte nicht vorbereitet werden.")
	var live_campaign := _data_root + "/campaigns/" + campaign_id
	var move_original := DirAccess.rename_absolute(
		_files.absolute(live_campaign),
		_files.absolute(retained_original)
	)
	if move_original != OK:
		_closure.discard_staging(staged["staging_root"])
		return _failure("Aktuelle Campaign konnte nicht unverändert für den Restore aufbewahrt werden.")
	var promote := DirAccess.rename_absolute(
		_files.absolute(staged["staged_campaign"]),
		_files.absolute(live_campaign)
	)
	if promote != OK:
		DirAccess.rename_absolute(_files.absolute(retained_original), _files.absolute(live_campaign))
		_closure.discard_staging(staged["staging_root"])
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
		_closure.discard_staging(staged["staging_root"])
		return _failure("Veröffentlichter Restore bestand die abschließende Campaign-Validierung nicht.")
	_closure.discard_staging(staged["staging_root"])
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
	if not "point.verified.json" in files:
		return {
			"ok": false,
			"status": "retention_recovery_required",
			"error": "Retention-Quarantäne besitzt keinen identifizierbaren Recovery-Punkt.",
			"quarantine_path": quarantine_root,
		}
	var point := _read_quarantined_point(quarantine_root + "/point.verified.json")
	if not point.get("ok", false):
		return point
	var payload: Dictionary = point["backup"]
	if payload.get("campaign_id", "") != campaign_id:
		return {"ok": true, "handled": false}
	var backup_id := str(payload["backup_id"])
	var live_point := _closure.point_path(campaign_id, backup_id)
	if FileAccess.file_exists(_files.absolute(live_point)):
		return {
			"ok": false,
			"status": "retention_recovery_required",
			"error": "Retention-Quarantäne kollidiert mit einem bereits live vorhandenen Recovery-Punkt.",
			"quarantine_path": quarantine_root,
		}
	var rollback := DirAccess.rename_absolute(
		_files.absolute(quarantine_root + "/point.verified.json"),
		_files.absolute(live_point)
	)
	if rollback != OK:
		return {
			"ok": false,
			"status": "retention_recovery_required",
			"error": "Unterbrochener Recovery-Punkt konnte nicht in die sichere Liste zurückgeführt werden.",
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


func _read_quarantined_point(path: String) -> Dictionary:
	var read := _files.read_json(path)
	if not read.get("ok", false) or not read.get("value") is Dictionary:
		return _failure("Retention-Quarantäne enthält keinen lesbaren Recovery-Punkt.")
	var document: Dictionary = read["value"]
	if document.get("format", "") != CampaignBackupClosure.POINT_FORMAT_ID or not document.get("payload") is Dictionary:
		return _failure("Retention-Quarantäne enthält einen unbekannten Recovery-Punkt.")
	var payload: Dictionary = document["payload"]
	if document.get("payload_sha256", "") != _files.checksum(payload):
		return _failure("Retention-Quarantäne enthält einen beschädigten Recovery-Punkt.")
	var backup_id := str(payload.get("backup_id", ""))
	var campaign_id := str(payload.get("campaign_id", ""))
	if not _safe_id(backup_id) or not _safe_id(campaign_id):
		return _failure("Retention-Quarantäne enthält unsichere Identitäten.")
	if payload.get("restore_tested", false) != true:
		return _failure("Retention-Quarantäne enthält keinen restore-getesteten Recovery-Punkt.")
	return {"ok": true, "backup": payload}


func _should_fail(operation: String, phase: String, subject: String) -> bool:
	return _maintenance_fault_injector.is_valid() and bool(
		_maintenance_fault_injector.call(operation, phase, subject)
	)


func _failure(message: String) -> Dictionary:
	return {"ok": false, "status": "backup_error", "error": message}
