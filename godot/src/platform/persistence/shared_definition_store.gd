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
const MAX_CATALOG_PAGE_SIZE := 200

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
		var validation := _validate_index_reference(definition_id, definitions[definition_id_value])
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
	cancellation_callback: Callable = Callable(),
	removed_definition_ids: Array = []
) -> Dictionary:
	if _cancelled(cancellation_callback):
		return _cancelled_failure()
	var current := load_generation(base_generation)
	if not current.get("ok", false):
		return current
	if changed_definitions.is_empty() and removed_definition_ids.is_empty():
		return {"ok": true, "status": "unchanged", "generation": base_generation, "state": current}
	var definitions: Dictionary = current["definitions"].duplicate(true)
	var removals := {}
	for value in removed_definition_ids:
		var definition_id := str(value)
		if not _valid_id(definition_id) or removals.has(definition_id):
			return _failure("Shared-Definition-Entfernung besitzt eine ungültige oder doppelte Identität.")
		removals[definition_id] = true
		definitions.erase(definition_id)
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
		if definition.has("catalog_projection"):
			definitions[definition_id]["catalog_projection"] = definition["catalog_projection"].duplicate(true)
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


func definitions_for_refs(
	definition_refs: Array,
	generation: int,
	cancellation_callback: Callable = Callable()
) -> Dictionary:
	var unique_refs := {}
	for value in definition_refs:
		if _cancelled(cancellation_callback):
			return _cancelled_failure()
		var definition_id := str(value)
		if not _valid_id(definition_id) or unique_refs.has(definition_id):
			return _failure("Campaign enthält eine ungültige oder doppelte Shared-Definition-Referenz.")
		unique_refs[definition_id] = true
	var result: Array = []
	var ids: Array = unique_refs.keys()
	ids.sort()
	for definition_id_value in ids:
		if _cancelled(cancellation_callback):
			return _cancelled_failure()
		var definition := read_definition(str(definition_id_value), generation)
		if not definition.get("ok", false):
			return definition
		result.append(definition["definition"])
	return {"ok": true, "definitions": result}


func definitions_of_kind(
	generation: int,
	kind: String,
	cancellation_callback: Callable = Callable()
) -> Dictionary:
	if not _valid_kind(kind):
		return _failure("Shared-Definition-Snapshot besitzt keinen gültigen Typ.")
	if _cancelled(cancellation_callback):
		return _cancelled_failure()
	var state := load_generation(generation)
	if not state.get("ok", false):
		return state
	var ids: Array = []
	for definition_id_value in state["definitions"]:
		var definition_id := str(definition_id_value)
		if state["definitions"][definition_id_value].get("kind", "") == kind:
			ids.append(definition_id)
	ids.sort()
	var result: Array = []
	for definition_id_value in ids:
		if _cancelled(cancellation_callback):
			return _cancelled_failure()
		var definition := _read_indexed_definition(
			str(definition_id_value),
			state["definitions"][definition_id_value]
		)
		if not definition.get("ok", false):
			return definition
		result.append(definition["definition"])
	return {
		"ok": true,
		"status": "empty" if result.is_empty() else "ready",
		"generation": generation,
		"kind": kind,
		"definitions": result,
	}


func reference_labels(
	definition_refs: Array,
	generation: int,
	expected_kind: String = "",
	cancellation_callback: Callable = Callable()
) -> Dictionary:
	if not expected_kind.is_empty() and not _valid_kind(expected_kind):
		return _failure("Shared-Definition-Referenztyp ist ungültig.")
	var state := load_generation(generation)
	if not state.get("ok", false):
		return state
	var labels := {}
	var missing: Array = []
	for value in definition_refs:
		if _cancelled(cancellation_callback):
			return _cancelled_failure()
		var definition_id := str(value)
		if not _valid_id(definition_id) or labels.has(definition_id):
			return _failure("Referenzliste enthält eine ungültige oder doppelte Shared-Definition-Identität.")
		var reference: Dictionary = state["definitions"].get(definition_id, {})
		if reference.is_empty() or (not expected_kind.is_empty() and reference.get("kind", "") != expected_kind):
			labels[definition_id] = "Fehlend · %s" % definition_id
			missing.append(definition_id)
		else:
			labels[definition_id] = str(reference.get("name", definition_id))
	return {
		"ok": true,
		"labels": labels,
		"missing_definition_ids": missing,
	}


func query_catalog(
	generation: int,
	kind: String,
	search_text: String = "",
	offset: int = 0,
	limit: int = 50,
	sort_key: String = "name",
	sort_ascending: bool = true,
	cancellation_callback: Callable = Callable()
) -> Dictionary:
	if (
		not _valid_kind(kind)
		or offset < 0
		or limit <= 0
		or limit > MAX_CATALOG_PAGE_SIZE
		or sort_key not in ["name", "identity"]
	):
		return _failure("Katalogabfrage besitzt ungültige Grenzen.")
	if _cancelled(cancellation_callback):
		return _cancelled_failure()
	var state := load_generation(generation)
	if not state.get("ok", false):
		return state
	var needle := search_text.strip_edges().to_lower()
	var matching: Array = []
	for definition_id_value in state["definitions"]:
		if _cancelled(cancellation_callback):
			return _cancelled_failure()
		var definition_id := str(definition_id_value)
		var reference: Dictionary = state["definitions"][definition_id_value]
		var name := str(reference.get("name", ""))
		if reference.get("kind", "") != kind:
			continue
		if not needle.is_empty() and not name.to_lower().contains(needle) and not definition_id.contains(needle):
			continue
		matching.append({
			"definition_id": definition_id,
			"kind": kind,
			"name": name,
		})
	matching.sort_custom(func(left: Dictionary, right: Dictionary) -> bool:
		var left_identity := str(left["definition_id"])
		var right_identity := str(right["definition_id"])
		var left_primary := left_identity if sort_key == "identity" else str(left["name"]).to_lower()
		var right_primary := right_identity if sort_key == "identity" else str(right["name"]).to_lower()
		if left_primary == right_primary:
			if left_identity == right_identity:
				return false
			return left_identity < right_identity if sort_ascending else left_identity > right_identity
		return left_primary < right_primary if sort_ascending else left_primary > right_primary
	)
	var rows: Array = []
	var end := mini(offset + limit, matching.size())
	for index in range(mini(offset, matching.size()), end):
		rows.append(matching[index].duplicate(true))
	return {
		"ok": true,
		"status": "empty" if matching.is_empty() else "ready",
		"generation": generation,
		"kind": kind,
		"search_text": search_text,
		"offset": offset,
		"limit": limit,
		"sort_key": sort_key,
		"sort_ascending": sort_ascending,
		"total": matching.size(),
		"rows": rows,
	}


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
	var normalized_definition := {
			"definition_id": definition_id,
			"kind": kind,
			"name": name,
			"content": definition["content"].duplicate(true),
	}
	if definition.has("catalog_projection"):
		if not definition["catalog_projection"] is Dictionary:
			return _failure("Shared Definition besitzt keine gültige Katalogprojektion.")
		normalized_definition["catalog_projection"] = definition["catalog_projection"].duplicate(true)
	return {
		"ok": true,
		"definition": normalized_definition,
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
	var reference_validation := _validate_index_reference(definition_id, reference)
	if not reference_validation.get("ok", false):
		return reference_validation
	var validated_reference: Dictionary = reference_validation["reference"]
	var relative_path := str(validated_reference["path"])
	var definition_sha256 := str(validated_reference["definition_sha256"])
	var content_sha256 := str(validated_reference["content_sha256"])
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
	if validated_reference["kind"] != definition["kind"] or validated_reference["name"] != definition["name"]:
		return _failure("Shared-Definition-Metadaten und Objekt widersprechen sich.")
	if validated_reference.get("catalog_projection") != definition.get("catalog_projection"):
		return _failure("Shared-Definition-Katalogprojektion und Objekt widersprechen sich.")
	return {"ok": true, "definition": definition}


func _validate_index_reference(definition_id: String, reference: Variant) -> Dictionary:
	if not _valid_id(definition_id) or not reference is Dictionary:
		return _failure("Shared-Definition-Index enthält einen ungültigen Eintrag.")
	var typed_reference: Dictionary = reference
	var relative_path := str(reference.get("path", ""))
	var definition_sha256 := str(reference.get("definition_sha256", ""))
	var content_sha256 := str(reference.get("content_sha256", ""))
	var kind := str(reference.get("kind", ""))
	var name := str(reference.get("name", "")).strip_edges()
	if (
		relative_path != "objects/%s/%s.json" % [definition_id, definition_sha256]
		or not _valid_sha256(definition_sha256)
		or not _valid_sha256(content_sha256)
		or kind.is_empty()
		or kind.length() > MAX_KIND_LENGTH
		or not _valid_kind(kind)
		or name.is_empty()
		or name.length() > MAX_NAME_LENGTH
		or name != reference.get("name", "")
		or (reference.has("catalog_projection") and not reference["catalog_projection"] is Dictionary)
	):
		return _failure("Shared-Definition-Index enthält eine unsichere Objektreferenz.")
	return {"ok": true, "reference": typed_reference.duplicate(true)}


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
