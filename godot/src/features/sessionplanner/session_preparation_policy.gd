class_name SessionPreparationPolicy
extends RefCounted

## Pure cross-owner preparation value. It owns no foreign truth and performs no writes.

const FORMAT_ID := "saltmarcher.prepared-session.v1"
const ALLOCATION_TOTAL := 1_000_000


func preparation_id(
	session_id: String,
	revision: int,
	party_levels: Array,
	day_units: int,
	encounter_count: Variant,
	seed: int
) -> String:
	var semantic := ["session-preparation", "v1", session_id, revision, party_levels, day_units, encounter_count, seed]
	return "preparation.%s" % _sha256(JSON.stringify(_canonical_value(semantic)))


func encounter_source(run: Dictionary) -> Dictionary:
	return {
		"engine_version": run.get("engine_version", ""),
		"preparation_id": run.get("preparation_id", ""),
		"generation_run_id": run.get("run_id", ""),
	}


func encounter_intents(run: Dictionary) -> Array:
	var intents: Array = []
	for encounter in run.get("encounters", []):
		var blocks: Array = []
		for block in encounter.get("blocks", []):
			blocks.append({
				"block_id": block.get("block_id", ""),
				"requested_role": block.get("role", ""),
				"challenge_rating": block.get("challenge_label", ""),
				"xp": block.get("unit_xp", 0),
				"quantity": block.get("quantity", 0),
			})
		intents.append({
			"encounter_number": encounter.get("encounter_number", 0),
			"display_label": "Generierter Encounter %d" % int(encounter.get("encounter_number", 0)),
			"target_xp": encounter.get("target_xp", 0),
			"difficulty": encounter.get("difficulty", ""),
			"blocks": blocks,
		})
	return intents


func assemble(session_value: Variant, run_value: Variant, batch_value: Variant) -> Dictionary:
	if not session_value is Dictionary or not run_value is Dictionary or not batch_value is Dictionary:
		return _failure("INVALID_REQUEST", "Session-Vorbereitung braucht Session, Generation Run und Encounter Batch.")
	var session: Dictionary = session_value
	var run: Dictionary = run_value
	var batch: Dictionary = batch_value
	if (
		str(session.get("session_id", "")).is_empty()
		or int(session.get("revision", 0)) <= 0
		or run.get("preparation_id", "") != batch.get("source", {}).get("preparation_id", "")
		or run.get("run_id", "") != batch.get("source", {}).get("generation_run_id", "")
		or run.get("engine_version", "") != batch.get("source", {}).get("engine_version", "")
		or run.get("encounters", []).size() != batch.get("rosters", []).size()
	):
		return _failure("INVALID_REQUEST", "Generation und Encounter Batch gehören nicht zur selben Session-Vorbereitung.")
	var rosters := {}
	var expected_encounters: Array = []
	for roster in batch["rosters"]:
		var number := int(roster.get("encounter_number", 0))
		if number <= 0 or rosters.has(number):
			return _failure("INVALID_REQUEST", "Encounter Batch besitzt keine eindeutige Reihenfolge.")
		rosters[number] = roster
		expected_encounters.append({"encounter_number": number, "roster_fingerprint": roster.get("roster_fingerprint", "")})
	var target_total := 0
	for encounter in run["encounters"]:
		target_total += int(encounter.get("target_xp", 0))
	if target_total <= 0:
		return _failure("INVALID_REQUEST", "Vorbereitete Encounter besitzen kein positives Gesamtbudget.")
	var scenes: Array = []
	var scene_by_encounter := {}
	var allocated := 0
	for index in run["encounters"].size():
		var encounter: Dictionary = run["encounters"][index]
		var number := int(encounter.get("encounter_number", 0))
		if number != index + 1 or not rosters.has(number):
			return _failure("INVALID_REQUEST", "Generation und Encounter Batch besitzen verschiedene Reihenfolgen.")
		var allocation := ALLOCATION_TOTAL - allocated if index == run["encounters"].size() - 1 else int(int(encounter["target_xp"]) * ALLOCATION_TOTAL / target_total)
		allocated += allocation
		var scene_id := _scene_id(str(run["run_id"]), "encounter", number)
		scene_by_encounter[number] = scene_id
		scenes.append({
			"scene_id": scene_id,
			"scene_number": scenes.size() + 1,
			"encounter_number": number,
			"title": rosters[number]["display_label"],
			"notes": rosters[number]["summary"]["display_summary"],
			"location_id": "",
			"allocation_units": allocation,
		})
	var rewards: Array = []
	for treasure in run.get("treasures", []):
		var treasure_id := int(treasure.get("treasure_id", 0))
		var scene_id := ""
		if treasure.get("channel", "") == "ENCOUNTER":
			scene_id = str(scene_by_encounter.get(int(treasure.get("anchor_encounter_number", 0)), ""))
			if scene_id.is_empty():
				return _failure("INVALID_REQUEST", "Encounter-Belohnung besitzt keinen vorbereiteten Szenenanker.")
		else:
			scene_id = _scene_id(str(run["run_id"]), "reward", treasure_id)
			scenes.append({
				"scene_id": scene_id,
				"scene_number": scenes.size() + 1,
				"encounter_number": 0,
				"title": "Quest-Belohnung" if treasure.get("channel", "") == "QUEST" else "Umgebungsfund",
				"notes": str(treasure.get("theme", "")),
				"location_id": "",
				"allocation_units": 0,
			})
		var line_count := 0
		for line in run.get("loot", []):
			if int(line.get("treasure_id", 0)) == treasure_id:
				line_count += 1
		var theme := str(treasure.get("theme", "")).strip_edges()
		rewards.append({
			"scene_id": scene_id,
			"generation_id": run["run_id"],
			"treasure_id": str(treasure_id),
			"last_known_label": "%s · %d Positionen" % ["Generierte Belohnung" if theme.is_empty() else theme, line_count],
		})
	var prepared := {
		"format": FORMAT_ID,
		"preparation_id": run["preparation_id"],
		"session_id": session["session_id"],
		"source_revision": session["revision"],
		"generation_run_id": run["run_id"],
		"generation_fingerprint": run["content_fingerprint"],
		"batch_fingerprint": batch["batch_fingerprint"],
		"expected_encounters": expected_encounters,
		"scenes": scenes,
		"generated_rewards": rewards,
		"selected_scene_id": scenes[0]["scene_id"] if not scenes.is_empty() else "",
		"prepared_fingerprint": "",
	}
	prepared["prepared_fingerprint"] = _prepared_fingerprint(prepared)
	return {"ok": true, "status": "SUCCESS", "prepared": prepared}


func finalize(prepared_value: Variant, mappings_value: Variant) -> Dictionary:
	var validation := validate_prepared(prepared_value)
	if not validation.get("ok", false):
		return validation
	if not mappings_value is Array:
		return _failure("INVALID_REQUEST", "Gespeicherte Encounter-Zuordnung fehlt.")
	var prepared: Dictionary = validation["prepared"]
	var by_number := {}
	for mapping in mappings_value:
		if not mapping is Dictionary:
			return _failure("INVALID_REQUEST", "Gespeicherte Encounter-Zuordnung ist ungültig.")
		var number := int(mapping.get("encounter_number", 0))
		if number <= 0 or by_number.has(number) or str(mapping.get("plan_id", "")).is_empty():
			return _failure("INVALID_REQUEST", "Gespeicherte Encounter-Zuordnung ist unvollständig.")
		by_number[number] = mapping
	if by_number.size() != prepared["expected_encounters"].size():
		return _failure("INVALID_REQUEST", "Gespeicherte Encounter-Zuordnung besitzt falsche Kardinalität.")
	for expected in prepared["expected_encounters"]:
		var number := int(expected["encounter_number"])
		if not by_number.has(number) or by_number[number].get("summary", {}).get("roster", null) == null:
			return _failure("INVALID_REQUEST", "Gespeicherte Encounter-Zuordnung widerspricht der Vorbereitung.")
	var scenes: Array = []
	for prepared_scene in prepared["scenes"]:
		var scene: Dictionary = prepared_scene.duplicate(true)
		var number := int(scene["encounter_number"])
		scene.erase("encounter_number")
		scene["encounter_plan_id"] = "" if number == 0 else by_number[number]["plan_id"]
		scenes.append(scene)
	return {
		"ok": true,
		"status": "SUCCESS",
		"session_id": prepared["session_id"],
		"source_revision": prepared["source_revision"],
		"scenes": scenes,
		"rests": [],
		"manual_loot_notes": [],
		"generated_rewards": prepared["generated_rewards"].duplicate(true),
		"selected_scene_id": prepared["selected_scene_id"],
	}


func validate_prepared(value: Variant) -> Dictionary:
	if not value is Dictionary or value.get("format", "") != FORMAT_ID or not value.get("scenes", null) is Array or value["scenes"].is_empty() or not value.get("generated_rewards", null) is Array or not value.get("expected_encounters", null) is Array:
		return _failure("INVALID_REQUEST", "Vorbereitete Session besitzt kein unterstütztes Format.")
	var prepared: Dictionary = value
	if prepared.get("prepared_fingerprint", "") != _prepared_fingerprint(prepared):
		return _failure("INVALID_REQUEST", "Vorbereitete Session besitzt einen ungültigen Inhaltsfingerprint.")
	var scene_ids := {}
	var allocation := 0
	for index in prepared["scenes"].size():
		var scene = prepared["scenes"][index]
		if not scene is Dictionary or str(scene.get("scene_id", "")).is_empty() or scene_ids.has(scene["scene_id"]) or int(scene.get("scene_number", 0)) != index + 1:
			return _failure("INVALID_REQUEST", "Vorbereitete Session besitzt ungültige Szenen.")
		scene_ids[scene["scene_id"]] = true
		allocation += int(scene.get("allocation_units", -1))
	if allocation != ALLOCATION_TOTAL or not scene_ids.has(prepared.get("selected_scene_id", "")):
		return _failure("INVALID_REQUEST", "Vorbereitete Session besitzt ungültige Szenenallokation.")
	for reward in prepared["generated_rewards"]:
		if not reward is Dictionary or not scene_ids.has(reward.get("scene_id", "")) or reward.get("generation_id", "") != prepared.get("generation_run_id", ""):
			return _failure("INVALID_REQUEST", "Vorbereitete Session besitzt ungültige Reward-Referenzen.")
	return {"ok": true, "prepared": prepared.duplicate(true)}


func _prepared_fingerprint(prepared: Dictionary) -> String:
	var semantic: Dictionary = prepared.duplicate(true)
	semantic.erase("prepared_fingerprint")
	return "v1:%s" % _sha256(JSON.stringify(_canonical_value(semantic)))


func _scene_id(run_id: String, kind: String, number: int) -> String:
	return "scene.generated.%s" % _sha256("%s|%s|%d" % [run_id, kind, number]).substr(0, 32)


func _canonical_value(value: Variant) -> Variant:
	if value is Dictionary:
		var keys: Array = value.keys()
		keys.sort_custom(func(left: Variant, right: Variant) -> bool: return str(left) < str(right))
		var result := {}
		for key in keys:
			result[str(key)] = _canonical_value(value[key])
		return result
	if value is Array:
		var result: Array = []
		for child in value:
			result.append(_canonical_value(child))
		return result
	if value is float and is_equal_approx(value, roundf(value)):
		return int(roundf(value))
	return value


func _sha256(value: String) -> String:
	var context := HashingContext.new()
	context.start(HashingContext.HASH_SHA256)
	context.update(value.to_utf8_buffer())
	return context.finish().hex_encode()


func _failure(status: String, message: String) -> Dictionary:
	return {"ok": false, "status": status, "error": message}
