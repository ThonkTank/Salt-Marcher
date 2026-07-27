class_name ImmutableJsonFiles
extends RefCounted

## Feature-neutral publication of immutable JSON documents through fresh files.

var _fault_injector: Callable


func _init(fault_injector: Callable = Callable()) -> void:
	_fault_injector = fault_injector


func write_new_json(path: String, value: Variant, operation: String = "write") -> Dictionary:
	var absolute_path := absolute(path)
	if FileAccess.file_exists(absolute_path):
		return failure("Ein unveränderliches Persistenzdokument würde überschrieben.")
	if _should_fail(operation, "before_open", path):
		return failure("Persistenzfehler vor dem Öffnen wurde ausgelöst.")

	var temporary_path := absolute_path + ".pending-%s" % new_identity()
	var file := FileAccess.open(temporary_path, FileAccess.WRITE)
	if file == null:
		return failure("Persistenzdokument konnte nicht geschrieben werden: %s" % error_string(FileAccess.get_open_error()))
	file.store_string(JSON.stringify(value, "  ", true, true) + "\n")
	file.flush()
	var write_error := file.get_error()
	file.close()
	if write_error != OK:
		_remove_if_present(temporary_path)
		return failure("Persistenzdokument konnte nicht vollständig geschrieben werden: %s" % error_string(write_error))
	if _should_fail(operation, "after_flush", path):
		_remove_if_present(temporary_path)
		return failure("Persistenzfehler nach dem Flush wurde ausgelöst.")
	if _should_fail(operation, "before_rename", path):
		_remove_if_present(temporary_path)
		return failure("Persistenzfehler vor der Veröffentlichung wurde ausgelöst.")

	var rename_error := DirAccess.rename_absolute(temporary_path, absolute_path)
	if rename_error != OK:
		_remove_if_present(temporary_path)
		return failure("Persistenzdokument konnte nicht veröffentlicht werden: %s" % error_string(rename_error))
	if _should_fail(operation, "after_rename", path):
		return {
			"ok": false,
			"status": "ambiguous_commit",
			"error": "Persistenzdokument wurde veröffentlicht, aber die Bestätigung wurde unterbrochen.",
		}

	var readback := read_json(path)
	if not readback.get("ok", false):
		return failure("Das veröffentlichte Persistenzdokument konnte nicht zurückgelesen werden.")
	if canonical_json(readback["value"]) != canonical_json(value):
		return failure("Das veröffentlichte Persistenzdokument weicht vom geschriebenen Inhalt ab.")
	return {"ok": true}


func read_json(path: String) -> Dictionary:
	var file := FileAccess.open(absolute(path), FileAccess.READ)
	if file == null:
		return {"ok": false, "error": "Persistenzdokument ist nicht lesbar."}
	var parser := JSON.new()
	var parse_error := parser.parse(file.get_as_text())
	file.close()
	if parse_error != OK:
		return {"ok": false, "error": "Persistenzdokument enthält kein gültiges JSON."}
	return {"ok": true, "value": parser.data}


func ensure_directory(path: String) -> Error:
	return DirAccess.make_dir_recursive_absolute(absolute(path))


func absolute(path: String) -> String:
	return ProjectSettings.globalize_path(path)


func checksum(value: Variant) -> String:
	return canonical_json(value).sha256_text()


func canonical_json(value: Variant) -> String:
	return JSON.stringify(value, "", true, true)


func new_identity() -> String:
	var bytes := Crypto.new().generate_random_bytes(16)
	bytes[6] = (bytes[6] & 0x0f) | 0x40
	bytes[8] = (bytes[8] & 0x3f) | 0x80
	var value := bytes.hex_encode()
	return "%s-%s-%s-%s-%s" % [
		value.substr(0, 8),
		value.substr(8, 4),
		value.substr(12, 4),
		value.substr(16, 4),
		value.substr(20, 12),
	]


func failure(message: String) -> Dictionary:
	return {"ok": false, "status": "storage_error", "error": message}


func measure_tree(path: String) -> Dictionary:
	return _measure_tree_absolute(absolute(path))


func remove_tree(path: String) -> Dictionary:
	return _remove_tree_absolute(absolute(path))


func _should_fail(operation: String, phase: String, path: String) -> bool:
	return _fault_injector.is_valid() and bool(_fault_injector.call(operation, phase, path))


func _remove_if_present(absolute_path: String) -> void:
	if FileAccess.file_exists(absolute_path):
		DirAccess.remove_absolute(absolute_path)


func _measure_tree_absolute(absolute_path: String) -> Dictionary:
	var directory := DirAccess.open(absolute_path)
	if directory == null:
		return failure("Zu messendes Verzeichnis ist nicht lesbar.")
	var file_count := 0
	var total_bytes := 0
	directory.list_dir_begin()
	var name := directory.get_next()
	while not name.is_empty():
		var child := absolute_path + "/" + name
		if directory.current_is_dir() and not directory.is_link(name):
			var nested := _measure_tree_absolute(child)
			if not nested.get("ok", false):
				directory.list_dir_end()
				return nested
			file_count += int(nested["file_count"])
			total_bytes += int(nested["total_bytes"])
		else:
			file_count += 1
			total_bytes += FileAccess.get_size(child)
		name = directory.get_next()
	directory.list_dir_end()
	return {"ok": true, "file_count": file_count, "total_bytes": total_bytes}


func _remove_tree_absolute(absolute_path: String) -> Dictionary:
	if not DirAccess.dir_exists_absolute(absolute_path):
		return {"ok": true}
	var directory := DirAccess.open(absolute_path)
	if directory == null:
		return failure("Zu löschendes Verzeichnis ist nicht lesbar.")
	directory.list_dir_begin()
	var name := directory.get_next()
	while not name.is_empty():
		var child := absolute_path + "/" + name
		if directory.current_is_dir() and not directory.is_link(name):
			var nested := _remove_tree_absolute(child)
			if not nested.get("ok", false):
				directory.list_dir_end()
				return nested
		else:
			var file_error := DirAccess.remove_absolute(child)
			if file_error != OK:
				directory.list_dir_end()
				return failure("Datei konnte nicht dauerhaft gelöscht werden: %s" % error_string(file_error))
		name = directory.get_next()
	directory.list_dir_end()
	var directory_error := DirAccess.remove_absolute(absolute_path)
	if directory_error != OK:
		return failure("Verzeichnis konnte nicht dauerhaft gelöscht werden: %s" % error_string(directory_error))
	return {"ok": true}
