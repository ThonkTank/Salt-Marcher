class_name SceneWorkspace
extends Control

## Native split-party bridge deck. Scene composition stays visible beside the
## focused Encounter state and every mutation remains keyboard-operable.

const SceneReadController = preload("res://godot/src/features/scene/scene_read_controller.gd")
const SceneCommandController = preload("res://godot/src/features/scene/scene_command_controller.gd")

const INK := Color("#0a1114")
const SLATE := Color("#152a32")
const PANEL := Color("#1b333b")
const PANEL_ACTIVE := Color("#223e46")
const VELLUM := Color("#d9e3dd")
const QUIET := Color("#91a5a2")
const BRASS := Color("#d2a743")
const SEA_GLASS := Color("#75b7ae")
const DANGER := Color("#d97c6c")

signal encounter_requested(context_id: String)

var data_root := "user://salt-marcher"
var runtime_coordinator
var _reader: SceneReadController
var _commands: SceneCommandController
var _snapshot: Dictionary = {}
var _rendering := false

var _scene_rail: VBoxContainer
var _new_title: LineEdit
var _prepared_choice: OptionButton
var _search: LineEdit
var _heading: Label
var _provenance: Label
var _title: LineEdit
var _notes: TextEdit
var _delete: Button
var _location_choice: OptionButton
var _party_list: VBoxContainer
var _party_choice: OptionButton
var _npc_list: VBoxContainer
var _npc_choice: OptionButton
var _mob_list: VBoxContainer
var _creature_choice: OptionButton
var _mob_count: SpinBox
var _encounter_summary: VBoxContainer
var _status: Label
var _delete_dialog: ConfirmationDialog


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_reader = SceneReadController.new(data_root)
	_reader.result_published.connect(_apply_snapshot)
	add_child(_reader)
	_commands = SceneCommandController.new(data_root, runtime_coordinator)
	_commands.command_started.connect(_command_started)
	_commands.command_completed.connect(_command_completed)
	add_child(_commands)
	_build_surface()
	refresh()


func refresh(search_text: String = "") -> Dictionary:
	if _search != null and search_text.is_empty():
		search_text = _search.text
	_set_status("Laufende Szenen werden geladen …", QUIET)
	return _reader.query(search_text)


func synchronize() -> Dictionary:
	return _commands.refresh_foreign_facts()


func activate() -> Dictionary:
	if int(_snapshot.get("revision", 0)) == 0:
		return _commands.initialize()
	return _commands.refresh_foreign_facts()


func snapshot() -> Dictionary:
	return _snapshot.duplicate(true)


func _build_surface() -> void:
	var backdrop := ColorRect.new()
	backdrop.color = INK
	backdrop.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(backdrop)
	var margin := MarginContainer.new()
	margin.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_set_margins(margin, 18)
	add_child(margin)
	var page := VBoxContainer.new()
	page.add_theme_constant_override("separation", 10)
	margin.add_child(page)

	var mast := HBoxContainer.new()
	mast.add_theme_constant_override("separation", 10)
	page.add_child(mast)
	var brand := Label.new()
	brand.text = "SCENE"
	brand.add_theme_color_override("font_color", BRASS)
	brand.add_theme_font_size_override("font_size", 20)
	mast.add_child(brand)
	var subtitle := Label.new()
	subtitle.text = "Brückendeck für geteilte Gruppen"
	subtitle.add_theme_color_override("font_color", QUIET)
	subtitle.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	mast.add_child(subtitle)
	_search = LineEdit.new()
	_search.name = "SceneSearch"
	_search.placeholder_text = "Besetzung durchsuchen"
	_search.custom_minimum_size = Vector2(220, 0)
	_search.text_submitted.connect(func(text: String) -> void: refresh(text))
	mast.add_child(_search)

	var split := HSplitContainer.new()
	split.size_flags_vertical = Control.SIZE_EXPAND_FILL
	split.split_offset = 252
	page.add_child(split)
	var rail_panel := PanelContainer.new()
	rail_panel.custom_minimum_size = Vector2(232, 0)
	rail_panel.add_theme_stylebox_override("panel", _panel_style(SLATE))
	split.add_child(rail_panel)
	var rail_margin := MarginContainer.new()
	_set_margins(rail_margin, 13)
	rail_panel.add_child(rail_margin)
	var rail := VBoxContainer.new()
	rail.add_theme_constant_override("separation", 8)
	rail_margin.add_child(rail)
	var rail_title := Label.new()
	rail_title.text = "FOKUSKOMPASS"
	rail_title.add_theme_color_override("font_color", BRASS)
	rail_title.add_theme_font_size_override("font_size", 12)
	rail.add_child(rail_title)
	var rail_hint := Label.new()
	rail_hint.text = "◆ markiert den laufenden Tischfokus"
	rail_hint.add_theme_color_override("font_color", QUIET)
	rail_hint.add_theme_font_size_override("font_size", 11)
	rail.add_child(rail_hint)
	var rail_scroll := ScrollContainer.new()
	rail_scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	rail.add_child(rail_scroll)
	_scene_rail = VBoxContainer.new()
	_scene_rail.name = "SceneRail"
	_scene_rail.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_scene_rail.add_theme_constant_override("separation", 4)
	rail_scroll.add_child(_scene_rail)
	var create_rule := HSeparator.new()
	rail.add_child(create_rule)
	_new_title = LineEdit.new()
	_new_title.name = "NewSceneTitle"
	_new_title.placeholder_text = "Neue laufende Szene"
	_new_title.text_submitted.connect(func(_text: String) -> void: _create_scene())
	rail.add_child(_new_title)
	_add_button(rail, "Szene anlegen", _create_scene, "CreateScene")
	_prepared_choice = OptionButton.new()
	_prepared_choice.name = "PreparedSceneChoice"
	rail.add_child(_prepared_choice)
	_add_button(rail, "Vorbereitung kopieren", _import_prepared, "ImportPreparedScene")

	var main_panel := PanelContainer.new()
	main_panel.add_theme_stylebox_override("panel", _panel_style(PANEL))
	split.add_child(main_panel)
	var main_margin := MarginContainer.new()
	_set_margins(main_margin, 16)
	main_panel.add_child(main_margin)
	var main_scroll := ScrollContainer.new()
	main_scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	main_scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	main_margin.add_child(main_scroll)
	var content := VBoxContainer.new()
	content.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	content.add_theme_constant_override("separation", 12)
	main_scroll.add_child(content)
	var heading_row := HBoxContainer.new()
	content.add_child(heading_row)
	_heading = Label.new()
	_heading.add_theme_color_override("font_color", VELLUM)
	_heading.add_theme_font_size_override("font_size", 22)
	_heading.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	heading_row.add_child(_heading)
	_delete = _add_button(heading_row, "Szene löschen", _show_delete, "DeleteScene")
	_delete.add_theme_color_override("font_color", DANGER)
	_provenance = Label.new()
	_provenance.add_theme_color_override("font_color", QUIET)
	_provenance.add_theme_font_size_override("font_size", 11)
	content.add_child(_provenance)

	var details := GridContainer.new()
	details.columns = 2
	details.add_theme_constant_override("h_separation", 10)
	details.add_theme_constant_override("v_separation", 8)
	content.add_child(details)
	_add_field_label(details, "Titel")
	_title = LineEdit.new()
	_title.name = "SceneTitle"
	_title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	details.add_child(_title)
	_add_field_label(details, "Notizen")
	_notes = TextEdit.new()
	_notes.name = "SceneNotes"
	_notes.custom_minimum_size = Vector2(0, 82)
	_notes.wrap_mode = TextEdit.LINE_WRAPPING_BOUNDARY
	details.add_child(_notes)
	_add_field_label(details, "Ort")
	var location_row := HBoxContainer.new()
	details.add_child(location_row)
	_location_choice = OptionButton.new()
	_location_choice.name = "SceneLocationChoice"
	_location_choice.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	location_row.add_child(_location_choice)
	_add_button(location_row, "Ort setzen", _set_location, "SetSceneLocation")
	_add_field_label(details, "")
	_add_button(details, "Details speichern", _save_details, "SaveSceneDetails")

	var columns := GridContainer.new()
	columns.columns = 2
	columns.add_theme_constant_override("h_separation", 12)
	columns.add_theme_constant_override("v_separation", 12)
	content.add_child(columns)
	var people_panel := _section_panel("BESATZUNG")
	columns.add_child(people_panel)
	var people: VBoxContainer = people_panel.get_meta("content")
	_add_section_label(people, "SC IN DIESER SZENE")
	_party_list = VBoxContainer.new()
	_party_list.name = "ScenePartyList"
	people.add_child(_party_list)
	var party_add := HBoxContainer.new()
	people.add_child(party_add)
	_party_choice = OptionButton.new()
	_party_choice.name = "ScenePartyChoice"
	_party_choice.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	party_add.add_child(_party_choice)
	_add_button(party_add, "+ SC", _assign_pc, "AddScenePc")
	_add_section_label(people, "NPC IN DIESER SZENE")
	_npc_list = VBoxContainer.new()
	_npc_list.name = "SceneNpcList"
	people.add_child(_npc_list)
	var npc_add := HBoxContainer.new()
	people.add_child(npc_add)
	_npc_choice = OptionButton.new()
	_npc_choice.name = "SceneNpcChoice"
	_npc_choice.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	npc_add.add_child(_npc_choice)
	_add_button(npc_add, "+ NPC", _assign_npc, "AddSceneNpc")

	var live_panel := _section_panel("LAUFENDE WAHRHEIT")
	columns.add_child(live_panel)
	var live: VBoxContainer = live_panel.get_meta("content")
	_add_section_label(live, "MOBS")
	_mob_list = VBoxContainer.new()
	_mob_list.name = "SceneMobList"
	live.add_child(_mob_list)
	var mob_add := HBoxContainer.new()
	live.add_child(mob_add)
	_creature_choice = OptionButton.new()
	_creature_choice.name = "SceneCreatureChoice"
	_creature_choice.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	mob_add.add_child(_creature_choice)
	_mob_count = SpinBox.new()
	_mob_count.name = "SceneMobCount"
	_mob_count.min_value = 1
	_mob_count.max_value = 999
	_mob_count.value = 1
	_mob_count.custom_minimum_size = Vector2(72, 0)
	mob_add.add_child(_mob_count)
	_add_button(mob_add, "+ Mob", _assign_mob, "AddSceneMob")
	var encounter_rule := HSeparator.new()
	live.add_child(encounter_rule)
	_add_section_label(live, "ENCOUNTER-KONTEXT")
	_encounter_summary = VBoxContainer.new()
	_encounter_summary.name = "FocusedSceneEncounter"
	_encounter_summary.add_theme_constant_override("separation", 6)
	live.add_child(_encounter_summary)
	_add_button(live, "Fokussierten Encounter öffnen →", _open_encounter, "OpenFocusedEncounter")

	_status = Label.new()
	_status.name = "SceneStatus"
	_status.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_status.add_theme_color_override("font_color", QUIET)
	page.add_child(_status)
	_delete_dialog = ConfirmationDialog.new()
	_delete_dialog.name = "DeleteSceneDialog"
	_delete_dialog.title = "Laufende Szene löschen?"
	_delete_dialog.dialog_text = "Der zugehörige Encounter-Kontext wird im selben Campaign-Commit entfernt."
	_delete_dialog.ok_button_text = "Szene löschen"
	_delete_dialog.confirmed.connect(_delete_scene)
	add_child(_delete_dialog)


func _apply_snapshot(result: Dictionary) -> void:
	if not result.get("ok", false):
		_snapshot = {}
		_render_empty(str(result.get("error", "Scene konnte nicht geladen werden.")))
		return
	_snapshot = result.duplicate(true)
	_render()


func _render() -> void:
	_rendering = true
	_clear_children(_scene_rail)
	_clear_children(_party_list)
	_clear_children(_npc_list)
	_clear_children(_mob_list)
	_clear_children(_encounter_summary)
	for scene_value in _snapshot.get("scenes", []):
		var scene: Dictionary = scene_value
		var marker := "◆" if scene["focused"] else "◇"
		var button := Button.new()
		button.text = "%s  %s\n    %d Teilnehmer · %s" % [marker, scene["title"], int(scene["participant_count"]), str(scene["encounter"]["mode"]).to_upper()]
		button.alignment = HORIZONTAL_ALIGNMENT_LEFT
		button.custom_minimum_size = Vector2(0, 54)
		button.disabled = bool(scene["focused"]) or _commands.busy()
		button.pressed.connect(_focus_scene.bind(str(scene["scene_id"])))
		_scene_rail.add_child(button)
		if not bool(scene["focused"]):
			var connector := Label.new()
			connector.text = "      │"
			connector.add_theme_color_override("font_color", Color("#365760"))
			_scene_rail.add_child(connector)
	_fill_choice(_prepared_choice, _snapshot.get("prepared_scenes", []), "title", func(row: Dictionary) -> String:
		return "%s · %s" % [row["session_name"], row["title"]]
	)
	var focused: Dictionary = _snapshot.get("focused", {})
	if focused.is_empty():
		_render_empty("Keine laufende Szene verfügbar.")
		_rendering = false
		return
	_heading.text = str(focused["title"])
	_provenance.text = "Eigenständig am Spieltisch" if str(focused["source_session_id"]).is_empty() else "Kopie aus %s · %s" % [focused["source_session_id"], focused["source_scene_id"]]
	_title.text = str(focused["title"])
	_notes.text = str(focused["notes"])
	_delete.disabled = bool(focused["standard"]) or _commands.busy()
	_fill_location_choice(focused)
	_fill_choice(_party_choice, _snapshot.get("unassigned_party", []), "character_id", func(row: Dictionary) -> String: return str(row["name"]))
	_fill_choice(_npc_choice, _snapshot.get("unassigned_npcs", []), "reference_id", func(row: Dictionary) -> String: return str(row["name"]))
	_fill_choice(_creature_choice, _snapshot.get("creature_choices", []), "definition_id", func(row: Dictionary) -> String: return str(row["name"]))
	for member in focused.get("party_members", []):
		var pc_id := str(member["character_id"])
		_add_participant_row(
			_party_list,
			"%s%s" % [member["name"], "" if member["level"] == null else " · Stufe %d" % int(member["level"])],
			_unassign_pc.bind(pc_id),
			"pc",
			pc_id,
			focused.get("participant_states", {}).get("pc:%s" % pc_id, {})
		)
	if focused.get("party_members", []).is_empty():
		_add_hint(_party_list, "Keine SC zugeordnet. Neue aktive SC bleiben bewusst unverteilt.")
	for npc in focused.get("npcs", []):
		var npc_id := str(npc["npc_id"])
		_add_participant_row(
			_npc_list,
			str(npc["name"]),
			_unassign_npc.bind(npc_id),
			"npc",
			npc_id,
			focused.get("participant_states", {}).get("npc:%s" % npc_id, {})
		)
	if focused.get("npcs", []).is_empty():
		_add_hint(_npc_list, "Keine NPC in dieser Szene.")
	for mob in focused.get("mob_rows", []):
		var assignment_id := str(mob["assignment_id"])
		_add_participant_row(
			_mob_list,
			"%s ×%d" % [mob["name"], int(mob["count"])],
			_unassign_mob.bind(str(mob["creature_id"])),
			"mob",
			assignment_id,
			focused.get("participant_states", {}).get("mob:%s" % assignment_id, {})
		)
	if focused.get("mob_rows", []).is_empty():
		_add_hint(_mob_list, "Keine Scene-Mobs. Hostile NPCs werden unabhängig aufgelöst.")
	_render_encounter(focused.get("encounter", {}))
	_set_status("Scene-Revision %d · Encounter atomar synchron" % int(_snapshot.get("revision", 0)), SEA_GLASS)
	_rendering = false


func _render_encounter(context: Dictionary) -> void:
	var mode := str(context.get("mode", "builder"))
	var headline := Label.new()
	headline.text = "%s · Revision %d" % [mode.to_upper(), int(context.get("revision", 0))]
	headline.add_theme_color_override("font_color", BRASS)
	headline.add_theme_font_size_override("font_size", 15)
	_encounter_summary.add_child(headline)
	var facts := Label.new()
	facts.text = "%d Aufstellungszeilen · %d Kämpfer · Runde %d" % [context.get("roster", []).size(), context.get("combatants", []).size(), int(context.get("round", 1))]
	facts.add_theme_color_override("font_color", VELLUM)
	_encounter_summary.add_child(facts)
	_add_hint(_encounter_summary, str(context.get("status", "Encounter-Kontext bereit.")))


func _create_scene() -> void:
	if not _new_title.text.strip_edges().is_empty():
		_dispatch(_commands.create_scene(_new_title.text))


func _import_prepared() -> void:
	var row := _selected_metadata(_prepared_choice)
	if not row.is_empty():
		_dispatch(_commands.import_prepared(str(row["session_id"]), str(row["scene_id"])))


func _focus_scene(scene_id: String) -> void:
	_dispatch(_commands.focus_scene(scene_id))


func _save_details() -> void:
	_dispatch(_commands.update_details(str(_snapshot.get("focused_scene_id", "")), _title.text, _notes.text))


func _show_delete() -> void:
	_delete_dialog.popup_centered()


func _delete_scene() -> void:
	_dispatch(_commands.delete_scene(str(_snapshot.get("focused_scene_id", ""))))


func _assign_pc() -> void:
	var row := _selected_metadata(_party_choice)
	if not row.is_empty():
		_dispatch(_commands.assign_pc(str(_snapshot["focused_scene_id"]), str(row["character_id"])))


func _unassign_pc(character_id: String) -> void:
	_dispatch(_commands.unassign_pc(character_id))


func _assign_npc() -> void:
	var row := _selected_metadata(_npc_choice)
	if not row.is_empty():
		_dispatch(_commands.assign_npc(str(_snapshot["focused_scene_id"]), str(row["reference_id"])))


func _unassign_npc(npc_id: String) -> void:
	_dispatch(_commands.unassign_npc(npc_id))


func _set_location() -> void:
	var row := _selected_metadata(_location_choice)
	_dispatch(_commands.set_location(str(_snapshot["focused_scene_id"]), str(row.get("reference_id", ""))))


func _assign_mob() -> void:
	var row := _selected_metadata(_creature_choice)
	if not row.is_empty():
		_dispatch(_commands.assign_mob(str(_snapshot["focused_scene_id"]), str(row["definition_id"]), roundi(_mob_count.value)))


func _unassign_mob(creature_id: String) -> void:
	_dispatch(_commands.unassign_mob(str(_snapshot["focused_scene_id"]), creature_id))


func _open_encounter() -> void:
	var context_id := str(_snapshot.get("focused", {}).get("encounter_context_id", ""))
	if not context_id.is_empty():
		encounter_requested.emit(context_id)


func _command_started(_request: Dictionary) -> void:
	_set_status("Scene- und Encounter-Wahrheit werden gemeinsam geschrieben …", BRASS)


func _command_completed(result: Dictionary) -> void:
	if result.get("ok", false):
		_new_title.clear()
		refresh()
	else:
		_set_status(str(result.get("error", "Scene-Änderung fehlgeschlagen.")), DANGER)


func _dispatch(result: Dictionary) -> void:
	if not result.get("ok", false):
		_set_status(str(result.get("error", "Scene-Änderung konnte nicht gestartet werden.")), DANGER)


func _fill_location_choice(focused: Dictionary) -> void:
	_location_choice.clear()
	_location_choice.add_item("Kein Ort")
	_location_choice.set_item_metadata(0, {"reference_id": "", "name": "Kein Ort"})
	var selected := 0
	for row_value in _snapshot.get("location_choices", []):
		var row: Dictionary = row_value
		_location_choice.add_item(str(row["name"]))
		var index := _location_choice.item_count - 1
		_location_choice.set_item_metadata(index, row.duplicate(true))
		if row["reference_id"] == focused["location_id"]:
			selected = index
	_location_choice.select(selected)


func _fill_choice(choice: OptionButton, rows: Array, id_field: String, labeler: Callable) -> void:
	choice.clear()
	choice.add_item("Keine Auswahl")
	choice.set_item_metadata(0, {})
	for row_value in rows:
		var row: Dictionary = row_value
		if str(row.get(id_field, "")).is_empty():
			continue
		choice.add_item(str(labeler.call(row)))
		choice.set_item_metadata(choice.item_count - 1, row.duplicate(true))
	choice.select(0)


func _selected_metadata(choice: OptionButton) -> Dictionary:
	if choice == null or choice.selected < 0:
		return {}
	var value = choice.get_item_metadata(choice.selected)
	return value.duplicate(true) if value is Dictionary else {}


func _add_participant_row(
	parent: VBoxContainer,
	label_text: String,
	remove_callback: Callable,
	kind: String,
	ref_id: String,
	state: Dictionary
) -> void:
	var card := VBoxContainer.new()
	card.add_theme_constant_override("separation", 3)
	parent.add_child(card)
	var row := HBoxContainer.new()
	card.add_child(row)
	var label := Label.new()
	label.text = label_text
	label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	label.add_theme_color_override("font_color", VELLUM)
	row.add_child(label)
	_add_button(row, "Lösen", remove_callback)
	var state_row := HBoxContainer.new()
	card.add_child(state_row)
	var defeated := CheckBox.new()
	defeated.text = "Ausgeschaltet"
	defeated.button_pressed = bool(state.get("defeated", false))
	state_row.add_child(defeated)
	var notes := LineEdit.new()
	notes.placeholder_text = "Kurznotiz"
	notes.text = str(state.get("notes", ""))
	notes.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	state_row.add_child(notes)
	_add_button(
		state_row,
		"Status speichern",
		_save_participant_state.bind(kind, ref_id, defeated, notes)
	)


func _save_participant_state(kind: String, ref_id: String, defeated: CheckBox, notes: LineEdit) -> void:
	_dispatch(_commands.set_participant_state(
		str(_snapshot.get("focused_scene_id", "")),
		kind,
		ref_id,
		defeated.button_pressed,
		notes.text
	))


func _section_panel(title: String) -> PanelContainer:
	var panel := PanelContainer.new()
	panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	panel.add_theme_stylebox_override("panel", _panel_style(SLATE, Color("#29464e"), 1))
	var margin := MarginContainer.new()
	_set_margins(margin, 12)
	panel.add_child(margin)
	var content := VBoxContainer.new()
	content.add_theme_constant_override("separation", 7)
	margin.add_child(content)
	var heading := Label.new()
	heading.text = title
	heading.add_theme_color_override("font_color", BRASS)
	heading.add_theme_font_size_override("font_size", 12)
	content.add_child(heading)
	panel.set_meta("content", content)
	return panel


func _add_section_label(parent: Container, text: String) -> void:
	var label := Label.new()
	label.text = text
	label.add_theme_color_override("font_color", SEA_GLASS)
	label.add_theme_font_size_override("font_size", 11)
	parent.add_child(label)


func _add_field_label(parent: Container, text: String) -> void:
	var label := Label.new()
	label.text = text
	label.add_theme_color_override("font_color", QUIET)
	parent.add_child(label)


func _add_hint(parent: Container, text: String) -> Label:
	var label := Label.new()
	label.text = text
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.add_theme_color_override("font_color", QUIET)
	label.add_theme_font_size_override("font_size", 11)
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


func _render_empty(message: String) -> void:
	_heading.text = "SCENE NICHT VERFÜGBAR"
	_provenance.text = ""
	_title.text = ""
	_notes.text = ""
	_clear_children(_scene_rail)
	_clear_children(_party_list)
	_clear_children(_npc_list)
	_clear_children(_mob_list)
	_clear_children(_encounter_summary)
	_add_hint(_encounter_summary, message)
	_set_status(message, DANGER)


func _set_status(message: String, color: Color) -> void:
	if _status != null:
		_status.text = message
		_status.add_theme_color_override("font_color", color)


func _set_margins(container: MarginContainer, amount: int) -> void:
	for side in ["left", "right", "top", "bottom"]:
		container.add_theme_constant_override("margin_%s" % side, amount)


func _panel_style(fill: Color, border: Color = Color("#29464e"), width: int = 0) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = fill
	style.border_color = border
	style.border_width_left = width
	style.border_width_right = width
	style.border_width_top = width
	style.border_width_bottom = width
	style.corner_radius_top_left = 4
	style.corner_radius_top_right = 4
	style.corner_radius_bottom_left = 4
	style.corner_radius_bottom_right = 4
	return style


func _clear_children(parent: Node) -> void:
	for child in parent.get_children():
		parent.remove_child(child)
		child.queue_free()
