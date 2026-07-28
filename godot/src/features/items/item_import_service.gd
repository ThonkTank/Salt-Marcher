class_name ItemImportService
extends RefCounted

## Validates a complete public corpus before one atomic Items generation cutover.

const FileCampaignRegistry = preload("res://godot/src/platform/persistence/file_campaign_registry.gd")
const SharedDefinitionStore = preload("res://godot/src/platform/persistence/shared_definition_store.gd")
const ItemCatalog = preload("res://godot/src/features/items/item_catalog.gd")
const Dnd5e2014ItemSource = preload("res://godot/src/features/items/dnd5e2014_item_source.gd")

const SOURCE_VERSION := "2014 SRD"
const API_ROOT := "https://www.dnd5eapi.co"
const EQUIPMENT_INDEX := "/api/2014/equipment"
const MAGIC_ITEM_INDEX := "/api/2014/magic-items"

var _data_root: String


func _init(data_root: String = "user://salt-marcher") -> void:
	_data_root = data_root.trim_suffix("/")


func import_public_corpus(progress_callback: Callable = Callable()) -> Dictionary:
	var fetched := Dnd5e2014ItemSource.new().fetch_corpus(progress_callback)
	if not fetched.get("ok", false):
		return fetched
	return import_fetched_corpus(fetched)


func import_fetched_corpus(corpus: Dictionary) -> Dictionary:
	var normalized := _normalize_corpus(corpus)
	if not normalized.get("ok", false):
		return normalized
	var definitions: Array = normalized["definitions"]
	var registry := FileCampaignRegistry.new(_data_root)
	var registry_state: Dictionary = registry.load_state()
	if not registry_state.get("ok", false):
		return _storage_failure("Installationsstatus konnte vor dem Items-Import nicht gelesen werden.")
	var base_generation := int(registry_state.get("shared_definitions_generation", 0))
	var definition_store := SharedDefinitionStore.new(_data_root)
	var current := definition_store.load_generation(base_generation)
	if not current.get("ok", false):
		return _storage_failure("Aktuelle Shared Definitions konnten vor dem Items-Import nicht gelesen werden.")
	var removed_ids: Array[String] = []
	for definition_id_value in current["definitions"]:
		if current["definitions"][definition_id_value].get("kind", "") == ItemCatalog.KIND:
			removed_ids.append(str(definition_id_value))
	removed_ids.sort()
	var prepared := definition_store.prepare_generation(
		base_generation,
		definitions,
		Callable(),
		Callable(),
		removed_ids
	)
	if not prepared.get("ok", false):
		return _storage_failure("Vollständiger Items-Katalog konnte nicht vorbereitet werden.")
	var prepared_generation := int(prepared.get("generation", -1))
	var published := registry.publish_shared_definitions_generation(
		prepared_generation,
		int(registry_state.get("generation", -1))
	)
	if not published.get("ok", false):
		definition_store.discard_unselected_generation(prepared_generation)
		return {
			"ok": false,
			"status": "stale" if published.get("status", "") == "stale" else "storage_error",
			"error": "Items-Katalog wurde nicht veröffentlicht; der bisherige Katalog bleibt ausgewählt.",
		}
	return {
		"ok": true,
		"status": "imported",
		"item_count": definitions.size(),
		"equipment_count": int(normalized["equipment_count"]),
		"magic_item_count": int(normalized["magic_item_count"]),
		"shared_definitions_generation": prepared_generation,
	}


func _normalize_corpus(corpus: Dictionary) -> Dictionary:
	if not corpus.get("equipment_index") is Dictionary or not corpus.get("magic_item_index") is Dictionary:
		return _validation_failure("Beide öffentlichen Items-Indizes müssen vollständig vorliegen.")
	if not corpus.get("details") is Dictionary:
		return _validation_failure("Öffentliche Item-Details fehlen.")
	var equipment_paths := _index_paths(corpus["equipment_index"], EQUIPMENT_INDEX)
	if not equipment_paths.get("ok", false):
		return equipment_paths
	var magic_paths := _index_paths(corpus["magic_item_index"], MAGIC_ITEM_INDEX)
	if not magic_paths.get("ok", false):
		return magic_paths
	var details: Dictionary = corpus["details"]
	if details.size() != equipment_paths["paths"].size() + magic_paths["paths"].size():
		return _validation_failure("Der Items-Import enthält nicht genau alle referenzierten Details.")
	var definitions: Array = []
	var identities := {}
	var source_keys := {}
	for path_value in equipment_paths["paths"]:
		var path := str(path_value)
		if not details.get(path) is Dictionary:
			return _validation_failure("Ein referenziertes Equipment-Detail fehlt.")
		var parsed := _parse_equipment(details[path], path)
		if not parsed.get("ok", false):
			return parsed
		var accepted := _accept_definition(parsed["definition"], identities, source_keys)
		if not accepted.get("ok", false):
			return accepted
		definitions.append(parsed["definition"])
	for path_value in magic_paths["paths"]:
		var path := str(path_value)
		if not details.get(path) is Dictionary:
			return _validation_failure("Ein referenziertes Magic-Item-Detail fehlt.")
		var parsed := _parse_magic_item(details[path], path)
		if not parsed.get("ok", false):
			return parsed
		var accepted := _accept_definition(parsed["definition"], identities, source_keys)
		if not accepted.get("ok", false):
			return accepted
		definitions.append(parsed["definition"])
	definitions.sort_custom(func(left: Dictionary, right: Dictionary) -> bool:
		return str(left["definition_id"]) < str(right["definition_id"])
	)
	return {
		"ok": true,
		"definitions": definitions,
		"equipment_count": equipment_paths["paths"].size(),
		"magic_item_count": magic_paths["paths"].size(),
	}


func _index_paths(index: Dictionary, endpoint: String) -> Dictionary:
	if not index.get("results") is Array:
		return _validation_failure("Öffentlicher Items-Index besitzt kein Ergebnisfeld.")
	var paths: Array[String] = []
	for value in index["results"]:
		if not value is Dictionary:
			return _validation_failure("Öffentlicher Items-Index enthält einen ungültigen Eintrag.")
		var path := str(value.get("url", ""))
		if not path.begins_with(endpoint + "/") or path in paths:
			return _validation_failure("Öffentlicher Items-Index enthält einen fremden oder doppelten Detailpfad.")
		paths.append(path)
	var count = index.get("count")
	if not _whole_number(count) or int(count) != paths.size() or paths.is_empty():
		return _validation_failure("Öffentlicher Items-Index ist unvollständig.")
	return {"ok": true, "paths": paths}


func _parse_equipment(document: Dictionary, expected_path: String) -> Dictionary:
	var common := _common_identity(document, expected_path, "equipment", "item.equipment.")
	if not common.get("ok", false):
		return common
	var category := _object_name(document.get("equipment_category"))
	if category.is_empty():
		return _validation_failure("Equipment besitzt keine Kategorie.")
	var cost := _parse_cost(document.get("cost"))
	if not cost.get("ok", false):
		return cost
	var subcategory := ""
	for field in ["gear_category", "tool_category"]:
		subcategory = _object_name(document.get(field))
		if not subcategory.is_empty():
			break
	if subcategory.is_empty():
		for field in ["weapon_category", "armor_category", "vehicle_category"]:
			subcategory = str(document.get(field, "")).strip_edges()
			if not subcategory.is_empty():
				break
	var damage := ""
	if document.get("damage") is Dictionary:
		damage = "%s %s" % [
			str(document["damage"].get("damage_dice", "")),
			_object_name(document["damage"].get("damage_type")),
		]
		damage = damage.strip_edges()
	var armor_class := ""
	if document.get("armor_class") is Dictionary and document["armor_class"].has("base"):
		armor_class = "AC %s" % _number_text(document["armor_class"]["base"])
	var properties := _object_names(document.get("properties", []))
	if not properties.get("ok", false):
		return properties
	var description := _description(document.get("desc", []))
	if not description.get("ok", false):
		return description
	var weight = document.get("weight")
	if weight != null and (not _number(weight) or float(weight) < 0.0):
		return _validation_failure("Equipment besitzt ein ungültiges Gewicht.")
	return _build_definition(common, {
		"category": category,
		"subcategory": subcategory,
		"magic": false,
		"rarity": "",
		"attunement": false,
		"cost_cp": cost["cost_cp"],
		"cost_display": cost["cost_display"],
		"weight": weight,
		"damage": damage,
		"armor_class": armor_class,
		"properties": properties["values"],
		"description": description["text"],
	})


func _parse_magic_item(document: Dictionary, expected_path: String) -> Dictionary:
	var common := _common_identity(document, expected_path, "magic-item", "item.magic-item.")
	if not common.get("ok", false):
		return common
	var category := _object_name(document.get("equipment_category"))
	if category.is_empty():
		return _validation_failure("Magic Item besitzt keine Kategorie.")
	var description := _description(document.get("desc", []))
	if not description.get("ok", false):
		return description
	return _build_definition(common, {
		"category": category,
		"subcategory": "Magic Item",
		"magic": true,
		"rarity": _object_name(document.get("rarity")),
		"attunement": str(description["text"]).to_lower().contains("requires attunement"),
		"cost_cp": null,
		"cost_display": "",
		"weight": null,
		"damage": "",
		"armor_class": "",
		"properties": [],
		"description": description["text"],
	})


func _common_identity(
	document: Dictionary,
	expected_path: String,
	source_prefix: String,
	definition_prefix: String
) -> Dictionary:
	var index := str(document.get("index", "")).strip_edges()
	var name := str(document.get("name", "")).strip_edges()
	var path := str(document.get("url", ""))
	if index.is_empty() or name.is_empty() or path != expected_path or not _safe_index(index):
		return _validation_failure("Öffentliches Item besitzt keine stabile, zum Index passende Identität.")
	return {
		"ok": true,
		"definition_id": definition_prefix + index,
		"source_key": source_prefix + ":" + index,
		"name": name,
		"source_url": API_ROOT + path,
	}


func _build_definition(common: Dictionary, facts: Dictionary) -> Dictionary:
	var projection := {
		"source_key": common["source_key"],
		"category": facts["category"],
		"subcategory": facts["subcategory"],
		"magic": facts["magic"],
		"rarity": facts["rarity"],
		"attunement": facts["attunement"],
		"cost_cp": facts["cost_cp"],
		"cost_display": facts["cost_display"],
	}
	var content := projection.duplicate(true)
	content.merge({
		"weight": facts["weight"],
		"damage": facts["damage"],
		"armor_class": facts["armor_class"],
		"properties": facts["properties"],
		"description": facts["description"],
		"source_version": SOURCE_VERSION,
		"source_url": common["source_url"],
	})
	var definition := {
		"definition_id": common["definition_id"],
		"kind": ItemCatalog.KIND,
		"name": common["name"],
		"catalog_projection": projection,
		"content": content,
	}
	var validation := ItemCatalog.new(_data_root).validate_import_definition(definition)
	return {"ok": true, "definition": definition} if validation.get("ok", false) else _validation_failure(str(validation.get("error", "Importiertes Item ist ungültig.")))


func _parse_cost(value: Variant) -> Dictionary:
	if not value is Dictionary:
		return {"ok": true, "cost_cp": null, "cost_display": ""}
	var quantity = value.get("quantity")
	var unit := str(value.get("unit", "")).to_lower()
	if not _whole_number(quantity) or int(quantity) < 0 or unit not in ["cp", "sp", "ep", "gp", "pp"]:
		return _validation_failure("Equipment besitzt ungültige Kosten.")
	var factor: int = int({"cp": 1, "sp": 10, "ep": 50, "gp": 100, "pp": 1000}[unit])
	return {
		"ok": true,
		"cost_cp": int(quantity) * factor,
		"cost_display": "%d %s" % [int(quantity), unit],
	}


func _description(value: Variant) -> Dictionary:
	if not value is Array:
		return _validation_failure("Item-Beschreibung ist keine Textliste.")
	var paragraphs := PackedStringArray()
	for paragraph in value:
		if not paragraph is String:
			return _validation_failure("Item-Beschreibung enthält Nicht-Text.")
		paragraphs.append(str(paragraph))
	return {"ok": true, "text": "\n\n".join(paragraphs)}


func _object_names(value: Variant) -> Dictionary:
	if not value is Array:
		return _validation_failure("Item-Eigenschaften sind keine Liste.")
	var names: Array[String] = []
	for entry in value:
		var name := _object_name(entry)
		if name.is_empty():
			return _validation_failure("Item-Eigenschaft besitzt keinen Namen.")
		if name not in names:
			names.append(name)
	return {"ok": true, "values": names}


func _object_name(value: Variant) -> String:
	return str(value.get("name", "")).strip_edges() if value is Dictionary else ""


func _accept_definition(definition: Dictionary, identities: Dictionary, source_keys: Dictionary) -> Dictionary:
	var definition_id := str(definition["definition_id"])
	var source_key := str(definition["catalog_projection"]["source_key"])
	if identities.has(definition_id) or source_keys.has(source_key):
		return _validation_failure("Öffentlicher Items-Korpus enthält eine doppelte stabile Identität.")
	identities[definition_id] = true
	source_keys[source_key] = true
	return {"ok": true}


func _safe_index(value: String) -> bool:
	if value.is_empty() or value.length() > 120:
		return false
	for index in value.length():
		var code := value.unicode_at(index)
		if not ((code >= 97 and code <= 122) or (code >= 48 and code <= 57) or code == 45 or code == 95):
			return false
	return true


func _number(value: Variant) -> bool:
	return value is int or value is float


func _whole_number(value: Variant) -> bool:
	return value is int or (value is float and is_equal_approx(float(value), floorf(float(value))))


func _number_text(value: Variant) -> String:
	return str(int(value)) if _whole_number(value) else str(value)


func _validation_failure(message: String) -> Dictionary:
	return {"ok": false, "status": "validation_error", "error": message}


func _storage_failure(message: String) -> Dictionary:
	return {"ok": false, "status": "storage_error", "error": message}
