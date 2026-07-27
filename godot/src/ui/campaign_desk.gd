class_name CampaignDesk
extends Control

const FileCampaignRegistry = preload("res://godot/src/platform/persistence/file_campaign_registry.gd")
const CampaignPortabilityController = preload("res://godot/src/app/campaign_portability_controller.gd")
const CampaignRuntimeTransitionController = preload("res://godot/src/app/campaign_runtime_transition_controller.gd")
const CampaignTransferDocket = preload("res://godot/src/ui/campaign_transfer_docket.gd")
const DefinitionConflictLedger = preload("res://godot/src/ui/definition_conflict_ledger.gd")
const RouteStitch = preload("res://godot/src/ui/route_stitch.gd")

const NIGHT_INK := Color("#0a1114")
const DEEP_SLATE := Color("#152a32")
const MAP_TEAL := Color("#2b5960")
const VELLUM_MIST := Color("#d9e3dd")
const QUIET_INK := Color("#91a5a2")
const BRASS_MARK := Color("#d2a743")
const EMBER_RUST := Color("#b75d3d")

var registry: FileCampaignRegistry
var runtime_coordinator
var portability_controller: CampaignPortabilityController
var runtime_transition_controller: CampaignRuntimeTransitionController
var data_root := "user://salt-marcher"
var _state: Dictionary = {}
var _name_input: LineEdit
var _campaign_list: VBoxContainer
var _status: Label
var _create_button: Button
var _transfer_docket: CampaignTransferDocket
var _conflict_ledger: DefinitionConflictLedger
var _transfer_busy := false
var _transition_busy := false


func _ready() -> void:
	if registry == null:
		registry = FileCampaignRegistry.new(data_root)
	if portability_controller == null:
		portability_controller = CampaignPortabilityController.new(data_root, registry)
		add_child(portability_controller)
	portability_controller.operation_started.connect(_on_transfer_started)
	portability_controller.progress_changed.connect(_on_transfer_progress)
	portability_controller.operation_completed.connect(_on_transfer_completed)
	if runtime_coordinator != null and runtime_transition_controller == null:
		runtime_transition_controller = CampaignRuntimeTransitionController.new(runtime_coordinator)
		add_child(runtime_transition_controller)
	if runtime_transition_controller != null:
		runtime_transition_controller.transition_started.connect(_on_runtime_transition_started)
		runtime_transition_controller.transition_completed.connect(_on_runtime_transition_completed)
		runtime_transition_controller.transition_recovered.connect(_on_runtime_transition_recovered)
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	theme = _build_theme()
	_build_surface()
	_reload()


func _process(_delta: float) -> void:
	if runtime_coordinator != null:
		runtime_coordinator.flush_backup_notifications()


func _build_surface() -> void:
	var backdrop := ColorRect.new()
	backdrop.color = NIGHT_INK
	backdrop.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(backdrop)

	var wash := ColorRect.new()
	wash.color = Color(DEEP_SLATE, 0.72)
	wash.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	backdrop.add_child(wash)

	var page_margin := MarginContainer.new()
	page_margin.add_theme_constant_override("margin_left", 52)
	page_margin.add_theme_constant_override("margin_right", 52)
	page_margin.add_theme_constant_override("margin_top", 42)
	page_margin.add_theme_constant_override("margin_bottom", 42)
	page_margin.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(page_margin)

	var frame := PanelContainer.new()
	frame.add_theme_stylebox_override("panel", _panel_style(Color("#102127"), BRASS_MARK, 1, 12))
	page_margin.add_child(frame)

	var frame_margin := MarginContainer.new()
	frame_margin.add_theme_constant_override("margin_left", 34)
	frame_margin.add_theme_constant_override("margin_right", 34)
	frame_margin.add_theme_constant_override("margin_top", 30)
	frame_margin.add_theme_constant_override("margin_bottom", 30)
	frame.add_child(frame_margin)

	var route_layout := HBoxContainer.new()
	route_layout.add_theme_constant_override("separation", 28)
	frame_margin.add_child(route_layout)

	var route_mark := RouteStitch.new()
	route_layout.add_child(route_mark)

	var content := VBoxContainer.new()
	content.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	content.add_theme_constant_override("separation", 18)
	route_layout.add_child(content)

	var eyebrow := Label.new()
	eyebrow.text = "SALTMARCHER  /  CAMPAIGN ROUTE"
	eyebrow.add_theme_color_override("font_color", BRASS_MARK)
	eyebrow.add_theme_font_size_override("font_size", 13)
	content.add_child(eyebrow)

	var title := Label.new()
	title.text = "Welche Spielmappe liegt heute auf dem Tisch?"
	title.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	title.add_theme_font_override("font", _display_font())
	title.add_theme_font_size_override("font_size", 38)
	title.add_theme_color_override("font_color", VELLUM_MIST)
	content.add_child(title)

	var subtitle := Label.new()
	subtitle.text = "Öffne eine Campaign sofort oder beginne mit nur einem Namen. Bestätigte Arbeit wird automatisch lokal bewahrt."
	subtitle.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	subtitle.add_theme_color_override("font_color", QUIET_INK)
	content.add_child(subtitle)

	var divider := HSeparator.new()
	content.add_child(divider)

	var workbench := HBoxContainer.new()
	workbench.size_flags_vertical = Control.SIZE_EXPAND_FILL
	workbench.add_theme_constant_override("separation", 24)
	content.add_child(workbench)

	var campaign_column := VBoxContainer.new()
	campaign_column.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	campaign_column.size_flags_vertical = Control.SIZE_EXPAND_FILL
	campaign_column.add_theme_constant_override("separation", 10)
	workbench.add_child(campaign_column)

	var creation_label := Label.new()
	creation_label.text = "NEUE CAMPAIGN"
	creation_label.add_theme_color_override("font_color", QUIET_INK)
	creation_label.add_theme_font_size_override("font_size", 12)
	campaign_column.add_child(creation_label)

	var create_row := HBoxContainer.new()
	create_row.add_theme_constant_override("separation", 12)
	campaign_column.add_child(create_row)

	_name_input = LineEdit.new()
	_name_input.name = "CampaignNameInput"
	_name_input.placeholder_text = "Name der Campaign"
	_name_input.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_name_input.custom_minimum_size = Vector2(0, 48)
	_name_input.text_submitted.connect(func(_value: String) -> void: _create_campaign())
	_name_input.text_changed.connect(func(value: String) -> void:
		_create_button.disabled = value.strip_edges().is_empty() or _transfer_busy or _transition_busy or (_conflict_ledger != null and _conflict_ledger.is_presented())
	)
	create_row.add_child(_name_input)

	_create_button = Button.new()
	_create_button.name = "CreateCampaignButton"
	_create_button.text = "Campaign erstellen"
	_create_button.disabled = true
	_create_button.custom_minimum_size = Vector2(188, 48)
	_create_button.add_theme_stylebox_override("normal", _panel_style(BRASS_MARK, BRASS_MARK, 1, 6))
	_create_button.add_theme_stylebox_override("hover", _panel_style(Color("#e0ba59"), Color("#e0ba59"), 1, 6))
	_create_button.add_theme_stylebox_override("pressed", _panel_style(Color("#b88d31"), Color("#b88d31"), 1, 6))
	_create_button.add_theme_color_override("font_color", NIGHT_INK)
	_create_button.add_theme_color_override("font_hover_color", NIGHT_INK)
	_create_button.add_theme_color_override("font_pressed_color", NIGHT_INK)
	_create_button.pressed.connect(_create_campaign)
	create_row.add_child(_create_button)

	var list_label := Label.new()
	list_label.text = "DEINE CAMPAIGNS"
	list_label.add_theme_color_override("font_color", QUIET_INK)
	list_label.add_theme_font_size_override("font_size", 12)
	campaign_column.add_child(list_label)

	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.custom_minimum_size = Vector2(0, 180)
	campaign_column.add_child(scroll)

	_campaign_list = VBoxContainer.new()
	_campaign_list.name = "CampaignList"
	_campaign_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_campaign_list.add_theme_constant_override("separation", 8)
	scroll.add_child(_campaign_list)

	_status = Label.new()
	_status.name = "CampaignStatus"
	_status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_status.add_theme_color_override("font_color", QUIET_INK)
	_status.add_theme_font_size_override("font_size", 14)
	campaign_column.add_child(_status)

	_transfer_docket = CampaignTransferDocket.new(
		_panel_style(Color("#0d1b20"), MAP_TEAL, 1, 8),
		_display_font(),
		BRASS_MARK,
		QUIET_INK
	)
	_transfer_docket.export_path_selected.connect(_start_export)
	_transfer_docket.import_path_selected.connect(_start_import)
	_transfer_docket.cancel_requested.connect(_cancel_active_transfer)
	workbench.add_child(_transfer_docket)

	_conflict_ledger = DefinitionConflictLedger.new(
		_panel_style(Color("#102127"), BRASS_MARK, 2, 10),
		_display_font(),
		BRASS_MARK,
		QUIET_INK
	)
	_conflict_ledger.resolve_requested.connect(_resolve_conflicting_import)
	_conflict_ledger.discard_requested.connect(_discard_conflicting_import)
	_conflict_ledger.cancel_requested.connect(_cancel_active_transfer)
	add_child(_conflict_ledger)


func _reload() -> void:
	_state = registry.load_state()
	_render_state()


func _render_state() -> void:
	for child in _campaign_list.get_children():
		child.queue_free()
	if not _state.get("ok", false):
		_refresh_transfer_controls()
		_set_status(_state.get("error", "Campaigns konnten nicht geladen werden."), true)
		return

	var campaigns: Array = _state["campaigns"]
	if campaigns.is_empty():
		var empty := Label.new()
		empty.text = "Noch keine Campaign. Ein Name genügt, um spielbereit zu beginnen."
		empty.add_theme_color_override("font_color", QUIET_INK)
		_campaign_list.add_child(empty)
		_refresh_transfer_controls()
		_set_status("Bereit für deine erste Campaign.", false)
		_name_input.grab_focus.call_deferred()
		return

	for campaign in campaigns:
		var is_active: bool = campaign["id"] == _state["active_campaign_id"]
		var selected_id := str(campaign["id"])
		var row := Button.new()
		row.alignment = HORIZONTAL_ALIGNMENT_LEFT
		row.custom_minimum_size = Vector2(0, 58)
		row.text = ("AKTUELLE ROUTE   " if is_active else "CAMPAIGN          ") + campaign["name"]
		row.disabled = is_active
		if is_active:
			row.add_theme_stylebox_override("disabled", _panel_style(Color("#24464b"), BRASS_MARK, 2, 6))
			row.add_theme_color_override("font_disabled_color", VELLUM_MIST)
		else:
			row.pressed.connect(func() -> void: _activate_campaign(selected_id))
		_campaign_list.add_child(row)

	if _state.get("recovered", false):
		_set_status(_state["recovery_message"], true)
	else:
		_set_status("%d Campaigns lokal verfügbar." % campaigns.size(), false)
	_refresh_transfer_controls()


func _create_campaign() -> void:
	if runtime_transition_controller != null:
		var started := runtime_transition_controller.create_and_switch(
			_name_input.text,
			int(_state["generation"])
		)
		if not started.get("ok", false):
			_set_status(started.get("error", "Campaign konnte nicht erstellt werden."), true)
			_name_input.grab_focus()
			return
		return
	var result: Dictionary
	if runtime_coordinator != null:
		result = runtime_coordinator.create_and_switch(_name_input.text, int(_state["generation"]))
	else:
		result = registry.create_campaign(_name_input.text, int(_state["generation"]))
	if not result.get("ok", false):
		_set_status(result.get("error", "Campaign konnte nicht erstellt werden."), true)
		_name_input.grab_focus()
		return
	_name_input.clear()
	_state = result.get("registry_state", result.get("state", {}))
	_render_state()
	_set_status("Campaign erstellt und als aktuelle Route geöffnet.", false)


func _activate_campaign(campaign_id: String) -> void:
	if runtime_transition_controller != null:
		var started := runtime_transition_controller.switch_to(
			campaign_id,
			int(_state["generation"])
		)
		if not started.get("ok", false):
			_set_status(started.get("error", "Campaign konnte nicht gewechselt werden."), true)
			return
		return
	var result: Dictionary
	if runtime_coordinator != null:
		result = runtime_coordinator.switch_to(campaign_id, int(_state["generation"]))
	else:
		result = registry.activate_campaign(campaign_id, int(_state["generation"]))
	if not result.get("ok", false):
		_set_status(result.get("error", "Campaign konnte nicht gewechselt werden."), true)
		if result.get("status", "") == "stale":
			_reload()
		return
	_state = result.get("registry_state", result.get("state", {}))
	_render_state()
	_set_status("Campaign gewechselt. Die Route ist wieder aktiv.", false)


func start_export_to_path(destination_path: String) -> Dictionary:
	if runtime_transition_controller != null and runtime_transition_controller.is_active():
		return {"ok": false, "status": "transition_busy", "error": "Campaign-Wechsel oder -Erstellung läuft noch."}
	var campaign_id := str(_state.get("active_campaign_id", ""))
	if campaign_id.is_empty():
		return {"ok": false, "status": "no_active_campaign", "error": "Keine aktive Campaign kann exportiert werden."}
	return portability_controller.export_campaign(campaign_id, destination_path)


func start_import_from_path(bundle_path: String) -> Dictionary:
	if runtime_transition_controller != null and runtime_transition_controller.is_active():
		return {"ok": false, "status": "transition_busy", "error": "Campaign-Wechsel oder -Erstellung läuft noch."}
	return portability_controller.import_campaign(bundle_path, int(_state.get("generation", -1)))


func _start_export(destination_path: String) -> void:
	var started := start_export_to_path(destination_path)
	if not started.get("ok", false):
		_set_status(started.get("error", "Campaign-Export konnte nicht gestartet werden."), true)


func _start_import(bundle_path: String) -> void:
	var started := start_import_from_path(bundle_path)
	if not started.get("ok", false):
		_set_status(started.get("error", "Campaign-Import konnte nicht gestartet werden."), true)


func _cancel_active_transfer() -> void:
	var cancellation := portability_controller.cancel_active()
	if cancellation.get("ok", false):
		_transfer_docket.detail("Abbruch angefordert; bereits veröffentlichte Wahrheit bleibt bestehen.")
	else:
		_set_status(cancellation.get("error", "Transfer konnte nicht abgebrochen werden."), true)


func _on_transfer_started(kind: String) -> void:
	_set_transfer_busy(true)
	_transfer_docket.reset_progress({
		"export": "Vollständiger Campaign-Export läuft.",
		"import": "Campaign-Paket wird isoliert geprüft.",
		"resolve_import": "Konfliktentscheidungen werden atomar angewendet.",
		"discard_import": "Staged Import wird verworfen.",
	}.get(kind, "Campaign-Transfer läuft."))


func _on_runtime_transition_started(kind: String) -> void:
	_transition_busy = true
	_refresh_busy_state()
	_set_status(
		"Campaign wird erstellt; akzeptierte Schreibarbeit wird zuerst abgeschlossen."
		if kind == "create"
		else "Campaign-Wechsel wartet auf bereits akzeptierte Schreibarbeit.",
		false
	)


func _on_runtime_transition_completed(kind: String, result: Dictionary) -> void:
	_transition_busy = runtime_transition_controller != null and runtime_transition_controller.is_active()
	if not result.get("ok", false):
		_refresh_busy_state()
		_set_status(result.get("error", "Campaign-Übergang ist fehlgeschlagen."), true)
		if result.get("status", "") == "stale":
			_reload()
		elif kind == "create":
			_name_input.grab_focus()
		return
	if kind == "create":
		_name_input.clear()
	_state = result.get("registry_state", result.get("state", {}))
	_render_state()
	_set_status(
		"Campaign erstellt und als aktuelle Route geöffnet."
		if kind == "create"
		else "Campaign gewechselt. Die Route ist wieder aktiv.",
		false
	)


func _on_runtime_transition_recovered(result: Dictionary) -> void:
	_transition_busy = false
	_refresh_busy_state()
	_set_status(
		"Quell-Campaign ist nach dem Switch-Timeout wieder schreibbereit. Der Wechsel kann erneut versucht werden."
		if result.get("ok", false)
		else result.get("error", "Quell-Campaign konnte nach dem Timeout nicht fortgesetzt werden."),
		not result.get("ok", false)
	)


func _on_transfer_progress(progress: Dictionary) -> void:
	_transfer_docket.show_progress(progress)


func _on_transfer_completed(kind: String, result: Dictionary) -> void:
	_set_transfer_busy(false)
	if kind == "import" and result.get("status", "") == "definition_conflicts":
		_show_definition_conflicts(result)
		_set_status("Import wartet auf deine Shared-Definition-Entscheidungen.", true)
		return
	if kind == "discard_import":
		if result.get("ok", false):
			_hide_definition_conflicts()
			_set_status("Campaign-Import wurde verworfen; vorhandene Daten blieben unverändert.", false)
		else:
			_set_status(result.get("error", "Staged Import konnte nicht verworfen werden."), true)
		return
	if not result.get("ok", false):
		var cancelled: bool = result.get("status", "") == "cancelled"
		_set_status(
			result.get("error", "Campaign-Transfer ist fehlgeschlagen."),
			not cancelled
		)
		if cancelled:
			_transfer_docket.detail("Transfer abgebrochen; es wurde keine neue Wahrheit veröffentlicht.")
		return
	match kind:
		"export":
			_transfer_docket.complete_progress("Vollständiges Transferpaket wurde geschrieben.")
			_set_status("Campaign vollständig exportiert: %s" % result.get("path", ""), false)
		"import", "resolve_import":
			_hide_definition_conflicts()
			_reload()
			_transfer_docket.complete_progress("Campaign und erforderliche Definitionen sind lokal verfügbar.")
			_set_status("Campaign als unabhängige Mappe importiert.", false)


func _show_definition_conflicts(result: Dictionary) -> void:
	_conflict_ledger.present(result)
	_refresh_transfer_controls()


func _resolve_conflicting_import(import_id: String, decisions: Dictionary) -> void:
	var started := portability_controller.resolve_import(
		import_id,
		int(_state.get("generation", -1)),
		decisions
	)
	if not started.get("ok", false):
		_set_status(started.get("error", "Konfliktauflösung konnte nicht gestartet werden."), true)


func _discard_conflicting_import(import_id: String) -> void:
	var started := portability_controller.discard_import(import_id)
	if not started.get("ok", false):
		_set_status(started.get("error", "Import konnte nicht verworfen werden."), true)


func _hide_definition_conflicts() -> void:
	_conflict_ledger.dismiss()
	_refresh_transfer_controls()
	_transfer_docket.focus_import()


func _set_transfer_busy(busy: bool) -> void:
	_transfer_busy = busy
	_refresh_busy_state()


func _refresh_busy_state() -> void:
	var modal := _conflict_ledger != null and _conflict_ledger.is_presented()
	var busy := _transfer_busy or _transition_busy
	_transfer_docket.set_active_campaign(str(_state.get("active_campaign_id", "")))
	_transfer_docket.set_busy(busy, modal, _transfer_busy)
	_create_button.disabled = busy or modal or _name_input.text.strip_edges().is_empty()
	_name_input.editable = not busy and not modal
	_name_input.focus_mode = Control.FOCUS_NONE if busy or modal else Control.FOCUS_ALL
	for child in _campaign_list.get_children():
		if child is Button:
			child.disabled = busy or modal or child.text.begins_with("AKTUELLE ROUTE")
	if modal:
		_conflict_ledger.set_busy(busy)


func _refresh_transfer_controls() -> void:
	if _transfer_docket == null:
		return
	_transfer_busy = portability_controller != null and portability_controller.is_active()
	_transition_busy = runtime_transition_controller != null and runtime_transition_controller.is_active()
	_refresh_busy_state()


func _set_status(message: String, is_error: bool) -> void:
	_status.text = message
	_status.add_theme_color_override("font_color", EMBER_RUST if is_error else QUIET_INK)


func _build_theme() -> Theme:
	var result := Theme.new()
	var body_font := SystemFont.new()
	body_font.font_names = PackedStringArray(["Noto Sans", "Segoe UI", "Arial"])
	result.default_font = body_font
	result.default_font_size = 16
	result.set_color("font_color", "Label", VELLUM_MIST)
	result.set_color("font_color", "Button", VELLUM_MIST)
	result.set_color("font_hover_color", "Button", Color.WHITE)
	result.set_color("font_pressed_color", "Button", VELLUM_MIST)
	result.set_color("font_disabled_color", "Button", QUIET_INK)
	result.set_stylebox("normal", "Button", _panel_style(Color("#172f35"), MAP_TEAL, 1, 6))
	result.set_stylebox("hover", "Button", _panel_style(Color("#1d3b42"), Color("#56858a"), 1, 6))
	result.set_stylebox("pressed", "Button", _panel_style(Color("#0e252a"), BRASS_MARK, 1, 6))
	result.set_stylebox("focus", "Button", _focus_style())
	result.set_stylebox("normal", "LineEdit", _panel_style(Color("#0b191d"), MAP_TEAL, 1, 6))
	result.set_stylebox("focus", "LineEdit", _panel_style(Color("#0b191d"), BRASS_MARK, 2, 6))
	result.set_color("font_color", "LineEdit", VELLUM_MIST)
	result.set_color("font_placeholder_color", "LineEdit", QUIET_INK)
	result.set_color("caret_color", "LineEdit", BRASS_MARK)
	result.set_color("font_uneditable_color", "LineEdit", QUIET_INK)
	result.set_stylebox("separator", "HSeparator", _separator_style())
	return result


func _display_font() -> Font:
	var font := SystemFont.new()
	font.font_names = PackedStringArray(["Noto Serif", "Georgia", "Times New Roman"])
	font.font_weight = 600
	return font


func _panel_style(fill: Color, border: Color, width: int, radius: int) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = fill
	style.border_color = border
	style.set_border_width_all(width)
	style.set_corner_radius_all(radius)
	style.content_margin_left = 16
	style.content_margin_right = 16
	style.content_margin_top = 10
	style.content_margin_bottom = 10
	return style


func _focus_style() -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = Color.TRANSPARENT
	style.border_color = BRASS_MARK
	style.set_border_width_all(2)
	style.set_corner_radius_all(7)
	style.expand_margin_left = 2
	style.expand_margin_right = 2
	style.expand_margin_top = 2
	style.expand_margin_bottom = 2
	return style


func _separator_style() -> StyleBoxLine:
	var style := StyleBoxLine.new()
	style.color = Color(MAP_TEAL, 0.75)
	style.thickness = 1
	return style
