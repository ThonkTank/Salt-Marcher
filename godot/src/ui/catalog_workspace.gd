class_name CatalogWorkspace
extends Control

const CatalogBrowseController = preload("res://godot/src/features/catalog/catalog_browse_controller.gd")
const FileCampaignRegistry = preload("res://godot/src/platform/persistence/file_campaign_registry.gd")
const WorldPlannerCommandController = preload("res://godot/src/features/worldplanner/world_planner_command_controller.gd")

const SECTIONS := [
	{"id": "creatures", "label": "Monster", "kind": "creature", "provider": true, "mutable": false},
	{"id": "items", "label": "Items", "kind": "item", "provider": true, "mutable": false},
	{"id": "encounters", "label": "Encounter", "kind": "", "provider": false, "mutable": false},
	{"id": "npcs", "label": "NPCs", "kind": "npc", "provider": true, "mutable": true},
	{"id": "factions", "label": "Fraktionen", "kind": "faction", "provider": true, "mutable": true},
	{"id": "places", "label": "Orte", "kind": "place", "provider": true, "mutable": true},
	{"id": "encounter_tables", "label": "Encounter-Tabellen", "kind": "", "provider": false, "mutable": false},
]
const PAGE_SIZE := 50

const NIGHT_INK := Color("#0a1114")
const DEEP_SLATE := Color("#152a32")
const VELLUM_MIST := Color("#d9e3dd")
const QUIET_INK := Color("#91a5a2")
const BRASS_MARK := Color("#d2a743")

var data_root := "user://salt-marcher"
var registry
var runtime_coordinator
var browse_controller: CatalogBrowseController
var command_controller: WorldPlannerCommandController
var _active_section_id := "creatures"
var _section_state: Dictionary = {}
var _section_buttons: Dictionary = {}
var _search: LineEdit
var _trash_toggle: CheckButton
var _create_button: Button
var _result_list: VBoxContainer
var _footer: Label
var _detail: RichTextLabel
var _detail_actions: HBoxContainer
var _edit_button: Button
var _trash_button: Button
var _restore_button: Button
var _debounce: Timer
var _record_dialog: ConfirmationDialog
var _record_name: LineEdit
var _record_notes: TextEdit
var _dialog_mode := ""
var _dialog_record_id := ""
var _delete_dialog: ConfirmationDialog
var _command_section_id := ""


func _ready() -> void:
	if registry == null:
		registry = FileCampaignRegistry.new(data_root)
	if browse_controller == null:
		browse_controller = CatalogBrowseController.new(data_root, registry)
		add_child(browse_controller)
	if command_controller == null:
		command_controller = WorldPlannerCommandController.new(data_root, runtime_coordinator)
		add_child(command_controller)
	browse_controller.query_started.connect(_on_query_started)
	browse_controller.result_published.connect(_on_result_published)
	command_controller.command_started.connect(_on_command_started)
	command_controller.command_completed.connect(_on_command_completed)
	for section in SECTIONS:
		_section_state[section["id"]] = {
			"draft": "",
			"accepted": "",
			"rows": [],
			"total": 0,
			"status": "uninitialized",
			"selected_id": "",
			"trash": false,
			"notice": "",
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
	_trash_toggle.visible = bool(section["mutable"])
	_trash_toggle.set_pressed_no_signal(bool(state["trash"]))
	_create_button.disabled = bool(state["trash"]) or command_controller.busy()
	_reset_detail()
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
	_trash_toggle = CheckButton.new()
	_trash_toggle.name = "CatalogTrashToggle"
	_trash_toggle.text = "Papierkorb"
	_trash_toggle.tooltip_text = "Gelöschte Einträge prüfen und wiederherstellen"
	_trash_toggle.toggled.connect(_on_trash_toggled)
	tools.add_child(_trash_toggle)
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
	var inspector := VBoxContainer.new()
	inspector.custom_minimum_size = Vector2(300, 0)
	inspector.add_theme_constant_override("separation", 10)
	split.add_child(inspector)
	_detail = RichTextLabel.new()
	_detail.name = "CatalogInspector"
	_detail.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_detail.fit_content = false
	_detail.bbcode_enabled = true
	inspector.add_child(_detail)
	_detail_actions = HBoxContainer.new()
	_detail_actions.add_theme_constant_override("separation", 8)
	inspector.add_child(_detail_actions)
	_edit_button = Button.new()
	_edit_button.name = "CatalogEdit"
	_edit_button.text = "Bearbeiten"
	_edit_button.pressed.connect(_on_edit_requested)
	_detail_actions.add_child(_edit_button)
	_trash_button = Button.new()
	_trash_button.name = "CatalogTrash"
	_trash_button.text = "In Papierkorb"
	_trash_button.pressed.connect(_on_trash_requested)
	_detail_actions.add_child(_trash_button)
	_restore_button = Button.new()
	_restore_button.name = "CatalogRestore"
	_restore_button.text = "Wiederherstellen"
	_restore_button.pressed.connect(_on_restore_requested)
	_detail_actions.add_child(_restore_button)
	_footer = Label.new()
	_footer.name = "CatalogFooter"
	_footer.add_theme_color_override("font_color", QUIET_INK)
	column.add_child(_footer)
	_debounce = Timer.new()
	_debounce.one_shot = true
	_debounce.wait_time = 0.2
	_debounce.timeout.connect(_submit_current_query)
	add_child(_debounce)
	_build_record_dialogs()
	_reset_detail()


func _build_record_dialogs() -> void:
	_record_dialog = ConfirmationDialog.new()
	_record_dialog.name = "CatalogRecordDialog"
	_record_dialog.min_size = Vector2i(520, 390)
	_record_dialog.confirmed.connect(_on_record_dialog_confirmed)
	add_child(_record_dialog)
	var fields := VBoxContainer.new()
	fields.add_theme_constant_override("separation", 8)
	_record_dialog.add_child(fields)
	var name_label := Label.new()
	name_label.text = "Name"
	fields.add_child(name_label)
	_record_name = LineEdit.new()
	_record_name.name = "CatalogRecordName"
	_record_name.max_length = 160
	fields.add_child(_record_name)
	var notes_label := Label.new()
	notes_label.text = "Notizen · optional"
	fields.add_child(notes_label)
	_record_notes = TextEdit.new()
	_record_notes.name = "CatalogRecordNotes"
	_record_notes.custom_minimum_size = Vector2(0, 210)
	_record_notes.placeholder_text = "Was muss am Spieltisch schnell wieder auffindbar sein?"
	fields.add_child(_record_notes)
	_delete_dialog = ConfirmationDialog.new()
	_delete_dialog.name = "CatalogDeleteDialog"
	_delete_dialog.title = "In Papierkorb verschieben?"
	_delete_dialog.dialog_text = "Der Eintrag verschwindet aus aktiven Listen. Abhängige aktuelle Verweise werden entfernt; Wiederherstellung bleibt möglich."
	_delete_dialog.ok_button_text = "In Papierkorb"
	_delete_dialog.confirmed.connect(_confirm_trash)
	add_child(_delete_dialog)


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
		PAGE_SIZE,
		bool(state["trash"])
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
		state["selected_id"] = ""
	_section_state[section_id] = state
	if section_id == _active_section_id:
		_render_state()
		_render_selected_detail()


func _render_state() -> void:
	for child in _result_list.get_children():
		child.queue_free()
	var section := _section(_active_section_id)
	var state: Dictionary = _section_state[_active_section_id]
	var status := str(state["status"])
	if status == "unavailable":
		_add_message("%s ist im Godot-Cutover noch nicht an seinen Provider angeschlossen." % section["label"])
		_footer.text = _with_notice("Provider nicht verfügbar · keine Catalog-eigene Ersatzwahrheit", state)
		return
	if status == "failed":
		_add_message(str(state.get("error", "Katalogabfrage ist fehlgeschlagen.")))
		_footer.text = _with_notice("Fehlgeschlagen · Eingabe bleibt erhalten", state)
		return
	var rows: Array = state["rows"]
	if rows.is_empty():
		_add_message("Wird geladen …" if status == "loading" else "Keine passenden Einträge.")
	else:
		for row in rows:
			var button := Button.new()
			button.alignment = HORIZONTAL_ALIGNMENT_LEFT
			button.custom_minimum_size = Vector2(0, 40)
			button.text = "%s\n%s" % [row["name"], _row_id(row)]
			button.pressed.connect(_select_row.bind(row.duplicate(true)))
			_result_list.add_child(button)
	_footer.text = _with_notice("%d von %d %s%s" % [
		rows.size(),
		int(state["total"]),
		"Papierkorbeinträgen" if state["trash"] else "Einträgen",
		" · wird aktualisiert" if status == "refreshing" else "",
	], state)


func _select_row(row: Dictionary) -> void:
	var state: Dictionary = _section_state[_active_section_id]
	state["selected_id"] = _row_id(row)
	_section_state[_active_section_id] = state
	var safe_name := _escape_bbcode(str(row["name"]))
	var safe_notes := _escape_bbcode(str(row.get("notes", "")))
	_detail.text = "[font_size=22]%s[/font_size]\n\n%s\n\nTyp: %s%s" % [
		safe_name,
		_row_id(row),
		_kind_label(str(row["kind"])),
		"\n\n%s" % safe_notes if not safe_notes.is_empty() else "",
	]
	var section := _section(_active_section_id)
	_detail_actions.visible = bool(section.get("mutable", false))
	_edit_button.visible = not bool(row.get("deleted", false))
	_trash_button.visible = not bool(row.get("deleted", false))
	_restore_button.visible = bool(row.get("deleted", false))
	_set_action_buttons_disabled(command_controller.busy())


func _on_create_requested() -> void:
	var section := _section(_active_section_id)
	if not section.get("mutable", false):
		_footer.text = "Erstellen ist für %s noch nicht verfügbar." % section["label"]
		return
	_dialog_mode = "create"
	_dialog_record_id = ""
	_record_dialog.title = "%s erstellen" % section["label"]
	_record_dialog.ok_button_text = "Erstellen"
	_record_name.text = ""
	_record_notes.text = ""
	_record_dialog.popup_centered()
	_record_name.grab_focus()


func _on_edit_requested() -> void:
	var row := _selected_row()
	if row.is_empty():
		return
	_dialog_mode = "edit"
	_dialog_record_id = _row_id(row)
	_record_dialog.title = "%s bearbeiten" % row["name"]
	_record_dialog.ok_button_text = "Änderungen speichern"
	_record_name.text = str(row["name"])
	_record_notes.text = str(row.get("notes", ""))
	_record_dialog.popup_centered()
	_record_name.grab_focus()


func _on_record_dialog_confirmed() -> void:
	var started: Dictionary
	if _dialog_mode == "create":
		started = command_controller.create_record(
			str(_section(_active_section_id)["kind"]),
			_record_name.text,
			{"notes": _record_notes.text}
		)
	else:
		started = command_controller.update_record(
			_dialog_record_id,
			{"name": _record_name.text, "notes": _record_notes.text}
		)
	if not started.get("ok", false):
		_show_command_failure(started)


func _on_trash_requested() -> void:
	if not _selected_row().is_empty():
		_delete_dialog.popup_centered()


func _confirm_trash() -> void:
	var row := _selected_row()
	if row.is_empty():
		return
	var started := command_controller.trash_record(_row_id(row))
	if not started.get("ok", false):
		_show_command_failure(started)


func _on_restore_requested() -> void:
	var row := _selected_row()
	if row.is_empty():
		return
	var started := command_controller.restore_record(_row_id(row))
	if not started.get("ok", false):
		_show_command_failure(started)


func _on_trash_toggled(enabled: bool) -> void:
	var section := _section(_active_section_id)
	if not section.get("mutable", false):
		return
	var state: Dictionary = _section_state[_active_section_id]
	state["trash"] = enabled
	state["selected_id"] = ""
	state["status"] = "uninitialized"
	_section_state[_active_section_id] = state
	_create_button.disabled = enabled or command_controller.busy()
	_reset_detail()
	_submit_current_query()


func _on_command_started(_request: Dictionary) -> void:
	_command_section_id = _active_section_id
	var state: Dictionary = _section_state[_command_section_id]
	state["notice"] = "Änderung wird gespeichert …"
	_section_state[_command_section_id] = state
	_create_button.disabled = true
	_set_action_buttons_disabled(true)
	_render_state()


func _on_command_completed(result: Dictionary) -> void:
	var section_id := _command_section_id if _section_state.has(_command_section_id) else _active_section_id
	var state: Dictionary = _section_state[section_id]
	if not result.get("ok", false):
		state["notice"] = str(result.get("error", "Änderung ist fehlgeschlagen."))
	else:
		var status := str(result.get("status", "completed"))
		state["notice"] = {
			"created": "Eintrag erstellt.",
			"updated": "Änderungen gespeichert.",
			"trashed": "Eintrag in den Papierkorb verschoben.",
			"restored": "Eintrag wiederhergestellt.",
		}.get(status, "Änderung gespeichert.")
		state["selected_id"] = ""
	state["status"] = "uninitialized"
	_section_state[section_id] = state
	_command_section_id = ""
	var active_state: Dictionary = _section_state[_active_section_id]
	_create_button.disabled = bool(active_state["trash"])
	if section_id == _active_section_id and is_visible_in_tree():
		_reset_detail()
		_submit_current_query()


func _show_command_failure(result: Dictionary) -> void:
	var state: Dictionary = _section_state[_active_section_id]
	state["notice"] = str(result.get("error", "Änderung ist fehlgeschlagen."))
	_section_state[_active_section_id] = state
	_render_state()


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
		if _row_id(row) == definition_id:
			return true
	return false


func _row_id(row: Dictionary) -> String:
	return str(row.get("reference_id", row.get("definition_id", "")))


func _kind_label(kind: String) -> String:
	return {
		"creature": "Monster",
		"item": "Item",
		"npc": "NPC",
		"faction": "Fraktion",
		"place": "Ort",
	}.get(kind, kind)


func _escape_bbcode(value: String) -> String:
	return value.replace("[", "[lb]")


func _selected_row() -> Dictionary:
	var state: Dictionary = _section_state[_active_section_id]
	for row in state["rows"]:
		if _row_id(row) == str(state["selected_id"]):
			return row.duplicate(true)
	return {}


func _render_selected_detail() -> void:
	var row := _selected_row()
	if row.is_empty():
		_reset_detail()
	else:
		_select_row(row)


func _reset_detail() -> void:
	if _detail == null:
		return
	_detail.text = "Wähle einen Eintrag, um seine Referenz zu prüfen."
	_detail_actions.visible = false


func _set_action_buttons_disabled(disabled: bool) -> void:
	_edit_button.disabled = disabled
	_trash_button.disabled = disabled
	_restore_button.disabled = disabled


func _with_notice(base: String, state: Dictionary) -> String:
	var notice := str(state.get("notice", ""))
	return base if notice.is_empty() else "%s · %s" % [base, notice]


func _notification(what: int) -> void:
	if what == NOTIFICATION_VISIBILITY_CHANGED and is_node_ready():
		if visible:
			select_section(_active_section_id)
		elif browse_controller != null:
			browse_controller.cancel_all()
