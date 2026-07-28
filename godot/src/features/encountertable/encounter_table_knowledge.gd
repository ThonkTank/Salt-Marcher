class_name EncounterTableKnowledge
extends RefCounted

## Pure Campaign owner for authored weighted Encounter Tables.

const FORMAT_ID := "saltmarcher.encounter-tables.v1"
const OWNER := "encountertables"
const KIND := "encounter_table"
const MAX_NAME_LENGTH := 160
const MAX_PAGE_SIZE := 200
const WorldPlannerKnowledge = preload("res://godot/src/features/worldplanner/world_planner_knowledge.gd")


func empty_payload() -> Dictionary:
	return {
		"format": FORMAT_ID,
		"records": {},
		"trash": {},
	}


func validate_payload(value: Variant) -> Dictionary:
	if not value is Dictionary:
		return _failure("Encounter-Table-Daten müssen ein Dokument sein.")
	var payload: Dictionary = value
	if (
		payload.get("format", "") != FORMAT_ID
		or not payload.get("records", null) is Dictionary
		or not payload.get("trash", null) is Dictionary
	):
		return _failure("Encounter-Table-Daten besitzen kein unterstütztes Format.")
	for record_id_value in payload["records"]:
		var validation := _validate_record(str(record_id_value), payload["records"][record_id_value])
		if not validation.get("ok", false):
			return validation
	for record_id_value in payload["trash"]:
		var record_id := str(record_id_value)
		var entry = payload["trash"][record_id_value]
		if (
			not entry is Dictionary
			or entry.size() != 3
			or payload["records"].has(record_id)
			or not _valid_timestamp(str(entry.get("deleted_at_utc", "")))
			or not entry.get("incoming_links", null) is Array
		):
			return _failure("Encounter-Table-Papierkorb enthält einen ungültigen Eintrag.")
		var record_validation := _validate_record(record_id, entry.get("record", null))
		if not record_validation.get("ok", false):
			return record_validation
		for link in entry["incoming_links"]:
			if not _valid_incoming_link(link):
				return _failure("Encounter-Table-Papierkorb enthält einen ungültigen World-Planner-Verweis.")
	return {"ok": true, "payload": payload.duplicate(true)}


func query(
	payload_value: Variant,
	search_text: String = "",
	offset: int = 0,
	limit: int = 50,
	include_deleted: bool = false,
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
	var payload: Dictionary = validated["payload"]
	var source: Dictionary = payload["trash"] if include_deleted else payload["records"]
	var needle := search_text.strip_edges().to_lower()
	var matching: Array = []
	for record_id_value in source:
		if _cancelled(cancellation):
			return _cancelled_failure()
		var record_id := str(record_id_value)
		var record: Dictionary = source[record_id_value]["record"] if include_deleted else source[record_id_value]
		if (
			not needle.is_empty()
			and not str(record["name"]).to_lower().contains(needle)
			and not record_id.contains(needle)
		):
			continue
		var row := {
			"reference_id": record_id,
			"kind": KIND,
			"name": record["name"],
			"description": record["description"],
			"entry_count": record["entries"].size(),
			"linked_loot_table_id": record["linked_loot_table_id"],
			"updated_at_utc": record["updated_at_utc"],
			"deleted": include_deleted,
		}
		if include_deleted:
			row["deleted_at_utc"] = source[record_id_value]["deleted_at_utc"]
		matching.append(row)
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
		"include_deleted": include_deleted,
		"total": matching.size(),
		"rows": rows,
	}


func read_table(
	payload_value: Variant,
	record_id: String,
	include_deleted: bool = false,
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
	var payload: Dictionary = validated["payload"]
	var source: Dictionary = payload["trash"] if include_deleted else payload["records"]
	if not source.has(record_id):
		return _missing(record_id)
	return {
		"ok": true,
		"status": "ready",
		"record": (source[record_id]["record"] if include_deleted else source[record_id]).duplicate(true),
		"deleted": include_deleted,
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
	if payload["records"].has(record_id) or payload["trash"].has(record_id):
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


func trash_table(
	payload_value: Variant,
	world_payload_value: Variant,
	record_id: String,
	now_utc: String = ""
) -> Dictionary:
	var validated := validate_payload(payload_value)
	if not validated.get("ok", false):
		return validated
	var world_validation := WorldPlannerKnowledge.new().validate_payload(world_payload_value)
	if not world_validation.get("ok", false):
		return world_validation
	var payload: Dictionary = validated["payload"]
	if not payload["records"].has(record_id):
		return _missing(record_id)
	var timestamp := now_utc if not now_utc.is_empty() else Time.get_datetime_string_from_system(true)
	var records: Dictionary = payload["records"].duplicate(true)
	var record: Dictionary = records[record_id].duplicate(true)
	var incoming_links: Array = []
	var world_payload: Dictionary = world_validation["payload"]
	var world_records: Dictionary = world_payload["records"].duplicate(true)
	for source_id_value in world_records:
		var source_id := str(source_id_value)
		var source: Dictionary = world_records[source_id_value].duplicate(true)
		var changed := false
		if source.get("kind", "") == "faction" and source.get("primary_encounter_table_id", "") == record_id:
			incoming_links.append({"source_id": source_id, "field": "primary_encounter_table_id"})
			source["primary_encounter_table_id"] = ""
			changed = true
		elif source.get("kind", "") == "place" and record_id in source.get("encounter_table_ids", []):
			incoming_links.append({"source_id": source_id, "field": "encounter_table_ids"})
			var table_ids: Array = source["encounter_table_ids"].duplicate()
			table_ids.erase(record_id)
			source["encounter_table_ids"] = table_ids
			changed = true
		if changed:
			source["updated_at_utc"] = timestamp
			world_records[source_id] = source
	records.erase(record_id)
	var trash: Dictionary = payload["trash"].duplicate(true)
	trash[record_id] = {
		"record": record,
		"deleted_at_utc": timestamp,
		"incoming_links": incoming_links,
	}
	var next_payload := payload.duplicate(true)
	next_payload["records"] = records
	next_payload["trash"] = trash
	var next_world_payload := world_payload.duplicate(true)
	next_world_payload["records"] = world_records
	var next_validation := validate_payload(next_payload)
	if not next_validation.get("ok", false):
		return next_validation
	var next_world_validation := WorldPlannerKnowledge.new().validate_payload(next_world_payload)
	if not next_world_validation.get("ok", false):
		return next_world_validation
	return {
		"ok": true,
		"status": "trashed",
		"record": record,
		"removed_link_count": incoming_links.size(),
		"payload": next_validation["payload"],
		"partition_updates": {
			OWNER: next_validation["payload"],
			WorldPlannerKnowledge.OWNER: next_world_validation["payload"],
		},
	}


func restore_table(
	payload_value: Variant,
	world_payload_value: Variant,
	record_id: String,
	now_utc: String = ""
) -> Dictionary:
	var validated := validate_payload(payload_value)
	if not validated.get("ok", false):
		return validated
	var world_validation := WorldPlannerKnowledge.new().validate_payload(world_payload_value)
	if not world_validation.get("ok", false):
		return world_validation
	var payload: Dictionary = validated["payload"]
	if not payload["trash"].has(record_id):
		return _missing(record_id)
	var timestamp := now_utc if not now_utc.is_empty() else Time.get_datetime_string_from_system(true)
	var trash: Dictionary = payload["trash"].duplicate(true)
	var trash_entry: Dictionary = trash[record_id]
	var record: Dictionary = trash_entry["record"].duplicate(true)
	record["updated_at_utc"] = timestamp
	var records: Dictionary = payload["records"].duplicate(true)
	records[record_id] = record
	var world_payload: Dictionary = world_validation["payload"]
	var world_records: Dictionary = world_payload["records"].duplicate(true)
	var restored_links := 0
	for link in trash_entry["incoming_links"]:
		var source_id := str(link["source_id"])
		var field := str(link["field"])
		if not world_records.has(source_id):
			continue
		var source: Dictionary = world_records[source_id].duplicate(true)
		var changed := false
		if (
			field == "primary_encounter_table_id"
			and source.get("kind", "") == "faction"
			and str(source.get(field, "")).is_empty()
		):
			source[field] = record_id
			changed = true
		elif field == "encounter_table_ids" and source.get("kind", "") == "place" and record_id not in source.get(field, []):
			var table_ids: Array = source[field].duplicate()
			table_ids.append(record_id)
			table_ids.sort()
			source[field] = table_ids
			changed = true
		if changed:
			source["updated_at_utc"] = timestamp
			world_records[source_id] = source
			restored_links += 1
	trash.erase(record_id)
	var next_payload := payload.duplicate(true)
	next_payload["records"] = records
	next_payload["trash"] = trash
	var next_world_payload := world_payload.duplicate(true)
	next_world_payload["records"] = world_records
	var next_validation := validate_payload(next_payload)
	if not next_validation.get("ok", false):
		return next_validation
	var next_world_validation := WorldPlannerKnowledge.new().validate_payload(next_world_payload)
	if not next_world_validation.get("ok", false):
		return next_world_validation
	return {
		"ok": true,
		"status": "restored",
		"record": record,
		"restored_link_count": restored_links,
		"payload": next_validation["payload"],
		"partition_updates": {
			OWNER: next_validation["payload"],
			WorldPlannerKnowledge.OWNER: next_world_validation["payload"],
		},
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


func _valid_incoming_link(value: Variant) -> bool:
	return (
		value is Dictionary
		and value.size() == 2
		and _valid_id(str(value.get("source_id", "")))
		and value.get("field", "") in ["primary_encounter_table_id", "encounter_table_ids"]
	)


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
