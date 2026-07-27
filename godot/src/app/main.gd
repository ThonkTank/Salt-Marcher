extends Control

const CampaignDesk = preload("res://godot/src/ui/campaign_desk.gd")
const FileCampaignRegistry = preload("res://godot/src/platform/persistence/file_campaign_registry.gd")
const CampaignRuntimeCoordinator = preload("res://godot/src/app/campaign_runtime_coordinator.gd")
const CampaignBackupScheduler = preload("res://godot/src/app/campaign_backup_scheduler.gd")


func _ready() -> void:
	var registry := FileCampaignRegistry.new()
	var coordinator := CampaignRuntimeCoordinator.new("user://salt-marcher", registry)
	coordinator.open_durable_active()
	var backup_scheduler := CampaignBackupScheduler.new("user://salt-marcher", registry)
	coordinator.set_backup_notifier(backup_scheduler.note_confirmed_generation)
	add_child(backup_scheduler)
	var desk := CampaignDesk.new()
	desk.registry = registry
	desk.runtime_coordinator = coordinator
	add_child(desk)
