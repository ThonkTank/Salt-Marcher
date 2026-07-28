class_name FactionInventoryEditor
extends VBoxContainer

## Bounded editor for optional finite Creature stock limits owned by one faction.

const PAGE_SIZE := 8
const MAX_LIMIT := 2_147_483_647
const QUIET_INK := Color("#91a5a2")
const BRASS_MARK := Color("#d2a743")

signal choose_requested(selected_ids: Array)

var _limits: Dictionary = {}
var _labels: Dictionary = {}
var _page := 0
var _count: Label
var _rows: VBoxContainer
var _page_label: Label
var _previous: Button
var _next: Button


func _ready() -> void:
	_build_surface()
	_render()


func set_inventory(limits: Dictionary, labels: Dictionary = {}) -> void:
	_limits.clear()
	_labels = labels.duplicate(true)
	for creature_id_value in limits:
		var creature_id := str(creature_id_value)
		var limit = limits[creature_id_value]
		if not creature_id.is_empty() and limit != null:
			_limits[creature_id] = int(limit)
	_page = 0
	_render()


func apply_selection(reference_ids: Array, label_resolver: Callable = Callable()) -> void:
	var selected := {}
	for value in reference_ids:
		var creature_id := str(value)
		if creature_id.is_empty():
			continue
		selected[creature_id] = true
		if not _limits.has(creature_id):
			_limits[creature_id] = 1
		if label_resolver.is_valid():
			var resolved_label := str(label_resolver.call(creature_id))
			if resolved_label != creature_id or not _labels.has(creature_id):
				_labels[creature_id] = resolved_label
	for existing_id_value in _limits.keys():
		var existing_id := str(existing_id_value)
		if not selected.has(existing_id):
			_limits.erase(existing_id)
			_labels.erase(existing_id)
	_page = 0
	_render()


func inventory_limits() -> Dictionary:
	var result := {}
	var ids: Array = _limits.keys()
	ids.sort()
	for creature_id_value in ids:
		var creature_id := str(creature_id_value)
		result[creature_id] = int(_limits[creature_id])
	return result


func snapshot() -> Dictionary:
	return {
		"limits": inventory_limits(),
		"labels": _labels.duplicate(true),
		"page": _page,
		"materialized_row_count": 0 if _rows == null else _rows.get_child_count(),
	}


func _build_surface() -> void:
	name = "FactionInventoryEditor"
	add_theme_constant_override("separation", 5)
	var heading := HBoxContainer.new()
	heading.add_theme_constant_override("separation", 8)
	add_child(heading)
	var eyebrow := Label.new()
	eyebrow.text = "MONSTERBESTAND"
	eyebrow.add_theme_font_size_override("font_size", 10)
	eyebrow.add_theme_color_override("font_color", BRASS_MARK)
	heading.add_child(eyebrow)
	_count = Label.new()
	_count.name = "FactionInventoryCount"
	_count.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_count.add_theme_color_override("font_color", QUIET_INK)
	heading.add_child(_count)
	var choose := Button.new()
	choose.name = "FactionInventoryChooseCreatures"
	choose.text = "Monster auswählen"
	choose.tooltip_text = "Creature-Statblocks mit einem endlichen Fraktionsbestand auswählen"
	choose.pressed.connect(_request_choices)
	heading.add_child(choose)
	var explanation := Label.new()
	explanation.text = "Nicht gelistete Monster sind unbegrenzt verfügbar. 0 sperrt die Generierung aus diesem Bestand."
	explanation.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	explanation.add_theme_color_override("font_color", QUIET_INK)
	add_child(explanation)
	var divider := ColorRect.new()
	divider.color = BRASS_MARK
	divider.custom_minimum_size = Vector2(0, 1)
	add_child(divider)
	var scroll := ScrollContainer.new()
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	scroll.custom_minimum_size = Vector2(0, 112)
	add_child(scroll)
	_rows = VBoxContainer.new()
	_rows.name = "FactionInventoryRows"
	_rows.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_rows.add_theme_constant_override("separation", 4)
	scroll.add_child(_rows)
	var paging := HBoxContainer.new()
	paging.add_theme_constant_override("separation", 8)
	add_child(paging)
	_page_label = Label.new()
	_page_label.name = "FactionInventoryPage"
	_page_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_page_label.add_theme_color_override("font_color", QUIET_INK)
	paging.add_child(_page_label)
	_previous = Button.new()
	_previous.name = "FactionInventoryPrevious"
	_previous.text = "Zurück"
	_previous.pressed.connect(_change_page.bind(-1))
	paging.add_child(_previous)
	_next = Button.new()
	_next.name = "FactionInventoryNext"
	_next.text = "Weiter"
	_next.pressed.connect(_change_page.bind(1))
	paging.add_child(_next)


func _render() -> void:
	if _rows == null:
		return
	for child in _rows.get_children():
		_rows.remove_child(child)
		child.queue_free()
	var ids: Array = _limits.keys()
	ids.sort_custom(func(left: Variant, right: Variant) -> bool:
		var left_id := str(left)
		var right_id := str(right)
		var left_label := str(_labels.get(left_id, left_id)).to_lower()
		var right_label := str(_labels.get(right_id, right_id)).to_lower()
		return left_id < right_id if left_label == right_label else left_label < right_label
	)
	_count.text = "%d finite Limits" % ids.size()
	var page_count := maxi(1, int((ids.size() + PAGE_SIZE - 1) / PAGE_SIZE))
	_page = clampi(_page, 0, page_count - 1)
	_page_label.text = "Seite %d/%d · maximal %d sichtbare Zeilen" % [_page + 1, page_count, PAGE_SIZE]
	_previous.visible = page_count > 1
	_next.visible = page_count > 1
	_previous.disabled = _page <= 0
	_next.disabled = _page >= page_count - 1
	if ids.is_empty():
		var empty := Label.new()
		empty.text = "Alle Creature-Statblocks sind unbegrenzt verfügbar."
		empty.add_theme_color_override("font_color", QUIET_INK)
		_rows.add_child(empty)
		return
	var first := _page * PAGE_SIZE
	var end := mini(first + PAGE_SIZE, ids.size())
	for index in range(first, end):
		_add_limit_row(str(ids[index]))


func _add_limit_row(creature_id: String) -> void:
	var row := HBoxContainer.new()
	row.name = "FactionInventoryRow"
	row.add_theme_constant_override("separation", 8)
	_rows.add_child(row)
	var identity := Label.new()
	identity.text = "%s  ·  %s" % [str(_labels.get(creature_id, creature_id)), creature_id]
	identity.tooltip_text = creature_id
	identity.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	identity.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(identity)
	var limit := SpinBox.new()
	limit.name = "FactionInventoryLimit"
	limit.min_value = 0
	limit.max_value = MAX_LIMIT
	limit.step = 1
	limit.allow_greater = false
	limit.allow_lesser = false
	limit.custom_minimum_size = Vector2(112, 28)
	limit.value = int(_limits[creature_id])
	limit.value_changed.connect(_set_limit.bind(creature_id))
	row.add_child(limit)
	var unlimited := Button.new()
	unlimited.name = "FactionInventoryUnlimited"
	unlimited.text = "Unbegrenzt"
	unlimited.tooltip_text = "Das finite Limit für %s entfernen" % str(_labels.get(creature_id, creature_id))
	unlimited.pressed.connect(_remove_limit.bind(creature_id))
	row.add_child(unlimited)


func _request_choices() -> void:
	var ids: Array = _limits.keys()
	ids.sort()
	choose_requested.emit(ids)


func _set_limit(value: float, creature_id: String) -> void:
	_limits[creature_id] = int(value)


func _remove_limit(creature_id: String) -> void:
	_limits.erase(creature_id)
	_labels.erase(creature_id)
	_render()


func _change_page(delta: int) -> void:
	var page_count := maxi(1, int((_limits.size() + PAGE_SIZE - 1) / PAGE_SIZE))
	var next_page := clampi(_page + delta, 0, page_count - 1)
	if next_page == _page:
		return
	_page = next_page
	_render()
