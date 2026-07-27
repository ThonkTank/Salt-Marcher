class_name SharedDefinitionStore
extends RefCounted

## Installation-scoped immutable reusable definitions selected by registry generation.

const ImmutableJsonFiles = preload("res://godot/src/platform/persistence/immutable_json_files.gd")

const GENERATION_FORMAT_ID := "saltmarcher.shared-definitions.v1"
const DEFINITION_FORMAT_ID := "saltmarcher.shared-definition.v1"
const MAX_DEFINITION_COUNT := 1_000_000
const MAX_ID_LENGTH := 160
const MAX_KIND_LENGTH := 80
const MAX_NAME_LENGTH := 240

var _root: String
var _generations_dir: String
var _objects_dir: String
var _files: ImmutableJsonFiles


func _init(
	data_root: String = "user://salt-marcher",
	fault_injector: Callable = Callable(),
	capacity_guard = null
) -> void:
	_root = data_root.trim_suffix("/") + "/installation/shared-definitions"
	_generations_dir = _root + "/generations"
	_objects_dir = _root + "/objects"
	_files = ImmutableJsonFiles.new(fault_injector, capacity_guard)


func load_generation(generation: int) -> Dictionary:
	if generation < 0:
		return _failure("Shared-Definition-Generation darf nicht negativ sein.")
	if generation == 0:
		return {"ok": true, "generation": 0, "parent_generation": 0, "definitions": {}}
	var read := _files.read_json(generation_path(generation))
	if not read.get("ok", false) or not read.get("value") is Dictionary:
		return _failure("Shared-Definition-Generation %d ist nicht lesbar." % generation)
	var document: Dictionary = read["value"]
	if document.get("format", "") != GENERATION_FORMAT_ID or not document.get("payload") is Dictionary:
		return _failure("Shared-Definition-Generation %d besitzt ein unbekanntes Format." % generation)
	var payload: Dictionary = document["payload"]
	if document.get("payload_sha256", "") != _files.checksum(payload):
		return _failure("Shared-Definition-Generation %d besitzt eine ungültige Prüfsumme." % generation)
	if not str(payload.get("generation", "")).is_valid_int() or str(payload["generation"]).to_int() != generation:
		return _failure("Shared-Definition-Generation und Dateiname widersprechen sich.")
	if not str(payload.get("parent_generation", "")).is_valid_int():
		return _failure("Shared-Definition-Generation besitzt keinen gültigen Vorgänger.")
	var parent_generation := str(payload["parent_generation"]).to_int()
	if parent_generation < 0 or parent_generation >= generation:
		return _failure("Shared-Definition-Generation besitzt eine ungültige Generationsfolge.")
	if not payload.get("definitions") is Dictionary or payload["definitions"].size() > MAX_DEFINITION_COUNT:
		return _failure("Shared-Definition-Generation besitzt keinen gültigen Index.")
	var definitions: Dictionary = payload["definitions"]
	for definition_id_value in definitions:
		var definition_id := str(definition_id_value)
		var validation := _read_indexed_definition(definition_id, definitions[definition_id_value])
		if not validation.get("ok", false):
			return validation
	return {
		"ok": true,
		"generation": generation,
		"parent_generation": parent_generation,
		"definitions": definitions.duplicate(true),
	}


func prepare_generation(
	base_generation: int,
	changed_definitions: Array,
	progress_callback: Callable = Callable(),
	cancellation_callback: Callable = Callable()
) -> Dictionary:
	if _cancelled(cancellation_callback):
		return _cancelled_failure()
	var current := load_generation(base_generation)
	if not current.get("ok", false):
		return current
	if changed_definitions.is_empty():
		return {"ok": true, "status": "unchanged", "generation": base_generation, "state": current}
	var definitions: Dictionary = current["definitions"].duplicate(true)
	var normalized_by_id := {}
	for value in changed_definitions:
		if _cancelled(cancellation_callback):
			return _cancelled_failure()
		var normalized := validate_definition(value)
		if not normalized.get("ok", false):
			return normalized
		var definition: Dictionary = normalized["definition"]
		var definition_id := str(definition["definition_id"])
		if normalized_by_id.has(definition_id):
			return _failure("Eine Shared Definition darf pro Generation nur einmal geändert werden: %s" % definition_id)
		normalized_by_id[definition_id] = definition
	var published_count := 0
	var created_object_paths: Array[String] = []
	for definition_id_value in normalized_by_id:
		if _cancelled(cancellation_callback):
			_remove_unpublished_objects(created_object_paths)
			return _cancelled_failure()
		var definition_id := str(definition_id_value)
		var definition: Dictionary = normalized_by_id[definition_id_value]
		var content_sha256 := _files.checksum(definition["content"])
		var definition_sha256 := _files.checksum(definition)
		var relative_path := "objects/%s/%s.json" % [definition_id, definition_sha256]
		var object_path := _root + "/" + relative_path
		if not FileAccess.file_exists(_files.absolute(object_path)):
			var object_directory_error := _files.ensure_directory((_root + "/" + relative_path).get_base_dir())
			if object_directory_error != OK:
				_remove_unpublished_objects(created_object_paths)
				return _failure("Shared-Definition-Objektverzeichnis konnte nicht erstellt werden.")
			var write := _files.write_new_json(
				object_path,
				_envelope(DEFINITION_FORMAT_ID, definition),
				"shared_definition_object"
			)
			if not write.get("ok", false):
				_remove_unpublished_objects(created_object_paths)
				return write
			created_object_paths.append(object_path)
		definitions[definition_id] = {
			"kind": definition["kind"],
			"name": definition["name"],
			"path": relative_path,
			"definition_sha256": definition_sha256,
			"content_sha256": content_sha256,
		}
		published_count += 1
		if progress_callback.is_valid():
			progress_callback.call({
				"phase": "definitions",
				"completed": published_count,
				"total": normalized_by_id.size(),
				"message": "Shared Definitions werden für die atomare Veröffentlichung vorbereitet.",
			})
	if definitions.size() > MAX_DEFINITION_COUNT:
		_remove_unpublished_objects(created_object_paths)
		return _failure("Die Shared-Definition-Sammlung überschreitet die zulässige Anzahl.")
	var next_generation := _next_generation_number()
	var payload := {
		"generation": str(next_generation),
		"parent_generation": str(base_generation),
		"definitions": definitions,
	}
	var generation_directory_error := _files.ensure_directory(_generations_dir)
	if generation_directory_error != OK:
		_remove_unpublished_objects(created_object_paths)
		return _failure("Shared-Definition-Generationsverzeichnis konnte nicht erstellt werden.")
	if _cancelled(cancellation_callback):
		_remove_unpublished_objects(created_object_paths)
		return _cancelled_failure()
	var write_generation := _files.write_new_json(
		generation_path(next_generation),
		_envelope(GENERATION_FORMAT_ID, payload),
		"shared_definition_generation"
	)
	if not write_generation.get("ok", false):
		if write_generation.get("status", "") != "ambiguous_commit":
			_remove_unpublished_objects(created_object_paths)
			return write_generation
	var prepared := load_generation(next_generation)
	if not prepared.get("ok", false):
		return _failure("Vorbereitete Shared Definitions konnten nicht bestätigt werden.")
	return {
		"ok": true,
		"status": "prepared",
		"generation": next_generation,
		"state": prepared,
	}


func read_definition(definition_id: String, generation: int) -> Dictionary:
	var state := load_generation(generation)
	if not state.get("ok", false):
		return state
	var definitions: Dictionary = state["definitions"]
	if not definitions.has(definition_id):
		return {"ok": false, "status": "missing_definition", "error": "Shared Definition fehlt: %s" % definition_id}
	return _read_indexed_definition(definition_id, definitions[definition_id])


func definitions_for_refs(definition_refs: Array, generation: int) -> Dictionary:
	var unique_refs := {}
	for value in definition_refs:
		var definition_id := str(value)
		if not _valid_id(definition_id) or unique_refs.has(definition_id):
			return _failure("Campaign enthält eine ungültige oder doppelte Shared-Definition-Referenz.")
		unique_refs[definition_id] = true
	var result: Array = []
	var ids: Array = unique_refs.keys()
	ids.sort()
	for definition_id_value in ids:
		var definition := read_definition(str(definition_id_value), generation)
		if not definition.get("ok", false):
			return definition
		result.append(definition["definition"])
	return {"ok": true, "definitions": result}


func validate_definition(value: Variant) -> Dictionary:
	if not value is Dictionary:
		return _failure("Shared Definition muss ein Dokument sein.")
	var definition: Dictionary = value
	var definition_id := str(definition.get("definition_id", ""))
	var kind := str(definition.get("kind", "")).strip_edges()
	var name := str(definition.get("name", "")).strip_edges()
	if not _valid_id(definition_id):
		return _failure("Shared Definition besitzt keine gültige Identität.")
	if kind.is_empty() or kind.length() > MAX_KIND_LENGTH or not _valid_kind(kind):
		return _failure("Shared Definition besitzt keinen gültigen Typ.")
	if name.is_empty() or name.length() > MAX_NAME_LENGTH:
		return _failure("Shared Definition besitzt keinen gültigen Namen.")
	if not definition.get("content") is Dictionary:
		return _failure("Shared Definition besitzt keinen gültigen Inhalt.")
	return {
		"ok": true,
		"definition": {
			"definition_id": definition_id,
			"kind": kind,
			"name": name,
			"content": definition["content"].duplicate(true),
		},
	}


func generation_path(generation: int) -> String:
	return _generations_dir + "/generation-%020d.json" % generation


func discard_unselected_generation(generation: int) -> Dictionary:
	if generation <= 0:
		return {"ok": true, "status": "unchanged"}
	var state := load_generation(generation)
	if not state.get("ok", false):
		return state
	var candidate_paths: Array[String] = []
	for reference in state["definitions"].values():
		candidate_paths.append(_root + "/" + str(reference.get("path", "")))
	var path := _files.absolute(generation_path(generation))
	if not FileAccess.file_exists(path):
		return {"ok": true, "status": "unchanged"}
	var remove_error := DirAccess.remove_absolute(path)
	if remove_error != OK:
		return _failure("Nicht veröffentlichte Shared-Definition-Generation konnte nicht entfernt werden.")
	var referenced_paths := {}
	for remaining_generation in _available_generations():
		var remaining := load_generation(remaining_generation)
		if not remaining.get("ok", false):
			return {
				"ok": true,
				"status": "discarded_gc_deferred",
				"generation": generation,
				"warning": "Objektbereinigung wurde wegen einer beschädigten verbleibenden Generation zurückgestellt.",
			}
		for reference in remaining["definitions"].values():
			referenced_paths[_root + "/" + str(reference.get("path", ""))] = true
	for candidate_path in candidate_paths:
		if not referenced_paths.has(candidate_path):
			_remove_unpublished_objects([candidate_path])
	return {"ok": true, "status": "discarded", "generation": generation}


func _read_indexed_definition(definition_id: String, reference: Variant) -> Dictionary:
	if not _valid_id(definition_id) or not reference is Dictionary:
		return _failure("Shared-Definition-Index enthält einen ungültigen Eintrag.")
	var relative_path := str(reference.get("path", ""))
	var definition_sha256 := str(reference.get("definition_sha256", ""))
	var content_sha256 := str(reference.get("content_sha256", ""))
	if (
		relative_path != "objects/%s/%s.json" % [definition_id, definition_sha256]
		or not _valid_sha256(definition_sha256)
		or not _valid_sha256(content_sha256)
	):
		return _failure("Shared-Definition-Index enthält eine unsichere Objektreferenz.")
	var read := _files.read_json(_root + "/" + relative_path)
	if not read.get("ok", false) or not read.get("value") is Dictionary:
		return _failure("Shared Definition %s ist nicht lesbar." % definition_id)
	var document: Dictionary = read["value"]
	if document.get("format", "") != DEFINITION_FORMAT_ID or not document.get("payload") is Dictionary:
		return _failure("Shared Definition %s besitzt ein unbekanntes Format." % definition_id)
	var payload: Dictionary = document["payload"]
	if document.get("payload_sha256", "") != _files.checksum(payload):
		return _failure("Shared Definition %s besitzt eine ungültige Dokumentprüfsumme." % definition_id)
	var normalized := validate_definition(payload)
	if not normalized.get("ok", false):
		return normalized
	var definition: Dictionary = normalized["definition"]
	if (
		definition["definition_id"] != definition_id
		or _files.checksum(definition) != definition_sha256
		or _files.checksum(definition["content"]) != content_sha256
	):
		return _failure("Shared-Definition-Index und Objekt widersprechen sich.")
	if reference.get("kind", "") != definition["kind"] or reference.get("name", "") != definition["name"]:
		return _failure("Shared-Definition-Metadaten und Objekt widersprechen sich.")
	return {"ok": true, "definition": definition}


func _remove_unpublished_objects(paths: Array) -> void:
	for object_path_value in paths:
		var object_path := str(object_path_value)
		var absolute_object := _files.absolute(object_path)
		if FileAccess.file_exists(absolute_object):
			DirAccess.remove_absolute(absolute_object)
		var object_directory := absolute_object.get_base_dir()
		if (
			DirAccess.dir_exists_absolute(object_directory)
			and DirAccess.get_files_at(object_directory).is_empty()
			and DirAccess.get_directories_at(object_directory).is_empty()
		):
			DirAccess.remove_absolute(object_directory)


func _available_generations() -> Array[int]:
	var result: Array[int] = []
	var directory := DirAccess.open(_files.absolute(_generations_dir))
	if directory == null:
		return result
	directory.list_dir_begin()
	var file_name := directory.get_next()
	while not file_name.is_empty():
		if not directory.current_is_dir() and file_name.begins_with("generation-") and file_name.ends_with(".json"):
			var raw_generation := file_name.trim_prefix("generation-").trim_suffix(".json")
			if raw_generation.is_valid_int():
				result.append(raw_generation.to_int())
		file_name = directory.get_next()
	directory.list_dir_end()
	result.sort()
	return result


func _next_generation_number() -> int:
	var generations := _available_generations()
	return 1 if generations.is_empty() else generations.back() + 1


func _valid_id(value: String) -> bool:
	if value.is_empty() or value.length() > MAX_ID_LENGTH:
		return false
	for index in value.length():
		var code := value.unicode_at(index)
		var allowed := (
			(code >= 97 and code <= 122)
			or (code >= 48 and code <= 57)
			or code == 45
			or code == 46
			or code == 95
		)
		if not allowed:
			return false
	return true


func _valid_kind(value: String) -> bool:
	for index in value.length():
		var code := value.unicode_at(index)
		var allowed := (code >= 97 and code <= 122) or (code >= 48 and code <= 57) or code == 45 or code == 95
		if not allowed:
			return false
	return true


func _valid_sha256(value: String) -> bool:
	if value.length() != 64:
		return false
	for index in value.length():
		var code := value.unicode_at(index)
		if not ((code >= 48 and code <= 57) or (code >= 97 and code <= 102)):
			return false
	return true


func _envelope(format_id: String, payload: Dictionary) -> Dictionary:
	return {
		"format": format_id,
		"payload": payload,
		"payload_sha256": _files.checksum(payload),
	}


func _cancelled(cancellation_callback: Callable) -> bool:
	return cancellation_callback.is_valid() and bool(cancellation_callback.call())


func _cancelled_failure() -> Dictionary:
	return {
		"ok": false,
		"status": "cancelled",
		"error": "Shared-Definition-Vorbereitung wurde vor Veröffentlichung abgebrochen.",
	}


func _failure(message: String) -> Dictionary:
	return {"ok": false, "status": "shared_definition_error", "error": message}
