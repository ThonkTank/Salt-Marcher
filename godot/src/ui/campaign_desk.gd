class_name CampaignDesk
extends Control

const FileCampaignRegistry = preload("res://godot/src/platform/persistence/file_campaign_registry.gd")
const RouteStitch = preload("res://godot/src/ui/route_stitch.gd")

const NIGHT_INK := Color("#0a1114")
const DEEP_SLATE := Color("#152a32")
const MAP_TEAL := Color("#2b5960")
const VELLUM_MIST := Color("#d9e3dd")
const QUIET_INK := Color("#91a5a2")
const BRASS_MARK := Color("#d2a743")
const EMBER_RUST := Color("#b75d3d")

var registry: FileCampaignRegistry
var _state: Dictionary = {}
var _name_input: LineEdit
var _campaign_list: VBoxContainer
var _status: Label
var _create_button: Button


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	theme = _build_theme()
	_build_surface()
	_reload()


func _build_surface() -> void:
	var backdrop := ColorRect.new()
	backdrop.color = NIGHT_INK
	backdrop.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(backdrop)

	var wash := ColorRect.new()
	wash.color = Color(DEEP_SLATE, 0.72)
	wash.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	backdrop.add_child(wash)

	var page_margin := MarginContainer.new()
	page_margin.add_theme_constant_override("margin_left", 52)
	page_margin.add_theme_constant_override("margin_right", 52)
	page_margin.add_theme_constant_override("margin_top", 42)
	page_margin.add_theme_constant_override("margin_bottom", 42)
	page_margin.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(page_margin)

	var frame := PanelContainer.new()
	frame.add_theme_stylebox_override("panel", _panel_style(Color("#102127"), BRASS_MARK, 1, 12))
	page_margin.add_child(frame)

	var frame_margin := MarginContainer.new()
	frame_margin.add_theme_constant_override("margin_left", 34)
	frame_margin.add_theme_constant_override("margin_right", 34)
	frame_margin.add_theme_constant_override("margin_top", 30)
	frame_margin.add_theme_constant_override("margin_bottom", 30)
	frame.add_child(frame_margin)

	var route_layout := HBoxContainer.new()
	route_layout.add_theme_constant_override("separation", 28)
	frame_margin.add_child(route_layout)

	var route_mark := RouteStitch.new()
	route_layout.add_child(route_mark)

	var content := VBoxContainer.new()
	content.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	content.add_theme_constant_override("separation", 18)
	route_layout.add_child(content)

	var eyebrow := Label.new()
	eyebrow.text = "SALTMARCHER  /  CAMPAIGN ROUTE"
	eyebrow.add_theme_color_override("font_color", BRASS_MARK)
	eyebrow.add_theme_font_size_override("font_size", 13)
	content.add_child(eyebrow)

	var title := Label.new()
	title.text = "Welche Spielmappe liegt heute auf dem Tisch?"
	title.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	title.add_theme_font_override("font", _display_font())
	title.add_theme_font_size_override("font_size", 38)
	title.add_theme_color_override("font_color", VELLUM_MIST)
	content.add_child(title)

	var subtitle := Label.new()
	subtitle.text = "Öffne eine Campaign sofort oder beginne mit nur einem Namen. Bestätigte Arbeit wird automatisch lokal bewahrt."
	subtitle.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	subtitle.add_theme_color_override("font_color", QUIET_INK)
	content.add_child(subtitle)

	var divider := HSeparator.new()
	content.add_child(divider)

	var creation_label := Label.new()
	creation_label.text = "NEUE CAMPAIGN"
	creation_label.add_theme_color_override("font_color", QUIET_INK)
	creation_label.add_theme_font_size_override("font_size", 12)
	content.add_child(creation_label)

	var create_row := HBoxContainer.new()
	create_row.add_theme_constant_override("separation", 12)
	content.add_child(create_row)

	_name_input = LineEdit.new()
	_name_input.name = "CampaignNameInput"
	_name_input.placeholder_text = "Name der Campaign"
	_name_input.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_name_input.custom_minimum_size = Vector2(0, 48)
	_name_input.text_submitted.connect(func(_value: String) -> void: _create_campaign())
	_name_input.text_changed.connect(func(value: String) -> void:
		_create_button.disabled = value.strip_edges().is_empty()
	)
	create_row.add_child(_name_input)

	_create_button = Button.new()
	_create_button.name = "CreateCampaignButton"
	_create_button.text = "Campaign erstellen"
	_create_button.disabled = true
	_create_button.custom_minimum_size = Vector2(188, 48)
	_create_button.add_theme_stylebox_override("normal", _panel_style(BRASS_MARK, BRASS_MARK, 1, 6))
	_create_button.add_theme_stylebox_override("hover", _panel_style(Color("#e0ba59"), Color("#e0ba59"), 1, 6))
	_create_button.add_theme_stylebox_override("pressed", _panel_style(Color("#b88d31"), Color("#b88d31"), 1, 6))
	_create_button.add_theme_color_override("font_color", NIGHT_INK)
	_create_button.add_theme_color_override("font_hover_color", NIGHT_INK)
	_create_button.add_theme_color_override("font_pressed_color", NIGHT_INK)
	_create_button.pressed.connect(_create_campaign)
	create_row.add_child(_create_button)

	var list_label := Label.new()
	list_label.text = "DEINE CAMPAIGNS"
	list_label.add_theme_color_override("font_color", QUIET_INK)
	list_label.add_theme_font_size_override("font_size", 12)
	content.add_child(list_label)

	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.custom_minimum_size = Vector2(0, 180)
	content.add_child(scroll)

	_campaign_list = VBoxContainer.new()
	_campaign_list.name = "CampaignList"
	_campaign_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_campaign_list.add_theme_constant_override("separation", 8)
	scroll.add_child(_campaign_list)

	_status = Label.new()
	_status.name = "CampaignStatus"
	_status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_status.add_theme_color_override("font_color", QUIET_INK)
	_status.add_theme_font_size_override("font_size", 14)
	content.add_child(_status)


func _reload() -> void:
	if registry == null:
		registry = FileCampaignRegistry.new()
	_state = registry.load_state()
	_render_state()


func _render_state() -> void:
	for child in _campaign_list.get_children():
		child.queue_free()
	if not _state.get("ok", false):
		_set_status(_state.get("error", "Campaigns konnten nicht geladen werden."), true)
		return

	var campaigns: Array = _state["campaigns"]
	if campaigns.is_empty():
		var empty := Label.new()
		empty.text = "Noch keine Campaign. Ein Name genügt, um spielbereit zu beginnen."
		empty.add_theme_color_override("font_color", QUIET_INK)
		_campaign_list.add_child(empty)
		_set_status("Bereit für deine erste Campaign.", false)
		_name_input.grab_focus.call_deferred()
		return

	for campaign in campaigns:
		var is_active: bool = campaign["id"] == _state["active_campaign_id"]
		var selected_id := str(campaign["id"])
		var row := Button.new()
		row.alignment = HORIZONTAL_ALIGNMENT_LEFT
		row.custom_minimum_size = Vector2(0, 58)
		row.text = ("AKTUELLE ROUTE   " if is_active else "CAMPAIGN          ") + campaign["name"]
		row.disabled = is_active
		if is_active:
			row.add_theme_stylebox_override("disabled", _panel_style(Color("#24464b"), BRASS_MARK, 2, 6))
			row.add_theme_color_override("font_disabled_color", VELLUM_MIST)
		else:
			row.pressed.connect(func() -> void: _activate_campaign(selected_id))
		_campaign_list.add_child(row)

	if _state.get("recovered", false):
		_set_status(_state["recovery_message"], true)
	else:
		_set_status("%d Campaigns lokal verfügbar." % campaigns.size(), false)


func _create_campaign() -> void:
	var result := registry.create_campaign(_name_input.text)
	if not result.get("ok", false):
		_set_status(result.get("error", "Campaign konnte nicht erstellt werden."), true)
		_name_input.grab_focus()
		return
	_name_input.clear()
	_state = result["state"]
	_render_state()
	_set_status("Campaign erstellt und als aktuelle Route geöffnet.", false)


func _activate_campaign(campaign_id: String) -> void:
	var result := registry.activate_campaign(campaign_id, int(_state["generation"]))
	if not result.get("ok", false):
		_set_status(result.get("error", "Campaign konnte nicht gewechselt werden."), true)
		if result.get("status", "") == "stale":
			_reload()
		return
	_state = result["state"]
	_render_state()
	_set_status("Campaign gewechselt. Die Route ist wieder aktiv.", false)


func _set_status(message: String, is_error: bool) -> void:
	_status.text = message
	_status.add_theme_color_override("font_color", EMBER_RUST if is_error else QUIET_INK)


func _build_theme() -> Theme:
	var result := Theme.new()
	var body_font := SystemFont.new()
	body_font.font_names = PackedStringArray(["Noto Sans", "Segoe UI", "Arial"])
	result.default_font = body_font
	result.default_font_size = 16
	result.set_color("font_color", "Label", VELLUM_MIST)
	result.set_color("font_color", "Button", VELLUM_MIST)
	result.set_color("font_hover_color", "Button", Color.WHITE)
	result.set_color("font_pressed_color", "Button", VELLUM_MIST)
	result.set_color("font_disabled_color", "Button", QUIET_INK)
	result.set_stylebox("normal", "Button", _panel_style(Color("#172f35"), MAP_TEAL, 1, 6))
	result.set_stylebox("hover", "Button", _panel_style(Color("#1d3b42"), Color("#56858a"), 1, 6))
	result.set_stylebox("pressed", "Button", _panel_style(Color("#0e252a"), BRASS_MARK, 1, 6))
	result.set_stylebox("focus", "Button", _focus_style())
	result.set_stylebox("normal", "LineEdit", _panel_style(Color("#0b191d"), MAP_TEAL, 1, 6))
	result.set_stylebox("focus", "LineEdit", _panel_style(Color("#0b191d"), BRASS_MARK, 2, 6))
	result.set_color("font_color", "LineEdit", VELLUM_MIST)
	result.set_color("font_placeholder_color", "LineEdit", QUIET_INK)
	result.set_color("caret_color", "LineEdit", BRASS_MARK)
	result.set_color("font_uneditable_color", "LineEdit", QUIET_INK)
	result.set_stylebox("separator", "HSeparator", _separator_style())
	return result


func _display_font() -> Font:
	var font := SystemFont.new()
	font.font_names = PackedStringArray(["Noto Serif", "Georgia", "Times New Roman"])
	font.font_weight = 600
	return font


func _panel_style(fill: Color, border: Color, width: int, radius: int) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = fill
	style.border_color = border
	style.set_border_width_all(width)
	style.set_corner_radius_all(radius)
	style.content_margin_left = 16
	style.content_margin_right = 16
	style.content_margin_top = 10
	style.content_margin_bottom = 10
	return style


func _focus_style() -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = Color.TRANSPARENT
	style.border_color = BRASS_MARK
	style.set_border_width_all(2)
	style.set_corner_radius_all(7)
	style.expand_margin_left = 2
	style.expand_margin_right = 2
	style.expand_margin_top = 2
	style.expand_margin_bottom = 2
	return style


func _separator_style() -> StyleBoxLine:
	var style := StyleBoxLine.new()
	style.color = Color(MAP_TEAL, 0.75)
	style.thickness = 1
	return style
