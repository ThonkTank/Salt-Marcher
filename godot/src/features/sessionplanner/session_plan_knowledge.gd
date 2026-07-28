class_name SessionPlanKnowledge
extends RefCounted

## Pure Session-Planner owner model. Foreign capabilities are referenced, never copied.

const FORMAT_ID := "saltmarcher.session-plans.v1"
const OWNER := "session_planner"
const KIND := "session_plan"
const ALLOCATION_TOTAL := 1_000_000
const DAY_UNITS_PER_DAY := 10_000
const MAX_NAME_LENGTH := 160
const MAX_TEXT_LENGTH := 20_000
const SessionPreparationPolicy = preload("res://godot/src/features/sessionplanner/session_preparation_policy.gd")


func empty_payload() -> Dictionary:
	return {"format": FORMAT_ID, "current_session_id": "", "records": {}}


func validate_payload(value: Variant) -> Dictionary:
	if not value is Dictionary:
		return _failure("Session-Plan-Daten müssen ein Dokument sein.")
	var payload: Dictionary = value
	if (
		payload.get("format", "") != FORMAT_ID
		or not payload.get("current_session_id", null) is String
		or not payload.get("records", null) is Dictionary
	):
		return _failure("Session-Plan-Daten besitzen kein unterstütztes Format.")
	var records: Dictionary = payload["records"]
	var current_id := str(payload["current_session_id"])
	if (records.is_empty() and not current_id.is_empty()) or (not records.is_empty() and not records.has(current_id)):
		return _failure("Aktuelle Session und Session-Sammlung widersprechen sich.")
	for session_id_value in records:
		var validation := _validate_session(str(session_id_value), records[session_id_value])
		if not validation.get("ok", false):
			return validation
	return {"ok": true, "payload": payload.duplicate(true)}


func create_session(
	payload_value: Variant,
	raw_name: String,
	session_id_override: String = "",
	now_utc: String = ""
) -> Dictionary:
	var validated := validate_payload(payload_value)
	if not validated.get("ok", false):
		return validated
	var name := _normalized_name(raw_name)
	if name.is_empty():
		return _failure("Der Session-Name braucht mindestens ein sichtbares Zeichen.")
	var session_id := session_id_override if not session_id_override.is_empty() else "session.%s" % _new_identity()
	var payload: Dictionary = validated["payload"]
	if not _valid_id(session_id) or payload["records"].has(session_id):
		return _failure("Session-Identität ist ungültig oder bereits vergeben.")
	var timestamp := now_utc if not now_utc.is_empty() else Time.get_datetime_string_from_system(true)
	var session := _new_session(session_id, name, timestamp)
	var next_payload: Dictionary = payload.duplicate(true)
	var records: Dictionary = payload["records"].duplicate(true)
	records[session_id] = session
	next_payload["records"] = records
	next_payload["current_session_id"] = session_id
	return _validated_change(next_payload, "created", session)


func select_session(payload_value: Variant, session_id: String, expected_revision: int) -> Dictionary:
	var selected := _target(payload_value, session_id, expected_revision)
	if not selected.get("ok", false):
		return selected
	var payload: Dictionary = selected["payload"]
	if payload["current_session_id"] == session_id:
		return _unchanged(payload, selected["session"], "already_selected")
	var next_payload: Dictionary = payload.duplicate(true)
	next_payload["current_session_id"] = session_id
	return _validated_change(next_payload, "selected", selected["session"])


func rename_session(payload_value: Variant, session_id: String, expected_revision: int, raw_name: String) -> Dictionary:
	var name := _normalized_name(raw_name)
	if name.is_empty():
		return _failure("Der Session-Name braucht mindestens ein sichtbares Zeichen.")
	return _mutate(payload_value, session_id, expected_revision, "renamed", func(session: Dictionary) -> bool:
		if session["name"] == name:
			return false
		session["name"] = name
		return true
	)


func delete_session(payload_value: Variant, session_id: String, expected_revision: int, now_utc: String = "") -> Dictionary:
	var selected := _target(payload_value, session_id, expected_revision)
	if not selected.get("ok", false):
		return selected
	var payload: Dictionary = selected["payload"]
	var records: Dictionary = payload["records"].duplicate(true)
	records.erase(session_id)
	var timestamp := now_utc if not now_utc.is_empty() else Time.get_datetime_string_from_system(true)
	var fallback: Dictionary = {}
	if records.is_empty():
		var fallback_id := "session.%s" % _new_identity()
		fallback = _new_session(fallback_id, "Neue Session", timestamp)
		records[fallback_id] = fallback
	var ids: Array = records.keys()
	ids.sort()
	var next_current := str(payload["current_session_id"])
	if next_current == session_id or not records.has(next_current):
		next_current = str(ids[0])
	var next_payload: Dictionary = payload.duplicate(true)
	next_payload["records"] = records
	next_payload["current_session_id"] = next_current
	var result := _validated_change(next_payload, "deleted", records[next_current])
	result["deleted_session_id"] = session_id
	result["fallback_seeded"] = not fallback.is_empty()
	return result


func set_participants(payload_value: Variant, session_id: String, expected_revision: int, participant_ids: Array) -> Dictionary:
	var normalized: Array[String] = []
	var seen := {}
	for value in participant_ids:
		var participant_id := str(value)
		if not _valid_id(participant_id) or seen.has(participant_id):
			return _failure("Planungsgruppe enthält ungültige oder doppelte Charaktere.")
		seen[participant_id] = true
		normalized.append(participant_id)
	return _mutate(payload_value, session_id, expected_revision, "participants_updated", func(session: Dictionary) -> bool:
		if session["participant_ids"] == normalized:
			return false
		session["participant_ids"] = normalized
		return true
	)


func set_encounter_days(payload_value: Variant, session_id: String, expected_revision: int, day_units: int) -> Dictionary:
	if day_units < 0 or day_units > 1_000_000:
		return _failure("Session-Tage liegen außerhalb des unterstützten Bereichs.")
	return _mutate(payload_value, session_id, expected_revision, "encounter_days_updated", func(session: Dictionary) -> bool:
		if int(session["encounter_days_units"]) == day_units:
			return false
		session["encounter_days_units"] = day_units
		return true
	)


func add_scene(payload_value: Variant, session_id: String, expected_revision: int) -> Dictionary:
	return _mutate(payload_value, session_id, expected_revision, "scene_added", func(session: Dictionary) -> bool:
		var number := int(session["next_scene_number"])
		var scene_id := "scene.%s" % _new_identity()
		var scenes: Array = session["scenes"].duplicate(true)
		scenes.append({
			"scene_id": scene_id,
			"scene_number": number,
			"title": "Szene %d" % number,
			"notes": "",
			"location_id": "",
			"encounter_plan_id": "",
			"allocation_units": 0,
		})
		_rebalance_evenly(scenes)
		session["scenes"] = scenes
		session["selected_scene_id"] = scene_id
		session["next_scene_number"] = number + 1
		return true
	)


func update_scene(
	payload_value: Variant,
	session_id: String,
	expected_revision: int,
	scene_id: String,
	raw_title: String,
	raw_notes: String,
	location_id: String
) -> Dictionary:
	var title := raw_title.strip_edges()
	var notes := raw_notes.strip_edges()
	if title.is_empty() or title.length() > MAX_NAME_LENGTH or notes.length() > MAX_TEXT_LENGTH:
		return _failure("Szenentitel oder Notizen sind ungültig.")
	if not location_id.is_empty() and not _valid_id(location_id):
		return _failure("Szenenort besitzt keine gültige Referenz.")
	return _mutate(payload_value, session_id, expected_revision, "scene_updated", func(session: Dictionary) -> bool:
		var index := _scene_index(session["scenes"], scene_id)
		if index < 0:
			return false
		var scenes: Array = session["scenes"].duplicate(true)
		var scene: Dictionary = scenes[index].duplicate(true)
		if scene["title"] == title and scene["notes"] == notes and scene["location_id"] == location_id:
			return false
		scene["title"] = title
		scene["notes"] = notes
		scene["location_id"] = location_id
		scenes[index] = scene
		session["scenes"] = scenes
		return true
	, scene_id)


func select_scene(payload_value: Variant, session_id: String, expected_revision: int, scene_id: String) -> Dictionary:
	return _mutate(payload_value, session_id, expected_revision, "scene_selected", func(session: Dictionary) -> bool:
		if _scene_index(session["scenes"], scene_id) < 0 or session["selected_scene_id"] == scene_id:
			return false
		session["selected_scene_id"] = scene_id
		return true
	, scene_id)


func save_scene_and_select_scene(
	payload_value: Variant,
	session_id: String,
	expected_revision: int,
	source_scene_id: String,
	raw_title: String,
	raw_notes: String,
	location_id: String,
	target_scene_id: String
) -> Dictionary:
	var draft := _scene_draft(raw_title, raw_notes, location_id)
	if not draft.get("ok", false):
		return draft
	return _mutate(payload_value, session_id, expected_revision, "scene_saved_and_selected", func(session: Dictionary) -> bool:
		var scenes: Array = session["scenes"].duplicate(true)
		var source_index := _scene_index(scenes, source_scene_id)
		if source_index < 0 or _scene_index(scenes, target_scene_id) < 0:
			return false
		var scene: Dictionary = scenes[source_index].duplicate(true)
		scene["title"] = draft["title"]
		scene["notes"] = draft["notes"]
		scene["location_id"] = draft["location_id"]
		scenes[source_index] = scene
		session["scenes"] = scenes
		session["selected_scene_id"] = target_scene_id
		return true
	, source_scene_id)


func save_scene_and_select_session(
	payload_value: Variant,
	source_session_id: String,
	source_revision: int,
	source_scene_id: String,
	raw_title: String,
	raw_notes: String,
	location_id: String,
	target_session_id: String,
	target_revision: int
) -> Dictionary:
	var draft := _scene_draft(raw_title, raw_notes, location_id)
	if not draft.get("ok", false):
		return draft
	var source := _target(payload_value, source_session_id, source_revision)
	if not source.get("ok", false):
		return source
	var payload: Dictionary = source["payload"]
	if not payload["records"].has(target_session_id):
		return {"ok": false, "status": "missing", "error": "Ziel-Session fehlt."}
	if int(payload["records"][target_session_id]["revision"]) != target_revision:
		return {"ok": false, "status": "stale", "error": "Die Ziel-Session wurde inzwischen geändert."}
	var session: Dictionary = source["session"].duplicate(true)
	var scenes: Array = session["scenes"].duplicate(true)
	var source_index := _scene_index(scenes, source_scene_id)
	if source_index < 0:
		return {"ok": false, "status": "missing", "error": "Die bearbeitete Szene fehlt."}
	var scene: Dictionary = scenes[source_index].duplicate(true)
	scene["title"] = draft["title"]
	scene["notes"] = draft["notes"]
	scene["location_id"] = draft["location_id"]
	scenes[source_index] = scene
	session["scenes"] = scenes
	session["revision"] = int(session["revision"]) + 1
	session["updated_at_utc"] = Time.get_datetime_string_from_system(true)
	var records: Dictionary = payload["records"].duplicate(true)
	records[source_session_id] = session
	var next_payload: Dictionary = payload.duplicate(true)
	next_payload["records"] = records
	next_payload["current_session_id"] = target_session_id
	return _validated_change(next_payload, "scene_saved_and_session_selected", records[target_session_id])


func move_scene(payload_value: Variant, session_id: String, expected_revision: int, scene_id: String, delta: int) -> Dictionary:
	if delta not in [-1, 1]:
		return _failure("Szenen können nur um eine Position verschoben werden.")
	return _mutate(payload_value, session_id, expected_revision, "scene_moved", func(session: Dictionary) -> bool:
		var scenes: Array = session["scenes"].duplicate(true)
		var index := _scene_index(scenes, scene_id)
		var next_index := index + delta
		if index < 0 or next_index < 0 or next_index >= scenes.size():
			return false
		var swap = scenes[index]
		scenes[index] = scenes[next_index]
		scenes[next_index] = swap
		session["scenes"] = scenes
		session["rests"] = _pruned_rests(scenes, session["rests"])
		return true
	, scene_id)


func remove_scene(payload_value: Variant, session_id: String, expected_revision: int, scene_id: String) -> Dictionary:
	return _mutate(payload_value, session_id, expected_revision, "scene_removed", func(session: Dictionary) -> bool:
		var scenes: Array = session["scenes"].duplicate(true)
		var index := _scene_index(scenes, scene_id)
		if index < 0:
			return false
		scenes.remove_at(index)
		_rebalance_proportionally(scenes)
		session["scenes"] = scenes
		session["rests"] = _pruned_rests(scenes, session["rests"])
		var notes: Array = []
		for note in session["manual_loot_notes"]:
			if note["scene_id"] != scene_id:
				notes.append(note)
		session["manual_loot_notes"] = notes
		var rewards: Array = []
		for reward in session["generated_rewards"]:
			if reward["scene_id"] != scene_id:
				rewards.append(reward)
		session["generated_rewards"] = rewards
		if session["selected_scene_id"] == scene_id:
			session["selected_scene_id"] = "" if scenes.is_empty() else scenes[mini(index, scenes.size() - 1)]["scene_id"]
		return true
	, scene_id)


func attach_encounter(payload_value: Variant, session_id: String, expected_revision: int, scene_id: String, plan_id: String) -> Dictionary:
	if not _valid_id(plan_id):
		return _failure("Encounter Plan besitzt keine gültige Referenz.")
	return _set_scene_field(payload_value, session_id, expected_revision, scene_id, "encounter_plan_id", plan_id, "encounter_attached")


func detach_encounter(payload_value: Variant, session_id: String, expected_revision: int, scene_id: String) -> Dictionary:
	return _set_scene_field(payload_value, session_id, expected_revision, scene_id, "encounter_plan_id", "", "encounter_detached")


func set_allocation(payload_value: Variant, session_id: String, expected_revision: int, scene_id: String, allocation_units: int) -> Dictionary:
	if allocation_units < 0 or allocation_units > ALLOCATION_TOTAL:
		return _failure("Szenenbudget muss zwischen 0 und 100 Prozent liegen.")
	return _mutate(payload_value, session_id, expected_revision, "allocation_updated", func(session: Dictionary) -> bool:
		var scenes: Array = session["scenes"].duplicate(true)
		var index := _scene_index(scenes, scene_id)
		if index < 0:
			return false
		if scenes.size() == 1:
			allocation_units = ALLOCATION_TOTAL
		if int(scenes[index]["allocation_units"]) == allocation_units:
			return false
		var remaining := ALLOCATION_TOTAL - allocation_units
		var other_total := 0
		for offset in scenes.size():
			if offset != index:
				other_total += int(scenes[offset]["allocation_units"])
		var consumed := 0
		var others_seen := 0
		for offset in scenes.size():
			var scene: Dictionary = scenes[offset].duplicate(true)
			if offset == index:
				scene["allocation_units"] = allocation_units
			else:
				others_seen += 1
				var others_left := scenes.size() - 1 - others_seen
				var value := remaining - consumed if others_left == 0 else (
					remaining / (scenes.size() - 1) if other_total == 0 else int(round(float(scene["allocation_units"]) * remaining / other_total))
				)
				value = clampi(value, 0, remaining - consumed)
				scene["allocation_units"] = value
				consumed += value
			scenes[offset] = scene
		session["scenes"] = scenes
		return true
	, scene_id)


func set_rest(payload_value: Variant, session_id: String, expected_revision: int, left_id: String, right_id: String, kind: String) -> Dictionary:
	if kind not in ["", "SHORT_REST", "LONG_REST"]:
		return _failure("Rasttyp ist ungültig.")
	return _mutate(payload_value, session_id, expected_revision, "rest_updated", func(session: Dictionary) -> bool:
		if not _adjacent(session["scenes"], left_id, right_id):
			return false
		var rests: Array = []
		var previous := ""
		for rest in session["rests"]:
			if rest["left_scene_id"] == left_id and rest["right_scene_id"] == right_id:
				previous = rest["kind"]
			else:
				rests.append(rest)
		if previous == kind:
			return false
		if not kind.is_empty():
			rests.append({"left_scene_id": left_id, "right_scene_id": right_id, "kind": kind})
		session["rests"] = rests
		return true
	)


func commit_prepared_session(
	payload_value: Variant,
	prepared_value: Variant,
	mappings_value: Variant,
	now_utc: String = ""
) -> Dictionary:
	var payload_validation := validate_payload(payload_value)
	if not payload_validation.get("ok", false):
		return payload_validation
	var finalized := SessionPreparationPolicy.new().finalize(prepared_value, mappings_value)
	if not finalized.get("ok", false):
		return finalized
	var payload: Dictionary = payload_validation["payload"]
	var session_id := str(finalized["session_id"])
	if not payload["records"].has(session_id):
		return {"ok": false, "status": "missing", "error": "Die vorbereitete Session fehlt inzwischen."}
	var current: Dictionary = payload["records"][session_id]
	if int(current["revision"]) == int(finalized["source_revision"]) + 1 and _same_prepared_content(current, finalized):
		return _unchanged(payload, current, "already_committed")
	if int(current["revision"]) != int(finalized["source_revision"]):
		return {"ok": false, "status": "stale", "error": "Die Session wurde während der Vorbereitung geändert.", "actual_revision": current["revision"]}
	var session: Dictionary = current.duplicate(true)
	session["scenes"] = finalized["scenes"].duplicate(true)
	session["rests"] = finalized["rests"].duplicate(true)
	session["manual_loot_notes"] = finalized["manual_loot_notes"].duplicate(true)
	session["generated_rewards"] = finalized["generated_rewards"].duplicate(true)
	session["selected_scene_id"] = finalized["selected_scene_id"]
	session["next_scene_number"] = finalized["scenes"].size() + 1
	session["next_note_number"] = 1
	session["revision"] = int(current["revision"]) + 1
	session["updated_at_utc"] = now_utc if not now_utc.is_empty() else Time.get_datetime_string_from_system(true)
	var next_payload: Dictionary = payload.duplicate(true)
	var records: Dictionary = payload["records"].duplicate(true)
	records[session_id] = session
	next_payload["records"] = records
	return _validated_change(next_payload, "prepared_committed", session)


func _same_prepared_content(session: Dictionary, finalized: Dictionary) -> bool:
	return (
		session["scenes"] == finalized["scenes"]
		and session["rests"] == finalized["rests"]
		and session["manual_loot_notes"] == finalized["manual_loot_notes"]
		and session["generated_rewards"] == finalized["generated_rewards"]
		and session["selected_scene_id"] == finalized["selected_scene_id"]
	)


func add_loot_note(payload_value: Variant, session_id: String, expected_revision: int, scene_id: String, raw_text: String) -> Dictionary:
	var text := raw_text.strip_edges()
	if text.is_empty() or text.length() > MAX_TEXT_LENGTH:
		return _failure("Beutenotiz ist leer oder zu lang.")
	return _mutate(payload_value, session_id, expected_revision, "loot_note_added", func(session: Dictionary) -> bool:
		if _scene_index(session["scenes"], scene_id) < 0:
			return false
		var notes: Array = session["manual_loot_notes"].duplicate(true)
		var number := int(session["next_note_number"])
		notes.append({"note_id": "loot.%d" % number, "scene_id": scene_id, "text": text})
		session["manual_loot_notes"] = notes
		session["next_note_number"] = number + 1
		return true
	, scene_id)


func update_loot_note(payload_value: Variant, session_id: String, expected_revision: int, scene_id: String, note_id: String, raw_text: String) -> Dictionary:
	var text := raw_text.strip_edges()
	if text.is_empty() or text.length() > MAX_TEXT_LENGTH:
		return _failure("Beutenotiz ist leer oder zu lang.")
	return _mutate(payload_value, session_id, expected_revision, "loot_note_updated", func(session: Dictionary) -> bool:
		var notes: Array = session["manual_loot_notes"].duplicate(true)
		for index in notes.size():
			if notes[index]["note_id"] == note_id and notes[index]["scene_id"] == scene_id:
				if notes[index]["text"] == text:
					return false
				var note: Dictionary = notes[index].duplicate(true)
				note["text"] = text
				notes[index] = note
				session["manual_loot_notes"] = notes
				return true
		return false
	, scene_id)


func remove_loot_note(payload_value: Variant, session_id: String, expected_revision: int, scene_id: String, note_id: String) -> Dictionary:
	return _mutate(payload_value, session_id, expected_revision, "loot_note_removed", func(session: Dictionary) -> bool:
		var notes: Array = session["manual_loot_notes"].duplicate(true)
		for index in notes.size():
			if notes[index]["note_id"] == note_id and notes[index]["scene_id"] == scene_id:
				notes.remove_at(index)
				session["manual_loot_notes"] = notes
				return true
		return false
	, scene_id)


func snapshot(payload_value: Variant) -> Dictionary:
	var validated := validate_payload(payload_value)
	if not validated.get("ok", false):
		return validated
	var payload: Dictionary = validated["payload"]
	var sessions: Array = []
	for session_id_value in payload["records"]:
		var session: Dictionary = payload["records"][session_id_value]
		sessions.append({"session_id": session["session_id"], "name": session["name"], "revision": session["revision"]})
	sessions.sort_custom(func(left: Dictionary, right: Dictionary) -> bool:
		var order := str(left["name"]).naturalnocasecmp_to(str(right["name"]))
		return str(left["session_id"]) < str(right["session_id"]) if order == 0 else order < 0
	)
	var current: Dictionary = {}
	if not payload["current_session_id"].is_empty():
		current = payload["records"][payload["current_session_id"]].duplicate(true)
	return {"ok": true, "status": "empty" if current.is_empty() else "ready", "sessions": sessions, "current": current}


func _set_scene_field(payload_value: Variant, session_id: String, expected_revision: int, scene_id: String, field: String, value: String, status: String) -> Dictionary:
	return _mutate(payload_value, session_id, expected_revision, status, func(session: Dictionary) -> bool:
		var scenes: Array = session["scenes"].duplicate(true)
		var index := _scene_index(scenes, scene_id)
		if index < 0 or scenes[index][field] == value:
			return false
		var scene: Dictionary = scenes[index].duplicate(true)
		scene[field] = value
		scenes[index] = scene
		session["scenes"] = scenes
		return true
	, scene_id)


func _scene_draft(raw_title: String, raw_notes: String, location_id: String) -> Dictionary:
	var title := raw_title.strip_edges()
	var notes := raw_notes.strip_edges()
	if title.is_empty() or title.length() > MAX_NAME_LENGTH or notes.length() > MAX_TEXT_LENGTH:
		return _failure("Szenentitel oder Notizen sind ungültig.")
	if not location_id.is_empty() and not _valid_id(location_id):
		return _failure("Szenenort besitzt keine gültige Referenz.")
	return {"ok": true, "title": title, "notes": notes, "location_id": location_id}


func _mutate(payload_value: Variant, session_id: String, expected_revision: int, status: String, mutation: Callable, required_scene_id: String = "") -> Dictionary:
	var selected := _target(payload_value, session_id, expected_revision)
	if not selected.get("ok", false):
		return selected
	var payload: Dictionary = selected["payload"]
	var session: Dictionary = selected["session"].duplicate(true)
	if not required_scene_id.is_empty() and _scene_index(session["scenes"], required_scene_id) < 0:
		return {"ok": false, "status": "missing", "error": "Die adressierte Szene fehlt."}
	if not mutation.call(session):
		return _unchanged(payload, session, "unchanged")
	session["revision"] = int(session["revision"]) + 1
	session["updated_at_utc"] = Time.get_datetime_string_from_system(true)
	var records: Dictionary = payload["records"].duplicate(true)
	records[session_id] = session
	var next_payload: Dictionary = payload.duplicate(true)
	next_payload["records"] = records
	return _validated_change(next_payload, status, session)


func _target(payload_value: Variant, session_id: String, expected_revision: int) -> Dictionary:
	var validated := validate_payload(payload_value)
	if not validated.get("ok", false):
		return validated
	var payload: Dictionary = validated["payload"]
	if not payload["records"].has(session_id):
		return {"ok": false, "status": "missing", "error": "Session fehlt: %s" % session_id}
	var session: Dictionary = payload["records"][session_id]
	if int(session["revision"]) != expected_revision:
		return {"ok": false, "status": "stale", "error": "Die Session wurde inzwischen geändert.", "actual_revision": session["revision"]}
	return {"ok": true, "payload": payload, "session": session.duplicate(true)}


func _new_session(session_id: String, name: String, timestamp: String) -> Dictionary:
	return {
		"session_id": session_id,
		"kind": KIND,
		"name": name,
		"revision": 1,
		"participant_ids": [],
		"encounter_days_units": DAY_UNITS_PER_DAY,
		"scenes": [],
		"rests": [],
		"manual_loot_notes": [],
		"generated_rewards": [],
		"selected_scene_id": "",
		"next_scene_number": 1,
		"next_note_number": 1,
		"created_at_utc": timestamp,
		"updated_at_utc": timestamp,
	}


func _validate_session(session_id: String, value: Variant) -> Dictionary:
	if not _valid_id(session_id) or not value is Dictionary:
		return _failure("Session besitzt keine gültige Identität.")
	var session: Dictionary = value
	if (
		session.get("session_id", "") != session_id
		or session.get("kind", "") != KIND
		or _normalized_name(str(session.get("name", ""))).is_empty()
		or not _positive_int(session.get("revision", null))
		or not session.get("participant_ids", null) is Array
		or not _nonnegative_int(session.get("encounter_days_units", null))
		or int(session.get("encounter_days_units", -1)) > 1_000_000
		or not session.get("scenes", null) is Array
		or not session.get("rests", null) is Array
		or not session.get("manual_loot_notes", null) is Array
		or not session.get("generated_rewards", null) is Array
		or not session.get("selected_scene_id", null) is String
		or not _positive_int(session.get("next_scene_number", null))
		or not _positive_int(session.get("next_note_number", null))
		or not _valid_timestamp(str(session.get("created_at_utc", "")))
		or not _valid_timestamp(str(session.get("updated_at_utc", "")))
	):
		return _failure("Session %s besitzt ungültige Fachwerte." % session_id)
	var participants := {}
	for participant_value in session["participant_ids"]:
		var participant_id := str(participant_value)
		if not _valid_id(participant_id) or participants.has(participant_id):
			return _failure("Session-Planungsgruppe ist ungültig.")
		participants[participant_id] = true
	var scene_ids := {}
	var allocation_total := 0
	for scene_value in session["scenes"]:
		var scene_validation := _validate_scene(scene_value)
		if not scene_validation.get("ok", false):
			return scene_validation
		var scene_id := str(scene_value["scene_id"])
		if scene_ids.has(scene_id):
			return _failure("Szenenidentitäten müssen innerhalb einer Session eindeutig sein.")
		scene_ids[scene_id] = true
		allocation_total += int(scene_value["allocation_units"])
	if (not session["scenes"].is_empty() and allocation_total != ALLOCATION_TOTAL) or (session["scenes"].is_empty() and allocation_total != 0):
		return _failure("Szenenbudgets müssen zusammen exakt 100 Prozent ergeben.")
	if not session["selected_scene_id"].is_empty() and not scene_ids.has(session["selected_scene_id"]):
		return _failure("Die ausgewählte Szene fehlt in der Session.")
	var gaps := {}
	for rest_value in session["rests"]:
		if not rest_value is Dictionary:
			return _failure("Rastmarke ist ungültig.")
		var left_id := str(rest_value.get("left_scene_id", ""))
		var right_id := str(rest_value.get("right_scene_id", ""))
		var gap := "%s|%s" % [left_id, right_id]
		if rest_value.get("kind", "") not in ["SHORT_REST", "LONG_REST"] or not _adjacent(session["scenes"], left_id, right_id) or gaps.has(gap):
			return _failure("Rastmarken dürfen nur eindeutige benachbarte Szenen verbinden.")
		gaps[gap] = true
	var note_ids := {}
	for note_value in session["manual_loot_notes"]:
		if not note_value is Dictionary:
			return _failure("Beutenotiz ist ungültig.")
		var note: Dictionary = note_value
		var note_id := str(note.get("note_id", ""))
		var text := str(note.get("text", "")).strip_edges()
		if not _valid_id(note_id) or note_ids.has(note_id) or not scene_ids.has(str(note.get("scene_id", ""))) or text.is_empty() or text.length() > MAX_TEXT_LENGTH:
			return _failure("Beutenotiz besitzt ungültige Fachwerte.")
		note_ids[note_id] = true
	var reward_keys := {}
	for reward_value in session["generated_rewards"]:
		if not reward_value is Dictionary or reward_value.size() != 4:
			return _failure("Generierte Beutereferenz ist ungültig.")
		var reward: Dictionary = reward_value
		var key := "%s|%s" % [reward.get("generation_id", ""), reward.get("treasure_id", "")]
		if not scene_ids.has(str(reward.get("scene_id", ""))) or not _valid_id(str(reward.get("generation_id", ""))) or not _valid_id(str(reward.get("treasure_id", ""))) or str(reward.get("last_known_label", "")).strip_edges().is_empty() or str(reward.get("last_known_label", "")).length() > MAX_NAME_LENGTH or reward_keys.has(key):
			return _failure("Generierte Beutereferenz besitzt ungültige Fachwerte.")
		reward_keys[key] = true
	return {"ok": true}


func _validate_scene(value: Variant) -> Dictionary:
	if not value is Dictionary:
		return _failure("Szene ist ungültig.")
	var scene: Dictionary = value
	var title := str(scene.get("title", "")).strip_edges()
	var notes := str(scene.get("notes", ""))
	var location_id := str(scene.get("location_id", ""))
	var plan_id := str(scene.get("encounter_plan_id", ""))
	if (
		not _valid_id(str(scene.get("scene_id", "")))
		or not _positive_int(scene.get("scene_number", null))
		or title.is_empty() or title.length() > MAX_NAME_LENGTH
		or notes.length() > MAX_TEXT_LENGTH
		or (not location_id.is_empty() and not _valid_id(location_id))
		or (not plan_id.is_empty() and not _valid_id(plan_id))
		or not _nonnegative_int(scene.get("allocation_units", null))
		or int(scene.get("allocation_units", -1)) > ALLOCATION_TOTAL
	):
		return _failure("Szene besitzt ungültige Fachwerte.")
	return {"ok": true}


func _rebalance_evenly(scenes: Array) -> void:
	if scenes.is_empty():
		return
	var base := ALLOCATION_TOTAL / scenes.size()
	var consumed := 0
	for index in scenes.size():
		var scene: Dictionary = scenes[index].duplicate(true)
		var value := ALLOCATION_TOTAL - consumed if index == scenes.size() - 1 else base
		scene["allocation_units"] = value
		consumed += value
		scenes[index] = scene


func _rebalance_proportionally(scenes: Array) -> void:
	if scenes.is_empty():
		return
	var source_total := 0
	for scene in scenes:
		source_total += int(scene["allocation_units"])
	if source_total <= 0:
		_rebalance_evenly(scenes)
		return
	var consumed := 0
	for index in scenes.size():
		var scene: Dictionary = scenes[index].duplicate(true)
		var value := ALLOCATION_TOTAL - consumed if index == scenes.size() - 1 else int(round(float(scene["allocation_units"]) * ALLOCATION_TOTAL / source_total))
		value = clampi(value, 0, ALLOCATION_TOTAL - consumed)
		scene["allocation_units"] = value
		consumed += value
		scenes[index] = scene


func _pruned_rests(scenes: Array, rests: Array) -> Array:
	var result: Array = []
	for rest in rests:
		if _adjacent(scenes, rest["left_scene_id"], rest["right_scene_id"]):
			result.append(rest)
	return result


func _adjacent(scenes: Array, left_id: String, right_id: String) -> bool:
	for index in maxi(0, scenes.size() - 1):
		if scenes[index]["scene_id"] == left_id and scenes[index + 1]["scene_id"] == right_id:
			return true
	return false


func _scene_index(scenes: Array, scene_id: String) -> int:
	for index in scenes.size():
		if scenes[index]["scene_id"] == scene_id:
			return index
	return -1


func _validated_change(payload: Dictionary, status: String, session: Dictionary) -> Dictionary:
	var validation := validate_payload(payload)
	if not validation.get("ok", false):
		return validation
	return {"ok": true, "status": status, "payload": validation["payload"], "session": session.duplicate(true)}


func _unchanged(payload: Dictionary, session: Dictionary, status: String) -> Dictionary:
	return {"ok": true, "status": status, "no_write": true, "payload": payload.duplicate(true), "session": session.duplicate(true)}


func _normalized_name(value: String) -> String:
	var result := value.strip_edges()
	return "" if result.length() > MAX_NAME_LENGTH else result


func _positive_int(value: Variant) -> bool:
	return (value is int or value is float) and is_finite(float(value)) and is_equal_approx(float(value), roundf(float(value))) and float(value) > 0


func _nonnegative_int(value: Variant) -> bool:
	return (value is int or value is float) and is_finite(float(value)) and is_equal_approx(float(value), roundf(float(value))) and float(value) >= 0


func _valid_id(value: String) -> bool:
	if value.is_empty() or value.length() > 160 or value in [".", ".."]:
		return false
	for index in value.length():
		var code := value.unicode_at(index)
		if not ((code >= 48 and code <= 57) or (code >= 97 and code <= 122) or code in [45, 46, 95]):
			return false
	return true


func _valid_timestamp(value: String) -> bool:
	return not value.is_empty() and value.length() <= 64


func _new_identity() -> String:
	var bytes := Crypto.new().generate_random_bytes(16)
	bytes[6] = (bytes[6] & 0x0f) | 0x40
	bytes[8] = (bytes[8] & 0x3f) | 0x80
	var value := bytes.hex_encode()
	return "%s-%s-%s-%s-%s" % [value.substr(0, 8), value.substr(8, 4), value.substr(12, 4), value.substr(16, 4), value.substr(20, 12)]


func _failure(message: String) -> Dictionary:
	return {"ok": false, "status": "invalid", "error": message}
