class_name EncounterPlanEditorDialog
extends ConfirmationDialog

## Campaign-owned saved Encounter roster editor with bounded Creature selection.

const WorldPlannerReferencePicker = preload("res://godot/src/ui/world_planner_reference_picker.gd")

const QUIET_INK := Color("#91a5a2")
const BRASS_MARK := Color("#d2a743")
const PAGE_SIZE := 50

signal plan_submitted(mode: String, record_id: String, name_text: String, roster: Array)

var data_root := "user://salt-marcher"

var _mode := ""
var _record_id := ""
var _roster: Dictionary = {}
var _roster_order: Array[String] = []
var _page := 0
var _name_edit: LineEdit
var _manifest_summary: Label
var _roster_list: VBoxContainer
var _page_label: Label
var _previous: Button
var _next: Button
var _reference_picker: WorldPlannerReferencePicker


func _ready() -> void:
	_build_surface()
	confirmed.connect(_submit)


func open_create() -> void:
	_mode = "create"
	_record_id = ""
	_roster.clear()
	_roster_order.clear()
	_page = 0
	title = "Encounter speichern"
	ok_button_text = "Encounter speichern"
	get_cancel_button().text = "Abbrechen"
	_name_edit.text = ""
	_render_roster()
	_update_confirmation()
	size = min_size
	popup_centered(min_size)
	_name_edit.grab_focus()


func open_edit(record: Dictionary, current_labels: Dictionary = {}) -> void:
	_mode = "edit"
	_record_id = str(record.get("record_id", ""))
	_roster.clear()
	_roster_order.clear()
	_page = 0
	for entry_value in record.get("roster", []):
		var entry: Dictionary = entry_value
		var creature_id := str(entry.get("creature_id", ""))
		_roster_order.append(creature_id)
		_roster[creature_id] = {
			"quantity": int(entry.get("quantity", 1)),
			"last_known_name": str(entry.get("last_known_name", creature_id)),
			"display_name": str(current_labels.get(creature_id, entry.get("last_known_name", creature_id))),
		}
	title = "%s bearbeiten" % record.get("name", "Encounter")
	ok_button_text = "Änderungen speichern"
	get_cancel_button().text = "Abbrechen"
	_name_edit.text = str(record.get("name", ""))
	_render_roster()
	_update_confirmation()
	size = min_size
	popup_centered(min_size)
	_name_edit.grab_focus()


func snapshot() -> Dictionary:
	return {
		"mode": _mode,
		"record_id": _record_id,
		"name": _name_edit.text if _name_edit != null else "",
		"roster": _serialized_roster(),
		"page": _page,
	}


func _build_surface() -> void:
	name = "EncounterPlanEditorDialog"
	min_size = Vector2i(740, 600)
	max_size = Vector2i(900, 650)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 8)
	add_child(column)
	var eyebrow := Label.new()
	eyebrow.text = "GESPEICHERTES ROSTER"
	eyebrow.add_theme_font_size_override("font_size", 10)
	eyebrow.add_theme_color_override("font_color", BRASS_MARK)
	column.add_child(eyebrow)
	_name_edit = LineEdit.new()
	_name_edit.name = "EncounterPlanName"
	_name_edit.placeholder_text = "Name des Encounters"
	_name_edit.max_length = 160
	_name_edit.custom_minimum_size = Vector2(0, 30)
	_name_edit.text_changed.connect(func(_value: String) -> void: _update_confirmation())
	column.add_child(_name_edit)
	var intro := Label.new()
	intro.text = "Die Liste speichert Zusammensetzung und Reihenfolge. Statblocks bleiben im Creature-Katalog."
	intro.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	intro.add_theme_color_override("font_color", QUIET_INK)
	column.add_child(intro)
	var divider := ColorRect.new()
	divider.color = BRASS_MARK
	divider.custom_minimum_size = Vector2(0, 2)
	column.add_child(divider)
	var manifest_bar := HBoxContainer.new()
	manifest_bar.add_theme_constant_override("separation", 10)
	column.add_child(manifest_bar)
	_manifest_summary = Label.new()
	_manifest_summary.name = "EncounterPlanManifestSummary"
	_manifest_summary.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_manifest_summary.add_theme_font_size_override("font_size", 16)
	manifest_bar.add_child(_manifest_summary)
	var choose := Button.new()
	choose.name = "EncounterPlanChooseCreatures"
	choose.text = "Monster auswählen"
	choose.custom_minimum_size = Vector2(160, 30)
	choose.pressed.connect(_open_creature_picker)
	manifest_bar.add_child(choose)
	var headings := HBoxContainer.new()
	headings.add_theme_constant_override("separation", 8)
	column.add_child(headings)
	var quantity_heading := Label.new()
	quantity_heading.text = "MENGE"
	quantity_heading.custom_minimum_size = Vector2(104, 24)
	quantity_heading.add_theme_font_size_override("font_size", 10)
	quantity_heading.add_theme_color_override("font_color", BRASS_MARK)
	headings.add_child(quantity_heading)
	var creature_heading := Label.new()
	creature_heading.text = "CREATURE-REFERENZ"
	creature_heading.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	creature_heading.add_theme_font_size_override("font_size", 10)
	creature_heading.add_theme_color_override("font_color", QUIET_INK)
	headings.add_child(creature_heading)
	var scroll := ScrollContainer.new()
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	column.add_child(scroll)
	_roster_list = VBoxContainer.new()
	_roster_list.name = "EncounterPlanRoster"
	_roster_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_roster_list.add_theme_constant_override("separation", 5)
	scroll.add_child(_roster_list)
	var footer := HBoxContainer.new()
	footer.add_theme_constant_override("separation", 8)
	column.add_child(footer)
	_page_label = Label.new()
	_page_label.name = "EncounterPlanRosterPage"
	_page_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_page_label.add_theme_color_override("font_color", QUIET_INK)
	footer.add_child(_page_label)
	_previous = Button.new()
	_previous.name = "EncounterPlanRosterPrevious"
	_previous.text = "Zurück"
	_previous.pressed.connect(_change_page.bind(-1))
	footer.add_child(_previous)
	_next = Button.new()
	_next.name = "EncounterPlanRosterNext"
	_next.text = "Weiter"
	_next.pressed.connect(_change_page.bind(1))
	footer.add_child(_next)
	_reference_picker = WorldPlannerReferencePicker.new()
	_reference_picker.data_root = data_root
	_reference_picker.references_selected.connect(_on_creatures_selected)
	add_child(_reference_picker)


func _open_creature_picker() -> void:
	_reference_picker.open_picker(
		"encounter_plan.roster",
		"Monster für das Roster auswählen",
		"creature",
		_roster_order.duplicate(),
		true
	)


func _on_creatures_selected(field_key: String, reference_ids: Array) -> void:
	if field_key != "encounter_plan.roster":
		return
	var selected := {}
	for value in reference_ids:
		selected[str(value)] = true
	var next_order: Array[String] = []
	for creature_id in _roster_order:
		if selected.has(creature_id):
			next_order.append(creature_id)
		else:
			_roster.erase(creature_id)
	for value in reference_ids:
		var creature_id := str(value)
		if _roster.has(creature_id):
			continue
		var label := _reference_picker.reference_label(creature_id)
		_roster[creature_id] = {
			"quantity": 1,
			"last_known_name": label,
			"display_name": label,
		}
		next_order.append(creature_id)
	_roster_order = next_order
	_page = clampi(_page, 0, _page_count() - 1)
	_render_roster()
	_update_confirmation()


func _render_roster() -> void:
	if _roster_list == null:
		return
	for child in _roster_list.get_children():
		_roster_list.remove_child(child)
		child.queue_free()
	var total := 0
	for creature_id in _roster_order:
		total += int(_roster[creature_id]["quantity"])
	_manifest_summary.text = "%d Monster · %d Arten" % [total, _roster_order.size()]
	if _roster_order.is_empty():
		var empty := Label.new()
		empty.text = "Noch kein Monster im Roster. Wähle mindestens eine Creature-Referenz."
		empty.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		empty.add_theme_color_override("font_color", QUIET_INK)
		_roster_list.add_child(empty)
	var start := _page * PAGE_SIZE
	var end := mini(start + PAGE_SIZE, _roster_order.size())
	for index in range(start, end):
		_add_roster_row(_roster_order[index])
	var page_count := _page_count()
	_page_label.text = "Seite %d/%d · höchstens %d sichtbare Zeilen" % [_page + 1, page_count, PAGE_SIZE]
	_previous.visible = page_count > 1
	_next.visible = page_count > 1
	_previous.disabled = _page <= 0
	_next.disabled = _page >= page_count - 1


func _add_roster_row(creature_id: String) -> void:
	var entry: Dictionary = _roster[creature_id]
	var row := HBoxContainer.new()
	row.name = "EncounterPlanRosterRow"
	row.custom_minimum_size = Vector2(0, 38)
	row.add_theme_constant_override("separation", 8)
	_roster_list.add_child(row)
	var tally := Label.new()
	tally.text = "×"
	tally.custom_minimum_size = Vector2(18, 34)
	tally.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	tally.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	tally.add_theme_font_size_override("font_size", 18)
	tally.add_theme_color_override("font_color", BRASS_MARK)
	row.add_child(tally)
	var quantity := SpinBox.new()
	quantity.name = "EncounterPlanRosterQuantity"
	quantity.min_value = 1
	quantity.max_value = 1_000_000_000
	quantity.step = 1
	quantity.allow_lesser = false
	quantity.allow_greater = true
	quantity.value = float(entry["quantity"])
	quantity.custom_minimum_size = Vector2(78, 34)
	quantity.value_changed.connect(_on_quantity_changed.bind(creature_id))
	row.add_child(quantity)
	var identity := VBoxContainer.new()
	identity.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	identity.add_theme_constant_override("separation", 0)
	row.add_child(identity)
	var display_name := Label.new()
	display_name.text = str(entry["display_name"])
	display_name.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	identity.add_child(display_name)
	var stable_id := Label.new()
	stable_id.text = creature_id
	stable_id.add_theme_font_size_override("font_size", 10)
	stable_id.add_theme_color_override("font_color", QUIET_INK)
	stable_id.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	identity.add_child(stable_id)
	var remove := Button.new()
	remove.name = "EncounterPlanRosterRemove"
	remove.text = "Entfernen"
	remove.flat = true
	remove.pressed.connect(_remove_creature.bind(creature_id))
	row.add_child(remove)


func _on_quantity_changed(value: float, creature_id: String) -> void:
	if not _roster.has(creature_id):
		return
	_roster[creature_id]["quantity"] = maxi(1, int(value))
	var total := 0
	for id_value in _roster_order:
		total += int(_roster[id_value]["quantity"])
	_manifest_summary.text = "%d Monster · %d Arten" % [total, _roster_order.size()]


func _remove_creature(creature_id: String) -> void:
	_roster.erase(creature_id)
	_roster_order.erase(creature_id)
	_page = clampi(_page, 0, _page_count() - 1)
	_render_roster()
	_update_confirmation()


func _change_page(delta: int) -> void:
	var next_page := clampi(_page + delta, 0, _page_count() - 1)
	if next_page == _page:
		return
	_page = next_page
	_render_roster()


func _serialized_roster() -> Array:
	var result: Array = []
	for creature_id in _roster_order:
		var entry: Dictionary = _roster[creature_id]
		result.append({
			"creature_id": creature_id,
			"quantity": int(entry["quantity"]),
			"last_known_name": str(entry["last_known_name"]),
		})
	return result


func _update_confirmation() -> void:
	if get_ok_button() != null:
		get_ok_button().disabled = _name_edit.text.strip_edges().is_empty() or _roster_order.is_empty()


func _submit() -> void:
	if _name_edit.text.strip_edges().is_empty() or _roster_order.is_empty():
		return
	plan_submitted.emit(_mode, _record_id, _name_edit.text, _serialized_roster())


func _page_count() -> int:
	return maxi(1, int((_roster_order.size() + PAGE_SIZE - 1) / PAGE_SIZE))
