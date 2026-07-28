class_name CreatureCatalog
extends RefCounted

## Read-only Creature owner over one immutable Shared-Definition generation.

const SharedDefinitionStore = preload("res://godot/src/platform/persistence/shared_definition_store.gd")

const KIND := "creature"
const SOURCE_DOCUMENT := "srd-2014"
const SOURCE_VERSION := "Open5e V2 · 5e 2014 Rules"
const SOURCE_ROOT := "https://api.open5e.com/v2/creatures/"
const MAX_PAGE_SIZE := 100
const MAX_TEXT_LENGTH := 32_000

var _definitions: SharedDefinitionStore


func _init(data_root: String = "user://salt-marcher") -> void:
	_definitions = SharedDefinitionStore.new(data_root)


func query(
	generation: int,
	search_text: String = "",
	filters: Dictionary = {},
	offset: int = 0,
	limit: int = 50,
	sort_key: String = "name",
	sort_ascending: bool = true,
	cancellation_callback: Callable = Callable()
) -> Dictionary:
	var normalized_filters := _normalize_filters(filters)
	if (
		generation < 0
		or offset < 0
		or limit <= 0
		or limit > MAX_PAGE_SIZE
		or sort_key not in ["name", "identity", "challenge_rating", "type", "xp"]
		or not normalized_filters.get("ok", false)
	):
		return _query_result("invalid_query", [], 0, offset, limit, {}, "Monster-Filter oder Seitengrenzen sind ungültig.")
	if _cancelled(cancellation_callback):
		return _cancelled_result()
	var state := _definitions.load_generation(generation)
	if not state.get("ok", false):
		return _query_result("storage_error", [], 0, offset, limit, {}, "Der lokale Monster-Katalog ist nicht lesbar.")
	var rows: Array = []
	var options := {"sizes": {}, "types": {}, "subtypes": {}, "environments": {}, "alignments": {}}
	for definition_id_value in state["definitions"]:
		if _cancelled(cancellation_callback):
			return _cancelled_result()
		var reference: Dictionary = state["definitions"][definition_id_value]
		if reference.get("kind", "") != KIND:
			continue
		var normalized := _normalize_projection(str(definition_id_value), reference)
		if not normalized.get("ok", false):
			return _query_result(
				"incompatible", [], 0, offset, limit, {},
				"Der lokale Monster-Katalog besitzt ein inkompatibles Format. Importiere ihn vollständig neu."
			)
		var row: Dictionary = normalized["row"]
		_add_option(options["sizes"], str(row["size"]))
		_add_option(options["types"], str(row["creature_type"]))
		_add_option(options["subtypes"], str(row["subtype"]))
		_add_option(options["alignments"], str(row["alignment"]))
		for environment in row["environments"]:
			_add_option(options["environments"], str(environment))
		if _matches(row, search_text, normalized_filters["filters"]):
			rows.append(row)
	if options["sizes"].is_empty() and options["types"].is_empty():
		return _query_result("unavailable", [], 0, offset, limit, _sorted_options(options), "Der Monster-Katalog wurde noch nicht importiert.")
	rows.sort_custom(_compare_rows.bind(sort_key, sort_ascending))
	var page: Array = []
	var end := mini(offset + limit, rows.size())
	for index in range(mini(offset, rows.size()), end):
		page.append(rows[index].duplicate(true))
	var result := _query_result(
		"empty" if rows.is_empty() else "ready", page, rows.size(), offset, limit, _sorted_options(options)
	)
	result["generation"] = generation
	result["sort_key"] = sort_key
	result["sort_ascending"] = sort_ascending
	result["filters"] = normalized_filters["filters"].duplicate(true)
	return result


func detail(generation: int, definition_id: String) -> Dictionary:
	if generation < 0 or definition_id.is_empty():
		return _detail_failure("not_found", "Monster wurde nicht gefunden.")
	var read := _definitions.read_definition(definition_id, generation)
	if not read.get("ok", false):
		return _detail_failure(
			"not_found" if read.get("status", "") == "missing_definition" else "storage_error",
			"Monster wurde nicht gefunden." if read.get("status", "") == "missing_definition" else "Monster-Details sind nicht lesbar."
		)
	var definition: Dictionary = read["definition"]
	if definition.get("kind", "") != KIND:
		return _detail_failure("not_found", "Monster wurde nicht gefunden.")
	var normalized := _normalize_creature_content(definition)
	if not normalized.get("ok", false):
		return _detail_failure(
			"incompatible",
			"Dieses Monster besitzt ein inkompatibles Format. Importiere den Monster-Katalog vollständig neu."
		)
	return {
		"ok": true,
		"status": "ready",
		"generation": generation,
		"definition_id": definition_id,
		"creature": normalized["creature"],
	}


func facts_snapshot(generation: int, cancellation_callback: Callable = Callable()) -> Dictionary:
	var snapshot := _definitions.definitions_of_kind(generation, KIND, cancellation_callback)
	if not snapshot.get("ok", false):
		return snapshot
	var creatures: Array = []
	for definition in snapshot["definitions"]:
		var normalized := _normalize_creature_content(definition)
		if not normalized.get("ok", false):
			return {"ok": false, "status": "incompatible", "error": "Ein Monster besitzt ein inkompatibles Format."}
		creatures.append(normalized["creature"])
	return {"ok": true, "status": "empty" if creatures.is_empty() else "ready", "generation": generation, "creatures": creatures}


func validate_import_definition(value: Variant) -> Dictionary:
	if not value is Dictionary:
		return _failure("Importiertes Monster muss ein Dokument sein.")
	var definition: Dictionary = value
	if definition.get("kind", "") != KIND:
		return _failure("Importierte Monster müssen den Typ creature besitzen.")
	var normalized := _normalize_creature_content(definition)
	if not normalized.get("ok", false):
		return normalized
	if definition.get("catalog_projection") != _projection_from_creature(normalized["creature"]):
		return _failure("Importiertes Monster und seine Katalogprojektion widersprechen sich.")
	return {"ok": true, "definition": definition.duplicate(true)}


func _normalize_projection(definition_id: String, reference: Dictionary) -> Dictionary:
	if not reference.get("catalog_projection") is Dictionary:
		return _failure("Monster besitzt keine Katalogprojektion.")
	var projection: Dictionary = reference["catalog_projection"]
	var name := str(reference.get("name", "")).strip_edges()
	var source_key := str(projection.get("source_key", "")).strip_edges()
	var creature_type := str(projection.get("creature_type", "")).strip_edges()
	var size := str(projection.get("size", "")).strip_edges()
	var subtype := str(projection.get("subtype", "")).strip_edges()
	var alignment := str(projection.get("alignment", "")).strip_edges()
	var challenge_rating := str(projection.get("challenge_rating", "")).strip_edges()
	var challenge_rating_decimal = projection.get("challenge_rating_decimal")
	var xp = projection.get("xp")
	var environments := _string_array(projection.get("environments"))
	if (
		definition_id.is_empty() or name.is_empty() or source_key.is_empty()
		or creature_type.is_empty() or size.is_empty() or challenge_rating.is_empty()
		or not _number(challenge_rating_decimal) or float(challenge_rating_decimal) < 0.0
		or not _whole_number(xp) or int(xp) < 0
		or not environments.get("ok", false)
		or _too_long(name) or _too_long(source_key) or _too_long(creature_type)
		or _too_long(size) or _too_long(subtype) or _too_long(alignment)
	):
		return _failure("Monster-Katalogprojektion ist ungültig.")
	return {
		"ok": true,
		"row": {
			"definition_id": definition_id,
			"reference_id": definition_id,
			"kind": KIND,
			"source_key": source_key,
			"name": name,
			"creature_type": creature_type,
			"size": size,
			"subtype": subtype,
			"alignment": alignment,
			"challenge_rating": challenge_rating,
			"challenge_rating_decimal": float(challenge_rating_decimal),
			"xp": int(xp),
			"environments": environments["values"],
		},
	}


func _normalize_creature_content(definition: Dictionary) -> Dictionary:
	if not definition.get("content") is Dictionary:
		return _failure("Monster-Inhalt fehlt.")
	var projection := _normalize_projection(str(definition.get("definition_id", "")), {
		"name": definition.get("name", ""),
		"catalog_projection": definition.get("catalog_projection"),
	})
	if not projection.get("ok", false):
		return projection
	var row: Dictionary = projection["row"]
	var content: Dictionary = definition["content"]
	for key in [
		"source_key", "creature_type", "size", "subtype", "alignment", "challenge_rating",
		"challenge_rating_decimal", "xp", "environments",
	]:
		if content.get(key) != row[key]:
			return _failure("Monster-Inhalt und Katalogprojektion widersprechen sich.")
	if (
		str(content.get("source_document", "")) != SOURCE_DOCUMENT
		or str(content.get("source_version", "")) != SOURCE_VERSION
		or not str(content.get("source_url", "")).begins_with(SOURCE_ROOT)
		or not content.get("source_licenses") is Array
		or not _valid_non_negative_integer(content.get("hit_points"))
		or not _valid_non_negative_integer(content.get("armor_class"))
		or not _valid_integer(content.get("initiative_bonus"))
		or not _valid_non_negative_integer(content.get("legendary_action_count"))
		or not _valid_non_negative_integer(content.get("hit_dice_count"))
		or not _valid_non_negative_integer(content.get("hit_dice_sides"))
		or not _valid_integer(content.get("hit_dice_modifier"))
		or not content.get("ability_scores") is Dictionary
		or not content.get("saving_throws") is Dictionary
		or not content.get("skills") is Dictionary
		or not content.get("speed") is Dictionary
		or not content.get("senses") is Dictionary
		or not content.get("resistances_and_immunities") is Dictionary
	):
		return _failure("Monster-Statblock besitzt ungültige Kernwerte.")
	for field in ["hit_dice", "armor_detail", "languages", "source_url", "source_permalink"]:
		if not content.get(field) is String or _too_long(str(content.get(field, ""))):
			return _failure("Monster-Statblock besitzt ein ungültiges Textfeld.")
	for field in ["traits", "actions"]:
		var entries := _named_text_entries(content.get(field))
		if not entries.get("ok", false):
			return entries
	var license_names := _string_array(content["source_licenses"])
	if not license_names.get("ok", false) or license_names["values"].is_empty():
		return _failure("Monster-Quelle besitzt keine Lizenzangabe.")
	var creature := row.duplicate(true)
	for key in content:
		if key not in creature:
			creature[key] = content[key] if not content[key] is Array and not content[key] is Dictionary else content[key].duplicate(true)
	return {"ok": true, "creature": creature}


func _projection_from_creature(creature: Dictionary) -> Dictionary:
	return {
		"source_key": creature["source_key"],
		"creature_type": creature["creature_type"],
		"size": creature["size"],
		"subtype": creature["subtype"],
		"alignment": creature["alignment"],
		"challenge_rating": creature["challenge_rating"],
		"challenge_rating_decimal": creature["challenge_rating_decimal"],
		"xp": creature["xp"],
		"environments": creature["environments"],
	}


func _normalize_filters(filters: Dictionary) -> Dictionary:
	var minimum = filters.get("minimum_challenge_rating")
	var maximum = filters.get("maximum_challenge_rating")
	if (
		(minimum != null and (not _number(minimum) or float(minimum) < 0.0))
		or (maximum != null and (not _number(maximum) or float(maximum) < 0.0))
		or (minimum != null and maximum != null and float(minimum) > float(maximum))
	):
		return {"ok": false}
	var result := {
		"minimum_challenge_rating": minimum,
		"maximum_challenge_rating": maximum,
	}
	for key in ["sizes", "types", "subtypes", "environments", "alignments"]:
		var values := _filter_values(filters.get(key, []))
		if not values.get("ok", false):
			return {"ok": false}
		result[key] = values["values"]
	return {"ok": true, "filters": result}


func _filter_values(value: Variant) -> Dictionary:
	if value == null or (value is String and value == ""):
		return {"ok": true, "values": []}
	var raw: Array = value if value is Array else [value]
	var values: Array[String] = []
	for entry in raw:
		if not entry is String or str(entry).strip_edges().is_empty() or _too_long(str(entry)):
			return {"ok": false}
		var normalized := str(entry).strip_edges()
		if normalized not in values:
			values.append(normalized)
	values.sort()
	return {"ok": true, "values": values}


func _matches(row: Dictionary, search_text: String, filters: Dictionary) -> bool:
	var needle := search_text.strip_edges().to_lower()
	if not needle.is_empty() and not str(row["name"]).to_lower().contains(needle):
		return false
	if filters["minimum_challenge_rating"] != null and float(row["challenge_rating_decimal"]) < float(filters["minimum_challenge_rating"]):
		return false
	if filters["maximum_challenge_rating"] != null and float(row["challenge_rating_decimal"]) > float(filters["maximum_challenge_rating"]):
		return false
	for pair in [["sizes", "size"], ["types", "creature_type"], ["subtypes", "subtype"], ["alignments", "alignment"]]:
		if not filters[pair[0]].is_empty() and row[pair[1]] not in filters[pair[0]]:
			return false
	if not filters["environments"].is_empty():
		var found := false
		for environment in row["environments"]:
			if environment in filters["environments"]:
				found = true
				break
		if not found:
			return false
	return true


func _compare_rows(left: Dictionary, right: Dictionary, sort_key: String, ascending: bool) -> bool:
	var left_value: Variant
	var right_value: Variant
	match sort_key:
		"identity":
			left_value = str(left["definition_id"])
			right_value = str(right["definition_id"])
		"challenge_rating":
			left_value = float(left["challenge_rating_decimal"])
			right_value = float(right["challenge_rating_decimal"])
		"type":
			left_value = str(left["creature_type"]).to_lower()
			right_value = str(right["creature_type"]).to_lower()
		"xp":
			left_value = int(left["xp"])
			right_value = int(right["xp"])
		_:
			left_value = str(left["name"]).to_lower()
			right_value = str(right["name"]).to_lower()
	if left_value == right_value:
		return _stable_name_compare(left, right, ascending)
	return left_value < right_value if ascending else left_value > right_value


func _stable_name_compare(left: Dictionary, right: Dictionary, ascending: bool) -> bool:
	var left_name := str(left["name"]).to_lower()
	var right_name := str(right["name"]).to_lower()
	if left_name == right_name:
		return str(left["definition_id"]) < str(right["definition_id"])
	return left_name < right_name if ascending else left_name > right_name


func _string_array(value: Variant) -> Dictionary:
	if not value is Array:
		return _failure("Monster-Feld ist keine Textliste.")
	var values: Array[String] = []
	for entry in value:
		if not entry is String or _too_long(str(entry)):
			return _failure("Monster-Textliste enthält einen ungültigen Wert.")
		values.append(str(entry))
	return {"ok": true, "values": values}


func _named_text_entries(value: Variant) -> Dictionary:
	if not value is Array:
		return _failure("Monster-Statblockabschnitt ist keine Liste.")
	for entry in value:
		if (
			not entry is Dictionary
			or str(entry.get("name", "")).strip_edges().is_empty()
			or not entry.get("desc") is String
			or _too_long(str(entry.get("name", "")))
			or _too_long(str(entry.get("desc", "")))
		):
			return _failure("Monster-Statblockabschnitt enthält einen ungültigen Eintrag.")
	return {"ok": true}


func _add_option(options: Dictionary, value: String) -> void:
	if not value.is_empty():
		options[value] = true


func _sorted_options(options: Dictionary) -> Dictionary:
	var result := {}
	for key in options:
		var values: Array = options[key].keys()
		values.sort_custom(func(left: Variant, right: Variant) -> bool: return str(left).to_lower() < str(right).to_lower())
		result[key] = values
	return result


func _query_result(status: String, rows: Array, total: int, offset: int, limit: int, filter_options: Dictionary, error: String = "") -> Dictionary:
	return {"ok": true, "status": status, "rows": rows, "total": total, "offset": offset, "limit": limit, "filter_options": filter_options, "error": error}


func _detail_failure(status: String, message: String) -> Dictionary:
	return {"ok": false, "status": status, "error": message}


func _cancelled_result() -> Dictionary:
	return {"ok": false, "status": "cancelled", "error": "Monster-Abfrage wurde abgebrochen."}


func _cancelled(callback: Callable) -> bool:
	return callback.is_valid() and bool(callback.call())


func _too_long(value: String) -> bool:
	return value.length() > MAX_TEXT_LENGTH


func _number(value: Variant) -> bool:
	return value is int or value is float


func _whole_number(value: Variant) -> bool:
	return value is int or (value is float and is_equal_approx(float(value), floorf(float(value))))


func _valid_integer(value: Variant) -> bool:
	return value is int or (value is float and is_equal_approx(float(value), floorf(float(value))))


func _valid_non_negative_integer(value: Variant) -> bool:
	return _valid_integer(value) and int(value) >= 0


func _failure(message: String) -> Dictionary:
	return {"ok": false, "status": "invalid_creature", "error": message}
