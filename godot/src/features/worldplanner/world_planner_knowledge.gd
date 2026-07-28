class_name WorldPlannerKnowledge
extends RefCounted

## Pure owner model for Campaign-authored world entities and narrative truth.

const FORMAT_ID := "saltmarcher.world-planner.v1"
const OWNER := "worldplanner"
const MAX_NAME_LENGTH := 160
const MAX_NOTES_LENGTH := 100_000
const MAX_PAGE_SIZE := 200
const MAX_REWARD_QUANTITY := 2_147_483_647
const ENTITY_KINDS := ["npc", "faction", "place"]
const NARRATIVE_KINDS := ["quest", "rumour"]
const KINDS := ENTITY_KINDS + NARRATIVE_KINDS


func empty_payload() -> Dictionary:
	return {
		"format": FORMAT_ID,
		"records": {},
		"trash": {},
	}


func validate_payload(value: Variant) -> Dictionary:
	if not value is Dictionary:
		return _failure("World-Planner-Daten müssen ein Dokument sein.")
	var payload: Dictionary = value
	if (
		payload.get("format", "") != FORMAT_ID
		or not payload.get("records", null) is Dictionary
		or not payload.get("trash", null) is Dictionary
	):
		return _failure("World-Planner-Daten besitzen kein unterstütztes Format.")
	var records: Dictionary = payload["records"]
	var trash: Dictionary = payload["trash"]
	for record_id_value in records:
		var record_id := str(record_id_value)
		var validation := _validate_record(record_id, records[record_id_value])
		if not validation.get("ok", false):
			return validation
	for record_id_value in trash:
		var record_id := str(record_id_value)
		if records.has(record_id) or not trash[record_id_value] is Dictionary:
			return _failure("Papierkorb und aktive World-Planner-Daten widersprechen sich.")
		var entry: Dictionary = trash[record_id_value]
		var validation := _validate_record(record_id, entry.get("record", null))
		if (
			not validation.get("ok", false)
			or not _valid_timestamp(str(entry.get("deleted_at_utc", "")))
			or not entry.get("incoming_links", null) is Array
		):
			return _failure("Ein World-Planner-Papierkorbeintrag ist ungültig.")
		for link in entry["incoming_links"]:
			if not _valid_incoming_link(link):
				return _failure("Ein gespeicherter World-Planner-Verweis ist ungültig.")
	var references := _validate_active_references(records)
	if not references.get("ok", false):
		return references
	return {"ok": true, "payload": payload.duplicate(true)}


func query(
	payload_value: Variant,
	kind: String,
	search_text: String = "",
	offset: int = 0,
	limit: int = 50,
	include_deleted: bool = false,
	sort_key: String = "name",
	sort_ascending: bool = true,
	cancellation: Callable = Callable()
) -> Dictionary:
	if (
		kind not in KINDS
		or offset < 0
		or limit <= 0
		or limit > MAX_PAGE_SIZE
		or sort_key not in ["name", "identity"]
	):
		return _failure("World-Planner-Katalogabfrage besitzt ungültige Grenzen.")
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
			source[record_id_value]["record"]
			if include_deleted
			else source[record_id_value]
		)
		if record["kind"] != kind:
			continue
		if (
			not needle.is_empty()
			and not str(record["name"]).to_lower().contains(needle)
			and not record_id.contains(needle)
		):
			continue
		matching.append({
			"reference_id": record_id,
			"kind": kind,
			"name": record["name"],
			"notes": record["notes"],
			"deleted": include_deleted,
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
		"kind": kind,
		"search_text": search_text,
		"offset": offset,
		"limit": limit,
		"sort_key": sort_key,
		"sort_ascending": sort_ascending,
		"total": matching.size(),
		"rows": rows,
		"deleted": include_deleted,
	}


func query_narratives_for_subject(
	payload_value: Variant,
	subject_id: String,
	include_deleted: bool = false,
	limit: int = 100,
	cancellation: Callable = Callable()
) -> Dictionary:
	if not _valid_id(subject_id) or limit <= 0 or limit > MAX_PAGE_SIZE:
		return _failure("Narrative Abfrage besitzt ungültige Grenzen.")
	if _cancelled(cancellation):
		return _cancelled_failure()
	var validated := validate_payload(payload_value)
	if not validated.get("ok", false):
		return validated
	var payload: Dictionary = validated["payload"]
	if not payload["records"].has(subject_id) or payload["records"][subject_id]["kind"] not in ENTITY_KINDS:
		return _missing(subject_id)
	var source: Dictionary = payload["trash"] if include_deleted else payload["records"]
	var matching: Array = []
	for record_id_value in source:
		if _cancelled(cancellation):
			return _cancelled_failure()
		var record_id := str(record_id_value)
		var record: Dictionary = source[record_id_value]["record"] if include_deleted else source[record_id_value]
		if record["kind"] not in NARRATIVE_KINDS or not _has_subject(record["subject_refs"], subject_id):
			continue
		matching.append({
			"reference_id": record_id,
			"kind": record["kind"],
			"name": record["name"],
			"notes": record["notes"],
			"resolution_state": record["resolution_state"],
			"subject_refs": record["subject_refs"].duplicate(true),
			"contributor_ids": record["contributor_ids"].duplicate(),
			"rewards": record["rewards"].duplicate(true),
			"deleted": include_deleted,
			"updated_at_utc": record["updated_at_utc"],
		})
	matching.sort_custom(func(left: Dictionary, right: Dictionary) -> bool:
		var left_state := 0 if left["resolution_state"] == "open" else 1
		var right_state := 0 if right["resolution_state"] == "open" else 1
		if left_state != right_state:
			return left_state < right_state
		var left_name := str(left["name"]).to_lower()
		var right_name := str(right["name"]).to_lower()
		if left_name == right_name:
			return str(left["reference_id"]) < str(right["reference_id"])
		return left_name < right_name
	)
	var rows: Array = []
	for index in range(mini(limit, matching.size())):
		rows.append(matching[index].duplicate(true))
	return {
		"ok": true,
		"status": "empty" if matching.is_empty() else "ready",
		"subject_id": subject_id,
		"deleted": include_deleted,
		"total": matching.size(),
		"rows": rows,
	}


func read_entity(
	payload_value: Variant,
	record_id: String,
	include_deleted: bool = false,
	cancellation: Callable = Callable()
) -> Dictionary:
	if not _valid_id(record_id):
		return _failure("World-Planner-Detailabfrage besitzt keine gültige Identität.")
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
	var record: Dictionary = source[record_id]["record"] if include_deleted else source[record_id]
	if record["kind"] not in ENTITY_KINDS:
		return _failure("Die Detailabfrage akzeptiert nur World-Planner-Weltobjekte.")
	return {
		"ok": true,
		"status": "ready",
		"record": record.duplicate(true),
		"deleted": include_deleted,
	}


func create_record(
	payload_value: Variant,
	kind: String,
	raw_name: String,
	fields: Dictionary = {},
	record_id_override: String = "",
	now_utc: String = ""
) -> Dictionary:
	var validated := validate_payload(payload_value)
	if not validated.get("ok", false):
		return validated
	if kind not in KINDS:
		return _failure("Unbekannter World-Planner-Typ.")
	var name_validation := _validate_name(raw_name)
	if not name_validation.get("ok", false):
		return name_validation
	var record_id := record_id_override if not record_id_override.is_empty() else "%s.%s" % [kind, _new_identity()]
	if not _valid_id(record_id):
		return _failure("World-Planner-Identität ist ungültig.")
	var payload: Dictionary = validated["payload"]
	if payload["records"].has(record_id) or payload["trash"].has(record_id):
		return _failure("World-Planner-Identität existiert bereits.")
	var timestamp := now_utc if not now_utc.is_empty() else Time.get_datetime_string_from_system(true)
	var record := _default_record(record_id, kind, str(name_validation["name"]), timestamp)
	var patched := _apply_patch(record, fields)
	if not patched.get("ok", false):
		return patched
	record = patched["record"]
	record["created_at_utc"] = timestamp
	record["updated_at_utc"] = timestamp
	var next_records: Dictionary = payload["records"].duplicate(true)
	next_records[record_id] = record
	var next_payload := payload.duplicate(true)
	next_payload["records"] = next_records
	var next_validation := validate_payload(next_payload)
	if not next_validation.get("ok", false):
		return next_validation
	return {
		"ok": true,
		"status": "created",
		"record": record.duplicate(true),
		"payload": next_validation["payload"],
	}


func update_record(
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
	var next_records: Dictionary = payload["records"].duplicate(true)
	next_records[record_id] = record
	var next_payload := payload.duplicate(true)
	next_payload["records"] = next_records
	var next_validation := validate_payload(next_payload)
	if not next_validation.get("ok", false):
		return next_validation
	return {
		"ok": true,
		"status": "updated",
		"record": record.duplicate(true),
		"payload": next_validation["payload"],
	}


func trash_record(payload_value: Variant, record_id: String, now_utc: String = "") -> Dictionary:
	var validated := validate_payload(payload_value)
	if not validated.get("ok", false):
		return validated
	var payload: Dictionary = validated["payload"]
	if not payload["records"].has(record_id):
		return _missing(record_id)
	var records: Dictionary = payload["records"].duplicate(true)
	var record: Dictionary = records[record_id]
	var incoming_links: Array = []
	var timestamp := now_utc if not now_utc.is_empty() else Time.get_datetime_string_from_system(true)
	for source_id_value in records:
		var source_id := str(source_id_value)
		if source_id == record_id:
			continue
		var source: Dictionary = records[source_id_value].duplicate(true)
		var source_changed := false
		if source["kind"] == "npc":
			for field in ["faction_id", "last_place_id"]:
				if source[field] == record_id:
					incoming_links.append({"source_id": source_id, "field": field})
					source[field] = ""
					source_changed = true
		if source["kind"] == "place" and record_id in source["faction_ids"]:
			incoming_links.append({"source_id": source_id, "field": "faction_ids"})
			var ids: Array = source["faction_ids"].duplicate()
			ids.erase(record_id)
			source["faction_ids"] = ids
			source_changed = true
		if source["kind"] in NARRATIVE_KINDS and _has_subject(source["subject_refs"], record_id):
			incoming_links.append({"source_id": source_id, "field": "subject_refs"})
			var subject_refs: Array = []
			for subject_ref in source["subject_refs"]:
				if str(subject_ref["record_id"]) != record_id:
					subject_refs.append(subject_ref.duplicate(true))
			source["subject_refs"] = subject_refs
			source_changed = true
		if source_changed:
			source["updated_at_utc"] = timestamp
		records[source_id] = source
	records.erase(record_id)
	var trash: Dictionary = payload["trash"].duplicate(true)
	trash[record_id] = {
		"record": record.duplicate(true),
		"deleted_at_utc": timestamp,
		"incoming_links": incoming_links,
	}
	var next_payload := payload.duplicate(true)
	next_payload["records"] = records
	next_payload["trash"] = trash
	var next_validation := validate_payload(next_payload)
	if not next_validation.get("ok", false):
		return next_validation
	return {
		"ok": true,
		"status": "trashed",
		"record": record.duplicate(true),
		"removed_link_count": incoming_links.size(),
		"payload": next_validation["payload"],
	}


func restore_record(payload_value: Variant, record_id: String, now_utc: String = "") -> Dictionary:
	var validated := validate_payload(payload_value)
	if not validated.get("ok", false):
		return validated
	var payload: Dictionary = validated["payload"]
	if not payload["trash"].has(record_id):
		return _missing(record_id)
	var trash: Dictionary = payload["trash"].duplicate(true)
	var entry: Dictionary = trash[record_id]
	var record: Dictionary = entry["record"].duplicate(true)
	var records: Dictionary = payload["records"].duplicate(true)
	_filter_missing_outgoing_links(record, records)
	var timestamp := now_utc if not now_utc.is_empty() else Time.get_datetime_string_from_system(true)
	record["updated_at_utc"] = timestamp
	records[record_id] = record
	var restored_links := 0
	for link in entry["incoming_links"]:
		var source_id := str(link["source_id"])
		var field := str(link["field"])
		if not records.has(source_id):
			continue
		var source: Dictionary = records[source_id].duplicate(true)
		var source_changed := false
		if field in ["faction_id", "last_place_id"] and str(source[field]).is_empty():
			source[field] = record_id
			restored_links += 1
			source_changed = true
		elif field == "faction_ids" and record_id not in source["faction_ids"]:
			var ids: Array = source["faction_ids"].duplicate()
			ids.append(record_id)
			ids.sort()
			source["faction_ids"] = ids
			restored_links += 1
			source_changed = true
		elif field == "subject_refs" and source["kind"] in NARRATIVE_KINDS:
			var subject_ref := {"kind": record["kind"], "record_id": record_id}
			if subject_ref not in source["subject_refs"]:
				var subject_refs: Array = source["subject_refs"].duplicate(true)
				subject_refs.append(subject_ref)
				subject_refs.sort_custom(Callable(self, "_subject_before"))
				source["subject_refs"] = subject_refs
				restored_links += 1
				source_changed = true
		if source_changed:
			source["updated_at_utc"] = timestamp
		records[source_id] = source
	trash.erase(record_id)
	var next_payload := payload.duplicate(true)
	next_payload["records"] = records
	next_payload["trash"] = trash
	var next_validation := validate_payload(next_payload)
	if not next_validation.get("ok", false):
		return next_validation
	return {
		"ok": true,
		"status": "restored",
		"record": record.duplicate(true),
		"restored_link_count": restored_links,
		"payload": next_validation["payload"],
	}


func _default_record(record_id: String, kind: String, name: String, timestamp: String) -> Dictionary:
	var record := {
		"record_id": record_id,
		"kind": kind,
		"name": name,
		"notes": "",
		"created_at_utc": timestamp,
		"updated_at_utc": timestamp,
	}
	if kind == "npc":
		record.merge({
			"creature_id": "",
			"appearance": "",
			"behavior": "",
			"history": "",
			"lifecycle_status": "active",
			"faction_id": "",
			"last_place_id": "",
			"disposition_modifier": 0,
		})
	elif kind == "faction":
		record.merge({
			"primary_encounter_table_id": "",
			"disposition_base": 0,
			"inventory_limits": {},
		})
	elif kind == "place":
		record.merge({
			"faction_ids": [],
			"encounter_table_ids": [],
		})
	else:
		record.merge({
			"resolution_state": "open",
			"subject_refs": [],
			"contributor_ids": [],
			"rewards": [],
		})
	return record


func _apply_patch(record_value: Variant, fields: Dictionary) -> Dictionary:
	if not record_value is Dictionary:
		return _failure("World-Planner-Eintrag ist ungültig.")
	var record: Dictionary = record_value.duplicate(true)
	var allowed := _allowed_fields(str(record.get("kind", "")))
	for field_value in fields:
		var field := str(field_value)
		if field not in allowed:
			return _failure("Feld %s gehört nicht zu diesem World-Planner-Typ." % field)
		record[field] = fields[field_value]
	var validation := _validate_record(str(record.get("record_id", "")), record)
	if not validation.get("ok", false):
		return validation
	return {"ok": true, "record": record}


func _allowed_fields(kind: String) -> Array:
	var common: Array = ["name", "notes"]
	if kind == "npc":
		return common + ["creature_id", "appearance", "behavior", "history", "lifecycle_status", "faction_id", "last_place_id", "disposition_modifier"]
	if kind == "faction":
		return common + ["primary_encounter_table_id", "disposition_base", "inventory_limits"]
	if kind == "place":
		return common + ["faction_ids", "encounter_table_ids"]
	if kind in NARRATIVE_KINDS:
		return common + ["resolution_state", "subject_refs", "contributor_ids", "rewards"]
	return []


func _validate_record(record_id: String, value: Variant) -> Dictionary:
	if not _valid_id(record_id) or not value is Dictionary:
		return _failure("World-Planner-Eintrag besitzt keine gültige Identität.")
	var record: Dictionary = value
	var kind := str(record.get("kind", ""))
	var name_validation := _validate_name(str(record.get("name", "")))
	if (
		record.get("record_id", "") != record_id
		or kind not in KINDS
		or not name_validation.get("ok", false)
		or not _valid_text(record.get("notes", null))
		or not _valid_timestamp(str(record.get("created_at_utc", "")))
		or not _valid_timestamp(str(record.get("updated_at_utc", "")))
	):
		return _failure("World-Planner-Eintrag %s ist ungültig." % record_id)
	if kind == "npc":
		if (
			not _valid_optional_id(record.get("creature_id", null))
			or not _valid_text(record.get("appearance", null))
			or not _valid_text(record.get("behavior", null))
			or not _valid_text(record.get("history", null))
			or record.get("lifecycle_status", "") not in ["active", "defeated"]
			or not _valid_optional_id(record.get("faction_id", null))
			or not _valid_optional_id(record.get("last_place_id", null))
			or not _valid_bounded_integer(record.get("disposition_modifier", null), -50, 50)
		):
			return _failure("NPC %s besitzt ungültige Fachwerte." % record_id)
	elif kind == "faction":
		if (
			not _valid_optional_id(record.get("primary_encounter_table_id", null))
			or not _valid_bounded_integer(record.get("disposition_base", null), -50, 50)
			or not _valid_inventory(record.get("inventory_limits", null))
		):
			return _failure("Fraktion %s besitzt ungültige Fachwerte." % record_id)
	elif kind == "place":
		if not _valid_id_array(record.get("faction_ids", null)) or not _valid_id_array(record.get("encounter_table_ids", null)):
			return _failure("Ort %s besitzt ungültige Verweise." % record_id)
	else:
		if (
			record.get("resolution_state", "") not in ["open", "closed"]
			or not _valid_subject_refs(record.get("subject_refs", null))
			or not _valid_id_array(record.get("contributor_ids", null))
			or (kind == "rumour" and not record.get("contributor_ids", []).is_empty())
			or not _valid_rewards(record.get("rewards", null))
		):
			return _failure("Narrativer Eintrag %s besitzt ungültige Fachwerte." % record_id)
	return {"ok": true}


func _validate_active_references(records: Dictionary) -> Dictionary:
	for record_id_value in records:
		var record_id := str(record_id_value)
		var record: Dictionary = records[record_id_value]
		if record["kind"] == "npc":
			var faction_id := str(record["faction_id"])
			var place_id := str(record["last_place_id"])
			if not faction_id.is_empty() and (not records.has(faction_id) or records[faction_id]["kind"] != "faction"):
				return _failure("NPC %s verweist auf keine aktive Fraktion." % record_id)
			if not place_id.is_empty() and (not records.has(place_id) or records[place_id]["kind"] != "place"):
				return _failure("NPC %s verweist auf keinen aktiven Ort." % record_id)
		elif record["kind"] == "place":
			for faction_id in record["faction_ids"]:
				if not records.has(faction_id) or records[faction_id]["kind"] != "faction":
					return _failure("Ort %s verweist auf keine aktive Fraktion." % record_id)
		elif record["kind"] in NARRATIVE_KINDS:
			for subject_ref in record["subject_refs"]:
				var subject_id := str(subject_ref["record_id"])
				if (
					not records.has(subject_id)
					or records[subject_id]["kind"] != subject_ref["kind"]
					or records[subject_id]["kind"] not in ENTITY_KINDS
				):
					return _failure("Narrativer Eintrag %s verweist auf kein aktives Weltobjekt." % record_id)
	return {"ok": true}


func _filter_missing_outgoing_links(record: Dictionary, records: Dictionary) -> void:
	if record["kind"] == "npc":
		if not records.has(record["faction_id"]) or records.get(record["faction_id"], {}).get("kind", "") != "faction":
			record["faction_id"] = ""
		if not records.has(record["last_place_id"]) or records.get(record["last_place_id"], {}).get("kind", "") != "place":
			record["last_place_id"] = ""
	elif record["kind"] == "place":
		var faction_ids: Array = []
		for faction_id in record["faction_ids"]:
			if records.has(faction_id) and records[faction_id]["kind"] == "faction":
				faction_ids.append(faction_id)
		record["faction_ids"] = faction_ids
	elif record["kind"] in NARRATIVE_KINDS:
		var subject_refs: Array = []
		for subject_ref in record["subject_refs"]:
			var subject_id := str(subject_ref["record_id"])
			if records.has(subject_id) and records[subject_id]["kind"] == subject_ref["kind"]:
				subject_refs.append(subject_ref.duplicate(true))
		record["subject_refs"] = subject_refs


func _valid_incoming_link(value: Variant) -> bool:
	return (
		value is Dictionary
		and _valid_id(str(value.get("source_id", "")))
		and value.get("field", "") in ["faction_id", "last_place_id", "faction_ids", "subject_refs"]
	)


func _valid_subject_refs(value: Variant) -> bool:
	if not value is Array:
		return false
	var seen := {}
	for subject_value in value:
		if not subject_value is Dictionary or subject_value.size() != 2:
			return false
		var kind := str(subject_value.get("kind", ""))
		var record_id := str(subject_value.get("record_id", ""))
		var key := "%s:%s" % [kind, record_id]
		if kind not in ENTITY_KINDS or not _valid_id(record_id) or seen.has(key):
			return false
		seen[key] = true
	return true


func _valid_rewards(value: Variant) -> bool:
	if not value is Array:
		return false
	for reward_value in value:
		if not reward_value is Dictionary:
			return false
		var reward: Dictionary = reward_value
		if reward.get("kind", "") == "xp":
			if reward.size() != 2 or not _valid_bounded_integer(reward.get("amount", null), 1, MAX_REWARD_QUANTITY):
				return false
		elif reward.get("kind", "") == "item":
			if (
				reward.size() != 3
				or not _valid_id(str(reward.get("definition_id", "")))
				or not _valid_bounded_integer(reward.get("quantity", null), 1, MAX_REWARD_QUANTITY)
			):
				return false
		else:
			return false
	return true


func _has_subject(subject_refs: Array, subject_id: String) -> bool:
	for subject_ref in subject_refs:
		if str(subject_ref.get("record_id", "")) == subject_id:
			return true
	return false


func _subject_before(left: Dictionary, right: Dictionary) -> bool:
	var left_key := "%s:%s" % [left["kind"], left["record_id"]]
	var right_key := "%s:%s" % [right["kind"], right["record_id"]]
	return left_key < right_key


func _valid_inventory(value: Variant) -> bool:
	if not value is Dictionary:
		return false
	for definition_id_value in value:
		if not _valid_id(str(definition_id_value)):
			return false
		var limit = value[definition_id_value]
		if limit != null and not _valid_bounded_integer(limit, 0, 2_147_483_647):
			return false
	return true


func _valid_id_array(value: Variant) -> bool:
	if not value is Array:
		return false
	var seen := {}
	for id_value in value:
		var id := str(id_value)
		if not _valid_id(id) or seen.has(id):
			return false
		seen[id] = true
	return true


func _validate_name(raw_name: String) -> Dictionary:
	var name := raw_name.strip_edges()
	if name.is_empty():
		return _failure("Der Name braucht mindestens ein sichtbares Zeichen.")
	if name.length() > MAX_NAME_LENGTH:
		return _failure("Der Name darf höchstens %d Zeichen enthalten." % MAX_NAME_LENGTH)
	return {"ok": true, "name": name}


func _valid_text(value: Variant) -> bool:
	return value is String and str(value).length() <= MAX_NOTES_LENGTH


func _valid_bounded_integer(value: Variant, minimum: int, maximum: int) -> bool:
	if not value is int and not value is float:
		return false
	var numeric := float(value)
	return is_equal_approx(numeric, roundf(numeric)) and numeric >= minimum and numeric <= maximum


func _valid_optional_id(value: Variant) -> bool:
	return value is String and (str(value).is_empty() or _valid_id(str(value)))


func _valid_id(value: String) -> bool:
	if value.is_empty() or value.length() > 128:
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
	return {"ok": false, "status": "cancelled", "error": "World-Planner-Abfrage wurde ersetzt."}


func _missing(record_id: String) -> Dictionary:
	return {"ok": false, "status": "missing", "error": "World-Planner-Eintrag fehlt: %s" % record_id}


func _failure(message: String) -> Dictionary:
	return {"ok": false, "status": "invalid", "error": message}
