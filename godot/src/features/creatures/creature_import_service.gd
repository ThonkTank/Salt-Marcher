class_name CreatureImportService
extends RefCounted

## Validates the complete pinned SRD corpus before one atomic Creature cutover.

const FileCampaignRegistry = preload("res://godot/src/platform/persistence/file_campaign_registry.gd")
const SharedDefinitionStore = preload("res://godot/src/platform/persistence/shared_definition_store.gd")
const CreatureCatalog = preload("res://godot/src/features/creatures/creature_catalog.gd")
const Open5eSrd2014CreatureSource = preload("res://godot/src/features/creatures/open5e_srd2014_creature_source.gd")

const API_ROOT := "https://api.open5e.com/v2/creatures/"
const DOCUMENT_KEY := "srd-2014"
const SOURCE_VERSION := "Open5e V2 · 5e 2014 Rules"

var _data_root: String


func _init(data_root: String = "user://salt-marcher") -> void:
	_data_root = data_root.trim_suffix("/")


func import_public_corpus(progress_callback: Callable = Callable()) -> Dictionary:
	var fetched := Open5eSrd2014CreatureSource.new().fetch_corpus(progress_callback)
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
		return _storage_failure("Installationsstatus konnte vor dem Monster-Import nicht gelesen werden.")
	var base_generation := int(registry_state.get("shared_definitions_generation", 0))
	var definition_store := SharedDefinitionStore.new(_data_root)
	var current := definition_store.load_generation(base_generation)
	if not current.get("ok", false):
		return _storage_failure("Aktuelle Shared Definitions konnten vor dem Monster-Import nicht gelesen werden.")
	var removed_ids: Array[String] = []
	for definition_id_value in current["definitions"]:
		if current["definitions"][definition_id_value].get("kind", "") == CreatureCatalog.KIND:
			removed_ids.append(str(definition_id_value))
	removed_ids.sort()
	var prepared := definition_store.prepare_generation(base_generation, definitions, Callable(), Callable(), removed_ids)
	if not prepared.get("ok", false):
		return _storage_failure("Vollständiger Monster-Katalog konnte nicht vorbereitet werden.")
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
			"error": "Monster-Katalog wurde nicht veröffentlicht; der bisherige Katalog bleibt ausgewählt.",
		}
	return {
		"ok": true,
		"status": "imported",
		"creature_count": definitions.size(),
		"source_document": DOCUMENT_KEY,
		"shared_definitions_generation": prepared_generation,
	}


func _normalize_corpus(corpus: Dictionary) -> Dictionary:
	if not corpus.get("source_document") is Dictionary or not corpus.get("results") is Array:
		return _validation_failure("Öffentlicher Monster-Korpus ist unvollständig.")
	var source := _normalize_source_document(corpus["source_document"])
	if not source.get("ok", false):
		return source
	var count = corpus.get("count")
	var results: Array = corpus["results"]
	if not _whole_number(count) or int(count) != results.size() or results.is_empty():
		return _validation_failure("Öffentlicher Monster-Korpus besitzt keine vollständige Gesamtzahl.")
	var definitions: Array = []
	var identities := {}
	var source_keys := {}
	for value in results:
		if not value is Dictionary:
			return _validation_failure("Öffentlicher Monster-Korpus enthält einen ungültigen Eintrag.")
		var parsed := _parse_creature(value, source)
		if not parsed.get("ok", false):
			return parsed
		var definition: Dictionary = parsed["definition"]
		var definition_id := str(definition["definition_id"])
		var source_key := str(definition["catalog_projection"]["source_key"])
		if identities.has(definition_id) or source_keys.has(source_key):
			return _validation_failure("Öffentlicher Monster-Korpus enthält eine doppelte stabile Identität.")
		identities[definition_id] = true
		source_keys[source_key] = true
		definitions.append(definition)
	definitions.sort_custom(func(left: Dictionary, right: Dictionary) -> bool:
		return str(left["definition_id"]) < str(right["definition_id"])
	)
	return {"ok": true, "definitions": definitions}


func _normalize_source_document(document: Dictionary) -> Dictionary:
	if str(document.get("key", "")) != DOCUMENT_KEY or not document.get("licenses") is Array:
		return _validation_failure("Monster-Quelle ist nicht das festgelegte 2014-SRD-Dokument.")
	var licenses: Array[String] = []
	for value in document["licenses"]:
		var name := _object_name(value)
		if name.is_empty():
			return _validation_failure("Monster-Quelle besitzt eine ungültige Lizenzangabe.")
		licenses.append(name)
	if licenses.is_empty():
		return _validation_failure("Monster-Quelle besitzt keine Lizenzangabe.")
	var permalink := str(document.get("permalink", "")).strip_edges()
	if not permalink.begins_with("https://"):
		return _validation_failure("Monster-Quelle besitzt keinen gültigen Herkunftslink.")
	return {
		"ok": true,
		"licenses": licenses,
		"name": str(document.get("name", "")).strip_edges(),
		"display_name": str(document.get("display_name", "")).strip_edges(),
		"permalink": permalink,
	}


func _parse_creature(document: Dictionary, source: Dictionary) -> Dictionary:
	var key := str(document.get("key", "")).strip_edges()
	var name := str(document.get("name", "")).strip_edges()
	if not _safe_key(key) or name.is_empty():
		return _validation_failure("Öffentliches Monster besitzt keine stabile Identität.")
	if not document.get("document") is Dictionary or str(document["document"].get("key", "")) != DOCUMENT_KEY:
		return _validation_failure("Öffentliches Monster gehört nicht zum festgelegten 2014-SRD-Dokument.")
	var creature_type := _object_name(document.get("type"))
	var size := _object_name(document.get("size"))
	var subtype := "" if document.get("subcategory") == null else str(document.get("subcategory", "")).strip_edges()
	var alignment := str(document.get("alignment", "")).strip_edges()
	var challenge_decimal = document.get("challenge_rating")
	var xp = document.get("experience_points")
	if creature_type.is_empty() or size.is_empty() or not _number(challenge_decimal) or float(challenge_decimal) < 0.0:
		return _validation_failure("Öffentliches Monster besitzt eine ungültige Klassifikation.")
	if not _whole_number(xp) or int(xp) < 0:
		return _validation_failure("Öffentliches Monster besitzt ungültige Erfahrungspunkte.")
	var environments := _object_names(document.get("environments", []))
	if not environments.get("ok", false):
		return environments
	var hit_dice := _parse_hit_dice(document.get("hit_dice"))
	if not hit_dice.get("ok", false):
		return hit_dice
	for number_field in ["hit_points", "armor_class"]:
		if not _whole_number(document.get(number_field)) or int(document[number_field]) < 0:
			return _validation_failure("Öffentliches Monster besitzt ungültige Treffer- oder Rüstungspunkte.")
	var initiative = document.get("initiative_bonus")
	if not _whole_number(initiative):
		return _validation_failure("Öffentliches Monster besitzt einen ungültigen Initiativebonus.")
	var ability_scores := _numeric_map(document.get("ability_scores"), [
		"strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma",
	], true)
	if not ability_scores.get("ok", false):
		return ability_scores
	var saving_throws := _numeric_map(document.get("saving_throws", {}), [], false)
	var skills := _numeric_map(document.get("skill_bonuses", {}), [], false)
	if not saving_throws.get("ok", false) or not skills.get("ok", false):
		return _validation_failure("Öffentliches Monster besitzt ungültige Rettungswurf- oder Fertigkeitswerte.")
	var traits := _named_text_entries(document.get("traits", []), false)
	var actions := _named_text_entries(document.get("actions", []), true)
	if not traits.get("ok", false) or not actions.get("ok", false):
		return _validation_failure("Öffentliches Monster besitzt einen ungültigen Statblockabschnitt.")
	var speed := _speed_map(document.get("speed_all", {}))
	if not speed.get("ok", false):
		return speed
	var resistances := _resistances(document.get("resistances_and_immunities", {}))
	if not resistances.get("ok", false):
		return resistances
	var languages := ""
	if document.get("languages") is Dictionary:
		languages = str(document["languages"].get("as_string", "")).strip_edges()
	var challenge_label := _challenge_label(float(challenge_decimal))
	var projection := {
		"source_key": key,
		"creature_type": creature_type,
		"size": size,
		"subtype": subtype,
		"alignment": alignment,
		"challenge_rating": challenge_label,
		"challenge_rating_decimal": float(challenge_decimal),
		"xp": int(xp),
		"environments": environments["values"],
	}
	var content := projection.duplicate(true)
	content.merge({
		"hit_points": int(document["hit_points"]),
		"hit_dice": hit_dice["display"],
		"hit_dice_count": hit_dice["count"],
		"hit_dice_sides": hit_dice["sides"],
		"hit_dice_modifier": hit_dice["modifier"],
		"armor_class": int(document["armor_class"]),
		"armor_detail": str(document.get("armor_detail", "")).strip_edges(),
		"initiative_bonus": int(initiative),
		"legendary_action_count": _legendary_action_count(actions["values"]),
		"ability_scores": ability_scores["values"],
		"saving_throws": saving_throws["values"],
		"skills": skills["values"],
		"speed": speed["values"],
		"senses": _senses(document),
		"passive_perception": int(document.get("passive_perception", 0)) if _whole_number(document.get("passive_perception", 0)) else 0,
		"languages": languages,
		"resistances_and_immunities": resistances["values"],
		"traits": traits["values"],
		"actions": actions["values"],
		"source_document": DOCUMENT_KEY,
		"source_version": SOURCE_VERSION,
		"source_licenses": source["licenses"].duplicate(),
		"source_permalink": source["permalink"],
		"source_url": API_ROOT + key + "/",
	})
	var definition := {
		"definition_id": "creature.open5e." + key,
		"kind": CreatureCatalog.KIND,
		"name": name,
		"catalog_projection": projection,
		"content": content,
	}
	var validation := CreatureCatalog.new(_data_root).validate_import_definition(definition)
	if not validation.get("ok", false):
		return _validation_failure(str(validation.get("error", "Importiertes Monster ist ungültig.")))
	return {"ok": true, "definition": definition}


func _parse_hit_dice(value: Variant) -> Dictionary:
	if value == null:
		return {"ok": true, "display": "", "count": 0, "sides": 0, "modifier": 0}
	if not value is String:
		return _validation_failure("Öffentliches Monster besitzt ungültige Trefferwürfel.")
	var expression := RegEx.new()
	if expression.compile("^([0-9]+)d([0-9]+)([+-][0-9]+)?$") != OK:
		return _validation_failure("Hit-Dice-Parser konnte nicht initialisiert werden.")
	var match := expression.search(str(value).strip_edges())
	if match == null:
		return _validation_failure("Öffentliches Monster besitzt ungültige Trefferwürfel.")
	return {
		"ok": true,
		"display": str(value).strip_edges(),
		"count": match.get_string(1).to_int(),
		"sides": match.get_string(2).to_int(),
		"modifier": 0 if match.get_string(3).is_empty() else match.get_string(3).to_int(),
	}


func _named_text_entries(value: Variant, include_action_type: bool) -> Dictionary:
	if not value is Array:
		return _validation_failure("Monster-Statblockabschnitt ist keine Liste.")
	var entries: Array = []
	for raw in value:
		if not raw is Dictionary:
			return _validation_failure("Monster-Statblockabschnitt enthält keinen Eintrag.")
		var name := str(raw.get("name", "")).strip_edges()
		var description = raw.get("desc")
		if name.is_empty() or not description is String:
			return _validation_failure("Monster-Statblockabschnitt enthält keinen Namen oder Text.")
		var entry := {"name": name, "desc": str(description)}
		if include_action_type:
			entry["action_type"] = str(raw.get("action_type", "ACTION"))
			entry["legendary_action_cost"] = int(raw.get("legendary_action_cost", 0)) if _whole_number(raw.get("legendary_action_cost", 0)) else 0
			entry["order"] = int(raw.get("order_in_statblock", 0)) if _whole_number(raw.get("order_in_statblock", 0)) else 0
		entries.append(entry)
	return {"ok": true, "values": entries}


func _legendary_action_count(actions: Array) -> int:
	for action in actions:
		if str(action.get("action_type", "")) == "LEGENDARY_ACTION":
			return 3
	return 0


func _numeric_map(value: Variant, required_keys: Array, non_negative: bool) -> Dictionary:
	if not value is Dictionary:
		return _validation_failure("Monster-Zahlenfeld ist kein Dokument.")
	var result := {}
	for key in required_keys:
		if not value.has(key):
			return _validation_failure("Monster-Zahlenfeld ist unvollständig.")
	for key in value:
		if not _whole_number(value[key]) or (non_negative and int(value[key]) < 0):
			return _validation_failure("Monster-Zahlenfeld enthält einen ungültigen Wert.")
		result[str(key)] = int(value[key])
	return {"ok": true, "values": result}


func _speed_map(value: Variant) -> Dictionary:
	if not value is Dictionary:
		return _validation_failure("Monster besitzt keine gültige Bewegung.")
	var result := {}
	for key in value:
		if key == "unit":
			result[key] = str(value[key])
		elif key == "hover":
			if not value[key] is bool:
				return _validation_failure("Monster-Bewegung besitzt einen ungültigen Hover-Wert.")
			result[key] = value[key]
		elif _number(value[key]) and float(value[key]) >= 0.0:
			result[key] = value[key]
		else:
			return _validation_failure("Monster-Bewegung besitzt einen ungültigen Wert.")
	return {"ok": true, "values": result}


func _senses(document: Dictionary) -> Dictionary:
	var result := {}
	for field in ["normal_sight_range", "darkvision_range", "blindsight_range", "tremorsense_range", "truesight_range"]:
		var value = document.get(field)
		result[field] = null if value == null else int(value) if _whole_number(value) and int(value) >= 0 else null
	return result


func _resistances(value: Variant) -> Dictionary:
	if not value is Dictionary:
		return _validation_failure("Monster besitzt keine gültigen Resistenzen.")
	var result := {}
	for field in ["damage_immunities", "damage_resistances", "damage_vulnerabilities", "condition_immunities"]:
		var names := _reference_names(value.get(field, []))
		if not names.get("ok", false):
			return names
		result[field] = names["values"]
	return {"ok": true, "values": result}


func _reference_names(value: Variant) -> Dictionary:
	if not value is Array:
		return _validation_failure("Monster-Referenzliste ist ungültig.")
	var result: Array[String] = []
	for entry in value:
		var name := str(entry).strip_edges() if entry is String else _object_name(entry)
		if name.is_empty():
			return _validation_failure("Monster-Referenzliste enthält einen ungültigen Wert.")
		result.append(name)
	return {"ok": true, "values": result}


func _object_names(value: Variant) -> Dictionary:
	if not value is Array:
		return _validation_failure("Monster-Auswahlliste ist ungültig.")
	var names: Array[String] = []
	for entry in value:
		var name := _object_name(entry)
		if name.is_empty():
			return _validation_failure("Monster-Auswahlliste enthält keinen Namen.")
		if name not in names:
			names.append(name)
	names.sort()
	return {"ok": true, "values": names}


func _object_name(value: Variant) -> String:
	return str(value.get("name", "")).strip_edges() if value is Dictionary else ""


func _challenge_label(value: float) -> String:
	if is_equal_approx(value, 0.125):
		return "1/8"
	if is_equal_approx(value, 0.25):
		return "1/4"
	if is_equal_approx(value, 0.5):
		return "1/2"
	return str(int(value)) if is_equal_approx(value, floorf(value)) else str(value)


func _safe_key(value: String) -> bool:
	if value.is_empty() or value.length() > 120:
		return false
	for index in value.length():
		var code := value.unicode_at(index)
		if not ((code >= 97 and code <= 122) or (code >= 48 and code <= 57) or code in [45, 95]):
			return false
	return true


func _number(value: Variant) -> bool:
	return value is int or value is float


func _whole_number(value: Variant) -> bool:
	return value is int or (value is float and is_equal_approx(float(value), floorf(float(value))))


func _validation_failure(message: String) -> Dictionary:
	return {"ok": false, "status": "validation_error", "error": message}


func _storage_failure(message: String) -> Dictionary:
	return {"ok": false, "status": "storage_error", "error": message}
