class_name EncounterTableKnowledge
extends RefCounted

## Pure Campaign owner for authored weighted Encounter Tables.

const FORMAT_ID := "saltmarcher.encounter-tables.v1"
const OWNER := "encountertables"
const KIND := "encounter_table"
const MAX_NAME_LENGTH := 160
const MAX_PAGE_SIZE := 200


func empty_payload() -> Dictionary:
	return {
		"format": FORMAT_ID,
		"records": {},
	}


func validate_payload(value: Variant) -> Dictionary:
	if not value is Dictionary:
		return _failure("Encounter-Table-Daten müssen ein Dokument sein.")
	var payload: Dictionary = value
	if payload.get("format", "") != FORMAT_ID or not payload.get("records", null) is Dictionary:
		return _failure("Encounter-Table-Daten besitzen kein unterstütztes Format.")
	for record_id_value in payload["records"]:
		var validation := _validate_record(str(record_id_value), payload["records"][record_id_value])
		if not validation.get("ok", false):
			return validation
	return {"ok": true, "payload": payload.duplicate(true)}


func query(
	payload_value: Variant,
	search_text: String = "",
	offset: int = 0,
	limit: int = 50,
	sort_key: String = "name",
	sort_ascending: bool = true,
	cancellation: Callable = Callable()
) -> Dictionary:
	if offset < 0 or limit <= 0 or limit > MAX_PAGE_SIZE or sort_key not in ["name", "identity"]:
		return _failure("Encounter-Table-Katalogabfrage besitzt ungültige Grenzen.")
	if _cancelled(cancellation):
		return _cancelled_failure()
	var validated := validate_payload(payload_value)
	if not validated.get("ok", false):
		return validated
	var needle := search_text.strip_edges().to_lower()
	var matching: Array = []
	for record_id_value in validated["payload"]["records"]:
		if _cancelled(cancellation):
			return _cancelled_failure()
		var record_id := str(record_id_value)
		var record: Dictionary = validated["payload"]["records"][record_id_value]
		if (
			not needle.is_empty()
			and not str(record["name"]).to_lower().contains(needle)
			and not record_id.contains(needle)
		):
			continue
		matching.append({
			"reference_id": record_id,
			"kind": KIND,
			"name": record["name"],
			"description": record["description"],
			"entry_count": record["entries"].size(),
			"linked_loot_table_id": record["linked_loot_table_id"],
			"updated_at_utc": record["updated_at_utc"],
		})
	matching.sort_custom(func(left: Dictionary, right: Dictionary) -> bool:
		var left_identity := str(left["reference_id"])
		var right_identity := str(right["reference_id"])
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
		"kind": KIND,
		"search_text": search_text,
		"offset": offset,
		"limit": limit,
		"sort_key": sort_key,
		"sort_ascending": sort_ascending,
		"total": matching.size(),
		"rows": rows,
	}


func read_table(
	payload_value: Variant,
	record_id: String,
	cancellation: Callable = Callable()
) -> Dictionary:
	if not _valid_id(record_id):
		return _failure("Encounter-Table-Detailabfrage besitzt keine gültige Identität.")
	if _cancelled(cancellation):
		return _cancelled_failure()
	var validated := validate_payload(payload_value)
	if not validated.get("ok", false):
		return validated
	if _cancelled(cancellation):
		return _cancelled_failure()
	var records: Dictionary = validated["payload"]["records"]
	if not records.has(record_id):
		return _missing(record_id)
	return {
		"ok": true,
		"status": "ready",
		"record": records[record_id].duplicate(true),
	}


func create_table(
	payload_value: Variant,
	raw_name: String,
	fields: Dictionary = {},
	record_id_override: String = "",
	now_utc: String = ""
) -> Dictionary:
	var validated := validate_payload(payload_value)
	if not validated.get("ok", false):
		return validated
	var name_validation := _validate_name(raw_name)
	if not name_validation.get("ok", false):
		return name_validation
	var record_id := (
		record_id_override
		if not record_id_override.is_empty()
		else "encounter_table.%s" % _new_identity()
	)
	if not _valid_id(record_id):
		return _failure("Encounter-Table-Identität ist ungültig.")
	var payload: Dictionary = validated["payload"]
	if payload["records"].has(record_id):
		return _failure("Encounter-Table-Identität existiert bereits.")
	var timestamp := now_utc if not now_utc.is_empty() else Time.get_datetime_string_from_system(true)
	var record := {
		"record_id": record_id,
		"kind": KIND,
		"name": str(name_validation["name"]),
		"description": "",
		"linked_loot_table_id": "",
		"entries": [],
		"created_at_utc": timestamp,
		"updated_at_utc": timestamp,
	}
	var patched := _apply_patch(record, fields)
	if not patched.get("ok", false):
		return patched
	record = patched["record"]
	record["created_at_utc"] = timestamp
	record["updated_at_utc"] = timestamp
	var next_payload: Dictionary = payload.duplicate(true)
	var records: Dictionary = payload["records"].duplicate(true)
	records[record_id] = record
	next_payload["records"] = records
	var next_validation := validate_payload(next_payload)
	if not next_validation.get("ok", false):
		return next_validation
	return {
		"ok": true,
		"status": "created",
		"record": record.duplicate(true),
		"payload": next_validation["payload"],
	}


func update_table(
	payload_value: Variant,
	record_id: String,
	fields: Dictionary,
	now_utc: String = ""
) -> Dictionary:
	var validated := validate_payload(payload_value)
	if not validated.get("ok", false):
		return validated
	var payload: Dictionary = validated["payload"]
	if not payload["records"].has(record_id):
		return _missing(record_id)
	var patched := _apply_patch(payload["records"][record_id], fields)
	if not patched.get("ok", false):
		return patched
	var record: Dictionary = patched["record"]
	record["updated_at_utc"] = now_utc if not now_utc.is_empty() else Time.get_datetime_string_from_system(true)
	var records: Dictionary = payload["records"].duplicate(true)
	records[record_id] = record
	var next_payload: Dictionary = payload.duplicate(true)
	next_payload["records"] = records
	var next_validation := validate_payload(next_payload)
	if not next_validation.get("ok", false):
		return next_validation
	return {
		"ok": true,
		"status": "updated",
		"record": record.duplicate(true),
		"payload": next_validation["payload"],
	}


func memberships_for_tables(
	payload_value: Variant,
	table_ids: Array,
	cancellation: Callable = Callable()
) -> Dictionary:
	var validated := validate_payload(payload_value)
	if not validated.get("ok", false):
		return validated
	if table_ids.is_empty():
		return {"ok": true, "status": "empty", "memberships": []}
	var seen_tables := {}
	var memberships: Array = []
	var records: Dictionary = validated["payload"]["records"]
	for table_id_value in table_ids:
		if _cancelled(cancellation):
			return _cancelled_failure()
		var table_id := str(table_id_value)
		if not _valid_id(table_id) or seen_tables.has(table_id):
			return _failure("Encounter-Table-Auswahl enthält ungültige oder doppelte Identitäten.")
		seen_tables[table_id] = true
		if not records.has(table_id):
			return _missing(table_id)
		for entry in records[table_id]["entries"]:
			memberships.append({
				"table_id": table_id,
				"creature_id": entry["creature_id"],
				"weight": entry["weight"],
			})
	return {
		"ok": true,
		"status": "empty" if memberships.is_empty() else "ready",
		"memberships": memberships,
	}


func _apply_patch(record_value: Variant, fields: Dictionary) -> Dictionary:
	if not record_value is Dictionary:
		return _failure("Encounter Table ist ungültig.")
	var record: Dictionary = record_value.duplicate(true)
	for field_value in fields:
		var field := str(field_value)
		if field not in ["name", "description", "linked_loot_table_id", "entries"]:
			return _failure("Feld %s gehört nicht zu Encounter Tables." % field)
		if field == "name":
			record[field] = str(fields[field_value]).strip_edges()
		elif field == "entries" and fields[field_value] is Array:
			var entries: Array = []
			for entry_value in fields[field_value]:
				if not entry_value is Dictionary:
					entries.append(entry_value)
					continue
				var raw_weight = entry_value.get("weight", null)
				entries.append({
					"creature_id": str(entry_value.get("creature_id", "")),
					"weight": int(raw_weight) if _valid_weight(raw_weight) else raw_weight,
				})
			entries.sort_custom(func(left: Variant, right: Variant) -> bool:
				if not left is Dictionary or not right is Dictionary:
					return false
				return str(left.get("creature_id", "")) < str(right.get("creature_id", ""))
			)
			record[field] = entries
		else:
			record[field] = fields[field_value]
	var validation := _validate_record(str(record.get("record_id", "")), record)
	if not validation.get("ok", false):
		return validation
	return {"ok": true, "record": record}


func _validate_record(record_id: String, value: Variant) -> Dictionary:
	if not _valid_id(record_id) or not value is Dictionary:
		return _failure("Encounter Table besitzt keine gültige Identität.")
	var record: Dictionary = value
	if (
		record.get("record_id", "") != record_id
		or record.get("kind", "") != KIND
		or not _validate_name(str(record.get("name", ""))).get("ok", false)
		or not record.get("description", null) is String
		or not _valid_optional_id(record.get("linked_loot_table_id", null))
		or not record.get("entries", null) is Array
		or not _valid_timestamp(str(record.get("created_at_utc", "")))
		or not _valid_timestamp(str(record.get("updated_at_utc", "")))
	):
		return _failure("Encounter Table %s besitzt ungültige Fachwerte." % record_id)
	var seen_creatures := {}
	for entry_value in record["entries"]:
		if not entry_value is Dictionary or entry_value.size() != 2:
			return _failure("Encounter Table %s besitzt einen ungültigen gewichteten Eintrag." % record_id)
		var creature_id := str(entry_value.get("creature_id", ""))
		if (
			not _valid_id(creature_id)
			or seen_creatures.has(creature_id)
			or not _valid_weight(entry_value.get("weight", null))
		):
			return _failure("Encounter Table %s besitzt einen ungültigen gewichteten Eintrag." % record_id)
		seen_creatures[creature_id] = true
	return {"ok": true}


func _validate_name(raw_name: String) -> Dictionary:
	var name := raw_name.strip_edges()
	if name.is_empty():
		return _failure("Der Name braucht mindestens ein sichtbares Zeichen.")
	if name.length() > MAX_NAME_LENGTH:
		return _failure("Der Name darf höchstens %d Zeichen enthalten." % MAX_NAME_LENGTH)
	return {"ok": true, "name": name}


func _valid_weight(value: Variant) -> bool:
	if not value is int and not value is float:
		return false
	var numeric := float(value)
	return is_equal_approx(numeric, roundf(numeric)) and numeric >= 1 and numeric <= 10


func _valid_optional_id(value: Variant) -> bool:
	return value is String and (str(value).is_empty() or _valid_id(str(value)))


func _valid_id(value: String) -> bool:
	if value.is_empty() or value.length() > 160:
		return false
	for index in value.length():
		var code := value.unicode_at(index)
		if not ((code >= 48 and code <= 57) or (code >= 97 and code <= 122) or code in [45, 46, 95]):
			return false
	return value not in [".", ".."]


func _valid_timestamp(value: String) -> bool:
	return not value.is_empty() and value.length() <= 64


func _new_identity() -> String:
	var bytes := Crypto.new().generate_random_bytes(16)
	bytes[6] = (bytes[6] & 0x0f) | 0x40
	bytes[8] = (bytes[8] & 0x3f) | 0x80
	var value := bytes.hex_encode()
	return "%s-%s-%s-%s-%s" % [
		value.substr(0, 8), value.substr(8, 4), value.substr(12, 4),
		value.substr(16, 4), value.substr(20, 12),
	]


func _cancelled(callback: Callable) -> bool:
	return callback.is_valid() and callback.call()


func _cancelled_failure() -> Dictionary:
	return {"ok": false, "status": "cancelled", "error": "Encounter-Table-Abfrage wurde ersetzt."}


func _missing(record_id: String) -> Dictionary:
	return {"ok": false, "status": "missing", "error": "Encounter Table fehlt: %s" % record_id}


func _failure(message: String) -> Dictionary:
	return {"ok": false, "status": "invalid", "error": message}
