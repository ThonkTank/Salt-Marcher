class_name MainShell
extends Control

const CampaignDesk = preload("res://godot/src/ui/campaign_desk.gd")
const CatalogWorkspace = preload("res://godot/src/ui/catalog_workspace.gd")
const PartyTopBar = preload("res://godot/src/ui/party_top_bar.gd")
const AdventuringDayTopBar = preload("res://godot/src/ui/adventuring_day_top_bar.gd")
const SessionPlannerWorkspace = preload("res://godot/src/ui/session_planner_workspace.gd")

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
	var app_column := VBoxContainer.new()
	app_column.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	app_column.size_flags_vertical = Control.SIZE_EXPAND_FILL
	layout.add_child(app_column)
	var top_bar := PanelContainer.new()
	top_bar.custom_minimum_size = Vector2(0, 54)
	app_column.add_child(top_bar)
	var top_margin := MarginContainer.new()
	top_margin.add_theme_constant_override("margin_left", 18)
	top_margin.add_theme_constant_override("margin_right", 18)
	top_margin.add_theme_constant_override("margin_top", 9)
	top_margin.add_theme_constant_override("margin_bottom", 9)
	top_bar.add_child(top_margin)
	var top_controls := HBoxContainer.new()
	top_margin.add_child(top_controls)
	var top_spacer := Control.new()
	top_spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	top_controls.add_child(top_spacer)
	var adventuring_day_top_bar := AdventuringDayTopBar.new()
	top_controls.add_child(adventuring_day_top_bar)
	var party_top_bar := PartyTopBar.new()
	party_top_bar.data_root = data_root
	party_top_bar.runtime_coordinator = runtime_coordinator
	top_controls.add_child(party_top_bar)
	party_top_bar.snapshot_published.connect(adventuring_day_top_bar.apply_party_snapshot)
	party_top_bar.snapshot_refresh_started.connect(adventuring_day_top_bar.mark_party_refreshing)
	adventuring_day_top_bar.refresh_requested.connect(party_top_bar.refresh)

	var content := Control.new()
	content.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	content.size_flags_vertical = Control.SIZE_EXPAND_FILL
	app_column.add_child(content)

	var campaign_desk := CampaignDesk.new()
	campaign_desk.registry = registry
	campaign_desk.runtime_coordinator = runtime_coordinator
	campaign_desk.compaction_scheduler = compaction_scheduler
	campaign_desk.active_campaign_changed.connect(func(_campaign_id: String) -> void:
		party_top_bar.refresh()
	)
	content.add_child(campaign_desk)
	_routes["campaigns"] = campaign_desk
	var catalog := CatalogWorkspace.new()
	catalog.data_root = data_root
	catalog.registry = registry
	catalog.runtime_coordinator = runtime_coordinator
	content.add_child(catalog)
	_routes["catalog"] = catalog
	var session_planner := SessionPlannerWorkspace.new()
	session_planner.data_root = data_root
	session_planner.runtime_coordinator = runtime_coordinator
	content.add_child(session_planner)
	_routes["session_planner"] = session_planner
	campaign_desk.active_campaign_changed.connect(func(_campaign_id: String) -> void:
		session_planner.refresh()
	)
	_add_route_button(navigation, "campaigns", "Campaigns")
	_add_route_button(navigation, "catalog", "Katalog")
	_add_route_button(navigation, "session_planner", "Session Planner")
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
