class_name SessionPlannerWorkspace
extends Control

## Compact master-detail GM run sheet for native Session planning.

const SessionPlannerWorkspaceController = preload("res://godot/src/features/sessionplanner/session_planner_workspace_controller.gd")
const SessionPlanCommandController = preload("res://godot/src/features/sessionplanner/session_plan_command_controller.gd")
const SessionPlanKnowledge = preload("res://godot/src/features/sessionplanner/session_plan_knowledge.gd")
const SessionPreparationCoordinator = preload("res://godot/src/features/sessionplanner/session_preparation_coordinator.gd")

const INK := Color("#0a1114")
const SLATE := Color("#152a32")
const PANEL := Color("#1b333b")
const VELLUM := Color("#d9e3dd")
const QUIET := Color("#91a5a2")
const BRASS := Color("#d2a743")
const DANGER := Color("#d97c6c")

var data_root := "user://salt-marcher"
var runtime_coordinator
var _reader
var _commands
var _preparation
var _snapshot: Dictionary = {}
var _rendering := false
var _draft_dirty := false

var _session_picker: OptionButton
var _days: SpinBox
var _status: Label
var _budget: Label
var _scene_rail: VBoxContainer
var _inspector: VBoxContainer
var _name_dialog: ConfirmationDialog
var _name_input: LineEdit
var _name_mode := "create"
var _delete_dialog: ConfirmationDialog
var _party_dialog: ConfirmationDialog
var _party_list: VBoxContainer
var _scene_title: LineEdit
var _scene_notes: TextEdit
var _location_picker: OptionButton
var _allocation: SpinBox
var _encounter_search: LineEdit
var _encounter_results: VBoxContainer
var _loot_input: LineEdit
var _generation_count: OptionButton
var _generation_seed: SpinBox
var _generate_button: Button
var _cancel_generation_button: Button
var _generation_dialog: ConfirmationDialog


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_reader = SessionPlannerWorkspaceController.new(data_root)
	_reader.result_published.connect(_apply_snapshot)
	add_child(_reader)
	_commands = SessionPlanCommandController.new(data_root, runtime_coordinator)
	_commands.command_started.connect(func(_request: Dictionary) -> void: _set_busy(true))
	_commands.command_completed.connect(_command_completed)
	add_child(_commands)
	_preparation = SessionPreparationCoordinator.new(data_root, runtime_coordinator)
	_preparation.progress_changed.connect(_generation_progress)
	_preparation.completed.connect(_generation_completed)
	add_child(_preparation)
	_build_surface()
	refresh()


func refresh(encounter_search_text: String = "") -> Dictionary:
	_set_status("Regiebuch wird geladen …", QUIET)
	return _reader.query(encounter_search_text)


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
	title.text = "SESSION PLANNER"
	title.add_theme_color_override("font_color", BRASS)
	title.add_theme_font_size_override("font_size", 20)
	heading.add_child(title)
	var subtitle := Label.new()
	subtitle.text = "Spielleiter-Regiebuch"
	subtitle.add_theme_color_override("font_color", QUIET)
	subtitle.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	heading.add_child(subtitle)

	var toolbar := HBoxContainer.new()
	toolbar.add_theme_constant_override("separation", 7)
	page.add_child(toolbar)
	_session_picker = OptionButton.new()
	_session_picker.name = "SessionPicker"
	_session_picker.custom_minimum_size = Vector2(230, 36)
	_session_picker.item_selected.connect(_session_selected)
	toolbar.add_child(_session_picker)
	_add_button(toolbar, "Neu", _open_name_dialog.bind("create"), "CreateSession")
	_add_button(toolbar, "Umbenennen", _open_name_dialog.bind("rename"))
	var delete := _add_button(toolbar, "Löschen", _confirm_delete)
	delete.add_theme_color_override("font_color", DANGER)
	var separator := VSeparator.new()
	toolbar.add_child(separator)
	var days_label := Label.new()
	days_label.text = "Abenteuertage"
	days_label.add_theme_color_override("font_color", QUIET)
	toolbar.add_child(days_label)
	_days = SpinBox.new()
	_days.name = "EncounterDays"
	_days.min_value = 0.0
	_days.max_value = 100.0
	_days.step = 0.0001
	_days.custom_arrow_step = 0.25
	_days.custom_minimum_size = Vector2(92, 0)
	_days.get_line_edit().text_submitted.connect(func(_text: String) -> void: _commit_days())
	_days.get_line_edit().focus_exited.connect(_commit_days)
	toolbar.add_child(_days)
	_add_button(toolbar, "Planungsgruppe", _open_party_dialog, "PlanningParty")
	_add_button(toolbar, "+ Szene", _add_scene, "AddScene")

	var generation_bar := HBoxContainer.new()
	generation_bar.add_theme_constant_override("separation", 8)
	page.add_child(generation_bar)
	var generation_label := Label.new()
	generation_label.text = "SESSION VORBEREITEN"
	generation_label.add_theme_color_override("font_color", BRASS)
	generation_bar.add_child(generation_label)
	var count_label := Label.new()
	count_label.text = "Encounter"
	count_label.add_theme_color_override("font_color", QUIET)
	generation_bar.add_child(count_label)
	_generation_count = OptionButton.new()
	_generation_count.name = "GenerationEncounterCount"
	_generation_count.add_item("Auto")
	_generation_count.set_item_metadata(0, null)
	for count in range(1, 11):
		_generation_count.add_item(str(count))
		_generation_count.set_item_metadata(count, count)
	generation_bar.add_child(_generation_count)
	var seed_label := Label.new()
	seed_label.text = "Seed"
	seed_label.add_theme_color_override("font_color", QUIET)
	generation_bar.add_child(seed_label)
	_generation_seed = SpinBox.new()
	_generation_seed.name = "GenerationSeed"
	_generation_seed.min_value = 0
	_generation_seed.max_value = 2_147_483_647
	_generation_seed.step = 1
	_generation_seed.value = 179974
	_generation_seed.custom_minimum_size = Vector2(150, 0)
	generation_bar.add_child(_generation_seed)
	_generate_button = _add_button(generation_bar, "Ablauf generieren", _request_generation, "GenerateSession")
	_cancel_generation_button = _add_button(generation_bar, "Abbrechen", _cancel_generation, "CancelGeneration")
	_cancel_generation_button.disabled = true

	var state_bar := HBoxContainer.new()
	page.add_child(state_bar)
	_budget = Label.new()
	_budget.name = "SessionBudget"
	_budget.add_theme_color_override("font_color", VELLUM)
	_budget.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	state_bar.add_child(_budget)
	_status = Label.new()
	_status.name = "SessionStatus"
	_status.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_status.add_theme_color_override("font_color", QUIET)
	state_bar.add_child(_status)

	var split := HSplitContainer.new()
	split.size_flags_vertical = Control.SIZE_EXPAND_FILL
	split.split_offset = 360
	page.add_child(split)
	var rail_panel := PanelContainer.new()
	rail_panel.custom_minimum_size = Vector2(330, 0)
	rail_panel.add_theme_stylebox_override("panel", _panel_style(SLATE))
	split.add_child(rail_panel)
	var rail_margin := MarginContainer.new()
	rail_margin.add_theme_constant_override("margin_left", 14)
	rail_margin.add_theme_constant_override("margin_right", 14)
	rail_margin.add_theme_constant_override("margin_top", 14)
	rail_margin.add_theme_constant_override("margin_bottom", 14)
	rail_panel.add_child(rail_margin)
	var rail_scroll := ScrollContainer.new()
	rail_margin.add_child(rail_scroll)
	_scene_rail = VBoxContainer.new()
	_scene_rail.name = "SceneRunSheet"
	_scene_rail.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_scene_rail.add_theme_constant_override("separation", 0)
	rail_scroll.add_child(_scene_rail)

	var inspector_panel := PanelContainer.new()
	inspector_panel.add_theme_stylebox_override("panel", _panel_style(PANEL))
	split.add_child(inspector_panel)
	var inspector_margin := MarginContainer.new()
	inspector_margin.add_theme_constant_override("margin_left", 20)
	inspector_margin.add_theme_constant_override("margin_right", 20)
	inspector_margin.add_theme_constant_override("margin_top", 16)
	inspector_margin.add_theme_constant_override("margin_bottom", 16)
	inspector_panel.add_child(inspector_margin)
	var inspector_scroll := ScrollContainer.new()
	inspector_margin.add_child(inspector_scroll)
	_inspector = VBoxContainer.new()
	_inspector.name = "DirectorSheet"
	_inspector.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_inspector.add_theme_constant_override("separation", 9)
	inspector_scroll.add_child(_inspector)

	_build_dialogs()


func _build_dialogs() -> void:
	_name_dialog = ConfirmationDialog.new()
	_name_dialog.name = "SessionNameDialog"
	_name_dialog.title = "Session"
	_name_dialog.confirmed.connect(_commit_name_dialog)
	_name_input = LineEdit.new()
	_name_input.name = "SessionNameInput"
	_name_input.custom_minimum_size = Vector2(380, 38)
	_name_dialog.add_child(_name_input)
	add_child(_name_dialog)
	_delete_dialog = ConfirmationDialog.new()
	_delete_dialog.name = "SessionDeleteDialog"
	_delete_dialog.title = "Session löschen?"
	_delete_dialog.dialog_text = "Die aktuelle Session und ihre Planung werden dauerhaft gelöscht."
	_delete_dialog.confirmed.connect(_delete_session)
	add_child(_delete_dialog)
	_party_dialog = ConfirmationDialog.new()
	_party_dialog.name = "PlanningPartyDialog"
	_party_dialog.title = "Planungsgruppe"
	_party_dialog.confirmed.connect(_commit_party)
	var scroll := ScrollContainer.new()
	scroll.custom_minimum_size = Vector2(440, 380)
	_party_dialog.add_child(scroll)
	_party_list = VBoxContainer.new()
	_party_list.name = "PlanningPartyList"
	_party_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(_party_list)
	add_child(_party_dialog)
	_generation_dialog = ConfirmationDialog.new()
	_generation_dialog.name = "GenerationConfirmationDialog"
	_generation_dialog.title = "Session vollständig vorbereiten?"
	_generation_dialog.dialog_text = "Der generierte Ablauf ersetzt Szenen, Rastmarken und Beutenotizen dieser Revision. Die Planungsgruppe und der Session-Name bleiben erhalten."
	_generation_dialog.confirmed.connect(_start_generation)
	add_child(_generation_dialog)


func _apply_snapshot(result: Dictionary) -> void:
	var preserved_draft := {}
	var preserved_search := ""
	if _draft_dirty and _scene_title != null and is_instance_valid(_scene_title):
		preserved_draft = {
			"session_id": str(_snapshot.get("current", {}).get("session_id", "")),
			"scene_id": str(_snapshot.get("selected_scene", {}).get("scene_id", "")),
			"title": _scene_title.text,
			"notes": _scene_notes.text,
			"location_id": str(_location_picker.get_item_metadata(_location_picker.selected)),
		}
	if _encounter_search != null and is_instance_valid(_encounter_search):
		preserved_search = _encounter_search.text
	_snapshot = result.duplicate(true)
	_rendering = true
	if not result.get("ok", false):
		_set_status(str(result.get("error", "Session Planner nicht verfügbar.")), DANGER)
		_rendering = false
		return
	_render_session_picker()
	_render_budget()
	_render_scene_rail()
	_render_inspector()
	if (
		not preserved_draft.is_empty()
		and preserved_draft["session_id"] == _snapshot.get("current", {}).get("session_id", "")
		and preserved_draft["scene_id"] == _snapshot.get("selected_scene", {}).get("scene_id", "")
	):
		_scene_title.text = preserved_draft["title"]
		_scene_notes.text = preserved_draft["notes"]
		for index in _location_picker.item_count:
			if _location_picker.get_item_metadata(index) == preserved_draft["location_id"]:
				_location_picker.select(index)
		_draft_dirty = true
	else:
		_draft_dirty = false
	if not preserved_search.is_empty() and _encounter_search != null:
		_encounter_search.text = preserved_search
	_set_status("Bereit · Revision %d" % int(result.get("current", {}).get("revision", 0)), QUIET)
	_set_busy(false)
	_rendering = false


func _render_session_picker() -> void:
	_session_picker.clear()
	var current_id := str(_snapshot.get("current", {}).get("session_id", ""))
	for session in _snapshot.get("sessions", []):
		_session_picker.add_item(str(session["name"]))
		var index := _session_picker.item_count - 1
		_session_picker.set_item_metadata(index, session["session_id"])
		if session["session_id"] == current_id:
			_session_picker.select(index)
	_days.value = float(_snapshot.get("current", {}).get("encounter_days_units", SessionPlanKnowledge.DAY_UNITS_PER_DAY)) / SessionPlanKnowledge.DAY_UNITS_PER_DAY


func _render_budget() -> void:
	var budget: Dictionary = _snapshot.get("budget", {})
	match budget.get("status", "empty"):
		"ready":
			var remaining := int(budget["remaining_xp"])
			_budget.text = "TAGESBUDGET  %d XP   ·   GEPLANT  %d XP   ·   %s  %d XP" % [
				budget["scaled_budget_xp"], budget["planned_xp"], "ÜBERZOGEN" if remaining < 0 else "FREI", absi(remaining),
			]
			_budget.add_theme_color_override("font_color", DANGER if budget["exceeded"] else VELLUM)
		"incomplete_levels":
			_budget.text = "Budget nicht berechenbar · Stufen der Planungsgruppe vervollständigen"
			_budget.add_theme_color_override("font_color", DANGER)
		_:
			_budget.text = "Noch keine Planungsgruppe"
			_budget.add_theme_color_override("font_color", QUIET)


func _render_scene_rail() -> void:
	_clear(_scene_rail)
	var scenes: Array = _snapshot.get("scenes", [])
	if scenes.is_empty():
		var empty := Label.new()
		empty.text = "Noch keine Szenen.\nBaue den Ablauf von oben nach unten."
		empty.add_theme_color_override("font_color", QUIET)
		_scene_rail.add_child(empty)
		return
	var rests := {}
	for rest in _snapshot["current"].get("rests", []):
		rests["%s|%s" % [rest["left_scene_id"], rest["right_scene_id"]]] = rest["kind"]
	for index in scenes.size():
		var scene: Dictionary = scenes[index]
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 9)
		_scene_rail.add_child(row)
		var marker := Label.new()
		marker.text = "%02d" % (index + 1)
		marker.custom_minimum_size = Vector2(34, 42)
		marker.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		marker.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		marker.add_theme_color_override("font_color", BRASS)
		row.add_child(marker)
		var button := Button.new()
		button.name = "Scene_%s" % scene["scene_id"]
		button.text = "%s\n%s · %.2f %%" % [scene["title"], scene["encounter_name"], float(scene["allocation_units"]) / 10_000.0]
		button.alignment = HORIZONTAL_ALIGNMENT_LEFT
		button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		button.custom_minimum_size = Vector2(0, 56)
		button.disabled = scene["scene_id"] == _snapshot["current"]["selected_scene_id"]
		button.pressed.connect(_select_scene.bind(scene["scene_id"]))
		row.add_child(button)
		if index < scenes.size() - 1:
			var gap := HBoxContainer.new()
			gap.add_theme_constant_override("separation", 9)
			_scene_rail.add_child(gap)
			var track := ColorRect.new()
			track.color = BRASS
			track.custom_minimum_size = Vector2(2, 28)
			var track_pad := MarginContainer.new()
			track_pad.custom_minimum_size = Vector2(34, 28)
			track_pad.add_theme_constant_override("margin_left", 16)
			track_pad.add_child(track)
			gap.add_child(track_pad)
			var rest_picker := OptionButton.new()
			rest_picker.name = "RestGap_%d" % index
			rest_picker.add_item("Keine Rast")
			rest_picker.set_item_metadata(0, "")
			rest_picker.add_item("Kurze Rast")
			rest_picker.set_item_metadata(1, "SHORT_REST")
			rest_picker.add_item("Lange Rast")
			rest_picker.set_item_metadata(2, "LONG_REST")
			var selected_kind := str(rests.get("%s|%s" % [scene["scene_id"], scenes[index + 1]["scene_id"]], ""))
			for item in rest_picker.item_count:
				if rest_picker.get_item_metadata(item) == selected_kind:
					rest_picker.select(item)
			rest_picker.item_selected.connect(_rest_selected.bind(scene["scene_id"], scenes[index + 1]["scene_id"], rest_picker))
			gap.add_child(rest_picker)


func _render_inspector() -> void:
	_clear(_inspector)
	var scene: Dictionary = _snapshot.get("selected_scene", {})
	if scene.is_empty():
		var empty := Label.new()
		empty.text = "Wähle oder erstelle eine Szene."
		empty.add_theme_color_override("font_color", QUIET)
		_inspector.add_child(empty)
		return
	var eyebrow := Label.new()
	eyebrow.text = "AUSGEWÄHLTE SZENE"
	eyebrow.add_theme_color_override("font_color", BRASS)
	_inspector.add_child(eyebrow)
	_scene_title = LineEdit.new()
	_scene_title.name = "SceneTitle"
	_scene_title.text = scene["title"]
	_scene_title.placeholder_text = "Szenentitel"
	_scene_title.text_changed.connect(_mark_draft_dirty)
	_inspector.add_child(_scene_title)
	_scene_notes = TextEdit.new()
	_scene_notes.name = "SceneNotes"
	_scene_notes.text = scene["notes"]
	_scene_notes.placeholder_text = "Regiehinweise, Übergänge, Ziele …"
	_scene_notes.custom_minimum_size = Vector2(0, 110)
	_scene_notes.text_changed.connect(_mark_draft_dirty)
	_inspector.add_child(_scene_notes)
	var location_row := HBoxContainer.new()
	_inspector.add_child(location_row)
	var location_label := Label.new()
	location_label.text = "Ort"
	location_label.custom_minimum_size = Vector2(88, 0)
	location_label.add_theme_color_override("font_color", QUIET)
	location_row.add_child(location_label)
	_location_picker = OptionButton.new()
	_location_picker.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_location_picker.item_selected.connect(func(_index: int) -> void: _mark_draft_dirty())
	_location_picker.add_item("Kein Ort")
	_location_picker.set_item_metadata(0, "")
	var location_found: bool = str(scene["location_id"]).is_empty()
	for location in _snapshot.get("locations", []):
		_location_picker.add_item(location["name"])
		var index := _location_picker.item_count - 1
		_location_picker.set_item_metadata(index, location["reference_id"])
		if location["reference_id"] == scene["location_id"]:
			_location_picker.select(index)
			location_found = true
	if not location_found:
		_location_picker.add_item("Fehlender Ort · %s" % scene["location_id"])
		var missing_index := _location_picker.item_count - 1
		_location_picker.set_item_metadata(missing_index, scene["location_id"])
		_location_picker.set_item_disabled(missing_index, true)
		_location_picker.select(missing_index)
	location_row.add_child(_location_picker)
	_add_button(_inspector, "Szenendetails speichern", _save_scene, "SaveScene")

	var scene_actions := HBoxContainer.new()
	_inspector.add_child(scene_actions)
	_add_button(scene_actions, "↑ Früher", _move_scene.bind(-1))
	_add_button(scene_actions, "↓ Später", _move_scene.bind(1))
	var remove := _add_button(scene_actions, "Szene entfernen", _remove_scene)
	remove.add_theme_color_override("font_color", DANGER)

	var budget_heading := _section_label("ENCOUNTER & BUDGET")
	_inspector.add_child(budget_heading)
	var allocation_row := HBoxContainer.new()
	_inspector.add_child(allocation_row)
	var allocation_label := Label.new()
	allocation_label.text = "Anteil"
	allocation_label.custom_minimum_size = Vector2(88, 0)
	allocation_row.add_child(allocation_label)
	_allocation = SpinBox.new()
	_allocation.name = "SceneAllocation"
	_allocation.min_value = 0
	_allocation.max_value = 100
	_allocation.step = 0.25
	_allocation.suffix = " %"
	_allocation.value = float(scene["allocation_units"]) / 10_000.0
	_allocation.get_line_edit().text_submitted.connect(func(_text: String) -> void: _commit_allocation())
	_allocation.get_line_edit().focus_exited.connect(_commit_allocation)
	allocation_row.add_child(_allocation)
	var target := Label.new()
	target.text = "Ziel %d XP" % int(scene["target_xp"])
	target.add_theme_color_override("font_color", QUIET)
	allocation_row.add_child(target)
	var linked := Label.new()
	linked.text = "Verknüpft: %s" % scene["encounter_name"]
	linked.add_theme_color_override("font_color", VELLUM)
	_inspector.add_child(linked)
	if not scene["encounter_plan_id"].is_empty():
		_add_button(_inspector, "Encounter lösen", _detach_encounter)
	_encounter_search = LineEdit.new()
	_encounter_search.name = "EncounterSearch"
	_encounter_search.placeholder_text = "Gespeicherten Encounter suchen (mind. 2 Zeichen)"
	_encounter_search.text_changed.connect(func(text: String) -> void: refresh(text))
	_inspector.add_child(_encounter_search)
	_encounter_results = VBoxContainer.new()
	_inspector.add_child(_encounter_results)
	for hit in _snapshot.get("encounter_search", {}).get("rows", []):
		var hit_button := Button.new()
		hit_button.text = "%s · %s" % [hit["name"], hit["summary_text"]]
		hit_button.alignment = HORIZONTAL_ALIGNMENT_LEFT
		hit_button.pressed.connect(_attach_encounter.bind(hit["reference_id"]))
		_encounter_results.add_child(hit_button)
	if _snapshot.get("encounter_search", {}).get("has_more", false):
		var more := Label.new()
		more.text = "Mehr Treffer vorhanden · Suche präzisieren"
		more.add_theme_color_override("font_color", QUIET)
		_encounter_results.add_child(more)

	if not scene.get("generated_rewards", []).is_empty():
		_inspector.add_child(_section_label("GENERIERTE BELOHNUNGEN"))
		for reward_row in scene["generated_rewards"]:
			_render_generated_reward(reward_row)
		_inspector.add_child(HSeparator.new())
	_inspector.add_child(_section_label("MANUELLE BEUTENOTIZEN"))
	for note in _snapshot["current"].get("manual_loot_notes", []):
		if note["scene_id"] != scene["scene_id"]:
			continue
		var note_row := HBoxContainer.new()
		var note_input := LineEdit.new()
		note_input.text = note["text"]
		note_input.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		note_row.add_child(note_input)
		_add_button(note_row, "Speichern", _update_loot.bind(note["note_id"], note_input))
		_add_button(note_row, "×", _remove_loot.bind(note["note_id"]))
		_inspector.add_child(note_row)
	var loot_row := HBoxContainer.new()
	_inspector.add_child(loot_row)
	_loot_input = LineEdit.new()
	_loot_input.name = "LootNote"
	_loot_input.placeholder_text = "Beute oder offene Belohnungsnotiz"
	_loot_input.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	loot_row.add_child(_loot_input)
	_add_button(loot_row, "Hinzufügen", _add_loot)


func _session_selected(index: int) -> void:
	if _rendering or _snapshot.get("current", {}).is_empty():
		return
	var session_id := str(_session_picker.get_item_metadata(index))
	var revision := 0
	for session in _snapshot["sessions"]:
		if session["session_id"] == session_id:
			revision = int(session["revision"])
	if session_id == _snapshot["current"]["session_id"]:
		return
	if _draft_dirty and not _snapshot.get("selected_scene", {}).is_empty():
		var source := _target()
		_commands.save_scene_and_select_session(
			source["session_id"], source["revision"], _snapshot["selected_scene"]["scene_id"],
			_scene_title.text, _scene_notes.text, str(_location_picker.get_item_metadata(_location_picker.selected)),
			session_id, revision
		)
	else:
		_commands.select_session(session_id, revision)


func _open_name_dialog(mode: String) -> void:
	_name_mode = mode
	_name_input.text = "" if mode == "create" else str(_snapshot.get("current", {}).get("name", ""))
	_name_dialog.title = "Session erstellen" if mode == "create" else "Session umbenennen"
	_name_dialog.popup_centered()
	_name_input.grab_focus()


func _commit_name_dialog() -> void:
	if _name_mode == "create":
		_commands.create_session(_name_input.text)
	else:
		var target := _target()
		_commands.rename_session(target["session_id"], target["revision"], _name_input.text)


func _confirm_delete() -> void:
	if not _snapshot.get("current", {}).is_empty():
		_delete_dialog.popup_centered()


func _delete_session() -> void:
	var target := _target()
	_commands.delete_session(target["session_id"], target["revision"])


func _open_party_dialog() -> void:
	_clear(_party_list)
	var selected: Array = _snapshot.get("current", {}).get("participant_ids", [])
	for character in _snapshot.get("party_candidates", []):
		var check := CheckBox.new()
		check.text = "%s%s" % [character["name"], " · Stufe %d" % character["level"] if character["level"] != null else " · Stufe fehlt"]
		check.button_pressed = character["character_id"] in selected
		check.set_meta("character_id", character["character_id"])
		_party_list.add_child(check)
	for participant_id in _snapshot.get("missing_participant_ids", []):
		var missing := CheckBox.new()
		missing.text = "Fehlender Charakter · %s" % participant_id
		missing.button_pressed = true
		missing.disabled = true
		missing.set_meta("character_id", participant_id)
		_party_list.add_child(missing)
	_party_dialog.popup_centered()


func _commit_party() -> void:
	var ids: Array = []
	for child in _party_list.get_children():
		if child is CheckBox and child.button_pressed:
			ids.append(child.get_meta("character_id"))
	var target := _target()
	_commands.set_participants(target["session_id"], target["revision"], ids)


func _commit_days() -> void:
	if _rendering or _snapshot.get("current", {}).is_empty() or _commands.busy():
		return
	var target := _target()
	var units := roundi(_days.value * SessionPlanKnowledge.DAY_UNITS_PER_DAY)
	if units != int(_snapshot["current"]["encounter_days_units"]):
		_commands.set_encounter_days(target["session_id"], target["revision"], units)


func _add_scene() -> void:
	var target := _target()
	_commands.add_scene(target["session_id"], target["revision"])


func _select_scene(scene_id: String) -> void:
	var target := _target()
	if scene_id == _snapshot.get("selected_scene", {}).get("scene_id", ""):
		return
	if _draft_dirty and not _snapshot.get("selected_scene", {}).is_empty():
		_commands.save_scene_and_select_scene(
			target["session_id"], target["revision"], _snapshot["selected_scene"]["scene_id"],
			_scene_title.text, _scene_notes.text, str(_location_picker.get_item_metadata(_location_picker.selected)), scene_id
		)
	else:
		_commands.select_scene(target["session_id"], target["revision"], scene_id)


func _save_scene() -> void:
	var target := _target()
	var scene: Dictionary = _snapshot["selected_scene"]
	var location_id := str(_location_picker.get_item_metadata(_location_picker.selected))
	_commands.update_scene(target["session_id"], target["revision"], scene["scene_id"], _scene_title.text, _scene_notes.text, location_id)


func _move_scene(delta: int) -> void:
	var target := _target()
	_commands.move_scene(target["session_id"], target["revision"], _snapshot["selected_scene"]["scene_id"], delta)


func _remove_scene() -> void:
	var target := _target()
	_commands.remove_scene(target["session_id"], target["revision"], _snapshot["selected_scene"]["scene_id"])


func _commit_allocation() -> void:
	if _rendering or _commands.busy() or _snapshot.get("selected_scene", {}).is_empty():
		return
	var units := roundi(_allocation.value * 10_000.0)
	if units == int(_snapshot["selected_scene"]["allocation_units"]):
		return
	var target := _target()
	_commands.set_allocation(target["session_id"], target["revision"], _snapshot["selected_scene"]["scene_id"], units)


func _rest_selected(index: int, left_id: String, right_id: String, picker: OptionButton) -> void:
	if _rendering:
		return
	var target := _target()
	_commands.set_rest(target["session_id"], target["revision"], left_id, right_id, str(picker.get_item_metadata(index)))


func _attach_encounter(plan_id: String) -> void:
	var target := _target()
	_commands.attach_encounter(target["session_id"], target["revision"], _snapshot["selected_scene"]["scene_id"], plan_id)


func _detach_encounter() -> void:
	var target := _target()
	_commands.detach_encounter(target["session_id"], target["revision"], _snapshot["selected_scene"]["scene_id"])


func _add_loot() -> void:
	var target := _target()
	_commands.add_loot_note(target["session_id"], target["revision"], _snapshot["selected_scene"]["scene_id"], _loot_input.text)


func _remove_loot(note_id: String) -> void:
	var target := _target()
	_commands.remove_loot_note(target["session_id"], target["revision"], _snapshot["selected_scene"]["scene_id"], note_id)


func _update_loot(note_id: String, input: LineEdit) -> void:
	var target := _target()
	_commands.update_loot_note(target["session_id"], target["revision"], _snapshot["selected_scene"]["scene_id"], note_id, input.text)


func _request_generation() -> void:
	if _snapshot.get("current", {}).is_empty() or _preparation.busy() or _commands.busy():
		return
	if _draft_dirty:
		_set_status("Ungespeicherte Szenendetails zuerst speichern.", DANGER)
		return
	var current: Dictionary = _snapshot["current"]
	if not current.get("scenes", []).is_empty() or not current.get("manual_loot_notes", []).is_empty() or not current.get("generated_rewards", []).is_empty():
		_generation_dialog.popup_centered()
	else:
		_start_generation()


func _start_generation() -> void:
	var target := _target()
	var count = _generation_count.get_item_metadata(_generation_count.selected)
	var started: Dictionary = _preparation.start(target["session_id"], target["revision"], count, roundi(_generation_seed.value))
	if not started.get("ok", false):
		_set_status(str(started.get("error", "Vorbereitung konnte nicht starten.")), DANGER)
		return
	_set_busy(true)


func _cancel_generation() -> void:
	_preparation.cancel()
	_set_busy(true)


func _generation_progress(_stage: String, message: String) -> void:
	_set_status(message, BRASS)
	_set_busy(true)


func _generation_completed(result: Dictionary) -> void:
	_set_busy(false)
	if result.get("ok", false):
		_set_status("Ablauf vorbereitet · %d Szenen · %d Belohnungen" % [result.get("scene_count", 0), result.get("reward_count", 0)], BRASS)
		refresh()
	elif result.get("status", "") == "CANCELLED":
		_set_status("Vorbereitung abgebrochen.", QUIET)
	else:
		_set_status(str(result.get("error", "Vorbereitung fehlgeschlagen.")), DANGER)
		if result.get("status", "") in ["stale", "revoked"]:
			refresh()


func _render_generated_reward(row: Dictionary) -> void:
	var reference: Dictionary = row.get("reference", {})
	var card := PanelContainer.new()
	card.add_theme_stylebox_override("panel", _panel_style(SLATE))
	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 10)
	margin.add_theme_constant_override("margin_right", 10)
	margin.add_theme_constant_override("margin_top", 8)
	margin.add_theme_constant_override("margin_bottom", 8)
	card.add_child(margin)
	var body := VBoxContainer.new()
	margin.add_child(body)
	var label := Label.new()
	label.text = str(reference.get("last_known_label", "Generierte Belohnung"))
	label.add_theme_color_override("font_color", BRASS if row.get("status", "") == "FOUND" else DANGER)
	body.add_child(label)
	if row.get("status", "") != "FOUND":
		var missing := Label.new()
		missing.text = "Detail fehlt · Run %s · Treasure %s" % [reference.get("generation_id", ""), reference.get("treasure_id", "")]
		missing.add_theme_color_override("font_color", DANGER)
		body.add_child(missing)
	else:
		var detail: Dictionary = row["detail"]
		var treasure: Dictionary = detail["treasure"]
		var meta := Label.new()
		meta.text = "%s · %s · Zielwert %d cp" % [treasure["channel"], treasure["theme"], treasure["target_cp"]]
		meta.add_theme_color_override("font_color", QUIET)
		body.add_child(meta)
		var packing_by_line := {}
		for packing in detail["packing"]:
			packing_by_line[int(packing["line_id"])] = packing
		for line in detail["loot"]:
			var packing: Dictionary = packing_by_line.get(int(line["line_id"]), {})
			var item := Label.new()
			var container := str(packing.get("container_id", "none"))
			item.text = "• %s%s" % [line["text"], "" if container == "none" else " · %s" % container]
			item.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
			item.add_theme_color_override("font_color", VELLUM)
			body.add_child(item)
	_inspector.add_child(card)


func _command_completed(result: Dictionary) -> void:
	_set_busy(false)
	if result.get("ok", false):
		if str(result.get("request", {}).get("operation", "")) in ["update_scene", "save_select_scene", "save_select_session"]:
			_draft_dirty = false
		_set_status("Gespeichert.", BRASS)
		refresh()
	else:
		_set_status(str(result.get("error", "Änderung fehlgeschlagen.")), DANGER)
		if result.get("status", "") in ["stale", "revoked"]:
			refresh()


func _target() -> Dictionary:
	var current: Dictionary = _snapshot.get("current", {})
	return {"session_id": str(current.get("session_id", "")), "revision": int(current.get("revision", 0))}


func _set_busy(value: bool) -> void:
	if _session_picker != null:
		_session_picker.disabled = value
	if _generate_button != null:
		_generate_button.disabled = value or _snapshot.get("current", {}).is_empty() or _snapshot.get("budget", {}).get("status", "") != "ready"
	if _cancel_generation_button != null:
		_cancel_generation_button.disabled = not (_preparation != null and _preparation.cancellable())
	if _generation_count != null:
		_generation_count.disabled = value
	if _generation_seed != null:
		_generation_seed.editable = not value


func _set_status(text: String, color: Color) -> void:
	if _status != null:
		_status.text = text
		_status.add_theme_color_override("font_color", color)


func _mark_draft_dirty(_value: Variant = null) -> void:
	if not _rendering:
		_draft_dirty = true


func _section_label(text: String) -> Label:
	var label := Label.new()
	label.text = text
	label.add_theme_color_override("font_color", BRASS)
	label.add_theme_font_size_override("font_size", 12)
	return label


func _add_button(parent: Node, text: String, callable: Callable, node_name: String = "") -> Button:
	var button := Button.new()
	button.text = text
	if not node_name.is_empty():
		button.name = node_name
	button.pressed.connect(callable)
	parent.add_child(button)
	return button


func _panel_style(color: Color) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = color
	style.corner_radius_top_left = 5
	style.corner_radius_top_right = 5
	style.corner_radius_bottom_left = 5
	style.corner_radius_bottom_right = 5
	return style


func _clear(parent: Node) -> void:
	for child in parent.get_children():
		parent.remove_child(child)
		child.queue_free()
