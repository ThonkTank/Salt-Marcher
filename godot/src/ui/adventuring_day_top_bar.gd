class_name AdventuringDayTopBar
extends HBoxContainer

## Separate top-bar calculator for Party-owned rest budgets and XP timelines.

const PartyAdventuringDay = preload("res://godot/src/features/party/party_adventuring_day.gd")
const AdventuringDayCalculationController = preload("res://godot/src/features/party/adventuring_day_calculation_controller.gd")

const NIGHT_INK := Color("#0a1114")
const DEEP_SLATE := Color("#152a32")
const VELLUM_MIST := Color("#d9e3dd")
const QUIET_INK := Color("#91a5a2")
const BRASS_MARK := Color("#d2a743")
const WARNING := Color("#d98272")
const POPUP_SIZE := Vector2i(520, 650)
const MAX_VISIBLE_EVENTS := 200
const MAX_LEVEL_ROWS := 20

signal refresh_requested

var calculation_controller: AdventuringDayCalculationController
var _trigger: Button
var _popup: PopupPanel
var _source_label: Label
var _budget_mode: Button
var _progress_mode: Button
var _active_party_button: Button
var _add_row_button: Button
var _clear_button: Button
var _xp_row: HBoxContainer
var _xp_input: LineEdit
var _rows_list: VBoxContainer
var _summary_box: VBoxContainer
var _timeline_list: VBoxContainer
var _notice: Label
var _active_levels: Array = []
var _rows: Array = []
var _summary: Dictionary = {}
var _calculation: Dictionary = {}
var _source := "active_party"
var _mode := "budget"
var _active_party_changed := false
var _loading := false
var _party_refresh_pending := false


func _ready() -> void:
	if calculation_controller == null:
		calculation_controller = AdventuringDayCalculationController.new()
		add_child(calculation_controller)
	calculation_controller.calculation_started.connect(_on_calculation_started)
	calculation_controller.result_published.connect(_on_calculation_published)
	_build_trigger()
	_build_popup()
	_render_all()


func apply_party_snapshot(snapshot: Dictionary) -> void:
	_party_refresh_pending = false
	if not snapshot.get("ok", false):
		_summary = {"ok": false, "status": snapshot.get("status", "failed"), "error": snapshot.get("error", "Party konnte nicht geladen werden.")}
		_active_levels = []
		_trigger.text = "Nicht verfügbar"
		if _source == "active_party":
			_rows = []
			_calculation = {}
		_render_all()
		return
	var next_summary: Dictionary = PartyAdventuringDay.new().summary(snapshot.get("active", []))
	var next_levels: Array = next_summary.get("active_levels", []).duplicate()
	var changed := next_levels != _active_levels
	_summary = next_summary
	_active_levels = next_levels
	_update_trigger()
	if _source == "active_party":
		_rows = _rows_from_levels(_active_levels)
		_active_party_changed = false
		_request_calculation()
	elif changed:
		_active_party_changed = true
	_render_all()


func open_popup() -> void:
	mark_party_refreshing()
	refresh_requested.emit()
	var popup_position := Vector2i(
		int(_trigger.global_position.x + _trigger.size.x - POPUP_SIZE.x),
		int(_trigger.global_position.y + _trigger.size.y + 4)
	)
	_popup.position = popup_position
	_popup.size = POPUP_SIZE
	_popup.popup()


func trigger_button() -> Button:
	return _trigger


func mark_party_refreshing() -> void:
	_party_refresh_pending = true
	if _trigger != null:
		_trigger.text = "Lädt …"
	_render_header_and_output()


func snapshot() -> Dictionary:
	return {
		"source": _source,
		"mode": _mode,
		"active_levels": _active_levels.duplicate(),
		"rows": _rows.duplicate(true),
		"summary": _summary.duplicate(true),
		"calculation": _calculation.duplicate(true),
		"active_party_changed": _active_party_changed,
		"loading": _loading,
		"party_refresh_pending": _party_refresh_pending,
	}


func _build_trigger() -> void:
	add_theme_constant_override("separation", 8)
	var label := Label.new()
	label.text = "RASTBUDGET"
	label.add_theme_color_override("font_color", BRASS_MARK)
	label.add_theme_font_size_override("font_size", 11)
	add_child(label)
	_trigger = Button.new()
	_trigger.name = "AdventuringDayTrigger"
	_trigger.text = "Kein Rastbudget"
	_trigger.custom_minimum_size = Vector2(170, 34)
	_trigger.tooltip_text = "Adventuring-Day-Rechner öffnen · Alt+A"
	_trigger.pressed.connect(open_popup)
	var shortcut := Shortcut.new()
	var event := InputEventKey.new()
	event.keycode = KEY_A
	event.alt_pressed = true
	shortcut.events = [event]
	_trigger.shortcut = shortcut
	add_child(_trigger)


func _build_popup() -> void:
	_popup = PopupPanel.new()
	_popup.name = "AdventuringDayPopup"
	_popup.transparent_bg = false
	_popup.max_size = POPUP_SIZE
	add_child(_popup)
	var background := ColorRect.new()
	background.color = NIGHT_INK
	background.mouse_filter = Control.MOUSE_FILTER_IGNORE
	background.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_popup.add_child(background)
	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 18)
	margin.add_theme_constant_override("margin_right", 18)
	margin.add_theme_constant_override("margin_top", 16)
	margin.add_theme_constant_override("margin_bottom", 16)
	margin.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_popup.add_child(margin)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 8)
	margin.add_child(column)
	var heading := HBoxContainer.new()
	column.add_child(heading)
	var title := Label.new()
	title.text = "Adventuring Day"
	title.add_theme_font_size_override("font_size", 24)
	title.add_theme_color_override("font_color", VELLUM_MIST)
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	heading.add_child(title)
	var close := Button.new()
	close.text = "×"
	close.tooltip_text = "Rechner schließen"
	close.pressed.connect(_popup.hide)
	heading.add_child(close)
	_source_label = Label.new()
	_source_label.add_theme_color_override("font_color", QUIET_INK)
	column.add_child(_source_label)
	var controls := HBoxContainer.new()
	controls.add_theme_constant_override("separation", 6)
	column.add_child(controls)
	var mode_group := ButtonGroup.new()
	_budget_mode = Button.new()
	_budget_mode.name = "AdventuringDayBudgetMode"
	_budget_mode.text = "Budget"
	_budget_mode.toggle_mode = true
	_budget_mode.button_group = mode_group
	_budget_mode.pressed.connect(_select_mode.bind("budget"))
	controls.add_child(_budget_mode)
	_progress_mode = Button.new()
	_progress_mode.name = "AdventuringDayProgressMode"
	_progress_mode.text = "XP → Tage"
	_progress_mode.toggle_mode = true
	_progress_mode.button_group = mode_group
	_progress_mode.pressed.connect(_select_mode.bind("progress"))
	controls.add_child(_progress_mode)
	var spacer := Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	controls.add_child(spacer)
	_active_party_button = Button.new()
	_active_party_button.name = "AdventuringDayUseActiveParty"
	_active_party_button.text = "Aktive Party"
	_active_party_button.pressed.connect(_use_active_party)
	controls.add_child(_active_party_button)
	_add_row_button = Button.new()
	_add_row_button.name = "AdventuringDayAddRow"
	_add_row_button.text = "+ Zeile"
	_add_row_button.pressed.connect(_add_row)
	controls.add_child(_add_row_button)
	_clear_button = Button.new()
	_clear_button.name = "AdventuringDayClear"
	_clear_button.text = "Leeren"
	_clear_button.pressed.connect(_clear_rows)
	controls.add_child(_clear_button)
	_xp_row = HBoxContainer.new()
	_xp_row.add_theme_constant_override("separation", 8)
	column.add_child(_xp_row)
	var xp_label := Label.new()
	xp_label.text = "Gesamt-XP der Gruppe"
	xp_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_xp_row.add_child(xp_label)
	_xp_input = LineEdit.new()
	_xp_input.name = "AdventuringDayTotalXp"
	_xp_input.placeholder_text = "0"
	_xp_input.custom_minimum_size = Vector2(150, 0)
	_xp_input.text_submitted.connect(func(_value: String) -> void: _request_calculation())
	_xp_input.focus_exited.connect(_request_calculation)
	_xp_row.add_child(_xp_input)
	var roster_label := Label.new()
	roster_label.text = "Stufe / Anzahl"
	roster_label.add_theme_color_override("font_color", QUIET_INK)
	column.add_child(roster_label)
	var rows_scroll := ScrollContainer.new()
	rows_scroll.name = "AdventuringDayRowsScroll"
	rows_scroll.custom_minimum_size = Vector2(0, 110)
	rows_scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	column.add_child(rows_scroll)
	_rows_list = VBoxContainer.new()
	_rows_list.name = "AdventuringDayRows"
	_rows_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_rows_list.add_theme_constant_override("separation", 5)
	rows_scroll.add_child(_rows_list)
	column.add_child(HSeparator.new())
	_summary_box = VBoxContainer.new()
	_summary_box.name = "AdventuringDaySummary"
	_summary_box.add_theme_constant_override("separation", 4)
	column.add_child(_summary_box)
	var timeline_title := Label.new()
	timeline_title.text = "ETAPPEN"
	timeline_title.add_theme_color_override("font_color", BRASS_MARK)
	timeline_title.add_theme_font_size_override("font_size", 11)
	column.add_child(timeline_title)
	var timeline_scroll := ScrollContainer.new()
	timeline_scroll.custom_minimum_size = Vector2(0, 120)
	timeline_scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	column.add_child(timeline_scroll)
	_timeline_list = VBoxContainer.new()
	_timeline_list.name = "AdventuringDayTimeline"
	_timeline_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_timeline_list.add_theme_constant_override("separation", 4)
	timeline_scroll.add_child(_timeline_list)
	_notice = Label.new()
	_notice.name = "AdventuringDayNotice"
	_notice.add_theme_color_override("font_color", QUIET_INK)
	_notice.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	column.add_child(_notice)


func _select_mode(mode: String) -> void:
	_mode = mode
	_request_calculation()
	_render_all()


func _use_active_party() -> void:
	_source = "active_party"
	_active_party_changed = false
	_rows = _rows_from_levels(_active_levels)
	_request_calculation()
	_render_all()


func _add_row() -> void:
	if _rows.size() >= MAX_LEVEL_ROWS:
		_calculation = {"ok": false, "status": "invalid", "error": "Alle 20 Charakterstufen sind bereits als Zeilen verfügbar."}
		_render_header_and_output()
		return
	_switch_to_custom()
	var used := {}
	for row in _rows:
		used[int(row["level"])] = true
	for level in range(1, 21):
		if not used.has(level):
			_rows.append({"level": level, "count": 1})
			break
	_request_calculation()
	_render_all()


func _clear_rows() -> void:
	_switch_to_custom()
	_rows.clear()
	_calculation.clear()
	calculation_controller.cancel_all()
	_render_all()


func _switch_to_custom() -> void:
	_source = "custom"


func _on_level_selected(option_index: int, row_index: int) -> void:
	if row_index < 0 or row_index >= _rows.size():
		return
	_switch_to_custom()
	_rows[row_index]["level"] = option_index + 1
	_rows = _merge_rows_by_level(_rows)
	_request_calculation()
	_render_all()


func _commit_count(row_index: int, field: LineEdit) -> void:
	if row_index < 0 or row_index >= _rows.size():
		return
	var raw := field.text.strip_edges()
	var count := raw.to_int() if raw.is_valid_int() else 1
	count = maxi(count, 1)
	field.text = str(count)
	_switch_to_custom()
	_rows[row_index]["count"] = count
	_request_calculation()
	_render_header_and_output()


func _remove_row(row_index: int) -> void:
	if row_index < 0 or row_index >= _rows.size():
		return
	_switch_to_custom()
	_rows.remove_at(row_index)
	_request_calculation()
	_render_all()


func _request_calculation() -> void:
	if _rows.is_empty():
		_calculation.clear()
		_loading = false
		if calculation_controller != null:
			calculation_controller.cancel_all()
		return
	var xp_result := _parse_total_xp()
	if not xp_result.get("ok", false):
		_calculation = xp_result
		_loading = false
		return
	var started := calculation_controller.calculate_rows(_rows, int(xp_result["value"]))
	if not started.get("ok", false):
		_calculation = started
		_loading = false


func _parse_total_xp() -> Dictionary:
	var raw := _xp_input.text.strip_edges() if _xp_input != null else ""
	if raw.is_empty():
		return {"ok": true, "value": 0}
	if not raw.is_valid_int():
		return {"ok": false, "status": "invalid", "error": "Gesamt-XP müssen eine ganze Zahl sein."}
	var value := raw.to_int()
	if value < 0 or value > PartyAdventuringDay.MAX_GROUP_XP:
		return {"ok": false, "status": "invalid", "error": "Gesamt-XP liegen außerhalb des unterstützten Bereichs."}
	return {"ok": true, "value": value}


func _row_character_count() -> int:
	var total := 0
	for row in _rows:
		var count := maxi(0, int(row.get("count", 0)))
		if total > PartyAdventuringDay.MAX_EXACT_INTEGER - count:
			return -1
		total += count
	return total


func _on_calculation_started(_request: Dictionary) -> void:
	_loading = true
	_notice.text = "Rastbudget wird berechnet …"


func _on_calculation_published(result: Dictionary) -> void:
	_loading = false
	_calculation = result.duplicate(true)
	_render_header_and_output()


func _update_trigger() -> void:
	match str(_summary.get("status", "failed")):
		"ready":
			_trigger.text = "SR %d · LR %d" % [int(_summary["remaining_to_short_rest"]), int(_summary["remaining_to_long_rest"])]
		"empty":
			_trigger.text = "Kein Rastbudget"
		"incomplete_levels":
			_trigger.text = "Stufen fehlen"
		_:
			_trigger.text = "Nicht verfügbar"


func _render_all() -> void:
	if _trigger == null:
		return
	_render_rows()
	_render_header_and_output()


func _render_header_and_output() -> void:
	if _source_label == null:
		return
	_budget_mode.button_pressed = _mode == "budget"
	_progress_mode.button_pressed = _mode == "progress"
	_xp_row.visible = _mode == "progress"
	var character_count := _row_character_count()
	var source_text := "Aktive Party" if _source == "active_party" else "Eigene Gruppe"
	if _source == "custom" and _active_party_changed:
		source_text += " · Aktive Party geändert"
	if _party_refresh_pending:
		source_text += " · wird aktualisiert"
	_source_label.text = source_text if character_count == 0 else (
		"%s · sehr große Gruppe" % source_text if character_count < 0 else "%s · %d Charaktere" % [source_text, character_count]
	)
	_active_party_button.disabled = _active_levels.is_empty() or _source == "active_party"
	_add_row_button.disabled = _rows.size() >= MAX_LEVEL_ROWS
	_clear_button.disabled = _rows.is_empty()
	_render_summary()
	_render_timeline()
	if _party_refresh_pending:
		_notice.text = "Aktive Party wird aktualisiert; das letzte Budget ist noch nicht final."
	elif _loading:
		_notice.text = "Rastbudget wird berechnet …"
	elif not _calculation.is_empty() and not _calculation.get("ok", false):
		_notice.text = str(_calculation.get("error", "Rastbudget ist nicht verfügbar."))
	else:
		_notice.text = "D&D 5e 2014 · Drittel kaufmännisch, gleiche XP-Anteile aufgerundet. Eigene Gruppen bleiben lokal."


func _render_rows() -> void:
	_clear(_rows_list)
	if _rows.is_empty():
		_add_muted(_rows_list, "Keine Charaktere. Nutze die aktive Party oder füge eine Zeile hinzu.")
		return
	for index in _rows.size():
		var row: Dictionary = _rows[index]
		var controls := HBoxContainer.new()
		controls.add_theme_constant_override("separation", 8)
		var level := OptionButton.new()
		level.name = "AdventuringDayLevel%d" % index
		level.custom_minimum_size = Vector2(130, 34)
		for value in range(1, 21):
			level.add_item("Stufe %d" % value, value)
		level.select(clampi(int(row["level"]), 1, 20) - 1)
		level.item_selected.connect(_on_level_selected.bind(index))
		controls.add_child(level)
		var count := LineEdit.new()
		count.name = "AdventuringDayCount%d" % index
		count.text = str(int(row["count"]))
		count.placeholder_text = "Anzahl"
		count.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		count.text_submitted.connect(func(_value: String) -> void: _commit_count(index, count))
		count.focus_exited.connect(func() -> void: _commit_count(index, count))
		controls.add_child(count)
		var remove := Button.new()
		remove.text = "Entfernen"
		remove.pressed.connect(_remove_row.bind(index))
		controls.add_child(remove)
		_rows_list.add_child(controls)


func _render_summary() -> void:
	_clear(_summary_box)
	if _calculation.is_empty():
		_add_muted(_summary_box, "Noch kein berechenbarer Gruppenstand.")
		return
	if not _calculation.get("ok", false):
		var error := Label.new()
		error.text = str(_calculation.get("error", "Berechnung fehlgeschlagen."))
		error.add_theme_color_override("font_color", WARNING)
		_summary_box.add_child(error)
		return
	var budget: Dictionary = _calculation["budget"]
	var progress: Dictionary = _calculation["progress"]
	var eyebrow := Label.new()
	eyebrow.text = "TAGESPLAN" if _mode == "budget" else "FORTSCHRITT"
	eyebrow.add_theme_color_override("font_color", BRASS_MARK)
	eyebrow.add_theme_font_size_override("font_size", 11)
	_summary_box.add_child(eyebrow)
	var hero := Label.new()
	if _mode == "budget":
		hero.text = "%d XP pro Tag" % int(budget["total_budget_xp"])
	else:
		hero.text = "%s Adventuring Days" % _format_days(float(progress["total_days"]))
	hero.add_theme_color_override("font_color", VELLUM_MIST)
	hero.add_theme_font_size_override("font_size", 20)
	_summary_box.add_child(hero)
	var facts := Label.new()
	if _mode == "budget":
		facts.text = "SR 1 bei %d XP  ·  SR 2 bei %d XP  ·  Long Rest bei %d XP" % [
			int(budget["first_short_rest_xp"]),
			int(budget["second_short_rest_xp"]),
			int(budget["total_budget_xp"]),
		]
	else:
		facts.text = "%d XP/SC  ·  %d Short Rests  ·  %d Long Rests  ·  %s" % [
			int(progress["per_character_awarded_xp"]),
			int(progress["short_rests"]),
			int(progress["long_rests"]),
			_format_level_progress(progress["level_progress"]),
		]
	facts.add_theme_color_override("font_color", QUIET_INK)
	facts.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_summary_box.add_child(facts)


func _render_timeline() -> void:
	_clear(_timeline_list)
	if _mode != "progress" or not _calculation.get("ok", false):
		_add_muted(_timeline_list, "Wechsle zu XP → Tage, um Rast- und Level-Etappen zu sehen.")
		return
	var events: Array = _calculation.get("progress", {}).get("events", [])
	if events.is_empty():
		_add_muted(_timeline_list, "Für 0 XP entstehen noch keine Etappen.")
		return
	var visible_count := mini(events.size(), MAX_VISIBLE_EVENTS)
	for index in visible_count:
		var event: Dictionary = events[index]
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 8)
		var marker := Label.new()
		marker.text = "◆"
		marker.add_theme_color_override("font_color", BRASS_MARK)
		row.add_child(marker)
		var text_label := Label.new()
		text_label.text = _event_text(event)
		text_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		text_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		row.add_child(text_label)
		_timeline_list.add_child(row)
	if events.size() > visible_count:
		_add_muted(_timeline_list, "+ %d weitere Etappen; Eingabe für eine kürzere Ansicht reduzieren." % (events.size() - visible_count))


func _event_text(event: Dictionary) -> String:
	var prefix := "Tag %d · %d XP · " % [int(event["day_number"]), int(event["group_xp"])]
	var suffix := " · Teil-Tag" if bool(event["partial_day"]) else ""
	match str(event["type"]):
		"level_up":
			return "%s%d SC erreichen Stufe %d%s" % [prefix, int(event["affected_characters"]), int(event["new_level"]), suffix]
		"short_rest":
			return "%sShort Rest%s" % [prefix, suffix]
		_:
			return "%sLong Rest%s" % [prefix, suffix]


func _rows_from_levels(levels: Array) -> Array:
	var counts := {}
	for level_value in levels:
		var level := int(level_value)
		counts[level] = int(counts.get(level, 0)) + 1
	var rows: Array = []
	for level in range(1, 21):
		if counts.has(level):
			rows.append({"level": level, "count": counts[level]})
	return rows


func _merge_rows_by_level(rows_value: Array) -> Array:
	var counts := {}
	for row in rows_value:
		var level := clampi(int(row.get("level", 1)), 1, 20)
		counts[level] = int(counts.get(level, 0)) + maxi(1, int(row.get("count", 1)))
	var rows: Array = []
	for level in range(1, 21):
		if counts.has(level):
			rows.append({"level": level, "count": counts[level]})
	return rows


func _format_level_progress(progress: Array) -> String:
	if progress.is_empty():
		return "keine Level-ups"
	var parts: Array[String] = []
	for item in progress:
		var suffix := " → L%d" % int(item["end_level"]) if int(item["level_ups"]) > 0 else " bleibt"
		parts.append("%dx L%d%s" % [int(item["character_count"]), int(item["start_level"]), suffix])
	return ", ".join(parts)


func _format_days(value: float) -> String:
	var rounded: float = round(value * 100.0) / 100.0
	return str(int(rounded)) if is_equal_approx(rounded, round(rounded)) else str(rounded)


func _clear(container: Container) -> void:
	for child in container.get_children():
		container.remove_child(child)
		child.queue_free()


func _add_muted(container: Container, text_value: String) -> void:
	var label := Label.new()
	label.text = text_value
	label.add_theme_color_override("font_color", QUIET_INK)
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	container.add_child(label)


func _exit_tree() -> void:
	if calculation_controller != null:
		calculation_controller.cancel_all()
