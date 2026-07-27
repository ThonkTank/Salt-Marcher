extends Control

const CampaignDesk = preload("res://godot/src/ui/campaign_desk.gd")
const FileCampaignRegistry = preload("res://godot/src/platform/persistence/file_campaign_registry.gd")
const CampaignRuntimeCoordinator = preload("res://godot/src/app/campaign_runtime_coordinator.gd")
const CampaignBackupScheduler = preload("res://godot/src/app/campaign_backup_scheduler.gd")
const CampaignCompactionScheduler = preload("res://godot/src/app/campaign_compaction_scheduler.gd")

var _runtime_coordinator: CampaignRuntimeCoordinator


func _ready() -> void:
	var registry := FileCampaignRegistry.new()
	_runtime_coordinator = CampaignRuntimeCoordinator.new("user://salt-marcher", registry)
	_runtime_coordinator.open_durable_active()
	var persistence_maintenance_mutex := Mutex.new()
	var backup_scheduler := CampaignBackupScheduler.new(
		"user://salt-marcher",
		registry,
		persistence_maintenance_mutex
	)
	var compaction_scheduler := CampaignCompactionScheduler.new(
		"user://salt-marcher",
		registry,
		_runtime_coordinator,
		CampaignCompactionScheduler.DEFAULT_TRIGGER_GENERATIONS,
		CampaignCompactionScheduler.DEFAULT_MINIMUM_LOCAL_GENERATIONS,
		CampaignCompactionScheduler.DEFAULT_RETRY_DELAY_SECONDS,
		persistence_maintenance_mutex
	)
	_runtime_coordinator.set_backup_notifier(func(campaign_id: String, generation: int) -> void:
		backup_scheduler.note_confirmed_generation(campaign_id, generation)
		compaction_scheduler.note_confirmed_generation(campaign_id, generation)
	)
	add_child(backup_scheduler)
	add_child(compaction_scheduler)
	var desk := CampaignDesk.new()
	desk.registry = registry
	desk.runtime_coordinator = _runtime_coordinator
	desk.compaction_scheduler = compaction_scheduler
	add_child(desk)


func _exit_tree() -> void:
	if _runtime_coordinator != null:
		_runtime_coordinator.revoke_current(-1)
