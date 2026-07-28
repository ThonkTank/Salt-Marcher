class_name CatalogWorkspace
extends Control

const CatalogBrowseController = preload("res://godot/src/features/catalog/catalog_browse_controller.gd")
const FileCampaignRegistry = preload("res://godot/src/platform/persistence/file_campaign_registry.gd")
const WorldPlannerCommandController = preload("res://godot/src/features/worldplanner/world_planner_command_controller.gd")
const WorldPlannerDetailReadController = preload("res://godot/src/features/worldplanner/world_planner_detail_read_controller.gd")
const WorldPlannerNarrativeThreads = preload("res://godot/src/ui/world_planner_narrative_threads.gd")
const WorldPlannerReferencePicker = preload("res://godot/src/ui/world_planner_reference_picker.gd")
const FactionInventoryEditor = preload("res://godot/src/ui/faction_inventory_editor.gd")
const EncounterTableCommandController = preload("res://godot/src/features/encountertable/encounter_table_command_controller.gd")
const EncounterTableDetailReadController = preload("res://godot/src/features/encountertable/encounter_table_detail_read_controller.gd")
const EncounterTableEditorDialog = preload("res://godot/src/ui/encounter_table_editor_dialog.gd")
const EncounterPlanCommandController = preload("res://godot/src/features/encounter/encounter_plan_command_controller.gd")
const EncounterPlanDetailReadController = preload("res://godot/src/features/encounter/encounter_plan_detail_read_controller.gd")
const EncounterPlanEditorDialog = preload("res://godot/src/ui/encounter_plan_editor_dialog.gd")
const ItemDetailReadController = preload("res://godot/src/features/items/item_detail_read_controller.gd")
const CreatureDetailReadController = preload("res://godot/src/features/creatures/creature_detail_read_controller.gd")

const SECTIONS := [
	{"id": "creatures", "label": "Monster", "kind": "creature", "provider": true, "mutable": false},
	{"id": "items", "label": "Items", "kind": "item", "provider": true, "mutable": false},
	{"id": "encounters", "label": "Encounter", "kind": "encounter_plan", "provider": true, "mutable": true, "trashable": true},
	{"id": "npcs", "label": "NPCs", "kind": "npc", "provider": true, "mutable": true, "trashable": true},
	{"id": "factions", "label": "Fraktionen", "kind": "faction", "provider": true, "mutable": true, "trashable": true},
	{"id": "places", "label": "Orte", "kind": "place", "provider": true, "mutable": true, "trashable": true},
	{"id": "encounter_tables", "label": "Encounter-Tabellen", "kind": "encounter_table", "provider": true, "mutable": true, "trashable": true},
]
const PAGE_SIZE := 50

const NIGHT_INK := Color("#0a1114")
const DEEP_SLATE := Color("#152a32")
const VELLUM_MIST := Color("#d9e3dd")
const QUIET_INK := Color("#91a5a2")
const BRASS_MARK := Color("#d2a743")

var data_root := "user://salt-marcher"
var registry
var runtime_coordinator
var browse_controller: CatalogBrowseController
var command_controller: WorldPlannerCommandController
var detail_controller: WorldPlannerDetailReadController
var encounter_table_command_controller: EncounterTableCommandController
var encounter_table_detail_controller: EncounterTableDetailReadController
var encounter_plan_command_controller: EncounterPlanCommandController
var encounter_plan_detail_controller: EncounterPlanDetailReadController
var item_detail_controller: ItemDetailReadController
var creature_detail_controller: CreatureDetailReadController
var _active_section_id := "creatures"
var _section_state: Dictionary = {}
var _section_buttons: Dictionary = {}
var _search: LineEdit
var _trash_toggle: CheckButton
var _create_button: Button
var _item_filters: VBoxContainer
var _item_category: OptionButton
var _item_subcategory: OptionButton
var _item_rarity: OptionButton
var _item_magic: OptionButton
var _item_attunement: OptionButton
var _item_minimum_cost: LineEdit
var _item_maximum_cost: LineEdit
var _creature_filters: VBoxContainer
var _creature_size: MenuButton
var _creature_type: MenuButton
var _creature_subtype: MenuButton
var _creature_environment: MenuButton
var _creature_alignment: MenuButton
var _creature_minimum_cr: LineEdit
var _creature_maximum_cr: LineEdit
var _table_header: HBoxContainer
var _name_header: Button
var _identity_header: Button
var _category_header: Button
var _rarity_header: Button
var _cost_header: Button
var _result_list: VBoxContainer
var _footer: Label
var _previous_page: Button
var _page_label: Label
var _next_page: Button
var _detail: RichTextLabel
var _detail_actions: HFlowContainer
var _edit_button: Button
var _trash_button: Button
var _restore_button: Button
var _lifecycle_button: Button
var _narrative_threads: WorldPlannerNarrativeThreads
var _debounce: Timer
var _record_dialog: ConfirmationDialog
var _record_name: LineEdit
var _record_notes: TextEdit
var _npc_editor_fields: VBoxContainer
var _record_appearance: TextEdit
var _record_behavior: TextEdit
var _record_history: TextEdit
var _record_lifecycle: OptionButton
var _record_npc_disposition: SpinBox
var _faction_editor_fields: VBoxContainer
var _record_faction_disposition: SpinBox
var _faction_inventory_editor: FactionInventoryEditor
var _place_editor_fields: VBoxContainer
var _reference_picker: WorldPlannerReferencePicker
var _reference_values: Dictionary = {}
var _reference_summaries: Dictionary = {}
var _encounter_table_editor: EncounterTableEditorDialog
var _encounter_plan_editor: EncounterPlanEditorDialog
var _dialog_mode := ""
var _dialog_record_id := ""
var _dialog_kind := ""
var _delete_dialog: ConfirmationDialog
var _lifecycle_dialog: ConfirmationDialog
var _command_section_id := ""
var _selected_detail: Dictionary = {}


func _ready() -> void:
	if registry == null:
		registry = FileCampaignRegistry.new(data_root)
	if browse_controller == null:
		browse_controller = CatalogBrowseController.new(data_root, registry)
		add_child(browse_controller)
	if command_controller == null:
		command_controller = WorldPlannerCommandController.new(data_root, runtime_coordinator)
		add_child(command_controller)
	if detail_controller == null:
		detail_controller = WorldPlannerDetailReadController.new(data_root)
		add_child(detail_controller)
	if encounter_table_command_controller == null:
		encounter_table_command_controller = EncounterTableCommandController.new(data_root, runtime_coordinator)
		add_child(encounter_table_command_controller)
	if encounter_table_detail_controller == null:
		encounter_table_detail_controller = EncounterTableDetailReadController.new(data_root)
		add_child(encounter_table_detail_controller)
	if encounter_plan_command_controller == null:
		encounter_plan_command_controller = EncounterPlanCommandController.new(data_root, runtime_coordinator)
		add_child(encounter_plan_command_controller)
	if encounter_plan_detail_controller == null:
		encounter_plan_detail_controller = EncounterPlanDetailReadController.new(data_root)
		add_child(encounter_plan_detail_controller)
	if item_detail_controller == null:
		item_detail_controller = ItemDetailReadController.new(data_root)
		add_child(item_detail_controller)
	if creature_detail_controller == null:
		creature_detail_controller = CreatureDetailReadController.new(data_root)
		add_child(creature_detail_controller)
	browse_controller.query_started.connect(_on_query_started)
	browse_controller.result_published.connect(_on_result_published)
	command_controller.command_started.connect(_on_command_started)
	command_controller.command_completed.connect(_on_command_completed)
	detail_controller.query_started.connect(_on_detail_query_started)
	detail_controller.result_published.connect(_on_detail_result_published)
	encounter_table_command_controller.command_started.connect(_on_command_started)
	encounter_table_command_controller.command_completed.connect(_on_command_completed)
	encounter_table_detail_controller.query_started.connect(_on_encounter_table_detail_query_started)
	encounter_table_detail_controller.result_published.connect(_on_encounter_table_detail_result_published)
	encounter_plan_command_controller.command_started.connect(_on_command_started)
	encounter_plan_command_controller.command_completed.connect(_on_command_completed)
	encounter_plan_detail_controller.query_started.connect(_on_encounter_plan_detail_query_started)
	encounter_plan_detail_controller.result_published.connect(_on_encounter_plan_detail_result_published)
	item_detail_controller.query_started.connect(_on_item_detail_query_started)
	item_detail_controller.result_published.connect(_on_item_detail_result_published)
	creature_detail_controller.query_started.connect(_on_creature_detail_query_started)
	creature_detail_controller.result_published.connect(_on_creature_detail_result_published)
	for section in SECTIONS:
		_section_state[section["id"]] = {
			"draft": "",
			"accepted": "",
			"rows": [],
			"total": 0,
			"status": "uninitialized",
			"selected_id": "",
			"selected_row": {},
			"trash": false,
			"page": 0,
			"sort_key": "name",
			"sort_ascending": true,
			"notice": "",
			"filters": {
				"category": "",
				"subcategory": "",
				"rarity": "",
				"magic": null,
				"attunement": null,
				"minimum_cost_cp": "",
				"maximum_cost_cp": "",
				"sizes": [],
				"types": [],
				"subtypes": [],
				"environments": [],
				"alignments": [],
				"minimum_challenge_rating": "",
				"maximum_challenge_rating": "",
			},
			"filter_options": {
				"categories": [], "subcategories": [], "rarities": [],
				"sizes": [], "types": [], "subtypes": [], "environments": [], "alignments": [],
			},
		}
	_build_surface()
	select_section(_active_section_id)


func select_section(section_id: String) -> Dictionary:
	var section := _section(section_id)
	if section.is_empty():
		return {"ok": false, "status": "unknown_section"}
	if section_id != _active_section_id and browse_controller != null:
		browse_controller.cancel_all()
	_active_section_id = section_id
	for id_value in _section_buttons:
		var button: Button = _section_buttons[id_value]
		button.disabled = str(id_value) == section_id
	var state: Dictionary = _section_state[section_id]
	_search.text = str(state["draft"])
	_search.placeholder_text = "%s durchsuchen" % section["label"]
	_create_button.text = (
		"Encounter-Tabelle erstellen"
		if section_id == "encounter_tables"
		else "Encounter speichern"
		if section_id == "encounters"
		else "%s erstellen" % section["label"]
	)
	_create_button.visible = bool(section.get("mutable", false))
	_trash_toggle.visible = bool(section.get("trashable", false))
	_trash_toggle.set_pressed_no_signal(bool(state["trash"]))
	_create_button.disabled = bool(state["trash"]) or _any_command_busy()
	_item_filters.visible = section_id == "items"
	if section_id == "items":
		_sync_item_filter_controls(state)
	_creature_filters.visible = section_id == "creatures"
	if section_id == "creatures":
		_sync_creature_filter_controls(state)
	_render_selected_detail()
	_render_table_header()
	if not section["provider"]:
		state["status"] = "unavailable"
		_section_state[section_id] = state
		browse_controller.cancel_all()
		_render_state()
		return {"ok": true, "status": "unavailable"}
	if state["status"] in ["uninitialized", "unavailable", "loading", "refreshing"]:
		_submit_current_query()
	else:
		_render_state()
	return {"ok": true, "status": "selected"}


func active_section_id() -> String:
	return _active_section_id


func section_snapshot(section_id: String) -> Dictionary:
	return _section_state.get(section_id, {}).duplicate(true)


func search_input() -> LineEdit:
	return _search


func detail_snapshot() -> Dictionary:
	return _selected_detail.duplicate(true)


func _build_surface() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var background := ColorRect.new()
	background.color = NIGHT_INK
	background.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(background)
	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 34)
	margin.add_theme_constant_override("margin_right", 34)
	margin.add_theme_constant_override("margin_top", 30)
	margin.add_theme_constant_override("margin_bottom", 30)
	margin.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(margin)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 14)
	margin.add_child(column)
	var title := Label.new()
	title.text = "Katalog"
	title.add_theme_font_size_override("font_size", 34)
	title.add_theme_color_override("font_color", VELLUM_MIST)
	column.add_child(title)
	var subtitle := Label.new()
	subtitle.text = "Referenzen lesen und ausdrücklich an aktive Arbeitsbereiche übergeben."
	subtitle.add_theme_color_override("font_color", QUIET_INK)
	column.add_child(subtitle)
	var selector := HFlowContainer.new()
	selector.name = "CatalogSectionSelector"
	selector.add_theme_constant_override("h_separation", 8)
	selector.add_theme_constant_override("v_separation", 8)
	column.add_child(selector)
	for section in SECTIONS:
		var button := Button.new()
		button.text = section["label"]
		button.custom_minimum_size = Vector2(104, 28)
		button.pressed.connect(select_section.bind(str(section["id"])))
		selector.add_child(button)
		_section_buttons[section["id"]] = button
	var tools := HBoxContainer.new()
	tools.add_theme_constant_override("separation", 10)
	column.add_child(tools)
	_search = LineEdit.new()
	_search.name = "CatalogSearch"
	_search.custom_minimum_size = Vector2(260, 28)
	_search.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_search.text_changed.connect(_on_search_changed)
	_search.text_submitted.connect(func(_value: String) -> void: _submit_current_query())
	tools.add_child(_search)
	_trash_toggle = CheckButton.new()
	_trash_toggle.name = "CatalogTrashToggle"
	_trash_toggle.text = "Papierkorb"
	_trash_toggle.custom_minimum_size = Vector2(0, 28)
	_trash_toggle.tooltip_text = "Gelöschte Einträge prüfen und wiederherstellen"
	_trash_toggle.toggled.connect(_on_trash_toggled)
	tools.add_child(_trash_toggle)
	_create_button = Button.new()
	_create_button.name = "CatalogCreate"
	_create_button.custom_minimum_size = Vector2(160, 28)
	_create_button.pressed.connect(_on_create_requested)
	tools.add_child(_create_button)
	_item_filters = VBoxContainer.new()
	_item_filters.name = "CatalogItemFilters"
	_item_filters.add_theme_constant_override("separation", 8)
	column.add_child(_item_filters)
	var item_taxonomy_filters := HBoxContainer.new()
	item_taxonomy_filters.add_theme_constant_override("separation", 8)
	_item_filters.add_child(item_taxonomy_filters)
	_item_category = _build_item_option_filter(item_taxonomy_filters, "CatalogItemCategory", "Kategorie")
	_item_subcategory = _build_item_option_filter(item_taxonomy_filters, "CatalogItemSubcategory", "Untertyp")
	_item_rarity = _build_item_option_filter(item_taxonomy_filters, "CatalogItemRarity", "Rarität")
	var item_fact_filters := HBoxContainer.new()
	item_fact_filters.add_theme_constant_override("separation", 8)
	_item_filters.add_child(item_fact_filters)
	_item_magic = _build_item_boolean_filter(item_fact_filters, "CatalogItemMagic", "Magie")
	_item_attunement = _build_item_boolean_filter(item_fact_filters, "CatalogItemAttunement", "Einstimmung")
	_item_minimum_cost = _build_item_cost_filter(item_fact_filters, "CatalogItemMinimumCost", "Min. · KM")
	_item_maximum_cost = _build_item_cost_filter(item_fact_filters, "CatalogItemMaximumCost", "Max. · KM")
	_item_filters.visible = false
	_creature_filters = VBoxContainer.new()
	_creature_filters.name = "CatalogCreatureFilters"
	_creature_filters.add_theme_constant_override("separation", 8)
	column.add_child(_creature_filters)
	var creature_taxonomy_filters := HBoxContainer.new()
	creature_taxonomy_filters.add_theme_constant_override("separation", 8)
	_creature_filters.add_child(creature_taxonomy_filters)
	_creature_size = _build_creature_multi_filter(creature_taxonomy_filters, "CatalogCreatureSize", "Größe", "sizes")
	_creature_type = _build_creature_multi_filter(creature_taxonomy_filters, "CatalogCreatureType", "Typ", "types")
	_creature_subtype = _build_creature_multi_filter(creature_taxonomy_filters, "CatalogCreatureSubtype", "Untertyp", "subtypes")
	var creature_context_filters := HBoxContainer.new()
	creature_context_filters.add_theme_constant_override("separation", 8)
	_creature_filters.add_child(creature_context_filters)
	_creature_environment = _build_creature_multi_filter(creature_context_filters, "CatalogCreatureEnvironment", "Umwelt", "environments")
	_creature_alignment = _build_creature_multi_filter(creature_context_filters, "CatalogCreatureAlignment", "Gesinnung", "alignments")
	_creature_minimum_cr = _build_creature_cr_filter(creature_context_filters, "CatalogCreatureMinimumCr", "HG min.")
	_creature_maximum_cr = _build_creature_cr_filter(creature_context_filters, "CatalogCreatureMaximumCr", "HG max.")
	_creature_filters.visible = false
	var split := HSplitContainer.new()
	split.size_flags_vertical = Control.SIZE_EXPAND_FILL
	split.split_offset = 600
	column.add_child(split)
	var result_column := VBoxContainer.new()
	result_column.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	result_column.size_flags_vertical = Control.SIZE_EXPAND_FILL
	result_column.add_theme_constant_override("separation", 4)
	split.add_child(result_column)
	_table_header = HBoxContainer.new()
	_table_header.name = "CatalogTableHeader"
	_table_header.add_theme_constant_override("separation", 6)
	result_column.add_child(_table_header)
	_name_header = _build_header_button("CatalogSortName", "Name", "name")
	_name_header.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_table_header.add_child(_name_header)
	_identity_header = _build_header_button("CatalogSortIdentity", "Kennung", "identity")
	_identity_header.custom_minimum_size = Vector2(150, 28)
	_table_header.add_child(_identity_header)
	_category_header = _build_header_button("CatalogSortCategory", "Kategorie", "category")
	_category_header.custom_minimum_size = Vector2(150, 28)
	_table_header.add_child(_category_header)
	_rarity_header = _build_header_button("CatalogSortRarity", "Seltenheit", "rarity")
	_rarity_header.custom_minimum_size = Vector2(112, 28)
	_table_header.add_child(_rarity_header)
	_cost_header = _build_header_button("CatalogSortCost", "Kosten", "cost")
	_cost_header.custom_minimum_size = Vector2(96, 28)
	_table_header.add_child(_cost_header)
	var scroll := ScrollContainer.new()
	scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	result_column.add_child(scroll)
	_result_list = VBoxContainer.new()
	_result_list.name = "CatalogResults"
	_result_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_result_list.add_theme_constant_override("separation", 6)
	scroll.add_child(_result_list)
	var inspector := VBoxContainer.new()
	inspector.custom_minimum_size = Vector2(300, 0)
	inspector.add_theme_constant_override("separation", 10)
	split.add_child(inspector)
	_detail = RichTextLabel.new()
	_detail.name = "CatalogInspector"
	_detail.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_detail.fit_content = false
	_detail.bbcode_enabled = true
	_detail.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	inspector.add_child(_detail)
	_detail_actions = HFlowContainer.new()
	_detail_actions.add_theme_constant_override("separation", 8)
	inspector.add_child(_detail_actions)
	_edit_button = Button.new()
	_edit_button.name = "CatalogEdit"
	_edit_button.text = "Bearbeiten"
	_edit_button.pressed.connect(_on_edit_requested)
	_detail_actions.add_child(_edit_button)
	_trash_button = Button.new()
	_trash_button.name = "CatalogTrash"
	_trash_button.text = "In Papierkorb"
	_trash_button.pressed.connect(_on_trash_requested)
	_detail_actions.add_child(_trash_button)
	_restore_button = Button.new()
	_restore_button.name = "CatalogRestore"
	_restore_button.text = "Wiederherstellen"
	_restore_button.pressed.connect(_on_restore_requested)
	_detail_actions.add_child(_restore_button)
	_lifecycle_button = Button.new()
	_lifecycle_button.name = "CatalogLifecycle"
	_lifecycle_button.pressed.connect(_on_lifecycle_requested)
	_detail_actions.add_child(_lifecycle_button)
	_narrative_threads = WorldPlannerNarrativeThreads.new()
	_narrative_threads.name = "WorldPlannerNarrativeThreads"
	_narrative_threads.data_root = data_root
	_narrative_threads.command_controller = command_controller
	inspector.add_child(_narrative_threads)
	var footer_row := HBoxContainer.new()
	footer_row.add_theme_constant_override("separation", 8)
	column.add_child(footer_row)
	_footer = Label.new()
	_footer.name = "CatalogFooter"
	_footer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_footer.add_theme_color_override("font_color", QUIET_INK)
	footer_row.add_child(_footer)
	_previous_page = Button.new()
	_previous_page.name = "CatalogPreviousPage"
	_previous_page.text = "Zurück"
	_previous_page.custom_minimum_size = Vector2(60, 28)
	_previous_page.pressed.connect(_on_page_requested.bind(-1))
	footer_row.add_child(_previous_page)
	_page_label = Label.new()
	_page_label.name = "CatalogPageLabel"
	_page_label.custom_minimum_size = Vector2(58, 28)
	_page_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_page_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_page_label.add_theme_color_override("font_color", QUIET_INK)
	footer_row.add_child(_page_label)
	_next_page = Button.new()
	_next_page.name = "CatalogNextPage"
	_next_page.text = "Weiter"
	_next_page.custom_minimum_size = Vector2(60, 28)
	_next_page.pressed.connect(_on_page_requested.bind(1))
	footer_row.add_child(_next_page)
	_debounce = Timer.new()
	_debounce.one_shot = true
	_debounce.wait_time = 0.2
	_debounce.timeout.connect(_submit_current_query)
	add_child(_debounce)
	_build_record_dialogs()
	_reset_detail()


func _build_header_button(node_name: String, label: String, sort_key: String) -> Button:
	var button := Button.new()
	button.name = node_name
	button.text = label
	button.alignment = HORIZONTAL_ALIGNMENT_LEFT
	button.custom_minimum_size = Vector2(0, 28)
	button.flat = true
	button.clip_text = true
	button.tooltip_text = "%s sortieren; erneut aktivieren kehrt die Richtung um" % label
	button.pressed.connect(_on_sort_requested.bind(sort_key))
	return button


func _build_item_option_filter(parent: Container, node_name: String, label_text: String) -> OptionButton:
	var option := OptionButton.new()
	option.name = node_name
	option.custom_minimum_size = Vector2(124, 28)
	option.tooltip_text = label_text
	option.add_item("%s · alle" % label_text)
	option.set_item_metadata(0, "")
	option.item_selected.connect(_on_item_filters_changed)
	parent.add_child(option)
	return option


func _build_item_boolean_filter(parent: Container, node_name: String, label_text: String) -> OptionButton:
	var option := OptionButton.new()
	option.name = node_name
	option.custom_minimum_size = Vector2(112, 28)
	option.tooltip_text = label_text
	for entry in [
		{"label": "%s · alle" % label_text, "value": null},
		{"label": "%s · ja" % label_text, "value": true},
		{"label": "%s · nein" % label_text, "value": false},
	]:
		option.add_item(entry["label"])
		option.set_item_metadata(option.item_count - 1, entry["value"])
	option.item_selected.connect(_on_item_filters_changed)
	parent.add_child(option)
	return option


func _build_item_cost_filter(parent: Container, node_name: String, placeholder: String) -> LineEdit:
	var input := LineEdit.new()
	input.name = node_name
	input.custom_minimum_size = Vector2(96, 28)
	input.placeholder_text = placeholder
	input.tooltip_text = "Kosten in Kupfermünzen"
	input.text_changed.connect(_on_item_cost_changed)
	input.text_submitted.connect(func(_value: String) -> void: _submit_current_query())
	parent.add_child(input)
	return input


func _build_creature_multi_filter(
	parent: Container,
	node_name: String,
	label_text: String,
	filter_key: String
) -> MenuButton:
	var menu := MenuButton.new()
	menu.name = node_name
	menu.text = "%s · alle" % label_text
	menu.custom_minimum_size = Vector2(124, 28)
	menu.tooltip_text = "%s mehrfach auswählen" % label_text
	menu.get_popup().hide_on_checkable_item_selection = false
	menu.get_popup().id_pressed.connect(_on_creature_filter_pressed.bind(filter_key, label_text, menu))
	parent.add_child(menu)
	return menu


func _build_creature_cr_filter(parent: Container, node_name: String, placeholder: String) -> LineEdit:
	var input := LineEdit.new()
	input.name = node_name
	input.custom_minimum_size = Vector2(86, 28)
	input.placeholder_text = placeholder
	input.tooltip_text = "HG als Zahl oder Dezimalwert"
	input.text_changed.connect(_on_creature_cr_changed)
	input.text_submitted.connect(func(_value: String) -> void: _submit_current_query())
	parent.add_child(input)
	return input


func _build_record_dialogs() -> void:
	_record_dialog = ConfirmationDialog.new()
	_record_dialog.name = "CatalogRecordDialog"
	_record_dialog.min_size = Vector2i(560, 620)
	_record_dialog.max_size = Vector2i(620, 700)
	_record_dialog.get_cancel_button().text = "Abbrechen"
	_record_dialog.confirmed.connect(_on_record_dialog_confirmed)
	add_child(_record_dialog)
	var record_scroll := ScrollContainer.new()
	record_scroll.name = "CatalogRecordScroll"
	record_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	record_scroll.custom_minimum_size = Vector2(0, 550)
	record_scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	record_scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_record_dialog.add_child(record_scroll)
	var record_button_row := _record_dialog.get_ok_button().get_parent() as Control
	record_button_row.z_index = 1
	var fields := VBoxContainer.new()
	fields.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	fields.add_theme_constant_override("separation", 8)
	record_scroll.add_child(fields)
	var name_label := Label.new()
	name_label.text = "Name"
	fields.add_child(name_label)
	_record_name = LineEdit.new()
	_record_name.name = "CatalogRecordName"
	_record_name.max_length = 160
	fields.add_child(_record_name)
	var notes_label := Label.new()
	notes_label.text = "Notizen · optional"
	fields.add_child(notes_label)
	_record_notes = TextEdit.new()
	_record_notes.name = "CatalogRecordNotes"
	_record_notes.custom_minimum_size = Vector2(0, 82)
	_record_notes.placeholder_text = "Was muss am Spieltisch schnell wieder auffindbar sein?"
	fields.add_child(_record_notes)
	_npc_editor_fields = VBoxContainer.new()
	_npc_editor_fields.visible = false
	_npc_editor_fields.add_theme_constant_override("separation", 8)
	fields.add_child(_npc_editor_fields)
	_record_appearance = _add_multiline_editor(_npc_editor_fields, "CatalogRecordAppearance", "Erscheinung · optional")
	_record_behavior = _add_multiline_editor(_npc_editor_fields, "CatalogRecordBehavior", "Verhalten · optional")
	_record_history = _add_multiline_editor(_npc_editor_fields, "CatalogRecordHistory", "Geschichte · optional")
	_add_reference_editor(_npc_editor_fields, "Statblock", "creature_id", "creature", false)
	_add_reference_editor(_npc_editor_fields, "Fraktion", "faction_id", "faction", false)
	_add_reference_editor(_npc_editor_fields, "Letzter Ort", "last_place_id", "place", false)
	var lifecycle_label := Label.new()
	lifecycle_label.text = "Lebenszyklus"
	_npc_editor_fields.add_child(lifecycle_label)
	_record_lifecycle = OptionButton.new()
	_record_lifecycle.name = "CatalogRecordLifecycle"
	_record_lifecycle.add_item("Aktiv")
	_record_lifecycle.set_item_metadata(0, "active")
	_record_lifecycle.add_item("Besiegt")
	_record_lifecycle.set_item_metadata(1, "defeated")
	_npc_editor_fields.add_child(_record_lifecycle)
	_record_npc_disposition = _add_disposition_editor(_npc_editor_fields, "CatalogRecordNpcDisposition")
	_faction_editor_fields = VBoxContainer.new()
	_faction_editor_fields.visible = false
	_faction_editor_fields.add_theme_constant_override("separation", 8)
	fields.add_child(_faction_editor_fields)
	_record_faction_disposition = _add_disposition_editor(_faction_editor_fields, "CatalogRecordFactionDisposition")
	_add_reference_editor(
		_faction_editor_fields,
		"Primäre Encounter-Tabelle",
		"primary_encounter_table_id",
		"encounter_table",
		false
	)
	_faction_inventory_editor = FactionInventoryEditor.new()
	_faction_inventory_editor.choose_requested.connect(_open_faction_inventory_picker)
	_faction_editor_fields.add_child(_faction_inventory_editor)
	_place_editor_fields = VBoxContainer.new()
	_place_editor_fields.visible = false
	_place_editor_fields.add_theme_constant_override("separation", 8)
	fields.add_child(_place_editor_fields)
	_add_reference_editor(_place_editor_fields, "Verknüpfte Fraktionen", "faction_ids", "faction", true)
	_add_reference_editor(
		_place_editor_fields,
		"Encounter-Tabellen",
		"encounter_table_ids",
		"encounter_table",
		true
	)
	_delete_dialog = ConfirmationDialog.new()
	_delete_dialog.name = "CatalogDeleteDialog"
	_delete_dialog.title = "In Papierkorb verschieben?"
	_delete_dialog.dialog_text = "Der Eintrag verschwindet aus aktiven Listen. Abhängige aktuelle Verweise werden entfernt; Wiederherstellung bleibt möglich."
	_delete_dialog.ok_button_text = "In Papierkorb"
	_delete_dialog.get_cancel_button().text = "Abbrechen"
	_delete_dialog.confirmed.connect(_confirm_trash)
	add_child(_delete_dialog)
	_lifecycle_dialog = ConfirmationDialog.new()
	_lifecycle_dialog.name = "CatalogLifecycleDialog"
	_lifecycle_dialog.get_cancel_button().text = "Abbrechen"
	_lifecycle_dialog.confirmed.connect(_confirm_lifecycle)
	add_child(_lifecycle_dialog)
	_reference_picker = WorldPlannerReferencePicker.new()
	_reference_picker.data_root = data_root
	_reference_picker.references_selected.connect(_on_references_selected)
	_record_dialog.add_child(_reference_picker)
	_encounter_table_editor = EncounterTableEditorDialog.new()
	_encounter_table_editor.data_root = data_root
	_encounter_table_editor.table_submitted.connect(_on_encounter_table_submitted)
	add_child(_encounter_table_editor)
	_encounter_plan_editor = EncounterPlanEditorDialog.new()
	_encounter_plan_editor.data_root = data_root
	_encounter_plan_editor.plan_submitted.connect(_on_encounter_plan_submitted)
	add_child(_encounter_plan_editor)


func _add_multiline_editor(parent: VBoxContainer, node_name: String, label_text: String) -> TextEdit:
	var label := Label.new()
	label.text = label_text
	parent.add_child(label)
	var editor := TextEdit.new()
	editor.name = node_name
	editor.custom_minimum_size = Vector2(0, 62)
	parent.add_child(editor)
	return editor


func _add_disposition_editor(parent: VBoxContainer, node_name: String) -> SpinBox:
	var label := Label.new()
	label.text = "Disposition zu den PCs · -50 bis +50"
	parent.add_child(label)
	var editor := SpinBox.new()
	editor.name = node_name
	editor.min_value = -50
	editor.max_value = 50
	editor.step = 1
	editor.allow_greater = false
	editor.allow_lesser = false
	parent.add_child(editor)
	return editor


func _add_reference_editor(
	parent: VBoxContainer,
	label_text: String,
	field_key: String,
	kind: String,
	multi: bool
) -> void:
	var block := VBoxContainer.new()
	block.add_theme_constant_override("separation", 3)
	parent.add_child(block)
	var label := Label.new()
	label.text = label_text
	block.add_child(label)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	block.add_child(row)
	var summary := Label.new()
	summary.name = "CatalogReferenceSummary%s" % field_key.to_pascal_case()
	summary.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	summary.add_theme_color_override("font_color", QUIET_INK)
	summary.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	row.add_child(summary)
	_reference_summaries[field_key] = summary
	var choose := Button.new()
	choose.name = "CatalogReferenceChoose%s" % field_key.to_pascal_case()
	choose.text = "Auswählen"
	choose.custom_minimum_size = Vector2(92, 28)
	choose.pressed.connect(_open_reference_picker.bind(field_key, label_text, kind, multi))
	row.add_child(choose)


func _on_search_changed(value: String) -> void:
	var state: Dictionary = _section_state[_active_section_id]
	state["draft"] = value
	state["page"] = 0
	state["selected_id"] = ""
	state["selected_row"] = {}
	_section_state[_active_section_id] = state
	_reset_detail()
	_update_paging(state)
	_debounce.start()


func _on_sort_requested(sort_key: String) -> void:
	if _active_section_id == "creatures":
		sort_key = {"category": "type", "rarity": "challenge_rating", "cost": "xp"}.get(sort_key, sort_key)
	if sort_key not in ["name", "identity", "category", "rarity", "cost", "type", "challenge_rating", "xp"]:
		return
	var section := _section(_active_section_id)
	if section.is_empty() or not section["provider"]:
		return
	var state: Dictionary = _section_state[_active_section_id]
	if state["sort_key"] == sort_key:
		state["sort_ascending"] = not bool(state["sort_ascending"])
	else:
		state["sort_key"] = sort_key
		state["sort_ascending"] = true
	state["page"] = 0
	_section_state[_active_section_id] = state
	_render_table_header()
	_update_paging(state)
	_submit_current_query()


func _on_page_requested(delta: int) -> void:
	var section := _section(_active_section_id)
	if section.is_empty() or not section["provider"]:
		return
	var state: Dictionary = _section_state[_active_section_id]
	var page_count := _page_count(int(state["total"]))
	var next_page := clampi(int(state["page"]) + delta, 0, page_count - 1)
	if next_page == int(state["page"]):
		return
	state["page"] = next_page
	_section_state[_active_section_id] = state
	_update_paging(state)
	_submit_current_query()


func _on_item_filters_changed(_index: int) -> void:
	if _active_section_id != "items":
		return
	var state: Dictionary = _section_state["items"]
	state["filters"]["category"] = str(_item_category.get_selected_metadata())
	state["filters"]["subcategory"] = str(_item_subcategory.get_selected_metadata())
	state["filters"]["rarity"] = str(_item_rarity.get_selected_metadata())
	state["filters"]["magic"] = _item_magic.get_selected_metadata()
	state["filters"]["attunement"] = _item_attunement.get_selected_metadata()
	state["page"] = 0
	_section_state["items"] = state
	_submit_current_query()


func _on_item_cost_changed(_value: String) -> void:
	if _active_section_id != "items":
		return
	var state: Dictionary = _section_state["items"]
	state["filters"]["minimum_cost_cp"] = _item_minimum_cost.text.strip_edges()
	state["filters"]["maximum_cost_cp"] = _item_maximum_cost.text.strip_edges()
	state["page"] = 0
	_section_state["items"] = state
	_debounce.start()


func _item_query_filters(state: Dictionary) -> Dictionary:
	var filters: Dictionary = state.get("filters", {}).duplicate(true)
	for key in ["minimum_cost_cp", "maximum_cost_cp"]:
		var value := str(filters.get(key, "")).strip_edges()
		filters[key] = null if value.is_empty() else value.to_int() if value.is_valid_int() else value
	return filters


func _on_creature_filter_pressed(id: int, filter_key: String, label_text: String, menu: MenuButton) -> void:
	if _active_section_id != "creatures":
		return
	var popup := menu.get_popup()
	var index := popup.get_item_index(id)
	if index < 0:
		return
	popup.set_item_checked(index, not popup.is_item_checked(index))
	var state: Dictionary = _section_state["creatures"]
	var selected: Array = state["filters"].get(filter_key, []).duplicate()
	var value := str(popup.get_item_metadata(index))
	if popup.is_item_checked(index) and value not in selected:
		selected.append(value)
	elif not popup.is_item_checked(index):
		selected.erase(value)
	selected.sort()
	state["filters"][filter_key] = selected
	state["page"] = 0
	_section_state["creatures"] = state
	menu.text = "%s · alle" % label_text if selected.is_empty() else "%s · %d" % [label_text, selected.size()]
	_submit_current_query()


func _on_creature_cr_changed(_value: String) -> void:
	if _active_section_id != "creatures":
		return
	var state: Dictionary = _section_state["creatures"]
	state["filters"]["minimum_challenge_rating"] = _creature_minimum_cr.text.strip_edges()
	state["filters"]["maximum_challenge_rating"] = _creature_maximum_cr.text.strip_edges()
	state["page"] = 0
	_section_state["creatures"] = state
	_debounce.start()


func _creature_query_filters(state: Dictionary) -> Dictionary:
	var filters: Dictionary = state.get("filters", {}).duplicate(true)
	for key in ["minimum_challenge_rating", "maximum_challenge_rating"]:
		var value := str(filters.get(key, "")).strip_edges()
		filters[key] = null if value.is_empty() else value.to_float() if value.is_valid_float() else value
	return filters


func _submit_current_query() -> void:
	var section := _section(_active_section_id)
	if section.is_empty() or not section["provider"]:
		_render_state()
		return
	var state: Dictionary = _section_state[_active_section_id]
	state["accepted"] = state["draft"]
	state["status"] = "loading" if state["rows"].is_empty() else "refreshing"
	_section_state[_active_section_id] = state
	_render_state()
	browse_controller.query(
		_active_section_id,
		str(section["kind"]),
		str(state["accepted"]),
		int(state["page"]) * PAGE_SIZE,
		PAGE_SIZE,
		bool(state["trash"]),
		str(state["sort_key"]),
		bool(state["sort_ascending"]),
		_item_query_filters(state)
		if _active_section_id == "items"
		else _creature_query_filters(state)
		if _active_section_id == "creatures"
		else {}
	)


func _on_query_started(request: Dictionary) -> void:
	var section_id := str(request.get("section_id", ""))
	if not _section_state.has(section_id):
		return
	var state: Dictionary = _section_state[section_id]
	state["status"] = "loading" if state["rows"].is_empty() else "refreshing"
	_section_state[section_id] = state
	if section_id == _active_section_id:
		_render_state()


func _on_result_published(result: Dictionary) -> void:
	var section_id := str(result.get("section_id", ""))
	if not _section_state.has(section_id):
		return
	var state: Dictionary = _section_state[section_id]
	if result.get("ok", false):
		state["rows"] = result.get("rows", []).duplicate(true)
		state["total"] = int(result.get("total", 0))
		state["status"] = str(result.get("status", "ready"))
		if section_id in ["items", "creatures"]:
			state["filter_options"] = result.get("filter_options", {}).duplicate(true)
			state["error"] = str(result.get("error", ""))
		for row in state["rows"]:
			if _row_id(row) == str(state["selected_id"]):
				state["selected_row"] = row.duplicate(true)
				break
		var last_page := maxi(0, _page_count(int(state["total"])) - 1)
		if int(state["page"]) > last_page:
			state["page"] = last_page
			state["status"] = "uninitialized"
			_section_state[section_id] = state
			if section_id == _active_section_id:
				_submit_current_query()
			return
	else:
		state["status"] = "failed"
		state["error"] = result.get("error", "Katalogabfrage ist fehlgeschlagen.")
	_section_state[section_id] = state
	if section_id == _active_section_id:
		if section_id == "items":
			_sync_item_filter_controls(state)
		elif section_id == "creatures":
			_sync_creature_filter_controls(state)
		_render_state()
		_render_selected_detail()


func _on_detail_query_started(request: Dictionary) -> void:
	if str(request.get("record_id", "")) != str(_selected_detail.get("record_id", "")):
		return
	_selected_detail["status"] = "loading"
	_edit_button.disabled = true


func _on_detail_result_published(result: Dictionary) -> void:
	var record_id := str(result.get("request", {}).get("record_id", ""))
	if record_id.is_empty() or record_id != str(_selected_detail.get("record_id", "")):
		return
	if not result.get("ok", false):
		_selected_detail = {
			"status": "failed",
			"record_id": record_id,
			"error": str(result.get("error", "World-Planner-Details konnten nicht geladen werden.")),
		}
		_detail.text = _escape_bbcode(str(_selected_detail["error"]))
		_lifecycle_button.visible = false
		_edit_button.disabled = true
		return
	var record: Dictionary = result.get("record", {}).duplicate(true)
	_selected_detail = {
		"status": "ready",
		"record_id": record_id,
		"record": record,
		"deleted": bool(result.get("deleted", false)),
		"inventory_labels": result.get("inventory_labels", {}).duplicate(true),
		"missing_inventory_definition_ids": result.get("missing_inventory_definition_ids", []).duplicate(),
	}
	_detail.text = _format_worldplanner_detail(record, _selected_detail["inventory_labels"])
	var deleted := bool(_selected_detail["deleted"])
	_edit_button.disabled = _any_command_busy() or deleted
	_lifecycle_button.visible = record.get("kind", "") == "npc" and not deleted
	_lifecycle_button.text = "Reaktivieren" if record.get("lifecycle_status", "") == "defeated" else "Als besiegt markieren"
	_lifecycle_button.disabled = _any_command_busy()


func _on_encounter_table_detail_query_started(request: Dictionary) -> void:
	if str(request.get("record_id", "")) != str(_selected_detail.get("record_id", "")):
		return
	_selected_detail["status"] = "loading"
	_edit_button.disabled = true


func _on_encounter_table_detail_result_published(result: Dictionary) -> void:
	var record_id := str(result.get("request", {}).get("record_id", ""))
	if record_id.is_empty() or record_id != str(_selected_detail.get("record_id", "")):
		return
	if not result.get("ok", false):
		_selected_detail = {
			"status": "failed",
			"record_id": record_id,
			"error": str(result.get("error", "Encounter-Table-Details konnten nicht geladen werden.")),
		}
		_detail.text = _escape_bbcode(str(_selected_detail["error"]))
		_edit_button.disabled = true
		return
	var record: Dictionary = result.get("record", {}).duplicate(true)
	_selected_detail = {
		"status": "ready",
		"record_id": record_id,
		"record": record,
		"entry_labels": result.get("entry_labels", {}).duplicate(true),
		"missing_definition_ids": result.get("missing_definition_ids", []).duplicate(),
		"deleted": bool(result.get("deleted", false)),
	}
	_detail.text = _format_encounter_table_detail(record, _selected_detail["entry_labels"])
	if not _selected_detail["missing_definition_ids"].is_empty():
		_detail.text += "\n\n%d fehlende Creature-Referenzen können im Editor repariert werden." % _selected_detail["missing_definition_ids"].size()
	_edit_button.disabled = _any_command_busy() or bool(_selected_detail["deleted"])
	_lifecycle_button.visible = false


func _on_encounter_plan_detail_query_started(request: Dictionary) -> void:
	if str(request.get("record_id", "")) != str(_selected_detail.get("record_id", "")):
		return
	_selected_detail["status"] = "loading"
	_edit_button.disabled = true


func _on_encounter_plan_detail_result_published(result: Dictionary) -> void:
	var record_id := str(result.get("request", {}).get("record_id", ""))
	if record_id.is_empty() or record_id != str(_selected_detail.get("record_id", "")):
		return
	if not result.get("ok", false):
		_selected_detail = {
			"status": "failed",
			"record_id": record_id,
			"error": str(result.get("error", "Encounter-Plan-Details konnten nicht geladen werden.")),
		}
		_detail.text = _escape_bbcode(str(_selected_detail["error"]))
		_edit_button.disabled = true
		return
	var record: Dictionary = result.get("record", {}).duplicate(true)
	var deleted := bool(result.get("deleted", false))
	_selected_detail = {
		"status": "ready",
		"record_id": record_id,
		"record": record,
		"current_labels": result.get("current_labels", {}).duplicate(true),
		"missing_definition_ids": result.get("missing_definition_ids", []).duplicate(),
		"deleted": deleted,
	}
	_detail.text = _format_encounter_plan_detail(record, _selected_detail["current_labels"])
	if not _selected_detail["missing_definition_ids"].is_empty():
		_detail.text += "\n\n%d fehlende Creature-Referenzen bleiben über ihre letzten Namen erkennbar." % _selected_detail["missing_definition_ids"].size()
	_edit_button.disabled = _any_command_busy() or deleted
	_lifecycle_button.visible = false


func _on_item_detail_query_started(request: Dictionary) -> void:
	if str(request.get("definition_id", "")) != str(_selected_detail.get("record_id", "")):
		return
	_selected_detail["status"] = "loading"


func _on_item_detail_result_published(result: Dictionary) -> void:
	var definition_id := str(result.get("request", {}).get("definition_id", ""))
	if definition_id.is_empty() or definition_id != str(_selected_detail.get("record_id", "")):
		return
	if not result.get("ok", false):
		_selected_detail = {
			"status": str(result.get("status", "failed")),
			"record_id": definition_id,
			"error": str(result.get("error", "Item-Details konnten nicht geladen werden.")),
		}
		_detail.text = _escape_bbcode(str(_selected_detail["error"]))
		return
	var item: Dictionary = result.get("item", {}).duplicate(true)
	_selected_detail = {
		"status": "ready",
		"record_id": definition_id,
		"record": item,
	}
	_detail.text = _format_item_detail(item)


func _on_creature_detail_query_started(request: Dictionary) -> void:
	if str(request.get("definition_id", "")) != str(_selected_detail.get("record_id", "")):
		return
	_selected_detail["status"] = "loading"


func _on_creature_detail_result_published(result: Dictionary) -> void:
	var definition_id := str(result.get("request", {}).get("definition_id", ""))
	if definition_id.is_empty() or definition_id != str(_selected_detail.get("record_id", "")):
		return
	if not result.get("ok", false):
		_selected_detail = {
			"status": str(result.get("status", "failed")),
			"record_id": definition_id,
			"error": str(result.get("error", "Monster-Details konnten nicht geladen werden.")),
		}
		_detail.text = _escape_bbcode(str(_selected_detail["error"]))
		return
	var creature: Dictionary = result.get("creature", {}).duplicate(true)
	_selected_detail = {"status": "ready", "record_id": definition_id, "record": creature}
	_detail.text = _format_creature_detail(creature)


func _sync_item_filter_controls(state: Dictionary) -> void:
	if _item_filters == null:
		return
	for control in [
		_item_category, _item_subcategory, _item_rarity, _item_magic,
		_item_attunement, _item_minimum_cost, _item_maximum_cost,
	]:
		control.set_block_signals(true)
	var filters: Dictionary = state.get("filters", {})
	var options: Dictionary = state.get("filter_options", {})
	_populate_item_option(_item_category, "Kategorie", options.get("categories", []), str(filters.get("category", "")))
	_populate_item_option(
		_item_subcategory,
		"Untertyp",
		options.get("subcategories", []),
		str(filters.get("subcategory", ""))
	)
	_populate_item_option(_item_rarity, "Rarität", options.get("rarities", []), str(filters.get("rarity", "")))
	_select_option_metadata(_item_magic, filters.get("magic"))
	_select_option_metadata(_item_attunement, filters.get("attunement"))
	_item_minimum_cost.text = str(filters.get("minimum_cost_cp", ""))
	_item_maximum_cost.text = str(filters.get("maximum_cost_cp", ""))
	for control in [
		_item_category, _item_subcategory, _item_rarity, _item_magic,
		_item_attunement, _item_minimum_cost, _item_maximum_cost,
	]:
		control.set_block_signals(false)


func _populate_item_option(option: OptionButton, label_text: String, values: Array, selected: String) -> void:
	option.clear()
	option.add_item("%s · alle" % label_text)
	option.set_item_metadata(0, "")
	var found := selected.is_empty()
	for value in values:
		var text := str(value)
		option.add_item(text)
		option.set_item_metadata(option.item_count - 1, text)
		found = found or text == selected
	if not found:
		option.add_item(selected)
		option.set_item_metadata(option.item_count - 1, selected)
	_select_option_metadata(option, selected)


func _select_option_metadata(option: OptionButton, selected: Variant) -> void:
	for index in option.item_count:
		if option.get_item_metadata(index) == selected:
			option.select(index)
			return
	option.select(0)


func _sync_creature_filter_controls(state: Dictionary) -> void:
	if _creature_filters == null:
		return
	var filters: Dictionary = state.get("filters", {})
	var options: Dictionary = state.get("filter_options", {})
	for entry in [
		[_creature_size, "Größe", "sizes"],
		[_creature_type, "Typ", "types"],
		[_creature_subtype, "Untertyp", "subtypes"],
		[_creature_environment, "Umwelt", "environments"],
		[_creature_alignment, "Gesinnung", "alignments"],
	]:
		var menu: MenuButton = entry[0]
		var label_text := str(entry[1])
		var key := str(entry[2])
		var selected: Array = filters.get(key, [])
		var popup := menu.get_popup()
		popup.clear()
		var id := 1
		for value in options.get(key, []):
			popup.add_check_item(str(value), id)
			var index := popup.get_item_index(id)
			popup.set_item_metadata(index, str(value))
			popup.set_item_checked(index, value in selected)
			id += 1
		menu.text = "%s · alle" % label_text if selected.is_empty() else "%s · %d" % [label_text, selected.size()]
	_creature_minimum_cr.set_block_signals(true)
	_creature_maximum_cr.set_block_signals(true)
	_creature_minimum_cr.text = str(filters.get("minimum_challenge_rating", ""))
	_creature_maximum_cr.text = str(filters.get("maximum_challenge_rating", ""))
	_creature_minimum_cr.set_block_signals(false)
	_creature_maximum_cr.set_block_signals(false)


func _render_state() -> void:
	for child in _result_list.get_children():
		child.queue_free()
	var section := _section(_active_section_id)
	var state: Dictionary = _section_state[_active_section_id]
	var status := str(state["status"])
	_render_table_header()
	if status == "unavailable":
		_add_message(
			"Der Items-Katalog wurde noch nicht importiert. Der lokale Katalog bleibt offline und unverändert."
			if _active_section_id == "items"
			else "Der Monster-Katalog wurde noch nicht importiert. Der lokale Katalog bleibt offline und unverändert."
			if _active_section_id == "creatures"
			else "%s ist im Godot-Cutover noch nicht an seinen Provider angeschlossen." % section["label"]
		)
		_footer.text = _with_notice(
			"Items-Daten nicht verfügbar · vollständigen Operator-Import ausführen"
			if _active_section_id == "items"
			else "Monster-Daten nicht verfügbar · vollständigen Operator-Import ausführen"
			if _active_section_id == "creatures"
			else "Provider nicht verfügbar · keine Catalog-eigene Ersatzwahrheit",
			state
		)
		_update_paging(state)
		return
	if status == "incompatible":
		_add_message(str(state.get("error", "Der lokale Provider-Katalog besitzt ein inkompatibles Format.")))
		_footer.text = _with_notice("Inkompatibel · vollständigen Provider-Import erneut ausführen", state)
		_update_paging(state)
		return
	if status == "invalid_query":
		_add_message(
			"Die HG-Grenzen müssen nicht-negative Zahlen sein; Minimum darf Maximum nicht überschreiten."
			if _active_section_id == "creatures"
			else "Die Kostengrenzen müssen nicht-negative ganze Kupfermünzen sein; Minimum darf Maximum nicht überschreiten."
		)
		_footer.text = _with_notice("Ungültiger Filter · Eingabe bleibt erhalten", state)
		_update_paging(state)
		return
	if status == "storage_error":
		_add_message(str(state.get("error", "Der lokale Items-Katalog ist nicht lesbar.")))
		_footer.text = _with_notice("Speicherfehler · andere Katalogbereiche bleiben verfügbar", state)
		_update_paging(state)
		return
	if status == "failed":
		_add_message(str(state.get("error", "Katalogabfrage ist fehlgeschlagen.")))
		_footer.text = _with_notice("Fehlgeschlagen · Eingabe bleibt erhalten", state)
		_update_paging(state)
		return
	var rows: Array = state["rows"]
	if rows.is_empty():
		_add_message("Wird geladen …" if status == "loading" else "Keine passenden Einträge.")
	else:
		for row in rows:
			_add_result_row(row)
	_footer.text = _with_notice("%d von %d %s%s" % [
		rows.size(),
		int(state["total"]),
		"Papierkorbeinträgen" if state["trash"] else "Einträgen",
		" · wird aktualisiert" if status == "refreshing" else "",
	], state)
	_update_paging(state)


func _render_table_header() -> void:
	if _table_header == null:
		return
	var section := _section(_active_section_id)
	var available := not section.is_empty() and bool(section["provider"])
	_table_header.visible = available
	if not available:
		return
	var state: Dictionary = _section_state[_active_section_id]
	_name_header.text = _sort_header_text("Name", "name", state)
	var items := _active_section_id == "items"
	var creatures := _active_section_id == "creatures"
	_identity_header.visible = not items and not creatures
	_identity_header.text = _sort_header_text("Kennung", "identity", state)
	_category_header.visible = items or creatures
	_rarity_header.visible = items or creatures
	_cost_header.visible = items or creatures
	_category_header.text = _sort_header_text("Typ" if creatures else "Kategorie", "type" if creatures else "category", state)
	_rarity_header.text = _sort_header_text("HG" if creatures else "Seltenheit", "challenge_rating" if creatures else "rarity", state)
	_cost_header.text = _sort_header_text("TP" if creatures else "Kosten", "xp" if creatures else "cost", state)


func _sort_header_text(label: String, sort_key: String, state: Dictionary) -> String:
	if str(state["sort_key"]) != sort_key:
		return label
	return "%s %s" % [label, "↑" if state["sort_ascending"] else "↓"]


func _add_result_row(row: Dictionary) -> void:
	var row_container := HBoxContainer.new()
	row_container.name = "CatalogResultRow"
	row_container.custom_minimum_size = Vector2(0, 30)
	row_container.add_theme_constant_override("separation", 6)
	_result_list.add_child(row_container)
	var name_button := Button.new()
	name_button.name = "CatalogResultName"
	name_button.text = str(row["name"])
	name_button.alignment = HORIZONTAL_ALIGNMENT_LEFT
	name_button.flat = true
	name_button.clip_text = true
	name_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	name_button.custom_minimum_size = Vector2(0, 30)
	name_button.tooltip_text = "Details zu %s öffnen" % row["name"]
	name_button.pressed.connect(_select_row.bind(row.duplicate(true)))
	row_container.add_child(name_button)
	if _active_section_id == "items":
		_add_item_row_cell(row_container, "%s%s" % [
			str(row.get("category", "")),
			" · %s" % row["subcategory"] if not str(row.get("subcategory", "")).is_empty() else "",
		], 150, row)
		_add_item_row_cell(row_container, str(row.get("rarity", "–")) if not str(row.get("rarity", "")).is_empty() else "–", 112, row)
		_add_item_row_cell(row_container, str(row.get("cost_display", "–")) if not str(row.get("cost_display", "")).is_empty() else "–", 96, row)
	elif _active_section_id == "creatures":
		_add_item_row_cell(row_container, "%s%s" % [
			str(row.get("creature_type", "")),
			" · %s" % row["subtype"] if not str(row.get("subtype", "")).is_empty() else "",
		], 150, row)
		_add_item_row_cell(row_container, str(row.get("challenge_rating", "–")), 112, row)
		_add_item_row_cell(row_container, str(row.get("xp", 0)), 96, row)
	else:
		var identity_button := Button.new()
		identity_button.name = "CatalogResultIdentity"
		identity_button.text = _row_id(row)
		identity_button.alignment = HORIZONTAL_ALIGNMENT_LEFT
		identity_button.flat = true
		identity_button.clip_text = true
		identity_button.custom_minimum_size = Vector2(150, 30)
		identity_button.add_theme_color_override("font_color", QUIET_INK)
		identity_button.tooltip_text = "Dieselbe Referenz im Inspector öffnen"
		identity_button.pressed.connect(_select_row.bind(row.duplicate(true)))
		row_container.add_child(identity_button)


func _add_item_row_cell(parent: HBoxContainer, text_value: String, width: float, row: Dictionary) -> void:
	var button := Button.new()
	button.text = text_value
	button.alignment = HORIZONTAL_ALIGNMENT_LEFT
	button.flat = true
	button.clip_text = true
	button.custom_minimum_size = Vector2(width, 30)
	button.add_theme_color_override("font_color", QUIET_INK)
	button.tooltip_text = "%s · im Inspector öffnen" % text_value
	button.pressed.connect(_select_row.bind(row.duplicate(true)))
	parent.add_child(button)


func _update_paging(state: Dictionary) -> void:
	if _previous_page == null:
		return
	var section := _section(_active_section_id)
	var page_count := _page_count(int(state.get("total", 0)))
	var page := clampi(int(state.get("page", 0)), 0, page_count - 1)
	var visible := page_count > 1 and not section.is_empty() and bool(section["provider"])
	_previous_page.visible = visible
	_page_label.visible = visible
	_next_page.visible = visible
	_page_label.text = "Seite %d/%d" % [page + 1, page_count]
	var status := str(state.get("status", ""))
	var usable := status not in ["unavailable", "failed"]
	_previous_page.disabled = not usable or page <= 0
	_next_page.disabled = not usable or page >= page_count - 1


func _page_count(total: int) -> int:
	return maxi(1, int((maxi(0, total) + PAGE_SIZE - 1) / PAGE_SIZE))


func _select_row(row: Dictionary) -> void:
	var state: Dictionary = _section_state[_active_section_id]
	state["selected_id"] = _row_id(row)
	state["selected_row"] = row.duplicate(true)
	_section_state[_active_section_id] = state
	var safe_name := _escape_bbcode(str(row["name"]))
	var safe_notes := _escape_bbcode(str(row.get("notes", "")))
	_detail.text = "[font_size=22]%s[/font_size]\n\n%s\n\nTyp: %s%s" % [
		safe_name,
		_row_id(row),
		_kind_label(str(row["kind"])),
		"\n\n%s" % safe_notes if not safe_notes.is_empty() else "",
	]
	var section := _section(_active_section_id)
	_detail_actions.visible = bool(section.get("mutable", false))
	_edit_button.visible = not bool(row.get("deleted", false))
	_trash_button.visible = bool(section.get("trashable", false)) and not bool(row.get("deleted", false))
	_restore_button.visible = bool(section.get("trashable", false)) and bool(row.get("deleted", false))
	_lifecycle_button.visible = false
	_set_action_buttons_disabled(_any_command_busy())
	_selected_detail = {
		"status": "loading",
		"record_id": _row_id(row),
		"deleted": bool(row.get("deleted", false)),
	}
	if _active_section_id == "encounter_tables":
		_narrative_threads.clear_subject()
		_edit_button.disabled = true
		encounter_table_detail_controller.query(_row_id(row), bool(row.get("deleted", false)))
	elif _active_section_id == "encounters":
		_narrative_threads.clear_subject()
		_edit_button.disabled = true
		encounter_plan_detail_controller.query(_row_id(row), bool(row.get("deleted", false)))
	elif _active_section_id == "items":
		_narrative_threads.clear_subject()
		item_detail_controller.query(_row_id(row))
	elif _active_section_id == "creatures":
		_narrative_threads.clear_subject()
		creature_detail_controller.query(_row_id(row))
	elif bool(section.get("mutable", false)):
		_narrative_threads.show_subject(row)
		_edit_button.disabled = true
		detail_controller.query(_row_id(row), bool(row.get("deleted", false)))
	else:
		_narrative_threads.clear_subject()
		_selected_detail.clear()


func _on_create_requested() -> void:
	var section := _section(_active_section_id)
	if not section.get("mutable", false):
		_footer.text = "Erstellen ist für %s noch nicht verfügbar." % section["label"]
		return
	if _active_section_id == "encounter_tables":
		_encounter_table_editor.open_create()
		return
	if _active_section_id == "encounters":
		_encounter_plan_editor.open_create()
		return
	_dialog_mode = "create"
	_dialog_record_id = ""
	_dialog_kind = str(section["kind"])
	_record_dialog.title = "%s erstellen" % section["label"]
	_record_dialog.ok_button_text = "Erstellen"
	_record_name.text = ""
	_record_notes.text = ""
	_prepare_typed_editor({}, _dialog_kind)
	_record_dialog.reset_size()
	_record_dialog.size = Vector2i(560, 620)
	_record_dialog.popup_centered(Vector2i(560, 620))
	_record_name.grab_focus()


func _on_edit_requested() -> void:
	var row := _selected_row()
	var record: Dictionary = _selected_detail.get("record", {})
	if row.is_empty() or record.is_empty():
		_show_command_failure({"error": "Die vollständigen Provider-Details werden noch geladen."})
		return
	if _active_section_id == "encounter_tables":
		_encounter_table_editor.open_edit(record, _selected_detail.get("entry_labels", {}))
		return
	if _active_section_id == "encounters":
		_encounter_plan_editor.open_edit(record, _selected_detail.get("current_labels", {}))
		return
	_dialog_mode = "edit"
	_dialog_record_id = _row_id(row)
	_dialog_kind = str(record["kind"])
	_record_dialog.title = "%s bearbeiten" % row["name"]
	_record_dialog.ok_button_text = "Änderungen speichern"
	_record_name.text = str(record["name"])
	_record_notes.text = str(record.get("notes", ""))
	_prepare_typed_editor(record, _dialog_kind)
	_record_dialog.reset_size()
	_record_dialog.size = Vector2i(560, 620)
	_record_dialog.popup_centered(Vector2i(560, 620))
	_record_name.grab_focus()


func _on_record_dialog_confirmed() -> void:
	var fields := {"notes": _record_notes.text}
	if _dialog_kind == "npc":
		fields.merge({
			"appearance": _record_appearance.text,
			"behavior": _record_behavior.text,
			"history": _record_history.text,
			"lifecycle_status": str(_record_lifecycle.get_selected_metadata()),
			"disposition_modifier": int(_record_npc_disposition.value),
			"creature_id": _single_reference("creature_id"),
			"faction_id": _single_reference("faction_id"),
			"last_place_id": _single_reference("last_place_id"),
		})
	elif _dialog_kind == "faction":
		fields["disposition_base"] = int(_record_faction_disposition.value)
		fields["primary_encounter_table_id"] = _single_reference("primary_encounter_table_id")
		fields["inventory_limits"] = _faction_inventory_editor.inventory_limits()
	elif _dialog_kind == "place":
		fields["faction_ids"] = _reference_values.get("faction_ids", []).duplicate()
		fields["encounter_table_ids"] = _reference_values.get("encounter_table_ids", []).duplicate()
	var started: Dictionary
	if _dialog_mode == "create":
		started = command_controller.create_record(
			_dialog_kind,
			_record_name.text,
			fields
		)
	else:
		fields["name"] = _record_name.text
		started = command_controller.update_record(
			_dialog_record_id,
			fields
		)
	if not started.get("ok", false):
		_show_command_failure(started)


func _on_encounter_table_submitted(
	mode: String,
	record_id: String,
	name_text: String,
	description: String,
	entries: Array
) -> void:
	var started := (
		encounter_table_command_controller.create_table(name_text, description, entries)
		if mode == "create"
		else encounter_table_command_controller.update_table(record_id, name_text, description, entries)
	)
	if not started.get("ok", false):
		_show_command_failure(started)


func _on_encounter_plan_submitted(
	mode: String,
	record_id: String,
	name_text: String,
	roster: Array
) -> void:
	var started := (
		encounter_plan_command_controller.create_plan(name_text, roster)
		if mode == "create"
		else encounter_plan_command_controller.update_plan(record_id, name_text, roster)
	)
	if not started.get("ok", false):
		_show_command_failure(started)


func _on_trash_requested() -> void:
	if not _selected_row().is_empty():
		_delete_dialog.dialog_text = (
			"Der gespeicherte Encounter verschwindet aus aktiven Listen. Sein vollständiges Roster und seine stabile Identität bleiben wiederherstellbar."
			if _active_section_id == "encounters"
			else "Der Eintrag verschwindet aus aktiven Listen. Abhängige aktuelle Verweise werden entfernt; Wiederherstellung bleibt möglich."
		)
		_delete_dialog.popup_centered()


func _confirm_trash() -> void:
	var row := _selected_row()
	if row.is_empty():
		return
	var started: Dictionary
	if _active_section_id == "encounters":
		started = encounter_plan_command_controller.trash_plan(_row_id(row))
	elif _active_section_id == "encounter_tables":
		started = encounter_table_command_controller.trash_table(_row_id(row))
	else:
		started = command_controller.trash_record(_row_id(row))
	if not started.get("ok", false):
		_show_command_failure(started)


func _on_restore_requested() -> void:
	var row := _selected_row()
	if row.is_empty():
		return
	var started: Dictionary
	if _active_section_id == "encounters":
		started = encounter_plan_command_controller.restore_plan(_row_id(row))
	elif _active_section_id == "encounter_tables":
		started = encounter_table_command_controller.restore_table(_row_id(row))
	else:
		started = command_controller.restore_record(_row_id(row))
	if not started.get("ok", false):
		_show_command_failure(started)


func _on_lifecycle_requested() -> void:
	var record: Dictionary = _selected_detail.get("record", {})
	if record.get("kind", "") != "npc" or bool(_selected_detail.get("deleted", false)):
		return
	var defeated: bool = record.get("lifecycle_status", "") == "defeated"
	_lifecycle_dialog.title = "NPC reaktivieren?" if defeated else "NPC als besiegt markieren?"
	_lifecycle_dialog.dialog_text = (
		"Der NPC wird wieder für Auswahl und Generierung verfügbar."
		if defeated
		else "Der NPC bleibt erhalten, ist aber bis zur Reaktivierung nicht verfügbar."
	)
	_lifecycle_dialog.ok_button_text = "Reaktivieren" if defeated else "Als besiegt markieren"
	_lifecycle_dialog.popup_centered()


func _confirm_lifecycle() -> void:
	var record: Dictionary = _selected_detail.get("record", {})
	if record.get("kind", "") != "npc":
		return
	var next_status := "active" if record.get("lifecycle_status", "") == "defeated" else "defeated"
	var started: Dictionary = command_controller.set_npc_lifecycle(str(record["record_id"]), next_status)
	if not started.get("ok", false):
		_show_command_failure(started)


func _prepare_typed_editor(record: Dictionary, kind: String) -> void:
	_npc_editor_fields.visible = kind == "npc"
	_faction_editor_fields.visible = kind == "faction"
	_place_editor_fields.visible = kind == "place"
	_reference_values.clear()
	if kind == "npc":
		_record_appearance.text = str(record.get("appearance", ""))
		_record_behavior.text = str(record.get("behavior", ""))
		_record_history.text = str(record.get("history", ""))
		_record_lifecycle.select(1 if record.get("lifecycle_status", "active") == "defeated" else 0)
		_record_npc_disposition.value = float(record.get("disposition_modifier", 0))
		_reference_values["creature_id"] = _as_reference_array(record.get("creature_id", ""))
		_reference_values["faction_id"] = _as_reference_array(record.get("faction_id", ""))
		_reference_values["last_place_id"] = _as_reference_array(record.get("last_place_id", ""))
	elif kind == "faction":
		_record_faction_disposition.value = float(record.get("disposition_base", 0))
		_reference_values["primary_encounter_table_id"] = _as_reference_array(
			record.get("primary_encounter_table_id", "")
		)
		_faction_inventory_editor.set_inventory(
			record.get("inventory_limits", {}),
			_selected_detail.get("inventory_labels", {})
		)
	elif kind == "place":
		_reference_values["faction_ids"] = record.get("faction_ids", []).duplicate()
		_reference_values["encounter_table_ids"] = record.get("encounter_table_ids", []).duplicate()
	_render_reference_summaries()


func _open_reference_picker(field_key: String, label_text: String, kind: String, multi: bool) -> void:
	_reference_picker.open_picker(
		field_key,
		"%s auswählen" % label_text,
		kind,
		_reference_values.get(field_key, []).duplicate(),
		multi
	)


func _open_faction_inventory_picker(selected_ids: Array) -> void:
	_reference_picker.open_picker(
		"inventory_limits",
		"Finite Monsterbestände auswählen",
		"creature",
		selected_ids,
		true
	)


func _on_references_selected(field_key: String, reference_ids: Array) -> void:
	if field_key == "inventory_limits":
		_faction_inventory_editor.apply_selection(
			reference_ids,
			Callable(_reference_picker, "reference_label")
		)
		return
	_reference_values[field_key] = reference_ids.duplicate()
	_render_reference_summaries()


func _render_reference_summaries() -> void:
	for field_key_value in _reference_summaries:
		var field_key := str(field_key_value)
		var summary: Label = _reference_summaries[field_key]
		var values: Array = _reference_values.get(field_key, [])
		summary.text = "Nicht verknüpft" if values.is_empty() else ", ".join(PackedStringArray(values))


func _as_reference_array(value: Variant) -> Array:
	var reference_id := str(value)
	return [] if reference_id.is_empty() else [reference_id]


func _single_reference(field_key: String) -> String:
	var values: Array = _reference_values.get(field_key, [])
	return "" if values.is_empty() else str(values[0])


func _on_trash_toggled(enabled: bool) -> void:
	var section := _section(_active_section_id)
	if not section.get("trashable", false):
		return
	var state: Dictionary = _section_state[_active_section_id]
	state["trash"] = enabled
	state["selected_id"] = ""
	state["selected_row"] = {}
	state["page"] = 0
	state["status"] = "uninitialized"
	_section_state[_active_section_id] = state
	_create_button.disabled = enabled or _any_command_busy()
	_reset_detail()
	_submit_current_query()


func _on_command_started(request: Dictionary) -> void:
	if _is_narrative_operation(str(request.get("operation", ""))):
		_create_button.disabled = true
		_set_action_buttons_disabled(true)
		return
	_command_section_id = _active_section_id
	var state: Dictionary = _section_state[_command_section_id]
	state["notice"] = "Änderung wird gespeichert …"
	_section_state[_command_section_id] = state
	_create_button.disabled = true
	_set_action_buttons_disabled(true)
	_render_state()


func _on_command_completed(result: Dictionary) -> void:
	if _is_narrative_operation(str(result.get("request", {}).get("operation", ""))):
		var active_state: Dictionary = _section_state[_active_section_id]
		_create_button.disabled = bool(active_state["trash"])
		_set_action_buttons_disabled(_any_command_busy())
		return
	var section_id := _command_section_id if _section_state.has(_command_section_id) else _active_section_id
	var state: Dictionary = _section_state[section_id]
	if not result.get("ok", false):
		state["notice"] = str(result.get("error", "Änderung ist fehlgeschlagen."))
	else:
		var status := str(result.get("status", "completed"))
		var operation := str(result.get("request", {}).get("operation", ""))
		state["notice"] = {
			"created": "Eintrag erstellt.",
			"updated": "Änderungen gespeichert.",
			"trashed": "Eintrag in den Papierkorb verschoben.",
			"restored": "Eintrag wiederhergestellt.",
		}.get(status, "Änderung gespeichert.")
		if operation not in ["update", "set_npc_lifecycle"]:
			state["selected_id"] = ""
			state["selected_row"] = {}
	state["status"] = "uninitialized"
	_section_state[section_id] = state
	_command_section_id = ""
	var active_state: Dictionary = _section_state[_active_section_id]
	_create_button.disabled = bool(active_state["trash"]) or _any_command_busy()
	if section_id == _active_section_id and is_visible_in_tree():
		_reset_detail()
		_submit_current_query()


func _show_command_failure(result: Dictionary) -> void:
	var state: Dictionary = _section_state[_active_section_id]
	state["notice"] = str(result.get("error", "Änderung ist fehlgeschlagen."))
	_section_state[_active_section_id] = state
	_render_state()


func _add_message(message: String) -> void:
	var label := Label.new()
	label.text = message
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.add_theme_color_override("font_color", QUIET_INK)
	_result_list.add_child(label)


func _section(section_id: String) -> Dictionary:
	for section in SECTIONS:
		if section["id"] == section_id:
			return section
	return {}


func _row_id(row: Dictionary) -> String:
	return str(row.get("reference_id", row.get("definition_id", "")))


func _kind_label(kind: String) -> String:
	return {
		"creature": "Monster",
		"item": "Item",
		"npc": "NPC",
		"faction": "Fraktion",
		"place": "Ort",
		"encounter_table": "Encounter-Tabelle",
		"encounter_plan": "Gespeicherter Encounter",
	}.get(kind, kind)


func _escape_bbcode(value: String) -> String:
	return value.replace("[", "[lb]")


func _selected_row() -> Dictionary:
	var state: Dictionary = _section_state[_active_section_id]
	return state.get("selected_row", {}).duplicate(true)


func _render_selected_detail() -> void:
	var row := _selected_row()
	if row.is_empty():
		_reset_detail()
	else:
		_select_row(row)


func _reset_detail() -> void:
	if _detail == null:
		return
	_detail.text = "Wähle einen Eintrag, um seine Referenz zu prüfen."
	_detail_actions.visible = false
	_selected_detail.clear()
	if detail_controller != null:
		detail_controller.cancel_all()
	if encounter_table_detail_controller != null:
		encounter_table_detail_controller.cancel_all()
	if encounter_plan_detail_controller != null:
		encounter_plan_detail_controller.cancel_all()
	if item_detail_controller != null:
		item_detail_controller.cancel_all()
	if creature_detail_controller != null:
		creature_detail_controller.cancel_all()
	if _narrative_threads != null:
		_narrative_threads.clear_subject()


func _set_action_buttons_disabled(disabled: bool) -> void:
	_edit_button.disabled = disabled
	_trash_button.disabled = disabled
	_restore_button.disabled = disabled
	_lifecycle_button.disabled = disabled


func _any_command_busy() -> bool:
	return (
		(command_controller != null and command_controller.busy())
		or (encounter_table_command_controller != null and encounter_table_command_controller.busy())
		or (encounter_plan_command_controller != null and encounter_plan_command_controller.busy())
	)


func _format_encounter_plan_detail(record: Dictionary, current_labels: Dictionary = {}) -> String:
	var total := 0
	for entry in record.get("roster", []):
		total += int(entry.get("quantity", 0))
	var lines: Array[String] = [
		"[font_size=22]%s[/font_size]" % _escape_bbcode(str(record["name"])),
		_escape_bbcode(str(record["record_id"])),
		"%d Monster · %d Arten" % [total, record.get("roster", []).size()],
	]
	if not str(record.get("generated_label", "")).is_empty():
		lines.append("Generiert: %s" % _escape_bbcode(str(record["generated_label"])))
	lines.append("")
	lines.append("[color=#d2a743]ROSTER-MANIFEST[/color]")
	for entry in record.get("roster", []):
		var creature_id := str(entry["creature_id"])
		var last_known_name := str(entry["last_known_name"])
		var display_name := str(current_labels.get(creature_id, last_known_name))
		lines.append("× %d   %s · %s" % [
			int(entry["quantity"]),
			_escape_bbcode(display_name),
			_escape_bbcode(creature_id),
		])
	return "\n".join(lines)


func _format_item_detail(item: Dictionary) -> String:
	var classification := PackedStringArray([str(item["category"])])
	if not str(item["subcategory"]).is_empty():
		classification.append(str(item["subcategory"]))
	if bool(item["magic"]):
		classification.append("magisch")
	if not str(item["rarity"]).is_empty():
		classification.append(str(item["rarity"]))
	if bool(item["attunement"]):
		classification.append("Einstimmung erforderlich")
	var lines: Array[String] = [
		"[font_size=22]%s[/font_size]" % _escape_bbcode(str(item["name"])),
		_escape_bbcode(str(item["source_key"])),
		" · ".join(classification),
	]
	var facts := PackedStringArray()
	if not str(item["cost_display"]).is_empty():
		facts.append("Kosten %s" % str(item["cost_display"]))
	if item["weight"] != null:
		facts.append("Gewicht %s lb" % str(item["weight"]))
	if not str(item["damage"]).is_empty():
		facts.append("Schaden %s" % str(item["damage"]))
	if not str(item["armor_class"]).is_empty():
		facts.append(str(item["armor_class"]))
	if not facts.is_empty():
		lines.append("")
		lines.append("[color=#d2a743]WERTE[/color]")
		lines.append(" · ".join(facts))
	if not item["properties"].is_empty():
		lines.append("")
		lines.append("[color=#d2a743]EIGENSCHAFTEN[/color]")
		lines.append(" · ".join(PackedStringArray(item["properties"])))
	_append_named_text(lines, "Beschreibung", str(item["description"]))
	lines.append("")
	lines.append("[color=#d2a743]QUELLE[/color]")
	lines.append("%s · %s" % [
		_escape_bbcode(str(item["source_version"])),
		_escape_bbcode(str(item["source_url"])).replace("/", "/​"),
	])
	return "\n".join(lines)


func _format_creature_detail(creature: Dictionary) -> String:
	var classification := PackedStringArray([
		str(creature["size"]),
		str(creature["creature_type"]) + (" (%s)" % creature["subtype"] if not str(creature["subtype"]).is_empty() else ""),
	])
	if not str(creature["alignment"]).is_empty():
		classification.append(str(creature["alignment"]))
	var lines: Array[String] = [
		"[font_size=24]%s[/font_size]" % _escape_bbcode(str(creature["name"])),
		_escape_bbcode(str(creature["source_key"])),
		" · ".join(classification),
		"",
		"[color=#d2a743]KERNWERTE[/color]",
		"RK %d%s · TP %d%s" % [
			int(creature["armor_class"]),
			" · %s" % creature["armor_detail"] if not str(creature["armor_detail"]).is_empty() else "",
			int(creature["hit_points"]),
			" (%s)" % creature["hit_dice"] if not str(creature["hit_dice"]).is_empty() else "",
		],
		"Initiative %s · HG %s · %d EP" % [
			_signed_number(int(creature["initiative_bonus"])),
			str(creature["challenge_rating"]),
			int(creature["xp"]),
		],
		"Bewegung %s" % _format_speed(creature["speed"]),
		"",
		"[color=#d2a743]ATTRIBUTE[/color]",
		_format_abilities(creature["ability_scores"]),
	]
	_append_map_line(lines, "Rettungswürfe", creature["saving_throws"])
	_append_map_line(lines, "Fertigkeiten", creature["skills"])
	if int(creature.get("passive_perception", 0)) > 0:
		lines.append("Passive Wahrnehmung %d" % int(creature["passive_perception"]))
	if not str(creature["languages"]).is_empty():
		lines.append("Sprachen %s" % _escape_bbcode(str(creature["languages"])))
	if not creature["environments"].is_empty():
		lines.append("Umwelt %s" % " · ".join(PackedStringArray(creature["environments"])))
	var defenses: Dictionary = creature["resistances_and_immunities"]
	for entry in [
		["Schadensresistenzen", "damage_resistances"],
		["Schadensimmunitäten", "damage_immunities"],
		["Verwundbarkeiten", "damage_vulnerabilities"],
		["Zustandsimmunitäten", "condition_immunities"],
	]:
		if not defenses.get(entry[1], []).is_empty():
			lines.append("%s %s" % [entry[0], " · ".join(PackedStringArray(defenses[entry[1]]))])
	_append_creature_entries(lines, "EIGENSCHAFTEN", creature["traits"])
	var grouped_actions := {
		"ACTION": ["AKTIONEN", []],
		"BONUS_ACTION": ["BONUSAKTIONEN", []],
		"REACTION": ["REAKTIONEN", []],
		"LEGENDARY_ACTION": ["LEGENDÄRE AKTIONEN", []],
	}
	for action in creature["actions"]:
		var action_type := str(action.get("action_type", "ACTION"))
		if not grouped_actions.has(action_type):
			action_type = "ACTION"
		grouped_actions[action_type][1].append(action)
	for action_type in ["ACTION", "BONUS_ACTION", "REACTION", "LEGENDARY_ACTION"]:
		_append_creature_entries(lines, grouped_actions[action_type][0], grouped_actions[action_type][1])
	lines.append("")
	lines.append("[color=#d2a743]QUELLE[/color]")
	lines.append("%s · %s" % [
		_escape_bbcode(str(creature["source_version"])),
		" / ".join(PackedStringArray(creature["source_licenses"])),
	])
	lines.append(_escape_bbcode(str(creature["source_url"])).replace("/", "/​"))
	return "\n".join(lines)


func _format_speed(speed: Dictionary) -> String:
	var values := PackedStringArray()
	var unit := str(speed.get("unit", "feet"))
	for key in ["walk", "fly", "swim", "climb", "burrow", "crawl"]:
		if float(speed.get(key, 0)) > 0.0:
			values.append("%s %s %s" % [key.capitalize(), speed[key], unit])
	if bool(speed.get("hover", false)):
		values.append("schwebend")
	return " · ".join(values) if not values.is_empty() else "–"


func _format_abilities(scores: Dictionary) -> String:
	var values := PackedStringArray()
	for entry in [["ST", "strength"], ["GE", "dexterity"], ["KO", "constitution"], ["IN", "intelligence"], ["WE", "wisdom"], ["CH", "charisma"]]:
		var score := int(scores.get(entry[1], 0))
		values.append("%s %d (%s)" % [entry[0], score, _signed_number(int(floor((score - 10) / 2.0)))])
	return " · ".join(values)


func _append_map_line(lines: Array[String], label_text: String, values: Dictionary) -> void:
	if values.is_empty():
		return
	var parts := PackedStringArray()
	var keys: Array = values.keys()
	keys.sort()
	for key in keys:
		parts.append("%s %s" % [str(key).capitalize(), _signed_number(int(values[key]))])
	lines.append("%s %s" % [label_text, " · ".join(parts)])


func _append_creature_entries(lines: Array[String], heading: String, entries: Array) -> void:
	if entries.is_empty():
		return
	lines.append("")
	lines.append("[color=#d2a743]%s[/color]" % heading)
	for entry in entries:
		var suffix := ""
		if int(entry.get("legendary_action_cost", 0)) > 1:
			suffix = " (%d Aktionen)" % int(entry["legendary_action_cost"])
		lines.append("[b]%s%s.[/b] %s" % [
			_escape_bbcode(str(entry["name"])),
			suffix,
			_escape_bbcode(str(entry["desc"])),
		])


func _format_encounter_table_detail(record: Dictionary, entry_labels: Dictionary = {}) -> String:
	var lines: Array[String] = [
		"[font_size=22]%s[/font_size]" % _escape_bbcode(str(record["name"])),
		_escape_bbcode(str(record["record_id"])),
		"%d gewichtete Monster" % record.get("entries", []).size(),
	]
	_append_named_text(lines, "Beschreibung", str(record.get("description", "")))
	if not str(record.get("linked_loot_table_id", "")).is_empty():
		lines.append("")
		lines.append("Verknüpfte Loot-Tabelle: %s" % _display_reference(str(record["linked_loot_table_id"])))
	if not record.get("entries", []).is_empty():
		lines.append("")
		lines.append("[color=#d2a743]GEWICHTETE QUELLEN[/color]")
		for entry in record["entries"]:
			var creature_id := str(entry["creature_id"])
			var display_name := str(entry_labels.get(creature_id, creature_id))
			lines.append("%s · %s · Gewicht %d" % [
				_escape_bbcode(display_name),
				_escape_bbcode(creature_id),
				int(entry["weight"]),
			])
	return "\n".join(lines)


func _format_worldplanner_detail(record: Dictionary, inventory_labels: Dictionary = {}) -> String:
	var lines: Array[String] = [
		"[font_size=22]%s[/font_size]" % _escape_bbcode(str(record["name"])),
		_escape_bbcode(str(record["record_id"])),
	]
	match record["kind"]:
		"npc":
			lines.append("NPC · %s · Disposition %s" % [
				"Aktiv" if record["lifecycle_status"] == "active" else "Besiegt",
				_signed_number(int(record["disposition_modifier"])),
			])
			lines.append("Statblock: %s" % _display_reference(str(record["creature_id"])))
			lines.append("Fraktion: %s" % _display_reference(str(record["faction_id"])))
			lines.append("Letzter Ort: %s" % _display_reference(str(record["last_place_id"])))
			_append_named_text(lines, "Erscheinung", str(record["appearance"]))
			_append_named_text(lines, "Verhalten", str(record["behavior"]))
			_append_named_text(lines, "Geschichte", str(record["history"]))
		"faction":
			lines.append("Fraktion · Disposition %s" % _signed_number(int(record["disposition_base"])))
			lines.append("Primäre Encounter-Tabelle: %s" % _display_reference(str(record["primary_encounter_table_id"])))
			lines.append("Inventarlimits: %s" % _format_inventory(record["inventory_limits"], inventory_labels))
		"place":
			lines.append("Ort")
			lines.append("Fraktionen: %s" % _format_references(record["faction_ids"]))
			lines.append("Encounter-Tabellen: %s" % _format_references(record["encounter_table_ids"]))
	_append_named_text(lines, "Notizen", str(record["notes"]))
	return "\n".join(lines)


func _append_named_text(lines: Array[String], label: String, value: String) -> void:
	if value.is_empty():
		return
	lines.append("")
	lines.append("[color=#d2a743]%s[/color]" % label.to_upper())
	lines.append(_escape_bbcode(value))


func _display_reference(value: String) -> String:
	return "–" if value.is_empty() else _escape_bbcode(value)


func _format_references(values: Array) -> String:
	if values.is_empty():
		return "–"
	var rendered := PackedStringArray()
	for value in values:
		rendered.append(_escape_bbcode(str(value)))
	return ", ".join(rendered)


func _format_inventory(value: Dictionary, labels: Dictionary = {}) -> String:
	if value.is_empty():
		return "unbegrenzt"
	var keys: Array = value.keys()
	keys.sort()
	var rendered := PackedStringArray()
	for key in keys:
		var limit = value[key]
		var display_name := str(labels.get(key, key))
		rendered.append("%s: %s" % [_escape_bbcode(display_name), "unbegrenzt" if limit == null else str(int(limit))])
	return ", ".join(rendered)


func _signed_number(value: int) -> String:
	return "+%d" % value if value > 0 else str(value)


func _with_notice(base: String, state: Dictionary) -> String:
	var notice := str(state.get("notice", ""))
	return base if notice.is_empty() else "%s · %s" % [base, notice]


func _is_narrative_operation(operation: String) -> bool:
	return operation in [
		"create_narrative", "update_narrative", "set_narrative_state",
		"trash_narrative", "restore_narrative",
	]


func _notification(what: int) -> void:
	if what == NOTIFICATION_VISIBILITY_CHANGED and is_node_ready():
		if visible:
			select_section(_active_section_id)
		elif browse_controller != null:
			browse_controller.cancel_all()
