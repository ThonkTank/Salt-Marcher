class_name SceneKnowledge
extends RefCounted

## Pure Scene-owned running-workspace state. Foreign objects stay referenced by
## stable identity; resolved labels and Encounter combat truth remain derived.

const FORMAT_ID := "saltmarcher.scene.v1"
const OWNER := "scene"
const STANDARD_SCENE_ID := "scene.standard"
const MAX_SCENES := 1_000
const MAX_PARTICIPANTS := 10_000
const MAX_TITLE_LENGTH := 160
const MAX_NOTES_LENGTH := 100_000
const PARTICIPANT_KINDS := ["pc", "npc", "mob"]


func empty_payload() -> Dictionary:
	return {
		"format": FORMAT_ID,
		"revision": 0,
		"next_scene_number": 2,
		"standard_scene_id": STANDARD_SCENE_ID,
		"focused_scene_id": STANDARD_SCENE_ID,
		"scenes": {STANDARD_SCENE_ID: _new_scene(STANDARD_SCENE_ID, "Standardszene")},
	}


func validate_payload(value: Variant) -> Dictionary:
	if not value is Dictionary:
		return _failure("Scene-Daten müssen ein Dokument sein.")
	var payload: Dictionary = value
	if (
		payload.size() != 6
		or payload.get("format", "") != FORMAT_ID
		or not _nonnegative_integer(payload.get("revision", null))
		or not _positive_integer(payload.get("next_scene_number", null))
		or not _valid_id(str(payload.get("standard_scene_id", "")))
		or not _valid_id(str(payload.get("focused_scene_id", "")))
		or not payload.get("scenes", null) is Dictionary
	):
		return _failure("Scene-Daten besitzen kein unterstütztes Format.")
	var scenes: Dictionary = payload["scenes"]
	if (
		scenes.is_empty()
		or scenes.size() > MAX_SCENES
		or not scenes.has(payload["standard_scene_id"])
		or not scenes.has(payload["focused_scene_id"])
	):
		return _failure("Scene-Arbeitsbereich braucht Standard- und fokussierte Szene.")
	var globally_assigned_pcs := {}
	var globally_assigned_npcs := {}
	for scene_id_value in scenes:
		var scene_id := str(scene_id_value)
		var scene_validation := _validate_scene(scene_id, scenes[scene_id_value])
		if not scene_validation.get("ok", false):
			return scene_validation
		var scene: Dictionary = scenes[scene_id_value]
		for pc_id in scene["party_member_ids"]:
			if globally_assigned_pcs.has(pc_id):
				return _failure("Ein SC darf nur einer laufenden Szene zugeordnet sein.")
			globally_assigned_pcs[pc_id] = scene_id
		for npc_id in scene["npc_ids"]:
			if globally_assigned_npcs.has(npc_id):
				return _failure("Ein NPC darf nur einer laufenden Szene zugeordnet sein.")
			globally_assigned_npcs[npc_id] = scene_id
	return {"ok": true, "payload": payload.duplicate(true)}


func initialize(payload_value: Variant, active_party_ids: Array) -> Dictionary:
	var validated := validate_payload(payload_value)
	if not validated.get("ok", false):
		return validated
	var ids := _unique_ids(active_party_ids, "Aktive Party")
	if not ids.get("ok", false):
		return ids
	var payload: Dictionary = validated["payload"]
	if int(payload["revision"]) > 0:
		return refresh_active_party(payload, ids["ids"])
	var scenes: Dictionary = payload["scenes"].duplicate(true)
	var standard: Dictionary = scenes[payload["standard_scene_id"]].duplicate(true)
	standard["party_member_ids"] = ids["ids"].duplicate()
	scenes[payload["standard_scene_id"]] = standard
	var next_payload := payload.duplicate(true)
	next_payload["revision"] = 1
	next_payload["scenes"] = scenes
	return _validated_change(next_payload, "initialized", standard)


func snapshot(payload_value: Variant) -> Dictionary:
	var validated := validate_payload(payload_value)
	if not validated.get("ok", false):
		return validated
	var payload: Dictionary = validated["payload"]
	var scenes: Array = []
	var assigned_pc_ids := {}
	var assigned_npc_ids := {}
	for scene_id_value in payload["scenes"]:
		var scene: Dictionary = payload["scenes"][scene_id_value]
		var summary := scene.duplicate(true)
		summary["focused"] = scene["scene_id"] == payload["focused_scene_id"]
		summary["standard"] = scene["scene_id"] == payload["standard_scene_id"]
		summary["participant_count"] = scene["party_member_ids"].size() + scene["npc_ids"].size() + scene["mobs"].size()
		scenes.append(summary)
		for pc_id in scene["party_member_ids"]:
			assigned_pc_ids[pc_id] = true
		for npc_id in scene["npc_ids"]:
			assigned_npc_ids[npc_id] = true
	scenes.sort_custom(func(left: Dictionary, right: Dictionary) -> bool:
		if bool(left["standard"]) != bool(right["standard"]):
			return bool(left["standard"])
		var order := str(left["title"]).naturalnocasecmp_to(str(right["title"]))
		return str(left["scene_id"]) < str(right["scene_id"]) if order == 0 else order < 0
	)
	return {
		"ok": true,
		"status": "ready",
		"revision": payload["revision"],
		"focused_scene_id": payload["focused_scene_id"],
		"standard_scene_id": payload["standard_scene_id"],
		"focused": payload["scenes"][payload["focused_scene_id"]].duplicate(true),
		"scenes": scenes,
		"assigned_pc_ids": assigned_pc_ids.keys(),
		"assigned_npc_ids": assigned_npc_ids.keys(),
	}


func create_scene(payload_value: Variant, raw_title: String, scene_id_override: String = "") -> Dictionary:
	var validated := validate_payload(payload_value)
	if not validated.get("ok", false):
		return validated
	var title := raw_title.strip_edges()
	if title.is_empty() or title.length() > MAX_TITLE_LENGTH:
		return _failure("Eine laufende Szene braucht einen kurzen sichtbaren Titel.")
	var payload: Dictionary = validated["payload"]
	if payload["scenes"].size() >= MAX_SCENES:
		return _failure("Die Scene-Sammlung hat ihre sichere Grenze erreicht.")
	var scene_id := scene_id_override if not scene_id_override.is_empty() else "scene.runtime.%s" % _new_identity()
	if not _valid_id(scene_id) or payload["scenes"].has(scene_id):
		return _failure("Scene-Identität ist ungültig oder bereits vergeben.")
	var scene := _new_scene(scene_id, title)
	var next_payload := payload.duplicate(true)
	var scenes: Dictionary = payload["scenes"].duplicate(true)
	scenes[scene_id] = scene
	next_payload["scenes"] = scenes
	next_payload["focused_scene_id"] = scene_id
	next_payload["next_scene_number"] = int(payload["next_scene_number"]) + 1
	next_payload["revision"] = int(payload["revision"]) + 1
	return _validated_change(next_payload, "created", scene)


func import_prepared(
	payload_value: Variant,
	source_session_id: String,
	source_scene: Dictionary,
	active_party_ids: Array,
	scene_id_override: String = ""
) -> Dictionary:
	if not _valid_id(source_session_id) or not source_scene is Dictionary:
		return _failure("Vorbereitete Szene besitzt keine gültige Herkunft.")
	var source_scene_id := str(source_scene.get("scene_id", ""))
	var title := str(source_scene.get("title", "")).strip_edges()
	var notes := str(source_scene.get("notes", "")).strip_edges()
	var location_id := str(source_scene.get("location_id", ""))
	var encounter_plan_id := str(source_scene.get("encounter_plan_id", ""))
	if (
		not _valid_id(source_scene_id)
		or title.is_empty()
		or title.length() > MAX_TITLE_LENGTH
		or notes.length() > MAX_NOTES_LENGTH
		or (not location_id.is_empty() and not _valid_id(location_id))
		or (not encounter_plan_id.is_empty() and not _valid_id(encounter_plan_id))
	):
		return _failure("Vorbereitete Szene enthält ungültige Laufzeitdaten.")
	var created := create_scene(payload_value, title, scene_id_override)
	if not created.get("ok", false):
		return created
	var active := _unique_ids(active_party_ids, "Vorbereitete Party")
	if not active.get("ok", false):
		return active
	var payload: Dictionary = created["payload"]
	var scene_id := str(created["scene"]["scene_id"])
	var scenes: Dictionary = payload["scenes"].duplicate(true)
	var scene: Dictionary = scenes[scene_id].duplicate(true)
	scene["notes"] = notes
	scene["source_session_id"] = source_session_id
	scene["source_scene_id"] = source_scene_id
	scene["initial_encounter_plan_id"] = encounter_plan_id
	scene["location_id"] = location_id
	var assigned := _assigned_ids(payload["scenes"], "party_member_ids", scene_id)
	for pc_id in active["ids"]:
		if not assigned.has(pc_id):
			scene["party_member_ids"].append(pc_id)
	scenes[scene_id] = scene
	var next_payload := payload.duplicate(true)
	next_payload["scenes"] = scenes
	next_payload["revision"] = int(payload["revision"]) + 1
	return _validated_change(next_payload, "prepared_imported", scene)


func focus_scene(payload_value: Variant, scene_id: String) -> Dictionary:
	var target := _target(payload_value, scene_id)
	if not target.get("ok", false):
		return target
	var payload: Dictionary = target["payload"]
	if payload["focused_scene_id"] == scene_id:
		return _unchanged(payload, target["scene"])
	var next_payload := payload.duplicate(true)
	next_payload["focused_scene_id"] = scene_id
	next_payload["revision"] = int(payload["revision"]) + 1
	return _validated_change(next_payload, "focused", target["scene"])


func update_details(payload_value: Variant, scene_id: String, raw_title: String, raw_notes: String) -> Dictionary:
	var title := raw_title.strip_edges()
	var notes := raw_notes.strip_edges()
	if title.is_empty() or title.length() > MAX_TITLE_LENGTH or notes.length() > MAX_NOTES_LENGTH:
		return _failure("Szenentitel oder Notizen liegen außerhalb der sicheren Grenzen.")
	return _mutate_scene(payload_value, scene_id, "details_updated", func(scene: Dictionary) -> bool:
		if scene["title"] == title and scene["notes"] == notes:
			return false
		scene["title"] = title
		scene["notes"] = notes
		return true
	)


func delete_scene(payload_value: Variant, scene_id: String) -> Dictionary:
	var target := _target(payload_value, scene_id)
	if not target.get("ok", false):
		return target
	var payload: Dictionary = target["payload"]
	if scene_id == payload["standard_scene_id"]:
		return _failure("Die Standardszene kann nicht gelöscht werden.", "protected")
	var scenes: Dictionary = payload["scenes"].duplicate(true)
	scenes.erase(scene_id)
	var next_payload := payload.duplicate(true)
	next_payload["scenes"] = scenes
	if payload["focused_scene_id"] == scene_id:
		next_payload["focused_scene_id"] = payload["standard_scene_id"]
	next_payload["revision"] = int(payload["revision"]) + 1
	var result := _validated_change(next_payload, "deleted", scenes[next_payload["focused_scene_id"]])
	result["deleted_scene_id"] = scene_id
	return result


func assign_pc(payload_value: Variant, scene_id: String, character_id: String) -> Dictionary:
	if not _valid_id(character_id):
		return _failure("SC-Referenz ist ungültig.")
	return _move_unique_reference(payload_value, scene_id, character_id, "party_member_ids", "pc_assigned")


func unassign_pc(payload_value: Variant, character_id: String) -> Dictionary:
	if not _valid_id(character_id):
		return _failure("SC-Referenz ist ungültig.")
	return _remove_global_reference(payload_value, character_id, "party_member_ids", "pc_unassigned")


func assign_npc(payload_value: Variant, scene_id: String, npc_id: String) -> Dictionary:
	if not _valid_id(npc_id):
		return _failure("NPC-Referenz ist ungültig.")
	return _move_unique_reference(payload_value, scene_id, npc_id, "npc_ids", "npc_assigned")


func unassign_npc(payload_value: Variant, npc_id: String) -> Dictionary:
	if not _valid_id(npc_id):
		return _failure("NPC-Referenz ist ungültig.")
	return _remove_global_reference(payload_value, npc_id, "npc_ids", "npc_unassigned")


func set_location(payload_value: Variant, scene_id: String, location_id: String) -> Dictionary:
	if not location_id.is_empty() and not _valid_id(location_id):
		return _failure("Ortsreferenz ist ungültig.")
	return _mutate_scene(payload_value, scene_id, "location_updated", func(scene: Dictionary) -> bool:
		if scene["location_id"] == location_id:
			return false
		scene["location_id"] = location_id
		return true
	)


func assign_mob(payload_value: Variant, scene_id: String, creature_id: String, count: int) -> Dictionary:
	if not _valid_id(creature_id) or count <= 0 or count > 1_000_000:
		return _failure("Mob braucht Creature-Referenz und positive Anzahl.")
	return _mutate_scene(payload_value, scene_id, "mob_assigned", func(scene: Dictionary) -> bool:
		var mobs: Array = scene["mobs"].duplicate(true)
		for index in mobs.size():
			if mobs[index]["creature_id"] == creature_id:
				if int(mobs[index]["count"]) == count:
					return false
				var mob: Dictionary = mobs[index].duplicate(true)
				mob["count"] = count
				mobs[index] = mob
				scene["mobs"] = mobs
				return true
		mobs.append({"assignment_id": "mob.%s" % _new_identity(), "creature_id": creature_id, "count": count})
		scene["mobs"] = mobs
		return true
	)


func unassign_mob(payload_value: Variant, scene_id: String, creature_id: String) -> Dictionary:
	if not _valid_id(creature_id):
		return _failure("Mob-Creature-Referenz ist ungültig.")
	return _mutate_scene(payload_value, scene_id, "mob_unassigned", func(scene: Dictionary) -> bool:
		var mobs: Array = scene["mobs"].duplicate(true)
		for index in mobs.size():
			if mobs[index]["creature_id"] == creature_id:
				mobs.remove_at(index)
				scene["mobs"] = mobs
				return true
		return false
	)


func set_participant_state(
	payload_value: Variant,
	scene_id: String,
	kind: String,
	ref_id: String,
	defeated: bool,
	raw_notes: String
) -> Dictionary:
	var notes := raw_notes.strip_edges()
	if kind not in PARTICIPANT_KINDS or not _valid_id(ref_id) or notes.length() > MAX_NOTES_LENGTH:
		return _failure("Teilnehmerstatus enthält ungültige Werte.")
	return _mutate_scene(payload_value, scene_id, "participant_state_updated", func(scene: Dictionary) -> bool:
		if not _scene_has_participant(scene, kind, ref_id):
			return false
		var key := "%s:%s" % [kind, ref_id]
		var states: Dictionary = scene["participant_states"].duplicate(true)
		if not defeated and notes.is_empty():
			if not states.has(key):
				return false
			states.erase(key)
		else:
			var next := {"kind": kind, "ref_id": ref_id, "defeated": defeated, "notes": notes}
			if states.get(key, {}) == next:
				return false
			states[key] = next
		scene["participant_states"] = states
		return true
	)


func refresh_active_party(payload_value: Variant, active_party_ids: Array) -> Dictionary:
	var validated := validate_payload(payload_value)
	if not validated.get("ok", false):
		return validated
	var active := _unique_ids(active_party_ids, "Aktive Party")
	if not active.get("ok", false):
		return active
	var active_set := {}
	for id in active["ids"]:
		active_set[id] = true
	var payload: Dictionary = validated["payload"]
	var scenes: Dictionary = payload["scenes"].duplicate(true)
	var changed := false
	for scene_id_value in scenes:
		var scene: Dictionary = scenes[scene_id_value].duplicate(true)
		var retained: Array = []
		for pc_id in scene["party_member_ids"]:
			if active_set.has(pc_id):
				retained.append(pc_id)
			else:
				changed = true
				scene["participant_states"].erase("pc:%s" % pc_id)
		scene["party_member_ids"] = retained
		scenes[scene_id_value] = scene
	if not changed:
		return _unchanged(payload, payload["scenes"][payload["focused_scene_id"]])
	var next_payload := payload.duplicate(true)
	next_payload["scenes"] = scenes
	next_payload["revision"] = int(payload["revision"]) + 1
	return _validated_change(next_payload, "party_refreshed", scenes[next_payload["focused_scene_id"]])


func encounter_context_id(scene_id: String) -> String:
	return "encounter_context.%s" % scene_id


func _move_unique_reference(payload_value: Variant, scene_id: String, ref_id: String, field: String, status: String) -> Dictionary:
	var target := _target(payload_value, scene_id)
	if not target.get("ok", false):
		return target
	var payload: Dictionary = target["payload"]
	var scenes: Dictionary = payload["scenes"].duplicate(true)
	var changed := false
	for id_value in scenes:
		var scene: Dictionary = scenes[id_value].duplicate(true)
		var refs: Array = scene[field].duplicate()
		var existing_index := refs.find(ref_id)
		if str(id_value) == scene_id:
			if existing_index < 0:
				refs.append(ref_id)
				changed = true
		else:
			if existing_index >= 0:
				refs.remove_at(existing_index)
				scene["participant_states"].erase("%s:%s" % ["pc" if field == "party_member_ids" else "npc", ref_id])
				changed = true
		scene[field] = refs
		scenes[id_value] = scene
	if not changed:
		return _unchanged(payload, scenes[scene_id])
	var next_payload := payload.duplicate(true)
	next_payload["scenes"] = scenes
	next_payload["revision"] = int(payload["revision"]) + 1
	return _validated_change(next_payload, status, scenes[scene_id])


func _remove_global_reference(payload_value: Variant, ref_id: String, field: String, status: String) -> Dictionary:
	var validated := validate_payload(payload_value)
	if not validated.get("ok", false):
		return validated
	var payload: Dictionary = validated["payload"]
	var scenes: Dictionary = payload["scenes"].duplicate(true)
	var changed := false
	var focused: Dictionary = scenes[payload["focused_scene_id"]]
	for scene_id_value in scenes:
		var scene: Dictionary = scenes[scene_id_value].duplicate(true)
		var refs: Array = scene[field].duplicate()
		var index := refs.find(ref_id)
		if index >= 0:
			refs.remove_at(index)
			scene[field] = refs
			scene["participant_states"].erase("%s:%s" % ["pc" if field == "party_member_ids" else "npc", ref_id])
			scenes[scene_id_value] = scene
			focused = scene
			changed = true
	if not changed:
		return _failure("Teilnehmer ist keiner laufenden Szene zugeordnet.", "missing")
	var next_payload := payload.duplicate(true)
	next_payload["scenes"] = scenes
	next_payload["revision"] = int(payload["revision"]) + 1
	return _validated_change(next_payload, status, focused)


func _mutate_scene(payload_value: Variant, scene_id: String, status: String, mutation: Callable) -> Dictionary:
	var target := _target(payload_value, scene_id)
	if not target.get("ok", false):
		return target
	var payload: Dictionary = target["payload"]
	var scene: Dictionary = target["scene"].duplicate(true)
	if not mutation.call(scene):
		return _unchanged(payload, scene)
	var scenes: Dictionary = payload["scenes"].duplicate(true)
	scenes[scene_id] = scene
	var next_payload := payload.duplicate(true)
	next_payload["scenes"] = scenes
	next_payload["revision"] = int(payload["revision"]) + 1
	return _validated_change(next_payload, status, scene)


func _target(payload_value: Variant, scene_id: String) -> Dictionary:
	var validated := validate_payload(payload_value)
	if not validated.get("ok", false):
		return validated
	if not _valid_id(scene_id) or not validated["payload"]["scenes"].has(scene_id):
		return _failure("Laufende Szene fehlt: %s" % scene_id, "missing")
	return {
		"ok": true,
		"payload": validated["payload"],
		"scene": validated["payload"]["scenes"][scene_id].duplicate(true),
	}


func _validated_change(payload: Dictionary, status: String, scene: Dictionary) -> Dictionary:
	var validated := validate_payload(payload)
	if not validated.get("ok", false):
		return validated
	return {"ok": true, "status": status, "payload": validated["payload"], "scene": scene.duplicate(true)}


func _unchanged(payload: Dictionary, scene: Dictionary) -> Dictionary:
	return {"ok": true, "status": "unchanged", "payload": payload.duplicate(true), "scene": scene.duplicate(true), "no_write": true}


func _new_scene(scene_id: String, title: String) -> Dictionary:
	return {
		"scene_id": scene_id,
		"title": title,
		"notes": "",
		"source_session_id": "",
		"source_scene_id": "",
		"initial_encounter_plan_id": "",
		"location_id": "",
		"party_member_ids": [],
		"npc_ids": [],
		"mobs": [],
		"participant_states": {},
	}


func _validate_scene(scene_id: String, value: Variant) -> Dictionary:
	if not _valid_id(scene_id) or not value is Dictionary:
		return _failure("Laufende Szene besitzt keine gültige Identität.")
	var scene: Dictionary = value
	if (
		scene.size() != 11
		or scene.get("scene_id", "") != scene_id
		or not _valid_text(scene.get("title", null), MAX_TITLE_LENGTH, false)
		or not _valid_text(scene.get("notes", null), MAX_NOTES_LENGTH, true)
		or not _valid_optional_id(scene.get("source_session_id", null))
		or not _valid_optional_id(scene.get("source_scene_id", null))
		or not _valid_optional_id(scene.get("initial_encounter_plan_id", null))
		or not _valid_optional_id(scene.get("location_id", null))
		or not scene.get("party_member_ids", null) is Array
		or not scene.get("npc_ids", null) is Array
		or not scene.get("mobs", null) is Array
		or not scene.get("participant_states", null) is Dictionary
	):
		return _failure("Laufende Szene %s besitzt ungültige Grundwerte." % scene_id)
	for field in ["party_member_ids", "npc_ids"]:
		var seen := {}
		if scene[field].size() > MAX_PARTICIPANTS:
			return _failure("Laufende Szene überschreitet ihre Teilnehmergrenze.")
		for id_value in scene[field]:
			var id := str(id_value)
			if not _valid_id(id) or seen.has(id):
				return _failure("Laufende Szene enthält ungültige oder doppelte Referenzen.")
			seen[id] = true
	var seen_mobs := {}
	for value_mob in scene["mobs"]:
		if not value_mob is Dictionary:
			return _failure("Scene-Mob ist ungültig.")
		var mob: Dictionary = value_mob
		var creature_id := str(mob.get("creature_id", ""))
		if (
			mob.size() != 3
			or not _valid_id(str(mob.get("assignment_id", "")))
			or not _valid_id(creature_id)
			or seen_mobs.has(creature_id)
			or not _positive_integer(mob.get("count", null))
		):
			return _failure("Scene-Mob besitzt ungültige Fakten.")
		seen_mobs[creature_id] = true
	for key_value in scene["participant_states"]:
		var key := str(key_value)
		var state = scene["participant_states"][key_value]
		if not state is Dictionary:
			return _failure("Scene-Teilnehmerstatus ist ungültig.")
		var kind := str(state.get("kind", ""))
		var ref_id := str(state.get("ref_id", ""))
		if (
			state.size() != 4
			or key != "%s:%s" % [kind, ref_id]
			or kind not in PARTICIPANT_KINDS
			or not _valid_id(ref_id)
			or not state.get("defeated", null) is bool
			or not _valid_text(state.get("notes", null), MAX_NOTES_LENGTH, true)
			or not _scene_has_participant(scene, kind, ref_id)
		):
			return _failure("Scene-Teilnehmerstatus verweist auf keinen gültigen Teilnehmer.")
	return {"ok": true}


func _scene_has_participant(scene: Dictionary, kind: String, ref_id: String) -> bool:
	if kind == "pc":
		return ref_id in scene["party_member_ids"]
	if kind == "npc":
		return ref_id in scene["npc_ids"]
	for mob in scene["mobs"]:
		if mob["assignment_id"] == ref_id:
			return true
	return false


func _assigned_ids(scenes: Dictionary, field: String, except_scene_id: String = "") -> Dictionary:
	var assigned := {}
	for scene_id_value in scenes:
		if str(scene_id_value) == except_scene_id:
			continue
		for ref_id in scenes[scene_id_value][field]:
			assigned[ref_id] = true
	return assigned


func _unique_ids(values: Array, label: String) -> Dictionary:
	var ids: Array = []
	var seen := {}
	if values.size() > MAX_PARTICIPANTS:
		return _failure("%s überschreitet ihre sichere Grenze." % label)
	for value in values:
		var id := str(value)
		if not _valid_id(id) or seen.has(id):
			return _failure("%s enthält ungültige oder doppelte Identitäten." % label)
		seen[id] = true
		ids.append(id)
	return {"ok": true, "ids": ids}


func _valid_text(value: Variant, maximum: int, empty_allowed: bool) -> bool:
	return value is String and str(value).length() <= maximum and (empty_allowed or not str(value).strip_edges().is_empty())


func _valid_id(value: String) -> bool:
	if value.is_empty() or value.length() > 160:
		return false
	for index in value.length():
		var code := value.unicode_at(index)
		if not ((code >= 48 and code <= 57) or (code >= 97 and code <= 122) or code in [45, 46, 95]):
			return false
	return value not in [".", ".."]


func _valid_optional_id(value: Variant) -> bool:
	return value is String and (str(value).is_empty() or _valid_id(str(value)))


func _integer(value: Variant) -> bool:
	return (value is int or value is float) and is_finite(float(value)) and is_equal_approx(float(value), roundf(float(value)))


func _nonnegative_integer(value: Variant) -> bool:
	return _integer(value) and int(value) >= 0


func _positive_integer(value: Variant) -> bool:
	return _integer(value) and int(value) > 0


func _new_identity() -> String:
	var bytes := Crypto.new().generate_random_bytes(16)
	var parts: Array[String] = []
	for byte in bytes:
		parts.append("%02x" % int(byte))
	return "".join(parts)


func _failure(message: String, status: String = "invalid") -> Dictionary:
	return {"ok": false, "status": status, "error": message}
