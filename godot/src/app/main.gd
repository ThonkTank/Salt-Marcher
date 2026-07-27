extends Control

const CampaignDesk = preload("res://godot/src/ui/campaign_desk.gd")
const FileCampaignRegistry = preload("res://godot/src/platform/persistence/file_campaign_registry.gd")
const CampaignRuntimeCoordinator = preload("res://godot/src/app/campaign_runtime_coordinator.gd")


func _ready() -> void:
	var registry := FileCampaignRegistry.new()
	var coordinator := CampaignRuntimeCoordinator.new("user://salt-marcher", registry)
	coordinator.open_durable_active()
	var desk := CampaignDesk.new()
	desk.registry = registry
	desk.runtime_coordinator = coordinator
	add_child(desk)
