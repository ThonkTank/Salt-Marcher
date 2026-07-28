class_name PartyRoster
extends RefCounted

## Pure Campaign Roster and current-Party owner model.

const FORMAT_ID := "saltmarcher.party-roster.v1"
const OWNER := "party"
const MAX_NAME_LENGTH := 160
const MAX_SEARCH_PAGE_SIZE := 500
const MAX_XP := 2_147_483_647
const XP_THRESHOLDS := [
	0, 0, 300, 900, 2_700, 6_500, 14_000, 23_000, 34_000, 48_000,
	64_000, 85_000, 100_000, 120_000, 140_000, 165_000, 195_000,
	225_000, 265_000, 305_000, 355_000,
]


func empty_payload() -> Dictionary:
	return {"format": FORMAT_ID, "characters": {}, "trash": {}}


func validate_payload(value: Variant) -> Dictionary:
	if not value is Dictionary:
		return _failure("Party-Daten müssen ein Dokument sein.")
	var payload: Dictionary = value
	if (
		payload.get("format", "") != FORMAT_ID
		or not payload.get("characters", null) is Dictionary
		or not payload.get("trash", null) is Dictionary
	):
		return _failure("Party-Daten besitzen kein unterstütztes Format.")
	var characters: Dictionary = payload["characters"]
	var trash: Dictionary = payload["trash"]
	for character_id_value in characters:
		var character_id := str(character_id_value)
		var validation := _validate_character(character_id, characters[character_id_value])
		if not validation.get("ok", false):
			return validation
	for character_id_value in trash:
		var character_id := str(character_id_value)
		if characters.has(character_id) or not trash[character_id_value] is Dictionary:
			return _failure("Roster und Papierkorb widersprechen sich.")
		var entry: Dictionary = trash[character_id_value]
		var validation := _validate_character(character_id, entry.get("character", null))
		if not validation.get("ok", false) or not _valid_timestamp(str(entry.get("deleted_at_utc", ""))):
			return _failure("Ein Roster-Papierkorbeintrag ist ungültig.")
	return {"ok": true, "payload": payload.duplicate(true)}


func validate_draft(name: String, fields: Dictionary = {}) -> Dictionary:
	var normalized_name := name.strip_edges()
	if normalized_name.is_empty():
		return _failure("Der Charaktername braucht mindestens ein sichtbares Zeichen.")
	if normalized_name.length() > MAX_NAME_LENGTH:
		return _failure("Der Charaktername darf höchstens %d Zeichen enthalten." % MAX_NAME_LENGTH)
	var allowed := ["player_name", "level", "passive_perception", "armor_class"]
	for field_value in fields:
		if str(field_value) not in allowed:
			return _failure("Unbekanntes Charakterfeld: %s" % field_value)
	var player_name = fields.get("player_name", null)
	if player_name is String:
		player_name = str(player_name).strip_edges()
		if str(player_name).is_empty():
			player_name = null
	if player_name != null and (not player_name is String or str(player_name).length() > MAX_NAME_LENGTH):
		return _failure("Spielername ist ungültig.")
	for field in ["level", "passive_perception", "armor_class"]:
		var current = fields.get(field, null)
		var maximum := 20 if field == "level" else 99
		if current != null and not _valid_bounded_integer(current, 1, maximum):
			return _failure("%s muss zwischen 1 und %d liegen." % [_field_label(field), maximum])
	return {
		"ok": true,
		"draft": {
			"name": normalized_name,
			"player_name": player_name,
			"level": _nullable_integer(fields.get("level", null)),
			"passive_perception": _nullable_integer(fields.get("passive_perception", null)),
			"armor_class": _nullable_integer(fields.get("armor_class", null)),
		},
	}


func create_character(
	payload_value: Variant,
	name: String,
	fields: Dictionary = {},
	character_id_override: String = "",
	now_utc: String = ""
) -> Dictionary:
	var validated := validate_payload(payload_value)
	if not validated.get("ok", false):
		return validated
	var draft := validate_draft(name, fields)
	if not draft.get("ok", false):
		return draft
	var character_id := character_id_override if not character_id_override.is_empty() else "pc.%s" % _new_identity()
	if not _valid_id(character_id):
		return _failure("Roster-Identität ist ungültig.")
	var payload: Dictionary = validated["payload"]
	if payload["characters"].has(character_id) or payload["trash"].has(character_id):
		return _failure("Roster-Identität existiert bereits.")
	var timestamp := now_utc if not now_utc.is_empty() else Time.get_datetime_string_from_system(true)
	var normalized: Dictionary = draft["draft"]
	var level = normalized["level"]
	var character := {
		"character_id": character_id,
		"name": normalized["name"],
		"player_name": normalized["player_name"],
		"level": level,
		"current_xp": 0 if level == null else minimum_xp_for_level(int(level)),
		"xp_since_long_rest": 0,
		"xp_since_short_rest": 0,
		"short_rests_taken_since_long_rest": 0,
		"passive_perception": normalized["passive_perception"],
		"armor_class": normalized["armor_class"],
		"membership": "reserve",
		"travel": _detached_travel(),
		"created_at_utc": timestamp,
		"updated_at_utc": timestamp,
	}
	var characters: Dictionary = payload["characters"].duplicate(true)
	characters[character_id] = character
	var next_payload := payload.duplicate(true)
	next_payload["characters"] = characters
	return _mutation_result("created", next_payload, character)


func update_character(
	payload_value: Variant,
	character_id: String,
	name: String,
	fields: Dictionary = {},
	now_utc: String = ""
) -> Dictionary:
	var validated := validate_payload(payload_value)
	if not validated.get("ok", false):
		return validated
	var draft := validate_draft(name, fields)
	if not draft.get("ok", false):
		return draft
	var payload: Dictionary = validated["payload"]
	if not payload["characters"].has(character_id):
		return _missing(character_id)
	var character: Dictionary = payload["characters"][character_id].duplicate(true)
	var normalized: Dictionary = draft["draft"]
	character["name"] = normalized["name"]
	character["player_name"] = normalized["player_name"]
	character["passive_perception"] = normalized["passive_perception"]
	character["armor_class"] = normalized["armor_class"]
	character["level"] = normalized["level"]
	if normalized["level"] != null:
		character["current_xp"] = maxi(int(character["current_xp"]), minimum_xp_for_level(int(normalized["level"])))
	character["updated_at_utc"] = now_utc if not now_utc.is_empty() else Time.get_datetime_string_from_system(true)
	var characters: Dictionary = payload["characters"].duplicate(true)
	characters[character_id] = character
	var next_payload := payload.duplicate(true)
	next_payload["characters"] = characters
	return _mutation_result("updated", next_payload, character)


func set_membership(
	payload_value: Variant,
	character_id: String,
	membership: String,
	now_utc: String = ""
) -> Dictionary:
	if membership not in ["active", "reserve"]:
		return _failure("Party-Mitgliedschaft ist ungültig.")
	return _update_one(payload_value, character_id, now_utc, func(character: Dictionary) -> void:
		character["membership"] = membership
	, "membership_updated")


func adjust_xp(
	payload_value: Variant,
	character_ids: Array,
	delta: int,
	now_utc: String = ""
) -> Dictionary:
	var validated := validate_payload(payload_value)
	if not validated.get("ok", false):
		return validated
	if character_ids.is_empty() or delta == 0:
		return _failure("XP-Änderung braucht mindestens einen Charakter und einen Wert ungleich 0.")
	var selected := {}
	for character_id_value in character_ids:
		var character_id := str(character_id_value)
		if not _valid_id(character_id) or selected.has(character_id):
			return _failure("XP-Änderung enthält ungültige oder doppelte Roster-Identitäten.")
		selected[character_id] = true
	var payload: Dictionary = validated["payload"]
	var characters: Dictionary = payload["characters"].duplicate(true)
	for character_id in selected:
		if not characters.has(character_id):
			return _missing(character_id)
	var timestamp := now_utc if not now_utc.is_empty() else Time.get_datetime_string_from_system(true)
	var applied_by_id := {}
	for character_id in selected:
		var character: Dictionary = characters[character_id].duplicate(true)
		var current_xp := int(character["current_xp"])
		var minimum_xp := 0 if character["level"] == null else minimum_xp_for_level(int(character["level"]))
		var next_xp := clampi(current_xp + delta, minimum_xp if delta < 0 else 0, MAX_XP)
		var applied := next_xp - current_xp
		character["current_xp"] = next_xp
		character["xp_since_long_rest"] = clampi(int(character["xp_since_long_rest"]) + applied, 0, next_xp)
		character["xp_since_short_rest"] = clampi(int(character["xp_since_short_rest"]) + applied, 0, int(character["xp_since_long_rest"]))
		character["updated_at_utc"] = timestamp
		characters[character_id] = character
		applied_by_id[character_id] = applied
	var next_payload := payload.duplicate(true)
	next_payload["characters"] = characters
	var result := _validate_candidate(next_payload)
	if not result.get("ok", false):
		return result
	return {"ok": true, "status": "xp_adjusted", "applied_by_id": applied_by_id, "payload": result["payload"]}


func perform_rest(payload_value: Variant, rest_type: String, now_utc: String = "") -> Dictionary:
	if rest_type not in ["short", "long"]:
		return _failure("Rasttyp ist ungültig.")
	var validated := validate_payload(payload_value)
	if not validated.get("ok", false):
		return validated
	var payload: Dictionary = validated["payload"]
	var characters: Dictionary = payload["characters"].duplicate(true)
	var timestamp := now_utc if not now_utc.is_empty() else Time.get_datetime_string_from_system(true)
	var affected := 0
	for character_id_value in characters:
		var character: Dictionary = characters[character_id_value].duplicate(true)
		if character["membership"] != "active":
			continue
		if rest_type == "short":
			character["xp_since_short_rest"] = 0
			character["short_rests_taken_since_long_rest"] = mini(2, int(character["short_rests_taken_since_long_rest"]) + 1)
		else:
			character["xp_since_long_rest"] = 0
			character["xp_since_short_rest"] = 0
			character["short_rests_taken_since_long_rest"] = 0
		character["updated_at_utc"] = timestamp
		characters[character_id_value] = character
		affected += 1
	var next_payload := payload.duplicate(true)
	next_payload["characters"] = characters
	var result := _validate_candidate(next_payload)
	if not result.get("ok", false):
		return result
	return {"ok": true, "status": "%s_rest" % rest_type, "affected_count": affected, "payload": result["payload"]}


func trash_character(payload_value: Variant, character_id: String, now_utc: String = "") -> Dictionary:
	var validated := validate_payload(payload_value)
	if not validated.get("ok", false):
		return validated
	var payload: Dictionary = validated["payload"]
	if not payload["characters"].has(character_id):
		return _missing(character_id)
	var characters: Dictionary = payload["characters"].duplicate(true)
	var character: Dictionary = characters[character_id].duplicate(true)
	characters.erase(character_id)
	var trash: Dictionary = payload["trash"].duplicate(true)
	trash[character_id] = {
		"character": character,
		"deleted_at_utc": now_utc if not now_utc.is_empty() else Time.get_datetime_string_from_system(true),
	}
	var next_payload := payload.duplicate(true)
	next_payload["characters"] = characters
	next_payload["trash"] = trash
	var result := _validate_candidate(next_payload)
	if not result.get("ok", false):
		return result
	return {"ok": true, "status": "trashed", "character": character, "payload": result["payload"]}


func restore_character(payload_value: Variant, character_id: String, now_utc: String = "") -> Dictionary:
	var validated := validate_payload(payload_value)
	if not validated.get("ok", false):
		return validated
	var payload: Dictionary = validated["payload"]
	if not payload["trash"].has(character_id):
		return _missing(character_id)
	var trash: Dictionary = payload["trash"].duplicate(true)
	var character: Dictionary = trash[character_id]["character"].duplicate(true)
	character["membership"] = "reserve"
	character["travel"] = _detached_travel()
	character["updated_at_utc"] = now_utc if not now_utc.is_empty() else Time.get_datetime_string_from_system(true)
	var characters: Dictionary = payload["characters"].duplicate(true)
	characters[character_id] = character
	trash.erase(character_id)
	var next_payload := payload.duplicate(true)
	next_payload["characters"] = characters
	next_payload["trash"] = trash
	return _mutation_result("restored", next_payload, character)


func snapshot(
	payload_value: Variant,
	search_text: String = "",
	include_deleted: bool = false,
	limit: int = 500,
	cancellation: Callable = Callable()
) -> Dictionary:
	if limit <= 0 or limit > MAX_SEARCH_PAGE_SIZE:
		return _failure("Roster-Abfrage besitzt ungültige Grenzen.")
	if _cancelled(cancellation):
		return _cancelled_failure()
	var validated := validate_payload(payload_value)
	if not validated.get("ok", false):
		return validated
	var payload: Dictionary = validated["payload"]
	var source: Dictionary = payload["trash"] if include_deleted else payload["characters"]
	var needle := search_text.strip_edges().to_lower()
	var roster: Array = []
	for character_id_value in source:
		if _cancelled(cancellation):
			return _cancelled_failure()
		var character: Dictionary = (
			source[character_id_value]["character"] if include_deleted else source[character_id_value]
		)
		var character_id := str(character_id_value)
		var player := "" if character["player_name"] == null else str(character["player_name"])
		if (
			not needle.is_empty()
			and not str(character["name"]).to_lower().contains(needle)
			and not player.to_lower().contains(needle)
			and not character_id.contains(needle)
		):
			continue
		roster.append(_project_character(character, include_deleted))
	roster.sort_custom(func(left: Dictionary, right: Dictionary) -> bool:
		var name_order := str(left["name"]).to_lower().naturalnocasecmp_to(str(right["name"]).to_lower())
		return str(left["character_id"]) < str(right["character_id"]) if name_order == 0 else name_order < 0
	)
	var matching_total := roster.size()
	if roster.size() > limit:
		roster.resize(limit)
	var active: Array = []
	var complete_levels := true
	var level_total := 0
	for character_id_value in payload["characters"]:
		var character: Dictionary = payload["characters"][character_id_value]
		if character["membership"] != "active":
			continue
		var row := _project_character(character, false)
		active.append(row.duplicate(true))
		if row["level"] == null:
			complete_levels = false
		else:
			level_total += int(row["level"])
	active.sort_custom(func(left: Dictionary, right: Dictionary) -> bool:
		return str(left["character_id"]) < str(right["character_id"])
	)
	return {
		"ok": true,
		"status": "empty" if roster.is_empty() else "ready",
		"roster": roster,
		"active": active,
		"total": source.size(),
		"matched": matching_total,
		"deleted": include_deleted,
		"summary": {
			"roster_count": payload["characters"].size(),
			"active_count": active.size(),
			"average_level": null if active.is_empty() or not complete_levels else roundi(float(level_total) / active.size()),
			"complete_levels": complete_levels and not active.is_empty(),
		},
	}


func minimum_xp_for_level(level: int) -> int:
	return XP_THRESHOLDS[clampi(level, 1, 20)]


func next_level_xp(level: int) -> int:
	var safe_level := clampi(level, 1, 20)
	return XP_THRESHOLDS[20] if safe_level >= 20 else XP_THRESHOLDS[safe_level + 1]


func ready_to_level(level: int, current_xp: int) -> bool:
	var safe_level := clampi(level, 1, 20)
	return safe_level < 20 and current_xp >= next_level_xp(safe_level)


func _project_character(character: Dictionary, deleted: bool) -> Dictionary:
	var row := character.duplicate(true)
	row["deleted"] = deleted
	row["next_level_xp"] = null if row["level"] == null else next_level_xp(int(row["level"]))
	row["ready_to_level"] = false if row["level"] == null else ready_to_level(int(row["level"]), int(row["current_xp"]))
	return row


func _update_one(payload_value: Variant, character_id: String, now_utc: String, mutation: Callable, status: String) -> Dictionary:
	var validated := validate_payload(payload_value)
	if not validated.get("ok", false):
		return validated
	var payload: Dictionary = validated["payload"]
	if not payload["characters"].has(character_id):
		return _missing(character_id)
	var character: Dictionary = payload["characters"][character_id].duplicate(true)
	mutation.call(character)
	character["updated_at_utc"] = now_utc if not now_utc.is_empty() else Time.get_datetime_string_from_system(true)
	var characters: Dictionary = payload["characters"].duplicate(true)
	characters[character_id] = character
	var next_payload := payload.duplicate(true)
	next_payload["characters"] = characters
	return _mutation_result(status, next_payload, character)


func _mutation_result(status: String, payload: Dictionary, character: Dictionary) -> Dictionary:
	var result := _validate_candidate(payload)
	if not result.get("ok", false):
		return result
	return {"ok": true, "status": status, "character": character.duplicate(true), "payload": result["payload"]}


func _validate_candidate(payload: Dictionary) -> Dictionary:
	return validate_payload(payload)


func _validate_character(character_id: String, value: Variant) -> Dictionary:
	if not _valid_id(character_id) or not value is Dictionary:
		return _failure("Roster-Eintrag besitzt keine gültige Identität.")
	var character: Dictionary = value
	if character.get("character_id", "") != character_id:
		return _failure("Roster-Schlüssel und Charakteridentität widersprechen sich.")
	var draft := validate_draft(str(character.get("name", "")), {
		"player_name": character.get("player_name", null),
		"level": character.get("level", null),
		"passive_perception": character.get("passive_perception", null),
		"armor_class": character.get("armor_class", null),
	})
	if not draft.get("ok", false):
		return draft
	if (
		not _valid_bounded_integer(character.get("current_xp", null), 0, MAX_XP)
		or not _valid_bounded_integer(character.get("xp_since_long_rest", null), 0, MAX_XP)
		or not _valid_bounded_integer(character.get("xp_since_short_rest", null), 0, MAX_XP)
		or not _valid_bounded_integer(character.get("short_rests_taken_since_long_rest", null), 0, 2)
		or character.get("membership", "") not in ["active", "reserve"]
		or not _valid_travel(character.get("travel", null))
		or not _valid_timestamp(str(character.get("created_at_utc", "")))
		or not _valid_timestamp(str(character.get("updated_at_utc", "")))
	):
		return _failure("Roster-Eintrag %s besitzt ungültige Zustandswerte." % character_id)
	var current_xp := int(character["current_xp"])
	if character["level"] != null and current_xp < minimum_xp_for_level(int(character["level"])):
		return _failure("Roster-Eintrag %s unterschreitet die XP-Grenze seiner Stufe." % character_id)
	if int(character["xp_since_long_rest"]) > current_xp or int(character["xp_since_short_rest"]) > int(character["xp_since_long_rest"]):
		return _failure("Roster-Eintrag %s besitzt widersprüchlichen Rastfortschritt." % character_id)
	return {"ok": true}


func _valid_travel(value: Variant) -> bool:
	if not value is Dictionary:
		return false
	var travel: Dictionary = value
	var kind := str(travel.get("kind", ""))
	if not travel.get("attached_to_party_token", null) is bool:
		return false
	if kind == "detached":
		# Token attachment and a concrete map position are independent. A Party may
		# be assembled before an overworld or dungeon location has been selected.
		return true
	if kind == "overworld":
		return _valid_id(str(travel.get("map_id", ""))) and _valid_id(str(travel.get("tile_id", "")))
	if kind == "dungeon":
		return (
			_valid_id(str(travel.get("map_id", "")))
			and _valid_id(str(travel.get("owner_id", "")))
			and _valid_bounded_integer(travel.get("q", null), -2_147_483_648, 2_147_483_647)
			and _valid_bounded_integer(travel.get("r", null), -2_147_483_648, 2_147_483_647)
			and _valid_bounded_integer(travel.get("level", null), -2_147_483_648, 2_147_483_647)
			and travel.get("location_kind", "") in ["tile", "transition"]
			and travel.get("heading", "") in ["north", "east", "south", "west"]
		)
	return false


func _detached_travel() -> Dictionary:
	return {"kind": "detached", "attached_to_party_token": false}


func _field_label(field: String) -> String:
	return {"level": "Stufe", "passive_perception": "Passive Wahrnehmung", "armor_class": "Rüstungsklasse"}.get(field, field)


func _nullable_integer(value: Variant):
	return null if value == null else int(value)


func _valid_bounded_integer(value: Variant, minimum: int, maximum: int) -> bool:
	if not value is int and not value is float:
		return false
	var numeric := float(value)
	return is_equal_approx(numeric, roundf(numeric)) and numeric >= minimum and numeric <= maximum


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
	return {"ok": false, "status": "cancelled", "error": "Roster-Abfrage wurde ersetzt."}


func _missing(character_id: String) -> Dictionary:
	return {"ok": false, "status": "missing", "error": "Roster-Eintrag fehlt: %s" % character_id}


func _failure(message: String) -> Dictionary:
	return {"ok": false, "status": "invalid", "error": message}
