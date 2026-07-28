class_name EncounterTableEditorDialog
extends ConfirmationDialog

## Campaign-owned Encounter Table editor with bounded Creature selection.

const WorldPlannerReferencePicker = preload("res://godot/src/ui/world_planner_reference_picker.gd")

const QUIET_INK := Color("#91a5a2")
const BRASS_MARK := Color("#d2a743")
const PAGE_SIZE := 50

signal table_submitted(mode: String, record_id: String, name_text: String, description: String, entries: Array)

var data_root := "user://salt-marcher"

var _mode := ""
var _record_id := ""
var _entries: Dictionary = {}
var _entry_labels: Dictionary = {}
var _entry_page := 0
var _name_edit: LineEdit
var _description_edit: TextEdit
var _entry_count: Label
var _entry_list: VBoxContainer
var _entry_page_label: Label
var _entry_previous: Button
var _entry_next: Button
var _reference_picker: WorldPlannerReferencePicker


func _ready() -> void:
	_build_surface()
	confirmed.connect(_submit)


func open_create() -> void:
	_mode = "create"
	_record_id = ""
	_entries.clear()
	_entry_labels.clear()
	_entry_page = 0
	title = "Encounter-Tabelle erstellen"
	ok_button_text = "Encounter-Tabelle erstellen"
	get_cancel_button().text = "Abbrechen"
	_name_edit.text = ""
	_description_edit.text = ""
	_render_entries()
	_update_confirmation()
	popup_centered()
	_name_edit.grab_focus()


func open_edit(record: Dictionary, entry_labels: Dictionary = {}) -> void:
	_mode = "edit"
	_record_id = str(record.get("record_id", ""))
	_entries.clear()
	_entry_labels = entry_labels.duplicate(true)
	_entry_page = 0
	for entry in record.get("entries", []):
		_entries[str(entry.get("creature_id", ""))] = int(entry.get("weight", 1))
	title = "%s bearbeiten" % record.get("name", "Encounter-Tabelle")
	ok_button_text = "Änderungen speichern"
	get_cancel_button().text = "Abbrechen"
	_name_edit.text = str(record.get("name", ""))
	_description_edit.text = str(record.get("description", ""))
	_render_entries()
	_update_confirmation()
	popup_centered()
	_name_edit.grab_focus()


func snapshot() -> Dictionary:
	return {
		"mode": _mode,
		"record_id": _record_id,
		"name": _name_edit.text if _name_edit != null else "",
		"description": _description_edit.text if _description_edit != null else "",
		"entries": _serialized_entries(),
	}


func _build_surface() -> void:
	name = "EncounterTableEditorDialog"
	min_size = Vector2i(720, 600)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 8)
	add_child(column)
	var eyebrow := Label.new()
	eyebrow.text = "GEWICHTETE QUELLENLISTE"
	eyebrow.add_theme_font_size_override("font_size", 10)
	eyebrow.add_theme_color_override("font_color", BRASS_MARK)
	column.add_child(eyebrow)
	_name_edit = LineEdit.new()
	_name_edit.name = "EncounterTableName"
	_name_edit.placeholder_text = "Name der Encounter-Tabelle"
	_name_edit.custom_minimum_size = Vector2(0, 28)
	_name_edit.text_changed.connect(func(_value: String) -> void: _update_confirmation())
	column.add_child(_name_edit)
	_description_edit = TextEdit.new()
	_description_edit.name = "EncounterTableDescription"
	_description_edit.placeholder_text = "Beschreibung · optional"
	_description_edit.custom_minimum_size = Vector2(0, 92)
	column.add_child(_description_edit)
	var source_row := HBoxContainer.new()
	source_row.add_theme_constant_override("separation", 8)
	column.add_child(source_row)
	var source_title := Label.new()
	source_title.text = "MONSTER UND GEWICHTE"
	source_title.add_theme_font_size_override("font_size", 10)
	source_title.add_theme_color_override("font_color", BRASS_MARK)
	source_row.add_child(source_title)
	_entry_count = Label.new()
	_entry_count.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_entry_count.add_theme_color_override("font_color", QUIET_INK)
	source_row.add_child(_entry_count)
	var choose := Button.new()
	choose.name = "EncounterTableChooseCreatures"
	choose.text = "Monster auswählen"
	choose.custom_minimum_size = Vector2(140, 28)
	choose.pressed.connect(_open_creature_picker)
	source_row.add_child(choose)
	var divider := ColorRect.new()
	divider.color = BRASS_MARK
	divider.custom_minimum_size = Vector2(0, 2)
	column.add_child(divider)
	var scroll := ScrollContainer.new()
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	column.add_child(scroll)
	_entry_list = VBoxContainer.new()
	_entry_list.name = "EncounterTableEntries"
	_entry_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_entry_list.add_theme_constant_override("separation", 5)
	scroll.add_child(_entry_list)
	var page_row := HBoxContainer.new()
	page_row.add_theme_constant_override("separation", 8)
	column.add_child(page_row)
	_entry_page_label = Label.new()
	_entry_page_label.name = "EncounterTableEntryPage"
	_entry_page_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_entry_page_label.add_theme_color_override("font_color", QUIET_INK)
	page_row.add_child(_entry_page_label)
	_entry_previous = Button.new()
	_entry_previous.name = "EncounterTableEntriesPrevious"
	_entry_previous.text = "Zurück"
	_entry_previous.pressed.connect(_change_entry_page.bind(-1))
	page_row.add_child(_entry_previous)
	_entry_next = Button.new()
	_entry_next.name = "EncounterTableEntriesNext"
	_entry_next.text = "Weiter"
	_entry_next.pressed.connect(_change_entry_page.bind(1))
	page_row.add_child(_entry_next)
	_reference_picker = WorldPlannerReferencePicker.new()
	_reference_picker.data_root = data_root
	_reference_picker.references_selected.connect(_on_creatures_selected)
	add_child(_reference_picker)


func _open_creature_picker() -> void:
	_reference_picker.open_picker(
		"encounter_table_entries",
		"Monster für die Encounter-Tabelle auswählen",
		"creature",
		_entries.keys(),
		true
	)


func _on_creatures_selected(field_key: String, creature_ids: Array) -> void:
	if field_key != "encounter_table_entries":
		return
	var next_entries := {}
	for creature_id_value in creature_ids:
		var creature_id := str(creature_id_value)
		next_entries[creature_id] = int(_entries.get(creature_id, 1))
		_entry_labels[creature_id] = _reference_picker.reference_label(creature_id)
	for existing_id in _entry_labels.keys():
		if existing_id not in next_entries:
			_entry_labels.erase(existing_id)
	_entries = next_entries
	_entry_page = 0
	_render_entries()


func _render_entries() -> void:
	if _entry_list == null:
		return
	for child in _entry_list.get_children():
		_entry_list.remove_child(child)
		child.queue_free()
	var ids: Array = _entries.keys()
	ids.sort()
	_entry_count.text = "%d Einträge" % ids.size()
	var page_count := maxi(1, int((ids.size() + PAGE_SIZE - 1) / PAGE_SIZE))
	_entry_page = clampi(_entry_page, 0, page_count - 1)
	_entry_page_label.text = "Seite %d/%d · höchstens %d sichtbare Zeilen" % [
		_entry_page + 1,
		page_count,
		PAGE_SIZE,
	]
	_entry_previous.visible = page_count > 1
	_entry_next.visible = page_count > 1
	_entry_previous.disabled = _entry_page <= 0
	_entry_next.disabled = _entry_page >= page_count - 1
	if ids.is_empty():
		var empty := Label.new()
		empty.text = "Noch keine Monster. Leere Tabellen bleiben eine gültige Quelle ohne Kandidaten."
		empty.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		empty.add_theme_color_override("font_color", QUIET_INK)
		_entry_list.add_child(empty)
		return
	var first := _entry_page * PAGE_SIZE
	var last := mini(first + PAGE_SIZE, ids.size())
	for index in range(first, last):
		var creature_id_value = ids[index]
		var creature_id := str(creature_id_value)
		var row := HBoxContainer.new()
		row.name = "EncounterTableEntry"
		row.custom_minimum_size = Vector2(0, 34)
		row.add_theme_constant_override("separation", 8)
		_entry_list.add_child(row)
		var identity := Label.new()
		var display_name := str(_entry_labels.get(creature_id, creature_id))
		identity.text = "%s    %s" % [display_name, creature_id] if display_name != creature_id else creature_id
		identity.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		identity.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
		identity.add_theme_color_override("font_color", QUIET_INK)
		row.add_child(identity)
		var weight_label := Label.new()
		weight_label.text = "GEWICHT"
		weight_label.add_theme_font_size_override("font_size", 10)
		weight_label.add_theme_color_override("font_color", BRASS_MARK)
		row.add_child(weight_label)
		var weight := SpinBox.new()
		weight.name = "EncounterTableEntryWeight"
		weight.min_value = 1
		weight.max_value = 10
		weight.step = 1
		weight.value = float(_entries[creature_id])
		weight.custom_minimum_size = Vector2(74, 28)
		weight.value_changed.connect(_set_weight.bind(creature_id))
		row.add_child(weight)
		var remove := Button.new()
		remove.name = "EncounterTableRemoveEntry"
		remove.text = "Entfernen"
		remove.flat = true
		remove.pressed.connect(_remove_entry.bind(creature_id))
		row.add_child(remove)


func _set_weight(value: float, creature_id: String) -> void:
	if _entries.has(creature_id):
		_entries[creature_id] = int(value)


func _remove_entry(creature_id: String) -> void:
	_entries.erase(creature_id)
	_entry_labels.erase(creature_id)
	_render_entries()


func _change_entry_page(delta: int) -> void:
	var page_count := maxi(1, int((_entries.size() + PAGE_SIZE - 1) / PAGE_SIZE))
	var next_page := clampi(_entry_page + delta, 0, page_count - 1)
	if next_page == _entry_page:
		return
	_entry_page = next_page
	_render_entries()


func _serialized_entries() -> Array:
	var ids: Array = _entries.keys()
	ids.sort()
	var result: Array = []
	for creature_id_value in ids:
		var creature_id := str(creature_id_value)
		result.append({"creature_id": creature_id, "weight": int(_entries[creature_id])})
	return result


func _update_confirmation() -> void:
	if get_ok_button() != null:
		get_ok_button().disabled = _name_edit == null or _name_edit.text.strip_edges().is_empty()


func _submit() -> void:
	table_submitted.emit(
		_mode,
		_record_id,
		_name_edit.text,
		_description_edit.text,
		_serialized_entries()
	)
