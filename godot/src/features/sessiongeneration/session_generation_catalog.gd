class_name SessionGenerationCatalog
extends RefCounted

## Validates and caches the complete shipped Session Generation TSV artifact.

const CATALOG_VERSION := "catalog-2026-07-16"
const ROOT := "res://resources/sessiongeneration/%s" % CATALOG_VERSION
const REQUIRED_TABLES := [
	"DB_CR.tsv",
	"DB_Containers.tsv",
	"DB_EncounterPatterns.tsv",
	"DB_EncounterRoleBands.tsv",
	"DB_EnspelledRules.tsv",
	"DB_LootItems.tsv",
	"DB_LootModifiers.tsv",
	"DB_LootRelations.tsv",
	"DB_LootSources.tsv",
	"DB_MagicCurses.tsv",
	"DB_MagicDecisionTypes.tsv",
	"DB_MagicItems.tsv",
	"DB_MagicVariants.tsv",
	"DB_Progression.tsv",
	"DB_Spells.tsv",
	"DB_Themes.tsv",
]
const IDENTITY_COLUMNS := {
	"DB_Progression.tsv": "Level_ID",
	"DB_CR.tsv": "CR_ID",
	"DB_EncounterRoleBands.tsv": "Role_Band_ID",
	"DB_EncounterPatterns.tsv": "Pattern_ID",
	"DB_LootItems.tsv": "Item_ID",
	"DB_LootModifiers.tsv": "Modifier_ID",
	"DB_Themes.tsv": "Theme_ID",
	"DB_MagicItems.tsv": "Magic_Item_ID",
	"DB_MagicVariants.tsv": "Magic_Variant_ID",
	"DB_MagicDecisionTypes.tsv": "Decision_Type_ID",
	"DB_Spells.tsv": "Spell_ID",
	"DB_Containers.tsv": "Container_ID",
	"DB_EnspelledRules.tsv": "Rule_ID",
	"DB_MagicCurses.tsv": "Curse_ID",
	"DB_LootSources.tsv": "Source_ID",
}

static var _cache: Dictionary = {}
static var _cache_mutex := Mutex.new()


func load(cancellation: Callable = Callable()) -> Dictionary:
	_cache_mutex.lock()
	var cached: Dictionary = _cache
	_cache_mutex.unlock()
	if not cached.is_empty():
		return {"ok": true, "status": "cached", "snapshot": cached.duplicate(true)}
	var loaded := _load_verified(cancellation)
	if not loaded.get("ok", false):
		return loaded
	_cache_mutex.lock()
	if _cache.is_empty():
		_cache = loaded["snapshot"].duplicate(true)
	cached = _cache
	_cache_mutex.unlock()
	return {"ok": true, "status": "loaded", "snapshot": cached.duplicate(true)}


func clear_cache_for_tests() -> void:
	_cache_mutex.lock()
	_cache.clear()
	_cache_mutex.unlock()


func _load_verified(cancellation: Callable) -> Dictionary:
	if _cancelled(cancellation):
		return _cancelled_result()
	var manifest_read := _read_text(ROOT + "/manifest.json")
	if not manifest_read.get("ok", false):
		return manifest_read
	var parsed = JSON.parse_string(manifest_read["text"])
	if not parsed is Dictionary:
		return _failure("Session-Generation-Katalogmanifest ist ungültig.")
	var manifest: Dictionary = parsed
	if (
		manifest.get("catalogVersion", "") != CATALOG_VERSION
		or not _sha256(str(manifest.get("catalogContentHash", "")))
		or not _sha256(str(manifest.get("sourceSha256", "")))
		or not str(manifest.get("sourceUrl", "")).begins_with("https://")
		or not manifest.get("tables", null) is Array
	):
		return _failure("Session-Generation-Katalogmanifest besitzt ungültige Herkunft.")
	var specs_by_file := {}
	for spec_value in manifest["tables"]:
		if not spec_value is Dictionary:
			return _failure("Session-Generation-Kataloginventar ist ungültig.")
		var spec: Dictionary = spec_value
		var file_name := str(spec.get("file", ""))
		if (
			file_name not in REQUIRED_TABLES
			or specs_by_file.has(file_name)
			or str(spec.get("name", "")) != file_name.trim_suffix(".tsv")
			or not _positive_integral(spec.get("rows", null))
			or not _positive_integral(spec.get("columns", null))
			or not _sha256(str(spec.get("sha256", "")))
		):
			return _failure("Session-Generation-Kataloginventar ist ungültig.")
		specs_by_file[file_name] = spec
	if specs_by_file.size() != REQUIRED_TABLES.size():
		return _failure("Session-Generation-Kataloginventar ist unvollständig.")
	if _content_hash(CATALOG_VERSION, specs_by_file) != manifest["catalogContentHash"]:
		return _failure("Session-Generation-Kataloginventar besitzt einen ungültigen Inhaltsfingerprint.")
	var tables := {}
	for file_name_value in REQUIRED_TABLES:
		var file_name := str(file_name_value)
		if _cancelled(cancellation):
			return _cancelled_result()
		var path: String = ROOT + "/" + file_name
		if FileAccess.get_sha256(path) != specs_by_file[file_name]["sha256"]:
			return _failure("Session-Generation-Katalogdatei ist beschädigt: %s" % file_name)
		var text_read := _read_text(path)
		if not text_read.get("ok", false):
			return text_read
		var table := _parse_table(text_read["text"], file_name)
		if not table.get("ok", false):
			return table
		if table["rows"].size() != int(specs_by_file[file_name]["rows"]) or table["header"].size() != int(specs_by_file[file_name]["columns"]):
			return _failure("Session-Generation-Katalogdimensionen widersprechen dem Manifest: %s" % file_name)
		tables[file_name] = table
	var semantic := _validate_semantics(tables, cancellation)
	if not semantic.get("ok", false):
		return semantic
	return {
		"ok": true,
		"snapshot": {
			"catalog_version": CATALOG_VERSION,
			"content_hash": manifest["catalogContentHash"],
			"source_sha256": manifest["sourceSha256"],
			"source_url": manifest["sourceUrl"],
			"tables": tables,
		},
	}


func _validate_semantics(tables: Dictionary, cancellation: Callable) -> Dictionary:
	for file_name_value in IDENTITY_COLUMNS:
		var file_name := str(file_name_value)
		var seen := {}
		for row in tables[file_name]["rows"]:
			if _cancelled(cancellation):
				return _cancelled_result()
			var identity := str(row.get(IDENTITY_COLUMNS[file_name], ""))
			if identity.is_empty() or seen.has(identity):
				return _failure("Session-Generation-Katalog enthält eine leere oder doppelte Identität in %s." % file_name)
			seen[identity] = true
	var levels := {}
	for row in tables["DB_Progression.tsv"]["rows"]:
		var level := _integer(row.get("Level", ""))
		if level < 1 or level > 20 or levels.has(level):
			return _failure("Session-Generation-Katalog braucht genau die Stufen 1 bis 20.")
		levels[level] = true
	if levels.size() != 20:
		return _failure("Session-Generation-Katalog braucht genau die Stufen 1 bis 20.")
	var ranks := {}
	for row in _active_rows(tables, "DB_CR.tsv"):
		ranks[row["CR_ID"]] = true
	for row in _active_rows(tables, "DB_EncounterRoleBands.tsv"):
		if not ranks.has(row["CR_ID"]):
			return _failure("Session-Generation-Rollenband verweist auf einen fehlenden HG.")
	for file_name in ["DB_EncounterPatterns.tsv", "DB_LootItems.tsv", "DB_Themes.tsv", "DB_MagicItems.tsv", "DB_Spells.tsv", "DB_Containers.tsv", "DB_EnspelledRules.tsv", "DB_MagicCurses.tsv"]:
		if _active_rows(tables, file_name).is_empty() and file_name != "DB_Spells.tsv":
			return _failure("Session-Generation-Katalogfamilie ist leer: %s" % file_name)
		if file_name == "DB_Spells.tsv" and tables[file_name]["rows"].is_empty():
			return _failure("Session-Generation-Katalogfamilie ist leer: %s" % file_name)
	var relation_types := {"ITEM_CONTAINER": true, "MODIFIER_CATEGORY": true, "MODIFIER_PROFILE": true, "THEME_CATEGORY": true}
	var relation_keys := {}
	for row in _active_rows(tables, "DB_LootRelations.tsv"):
		var relation_type := str(row["Relation_Type"])
		var key := "%s|%s|%s" % [relation_type, row["Source_ID"], row["Target_ID"]]
		if not relation_types.has(relation_type) or relation_keys.has(key):
			return _failure("Session-Generation-Katalog enthält eine ungültige Loot-Relation.")
		relation_keys[key] = true
	var decision_codes := {}
	for row in _active_rows(tables, "DB_MagicDecisionTypes.tsv"):
		decision_codes[str(row["Decision_Type"])] = true
	for required in ["none", "spell_level", "variant_group", "fixed_variant", "enspelled_item"]:
		if not decision_codes.has(required):
			return _failure("Session-Generation-Katalog besitzt kein vollständiges Magic-Vokabular.")
	if decision_codes.size() != 5:
		return _failure("Session-Generation-Katalog besitzt unbekannte Magic-Entscheidungen.")
	return {"ok": true}


func rows(snapshot: Dictionary, file_name: String, active_only: bool = true) -> Array:
	if not snapshot.get("tables", {}).has(file_name):
		return []
	return (
		_active_rows(snapshot["tables"], file_name)
		if active_only and "Active" in snapshot["tables"][file_name]["header"]
		else snapshot["tables"][file_name]["rows"].duplicate(true)
	)


func decimal(row: Dictionary, field: String) -> float:
	var text := str(row.get(field, "")).strip_edges()
	return 0.0 if text.is_empty() else text.to_float()


func integer(row: Dictionary, field: String) -> int:
	return _integer(row.get(field, ""))


func list(row: Dictionary, field: String, separator: String = ",") -> Array[String]:
	var result: Array[String] = []
	for value in str(row.get(field, "")).split(separator, false):
		var normalized := value.strip_edges()
		if not normalized.is_empty():
			result.append(normalized)
	return result


func _active_rows(tables: Dictionary, file_name: String) -> Array:
	var result: Array = []
	for row in tables[file_name]["rows"]:
		if not row.has("Active") or row["Active"] == "true":
			result.append(row)
	return result


func _parse_table(text: String, file_name: String) -> Dictionary:
	var lines := text.replace("\r\n", "\n").replace("\r", "\n").split("\n", false)
	if lines.is_empty():
		return _failure("Session-Generation-Katalogdatei ist leer: %s" % file_name)
	var header_values := str(lines[0]).split("\t", true)
	var header: Array[String] = []
	var header_seen := {}
	for value in header_values:
		var name := str(value)
		if name.is_empty() or header_seen.has(name):
			return _failure("Session-Generation-Katalogkopf ist ungültig: %s" % file_name)
		header.append(name)
		header_seen[name] = true
	var rows: Array = []
	for line_index in range(1, lines.size()):
		var values := str(lines[line_index]).split("\t", true)
		if values.size() > header.size():
			return _failure("Session-Generation-Katalogzeile besitzt zu viele Spalten: %s:%d" % [file_name, line_index + 1])
		var row := {}
		for index in header.size():
			row[header[index]] = str(values[index]) if index < values.size() else ""
		rows.append(row)
	return {"ok": true, "header": header, "rows": rows}


func _content_hash(version: String, specs: Dictionary) -> String:
	var files: Array = specs.keys()
	files.sort()
	var canonical := "catalogVersion\t%s\n" % version
	for file_name_value in files:
		var file_name := str(file_name_value)
		var spec: Dictionary = specs[file_name]
		canonical += "%s\t%s\t%d\t%d\t%s\n" % [
			file_name, spec["name"], int(spec["rows"]), int(spec["columns"]), spec["sha256"],
		]
	var context := HashingContext.new()
	context.start(HashingContext.HASH_SHA256)
	context.update(canonical.to_utf8_buffer())
	return context.finish().hex_encode()


func _read_text(path: String) -> Dictionary:
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return _failure("Session-Generation-Katalogdatei ist nicht lesbar: %s" % path.get_file())
	var text := file.get_as_text()
	file.close()
	return {"ok": true, "text": text}


func _integer(value: Variant) -> int:
	var text := str(value).strip_edges()
	if text.is_empty() or not text.is_valid_float():
		return -2_147_483_648
	return roundi(text.to_float())


func _positive_integral(value: Variant) -> bool:
	if not value is int and not value is float:
		return false
	return is_finite(float(value)) and float(value) > 0 and is_equal_approx(float(value), roundf(float(value)))


func _sha256(value: String) -> bool:
	if value.length() != 64:
		return false
	for character in value:
		if character not in "0123456789abcdef":
			return false
	return true


func _cancelled(callback: Callable) -> bool:
	return callback.is_valid() and callback.call()


func _cancelled_result() -> Dictionary:
	return {"ok": false, "status": "cancelled", "error": "Session-Generation-Katalogladen wurde ersetzt."}


func _failure(message: String) -> Dictionary:
	return {"ok": false, "status": "catalog_failure", "error": message}
