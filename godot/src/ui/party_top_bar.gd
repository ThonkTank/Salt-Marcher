class_name PartyTopBar
extends HBoxContainer

signal snapshot_published(snapshot: Dictionary)
signal snapshot_refresh_started

const PartyRoster = preload("res://godot/src/features/party/party_roster.gd")
const PartyReadController = preload("res://godot/src/features/party/party_read_controller.gd")
const PartyCommandController = preload("res://godot/src/features/party/party_command_controller.gd")

const NIGHT_INK := Color("#0a1114")
const VELLUM_MIST := Color("#d9e3dd")
const QUIET_INK := Color("#91a5a2")
const BRASS_MARK := Color("#d2a743")
const WARNING := Color("#d98272")

var data_root := "user://salt-marcher"
var runtime_coordinator
var read_controller: PartyReadController
var command_controller: PartyCommandController
var _snapshot: Dictionary = {}
var _trigger: Button
var _popup: PopupPanel
var _active_list: VBoxContainer
var _roster_list: VBoxContainer
var _search: LineEdit
var _trash_toggle: CheckButton
var _notice: Label
var _create_button: Button
var _short_rest_button: Button
var _long_rest_button: Button
var _debounce: Timer
var _editor: Window
var _editor_title: Label
var _editor_name: LineEdit
var _editor_player: LineEdit
var _editor_level: LineEdit
var _editor_pp: LineEdit
var _editor_ac: LineEdit
var _editor_error: Label
var _editor_save: Button
var _editor_delete: Button
var _editor_character_id := ""
var _delete_confirmation: ConfirmationDialog
var _busy := false


func _ready() -> void:
	if read_controller == null:
		read_controller = PartyReadController.new(data_root)
		add_child(read_controller)
	if command_controller == null:
		command_controller = PartyCommandController.new(data_root, runtime_coordinator)
		add_child(command_controller)
	read_controller.query_started.connect(_on_query_started)
	read_controller.result_published.connect(_on_result_published)
	command_controller.command_started.connect(_on_command_started)
	command_controller.command_completed.connect(_on_command_completed)
	_build_trigger()
	_build_popup()
	_build_editor()
	refresh()


func refresh() -> Dictionary:
	return read_controller.query(_search.text if _search != null else "", _trash_toggle.button_pressed if _trash_toggle != null else false)


func snapshot() -> Dictionary:
	return _snapshot.duplicate(true)


func trigger_button() -> Button:
	return _trigger


func open_popup() -> void:
	refresh()
	var popup_position := Vector2i(
		int(_trigger.global_position.x + _trigger.size.x - 620),
		int(_trigger.global_position.y + _trigger.size.y + 4)
	)
	_popup.position = popup_position
	_popup.size = Vector2i(620, 650)
	_popup.popup()
	_search.grab_focus()


func _build_trigger() -> void:
	add_theme_constant_override("separation", 8)
	var label := Label.new()
	label.text = "PARTY"
	label.add_theme_color_override("font_color", BRASS_MARK)
	label.add_theme_font_size_override("font_size", 11)
	add_child(label)
	_trigger = Button.new()
	_trigger.name = "PartyTrigger"
	_trigger.text = "Keine aktuelle Party"
	_trigger.custom_minimum_size = Vector2(210, 34)
	_trigger.pressed.connect(open_popup)
	var shortcut := Shortcut.new()
	var event := InputEventKey.new()
	event.keycode = KEY_P
	event.alt_pressed = true
	shortcut.events = [event]
	_trigger.shortcut = shortcut
	_trigger.tooltip_text = "Roster und aktuelle Party öffnen · Alt+P"
	add_child(_trigger)


func _build_popup() -> void:
	_popup = PopupPanel.new()
	_popup.name = "PartyPopup"
	_popup.transparent_bg = false
	_popup.max_size = Vector2i(620, 650)
	add_child(_popup)
	var background := ColorRect.new()
	background.color = NIGHT_INK
	background.mouse_filter = Control.MOUSE_FILTER_IGNORE
	background.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_popup.add_child(background)
	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 20)
	margin.add_theme_constant_override("margin_right", 20)
	margin.add_theme_constant_override("margin_top", 18)
	margin.add_theme_constant_override("margin_bottom", 18)
	margin.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_popup.add_child(margin)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 10)
	margin.add_child(column)
	var heading := HBoxContainer.new()
	column.add_child(heading)
	var title := Label.new()
	title.text = "Aktuelle Party"
	title.add_theme_font_size_override("font_size", 24)
	title.add_theme_color_override("font_color", VELLUM_MIST)
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	heading.add_child(title)
	_short_rest_button = Button.new()
	_short_rest_button.name = "PartyShortRest"
	_short_rest_button.text = "Kurze Rast"
	_short_rest_button.pressed.connect(_request_rest.bind("short"))
	heading.add_child(_short_rest_button)
	_long_rest_button = Button.new()
	_long_rest_button.name = "PartyLongRest"
	_long_rest_button.text = "Lange Rast"
	_long_rest_button.pressed.connect(_request_rest.bind("long"))
	heading.add_child(_long_rest_button)
	_active_list = VBoxContainer.new()
	_active_list.name = "PartyActiveList"
	_active_list.add_theme_constant_override("separation", 6)
	column.add_child(_active_list)
	var divider := HSeparator.new()
	column.add_child(divider)
	var roster_heading := HBoxContainer.new()
	column.add_child(roster_heading)
	var roster_title := Label.new()
	roster_title.text = "Charakter-Roster"
	roster_title.add_theme_font_size_override("font_size", 18)
	roster_title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	roster_heading.add_child(roster_title)
	_create_button = Button.new()
	_create_button.name = "PartyCreate"
	_create_button.text = "SC erstellen"
	_create_button.pressed.connect(_open_create_editor)
	roster_heading.add_child(_create_button)
	var tools := HBoxContainer.new()
	tools.add_theme_constant_override("separation", 8)
	column.add_child(tools)
	_search = LineEdit.new()
	_search.name = "PartySearch"
	_search.placeholder_text = "Name, Spieler oder Roster-ID"
	_search.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_search.text_changed.connect(_on_search_changed)
	_search.text_submitted.connect(func(_value: String) -> void: refresh())
	tools.add_child(_search)
	_trash_toggle = CheckButton.new()
	_trash_toggle.name = "PartyTrashToggle"
	_trash_toggle.text = "Papierkorb"
	_trash_toggle.toggled.connect(func(_enabled: bool) -> void: refresh())
	tools.add_child(_trash_toggle)
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	column.add_child(scroll)
	_roster_list = VBoxContainer.new()
	_roster_list.name = "PartyRosterList"
	_roster_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_roster_list.add_theme_constant_override("separation", 5)
	scroll.add_child(_roster_list)
	_notice = Label.new()
	_notice.name = "PartyNotice"
	_notice.add_theme_color_override("font_color", QUIET_INK)
	_notice.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	column.add_child(_notice)
	_debounce = Timer.new()
	_debounce.one_shot = true
	_debounce.wait_time = 0.2
	_debounce.timeout.connect(refresh)
	add_child(_debounce)


func _build_editor() -> void:
	_editor = Window.new()
	_editor.name = "PartyEditor"
	_editor.title = "Charakter bearbeiten"
	_editor.size = Vector2i(520, 520)
	_editor.unresizable = true
	_editor.visible = false
	_editor.close_requested.connect(_editor.hide)
	add_child(_editor)
	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 22)
	margin.add_theme_constant_override("margin_right", 22)
	margin.add_theme_constant_override("margin_top", 20)
	margin.add_theme_constant_override("margin_bottom", 20)
	margin.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_editor.add_child(margin)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 8)
	margin.add_child(column)
	_editor_title = Label.new()
	_editor_title.text = "Charakter"
	_editor_title.add_theme_font_size_override("font_size", 24)
	column.add_child(_editor_title)
	_editor_name = _add_editor_field(column, "Name", "PartyEditorName")
	_editor_player = _add_editor_field(column, "Spieler · optional", "PartyEditorPlayer")
	var stats := GridContainer.new()
	stats.columns = 3
	stats.add_theme_constant_override("h_separation", 10)
	stats.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	column.add_child(stats)
	_editor_level = _add_compact_editor_field(stats, "Stufe", "PartyEditorLevel")
	_editor_pp = _add_compact_editor_field(stats, "Passive Wahrnehmung", "PartyEditorPerception")
	_editor_ac = _add_compact_editor_field(stats, "Rüstungsklasse", "PartyEditorArmor")
	_editor_error = Label.new()
	_editor_error.name = "PartyEditorError"
	_editor_error.add_theme_color_override("font_color", WARNING)
	_editor_error.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	column.add_child(_editor_error)
	var spacer := Control.new()
	spacer.size_flags_vertical = Control.SIZE_EXPAND_FILL
	column.add_child(spacer)
	var actions := HBoxContainer.new()
	actions.add_theme_constant_override("separation", 8)
	column.add_child(actions)
	_editor_delete = Button.new()
	_editor_delete.name = "PartyEditorDelete"
	_editor_delete.text = "In Papierkorb"
	_editor_delete.pressed.connect(_request_delete)
	actions.add_child(_editor_delete)
	var action_spacer := Control.new()
	action_spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	actions.add_child(action_spacer)
	var cancel := Button.new()
	cancel.text = "Abbrechen"
	cancel.pressed.connect(_editor.hide)
	actions.add_child(cancel)
	_editor_save = Button.new()
	_editor_save.name = "PartyEditorSave"
	_editor_save.text = "Speichern"
	_editor_save.pressed.connect(_submit_editor)
	actions.add_child(_editor_save)
	_delete_confirmation = ConfirmationDialog.new()
	_delete_confirmation.name = "PartyDeleteConfirmation"
	_delete_confirmation.title = "Charakter in Papierkorb verschieben?"
	_delete_confirmation.dialog_text = "Der Charakter verlässt die aktuelle Party und alle aktuellen Laufzeitkontexte. Wiederherstellung bleibt möglich."
	_delete_confirmation.ok_button_text = "In Papierkorb"
	_delete_confirmation.confirmed.connect(_confirm_delete)
	add_child(_delete_confirmation)


func _add_editor_field(parent: VBoxContainer, label_text: String, node_name: String) -> LineEdit:
	var label := Label.new()
	label.text = label_text
	parent.add_child(label)
	var field := LineEdit.new()
	field.name = node_name
	parent.add_child(field)
	return field


func _add_compact_editor_field(parent: GridContainer, label_text: String, node_name: String) -> LineEdit:
	var group := VBoxContainer.new()
	group.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	parent.add_child(group)
	var label := Label.new()
	label.text = label_text
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	group.add_child(label)
	var field := LineEdit.new()
	field.name = node_name
	field.placeholder_text = "nicht gesetzt"
	group.add_child(field)
	return field


func _on_query_started(_request: Dictionary) -> void:
	_notice.text = "Party wird geladen …"
	snapshot_refresh_started.emit()


func _on_result_published(result: Dictionary) -> void:
	if not result.get("ok", false):
		_snapshot = {}
		_trigger.text = "Party nicht verfügbar"
		_notice.text = str(result.get("error", "Party konnte nicht geladen werden."))
		_render()
		snapshot_published.emit(result.duplicate(true))
		return
	_snapshot = result.duplicate(true)
	var summary: Dictionary = _snapshot.get("summary", {})
	var active_count := int(summary.get("active_count", 0))
	var average_level = summary.get("average_level", null)
	_trigger.text = (
		"Keine aktuelle Party"
		if active_count == 0
		else "%d SC%s" % [active_count, " · Ø Stufe %d" % int(average_level) if average_level != null else ""]
	)
	_notice.text = "%d von %d Roster-Einträgen" % [int(_snapshot.get("matched", 0)), int(_snapshot.get("total", 0))]
	_render()
	snapshot_published.emit(_snapshot.duplicate(true))


func _render() -> void:
	_clear(_active_list)
	_clear(_roster_list)
	var active: Array = _snapshot.get("active", [])
	if active.is_empty():
		_add_message(_active_list, "Noch kein SC ist Teil der aktuellen Party.")
	else:
		for character in active:
			_active_list.add_child(_active_card(character))
	var roster: Array = _snapshot.get("roster", [])
	if roster.is_empty():
		_add_message(_roster_list, "Papierkorb ist leer." if _trash_toggle.button_pressed else "Erstelle den ersten SC im Campaign-Roster.")
	else:
		for character in roster:
			_roster_list.add_child(_roster_row(character))
	var has_active := not active.is_empty()
	_short_rest_button.disabled = _busy or not has_active
	_long_rest_button.disabled = _busy or not has_active
	_create_button.disabled = _busy or _trash_toggle.button_pressed


func _active_card(character: Dictionary) -> Control:
	var panel := PanelContainer.new()
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 3)
	panel.add_child(column)
	var first := HBoxContainer.new()
	column.add_child(first)
	var identity := Label.new()
	identity.text = _identity_line(character)
	identity.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	first.add_child(identity)
	var xp_down := Button.new()
	xp_down.text = "−100 XP"
	xp_down.set_meta("character_id", character["character_id"])
	xp_down.pressed.connect(_request_xp.bind(str(character["character_id"]), -100))
	first.add_child(xp_down)
	var xp_up := Button.new()
	xp_up.text = "+100 XP"
	xp_up.set_meta("character_id", character["character_id"])
	xp_up.pressed.connect(_request_xp.bind(str(character["character_id"]), 100))
	first.add_child(xp_up)
	var second := HBoxContainer.new()
	column.add_child(second)
	var facts := Label.new()
	facts.text = "%s · %s · %s" % [_level_xp_line(character), _combat_line(character), character["character_id"]]
	facts.add_theme_color_override("font_color", QUIET_INK)
	facts.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	second.add_child(facts)
	var edit := Button.new()
	edit.text = "Bearbeiten"
	edit.pressed.connect(_open_edit_editor.bind(character.duplicate(true)))
	second.add_child(edit)
	var remove := Button.new()
	remove.text = "Aus Party"
	remove.pressed.connect(_request_membership.bind(str(character["character_id"]), "reserve"))
	second.add_child(remove)
	for button in [xp_down, xp_up, edit, remove]:
		button.disabled = _busy
	return panel


func _roster_row(character: Dictionary) -> Control:
	var row := HBoxContainer.new()
	row.custom_minimum_size = Vector2(0, 38)
	var identity := Label.new()
	identity.text = "%s\n%s" % [_identity_line(character), character["character_id"]]
	identity.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(identity)
	if bool(character.get("deleted", false)):
		var restore := Button.new()
		restore.text = "Wiederherstellen"
		restore.disabled = _busy
		restore.pressed.connect(_request_restore.bind(str(character["character_id"])))
		row.add_child(restore)
		return row
	var stats := Label.new()
	stats.text = "%s · %s" % [_level_label(character), _combat_line(character)]
	stats.add_theme_color_override("font_color", QUIET_INK)
	row.add_child(stats)
	var membership := Button.new()
	membership.name = "PartyMembershipAction"
	membership.set_meta("character_id", character["character_id"])
	membership.text = "Aus Party" if character["membership"] == "active" else "Zur Party"
	membership.disabled = _busy
	membership.pressed.connect(_request_membership.bind(
		str(character["character_id"]),
		"reserve" if character["membership"] == "active" else "active"
	))
	row.add_child(membership)
	var edit := Button.new()
	edit.text = "Bearbeiten"
	edit.disabled = _busy
	edit.pressed.connect(_open_edit_editor.bind(character.duplicate(true)))
	row.add_child(edit)
	return row


func _identity_line(character: Dictionary) -> String:
	var player := "" if character["player_name"] == null else " · %s" % character["player_name"]
	return "%s%s" % [character["name"], player]


func _level_label(character: Dictionary) -> String:
	return "Stufe —" if character["level"] == null else "Stufe %d" % int(character["level"])


func _level_xp_line(character: Dictionary) -> String:
	if character["level"] == null:
		return "Stufe — · %d XP" % int(character["current_xp"])
	return "Stufe %d · %d/%d XP" % [int(character["level"]), int(character["current_xp"]), int(character["next_level_xp"])]


func _combat_line(character: Dictionary) -> String:
	return "PW %s · RK %s" % [
		"—" if character["passive_perception"] == null else str(int(character["passive_perception"])),
		"—" if character["armor_class"] == null else str(int(character["armor_class"])),
	]


func _open_create_editor() -> void:
	_editor_character_id = ""
	_editor_title.text = "SC zum Roster hinzufügen"
	_editor_name.text = ""
	_editor_player.text = ""
	_editor_level.text = ""
	_editor_pp.text = ""
	_editor_ac.text = ""
	_editor_delete.visible = false
	_editor_error.text = "Nur der Charaktername ist erforderlich. Die aktuelle Party bleibt unverändert."
	_editor.popup_centered()
	_editor_name.grab_focus()


func _open_edit_editor(character: Dictionary) -> void:
	_editor_character_id = str(character["character_id"])
	_editor_title.text = "%s bearbeiten" % character["name"]
	_editor_name.text = str(character["name"])
	_editor_player.text = "" if character["player_name"] == null else str(character["player_name"])
	_editor_level.text = "" if character["level"] == null else str(int(character["level"]))
	_editor_pp.text = "" if character["passive_perception"] == null else str(int(character["passive_perception"]))
	_editor_ac.text = "" if character["armor_class"] == null else str(int(character["armor_class"]))
	_editor_delete.visible = true
	_editor_error.text = ""
	_editor.popup_centered()
	_editor_name.grab_focus()


func _submit_editor() -> void:
	var parsed := _editor_fields()
	if not parsed.get("ok", false):
		_editor_error.text = parsed["error"]
		return
	var validation := PartyRoster.new().validate_draft(_editor_name.text, parsed["fields"])
	if not validation.get("ok", false):
		_editor_error.text = validation["error"]
		return
	var started := (
		command_controller.create_character(_editor_name.text, parsed["fields"])
		if _editor_character_id.is_empty()
		else command_controller.update_character(_editor_character_id, _editor_name.text, parsed["fields"])
	)
	if not started.get("ok", false):
		_editor_error.text = started["error"]


func _editor_fields() -> Dictionary:
	var fields := {"player_name": _editor_player.text}
	for specification in [
		{"field": "level", "control": _editor_level, "label": "Stufe"},
		{"field": "passive_perception", "control": _editor_pp, "label": "Passive Wahrnehmung"},
		{"field": "armor_class", "control": _editor_ac, "label": "Rüstungsklasse"},
	]:
		var raw := str(specification["control"].text).strip_edges()
		if raw.is_empty():
			fields[specification["field"]] = null
		elif not raw.is_valid_int():
			return {"ok": false, "error": "%s muss eine ganze Zahl sein." % specification["label"]}
		else:
			fields[specification["field"]] = raw.to_int()
	return {"ok": true, "fields": fields}


func _request_membership(character_id: String, membership: String) -> void:
	_start_or_report(command_controller.set_membership(character_id, membership))


func _request_xp(character_id: String, delta: int) -> void:
	_start_or_report(command_controller.adjust_xp([character_id], delta))


func _request_rest(rest_type: String) -> void:
	_start_or_report(command_controller.perform_rest(rest_type))


func _request_delete() -> void:
	if not _editor_character_id.is_empty():
		_delete_confirmation.popup_centered()


func _confirm_delete() -> void:
	_start_or_report(command_controller.trash_character(_editor_character_id))


func _request_restore(character_id: String) -> void:
	_start_or_report(command_controller.restore_character(character_id))


func _start_or_report(result: Dictionary) -> void:
	if not result.get("ok", false):
		_notice.text = str(result.get("error", "Party-Änderung konnte nicht gestartet werden."))


func _on_command_started(_request: Dictionary) -> void:
	_busy = true
	_notice.text = "Party-Änderung wird gespeichert …"
	_editor_save.disabled = true
	_editor_delete.disabled = true
	_render()


func _on_command_completed(result: Dictionary) -> void:
	_busy = false
	_editor_save.disabled = false
	_editor_delete.disabled = false
	if not result.get("ok", false):
		var message := str(result.get("error", "Party-Änderung ist fehlgeschlagen."))
		_notice.text = message
		if _editor.visible:
			_editor_error.text = message
		_render()
		return
	var status := str(result.get("status", "completed"))
	_notice.text = {
		"created": "SC wurde dem Roster hinzugefügt.",
		"updated": "Charakter wurde gespeichert.",
		"membership_updated": "Aktuelle Party wurde aktualisiert.",
		"xp_adjusted": "XP wurden aktualisiert.",
		"short_rest": "Kurze Rast wurde für die aktuelle Party angewendet.",
		"long_rest": "Lange Rast wurde für die aktuelle Party angewendet.",
		"trashed": "Charakter wurde in den Papierkorb verschoben.",
		"restored": "Charakter wurde als Reserve wiederhergestellt.",
	}.get(status, "Party wurde gespeichert.")
	if status in ["created", "updated", "trashed"]:
		_editor.hide()
	refresh()


func _on_search_changed(_value: String) -> void:
	_debounce.start()


func _clear(container: Container) -> void:
	for child in container.get_children():
		child.queue_free()


func _add_message(container: Container, text_value: String) -> void:
	var label := Label.new()
	label.text = text_value
	label.add_theme_color_override("font_color", QUIET_INK)
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	container.add_child(label)


func _exit_tree() -> void:
	if read_controller != null:
		read_controller.cancel_all()
