class_name MainShell
extends Control

const CampaignDesk = preload("res://godot/src/ui/campaign_desk.gd")
const CatalogWorkspace = preload("res://godot/src/ui/catalog_workspace.gd")

const NIGHT_INK := Color("#0a1114")
const DEEP_SLATE := Color("#152a32")
const VELLUM_MIST := Color("#d9e3dd")
const QUIET_INK := Color("#91a5a2")
const BRASS_MARK := Color("#d2a743")

var registry
var runtime_coordinator
var compaction_scheduler
var data_root := "user://salt-marcher"
var _routes: Dictionary = {}
var _route_buttons: Dictionary = {}
var _active_route := "campaigns"


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var background := ColorRect.new()
	background.color = NIGHT_INK
	background.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(background)
	var layout := HBoxContainer.new()
	layout.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(layout)
	var rail := VBoxContainer.new()
	rail.custom_minimum_size = Vector2(176, 0)
	rail.add_theme_constant_override("separation", 8)
	layout.add_child(rail)
	var rail_margin := MarginContainer.new()
	rail_margin.add_theme_constant_override("margin_left", 18)
	rail_margin.add_theme_constant_override("margin_right", 18)
	rail_margin.add_theme_constant_override("margin_top", 24)
	rail_margin.add_theme_constant_override("margin_bottom", 24)
	rail.add_child(rail_margin)
	var navigation := VBoxContainer.new()
	navigation.add_theme_constant_override("separation", 10)
	rail_margin.add_child(navigation)
	var brand := Label.new()
	brand.text = "SALTMARCHER"
	brand.add_theme_color_override("font_color", BRASS_MARK)
	brand.add_theme_font_size_override("font_size", 16)
	navigation.add_child(brand)
	var route_label := Label.new()
	route_label.text = "ARBEITSBEREICHE"
	route_label.add_theme_color_override("font_color", QUIET_INK)
	route_label.add_theme_font_size_override("font_size", 11)
	navigation.add_child(route_label)
	var content := Control.new()
	content.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	content.size_flags_vertical = Control.SIZE_EXPAND_FILL
	layout.add_child(content)

	var campaign_desk := CampaignDesk.new()
	campaign_desk.registry = registry
	campaign_desk.runtime_coordinator = runtime_coordinator
	campaign_desk.compaction_scheduler = compaction_scheduler
	content.add_child(campaign_desk)
	_routes["campaigns"] = campaign_desk
	var catalog := CatalogWorkspace.new()
	catalog.data_root = data_root
	catalog.registry = registry
	content.add_child(catalog)
	_routes["catalog"] = catalog
	_add_route_button(navigation, "campaigns", "Campaigns")
	_add_route_button(navigation, "catalog", "Katalog")
	show_route(_active_route)


func show_route(route_id: String) -> Dictionary:
	if not _routes.has(route_id):
		return {"ok": false, "status": "unknown_route"}
	_active_route = route_id
	for id_value in _routes:
		var route: Control = _routes[id_value]
		route.visible = str(id_value) == route_id
	for id_value in _route_buttons:
		var button: Button = _route_buttons[id_value]
		button.disabled = str(id_value) == route_id
	return {"ok": true, "status": "shown", "route_id": route_id}


func active_route() -> String:
	return _active_route


func route(route_id: String):
	return _routes.get(route_id)


func _add_route_button(parent: VBoxContainer, route_id: String, label: String) -> void:
	var button := Button.new()
	button.text = label
	button.alignment = HORIZONTAL_ALIGNMENT_LEFT
	button.custom_minimum_size = Vector2(0, 42)
	button.pressed.connect(show_route.bind(route_id))
	parent.add_child(button)
	_route_buttons[route_id] = button
