class_name CampaignBackupScheduler
extends Node

## Keeps changed Campaigns queued until a verified rolling recovery point exists.

const FileCampaignRegistry = preload("res://godot/src/platform/persistence/file_campaign_registry.gd")
const CampaignBackupManager = preload("res://godot/src/platform/persistence/campaign_backup_manager.gd")

const MAX_RECOVERY_POINT_AGE_SECONDS := 60
const RETRY_DELAY_SECONDS := 5

var _data_root: String
var _registry
var _pending: Dictionary = {}
var _worker := Thread.new()
var _worker_campaign_id := ""
var _worker_observed_generation := 0
var _last_result: Dictionary = {}


func _init(data_root: String = "user://salt-marcher", registry = null) -> void:
	_data_root = data_root.trim_suffix("/")
	_registry = registry if registry != null else FileCampaignRegistry.new(_data_root)


func _ready() -> void:
	_bootstrap_campaigns()
	set_process(true)


func note_confirmed_generation(campaign_id: String, generation: int) -> void:
	if campaign_id.is_empty() or generation <= 0:
		return
	var existing: Dictionary = _pending.get(campaign_id, {})
	_pending[campaign_id] = {
		"generation": maxi(generation, int(existing.get("generation", 0))),
		"due_at_unix": 0,
	}


func _process(_delta: float) -> void:
	if _worker.is_started():
		if _worker.is_alive():
			return
		var result: Dictionary = _worker.wait_to_finish()
		_finish_worker(result)
	if _worker.is_started():
		return
	_start_next_due()


func _exit_tree() -> void:
	if _worker.is_started():
		var result: Dictionary = _worker.wait_to_finish()
		_finish_worker(result)


func pending_count() -> int:
	return _pending.size()


func last_result() -> Dictionary:
	return _last_result.duplicate(true)


func _bootstrap_campaigns() -> void:
	var state: Dictionary = _registry.load_state()
	if not state.get("ok", false):
		_last_result = state
		return
	for campaign in state["campaigns"]:
		var campaign_id := str(campaign.get("id", ""))
		if campaign_id.is_empty():
			continue
		_pending[campaign_id] = {"generation": 0, "due_at_unix": 0}


func _start_next_due() -> void:
	var now_unix := int(Time.get_unix_time_from_system())
	var campaign_ids: Array = _pending.keys()
	campaign_ids.sort()
	for campaign_id_value in campaign_ids:
		var campaign_id := str(campaign_id_value)
		var pending: Dictionary = _pending[campaign_id]
		if int(pending.get("due_at_unix", 0)) > now_unix:
			continue
		_worker_campaign_id = campaign_id
		_worker_observed_generation = int(pending.get("generation", 0))
		var start_error := _worker.start(_maintain_recovery_point.bind(
			campaign_id,
			_worker_observed_generation,
			now_unix
		))
		if start_error != OK:
			_last_result = {
				"ok": false,
				"status": "backup_worker_error",
				"error": "Automatische Campaign-Sicherung konnte nicht gestartet werden.",
			}
			pending["due_at_unix"] = now_unix + RETRY_DELAY_SECONDS
			_pending[campaign_id] = pending
			_worker_campaign_id = ""
			_worker_observed_generation = 0
		return


func _maintain_recovery_point(
	campaign_id: String,
	observed_generation: int,
	now_unix: int
) -> Dictionary:
	var worker_registry := FileCampaignRegistry.new(_data_root)
	var manager := CampaignBackupManager.new(_data_root, worker_registry)
	return manager.maintain_recovery_point(
		campaign_id,
		observed_generation,
		now_unix,
		MAX_RECOVERY_POINT_AGE_SECONDS
	)


func _finish_worker(result: Dictionary) -> void:
	_last_result = result.duplicate(true)
	var campaign_id := _worker_campaign_id
	var observed_generation := _worker_observed_generation
	_worker_campaign_id = ""
	_worker_observed_generation = 0
	if campaign_id.is_empty() or not _pending.has(campaign_id):
		return
	var pending: Dictionary = _pending[campaign_id]
	if int(pending.get("generation", 0)) > observed_generation:
		pending["due_at_unix"] = 0
		_pending[campaign_id] = pending
		return
	if result.get("ok", false) and result.get("status", "") in ["backup_verified", "current_generation_protected"]:
		_pending.erase(campaign_id)
		return
	var now_unix := int(Time.get_unix_time_from_system())
	if result.get("ok", false) and result.get("status", "") == "not_due":
		pending["due_at_unix"] = int(result.get("next_due_at_unix", now_unix + RETRY_DELAY_SECONDS))
	else:
		pending["due_at_unix"] = now_unix + RETRY_DELAY_SECONDS
	_pending[campaign_id] = pending
