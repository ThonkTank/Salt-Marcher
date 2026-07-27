class_name DefinitionConflictLedger
extends ColorRect

## Modal, consequence-first resolution of staged Shared-Definition conflicts.

signal resolve_requested(import_id: String, decisions: Dictionary)
signal discard_requested(import_id: String)
signal cancel_requested

var _panel_style: StyleBox
var _display_font: Font
var _brass: Color
var _quiet_ink: Color
var _counter: Label
var _title: Label
var _comparison: Label
var _affected: Label
var _keep_choice: CheckBox
var _imported_choice: CheckBox
var _both_choice: CheckBox
var _keep_consequence: Label
var _imported_consequence: Label
var _both_consequence: Label
var _continue_button: Button
var _discard_button: Button
var _import_id := ""
var _conflicts: Array = []
var _decisions := {}
var _index := 0
var _busy := false


func _init(panel_style: StyleBox, display_font: Font, brass: Color, quiet_ink: Color) -> void:
	_panel_style = panel_style
	_display_font = display_font
	_brass = brass
	_quiet_ink = quiet_ink


func _ready() -> void:
	name = "DefinitionConflictOverlay"
	color = Color(0.02, 0.04, 0.05, 0.92)
	mouse_filter = Control.MOUSE_FILTER_STOP
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	visible = false
	_build_surface()


func present(result: Dictionary) -> void:
	_import_id = str(result.get("import_id", ""))
	_conflicts = result.get("conflicts", []).duplicate(true)
	_decisions.clear()
	_index = 0
	_busy = false
	visible = true
	_render_conflict()


func dismiss() -> void:
	visible = false
	_import_id = ""
	_conflicts.clear()
	_decisions.clear()
	_index = 0
	_busy = false


func set_busy(busy: bool) -> void:
	_busy = busy
	_refresh_actions()


func is_presented() -> bool:
	return visible


func _build_surface() -> void:
	var center := CenterContainer.new()
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(center)

	var ledger := PanelContainer.new()
	ledger.custom_minimum_size = Vector2(780, 600)
	ledger.add_theme_stylebox_override("panel", _panel_style)
	center.add_child(ledger)

	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 30)
	margin.add_theme_constant_override("margin_right", 30)
	margin.add_theme_constant_override("margin_top", 24)
	margin.add_theme_constant_override("margin_bottom", 24)
	ledger.add_child(margin)

	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 10)
	margin.add_child(column)

	_counter = Label.new()
	_counter.name = "DefinitionConflictCounter"
	_counter.add_theme_color_override("font_color", _brass)
	_counter.add_theme_font_size_override("font_size", 12)
	column.add_child(_counter)

	_title = Label.new()
	_title.name = "DefinitionConflictTitle"
	_title.add_theme_font_override("font", _display_font)
	_title.add_theme_font_size_override("font_size", 28)
	column.add_child(_title)

	_comparison = Label.new()
	_comparison.name = "DefinitionConflictComparison"
	_comparison.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_comparison.add_theme_color_override("font_color", _quiet_ink)
	column.add_child(_comparison)

	_affected = Label.new()
	_affected.name = "DefinitionConflictAffectedCampaigns"
	_affected.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	column.add_child(_affected)
	column.add_child(HSeparator.new())

	var group := ButtonGroup.new()
	var keep := _build_choice(column, "KeepExistingDefinitionChoice", "Vorhandene Definition behalten", group, "keep_existing")
	_keep_choice = keep["choice"]
	_keep_consequence = keep["consequence"]
	var imported := _build_choice(column, "UseImportedDefinitionChoice", "Importierte Definition verwenden", group, "use_imported")
	_imported_choice = imported["choice"]
	_imported_consequence = imported["consequence"]
	var both := _build_choice(column, "RetainBothDefinitionsChoice", "Beide als getrennte Definitionen behalten", group, "retain_both")
	_both_choice = both["choice"]
	_both_consequence = both["consequence"]

	var spacer := Control.new()
	spacer.size_flags_vertical = Control.SIZE_EXPAND_FILL
	column.add_child(spacer)

	var actions := HBoxContainer.new()
	actions.alignment = BoxContainer.ALIGNMENT_END
	actions.add_theme_constant_override("separation", 12)
	column.add_child(actions)
	_discard_button = Button.new()
	_discard_button.name = "DiscardConflictingImportButton"
	_discard_button.text = "Import verwerfen"
	_discard_button.pressed.connect(_discard_or_cancel)
	actions.add_child(_discard_button)
	_continue_button = Button.new()
	_continue_button.name = "ContinueConflictingImportButton"
	_continue_button.text = "Entscheidung vormerken"
	_continue_button.disabled = true
	_continue_button.custom_minimum_size = Vector2(210, 44)
	_continue_button.add_theme_stylebox_override("normal", _action_style(_brass))
	_continue_button.add_theme_stylebox_override("hover", _action_style(_brass.lightened(0.12)))
	_continue_button.add_theme_stylebox_override("pressed", _action_style(_brass.darkened(0.12)))
	_continue_button.add_theme_color_override("font_color", Color("#0a1114"))
	_continue_button.add_theme_color_override("font_hover_color", Color("#0a1114"))
	_continue_button.add_theme_color_override("font_pressed_color", Color("#0a1114"))
	_continue_button.pressed.connect(_advance)
	actions.add_child(_continue_button)


func _build_choice(parent: VBoxContainer, control_name: String, text: String, group: ButtonGroup, value: String) -> Dictionary:
	var row := VBoxContainer.new()
	row.add_theme_constant_override("separation", 2)
	parent.add_child(row)
	var choice := CheckBox.new()
	choice.name = control_name
	choice.text = text
	choice.button_group = group
	choice.toggled.connect(func(pressed: bool) -> void:
		if pressed:
			_select(value)
	)
	row.add_child(choice)
	var consequence := Label.new()
	consequence.name = control_name + "Consequence"
	consequence.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	consequence.add_theme_color_override("font_color", _quiet_ink)
	consequence.add_theme_font_size_override("font_size", 13)
	row.add_child(consequence)
	return {"choice": choice, "consequence": consequence}


func _render_conflict() -> void:
	if _conflicts.is_empty() or _index < 0 or _index >= _conflicts.size():
		return
	var conflict: Dictionary = _conflicts[_index]
	var definition_id := str(conflict.get("definition_id", ""))
	var existing: Dictionary = conflict.get("existing", {})
	var imported: Dictionary = conflict.get("imported", {})
	_counter.text = "DEFINITION %d VON %d  /  AUSDRÜCKLICHE ENTSCHEIDUNG" % [_index + 1, _conflicts.size()]
	_title.text = str(imported.get("name", definition_id))
	_comparison.text = "Gleiche Identität „%s“, aber unterschiedlicher Inhalt. Vorhanden: %s · %s. Import: %s · %s." % [
		definition_id,
		existing.get("kind", "unbekannt"),
		str(existing.get("sha256", "")).left(12),
		imported.get("kind", "unbekannt"),
		str(imported.get("sha256", "")).left(12),
	]
	var affected_names: Array[String] = []
	for campaign in conflict.get("affected_existing_campaigns", []):
		affected_names.append(str(campaign.get("name", campaign.get("campaign_id", "Unbekannte Campaign"))))
	_affected.text = (
		"Betroffene vorhandene Campaigns: %s" % ", ".join(affected_names)
		if not affected_names.is_empty()
		else "Keine vorhandene Campaign verweist derzeit auf diese Definition."
	)
	var consequences: Dictionary = conflict.get("consequences", {})
	_keep_consequence.text = str(consequences.get("keep_existing", ""))
	_imported_consequence.text = str(consequences.get("use_imported", ""))
	_both_consequence.text = str(consequences.get("retain_both", ""))
	_keep_choice.set_pressed_no_signal(_decisions.get(definition_id, "") == "keep_existing")
	_imported_choice.set_pressed_no_signal(_decisions.get(definition_id, "") == "use_imported")
	_both_choice.set_pressed_no_signal(_decisions.get(definition_id, "") == "retain_both")
	_refresh_actions()
	_keep_choice.grab_focus.call_deferred()


func _select(choice: String) -> void:
	if _conflicts.is_empty():
		return
	_decisions[str(_conflicts[_index].get("definition_id", ""))] = choice
	_refresh_actions()


func _advance() -> void:
	if _conflicts.is_empty():
		return
	var definition_id := str(_conflicts[_index].get("definition_id", ""))
	if not _decisions.has(definition_id):
		return
	if _index < _conflicts.size() - 1:
		_index += 1
		_render_conflict()
	else:
		resolve_requested.emit(_import_id, _decisions.duplicate(true))


func _discard_or_cancel() -> void:
	if _busy:
		cancel_requested.emit()
	else:
		discard_requested.emit(_import_id)


func _refresh_actions() -> void:
	if _continue_button == null or _conflicts.is_empty():
		return
	var definition_id := str(_conflicts[_index].get("definition_id", ""))
	_keep_choice.disabled = _busy
	_imported_choice.disabled = _busy
	_both_choice.disabled = _busy
	_continue_button.disabled = _busy or not _decisions.has(definition_id)
	_continue_button.text = (
		"Import mit Entscheidungen abschließen"
		if _index == _conflicts.size() - 1
		else "Entscheidung vormerken"
	)
	_discard_button.text = "Auflösung abbrechen" if _busy else "Import verwerfen"


func _action_style(fill: Color) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = fill
	style.border_color = fill
	style.set_border_width_all(1)
	style.set_corner_radius_all(6)
	style.content_margin_left = 16
	style.content_margin_right = 16
	style.content_margin_top = 10
	style.content_margin_bottom = 10
	return style
