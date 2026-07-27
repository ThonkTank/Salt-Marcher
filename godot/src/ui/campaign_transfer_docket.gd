class_name CampaignTransferDocket
extends PanelContainer

## Focusable Campaign export/import controls and observable worker state.

signal export_path_selected(path: String)
signal import_path_selected(path: String)
signal cancel_requested

var _display_font: Font
var _brass: Color
var _quiet_ink: Color
var _active_campaign_id := ""
var _busy := false
var _modal_blocked := false
var _busy_cancellable := true
var _export_button: Button
var _import_button: Button
var _cancel_button: Button
var _progress: ProgressBar
var _detail: Label
var _export_dialog: FileDialog
var _import_dialog: FileDialog


func _init(panel_style: StyleBox, display_font: Font, brass: Color, quiet_ink: Color) -> void:
	add_theme_stylebox_override("panel", panel_style)
	_display_font = display_font
	_brass = brass
	_quiet_ink = quiet_ink


func _ready() -> void:
	name = "CampaignTransferDocket"
	custom_minimum_size = Vector2(330, 0)
	size_flags_vertical = Control.SIZE_EXPAND_FILL
	_build_surface()
	_build_dialogs()
	_refresh_controls()


func set_active_campaign(campaign_id: String) -> void:
	_active_campaign_id = campaign_id
	_refresh_controls()


func set_busy(busy: bool, modal_blocked: bool = false, cancellable: bool = true) -> void:
	_busy = busy
	_modal_blocked = modal_blocked
	_busy_cancellable = cancellable
	_refresh_controls()


func show_progress(progress: Dictionary) -> void:
	var total := maxi(1, int(progress.get("total", 1)))
	_progress.max_value = total
	_progress.value = clampi(int(progress.get("completed", 0)), 0, total)
	_detail.text = str(progress.get("message", "Campaign-Transfer läuft."))


func reset_progress(message: String) -> void:
	_progress.max_value = 1
	_progress.value = 0
	_detail.text = message


func complete_progress(message: String) -> void:
	_progress.value = _progress.max_value
	_detail.text = message


func detail(message: String) -> void:
	_detail.text = message


func focus_import() -> void:
	_import_button.grab_focus.call_deferred()


func progress_value() -> float:
	return _progress.value


func _build_surface() -> void:
	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 20)
	margin.add_theme_constant_override("margin_right", 20)
	margin.add_theme_constant_override("margin_top", 18)
	margin.add_theme_constant_override("margin_bottom", 18)
	add_child(margin)

	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 12)
	margin.add_child(column)

	var eyebrow := Label.new()
	eyebrow.text = "VERSIEGELTE TRANSFERAKTE"
	eyebrow.add_theme_color_override("font_color", _brass)
	eyebrow.add_theme_font_size_override("font_size", 12)
	column.add_child(eyebrow)

	var title := Label.new()
	title.text = "Campaign mitnehmen"
	title.add_theme_font_override("font", _display_font)
	title.add_theme_font_size_override("font_size", 24)
	column.add_child(title)

	var explanation := Label.new()
	explanation.text = "Exportiert die vollständige Mappe samt lokalen Medien und benötigten Definitionen. Import erzeugt immer eine unabhängige Campaign."
	explanation.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	explanation.add_theme_color_override("font_color", _quiet_ink)
	explanation.add_theme_font_size_override("font_size", 14)
	column.add_child(explanation)

	column.add_child(HSeparator.new())

	_export_button = Button.new()
	_export_button.name = "ExportCampaignButton"
	_export_button.text = "Aktuelle Campaign exportieren"
	_export_button.custom_minimum_size = Vector2(0, 46)
	_export_button.pressed.connect(_open_export_dialog)
	column.add_child(_export_button)

	_import_button = Button.new()
	_import_button.name = "ImportCampaignButton"
	_import_button.text = "Campaign-Paket importieren"
	_import_button.custom_minimum_size = Vector2(0, 46)
	_import_button.pressed.connect(func() -> void: _import_dialog.popup_centered_ratio(0.78))
	column.add_child(_import_button)

	_progress = ProgressBar.new()
	_progress.name = "CampaignTransferProgress"
	_progress.min_value = 0
	_progress.max_value = 1
	_progress.value = 0
	_progress.show_percentage = false
	_progress.custom_minimum_size = Vector2(0, 8)
	column.add_child(_progress)

	_detail = Label.new()
	_detail.name = "CampaignTransferDetail"
	_detail.text = "Bereit für einen vollständigen Transfer."
	_detail.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_detail.add_theme_color_override("font_color", _quiet_ink)
	_detail.add_theme_font_size_override("font_size", 13)
	column.add_child(_detail)

	_cancel_button = Button.new()
	_cancel_button.name = "CancelCampaignTransferButton"
	_cancel_button.text = "Laufenden Transfer abbrechen"
	_cancel_button.pressed.connect(func() -> void: cancel_requested.emit())
	column.add_child(_cancel_button)

	var boundary := Label.new()
	boundary.text = "Keine Campaign wird zusammengeführt oder still überschrieben."
	boundary.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	boundary.add_theme_color_override("font_color", _brass)
	boundary.add_theme_font_size_override("font_size", 12)
	boundary.size_flags_vertical = Control.SIZE_EXPAND_FILL
	boundary.vertical_alignment = VERTICAL_ALIGNMENT_BOTTOM
	column.add_child(boundary)


func _build_dialogs() -> void:
	_export_dialog = FileDialog.new()
	_export_dialog.name = "ExportCampaignDialog"
	_export_dialog.title = "Vollständige Campaign exportieren"
	_export_dialog.file_mode = FileDialog.FILE_MODE_SAVE_FILE
	_export_dialog.access = FileDialog.ACCESS_FILESYSTEM
	_export_dialog.filters = PackedStringArray(["*.saltmarcher ; SaltMarcher Campaign"])
	_export_dialog.file_selected.connect(func(path: String) -> void: export_path_selected.emit(path))
	add_child(_export_dialog)

	_import_dialog = FileDialog.new()
	_import_dialog.name = "ImportCampaignDialog"
	_import_dialog.title = "Campaign-Paket importieren"
	_import_dialog.file_mode = FileDialog.FILE_MODE_OPEN_FILE
	_import_dialog.access = FileDialog.ACCESS_FILESYSTEM
	_import_dialog.filters = PackedStringArray(["*.saltmarcher ; SaltMarcher Campaign"])
	_import_dialog.file_selected.connect(func(path: String) -> void: import_path_selected.emit(path))
	add_child(_import_dialog)


func _open_export_dialog() -> void:
	if _active_campaign_id.is_empty():
		return
	_export_dialog.current_file = "%s.saltmarcher" % _active_campaign_id
	_export_dialog.popup_centered_ratio(0.78)


func _refresh_controls() -> void:
	if _export_button == null:
		return
	_export_button.disabled = _busy or _modal_blocked or _active_campaign_id.is_empty()
	_import_button.disabled = _busy or _modal_blocked
	_cancel_button.disabled = not _busy or _modal_blocked or not _busy_cancellable
