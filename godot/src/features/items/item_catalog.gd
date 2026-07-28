class_name ItemCatalog
extends RefCounted

## Read-only Items owner over one immutable Shared-Definition generation.

const SharedDefinitionStore = preload("res://godot/src/platform/persistence/shared_definition_store.gd")

const KIND := "item"
const SOURCE_VERSION := "2014 SRD"
const SOURCE_ROOT := "https://www.dnd5eapi.co/api/2014/"
const MAX_PAGE_SIZE := 100
const MAX_TEXT_LENGTH := 16_000

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
		or sort_key not in ["name", "category", "rarity", "cost"]
		or not normalized_filters.get("ok", false)
	):
		return _query_result("invalid_query", [], 0, offset, limit, {}, "Items-Filter oder Seitengrenzen sind ungültig.")
	if _cancelled(cancellation_callback):
		return _cancelled_result()
	var state := _definitions.load_generation(generation)
	if not state.get("ok", false):
		return _query_result("storage_error", [], 0, offset, limit, {}, "Der lokale Items-Katalog ist nicht lesbar.")
	var rows: Array = []
	var options := {"categories": {}, "subcategories": {}, "rarities": {}}
	for definition_id_value in state["definitions"]:
		if _cancelled(cancellation_callback):
			return _cancelled_result()
		var definition_id := str(definition_id_value)
		var reference: Dictionary = state["definitions"][definition_id_value]
		if reference.get("kind", "") != KIND:
			continue
		var normalized := _normalize_projection(definition_id, reference)
		if not normalized.get("ok", false):
			return _query_result(
				"incompatible", [], 0, offset, limit, {},
				"Der lokale Items-Katalog besitzt ein inkompatibles Format. Importiere ihn vollständig neu."
			)
		var row: Dictionary = normalized["row"]
		_add_option(options["categories"], str(row["category"]))
		_add_option(options["subcategories"], str(row["subcategory"]))
		_add_option(options["rarities"], str(row["rarity"]))
		if _matches(row, search_text, normalized_filters["filters"]):
			rows.append(row)
	if options["categories"].is_empty() and options["subcategories"].is_empty() and options["rarities"].is_empty():
		return _query_result(
			"unavailable", [], 0, offset, limit, _sorted_options(options),
			"Der Items-Katalog wurde noch nicht importiert."
		)
	rows.sort_custom(_compare_rows.bind(sort_key, sort_ascending))
	var page: Array = []
	var end := mini(offset + limit, rows.size())
	for index in range(mini(offset, rows.size()), end):
		page.append(rows[index].duplicate(true))
	var result := _query_result(
		"empty" if rows.is_empty() else "ready",
		page,
		rows.size(),
		offset,
		limit,
		_sorted_options(options)
	)
	result["generation"] = generation
	result["sort_key"] = sort_key
	result["sort_ascending"] = sort_ascending
	result["filters"] = normalized_filters["filters"].duplicate(true)
	return result


func detail(generation: int, definition_id: String) -> Dictionary:
	if generation < 0 or definition_id.is_empty():
		return _detail_failure("not_found", "Item wurde nicht gefunden.")
	var read := _definitions.read_definition(definition_id, generation)
	if not read.get("ok", false):
		return _detail_failure(
			"not_found" if read.get("status", "") == "missing_definition" else "storage_error",
			"Item wurde nicht gefunden." if read.get("status", "") == "missing_definition" else "Item-Details sind nicht lesbar."
		)
	var definition: Dictionary = read["definition"]
	if definition.get("kind", "") != KIND:
		return _detail_failure("not_found", "Item wurde nicht gefunden.")
	var normalized := _normalize_item_content(definition)
	if not normalized.get("ok", false):
		return _detail_failure(
			"incompatible",
			"Dieses Item besitzt ein inkompatibles Format. Importiere den Items-Katalog vollständig neu."
		)
	return {
		"ok": true,
		"status": "ready",
		"generation": generation,
		"definition_id": definition_id,
		"item": normalized["item"],
	}


func validate_import_definition(value: Variant) -> Dictionary:
	if not value is Dictionary:
		return _failure("Importiertes Item muss ein Dokument sein.")
	var definition: Dictionary = value
	if definition.get("kind", "") != KIND:
		return _failure("Importierte Items müssen den Typ item besitzen.")
	var normalized := _normalize_item_content(definition)
	if not normalized.get("ok", false):
		return normalized
	var item: Dictionary = normalized["item"]
	var projection := _projection_from_item(item)
	if definition.get("catalog_projection") != projection:
		return _failure("Importiertes Item und seine Katalogprojektion widersprechen sich.")
	return {"ok": true, "definition": definition.duplicate(true)}


func _normalize_projection(definition_id: String, reference: Dictionary) -> Dictionary:
	if not reference.get("catalog_projection") is Dictionary:
		return _failure("Item besitzt keine Katalogprojektion.")
	var projection: Dictionary = reference["catalog_projection"]
	var source_key := str(projection.get("source_key", "")).strip_edges()
	var name := str(reference.get("name", "")).strip_edges()
	var category := str(projection.get("category", "")).strip_edges()
	var subcategory := str(projection.get("subcategory", "")).strip_edges()
	var rarity := str(projection.get("rarity", "")).strip_edges()
	var cost_display := str(projection.get("cost_display", "")).strip_edges()
	var cost_cp = projection.get("cost_cp")
	if (
		source_key.is_empty()
		or name.is_empty()
		or category.is_empty()
		or not projection.get("magic") is bool
		or not projection.get("attunement") is bool
		or not _valid_optional_non_negative_integer(cost_cp)
		or _too_long(source_key)
		or _too_long(category)
		or _too_long(subcategory)
		or _too_long(rarity)
		or _too_long(cost_display)
	):
		return _failure("Item-Katalogprojektion ist ungültig.")
	return {
		"ok": true,
		"row": {
			"definition_id": definition_id,
			"reference_id": definition_id,
			"kind": KIND,
			"source_key": source_key,
			"name": name,
			"category": category,
			"subcategory": subcategory,
			"magic": bool(projection["magic"]),
			"rarity": rarity,
			"attunement": bool(projection["attunement"]),
			"cost_cp": null if cost_cp == null else int(cost_cp),
			"cost_display": cost_display,
		},
	}


func _normalize_item_content(definition: Dictionary) -> Dictionary:
	if not definition.get("content") is Dictionary:
		return _failure("Item-Inhalt fehlt.")
	var content: Dictionary = definition["content"]
	var projection := _normalize_projection(str(definition.get("definition_id", "")), {
		"name": definition.get("name", ""),
		"catalog_projection": definition.get("catalog_projection"),
	})
	if not projection.get("ok", false):
		return projection
	var row: Dictionary = projection["row"]
	var properties = content.get("properties")
	var weight = content.get("weight")
	if (
		content.get("source_key") != row["source_key"]
		or content.get("category") != row["category"]
		or content.get("subcategory") != row["subcategory"]
		or content.get("magic") != row["magic"]
		or content.get("rarity") != row["rarity"]
		or content.get("attunement") != row["attunement"]
		or content.get("cost_cp") != row["cost_cp"]
		or content.get("cost_display") != row["cost_display"]
		or (weight != null and not weight is float and not weight is int)
		or (weight != null and float(weight) < 0.0)
		or not properties is Array
		or str(content.get("source_version", "")) != SOURCE_VERSION
		or not str(content.get("source_url", "")).begins_with(SOURCE_ROOT)
	):
		return _failure("Item-Inhalt und Katalogprojektion widersprechen sich.")
	var normalized_properties: Array[String] = []
	for value in properties:
		if not value is String or _too_long(str(value)):
			return _failure("Item-Eigenschaft ist ungültig.")
		normalized_properties.append(str(value))
	for field in ["damage", "armor_class", "description", "source_url"]:
		if not content.get(field) is String or _too_long(str(content.get(field, ""))):
			return _failure("Item-Textfeld ist ungültig.")
	var item := row.duplicate(true)
	item["weight"] = weight
	item["damage"] = str(content.get("damage", ""))
	item["armor_class"] = str(content.get("armor_class", ""))
	item["properties"] = normalized_properties
	item["description"] = str(content.get("description", ""))
	item["source_version"] = SOURCE_VERSION
	item["source_url"] = str(content.get("source_url", ""))
	return {"ok": true, "item": item}


func _projection_from_item(item: Dictionary) -> Dictionary:
	return {
		"source_key": item["source_key"],
		"category": item["category"],
		"subcategory": item["subcategory"],
		"magic": item["magic"],
		"rarity": item["rarity"],
		"attunement": item["attunement"],
		"cost_cp": item["cost_cp"],
		"cost_display": item["cost_display"],
	}


func _normalize_filters(filters: Dictionary) -> Dictionary:
	var minimum_cost = filters.get("minimum_cost_cp")
	var maximum_cost = filters.get("maximum_cost_cp")
	if (
		(minimum_cost != null and (not minimum_cost is int or int(minimum_cost) < 0))
		or (maximum_cost != null and (not maximum_cost is int or int(maximum_cost) < 0))
		or (minimum_cost != null and maximum_cost != null and int(minimum_cost) > int(maximum_cost))
		or (filters.get("magic") != null and not filters.get("magic") is bool)
		or (filters.get("attunement") != null and not filters.get("attunement") is bool)
	):
		return {"ok": false}
	return {
		"ok": true,
		"filters": {
			"category": str(filters.get("category", "")).strip_edges(),
			"subcategory": str(filters.get("subcategory", "")).strip_edges(),
			"rarity": str(filters.get("rarity", "")).strip_edges(),
			"magic": filters.get("magic"),
			"attunement": filters.get("attunement"),
			"minimum_cost_cp": minimum_cost,
			"maximum_cost_cp": maximum_cost,
		},
	}


func _matches(row: Dictionary, search_text: String, filters: Dictionary) -> bool:
	var needle := search_text.strip_edges().to_lower()
	if not needle.is_empty() and not str(row["name"]).to_lower().contains(needle):
		return false
	for key in ["category", "subcategory", "rarity"]:
		if not str(filters[key]).is_empty() and row[key] != filters[key]:
			return false
	for key in ["magic", "attunement"]:
		if filters[key] != null and row[key] != filters[key]:
			return false
	if filters["minimum_cost_cp"] != null and (row["cost_cp"] == null or int(row["cost_cp"]) < int(filters["minimum_cost_cp"])):
		return false
	if filters["maximum_cost_cp"] != null and (row["cost_cp"] == null or int(row["cost_cp"]) > int(filters["maximum_cost_cp"])):
		return false
	return true


func _compare_rows(left: Dictionary, right: Dictionary, sort_key: String, ascending: bool) -> bool:
	var left_value: Variant
	var right_value: Variant
	match sort_key:
		"category":
			left_value = str(left["category"]).to_lower()
			right_value = str(right["category"]).to_lower()
		"rarity":
			left_value = str(left["rarity"]).to_lower()
			right_value = str(right["rarity"]).to_lower()
		"cost":
			if left["cost_cp"] == null or right["cost_cp"] == null:
				if left["cost_cp"] == right["cost_cp"]:
					return _stable_name_compare(left, right, ascending)
				return right["cost_cp"] == null
			left_value = int(left["cost_cp"])
			right_value = int(right["cost_cp"])
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


func _query_result(
	status: String,
	rows: Array,
	total: int,
	offset: int,
	limit: int,
	filter_options: Dictionary,
	error: String = ""
) -> Dictionary:
	return {
		"ok": true,
		"status": status,
		"rows": rows,
		"total": total,
		"offset": offset,
		"limit": limit,
		"filter_options": filter_options,
		"error": error,
	}


func _detail_failure(status: String, message: String) -> Dictionary:
	return {"ok": false, "status": status, "error": message}


func _cancelled_result() -> Dictionary:
	return {"ok": false, "status": "cancelled", "error": "Items-Abfrage wurde abgebrochen."}


func _cancelled(callback: Callable) -> bool:
	return callback.is_valid() and bool(callback.call())


func _too_long(value: String) -> bool:
	return value.length() > MAX_TEXT_LENGTH


func _valid_optional_non_negative_integer(value: Variant) -> bool:
	if value == null:
		return true
	if value is int:
		return int(value) >= 0
	return value is float and is_equal_approx(float(value), floorf(float(value))) and float(value) >= 0.0


func _failure(message: String) -> Dictionary:
	return {"ok": false, "status": "invalid_item", "error": message}
