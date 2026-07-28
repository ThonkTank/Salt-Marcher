class_name CampaignBackupManager
extends RefCounted

## Immutable Campaign backups which count only after isolated restore validation.

const ImmutableJsonFiles = preload("res://godot/src/platform/persistence/immutable_json_files.gd")
const FileCampaignStore = preload("res://godot/src/platform/persistence/file_campaign_store.gd")
const CampaignBackupClosure = preload("res://godot/src/platform/persistence/campaign_backup_closure.gd")
const StorageCapacityGuard = preload("res://godot/src/platform/persistence/storage_capacity_guard.gd")

const DEFAULT_RETENTION_POLICY := {
	"minimum_verified_points": 3,
	"maximum_verified_points": 160,
	"keep_all_seconds": 60 * 60,
	"tiers": [
		{"until_age_seconds": 24 * 60 * 60, "spacing_seconds": 60 * 60},
		{"until_age_seconds": 30 * 24 * 60 * 60, "spacing_seconds": 24 * 60 * 60},
		{"until_age_seconds": 26 * 7 * 24 * 60 * 60, "spacing_seconds": 7 * 24 * 60 * 60},
	],
}
const COMPACTION_RECEIPT_FORMAT_ID := "saltmarcher.campaign-compaction-receipt.v1"
const COMPACTION_COMMIT_FORMAT_ID := "saltmarcher.campaign-compaction-commit.v1"

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
		if maintained.get("ok", false):
			var normal_retention := apply_normal_retention(campaign_id, now_unix)
			maintained["retention"] = normal_retention
			if not normal_retention.get("ok", false):
				return {
					"ok": false,
					"status": "backup_retention_failed",
					"error": normal_retention.get("error", "Normale Backup-Retention ist fehlgeschlagen."),
					"recovery_point": maintained,
					"retention": normal_retention,
				}
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


func apply_normal_retention(
	campaign_id: String,
	now_unix: int = -1,
	policy: Dictionary = {}
) -> Dictionary:
	var normalized := _normalized_retention_policy(policy)
	if not normalized.get("ok", false):
		return normalized
	var listed := list_backups(campaign_id)
	if not listed.get("ok", false):
		return listed
	var backups: Array = listed["backups"].duplicate(true)
	backups.sort_custom(Callable(self, "_backup_is_newer"))
	var minimum_points := int(normalized["minimum_verified_points"])
	if backups.size() <= minimum_points:
		return {
			"ok": true,
			"status": "retention_current",
			"campaign_id": campaign_id,
			"removed_backup_ids": [],
			"removed_bytes": 0,
			"retained_verified_points": backups.size(),
			"policy": normalized["policy"],
		}
	var effective_now := now_unix if now_unix >= 0 else int(Time.get_unix_time_from_system())
	var retained: Dictionary = {}
	var recovery_order: Array = backups.duplicate(true)
	recovery_order.sort_custom(Callable(self, "_backup_is_recovery_newer"))
	var minimum_protected := _minimum_recovery_point_ids(recovery_order, minimum_points)
	for protected_id in minimum_protected:
		retained[protected_id] = true
	var occupied_buckets: Dictionary = {}
	for backup in backups:
		var backup_id := str(backup["backup_id"])
		if retained.has(backup_id):
			continue
		var created_at := int(str(backup["created_at_unix"]))
		var age := maxi(0, effective_now - created_at)
		if age <= int(normalized["keep_all_seconds"]):
			retained[backup_id] = true
			continue
		var tier := _retention_tier_for_age(age, normalized["tiers"])
		if tier.is_empty():
			continue
		var spacing := int(tier["spacing_seconds"])
		var bucket_key := "%d:%d" % [int(tier["until_age_seconds"]), floori(float(created_at) / float(spacing))]
		if not occupied_buckets.has(bucket_key):
			occupied_buckets[bucket_key] = true
			retained[backup_id] = true

	var maximum_points := int(normalized["maximum_verified_points"])
	var retained_count := retained.size()
	if retained_count > maximum_points:
		for reverse_index in range(backups.size() - 1, -1, -1):
			if retained_count <= maximum_points:
				break
			var capped_id := str(backups[reverse_index]["backup_id"])
			if not minimum_protected.has(capped_id) and retained.erase(capped_id):
				retained_count -= 1

	var removed_ids: Array[String] = []
	var removed_bytes := 0
	for reverse_index in range(backups.size() - 1, -1, -1):
		var candidate_id := str(backups[reverse_index]["backup_id"])
		if retained.has(candidate_id):
			continue
		var pruned := prune_verified_backup(campaign_id, candidate_id, minimum_points)
		if not pruned.get("ok", false):
			return {
				"ok": false,
				"status": "retention_incomplete",
				"error": pruned.get("error", "Zeitgestufte Retention wurde unterbrochen."),
				"campaign_id": campaign_id,
				"removed_backup_ids": removed_ids,
				"removed_bytes": removed_bytes,
				"cause": pruned,
			}
		removed_ids.append(candidate_id)
		removed_bytes += int(pruned.get("removed_bytes", 0))
	return {
		"ok": true,
		"status": "retention_applied" if not removed_ids.is_empty() else "retention_current",
		"campaign_id": campaign_id,
		"removed_backup_ids": removed_ids,
		"removed_bytes": removed_bytes,
		"retained_verified_points": backups.size() - removed_ids.size(),
		"policy": normalized["policy"],
	}


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
	backups.sort_custom(Callable(self, "_backup_is_newer"))
	var recovery_order: Array = backups.duplicate(true)
	recovery_order.sort_custom(Callable(self, "_backup_is_recovery_newer"))
	var protected := _minimum_recovery_point_ids(recovery_order, minimum_verified_points)
	for reverse_index in range(backups.size() - 1, -1, -1):
		var candidate_id := str(backups[reverse_index]["backup_id"])
		if not protected.has(candidate_id):
			return prune_verified_backup(campaign_id, candidate_id, minimum_verified_points)
	return {
		"ok": true,
		"status": "retention_minimum_preserved",
		"campaign_id": campaign_id,
		"retained_verified_points": backups.size(),
		"rejected_backups": listed["rejected_backups"],
	}


func prune_verified_backup(
	campaign_id: String,
	backup_id: String,
	minimum_verified_points: int = 3
) -> Dictionary:
	if minimum_verified_points < 2:
		return _failure("Retention muss mindestens zwei restore-getestete Recovery-Punkte bewahren.")
	var listed := list_backups(campaign_id)
	if not listed.get("ok", false):
		return listed
	var backups: Array = listed["backups"]
	backups.sort_custom(Callable(self, "_backup_is_recovery_newer"))
	if backups.size() <= minimum_verified_points:
		return {
			"ok": true,
			"status": "retention_minimum_preserved",
			"campaign_id": campaign_id,
			"retained_verified_points": backups.size(),
			"rejected_backups": listed["rejected_backups"],
		}
	var candidate_exists := false
	for backup in backups:
		if str(backup["backup_id"]) == backup_id:
			candidate_exists = true
			break
	if not candidate_exists:
		return _failure("Der angeforderte Recovery-Punkt ist nicht verifiziert verfügbar.")
	if _minimum_recovery_point_ids(backups, minimum_verified_points).has(backup_id):
		return _failure("Retention darf keinen der neuesten Mindest-Recovery-Punkte entfernen.")
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
	var committed_quarantine := _data_root + "/staging/backup-retention-committed-" + _files.new_identity()
	var commit_quarantine := DirAccess.rename_absolute(
		_files.absolute(quarantine_root),
		_files.absolute(committed_quarantine)
	)
	if commit_quarantine != OK:
		var commit_rollback := DirAccess.rename_absolute(
			_files.absolute(quarantined_point),
			_files.absolute(point_path)
		)
		if commit_rollback != OK:
			return {
				"ok": false,
				"status": "retention_recovery_required",
				"error": "Backup-Retention konnte weder entschieden noch sicher zurückgesetzt werden.",
				"quarantine_path": quarantine_root,
			}
		_files.remove_tree(quarantine_root)
		return _failure("Backup-Retention konnte ihren Commit-Tombstone nicht veröffentlichen.")
	if _should_fail("backup_retention", "after_commit_tombstone", backup_id):
		return {
			"ok": false,
			"status": "retention_cleanup_pending",
			"error": "Simulierter Prozessverlust nach dem Retention-Commit-Tombstone.",
			"quarantine_path": committed_quarantine,
		}
	var removed := _files.remove_tree(committed_quarantine)
	if not removed.get("ok", false):
		return {
			"ok": false,
			"status": "retention_delete_incomplete",
			"error": "Recovery-Punkt wurde aus der sicheren Liste isoliert, aber seine Quarantäne konnte nicht vollständig freigegeben werden.",
			"quarantine_path": committed_quarantine,
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


func compact_campaign_history(
	campaign_id: String,
	expected_campaign_generation: int,
	activation_is_revoked: bool,
	minimum_local_generations: int = 3,
	created_at_unix: int = -1
) -> Dictionary:
	if not activation_is_revoked:
		return _failure("Campaign-Compaction erfordert zuvor widerrufene Schreibautorität.")
	if minimum_local_generations < 2:
		return _failure("Campaign-Compaction muss mindestens zwei lokale Generationen bewahren.")
	var recovered := _recover_compaction_quarantines(campaign_id)
	if not recovered.get("ok", false):
		return recovered
	var store := FileCampaignStore.new(_data_root, campaign_id)
	var current := store.load_state()
	if not current.get("ok", false):
		return current
	if int(current["generation"]) != expected_campaign_generation:
		return {"ok": false, "status": "stale", "error": "Campaign wurde inzwischen geändert.", "state": current}
	var inventory := store.generation_inventory()
	if not inventory.get("ok", false):
		return inventory
	if not inventory["rejected_generations"].is_empty():
		return {
			"ok": true,
			"status": "compaction_deferred_for_damage",
			"campaign_id": campaign_id,
			"rejected_generations": inventory["rejected_generations"],
			"recovery_events": recovered["events"],
		}
	var valid_generations: Array = inventory["valid_generations"]
	valid_generations.sort_custom(func(left: Dictionary, right: Dictionary) -> bool:
		return int(left["generation"]) > int(right["generation"])
	)
	if valid_generations.size() <= minimum_local_generations:
		return {
			"ok": true,
			"status": "compaction_current",
			"campaign_id": campaign_id,
			"retained_local_generations": valid_generations.size(),
			"removed_files": 0,
			"removed_bytes": 0,
			"recovery_events": recovered["events"],
		}
	var protected_point := _current_generation_backup(campaign_id, expected_campaign_generation)
	if not protected_point.get("ok", false):
		return protected_point
	var plan := _build_compaction_plan(store, valid_generations, minimum_local_generations)
	if not plan.get("ok", false):
		return plan
	var candidates: Array = plan["candidates"]
	if candidates.is_empty():
		return {
			"ok": true,
			"status": "compaction_current",
			"campaign_id": campaign_id,
			"retained_local_generations": minimum_local_generations,
			"removed_files": 0,
			"removed_bytes": 0,
			"recovery_events": recovered["events"],
		}
	var point_validation := _validate_compaction_candidates_against_backup(
		store.campaign_directory(),
		candidates,
		protected_point["backup"]
	)
	if not point_validation.get("ok", false):
		return point_validation
	var operation_id := _files.new_identity()
	var staging_root := _data_root + "/staging/campaign-compaction-" + operation_id
	var quarantine_root := staging_root + "/quarantine"
	if _files.ensure_directory(quarantine_root) != OK:
		return _failure("Campaign-Compaction konnte keine Quarantäne vorbereiten.")
	var receipt_payload := {
		"operation_id": operation_id,
		"campaign_id": campaign_id,
		"expected_generation": str(expected_campaign_generation),
		"protected_backup_id": str(protected_point["backup"]["backup_id"]),
		"candidates": candidates,
	}
	var receipt_write := _files.write_new_json(
		staging_root + "/receipt.json",
		_envelope(COMPACTION_RECEIPT_FORMAT_ID, receipt_payload),
		"campaign_compaction_receipt"
	)
	if not receipt_write.get("ok", false):
		_files.remove_tree(staging_root)
		return receipt_write
	if _should_fail("campaign_compaction", "before_quarantine", operation_id):
		_files.remove_tree(staging_root)
		return _failure("Campaign-Compaction wurde vor der Quarantäne unterbrochen.")
	var moved := _quarantine_compaction_candidates(store.campaign_directory(), quarantine_root, candidates)
	if not moved.get("ok", false):
		var rollback := _rollback_compaction(staging_root, receipt_payload)
		if not rollback.get("ok", false):
			return rollback
		return moved
	if _should_fail("campaign_compaction", "after_quarantine_without_rollback", operation_id):
		return {
			"ok": false,
			"status": "compaction_interrupted",
			"error": "Simulierter Prozessverlust nach der Campaign-Quarantäne.",
			"quarantine_path": staging_root,
		}
	var compacted_state := store.load_state()
	if not compacted_state.get("ok", false) or int(compacted_state.get("generation", -1)) != expected_campaign_generation:
		var invalid_rollback := _rollback_compaction(staging_root, receipt_payload)
		if not invalid_rollback.get("ok", false):
			return invalid_rollback
		return _failure("Campaign-Compaction veränderte die aktive Campaign-Wahrheit.")
	var compact_backup := create_restore_tested_backup(campaign_id, created_at_unix)
	if not compact_backup.get("ok", false):
		var backup_rollback := _rollback_compaction(staging_root, receipt_payload)
		if not backup_rollback.get("ok", false):
			return backup_rollback
		return {
			"ok": false,
			"status": "compaction_backup_failed",
			"error": "Kompaktierte Campaign konnte nicht als neuer Recovery-Punkt verifiziert werden.",
			"cause": compact_backup,
		}
	var commit_payload := {
		"operation_id": operation_id,
		"campaign_id": campaign_id,
		"expected_generation": str(expected_campaign_generation),
		"compacted_backup_id": str(compact_backup["backup"]["backup_id"]),
	}
	var marker := _files.write_new_json(
		staging_root + "/committed.json",
		_envelope(COMPACTION_COMMIT_FORMAT_ID, commit_payload),
		"campaign_compaction_commit"
	)
	if not marker.get("ok", false):
		var marker_rollback := _rollback_compaction(staging_root, receipt_payload)
		if not marker_rollback.get("ok", false):
			return marker_rollback
		return marker
	if _should_fail("campaign_compaction", "after_commit_marker", operation_id):
		return {
			"ok": false,
			"status": "compaction_cleanup_pending",
			"error": "Campaign-Compaction wurde nach ihrem Commit-Marker unterbrochen.",
			"quarantine_path": staging_root,
		}
	var cleanup := _finalize_compaction_quarantine(staging_root, "committed")
	if not cleanup.get("ok", false):
		return cleanup
	var removed_bytes := 0
	for candidate in candidates:
		removed_bytes += int(str(candidate["size"]))
	return {
		"ok": true,
		"status": "campaign_compacted",
		"campaign_id": campaign_id,
		"generation": expected_campaign_generation,
		"removed_files": candidates.size(),
		"removed_bytes": removed_bytes,
		"retained_local_generations": mini(minimum_local_generations, valid_generations.size()),
		"backup": compact_backup,
		"recovery_events": recovered["events"],
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
		if name.begins_with("backup-retention-committed-"):
			var finalized := _files.remove_tree(staging_root + "/" + name)
			if not finalized.get("ok", false):
				return finalized
			events.append({"status": "retention_cleanup_completed"})
			continue
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


func _normalized_retention_policy(policy: Dictionary) -> Dictionary:
	var configured: Dictionary = DEFAULT_RETENTION_POLICY.duplicate(true)
	for key in policy:
		configured[key] = policy[key]
	var minimum_points := int(configured.get("minimum_verified_points", 0))
	var maximum_points := int(configured.get("maximum_verified_points", 0))
	var keep_all_seconds := int(configured.get("keep_all_seconds", -1))
	if minimum_points < 2 or maximum_points < minimum_points or keep_all_seconds < 0:
		return _failure("Backup-Retention besitzt keine sichere Mindest-, Höchst- oder Zeitgrenze.")
	if not configured.get("tiers") is Array:
		return _failure("Backup-Retention besitzt keine gültigen Zeitstufen.")
	var tiers: Array = configured["tiers"].duplicate(true)
	tiers.sort_custom(func(left: Dictionary, right: Dictionary) -> bool:
		return int(left.get("until_age_seconds", -1)) < int(right.get("until_age_seconds", -1))
	)
	var previous_until := keep_all_seconds
	for tier_value in tiers:
		if not tier_value is Dictionary:
			return _failure("Backup-Retention enthält eine ungültige Zeitstufe.")
		var tier: Dictionary = tier_value
		var until_age := int(tier.get("until_age_seconds", -1))
		var spacing := int(tier.get("spacing_seconds", 0))
		if until_age <= previous_until or spacing <= 0:
			return _failure("Backup-Retention-Zeitstufen müssen positiv und streng aufsteigend sein.")
		previous_until = until_age
	var normalized_policy := {
		"minimum_verified_points": minimum_points,
		"maximum_verified_points": maximum_points,
		"keep_all_seconds": keep_all_seconds,
		"tiers": tiers,
	}
	return {
		"ok": true,
		"minimum_verified_points": minimum_points,
		"maximum_verified_points": maximum_points,
		"keep_all_seconds": keep_all_seconds,
		"tiers": tiers,
		"policy": normalized_policy,
	}


func _retention_tier_for_age(age_seconds: int, tiers: Array) -> Dictionary:
	for tier_value in tiers:
		var tier: Dictionary = tier_value
		if age_seconds <= int(tier["until_age_seconds"]):
			return tier
	return {}


func _backup_is_newer(left: Dictionary, right: Dictionary) -> bool:
	var left_time := int(str(left.get("created_at_unix", "-1")))
	var right_time := int(str(right.get("created_at_unix", "-1")))
	if left_time != right_time:
		return left_time > right_time
	var left_generation := int(str(left.get("campaign_generation", "-1")))
	var right_generation := int(str(right.get("campaign_generation", "-1")))
	if left_generation != right_generation:
		return left_generation > right_generation
	return str(left.get("backup_id", "")) > str(right.get("backup_id", ""))


func _backup_is_recovery_newer(left: Dictionary, right: Dictionary) -> bool:
	var left_generation := int(str(left.get("campaign_generation", "-1")))
	var right_generation := int(str(right.get("campaign_generation", "-1")))
	if left_generation != right_generation:
		return left_generation > right_generation
	return _backup_is_newer(left, right)


func _minimum_recovery_point_ids(recovery_order: Array, minimum_points: int) -> Dictionary:
	var protected: Dictionary = {}
	var protected_generations: Dictionary = {}
	for backup in recovery_order:
		if protected.size() >= minimum_points:
			break
		var generation := str(backup.get("campaign_generation", ""))
		if protected_generations.has(generation):
			continue
		protected_generations[generation] = true
		protected[str(backup["backup_id"])] = true
	if protected.size() < minimum_points:
		for backup in recovery_order:
			if protected.size() >= minimum_points:
				break
			protected[str(backup["backup_id"])] = true
	return protected


func _current_generation_backup(campaign_id: String, generation: int) -> Dictionary:
	var listed := list_backups(campaign_id)
	if not listed.get("ok", false):
		return listed
	var matches: Array = []
	for backup in listed["backups"]:
		if int(str(backup.get("campaign_generation", "-1"))) == generation:
			matches.append(backup)
	if matches.is_empty():
		return {
			"ok": false,
			"status": "compaction_backup_required",
			"error": "Campaign-Compaction benötigt zuerst einen restore-getesteten Punkt der aktiven Generation.",
			"campaign_id": campaign_id,
			"generation": generation,
		}
	matches.sort_custom(Callable(self, "_backup_is_newer"))
	return {"ok": true, "backup": matches[0]}


func _build_compaction_plan(
	store: FileCampaignStore,
	valid_generations: Array,
	minimum_local_generations: int
) -> Dictionary:
	var retained_paths: Dictionary = {}
	for index in mini(minimum_local_generations, valid_generations.size()):
		var state: Dictionary = valid_generations[index]
		retained_paths[_relative_commit_path(int(state["generation"]))] = true
		for reference_value in state["partition_refs"].values():
			retained_paths[str(reference_value.get("path", ""))] = true
		for reference_value in state.get("asset_refs", {}).values():
			retained_paths[str(reference_value.get("path", ""))] = true
		for owner_refs_value in state.get("chunk_refs", {}).values():
			for reference_value in owner_refs_value.values():
				retained_paths[str(reference_value.get("path", ""))] = true
	var candidate_paths: Array[String] = []
	for index in range(minimum_local_generations, valid_generations.size()):
		candidate_paths.append(_relative_commit_path(int(valid_generations[index]["generation"])))
	var object_files := _collect_compactable_object_files(store.campaign_directory() + "/objects")
	if not object_files.get("ok", false):
		return object_files
	for object_path in object_files["paths"]:
		if not retained_paths.has(object_path):
			candidate_paths.append(object_path)
	for binary_root in ["assets", "chunks"]:
		var binary_files := _collect_compactable_binary_files(
			store.campaign_directory() + "/" + binary_root,
			binary_root
		)
		if not binary_files.get("ok", false):
			return binary_files
		for binary_path in binary_files["paths"]:
			if not retained_paths.has(binary_path):
				candidate_paths.append(binary_path)
	candidate_paths.sort()
	var candidates: Array = []
	for relative_path in candidate_paths:
		var absolute_path := _files.absolute(store.campaign_directory() + "/" + relative_path)
		if not FileAccess.file_exists(absolute_path):
			return _failure("Campaign-Compaction-Kandidat ist nicht mehr lesbar.")
		var checksum := FileAccess.get_sha256(absolute_path)
		if checksum.length() != 64:
			return _failure("Campaign-Compaction-Kandidat besitzt keine lesbare Prüfsumme.")
		candidates.append({
			"path": relative_path,
			"size": str(FileAccess.get_size(absolute_path)),
			"sha256": checksum,
		})
	return {"ok": true, "candidates": candidates}


func _collect_compactable_object_files(objects_root: String) -> Dictionary:
	var paths: Array[String] = []
	var absolute_root := _files.absolute(objects_root)
	if not DirAccess.dir_exists_absolute(absolute_root):
		return {"ok": true, "paths": paths}
	var collected := _collect_compactable_object_files_recursive(absolute_root, "", paths)
	if not collected.get("ok", false):
		return collected
	paths.sort()
	return {"ok": true, "paths": paths}


func _collect_compactable_object_files_recursive(
	absolute_root: String,
	relative_directory: String,
	paths: Array[String]
) -> Dictionary:
	var absolute_directory := absolute_root if relative_directory.is_empty() else absolute_root + "/" + relative_directory
	var directory := DirAccess.open(absolute_directory)
	if directory == null:
		return _failure("Campaign-Objektverzeichnis ist für Compaction nicht lesbar.")
	directory.list_dir_begin()
	var name := directory.get_next()
	while not name.is_empty():
		var relative_path := name if relative_directory.is_empty() else relative_directory + "/" + name
		if directory.is_link(name):
			directory.list_dir_end()
			return _failure("Campaign-Compaction folgt keinen symbolischen Links.")
		if directory.current_is_dir():
			var nested := _collect_compactable_object_files_recursive(absolute_root, relative_path, paths)
			if not nested.get("ok", false):
				directory.list_dir_end()
				return nested
		elif not name.ends_with(".json") or name.contains(".pending-"):
			directory.list_dir_end()
			return _failure("Campaign-Compaction fand eine unbekannte Objektdatei und bricht sicher ab.")
		else:
			paths.append("objects/" + relative_path)
		name = directory.get_next()
	directory.list_dir_end()
	return {"ok": true}


func _collect_compactable_binary_files(root: String, prefix: String) -> Dictionary:
	var paths: Array[String] = []
	var absolute_root := _files.absolute(root)
	if not DirAccess.dir_exists_absolute(absolute_root):
		return {"ok": true, "paths": paths}
	var collected := _collect_compactable_binary_files_recursive(absolute_root, "", prefix, paths)
	if not collected.get("ok", false):
		return collected
	paths.sort()
	return {"ok": true, "paths": paths}


func _collect_compactable_binary_files_recursive(
	absolute_root: String,
	relative_directory: String,
	prefix: String,
	paths: Array[String]
) -> Dictionary:
	var absolute_directory := absolute_root if relative_directory.is_empty() else absolute_root + "/" + relative_directory
	var directory := DirAccess.open(absolute_directory)
	if directory == null:
		return _failure("Campaign-Binärverzeichnis ist für Compaction nicht lesbar.")
	directory.list_dir_begin()
	var name := directory.get_next()
	while not name.is_empty():
		var relative_path := name if relative_directory.is_empty() else relative_directory + "/" + name
		if directory.is_link(name):
			directory.list_dir_end()
			return _failure("Campaign-Compaction folgt keinen symbolischen Binärlinks.")
		if directory.current_is_dir():
			var nested := _collect_compactable_binary_files_recursive(
				absolute_root,
				relative_path,
				prefix,
				paths
			)
			if not nested.get("ok", false):
				directory.list_dir_end()
				return nested
		else:
			var campaign_path := prefix + "/" + relative_path
			if not _safe_binary_compaction_path(campaign_path):
				directory.list_dir_end()
				return _failure("Campaign-Compaction fand eine unbekannte Asset- oder Chunk-Datei und bricht sicher ab.")
			paths.append(campaign_path)
		name = directory.get_next()
	directory.list_dir_end()
	return {"ok": true}


func _validate_compaction_candidates_against_backup(
	campaign_root: String,
	candidates: Array,
	backup: Dictionary
) -> Dictionary:
	var backed_files: Dictionary = {}
	for entry in backup["files"]:
		backed_files[str(entry["path"])] = entry
	for candidate in candidates:
		var relative_path := str(candidate["path"])
		if not backed_files.has(relative_path):
			return _failure("Recovery-Punkt deckt einen Compaction-Kandidaten nicht ab.")
		var backed: Dictionary = backed_files[relative_path]
		if (
			str(backed.get("size", "")) != str(candidate["size"])
			or str(backed.get("sha256", "")) != str(candidate["sha256"])
		):
			return _failure("Recovery-Punkt und Compaction-Kandidat enthalten nicht dieselben Bytes.")
		var absolute_path := _files.absolute(campaign_root + "/" + relative_path)
		if (
			FileAccess.get_size(absolute_path) != int(str(candidate["size"]))
			or FileAccess.get_sha256(absolute_path) != str(candidate["sha256"])
		):
			return _failure("Campaign-Compaction-Kandidat änderte sich nach der Planung.")
	return {"ok": true}


func _quarantine_compaction_candidates(
	campaign_root: String,
	quarantine_root: String,
	candidates: Array
) -> Dictionary:
	for candidate in candidates:
		var relative_path := str(candidate["path"])
		var destination := quarantine_root + "/" + relative_path
		if _files.ensure_directory(destination.get_base_dir()) != OK:
			return _failure("Campaign-Compaction konnte einen Quarantänepfad nicht vorbereiten.")
		var source := campaign_root + "/" + relative_path
		if DirAccess.rename_absolute(_files.absolute(source), _files.absolute(destination)) != OK:
			return _failure("Campaign-Compaction konnte einen Kandidaten nicht isolieren.")
	return {"ok": true}


func _recover_compaction_quarantines(campaign_id: String) -> Dictionary:
	var staging_root := _data_root + "/staging"
	var absolute_staging := _files.absolute(staging_root)
	if not DirAccess.dir_exists_absolute(absolute_staging):
		return {"ok": true, "events": []}
	var directory := DirAccess.open(absolute_staging)
	if directory == null:
		return _failure("Compaction-Staging ist nicht lesbar.")
	var names: Array[String] = []
	directory.list_dir_begin()
	var name := directory.get_next()
	while not name.is_empty():
		if directory.current_is_dir() and name.begins_with("campaign-compaction-"):
			names.append(name)
		name = directory.get_next()
	directory.list_dir_end()
	names.sort()
	var events: Array = []
	for candidate_name in names:
		if (
			candidate_name.begins_with("campaign-compaction-committed-")
			or candidate_name.begins_with("campaign-compaction-rolled-back-")
		):
			var tombstone_cleanup := _files.remove_tree(staging_root + "/" + candidate_name)
			if not tombstone_cleanup.get("ok", false):
				return tombstone_cleanup
			events.append({"status": "compaction_tombstone_cleanup_completed"})
			continue
		var recovered := _recover_compaction_quarantine(campaign_id, staging_root + "/" + candidate_name)
		if not recovered.get("ok", false):
			return recovered
		if recovered.get("handled", false):
			events.append(recovered["event"])
	return {"ok": true, "events": events}


func _recover_compaction_quarantine(campaign_id: String, staging_root: String) -> Dictionary:
	var receipt := _read_compaction_document(staging_root + "/receipt.json", COMPACTION_RECEIPT_FORMAT_ID)
	if not receipt.get("ok", false):
		return receipt
	var payload: Dictionary = receipt["payload"]
	if str(payload.get("campaign_id", "")) != campaign_id:
		return {"ok": true, "handled": false}
	var marker_path := _files.absolute(staging_root + "/committed.json")
	if FileAccess.file_exists(marker_path):
		var marker := _read_compaction_document(staging_root + "/committed.json", COMPACTION_COMMIT_FORMAT_ID)
		if not marker.get("ok", false):
			return marker
		if (
			str(marker["payload"].get("operation_id", "")) != str(payload.get("operation_id", ""))
			or str(marker["payload"].get("campaign_id", "")) != campaign_id
		):
			return _failure("Compaction-Commit-Marker widerspricht seinem Quarantänebeleg.")
		var finalized := _finalize_compaction_quarantine(staging_root, "committed")
		if not finalized.get("ok", false):
			return finalized
		return {
			"ok": true,
			"handled": true,
			"event": {"status": "compaction_cleanup_completed", "operation_id": payload["operation_id"]},
		}
	var rollback := _rollback_compaction(staging_root, payload)
	if not rollback.get("ok", false):
		return rollback
	return {
		"ok": true,
		"handled": true,
		"event": {"status": "compaction_rollback_completed", "operation_id": payload["operation_id"]},
	}


func _rollback_compaction(staging_root: String, payload: Dictionary) -> Dictionary:
	var campaign_id := str(payload.get("campaign_id", ""))
	var campaign_root := _data_root + "/campaigns/" + campaign_id
	var candidates: Array = payload.get("candidates", [])
	for reverse_index in range(candidates.size() - 1, -1, -1):
		var candidate: Dictionary = candidates[reverse_index]
		var relative_path := str(candidate["path"])
		var source := staging_root + "/quarantine/" + relative_path
		var destination := campaign_root + "/" + relative_path
		var absolute_source := _files.absolute(source)
		var absolute_destination := _files.absolute(destination)
		if not FileAccess.file_exists(absolute_source):
			if (
				not FileAccess.file_exists(absolute_destination)
				or FileAccess.get_size(absolute_destination) != int(str(candidate["size"]))
				or FileAccess.get_sha256(absolute_destination) != str(candidate["sha256"])
			):
				return _failure("Campaign-Compaction-Rollback vermisst Original und Quarantänekopie.")
			continue
		if FileAccess.file_exists(absolute_destination):
			return _failure("Campaign-Compaction-Rollback kollidiert mit einer vorhandenen Datei.")
		if _files.ensure_directory(destination.get_base_dir()) != OK:
			return _failure("Campaign-Compaction-Rollback konnte den Originalpfad nicht vorbereiten.")
		if DirAccess.rename_absolute(absolute_source, absolute_destination) != OK:
			return _failure("Campaign-Compaction-Rollback konnte einen Kandidaten nicht zurückführen.")
	var cleanup := _finalize_compaction_quarantine(staging_root, "rolled-back")
	if not cleanup.get("ok", false):
		return cleanup
	return {"ok": true}


func _finalize_compaction_quarantine(staging_root: String, outcome: String) -> Dictionary:
	var original_name := staging_root.get_file()
	var identity := original_name.trim_prefix("campaign-compaction-")
	var tombstone := staging_root.get_base_dir() + "/campaign-compaction-%s-%s" % [outcome, identity]
	if DirAccess.rename_absolute(_files.absolute(staging_root), _files.absolute(tombstone)) != OK:
		return _failure("Campaign-Compaction konnte ihren eindeutigen Abschluss-Tombstone nicht veröffentlichen.")
	return _files.remove_tree(tombstone)


func _read_compaction_document(path: String, expected_format: String) -> Dictionary:
	var read := _files.read_json(path)
	if not read.get("ok", false) or not read.get("value") is Dictionary:
		return _failure("Compaction-Quarantäne besitzt keinen lesbaren Beleg.")
	var document: Dictionary = read["value"]
	if document.get("format", "") != expected_format or not document.get("payload") is Dictionary:
		return _failure("Compaction-Quarantäne besitzt ein unbekanntes Belegformat.")
	var payload: Dictionary = document["payload"]
	if document.get("payload_sha256", "") != _files.checksum(payload):
		return _failure("Compaction-Quarantäne besitzt einen beschädigten Beleg.")
	if expected_format == COMPACTION_RECEIPT_FORMAT_ID:
		if not _safe_id(str(payload.get("campaign_id", ""))) or not payload.get("candidates") is Array:
			return _failure("Compaction-Quarantäne besitzt eine unsichere Campaign-Identität oder Kandidatenliste.")
		for candidate_value in payload["candidates"]:
			if not candidate_value is Dictionary:
				return _failure("Compaction-Quarantäne besitzt einen ungültigen Kandidaten.")
			var candidate: Dictionary = candidate_value
			if (
				not _safe_compaction_path(str(candidate.get("path", "")))
				or not str(candidate.get("size", "")).is_valid_int()
				or int(str(candidate["size"])) < 0
				or not _valid_sha256(str(candidate.get("sha256", "")))
			):
				return _failure("Compaction-Quarantäne besitzt unsichere Kandidatenmetadaten.")
	return {"ok": true, "payload": payload}


func _relative_commit_path(generation: int) -> String:
	return "commits/generation-%020d.json" % generation


func _safe_compaction_path(path: String) -> bool:
	if not (
		path.begins_with("commits/")
		or path.begins_with("objects/")
		or path.begins_with("assets/")
		or path.begins_with("chunks/")
	):
		return false
	if path.begins_with("/") or path.contains("\\") or path.contains(":"):
		return false
	for segment in path.split("/", false):
		if segment.is_empty() or segment == "." or segment == "..":
			return false
	return true


func _safe_binary_compaction_path(path: String) -> bool:
	if not _safe_compaction_path(path) or path.contains(".pending-"):
		return false
	var segments := path.split("/", false)
	if path.begins_with("assets/"):
		return segments.size() == 3
	if path.begins_with("chunks/"):
		return segments.size() == 4 and str(segments[3]).ends_with(".bin")
	return false


func _valid_sha256(value: String) -> bool:
	if value.length() != 64:
		return false
	for index in value.length():
		var code := value.unicode_at(index)
		if not ((code >= 48 and code <= 57) or (code >= 97 and code <= 102)):
			return false
	return true


func _envelope(format_id: String, payload: Dictionary) -> Dictionary:
	return {
		"format": format_id,
		"payload": payload,
		"payload_sha256": _files.checksum(payload),
	}


func _should_fail(operation: String, phase: String, subject: String) -> bool:
	return _maintenance_fault_injector.is_valid() and bool(
		_maintenance_fault_injector.call(operation, phase, subject)
	)


func _failure(message: String) -> Dictionary:
	return {"ok": false, "status": "backup_error", "error": message}
