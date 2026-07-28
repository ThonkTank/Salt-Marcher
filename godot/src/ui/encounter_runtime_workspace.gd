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
var command_controller: EncounterRuntimeCommandController
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
var _save_dialog: ConfirmationDialog
var _save_name: LineEdit
var _tuning_expanded := false
var _difficulty_option: OptionButton
var _amount_option: OptionButton
var _balance_option: OptionButton
var _diversity_option: OptionButton
var _seed_input: LineEdit
var _alternative_count: SpinBox


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_reader = EncounterRuntimeReadController.new(data_root)
	_reader.result_published.connect(_apply_snapshot)
	add_child(_reader)
	_commands = command_controller
	if _commands == null:
		_commands = EncounterRuntimeCommandController.new(data_root, runtime_coordinator)
		add_child(_commands)
	_commands.command_started.connect(_command_started)
	_commands.command_completed.connect(_command_completed)
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

	_save_dialog = ConfirmationDialog.new()
	_save_dialog.name = "SaveCurrentEncounterDialog"
	_save_dialog.title = "Aktuelle Aufstellung speichern"
	_save_dialog.ok_button_text = "Encounter speichern"
	_save_dialog.confirmed.connect(_save_current_confirmed)
	var save_form := VBoxContainer.new()
	save_form.add_theme_constant_override("separation", 6)
	_save_dialog.add_child(save_form)
	var save_hint := Label.new()
	save_hint.text = "Der Plan speichert nur Creature-Identitäten, Mengen und aktuelle Namen."
	save_hint.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	save_form.add_child(save_hint)
	_save_name = LineEdit.new()
	_save_name.name = "SaveCurrentEncounterName"
	_save_name.placeholder_text = "Name der Aufstellung"
	save_form.add_child(_save_name)
	add_child(_save_dialog)


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
	var editable := context_id == "encounter_context.manual"
	_add_stage_heading(
		"Aufstellung",
		"Monster aus dem Katalog ergänzen und ihre Anzahl hier abstimmen. Gespeicherte Pläne bleiben unverändert."
		if editable
		else "Diese Aufstellung folgt der fokussierten Scene. Zusammensetzung wird dort geändert."
	)
	if editable:
		_render_generator_docket(context)
	var removed: Dictionary = context.get("removed_roster_entry", {})
	if editable and not removed.is_empty():
		var undo_row := PanelContainer.new()
		undo_row.name = "EncounterRosterUndoNotice"
		undo_row.add_theme_stylebox_override("panel", _panel_style(SLATE, BRASS, 1))
		_content.add_child(undo_row)
		var undo_margin := MarginContainer.new()
		_set_margins(undo_margin, 10)
		undo_row.add_child(undo_margin)
		var undo_content := HBoxContainer.new()
		undo_content.add_theme_constant_override("separation", 8)
		undo_margin.add_child(undo_content)
		var removed_entry: Dictionary = removed.get("entry", {})
		var undo_label := Label.new()
		undo_label.text = "%s ×%d entfernt" % [removed_entry.get("name", "Monster"), int(removed_entry.get("quantity", 0))]
		undo_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		undo_label.add_theme_color_override("font_color", VELLUM)
		undo_content.add_child(undo_label)
		var undo := _add_button(undo_content, "Rückgängig", _undo_roster_removal, "EncounterRosterUndo")
		undo.disabled = _commands.busy()
	var roster: Array = context.get("roster", [])
	if roster.is_empty():
		_add_empty_card(
			"Noch keine Aufstellung",
			"Im Katalog ein Monster mit + Encounter hinzufügen oder links einen gespeicherten Plan öffnen."
			if editable
			else "Die fokussierte Scene enthält derzeit keine kampfrelevanten Teilnehmer."
		)
		return
	for entry_value in roster:
		var entry: Dictionary = entry_value
		var slip := PanelContainer.new()
		slip.name = "EncounterRosterRow_%s" % str(entry["slot_id"]).replace(".", "_")
		slip.add_theme_stylebox_override("panel", _panel_style(SLATE, Color("#29464e"), 1))
		_content.add_child(slip)
		var slip_margin := MarginContainer.new()
		_set_margins(slip_margin, 8)
		slip.add_child(slip_margin)
		var row := HBoxContainer.new()
		row.custom_minimum_size = Vector2(0, 38)
		row.add_theme_constant_override("separation", 7)
		slip_margin.add_child(row)
		var name := Label.new()
		name.text = str(entry["name"])
		name.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		name.add_theme_color_override("font_color", VELLUM)
		name.add_theme_font_size_override("font_size", 15)
		row.add_child(name)
		_add_data_label(row, "HG %s" % entry["challenge_rating"])
		_add_data_label(row, "%d TP" % int(entry["hit_points"]))
		_add_data_label(row, "RK %d" % int(entry["armor_class"]))
		_add_data_label(row, "%d XP" % (int(entry["xp"]) * int(entry["quantity"])))
		if editable:
			var decrease := _add_button(row, "−", _adjust_roster_quantity.bind(str(entry["slot_id"]), -1), "EncounterRosterDecrease")
			decrease.custom_minimum_size = Vector2(34, 30)
			decrease.tooltip_text = "Ein Monster weniger"
			decrease.disabled = int(entry["quantity"]) <= 1 or _commands.busy()
			var quantity := Label.new()
			quantity.name = "EncounterRosterQuantity"
			quantity.text = "×%d" % int(entry["quantity"])
			quantity.custom_minimum_size = Vector2(42, 30)
			quantity.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
			quantity.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
			quantity.add_theme_color_override("font_color", BRASS)
			row.add_child(quantity)
			var increase := _add_button(row, "+", _adjust_roster_quantity.bind(str(entry["slot_id"]), 1), "EncounterRosterIncrease")
			increase.custom_minimum_size = Vector2(34, 30)
			increase.tooltip_text = "Ein Monster mehr"
			increase.disabled = _commands.busy()
			var remove := _add_button(row, "Entfernen", _remove_roster_slot.bind(str(entry["slot_id"])), "EncounterRosterRemove")
			remove.tooltip_text = "%s vollständig aus der Aufstellung entfernen" % entry["name"]
			remove.add_theme_color_override("font_color", DANGER)
			remove.disabled = _commands.busy()
	if editable:
		_add_hint(_content, "Neue Monster kommen über + Encounter im Katalog. Jede Änderung löst die Aufstellung vom geöffneten Plan.")
	var party_count := int(_snapshot.get("party_summary", {}).get("active_count", 0))
	_add_hint(_content, "%d aktive Party-Mitglieder werden beim Kampfstart in die Initiative übernommen." % party_count)
	var action_row := HBoxContainer.new()
	_content.add_child(action_row)
	var save_current := _add_button(action_row, "Aufstellung speichern", _show_save_current, "SaveCurrentEncounter")
	save_current.disabled = _commands.busy()
	var action_spacer := Control.new()
	action_spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	action_row.add_child(action_spacer)
	var start := _add_button(action_row, "Initiative öffnen", func() -> void: _commands.open_initiative(context_id), "OpenEncounterInitiative")
	start.disabled = party_count == 0 or _commands.busy()


func _render_generator_docket(context: Dictionary) -> void:
	var inputs: Dictionary = context.get("builder_inputs", {})
	var tuning: Dictionary = inputs.get("tuning", {})
	var filters: Dictionary = inputs.get("pool_filters", {})
	var generation: Dictionary = context.get("generation", {})
	var alternatives: Array = generation.get("alternatives", [])
	var docket := PanelContainer.new()
	docket.name = "EncounterGeneratorDocket"
	docket.add_theme_stylebox_override("panel", _panel_style(
		PANEL_ACTIVE if not alternatives.is_empty() else SLATE,
		BRASS if not alternatives.is_empty() else Color("#29464e"),
		1
	))
	_content.add_child(docket)
	var docket_margin := MarginContainer.new()
	_set_margins(docket_margin, 11)
	docket.add_child(docket_margin)
	var docket_content := VBoxContainer.new()
	docket_content.add_theme_constant_override("separation", 8)
	docket_margin.add_child(docket_content)
	var title_row := HBoxContainer.new()
	title_row.add_theme_constant_override("separation", 8)
	docket_content.add_child(title_row)
	var eyebrow := Label.new()
	eyebrow.text = "ENCOUNTER ABSTIMMEN"
	eyebrow.add_theme_color_override("font_color", BRASS)
	eyebrow.add_theme_font_size_override("font_size", 11)
	title_row.add_child(eyebrow)
	var tuning_summary := Label.new()
	tuning_summary.text = "%s · %s · %s Arten" % [
		_difficulty_label(str(tuning.get("difficulty", "AUTO"))),
		_amount_label(str(tuning.get("amount", "AUTO"))),
		_diversity_label(str(tuning.get("diversity", "AUTO"))),
	]
	tuning_summary.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	tuning_summary.add_theme_color_override("font_color", QUIET)
	title_row.add_child(tuning_summary)
	var toggle := _add_button(title_row, "Schließen" if _tuning_expanded else "Öffnen", _toggle_tuning, "ToggleEncounterTuning")
	toggle.disabled = _commands.busy()
	var generate := _add_button(title_row, "Generieren", _generate, "GenerateEncounterAlternatives")
	generate.add_theme_color_override("font_color", BRASS)
	generate.disabled = int(_snapshot.get("party_summary", {}).get("active_count", 0)) == 0 or _commands.busy()
	_add_hint(docket_content, _pool_filter_summary(filters))
	if _tuning_expanded:
		var controls := GridContainer.new()
		controls.name = "EncounterTuningControls"
		controls.columns = 3
		controls.add_theme_constant_override("h_separation", 10)
		controls.add_theme_constant_override("v_separation", 7)
		docket_content.add_child(controls)
		_difficulty_option = _add_tuning_option(controls, "EncounterDifficulty", "Ziel", [
			["AUTO", "Auto"], ["EASY", "Leicht"], ["MEDIUM", "Mittel"], ["HARD", "Schwer"], ["DEADLY", "Tödlich"],
		], str(tuning.get("difficulty", "AUTO")))
		_amount_option = _add_tuning_option(controls, "EncounterAmount", "Menge", [
			["AUTO", "Auto"], ["FEW", "Wenige"], ["STANDARD", "Standard"], ["MANY", "Viele"],
		], str(tuning.get("amount", "AUTO")))
		_balance_option = _add_tuning_option(controls, "EncounterBalance", "XP-Verteilung", [
			["AUTO", "Auto"], ["FOCUSED", "Fokussiert"], ["EVEN", "Ausgeglichen"], ["VARIED", "Variiert"],
		], str(tuning.get("balance", "AUTO")))
		_diversity_option = _add_tuning_option(controls, "EncounterDiversity", "Statblocks", [
			["AUTO", "Auto"], ["LOW", "Wenig"], ["MEDIUM", "Mittel"], ["HIGH", "Viel"],
		], str(tuning.get("diversity", "AUTO")))
		var seed_block := VBoxContainer.new()
		controls.add_child(seed_block)
		var seed_label := Label.new()
		seed_label.text = "Seed"
		seed_label.add_theme_color_override("font_color", QUIET)
		seed_label.add_theme_font_size_override("font_size", 10)
		seed_block.add_child(seed_label)
		_seed_input = LineEdit.new()
		_seed_input.name = "EncounterGenerationSeed"
		_seed_input.placeholder_text = "stabiler Seed"
		_seed_input.text = str(tuning.get("seed", ""))
		seed_block.add_child(_seed_input)
		var count_block := VBoxContainer.new()
		controls.add_child(count_block)
		var count_label := Label.new()
		count_label.text = "Vorschläge"
		count_label.add_theme_color_override("font_color", QUIET)
		count_label.add_theme_font_size_override("font_size", 10)
		count_block.add_child(count_label)
		_alternative_count = SpinBox.new()
		_alternative_count.name = "EncounterAlternativeCount"
		_alternative_count.min_value = 1
		_alternative_count.max_value = 8
		_alternative_count.step = 1
		_alternative_count.value = int(tuning.get("alternative_count", 3))
		count_block.add_child(_alternative_count)
		var tuning_actions := HBoxContainer.new()
		docket_content.add_child(tuning_actions)
		var apply := _add_button(tuning_actions, "Abstimmung übernehmen", _apply_tuning, "ApplyEncounterTuning")
		apply.disabled = _commands.busy()
	if alternatives.is_empty():
		return
	var selected_index := int(generation.get("selected_index", 0))
	var selected: Dictionary = alternatives[selected_index]
	var summary: Dictionary = selected.get("summary", {})
	var alternative_row := HBoxContainer.new()
	alternative_row.name = "EncounterAlternativeNavigator"
	alternative_row.add_theme_constant_override("separation", 8)
	docket_content.add_child(alternative_row)
	var previous := _add_button(alternative_row, "←", _select_alternative.bind(selected_index - 1), "PreviousEncounterAlternative")
	previous.disabled = selected_index <= 0 or _commands.busy()
	var position := Label.new()
	position.text = "VORSCHLAG %d / %d" % [selected_index + 1, alternatives.size()]
	position.add_theme_color_override("font_color", BRASS)
	position.add_theme_font_size_override("font_size", 11)
	alternative_row.add_child(position)
	var measure := Label.new()
	measure.text = "%s · %d XP angepasst · %d Gegner" % [
		_difficulty_label(str(summary.get("difficulty", ""))),
		int(summary.get("adjusted_xp", 0)),
		int(summary.get("creature_count", 0)),
	]
	measure.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	measure.add_theme_color_override("font_color", VELLUM)
	alternative_row.add_child(measure)
	var next := _add_button(alternative_row, "→", _select_alternative.bind(selected_index + 1), "NextEncounterAlternative")
	next.disabled = selected_index >= alternatives.size() - 1 or _commands.busy()
	var clear := _add_button(alternative_row, "Verlauf löschen", _clear_generation, "ClearEncounterGeneration")
	clear.disabled = _commands.busy()
	var diagnostics: Dictionary = generation.get("diagnostics", {})
	_add_hint(docket_content, "%s · Pool %d · %d Bewertungen · %s" % [
		"Exakte Lösung" if diagnostics.get("solution_quality", "") == "EXACT" else "Beste Annäherung",
		int(diagnostics.get("candidate_pool_size", 0)),
		int(diagnostics.get("candidate_evaluation_count", 0)),
		_stop_label(str(diagnostics.get("stop_category", ""))),
	])
	if diagnostics.get("source_mode", "CATALOG") == "GROUPED":
		_add_hint(docket_content, "Quellenbeweis: %d Tabellen · %d Fraktionen%s" % [
			int(diagnostics.get("source_table_count", 0)),
			int(diagnostics.get("source_faction_count", 0)),
			" · 1 Ort" if diagnostics.get("source_location_selected", false) else "",
		])
	if diagnostics.get("loot_conflict", false):
		var loot_warning := Label.new()
		loot_warning.name = "EncounterLootConflict"
		loot_warning.text = "Loot-Konflikt · Die Quellen verweisen auf mehrere Beutetabellen; die Aufstellung bleibt verwendbar."
		loot_warning.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		loot_warning.add_theme_color_override("font_color", BRASS)
		docket_content.add_child(loot_warning)


func _add_tuning_option(parent: Container, node_name: String, label_text: String, values: Array, selected: String) -> OptionButton:
	var block := VBoxContainer.new()
	parent.add_child(block)
	var label := Label.new()
	label.text = label_text
	label.add_theme_color_override("font_color", QUIET)
	label.add_theme_font_size_override("font_size", 10)
	block.add_child(label)
	var option := OptionButton.new()
	option.name = node_name
	for value in values:
		option.add_item(str(value[1]))
		option.set_item_metadata(option.item_count - 1, value[0])
		if str(value[0]) == selected:
			option.select(option.item_count - 1)
	block.add_child(option)
	return option


func _pool_filter_summary(filters: Dictionary) -> String:
	var parts: Array[String] = []
	if not str(filters.get("search_text", "")).is_empty():
		parts.append("Suche „%s“" % filters["search_text"])
	for pair in [["sizes", "Größe"], ["types", "Typ"], ["subtypes", "Untertyp"], ["environments", "Umwelt"], ["alignments", "Gesinnung"]]:
		if not filters.get(pair[0], []).is_empty():
			parts.append("%s %d" % [pair[1], filters[pair[0]].size()])
	if filters.get("minimum_challenge_rating") != null or filters.get("maximum_challenge_rating") != null:
		parts.append("HG %s–%s" % [
			"0" if filters.get("minimum_challenge_rating") == null else str(filters["minimum_challenge_rating"]),
			"∞" if filters.get("maximum_challenge_rating") == null else str(filters["maximum_challenge_rating"]),
		])
	if not filters.get("encounter_table_ids", []).is_empty():
		parts.append("Tabellen %d" % filters["encounter_table_ids"].size())
	if not filters.get("faction_ids", []).is_empty():
		parts.append("Fraktionen %d" % filters["faction_ids"].size())
	if not str(filters.get("location_id", "")).is_empty():
		parts.append("Ort 1")
	return "Monsterpool: gesamter aktueller Katalog" if parts.is_empty() else "Monsterpool aus Katalog: %s" % " · ".join(parts)


func _toggle_tuning() -> void:
	_tuning_expanded = not _tuning_expanded
	_render()


func _current_tuning() -> Dictionary:
	var persisted: Dictionary = _snapshot.get("context", {}).get("builder_inputs", {}).get("tuning", {}).duplicate(true)
	if _difficulty_option == null or not is_instance_valid(_difficulty_option):
		return persisted
	persisted["difficulty"] = str(_difficulty_option.get_selected_metadata())
	persisted["amount"] = str(_amount_option.get_selected_metadata())
	persisted["balance"] = str(_balance_option.get_selected_metadata())
	persisted["diversity"] = str(_diversity_option.get_selected_metadata())
	persisted["seed"] = _seed_input.text.strip_edges()
	persisted["alternative_count"] = roundi(_alternative_count.value)
	return persisted


func _apply_tuning() -> void:
	_dispatch(_commands.update_tuning(_current_tuning(), context_id))


func _generate() -> void:
	_dispatch(_commands.generate_alternatives(_current_tuning(), context_id))


func _select_alternative(index: int) -> void:
	_dispatch(_commands.select_generated_alternative(index, context_id))


func _clear_generation() -> void:
	_dispatch(_commands.clear_generation_history(context_id))


func _show_save_current() -> void:
	var generation: Dictionary = _snapshot.get("context", {}).get("generation", {})
	var alternatives: Array = generation.get("alternatives", [])
	var suggested := "Aktuelle Aufstellung"
	if not alternatives.is_empty():
		suggested = str(alternatives[int(generation.get("selected_index", 0))].get("label", suggested))
	_save_name.text = suggested
	_save_dialog.popup_centered(Vector2i(480, 180))
	_save_name.grab_focus()


func _save_current_confirmed() -> void:
	_dispatch(_commands.save_current_plan(_save_name.text, context_id))


func _difficulty_label(value: String) -> String:
	return {"AUTO": "Auto", "EASY": "Leicht", "MEDIUM": "Mittel", "HARD": "Schwer", "DEADLY": "Tödlich"}.get(value, value)


func _amount_label(value: String) -> String:
	return {"AUTO": "Auto", "FEW": "Wenige", "STANDARD": "Standard", "MANY": "Viele"}.get(value, value)


func _diversity_label(value: String) -> String:
	return {"AUTO": "Auto", "LOW": "wenig", "MEDIUM": "mittel", "HIGH": "viel"}.get(value, value)


func _stop_label(value: String) -> String:
	return {"EXACT_OPTIONS_READY": "Zielband erfüllt", "BEST_FALLBACK": "beste Annäherung"}.get(value, value)


func _adjust_roster_quantity(slot_id: String, delta: int) -> void:
	_dispatch(_commands.adjust_roster_quantity(slot_id, delta, context_id))


func _remove_roster_slot(slot_id: String) -> void:
	_dispatch(_commands.remove_roster_slot(slot_id, context_id))


func _undo_roster_removal() -> void:
	_dispatch(_commands.undo_roster_removal(context_id))


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


func _dispatch(result: Dictionary) -> void:
	if not result.get("ok", false):
		_set_status(str(result.get("error", "Encounter-Änderung konnte nicht gestartet werden.")), DANGER)


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
