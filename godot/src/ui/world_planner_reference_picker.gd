class_name WorldPlannerReferencePicker
extends ConfirmationDialog

const WorldPlannerReferenceOptionsController = preload("res://godot/src/features/worldplanner/world_planner_reference_options_controller.gd")

const PAGE_SIZE := 50
const QUIET_INK := Color("#91a5a2")
const BRASS_MARK := Color("#d2a743")

signal references_selected(field_key: String, reference_ids: Array)

var data_root := "user://salt-marcher"
var options_controller: WorldPlannerReferenceOptionsController

var _field_key := ""
var _kind := ""
var _multi := false
var _selected_ids: Dictionary = {}
var _rows: Array = []
var _total := 0
var _page := 0
var _status := "uninitialized"
var _error := ""
var _search: LineEdit
var _selection_label: Label
var _result_list: VBoxContainer
var _footer: Label
var _previous: Button
var _next: Button
var _debounce: Timer


func _ready() -> void:
	if options_controller == null:
		options_controller = WorldPlannerReferenceOptionsController.new(data_root)
		add_child(options_controller)
	options_controller.query_started.connect(_on_query_started)
	options_controller.result_published.connect(_on_result_published)
	_build_surface()
	confirmed.connect(_confirm_selection)
	canceled.connect(_cancel_picker)
	visibility_changed.connect(_on_visibility_changed)


func open_picker(field_key: String, title_text: String, kind: String, selected_ids: Array, multi: bool) -> Dictionary:
	_field_key = field_key
	_kind = kind
	_multi = multi
	_selected_ids.clear()
	for value in selected_ids:
		var reference_id := str(value)
		if not reference_id.is_empty():
			_selected_ids[reference_id] = true
	_rows.clear()
	_total = 0
	_page = 0
	_status = "loading"
	_error = ""
	title = title_text
	ok_button_text = "Auswahl übernehmen"
	get_cancel_button().text = "Abbrechen"
	_search.text = ""
	_search.placeholder_text = "%s suchen" % _kind_label(kind)
	_render()
	popup_centered()
	_search.grab_focus()
	return _submit_query()


func snapshot() -> Dictionary:
	var selected: Array = _selected_ids.keys()
	selected.sort()
	return {
		"field_key": _field_key,
		"kind": _kind,
		"multi": _multi,
		"selected_ids": selected,
		"rows": _rows.duplicate(true),
		"total": _total,
		"page": _page,
		"status": _status,
		"error": _error,
	}


func _build_surface() -> void:
	name = "WorldPlannerReferencePicker"
	min_size = Vector2i(620, 520)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 8)
	add_child(column)
	var selection_row := HBoxContainer.new()
	selection_row.add_theme_constant_override("separation", 8)
	column.add_child(selection_row)
	var eyebrow := Label.new()
	eyebrow.text = "AKTUELL VERKNÜPFT"
	eyebrow.add_theme_font_size_override("font_size", 10)
	eyebrow.add_theme_color_override("font_color", BRASS_MARK)
	selection_row.add_child(eyebrow)
	_selection_label = Label.new()
	_selection_label.name = "ReferencePickerSelection"
	_selection_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_selection_label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	selection_row.add_child(_selection_label)
	var clear := Button.new()
	clear.name = "ReferencePickerClear"
	clear.text = "Verknüpfung lösen"
	clear.flat = true
	clear.pressed.connect(_clear_selection)
	selection_row.add_child(clear)
	_search = LineEdit.new()
	_search.name = "ReferencePickerSearch"
	_search.custom_minimum_size = Vector2(0, 28)
	_search.text_changed.connect(_on_search_changed)
	_search.text_submitted.connect(func(_value: String) -> void: _submit_query())
	column.add_child(_search)
	var divider := ColorRect.new()
	divider.color = BRASS_MARK
	divider.custom_minimum_size = Vector2(0, 2)
	column.add_child(divider)
	var scroll := ScrollContainer.new()
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	column.add_child(scroll)
	_result_list = VBoxContainer.new()
	_result_list.name = "ReferencePickerResults"
	_result_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_result_list.add_theme_constant_override("separation", 4)
	scroll.add_child(_result_list)
	var footer_row := HBoxContainer.new()
	footer_row.add_theme_constant_override("separation", 8)
	column.add_child(footer_row)
	_footer = Label.new()
	_footer.name = "ReferencePickerFooter"
	_footer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_footer.add_theme_color_override("font_color", QUIET_INK)
	footer_row.add_child(_footer)
	_previous = Button.new()
	_previous.name = "ReferencePickerPrevious"
	_previous.text = "Zurück"
	_previous.custom_minimum_size = Vector2(72, 28)
	_previous.pressed.connect(_change_page.bind(-1))
	footer_row.add_child(_previous)
	_next = Button.new()
	_next.name = "ReferencePickerNext"
	_next.text = "Weiter"
	_next.custom_minimum_size = Vector2(72, 28)
	_next.pressed.connect(_change_page.bind(1))
	footer_row.add_child(_next)
	_debounce = Timer.new()
	_debounce.one_shot = true
	_debounce.wait_time = 0.2
	_debounce.timeout.connect(_submit_query)
	add_child(_debounce)


func _submit_query() -> Dictionary:
	if _field_key.is_empty():
		return {"ok": false, "status": "picker_required"}
	_status = "loading" if _rows.is_empty() else "refreshing"
	_error = ""
	_render()
	return options_controller.query(_field_key, _kind, _search.text, _page * PAGE_SIZE, PAGE_SIZE)


func _on_search_changed(_value: String) -> void:
	_page = 0
	_debounce.start()


func _change_page(delta: int) -> void:
	var page_count := maxi(1, int((_total + PAGE_SIZE - 1) / PAGE_SIZE))
	var next_page := clampi(_page + delta, 0, page_count - 1)
	if next_page == _page:
		return
	_page = next_page
	_submit_query()


func _on_query_started(request: Dictionary) -> void:
	if str(request.get("picker_key", "")) != _field_key:
		return
	_status = "loading" if _rows.is_empty() else "refreshing"
	_render()


func _on_result_published(result: Dictionary) -> void:
	if str(result.get("request", {}).get("picker_key", "")) != _field_key:
		return
	if result.get("ok", false):
		_rows = result.get("rows", []).duplicate(true)
		_total = int(result.get("total", 0))
		_status = str(result.get("status", "ready"))
	else:
		_rows.clear()
		_total = 0
		_status = "failed"
		_error = str(result.get("error", "Referenzen konnten nicht geladen werden."))
	_render()


func _render() -> void:
	if _result_list == null:
		return
	for child in _result_list.get_children():
		child.queue_free()
	var selected: Array = _selected_ids.keys()
	selected.sort()
	_selection_label.text = "Keine" if selected.is_empty() else (
		"%d Referenzen" % selected.size() if _multi else str(selected[0])
	)
	if _status == "failed":
		_add_message(_error)
	elif _rows.is_empty():
		_add_message("Referenzen werden geladen …" if _status == "loading" else "Keine passenden Referenzen.")
	else:
		for row in _rows:
			_add_result(row)
	var page_count := maxi(1, int((_total + PAGE_SIZE - 1) / PAGE_SIZE))
	_footer.text = "%d Treffer%s · Seite %d/%d" % [
		_total,
		" · wird aktualisiert" if _status == "refreshing" else "",
		_page + 1,
		page_count,
	]
	_previous.visible = page_count > 1
	_next.visible = page_count > 1
	_previous.disabled = _page <= 0 or _status == "failed"
	_next.disabled = _page >= page_count - 1 or _status == "failed"


func _add_result(row: Dictionary) -> void:
	var reference_id := str(row.get("reference_id", row.get("definition_id", "")))
	var choice := CheckButton.new()
	choice.name = "ReferencePickerChoice"
	choice.text = "%s    %s" % [row.get("name", reference_id), reference_id]
	choice.tooltip_text = "%s auswählen" % row.get("name", reference_id)
	choice.button_pressed = _selected_ids.has(reference_id)
	choice.custom_minimum_size = Vector2(0, 30)
	choice.toggled.connect(_toggle_reference.bind(reference_id))
	_result_list.add_child(choice)


func _add_message(message: String) -> void:
	var label := Label.new()
	label.text = message
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.add_theme_color_override("font_color", QUIET_INK)
	_result_list.add_child(label)


func _toggle_reference(enabled: bool, reference_id: String) -> void:
	if enabled:
		if not _multi:
			_selected_ids.clear()
		_selected_ids[reference_id] = true
	else:
		_selected_ids.erase(reference_id)
	_render()


func _clear_selection() -> void:
	_selected_ids.clear()
	_render()


func _confirm_selection() -> void:
	var selected: Array = _selected_ids.keys()
	selected.sort()
	references_selected.emit(_field_key, selected)
	_field_key = ""
	options_controller.cancel_all()


func _cancel_picker() -> void:
	_field_key = ""
	options_controller.cancel_all()


func _on_visibility_changed() -> void:
	if not visible and options_controller != null:
		options_controller.cancel_all()


func _kind_label(kind: String) -> String:
	return {"creature": "Monster", "faction": "Fraktionen", "place": "Orte"}.get(kind, kind)


func _exit_tree() -> void:
	if options_controller != null:
		options_controller.cancel_all()
