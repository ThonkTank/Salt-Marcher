class_name WorldPlannerNarrativeThreads
extends VBoxContainer

const WorldPlannerKnowledge = preload("res://godot/src/features/worldplanner/world_planner_knowledge.gd")
const WorldPlannerNarrativeReadController = preload("res://godot/src/features/worldplanner/world_planner_narrative_read_controller.gd")

const VELLUM_MIST := Color("#d9e3dd")
const QUIET_INK := Color("#91a5a2")
const BRASS_MARK := Color("#d2a743")

var data_root := "user://salt-marcher"
var command_controller
var read_controller: WorldPlannerNarrativeReadController

var _subject_id := ""
var _subject_kind := ""
var _subject_name := ""
var _include_deleted := false
var _rows: Array = []
var _status := "uninitialized"
var _notice := ""
var _busy := false
var _trash_toggle: CheckButton
var _create_quest: Button
var _create_rumour: Button
var _list: VBoxContainer
var _feedback: Label
var _editor: ConfirmationDialog
var _editor_name: LineEdit
var _editor_notes: TextEdit
var _editor_mode := ""
var _editor_kind := ""
var _editor_record_id := ""
var _delete_dialog: ConfirmationDialog
var _delete_record_id := ""


func _ready() -> void:
	if read_controller == null:
		read_controller = WorldPlannerNarrativeReadController.new(data_root)
		add_child(read_controller)
	read_controller.query_started.connect(_on_query_started)
	read_controller.result_published.connect(_on_result_published)
	if command_controller != null:
		command_controller.command_started.connect(_on_command_started)
		command_controller.command_completed.connect(_on_command_completed)
	_build_surface()
	visible = false


func show_subject(row: Dictionary) -> void:
	var kind := str(row.get("kind", ""))
	var subject_id := str(row.get("reference_id", ""))
	if kind not in WorldPlannerKnowledge.ENTITY_KINDS or subject_id.is_empty() or bool(row.get("deleted", false)):
		clear_subject()
		return
	var changed := subject_id != _subject_id
	_subject_id = subject_id
	_subject_kind = kind
	_subject_name = str(row.get("name", subject_id))
	visible = true
	if changed:
		_include_deleted = false
		_trash_toggle.set_pressed_no_signal(false)
		_rows.clear()
		_notice = ""
	refresh()


func clear_subject() -> void:
	_subject_id = ""
	_subject_kind = ""
	_subject_name = ""
	_rows.clear()
	_status = "uninitialized"
	_notice = ""
	visible = false
	if read_controller != null:
		read_controller.cancel_all()


func refresh() -> Dictionary:
	if _subject_id.is_empty():
		return {"ok": false, "status": "subject_required"}
	_status = "loading" if _rows.is_empty() else "refreshing"
	_render()
	return read_controller.query(_subject_id, _include_deleted)


func snapshot() -> Dictionary:
	return {
		"subject_id": _subject_id,
		"subject_kind": _subject_kind,
		"subject_name": _subject_name,
		"include_deleted": _include_deleted,
		"rows": _rows.duplicate(true),
		"status": _status,
		"notice": _notice,
		"busy": _busy,
	}


func _build_surface() -> void:
	custom_minimum_size = Vector2(0, 220)
	add_theme_constant_override("separation", 7)
	var header := HBoxContainer.new()
	header.add_theme_constant_override("separation", 8)
	add_child(header)
	var title := Label.new()
	title.text = "FÄDEN"
	title.add_theme_font_size_override("font_size", 11)
	title.add_theme_color_override("font_color", BRASS_MARK)
	header.add_child(title)
	var spacer := Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	header.add_child(spacer)
	_trash_toggle = CheckButton.new()
	_trash_toggle.name = "NarrativeTrashToggle"
	_trash_toggle.text = "Papierkorb"
	_trash_toggle.custom_minimum_size = Vector2(0, 28)
	_trash_toggle.toggled.connect(_on_trash_toggled)
	header.add_child(_trash_toggle)
	var threaded_area := HBoxContainer.new()
	threaded_area.size_flags_vertical = Control.SIZE_EXPAND_FILL
	threaded_area.add_theme_constant_override("separation", 9)
	add_child(threaded_area)
	var thread_line := ColorRect.new()
	thread_line.color = BRASS_MARK
	thread_line.custom_minimum_size = Vector2(2, 0)
	thread_line.mouse_filter = Control.MOUSE_FILTER_IGNORE
	threaded_area.add_child(thread_line)
	var content := VBoxContainer.new()
	content.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	content.size_flags_vertical = Control.SIZE_EXPAND_FILL
	content.add_theme_constant_override("separation", 6)
	threaded_area.add_child(content)
	var actions := HBoxContainer.new()
	actions.add_theme_constant_override("separation", 6)
	content.add_child(actions)
	_create_quest = Button.new()
	_create_quest.name = "NarrativeCreateQuest"
	_create_quest.text = "+ Quest"
	_create_quest.custom_minimum_size = Vector2(82, 28)
	_create_quest.pressed.connect(_open_create.bind("quest"))
	actions.add_child(_create_quest)
	_create_rumour = Button.new()
	_create_rumour.name = "NarrativeCreateRumour"
	_create_rumour.text = "+ Gerücht"
	_create_rumour.custom_minimum_size = Vector2(92, 28)
	_create_rumour.pressed.connect(_open_create.bind("rumour"))
	actions.add_child(_create_rumour)
	_feedback = Label.new()
	_feedback.name = "NarrativeFeedback"
	_feedback.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_feedback.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_feedback.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_feedback.add_theme_color_override("font_color", QUIET_INK)
	actions.add_child(_feedback)
	var scroll := ScrollContainer.new()
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	content.add_child(scroll)
	_list = VBoxContainer.new()
	_list.name = "NarrativeThreadList"
	_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_list.add_theme_constant_override("separation", 6)
	scroll.add_child(_list)
	_build_dialogs()


func _build_dialogs() -> void:
	_editor = ConfirmationDialog.new()
	_editor.name = "NarrativeEditor"
	_editor.min_size = Vector2i(500, 390)
	_editor.confirmed.connect(_confirm_editor)
	add_child(_editor)
	var fields := VBoxContainer.new()
	fields.add_theme_constant_override("separation", 8)
	_editor.add_child(fields)
	var name_label := Label.new()
	name_label.text = "Titel"
	fields.add_child(name_label)
	_editor_name = LineEdit.new()
	_editor_name.name = "NarrativeName"
	_editor_name.max_length = WorldPlannerKnowledge.MAX_NAME_LENGTH
	fields.add_child(_editor_name)
	var notes_label := Label.new()
	notes_label.text = "Notiz · optional"
	fields.add_child(notes_label)
	_editor_notes = TextEdit.new()
	_editor_notes.name = "NarrativeNotes"
	_editor_notes.custom_minimum_size = Vector2(0, 220)
	_editor_notes.placeholder_text = "Was soll am Spieltisch erinnert oder manuell aufgelöst werden?"
	fields.add_child(_editor_notes)
	_delete_dialog = ConfirmationDialog.new()
	_delete_dialog.name = "NarrativeDeleteDialog"
	_delete_dialog.title = "Faden in Papierkorb verschieben?"
	_delete_dialog.dialog_text = "Der Faden verschwindet aus dem aktiven Dossier und bleibt wiederherstellbar."
	_delete_dialog.ok_button_text = "In Papierkorb"
	_delete_dialog.confirmed.connect(_confirm_delete)
	add_child(_delete_dialog)


func _render() -> void:
	if _list == null:
		return
	for child in _list.get_children():
		child.queue_free()
	_create_quest.disabled = _busy or _include_deleted
	_create_rumour.disabled = _busy or _include_deleted
	_trash_toggle.disabled = _busy
	if _status == "failed":
		_add_message(_notice if not _notice.is_empty() else "Fäden konnten nicht geladen werden.")
	elif _rows.is_empty():
		_add_message("Fäden werden geladen …" if _status == "loading" else (
			"Keine gelöschten Fäden an diesem Dossier." if _include_deleted
			else "Noch kein Quest- oder Gerüchtefaden."
		))
	else:
		for row in _rows:
			_add_thread(row)
	_feedback.text = _notice if not _notice.is_empty() else "%d %s" % [
		_rows.size(), "gelöscht" if _include_deleted else "verknüpft",
	]


func _add_thread(row: Dictionary) -> void:
	var card := VBoxContainer.new()
	card.name = "NarrativeThread"
	card.add_theme_constant_override("separation", 3)
	_list.add_child(card)
	var heading := HBoxContainer.new()
	heading.add_theme_constant_override("separation", 6)
	card.add_child(heading)
	var marker := Label.new()
	marker.text = "%s · %s" % [
		"QUEST" if row["kind"] == "quest" else "GERÜCHT",
		"OFFEN" if row["resolution_state"] == "open" else "GESCHLOSSEN",
	]
	marker.add_theme_font_size_override("font_size", 10)
	marker.add_theme_color_override("font_color", BRASS_MARK if row["resolution_state"] == "open" else QUIET_INK)
	heading.add_child(marker)
	var title := Label.new()
	title.text = str(row["name"])
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	title.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	title.add_theme_color_override("font_color", VELLUM_MIST)
	heading.add_child(title)
	var notes := Label.new()
	notes.text = str(row.get("notes", "")) if not str(row.get("notes", "")).is_empty() else "Keine Notiz."
	notes.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	notes.max_lines_visible = 2
	notes.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	notes.add_theme_color_override("font_color", QUIET_INK)
	card.add_child(notes)
	var actions := HFlowContainer.new()
	actions.add_theme_constant_override("separation", 5)
	card.add_child(actions)
	if bool(row.get("deleted", false)):
		_add_action(actions, "Wiederherstellen", Callable(self, "_request_restore").bind(str(row["reference_id"])))
	else:
		_add_action(
			actions,
			"Schließen" if row["resolution_state"] == "open" else "Öffnen",
			Callable(self, "_toggle_state").bind(row.duplicate(true))
		)
		_add_action(actions, "Bearbeiten", Callable(self, "_open_edit").bind(row.duplicate(true)))
		_add_action(actions, "Papierkorb", Callable(self, "_open_delete").bind(str(row["reference_id"])))
	for child in actions.get_children():
		(child as Button).disabled = _busy


func _add_action(parent: Container, label: String, callback: Callable) -> void:
	var button := Button.new()
	button.text = label
	button.flat = true
	button.custom_minimum_size = Vector2(0, 26)
	button.pressed.connect(callback)
	parent.add_child(button)


func _add_message(message: String) -> void:
	var label := Label.new()
	label.text = message
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.add_theme_color_override("font_color", QUIET_INK)
	_list.add_child(label)


func _open_create(kind: String) -> void:
	_editor_mode = "create"
	_editor_kind = kind
	_editor_record_id = ""
	_editor.title = "%s an %s anlegen" % ["Quest" if kind == "quest" else "Gerücht", _subject_name]
	_editor.ok_button_text = "Faden anlegen"
	_editor_name.text = ""
	_editor_notes.text = ""
	_editor.popup_centered()
	_editor_name.grab_focus()


func _open_edit(row: Dictionary) -> void:
	_editor_mode = "edit"
	_editor_kind = str(row["kind"])
	_editor_record_id = str(row["reference_id"])
	_editor.title = "%s bearbeiten" % row["name"]
	_editor.ok_button_text = "Änderungen speichern"
	_editor_name.text = str(row["name"])
	_editor_notes.text = str(row.get("notes", ""))
	_editor.popup_centered()
	_editor_name.grab_focus()


func _confirm_editor() -> void:
	var started: Dictionary
	if _editor_mode == "create":
		started = command_controller.create_narrative(
			_editor_kind, _editor_name.text, _editor_notes.text, _subject_kind, _subject_id
		)
	else:
		started = command_controller.update_narrative(_editor_record_id, _editor_name.text, _editor_notes.text)
	if not started.get("ok", false):
		_show_command_failure(started)


func _toggle_state(row: Dictionary) -> void:
	var next_state := "closed" if row["resolution_state"] == "open" else "open"
	var started: Dictionary = command_controller.set_narrative_state(str(row["reference_id"]), next_state)
	if not started.get("ok", false):
		_show_command_failure(started)


func _open_delete(record_id: String) -> void:
	_delete_record_id = record_id
	_delete_dialog.popup_centered()


func _confirm_delete() -> void:
	var started: Dictionary = command_controller.trash_narrative(_delete_record_id)
	if not started.get("ok", false):
		_show_command_failure(started)


func _request_restore(record_id: String) -> void:
	var started: Dictionary = command_controller.restore_narrative(record_id)
	if not started.get("ok", false):
		_show_command_failure(started)


func _on_trash_toggled(enabled: bool) -> void:
	_include_deleted = enabled
	_rows.clear()
	_notice = ""
	refresh()


func _on_query_started(request: Dictionary) -> void:
	if str(request.get("subject_id", "")) != _subject_id:
		return
	_status = "loading" if _rows.is_empty() else "refreshing"
	_render()


func _on_result_published(result: Dictionary) -> void:
	if str(result.get("request", {}).get("subject_id", "")) != _subject_id:
		return
	if result.get("ok", false):
		_rows = result.get("rows", []).duplicate(true)
		_status = str(result.get("status", "ready"))
	else:
		_rows.clear()
		_status = "failed"
		_notice = str(result.get("error", "Fäden konnten nicht geladen werden."))
	_render()


func _on_command_started(request: Dictionary) -> void:
	_busy = true
	if _is_narrative_operation(str(request.get("operation", ""))):
		_notice = "Faden wird gespeichert …"
	_render()


func _on_command_completed(result: Dictionary) -> void:
	_busy = false
	var operation := str(result.get("request", {}).get("operation", ""))
	if not _is_narrative_operation(operation):
		_render()
		return
	if not result.get("ok", false):
		_show_command_failure(result)
		return
	_notice = {
		"create_narrative": "Faden angelegt.",
		"update_narrative": "Faden gespeichert.",
		"set_narrative_state": "Auflösungsstand gespeichert.",
		"trash_narrative": "Faden in Papierkorb verschoben.",
		"restore_narrative": "Faden wiederhergestellt.",
	}.get(operation, "Faden gespeichert.")
	refresh()


func _show_command_failure(result: Dictionary) -> void:
	_busy = false
	_notice = str(result.get("error", "Faden konnte nicht gespeichert werden."))
	_render()


func _is_narrative_operation(operation: String) -> bool:
	return operation in [
		"create_narrative", "update_narrative", "set_narrative_state",
		"trash_narrative", "restore_narrative",
	]


func _exit_tree() -> void:
	if read_controller != null:
		read_controller.cancel_all()
