extends Control

const CampaignDesk = preload("res://godot/src/ui/campaign_desk.gd")
const FileCampaignRegistry = preload("res://godot/src/platform/persistence/file_campaign_registry.gd")


func _ready() -> void:
	var desk := CampaignDesk.new()
	desk.registry = FileCampaignRegistry.new()
	add_child(desk)
