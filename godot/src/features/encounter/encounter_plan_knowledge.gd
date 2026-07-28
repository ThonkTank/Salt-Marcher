class_name EncounterPlanKnowledge
extends RefCounted

## Pure Campaign owner for saved Encounter-plan roster truth.

const FORMAT_ID := "saltmarcher.encounter-plans.v1"
const OWNER := "encounter"
const KIND := "encounter_plan"
const MAX_NAME_LENGTH := 160
const MAX_PAGE_SIZE := 200
const EncounterGenerationPolicy = preload("res://godot/src/features/encounter/encounter_generation_policy.gd")


func empty_payload() -> Dictionary:
	return {
		"format": FORMAT_ID,
		"records": {},
		"trash": {},
	}


func validate_payload(value: Variant) -> Dictionary:
	if not value is Dictionary:
		return _failure("Encounter-Plan-Daten müssen ein Dokument sein.")
	var payload: Dictionary = value
	if (
		payload.get("format", "") != FORMAT_ID
		or not payload.get("records", null) is Dictionary
		or not payload.get("trash", null) is Dictionary
	):
		return _failure("Encounter-Plan-Daten besitzen kein unterstütztes Format.")
	for record_id_value in payload["records"]:
		var validation := _validate_record(str(record_id_value), payload["records"][record_id_value])
		if not validation.get("ok", false):
			return validation
	for record_id_value in payload["trash"]:
		var record_id := str(record_id_value)
		var trash_entry = payload["trash"][record_id_value]
		if (
			not trash_entry is Dictionary
			or trash_entry.size() != 2
			or not _valid_timestamp(str(trash_entry.get("deleted_at_utc", "")))
		):
			return _failure("Encounter-Plan-Papierkorb enthält einen ungültigen Eintrag.")
		var record_validation := _validate_record(record_id, trash_entry.get("record", null))
		if not record_validation.get("ok", false):
			return record_validation
		if payload["records"].has(record_id):
			return _failure("Encounter Plan kann nicht zugleich aktiv und gelöscht sein.")
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
		return _failure("Encounter-Plan-Katalogabfrage besitzt ungültige Grenzen.")
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
		var record: Dictionary = (
			source[record_id_value]["record"] if include_deleted else source[record_id_value]
		)
		if not _matches(record_id, record, needle):
			continue
		var total_creatures := 0
		for roster_entry in record["roster"]:
			total_creatures += int(roster_entry["quantity"])
		var row := {
			"reference_id": record_id,
			"kind": KIND,
			"name": record["name"],
			"generated_label": record["generated_label"],
			"roster_line_count": record["roster"].size(),
			"creature_count": total_creatures,
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


func read_plan(
	payload_value: Variant,
	record_id: String,
	include_deleted: bool = false,
	cancellation: Callable = Callable()
) -> Dictionary:
	if not _valid_id(record_id):
		return _failure("Encounter-Plan-Detailabfrage besitzt keine gültige Identität.")
	if _cancelled(cancellation):
		return _cancelled_failure()
	var validated := validate_payload(payload_value)
	if not validated.get("ok", false):
		return validated
	var payload: Dictionary = validated["payload"]
	if payload["records"].has(record_id):
		return {
			"ok": true,
			"status": "ready",
			"record": payload["records"][record_id].duplicate(true),
			"deleted": false,
		}
	if include_deleted and payload["trash"].has(record_id):
		return {
			"ok": true,
			"status": "ready",
			"record": payload["trash"][record_id]["record"].duplicate(true),
			"deleted": true,
			"deleted_at_utc": payload["trash"][record_id]["deleted_at_utc"],
		}
	return _missing(record_id)


func create_plan(
	payload_value: Variant,
	raw_name: String,
	roster: Array,
	record_id_override: String = "",
	now_utc: String = "",
	generated_label: String = "",
	generated_origin: Dictionary = {}
) -> Dictionary:
	var validated := validate_payload(payload_value)
	if not validated.get("ok", false):
		return validated
	var name_validation := _validate_name(raw_name)
	if not name_validation.get("ok", false):
		return name_validation
	var record_id := record_id_override if not record_id_override.is_empty() else "encounter_plan.%s" % _new_identity()
	if not _valid_id(record_id):
		return _failure("Encounter-Plan-Identität ist ungültig.")
	var payload: Dictionary = validated["payload"]
	if payload["records"].has(record_id) or payload["trash"].has(record_id):
		return _failure("Encounter-Plan-Identität existiert bereits.")
	var timestamp := now_utc if not now_utc.is_empty() else Time.get_datetime_string_from_system(true)
	var record := {
		"record_id": record_id,
		"kind": KIND,
		"name": str(name_validation["name"]),
		"generated_label": generated_label.strip_edges(),
		"roster": roster.duplicate(true),
		"generated_origin": generated_origin.duplicate(true),
		"created_at_utc": timestamp,
		"updated_at_utc": timestamp,
	}
	var record_validation := _validate_record(record_id, record)
	if not record_validation.get("ok", false):
		return record_validation
	var next_payload: Dictionary = payload.duplicate(true)
	var records: Dictionary = payload["records"].duplicate(true)
	records[record_id] = record
	next_payload["records"] = records
	return _validated_change(next_payload, "created", record)


func update_plan(
	payload_value: Variant,
	record_id: String,
	raw_name: String,
	roster: Array,
	now_utc: String = ""
) -> Dictionary:
	var validated := validate_payload(payload_value)
	if not validated.get("ok", false):
		return validated
	var payload: Dictionary = validated["payload"]
	if not payload["records"].has(record_id):
		return _missing(record_id)
	var name_validation := _validate_name(raw_name)
	if not name_validation.get("ok", false):
		return name_validation
	var record: Dictionary = payload["records"][record_id].duplicate(true)
	if not record["generated_origin"].is_empty() and not _same_roster_meaning(record["roster"], roster):
		return _failure("Ein generierter Encounter Plan kann nur über einen neuen vorbereiteten Batch ersetzt werden.")
	record["name"] = name_validation["name"]
	record["roster"] = roster.duplicate(true)
	record["updated_at_utc"] = now_utc if not now_utc.is_empty() else Time.get_datetime_string_from_system(true)
	var record_validation := _validate_record(record_id, record)
	if not record_validation.get("ok", false):
		return record_validation
	var records: Dictionary = payload["records"].duplicate(true)
	records[record_id] = record
	var next_payload: Dictionary = payload.duplicate(true)
	next_payload["records"] = records
	return _validated_change(next_payload, "updated", record)


func trash_plan(payload_value: Variant, record_id: String, now_utc: String = "") -> Dictionary:
	var validated := validate_payload(payload_value)
	if not validated.get("ok", false):
		return validated
	var payload: Dictionary = validated["payload"]
	if not payload["records"].has(record_id):
		return _missing(record_id)
	var timestamp := now_utc if not now_utc.is_empty() else Time.get_datetime_string_from_system(true)
	var record: Dictionary = payload["records"][record_id].duplicate(true)
	var records: Dictionary = payload["records"].duplicate(true)
	records.erase(record_id)
	var trash: Dictionary = payload["trash"].duplicate(true)
	trash[record_id] = {"record": record, "deleted_at_utc": timestamp}
	var next_payload: Dictionary = payload.duplicate(true)
	next_payload["records"] = records
	next_payload["trash"] = trash
	return _validated_change(next_payload, "trashed", record)


func restore_plan(payload_value: Variant, record_id: String, now_utc: String = "") -> Dictionary:
	var validated := validate_payload(payload_value)
	if not validated.get("ok", false):
		return validated
	var payload: Dictionary = validated["payload"]
	if not payload["trash"].has(record_id):
		return _missing(record_id)
	if payload["records"].has(record_id):
		return _failure("Encounter Plan kann wegen eines Identitätskonflikts nicht wiederhergestellt werden.")
	var record: Dictionary = payload["trash"][record_id]["record"].duplicate(true)
	record["updated_at_utc"] = now_utc if not now_utc.is_empty() else Time.get_datetime_string_from_system(true)
	var records: Dictionary = payload["records"].duplicate(true)
	records[record_id] = record
	var trash: Dictionary = payload["trash"].duplicate(true)
	trash.erase(record_id)
	var next_payload: Dictionary = payload.duplicate(true)
	next_payload["records"] = records
	next_payload["trash"] = trash
	return _validated_change(next_payload, "restored", record)


func search_chooser(
	payload_value: Variant,
	search_text: String,
	cancellation: Callable = Callable()
) -> Dictionary:
	var needle := search_text.strip_edges().to_lower()
	if needle.length() < 2:
		return _failure("Die Encounter-Plan-Suche braucht mindestens zwei Zeichen.")
	var validated := validate_payload(payload_value)
	if not validated.get("ok", false):
		return validated
	var hits: Array = []
	for record_id_value in validated["payload"]["records"]:
		if _cancelled(cancellation):
			return _cancelled_failure()
		var record_id := str(record_id_value)
		var record: Dictionary = validated["payload"]["records"][record_id_value]
		if not _matches(record_id, record, needle):
			continue
		var total := 0
		for entry in record["roster"]:
			total += int(entry["quantity"])
		hits.append({
			"reference_id": record_id,
			"name": record["name"],
			"summary_text": "%d Monster · %d Arten" % [total, record["roster"].size()],
			"updated_at_utc": record["updated_at_utc"],
		})
	hits.sort_custom(func(left: Dictionary, right: Dictionary) -> bool:
		if left["updated_at_utc"] == right["updated_at_utc"]:
			return str(left["reference_id"]) < str(right["reference_id"])
		return str(left["updated_at_utc"]) > str(right["updated_at_utc"])
	)
	var has_more := hits.size() > 8
	if has_more:
		hits.resize(8)
	return {"ok": true, "status": "empty" if hits.is_empty() else "ready", "rows": hits, "has_more": has_more}


func commit_generated_batch(
	payload_value: Variant,
	batch_value: Variant,
	now_utc: String = ""
) -> Dictionary:
	var payload_validation := validate_payload(payload_value)
	if not payload_validation.get("ok", false):
		return payload_validation
	var policy := EncounterGenerationPolicy.new()
	var batch_validation := policy.validate_prepared_batch(batch_value)
	if not batch_validation.get("ok", false):
		return batch_validation
	var payload: Dictionary = payload_validation["payload"]
	var batch: Dictionary = batch_validation["batch"]
	var existing := _existing_generated_batch(payload, batch)
	if existing.get("status", "") == "already_committed":
		return {
			"ok": true,
			"status": "already_committed",
			"no_write": true,
			"payload": payload,
			"mappings": existing["mappings"],
			"batch_fingerprint": batch["batch_fingerprint"],
		}
	if existing.get("status", "") == "conflict":
		return existing
	var timestamp := now_utc if not now_utc.is_empty() else Time.get_datetime_string_from_system(true)
	var next_payload: Dictionary = payload.duplicate(true)
	var mappings: Array = []
	var source: Dictionary = batch["source"]
	var batch_id := policy.fingerprint("%s|%s" % [source["engine_version"], source["preparation_id"]])
	for order in range(batch["rosters"].size()):
		var roster: Dictionary = batch["rosters"][order]
		var plan_id := "encounter_plan.generated.%s" % policy.fingerprint(
			"%s|%d" % [batch_id, int(roster["encounter_number"])]
		).substr(0, 32)
		if next_payload["records"].has(plan_id) or next_payload["trash"].has(plan_id):
			return _batch_conflict("Eine generierte Encounter-Plan-Identität kollidiert mit vorhandener Wahrheit.")
		var origin := {
			"batch_id": batch_id,
			"engine_version": source["engine_version"],
			"preparation_id": source["preparation_id"],
			"generation_run_id": source["generation_run_id"],
			"batch_fingerprint": batch["batch_fingerprint"],
			"roster_fingerprint": roster["roster_fingerprint"],
			"intent_fingerprint": roster["intent_fingerprint"],
			"cardinality": batch["rosters"].size(),
			"order": order,
			"encounter_number": roster["encounter_number"],
		}
		var created := create_plan(
			next_payload,
			str(roster["display_label"]),
			roster["creatures"],
			plan_id,
			timestamp,
			str(roster["display_label"]),
			origin
		)
		if not created.get("ok", false):
			return created
		next_payload = created["payload"]
		mappings.append(_generated_mapping(roster, plan_id))
	return {
		"ok": true,
		"status": "committed",
		"payload": next_payload,
		"mappings": mappings,
		"batch_fingerprint": batch["batch_fingerprint"],
	}


func _matches(record_id: String, record: Dictionary, needle: String) -> bool:
	if needle.is_empty():
		return true
	if (
		str(record["name"]).to_lower().contains(needle)
		or str(record["generated_label"]).to_lower().contains(needle)
		or record_id.contains(needle)
	):
		return true
	for entry in record["roster"]:
		if (
			str(entry["creature_id"]).contains(needle)
			or str(entry["last_known_name"]).to_lower().contains(needle)
		):
			return true
	return false


func _existing_generated_batch(payload: Dictionary, batch: Dictionary) -> Dictionary:
	var source: Dictionary = batch["source"]
	var matched: Array = []
	for record_id_value in payload["records"]:
		var record: Dictionary = payload["records"][record_id_value]
		var origin: Dictionary = record["generated_origin"]
		if _same_generated_source(origin, source):
			matched.append({"record": record, "deleted": false})
	for record_id_value in payload["trash"]:
		var record: Dictionary = payload["trash"][record_id_value]["record"]
		var origin: Dictionary = record["generated_origin"]
		if _same_generated_source(origin, source):
			matched.append({"record": record, "deleted": true})
	if matched.is_empty():
		return {"ok": true, "status": "absent"}
	if matched.size() != batch["rosters"].size():
		return _batch_conflict("Gespeicherte Generated-Encounter-Herkunft ist unvollständig.")
	var by_order := {}
	for entry in matched:
		var record: Dictionary = entry["record"]
		var origin: Dictionary = record["generated_origin"]
		var order := int(origin["order"])
		if (
			entry["deleted"]
			or origin["generation_run_id"] != source["generation_run_id"]
			or origin["batch_fingerprint"] != batch["batch_fingerprint"]
			or int(origin["cardinality"]) != batch["rosters"].size()
			or order < 0
			or order >= batch["rosters"].size()
			or by_order.has(order)
		):
			return _batch_conflict("Generated Encounter Batch widerspricht gespeicherter Wahrheit.")
		var expected: Dictionary = batch["rosters"][order]
		if (
			int(origin["encounter_number"]) != int(expected["encounter_number"])
			or origin["roster_fingerprint"] != expected["roster_fingerprint"]
			or origin["intent_fingerprint"] != expected["intent_fingerprint"]
			or not _same_roster_meaning(record["roster"], expected["creatures"])
		):
			return _batch_conflict("Generated Encounter Batch widerspricht gespeicherter Roster-Wahrheit.")
		by_order[order] = record
	var mappings: Array = []
	for order in range(batch["rosters"].size()):
		if not by_order.has(order):
			return _batch_conflict("Gespeicherte Generated-Encounter-Reihenfolge ist unvollständig.")
		mappings.append(_generated_mapping(batch["rosters"][order], str(by_order[order]["record_id"])))
	return {"ok": true, "status": "already_committed", "mappings": mappings}


func _same_generated_source(origin: Dictionary, source: Dictionary) -> bool:
	return (
		not origin.is_empty()
		and origin.get("engine_version", "") == source["engine_version"]
		and origin.get("preparation_id", "") == source["preparation_id"]
	)


func _generated_mapping(roster: Dictionary, plan_id: String) -> Dictionary:
	var summary: Dictionary = roster["summary"].duplicate(true)
	summary["plan_id"] = plan_id
	return {
		"encounter_number": roster["encounter_number"],
		"plan_id": plan_id,
		"summary": summary,
	}


func _batch_conflict(message: String) -> Dictionary:
	return {"ok": false, "status": "CONFLICT", "error": message}


func _validated_change(next_payload: Dictionary, status: String, record: Dictionary) -> Dictionary:
	var next_validation := validate_payload(next_payload)
	if not next_validation.get("ok", false):
		return next_validation
	return {
		"ok": true,
		"status": status,
		"record": record.duplicate(true),
		"payload": next_validation["payload"],
	}


func _validate_record(record_id: String, value: Variant) -> Dictionary:
	if not _valid_id(record_id) or not value is Dictionary:
		return _failure("Encounter Plan besitzt keine gültige Identität.")
	var record: Dictionary = value
	if (
		record.size() != 8
		or record.get("record_id", "") != record_id
		or record.get("kind", "") != KIND
		or not _validate_name(str(record.get("name", ""))).get("ok", false)
		or not _valid_optional_label(record.get("generated_label", null))
		or not record.get("roster", null) is Array
		or not record.get("generated_origin", null) is Dictionary
		or not _valid_timestamp(str(record.get("created_at_utc", "")))
		or not _valid_timestamp(str(record.get("updated_at_utc", "")))
	):
		return _failure("Encounter Plan %s besitzt ungültige Fachwerte." % record_id)
	if record["roster"].is_empty():
		return _failure("Ein Encounter Plan braucht mindestens ein Monster.")
	var seen_creatures := {}
	for entry_value in record["roster"]:
		if not entry_value is Dictionary or entry_value.size() != 3:
			return _failure("Encounter Plan %s besitzt eine ungültige Rosterzeile." % record_id)
		var creature_id := str(entry_value.get("creature_id", ""))
		var last_known_name := str(entry_value.get("last_known_name", "")).strip_edges()
		var quantity = entry_value.get("quantity", null)
		if (
			not _valid_id(creature_id)
			or seen_creatures.has(creature_id)
			or not _valid_positive_integer(quantity)
			or last_known_name.is_empty()
			or last_known_name.length() > MAX_NAME_LENGTH
		):
			return _failure("Encounter Plan %s besitzt eine ungültige Rosterzeile." % record_id)
		seen_creatures[creature_id] = true
	if not _validate_generated_origin(record["generated_origin"]):
		return _failure("Encounter Plan %s besitzt eine ungültige Generierungsherkunft." % record_id)
	return {"ok": true}


func _validate_generated_origin(origin: Dictionary) -> bool:
	if origin.is_empty():
		return true
	var required := [
		"batch_id", "engine_version", "preparation_id", "generation_run_id",
		"batch_fingerprint", "roster_fingerprint", "intent_fingerprint",
		"cardinality", "order", "encounter_number",
	]
	if origin.size() != required.size():
		return false
	for key in required:
		if not origin.has(key):
			return false
	for key in ["batch_id", "engine_version", "preparation_id", "generation_run_id", "batch_fingerprint", "roster_fingerprint", "intent_fingerprint"]:
		if str(origin[key]).strip_edges().is_empty() or str(origin[key]).length() > 256:
			return false
	return (
		_valid_positive_integer(origin["cardinality"])
		and _valid_nonnegative_integer(origin["order"])
		and int(origin["order"]) < int(origin["cardinality"])
		and _valid_positive_integer(origin["encounter_number"])
	)


func _same_roster_meaning(left: Array, right: Array) -> bool:
	if left.size() != right.size():
		return false
	for index in left.size():
		if (
			str(left[index].get("creature_id", "")) != str(right[index].get("creature_id", ""))
			or int(left[index].get("quantity", 0)) != int(right[index].get("quantity", 0))
		):
			return false
	return true


func _validate_name(raw_name: String) -> Dictionary:
	var name := raw_name.strip_edges()
	if name.is_empty():
		return _failure("Der Name braucht mindestens ein sichtbares Zeichen.")
	if name.length() > MAX_NAME_LENGTH:
		return _failure("Der Name darf höchstens %d Zeichen enthalten." % MAX_NAME_LENGTH)
	return {"ok": true, "name": name}


func _valid_optional_label(value: Variant) -> bool:
	return value is String and str(value).length() <= MAX_NAME_LENGTH


func _valid_positive_integer(value: Variant) -> bool:
	return _valid_nonnegative_integer(value) and int(value) > 0


func _valid_nonnegative_integer(value: Variant) -> bool:
	if not value is int and not value is float:
		return false
	var numeric := float(value)
	return is_finite(numeric) and numeric >= 0 and is_equal_approx(numeric, roundf(numeric))


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
	return {"ok": false, "status": "cancelled", "error": "Encounter-Plan-Abfrage wurde ersetzt."}


func _missing(record_id: String) -> Dictionary:
	return {"ok": false, "status": "missing", "error": "Encounter Plan fehlt: %s" % record_id}


func _failure(message: String) -> Dictionary:
	return {"ok": false, "status": "invalid", "error": message}
