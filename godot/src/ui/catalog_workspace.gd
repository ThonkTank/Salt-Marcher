class_name CatalogWorkspace
extends Control

const CatalogBrowseController = preload("res://godot/src/features/catalog/catalog_browse_controller.gd")
const FileCampaignRegistry = preload("res://godot/src/platform/persistence/file_campaign_registry.gd")

const SECTIONS := [
	{"id": "creatures", "label": "Monster", "kind": "creature", "provider": true},
	{"id": "items", "label": "Items", "kind": "item", "provider": true},
	{"id": "encounters", "label": "Encounter", "kind": "", "provider": false},
	{"id": "npcs", "label": "NPCs", "kind": "", "provider": false},
	{"id": "factions", "label": "Fraktionen", "kind": "", "provider": false},
	{"id": "places", "label": "Orte", "kind": "", "provider": false},
	{"id": "encounter_tables", "label": "Encounter-Tabellen", "kind": "", "provider": false},
]
const PAGE_SIZE := 50

const NIGHT_INK := Color("#0a1114")
const DEEP_SLATE := Color("#152a32")
const VELLUM_MIST := Color("#d9e3dd")
const QUIET_INK := Color("#91a5a2")
const BRASS_MARK := Color("#d2a743")

var data_root := "user://salt-marcher"
var registry
var browse_controller: CatalogBrowseController
var _active_section_id := "creatures"
var _section_state: Dictionary = {}
var _section_buttons: Dictionary = {}
var _search: LineEdit
var _create_button: Button
var _result_list: VBoxContainer
var _footer: Label
var _detail: RichTextLabel
var _debounce: Timer


func _ready() -> void:
	if registry == null:
		registry = FileCampaignRegistry.new(data_root)
	if browse_controller == null:
		browse_controller = CatalogBrowseController.new(data_root, registry)
		add_child(browse_controller)
	browse_controller.query_started.connect(_on_query_started)
	browse_controller.result_published.connect(_on_result_published)
	for section in SECTIONS:
		_section_state[section["id"]] = {
			"draft": "",
			"accepted": "",
			"rows": [],
			"total": 0,
			"status": "uninitialized",
			"selected_id": "",
		}
	_build_surface()
	select_section(_active_section_id)


func select_section(section_id: String) -> Dictionary:
	var section := _section(section_id)
	if section.is_empty():
		return {"ok": false, "status": "unknown_section"}
	_active_section_id = section_id
	for id_value in _section_buttons:
		var button: Button = _section_buttons[id_value]
		button.disabled = str(id_value) == section_id
	var state: Dictionary = _section_state[section_id]
	_search.text = str(state["draft"])
	_search.placeholder_text = "%s durchsuchen" % section["label"]
	_create_button.text = "%s erstellen" % section["label"]
	if not section["provider"]:
		state["status"] = "unavailable"
		_section_state[section_id] = state
		browse_controller.cancel_all()
		_render_state()
		return {"ok": true, "status": "unavailable"}
	if state["status"] in ["uninitialized", "unavailable", "loading", "refreshing"]:
		_submit_current_query()
	else:
		_render_state()
	return {"ok": true, "status": "selected"}


func active_section_id() -> String:
	return _active_section_id


func section_snapshot(section_id: String) -> Dictionary:
	return _section_state.get(section_id, {}).duplicate(true)


func search_input() -> LineEdit:
	return _search


func _build_surface() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var background := ColorRect.new()
	background.color = NIGHT_INK
	background.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(background)
	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 34)
	margin.add_theme_constant_override("margin_right", 34)
	margin.add_theme_constant_override("margin_top", 30)
	margin.add_theme_constant_override("margin_bottom", 30)
	margin.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(margin)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 14)
	margin.add_child(column)
	var title := Label.new()
	title.text = "Katalog"
	title.add_theme_font_size_override("font_size", 34)
	title.add_theme_color_override("font_color", VELLUM_MIST)
	column.add_child(title)
	var subtitle := Label.new()
	subtitle.text = "Referenzen lesen und ausdrücklich an aktive Arbeitsbereiche übergeben."
	subtitle.add_theme_color_override("font_color", QUIET_INK)
	column.add_child(subtitle)
	var selector := HFlowContainer.new()
	selector.name = "CatalogSectionSelector"
	selector.add_theme_constant_override("h_separation", 8)
	selector.add_theme_constant_override("v_separation", 8)
	column.add_child(selector)
	for section in SECTIONS:
		var button := Button.new()
		button.text = section["label"]
		button.custom_minimum_size = Vector2(112, 32)
		button.pressed.connect(select_section.bind(str(section["id"])))
		selector.add_child(button)
		_section_buttons[section["id"]] = button
	var tools := HBoxContainer.new()
	tools.add_theme_constant_override("separation", 10)
	column.add_child(tools)
	_search = LineEdit.new()
	_search.name = "CatalogSearch"
	_search.custom_minimum_size = Vector2(300, 36)
	_search.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_search.text_changed.connect(_on_search_changed)
	_search.text_submitted.connect(func(_value: String) -> void: _submit_current_query())
	tools.add_child(_search)
	_create_button = Button.new()
	_create_button.name = "CatalogCreate"
	_create_button.custom_minimum_size = Vector2(180, 36)
	_create_button.pressed.connect(_on_create_requested)
	tools.add_child(_create_button)
	var split := HSplitContainer.new()
	split.size_flags_vertical = Control.SIZE_EXPAND_FILL
	split.split_offset = 600
	column.add_child(split)
	var scroll := ScrollContainer.new()
	scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	split.add_child(scroll)
	_result_list = VBoxContainer.new()
	_result_list.name = "CatalogResults"
	_result_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_result_list.add_theme_constant_override("separation", 6)
	scroll.add_child(_result_list)
	_detail = RichTextLabel.new()
	_detail.name = "CatalogInspector"
	_detail.custom_minimum_size = Vector2(280, 0)
	_detail.fit_content = false
	_detail.bbcode_enabled = true
	_detail.text = "Wähle einen Eintrag, um seine Referenz zu prüfen."
	split.add_child(_detail)
	_footer = Label.new()
	_footer.name = "CatalogFooter"
	_footer.add_theme_color_override("font_color", QUIET_INK)
	column.add_child(_footer)
	_debounce = Timer.new()
	_debounce.one_shot = true
	_debounce.wait_time = 0.2
	_debounce.timeout.connect(_submit_current_query)
	add_child(_debounce)


func _on_search_changed(value: String) -> void:
	var state: Dictionary = _section_state[_active_section_id]
	state["draft"] = value
	_section_state[_active_section_id] = state
	_debounce.start()


func _submit_current_query() -> void:
	var section := _section(_active_section_id)
	if section.is_empty() or not section["provider"]:
		_render_state()
		return
	var state: Dictionary = _section_state[_active_section_id]
	state["accepted"] = state["draft"]
	state["status"] = "loading" if state["rows"].is_empty() else "refreshing"
	_section_state[_active_section_id] = state
	_render_state()
	browse_controller.query(
		_active_section_id,
		str(section["kind"]),
		str(state["accepted"]),
		0,
		PAGE_SIZE
	)


func _on_query_started(request: Dictionary) -> void:
	var section_id := str(request.get("section_id", ""))
	if not _section_state.has(section_id):
		return
	var state: Dictionary = _section_state[section_id]
	state["status"] = "loading" if state["rows"].is_empty() else "refreshing"
	_section_state[section_id] = state
	if section_id == _active_section_id:
		_render_state()


func _on_result_published(result: Dictionary) -> void:
	var section_id := str(result.get("section_id", ""))
	if not _section_state.has(section_id):
		return
	var state: Dictionary = _section_state[section_id]
	if result.get("ok", false):
		state["rows"] = result.get("rows", []).duplicate(true)
		state["total"] = int(result.get("total", 0))
		state["status"] = str(result.get("status", "ready"))
		if not _row_present(state["rows"], str(state["selected_id"])):
			state["selected_id"] = ""
	else:
		state["status"] = "failed"
		state["error"] = result.get("error", "Katalogabfrage ist fehlgeschlagen.")
	_section_state[section_id] = state
	if section_id == _active_section_id:
		_render_state()


func _render_state() -> void:
	for child in _result_list.get_children():
		child.queue_free()
	var section := _section(_active_section_id)
	var state: Dictionary = _section_state[_active_section_id]
	var status := str(state["status"])
	if status == "unavailable":
		_add_message("%s ist im Godot-Cutover noch nicht an seinen Provider angeschlossen." % section["label"])
		_footer.text = "Provider nicht verfügbar · keine Catalog-eigene Ersatzwahrheit"
		return
	if status == "failed":
		_add_message(str(state.get("error", "Katalogabfrage ist fehlgeschlagen.")))
		_footer.text = "Fehlgeschlagen · Eingabe bleibt erhalten"
		return
	var rows: Array = state["rows"]
	if rows.is_empty():
		_add_message("Wird geladen …" if status == "loading" else "Keine passenden Einträge.")
	else:
		for row in rows:
			var button := Button.new()
			button.alignment = HORIZONTAL_ALIGNMENT_LEFT
			button.custom_minimum_size = Vector2(0, 40)
			button.text = "%s\n%s" % [row["name"], row["definition_id"]]
			button.pressed.connect(_select_row.bind(row.duplicate(true)))
			_result_list.add_child(button)
	_footer.text = "%d von %d Einträgen%s" % [
		rows.size(),
		int(state["total"]),
		" · wird aktualisiert" if status == "refreshing" else "",
	]


func _select_row(row: Dictionary) -> void:
	var state: Dictionary = _section_state[_active_section_id]
	state["selected_id"] = row["definition_id"]
	_section_state[_active_section_id] = state
	_detail.text = "[font_size=22]%s[/font_size]\n\n%s\n\nTyp: %s" % [
		row["name"],
		row["definition_id"],
		row["kind"],
	]


func _on_create_requested() -> void:
	var section := _section(_active_section_id)
	_footer.text = "Erstellen ist für %s noch nicht verfügbar." % section["label"]


func _add_message(message: String) -> void:
	var label := Label.new()
	label.text = message
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.add_theme_color_override("font_color", QUIET_INK)
	_result_list.add_child(label)


func _section(section_id: String) -> Dictionary:
	for section in SECTIONS:
		if section["id"] == section_id:
			return section
	return {}


func _row_present(rows: Array, definition_id: String) -> bool:
	if definition_id.is_empty():
		return false
	for row in rows:
		if row.get("definition_id", "") == definition_id:
			return true
	return false


func _notification(what: int) -> void:
	if what == NOTIFICATION_VISIBILITY_CHANGED and is_node_ready():
		if visible:
			select_section(_active_section_id)
		elif browse_controller != null:
			browse_controller.cancel_all()
