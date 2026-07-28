class_name EncounterRuntimeWorkspace
extends Control

## Native manual Encounter run sheet: saved plan -> initiative -> combat -> result.

const EncounterRuntimeReadController = preload("res://godot/src/features/encounter/encounter_runtime_read_controller.gd")
const EncounterRuntimeCommandController = preload("res://godot/src/features/encounter/encounter_runtime_command_controller.gd")

const INK := Color("#0a1114")
const SLATE := Color("#152a32")
const PANEL := Color("#1b333b")
const PANEL_ACTIVE := Color("#223e46")
const VELLUM := Color("#d9e3dd")
const QUIET := Color("#91a5a2")
const BRASS := Color("#d2a743")
const SEA_GLASS := Color("#75b7ae")
const DANGER := Color("#d97c6c")

var data_root := "user://salt-marcher"
var runtime_coordinator
var context_id := "encounter_context.manual"
var _reader: EncounterRuntimeReadController
var _commands: EncounterRuntimeCommandController
var _snapshot: Dictionary = {}
var _rendering := false

var _search: LineEdit
var _plan_list: VBoxContainer
var _phase_label: Label
var _turn_strip: HBoxContainer
var _content: VBoxContainer
var _status: Label
var _end_dialog: ConfirmationDialog


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_reader = EncounterRuntimeReadController.new(data_root)
	_reader.result_published.connect(_apply_snapshot)
	add_child(_reader)
	_commands = EncounterRuntimeCommandController.new(data_root, runtime_coordinator)
	_commands.command_started.connect(_command_started)
	_commands.command_completed.connect(_command_completed)
	add_child(_commands)
	_build_surface()
	refresh()


func refresh(search_text: String = "") -> Dictionary:
	if _search != null and search_text.is_empty():
		search_text = _search.text
	_set_status("Encounter-Wahrheit wird geladen …", QUIET)
	return _reader.query(search_text, context_id)


func snapshot() -> Dictionary:
	return _snapshot.duplicate(true)


func _build_surface() -> void:
	var backdrop := ColorRect.new()
	backdrop.color = INK
	backdrop.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(backdrop)
	var margin := MarginContainer.new()
	margin.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	margin.add_theme_constant_override("margin_left", 22)
	margin.add_theme_constant_override("margin_right", 22)
	margin.add_theme_constant_override("margin_top", 18)
	margin.add_theme_constant_override("margin_bottom", 18)
	add_child(margin)
	var page := VBoxContainer.new()
	page.add_theme_constant_override("separation", 12)
	margin.add_child(page)

	var heading := HBoxContainer.new()
	heading.add_theme_constant_override("separation", 10)
	page.add_child(heading)
	var title := Label.new()
	title.text = "ENCOUNTER"
	title.add_theme_color_override("font_color", BRASS)
	title.add_theme_font_size_override("font_size", 20)
	heading.add_child(title)
	var subtitle := Label.new()
	subtitle.text = "Live-Musterbuch"
	subtitle.add_theme_color_override("font_color", QUIET)
	subtitle.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	heading.add_child(subtitle)
	_phase_label = Label.new()
	_phase_label.name = "EncounterPhase"
	_phase_label.add_theme_color_override("font_color", VELLUM)
	_phase_label.add_theme_font_size_override("font_size", 15)
	heading.add_child(_phase_label)

	var turn_scroll := ScrollContainer.new()
	turn_scroll.name = "EncounterTurnStripScroll"
	turn_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_AUTO
	turn_scroll.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	turn_scroll.custom_minimum_size = Vector2(0, 48)
	page.add_child(turn_scroll)
	_turn_strip = HBoxContainer.new()
	_turn_strip.name = "EncounterTurnStrip"
	_turn_strip.add_theme_constant_override("separation", 6)
	turn_scroll.add_child(_turn_strip)

	var split := HSplitContainer.new()
	split.size_flags_vertical = Control.SIZE_EXPAND_FILL
	split.split_offset = 318
	page.add_child(split)
	var rail_panel := PanelContainer.new()
	rail_panel.custom_minimum_size = Vector2(292, 0)
	rail_panel.add_theme_stylebox_override("panel", _panel_style(SLATE))
	split.add_child(rail_panel)
	var rail_margin := MarginContainer.new()
	_set_margins(rail_margin, 14)
	rail_panel.add_child(rail_margin)
	var rail := VBoxContainer.new()
	rail.add_theme_constant_override("separation", 9)
	rail_margin.add_child(rail)
	var rail_title := Label.new()
	rail_title.text = "GESPEICHERTE AUFSTELLUNGEN"
	rail_title.add_theme_color_override("font_color", BRASS)
	rail_title.add_theme_font_size_override("font_size", 12)
	rail.add_child(rail_title)
	_search = LineEdit.new()
	_search.name = "EncounterPlanSearch"
	_search.placeholder_text = "Encounter suchen"
	_search.text_changed.connect(_search_changed)
	rail.add_child(_search)
	var plan_scroll := ScrollContainer.new()
	plan_scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	rail.add_child(plan_scroll)
	_plan_list = VBoxContainer.new()
	_plan_list.name = "EncounterPlanRail"
	_plan_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_plan_list.add_theme_constant_override("separation", 6)
	plan_scroll.add_child(_plan_list)
	var rail_hint := Label.new()
	rail_hint.text = "Aufstellungen werden im Katalog gepflegt."
	rail_hint.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	rail_hint.add_theme_color_override("font_color", QUIET)
	rail_hint.add_theme_font_size_override("font_size", 11)
	rail.add_child(rail_hint)

	var stage_panel := PanelContainer.new()
	stage_panel.add_theme_stylebox_override("panel", _panel_style(PANEL))
	split.add_child(stage_panel)
	var stage_margin := MarginContainer.new()
	_set_margins(stage_margin, 18)
	stage_panel.add_child(stage_margin)
	var stage_scroll := ScrollContainer.new()
	stage_scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	stage_scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	stage_margin.add_child(stage_scroll)
	_content = VBoxContainer.new()
	_content.name = "EncounterRuntimeStage"
	_content.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_content.add_theme_constant_override("separation", 10)
	stage_scroll.add_child(_content)

	_status = Label.new()
	_status.name = "EncounterStatus"
	_status.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_status.add_theme_color_override("font_color", QUIET)
	page.add_child(_status)

	_end_dialog = ConfirmationDialog.new()
	_end_dialog.name = "EndEncounterDialog"
	_end_dialog.title = "Kampf beenden?"
	_end_dialog.dialog_text = "Das aktuelle HP-Bild wird als Kampfergebnis festgehalten."
	_end_dialog.ok_button_text = "Kampfergebnis öffnen"
	_end_dialog.confirmed.connect(func() -> void: _commands.end_combat(context_id))
	add_child(_end_dialog)


func _apply_snapshot(result: Dictionary) -> void:
	if not result.get("ok", false):
		_snapshot = {}
		_render_empty(str(result.get("error", "Encounter konnte nicht geladen werden.")))
		return
	_snapshot = result.duplicate(true)
	_render()


func _render() -> void:
	_rendering = true
	_clear_children(_plan_list)
	_clear_children(_turn_strip)
	_clear_children(_content)
	var context: Dictionary = _snapshot.get("context", {})
	var active_plan_id := str(context.get("active_plan_id", ""))
	for plan_value in _snapshot.get("plans", []):
		var plan: Dictionary = plan_value
		var button := Button.new()
		button.text = "%s\n%d Monster · %d Arten" % [plan["name"], int(plan["creature_count"]), int(plan["roster_line_count"])]
		button.alignment = HORIZONTAL_ALIGNMENT_LEFT
		button.custom_minimum_size = Vector2(0, 50)
		button.disabled = str(plan["reference_id"]) == active_plan_id or _commands.busy()
		button.pressed.connect(_open_plan.bind(str(plan["reference_id"])))
		_plan_list.add_child(button)
	if _snapshot.get("plans", []).is_empty():
		_add_hint(_plan_list, "Keine gespeicherte Aufstellung. Im Katalog unter Encounter anlegen.")
	var mode := str(context.get("mode", "builder"))
	_phase_label.text = {
		"builder": "01 · AUFSTELLUNG",
		"initiative": "02 · INITIATIVE",
		"combat": "03 · KAMPF",
		"results": "04 · ERGEBNIS",
	}.get(mode, "ENCOUNTER")
	_render_turn_strip(context)
	match mode:
		"initiative":
			_render_initiative(context)
		"combat":
			_render_combat(context)
		"results":
			_render_results(context)
		_:
			_render_builder(context)
	_set_status(str(context.get("status", "")), QUIET)
	_rendering = false


func _render_turn_strip(context: Dictionary) -> void:
	if context.get("mode", "") != "combat":
		for label in ["AUFSTELLUNG", "INITIATIVE", "KAMPF", "ERGEBNIS"]:
			var marker := Label.new()
			marker.text = "  %s  " % label
			marker.add_theme_color_override("font_color", BRASS if _phase_label.text.contains(label) else QUIET)
			marker.add_theme_font_size_override("font_size", 11)
			_turn_strip.add_child(marker)
		return
	var active_id := str(context.get("active_combatant_id", ""))
	for combatant_value in context.get("combatants", []):
		var combatant: Dictionary = combatant_value
		var marker := PanelContainer.new()
		marker.add_theme_stylebox_override("panel", _panel_style(
			PANEL_ACTIVE if combatant["combatant_id"] == active_id else SLATE,
			BRASS if combatant["combatant_id"] == active_id else Color("#29464e"),
			1
		))
		var label := Label.new()
		label.text = " %d · %s " % [int(combatant["initiative"]), str(combatant["name"])]
		label.add_theme_color_override("font_color", BRASS if combatant["combatant_id"] == active_id else (DANGER if combatant["kind"] != "pc" and int(combatant["current_hp"]) == 0 else VELLUM))
		label.add_theme_font_size_override("font_size", 11)
		marker.add_child(label)
		_turn_strip.add_child(marker)


func _render_builder(context: Dictionary) -> void:
	_add_stage_heading("Aufstellung", "Öffne links einen gespeicherten Encounter. Aktuelle Creature-Fakten werden erst beim Öffnen in den Laufzeitkontext übernommen.")
	var roster: Array = context.get("roster", [])
	if roster.is_empty():
		_add_empty_card("Noch keine Aufstellung", "Gespeicherten Encounter links auswählen oder im Katalog anlegen.")
		return
	for entry_value in roster:
		var entry: Dictionary = entry_value
		var row := HBoxContainer.new()
		row.custom_minimum_size = Vector2(0, 44)
		_content.add_child(row)
		var name := Label.new()
		name.text = "%s%s" % [entry["name"], "" if int(entry["quantity"]) == 1 else " ×%d" % int(entry["quantity"])]
		name.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		name.add_theme_color_override("font_color", VELLUM)
		name.add_theme_font_size_override("font_size", 15)
		row.add_child(name)
		_add_data_label(row, "HG %s" % entry["challenge_rating"])
		_add_data_label(row, "%d TP" % int(entry["hit_points"]))
		_add_data_label(row, "RK %d" % int(entry["armor_class"]))
		_add_data_label(row, "%d XP" % (int(entry["xp"]) * int(entry["quantity"])))
	var party_count := int(_snapshot.get("party_summary", {}).get("active_count", 0))
	_add_hint(_content, "%d aktive Party-Mitglieder werden beim Kampfstart in die Initiative übernommen." % party_count)
	var action_row := HBoxContainer.new()
	_content.add_child(action_row)
	var start := _add_button(action_row, "Initiative öffnen", func() -> void: _commands.open_initiative(context_id), "OpenEncounterInitiative")
	start.disabled = party_count == 0 or _commands.busy()


func _render_initiative(context: Dictionary) -> void:
	_add_stage_heading("Initiative erfassen", "Ein Monster-Typ erhält einen gemeinsamen Wurf; im Kampf bleibt trotzdem jedes Mitglied einzeln erhalten.")
	for entry_value in context.get("initiative", []):
		var entry: Dictionary = entry_value
		var row := HBoxContainer.new()
		row.custom_minimum_size = Vector2(0, 42)
		_content.add_child(row)
		var kind := Label.new()
		kind.text = "SC" if entry["kind"] == "pc" else "GEGNER"
		kind.custom_minimum_size = Vector2(64, 0)
		kind.add_theme_color_override("font_color", SEA_GLASS if entry["kind"] == "pc" else DANGER)
		kind.add_theme_font_size_override("font_size", 10)
		row.add_child(kind)
		var label := Label.new()
		label.text = str(entry["label"])
		label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		label.add_theme_color_override("font_color", VELLUM)
		row.add_child(label)
		var value := SpinBox.new()
		value.name = "Initiative_%s" % str(entry["combatant_id"]).replace(".", "_")
		value.min_value = -100
		value.max_value = 200
		value.step = 1
		value.value = int(entry["initiative"])
		value.custom_minimum_size = Vector2(92, 0)
		value.get_line_edit().text_submitted.connect(_initiative_submitted.bind(str(entry["combatant_id"]), value))
		value.get_line_edit().focus_exited.connect(_initiative_focus_exited.bind(str(entry["combatant_id"]), value))
		row.add_child(value)
	var actions := HBoxContainer.new()
	actions.add_theme_constant_override("separation", 8)
	_content.add_child(actions)
	_add_button(actions, "Alle würfeln", _roll_all, "RollEncounterInitiative")
	_add_button(actions, "Zur Aufstellung", func() -> void: _commands.return_to_builder(context_id))
	var spacer := Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	actions.add_child(spacer)
	var confirm := _add_button(actions, "Kampf starten", func() -> void: _commands.confirm_initiative(context_id), "ConfirmEncounterInitiative")
	confirm.add_theme_color_override("font_color", BRASS)


func _render_combat(context: Dictionary) -> void:
	var round := int(context.get("round", 1))
	_add_stage_heading(
		"Runde %d" % round,
		"%d/%d Gegner stehen noch." % [int(context.get("alive_enemy_count", 0)), int(context.get("enemy_count", 0))]
	)
	var controls := HBoxContainer.new()
	controls.add_theme_constant_override("separation", 8)
	_content.add_child(controls)
	var next := _add_button(controls, "Weiter →", func() -> void: _commands.advance_turn(context_id), "AdvanceEncounterTurn")
	next.add_theme_color_override("font_color", BRASS)
	var spacer := Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	controls.add_child(spacer)
	var end := _add_button(controls, "Kampf beenden", _show_end_dialog, "EndEncounter")
	end.add_theme_color_override("font_color", BRASS if context.get("all_enemies_defeated", false) else DANGER)

	var grid := GridContainer.new()
	grid.columns = 2
	grid.add_theme_constant_override("h_separation", 10)
	grid.add_theme_constant_override("v_separation", 10)
	_content.add_child(grid)
	var active_id := str(context.get("active_combatant_id", ""))
	for combatant_value in context.get("combatants", []):
		_render_combatant_card(grid, combatant_value, str(combatant_value["combatant_id"]) == active_id)


func _render_combatant_card(parent: GridContainer, combatant: Dictionary, active: bool) -> void:
	var panel := PanelContainer.new()
	panel.custom_minimum_size = Vector2(330, 144 if combatant["kind"] != "pc" else 104)
	panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	panel.add_theme_stylebox_override("panel", _panel_style(
		PANEL_ACTIVE if active else SLATE,
		BRASS if active else (DANGER if combatant["kind"] != "pc" and int(combatant["current_hp"]) == 0 else Color("#29464e")),
		2 if active else 1
	))
	parent.add_child(panel)
	var margin := MarginContainer.new()
	_set_margins(margin, 11)
	panel.add_child(margin)
	var card := VBoxContainer.new()
	card.add_theme_constant_override("separation", 6)
	margin.add_child(card)
	var title_row := HBoxContainer.new()
	card.add_child(title_row)
	var name := Label.new()
	name.text = str(combatant["name"])
	name.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	name.add_theme_color_override("font_color", DANGER if combatant["kind"] != "pc" and int(combatant["current_hp"]) == 0 else VELLUM)
	name.add_theme_font_size_override("font_size", 15)
	title_row.add_child(name)
	_add_data_label(title_row, "INIT %d" % int(combatant["initiative"]), BRASS if active else QUIET)
	if combatant["kind"] == "pc":
		_add_hint(card, "Party-Mitglied · HP bleiben bis zur Character-Sheet-Migration außerhalb dieses Owners.")
		return
	var hp := ProgressBar.new()
	hp.name = "HP_%s" % str(combatant["combatant_id"]).replace(".", "_")
	hp.max_value = maxi(1, int(combatant["max_hp"]))
	hp.value = int(combatant["current_hp"])
	hp.show_percentage = false
	hp.custom_minimum_size = Vector2(0, 10)
	card.add_child(hp)
	var facts := HBoxContainer.new()
	card.add_child(facts)
	_add_data_label(facts, "%d/%d TP" % [int(combatant["current_hp"]), int(combatant["max_hp"])], VELLUM)
	_add_data_label(facts, "RK %d" % int(combatant["armor_class"]))
	var fact_spacer := Control.new()
	fact_spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	facts.add_child(fact_spacer)
	for action in [
		{"label": "−5", "amount": 5, "healing": false},
		{"label": "−1", "amount": 1, "healing": false},
		{"label": "+1", "amount": 1, "healing": true},
		{"label": "+5", "amount": 5, "healing": true},
	]:
		var button := _add_button(facts, action["label"], _mutate_hp.bind(str(combatant["combatant_id"]), int(action["amount"]), bool(action["healing"])))
		button.custom_minimum_size = Vector2(44, 28)


func _render_results(context: Dictionary) -> void:
	var result: Dictionary = context.get("result", {})
	var defeated := 0
	for enemy in result.get("enemies", []):
		if enemy.get("defeated", false):
			defeated += 1
	_add_stage_heading(
		"Kampfergebnis",
		"%d Gegner besiegt · %d XP gesamt · %d XP pro SC" % [defeated, int(result.get("eligible_xp", 0)), int(result.get("per_player_xp", 0))]
	)
	for enemy_value in result.get("enemies", []):
		var enemy: Dictionary = enemy_value
		var row := HBoxContainer.new()
		row.custom_minimum_size = Vector2(0, 38)
		_content.add_child(row)
		var state := Label.new()
		state.text = "BESIEGT" if enemy["defeated"] else "LEBT"
		state.custom_minimum_size = Vector2(78, 0)
		state.add_theme_color_override("font_color", DANGER if enemy["defeated"] else SEA_GLASS)
		state.add_theme_font_size_override("font_size", 10)
		row.add_child(state)
		var name := Label.new()
		name.text = str(enemy["name"])
		name.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		name.add_theme_color_override("font_color", VELLUM)
		row.add_child(name)
		_add_data_label(row, "%d TP Verlust" % int(enemy["hp_loss"]))
		_add_data_label(row, "%d XP" % int(enemy["xp"]))
	var actions := HBoxContainer.new()
	actions.add_theme_constant_override("separation", 8)
	_content.add_child(actions)
	var award := _add_button(actions, "XP verteilen", func() -> void: _commands.award_xp(context_id), "AwardEncounterXp")
	award.disabled = bool(result.get("xp_awarded", false)) or int(result.get("per_player_xp", 0)) <= 0
	award.add_theme_color_override("font_color", BRASS)
	if not str(result.get("award_status", "")).is_empty():
		_add_hint(actions, str(result["award_status"]))
	var spacer := Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	actions.add_child(spacer)
	_add_button(actions, "Zum Planer", func() -> void: _commands.return_to_builder(context_id), "ReturnEncounterBuilder")


func _render_empty(message: String) -> void:
	_rendering = true
	_clear_children(_plan_list)
	_clear_children(_turn_strip)
	_clear_children(_content)
	_phase_label.text = "ENCOUNTER"
	_add_empty_card("Encounter nicht verfügbar", message)
	_set_status(message, DANGER)
	_rendering = false


func _open_plan(plan_id: String) -> void:
	_commands.open_saved_plan(plan_id, context_id)


func _roll_all() -> void:
	var rolls := {}
	for entry in _snapshot.get("context", {}).get("initiative", []):
		rolls[str(entry["combatant_id"])] = randi_range(1, 20)
	_commands.roll_all_initiative(rolls, context_id)


func _initiative_submitted(_text: String, combatant_id: String, spin: SpinBox) -> void:
	_commit_initiative(combatant_id, spin)


func _initiative_focus_exited(combatant_id: String, spin: SpinBox) -> void:
	_commit_initiative(combatant_id, spin)


func _commit_initiative(combatant_id: String, spin: SpinBox) -> void:
	if _rendering or _commands.busy():
		return
	var current := 0
	for entry in _snapshot.get("context", {}).get("initiative", []):
		if entry["combatant_id"] == combatant_id:
			current = int(entry["initiative"])
			break
	if roundi(spin.value) != current:
		_commands.set_initiative(combatant_id, roundi(spin.value), context_id)


func _mutate_hp(combatant_id: String, amount: int, healing: bool) -> void:
	_commands.mutate_hp(combatant_id, amount, healing, context_id)


func _show_end_dialog() -> void:
	_end_dialog.popup_centered(Vector2i(480, 170))


func _search_changed(text: String) -> void:
	if not _rendering:
		refresh(text)


func _command_started(_request: Dictionary) -> void:
	_set_status("Encounter-Änderung wird bestätigt …", QUIET)


func _command_completed(result: Dictionary) -> void:
	if not result.get("ok", false):
		_set_status(str(result.get("error", "Encounter-Änderung fehlgeschlagen.")), DANGER)
		return
	refresh()


func _add_stage_heading(title: String, subtitle: String) -> void:
	var heading := Label.new()
	heading.text = title
	heading.add_theme_color_override("font_color", BRASS)
	heading.add_theme_font_size_override("font_size", 24)
	_content.add_child(heading)
	_add_hint(_content, subtitle)
	_content.add_child(HSeparator.new())


func _add_empty_card(title: String, detail: String) -> void:
	var panel := PanelContainer.new()
	panel.custom_minimum_size = Vector2(0, 150)
	panel.add_theme_stylebox_override("panel", _panel_style(SLATE, Color("#29464e"), 1))
	_content.add_child(panel)
	var margin := MarginContainer.new()
	_set_margins(margin, 20)
	panel.add_child(margin)
	var text := VBoxContainer.new()
	margin.add_child(text)
	var heading := Label.new()
	heading.text = title
	heading.add_theme_color_override("font_color", BRASS)
	heading.add_theme_font_size_override("font_size", 19)
	text.add_child(heading)
	_add_hint(text, detail)


func _add_hint(parent: Container, text: String) -> Label:
	var label := Label.new()
	label.text = text
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.add_theme_color_override("font_color", QUIET)
	parent.add_child(label)
	return label


func _add_data_label(parent: Container, text: String, color: Color = QUIET) -> Label:
	var label := Label.new()
	label.text = text
	label.add_theme_color_override("font_color", color)
	label.add_theme_font_size_override("font_size", 11)
	label.custom_minimum_size = Vector2(58, 0)
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	parent.add_child(label)
	return label


func _add_button(parent: Container, text: String, callback: Callable, node_name: String = "") -> Button:
	var button := Button.new()
	button.text = text
	if not node_name.is_empty():
		button.name = node_name
	button.pressed.connect(callback)
	parent.add_child(button)
	return button


func _set_status(message: String, color: Color) -> void:
	if _status != null:
		_status.text = message
		_status.add_theme_color_override("font_color", color)


func _set_margins(container: MarginContainer, amount: int) -> void:
	for side in ["margin_left", "margin_right", "margin_top", "margin_bottom"]:
		container.add_theme_constant_override(side, amount)


func _panel_style(fill: Color, border: Color = Color("#29464e"), width: int = 0) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = fill
	style.border_color = border
	style.border_width_left = width
	style.border_width_right = width
	style.border_width_top = width
	style.border_width_bottom = width
	style.corner_radius_top_left = 3
	style.corner_radius_top_right = 3
	style.corner_radius_bottom_left = 3
	style.corner_radius_bottom_right = 3
	return style


func _clear_children(parent: Node) -> void:
	for child in parent.get_children():
		parent.remove_child(child)
		child.queue_free()
