class_name SessionGenerationRunKnowledge
extends RefCounted

## Immutable Campaign owner for complete, audited Session Generation runs.

const FORMAT_ID := "saltmarcher.session-generation-runs.v1"
const OWNER := "session_generation"
const KIND := "session_generation_run"
const MAX_TEXT_LENGTH := 200_000


func empty_payload() -> Dictionary:
	return {"format": FORMAT_ID, "records": {}}


func validate_payload(value: Variant) -> Dictionary:
	if not value is Dictionary:
		return _failure("STORAGE_FAILURE", "Session-Generation-Daten müssen ein Dokument sein.")
	var payload: Dictionary = value
	if payload.size() != 2 or payload.get("format", "") != FORMAT_ID or not payload.get("records", null) is Dictionary:
		return _failure("STORAGE_FAILURE", "Session-Generation-Daten besitzen kein unterstütztes Format.")
	var normalized_records := {}
	for run_id_value in payload["records"]:
		var validation := validate_run(payload["records"][run_id_value])
		if not validation.get("ok", false):
			return validation
		if validation["run"]["run_id"] != str(run_id_value):
			return _failure("STORAGE_FAILURE", "Generation-Run-Schlüssel und Identität widersprechen sich.")
		normalized_records[str(run_id_value)] = validation["run"]
	return {"ok": true, "payload": {"format": FORMAT_ID, "records": normalized_records}}


func validate_run(value: Variant) -> Dictionary:
	if not value is Dictionary:
		return _failure("INVALID_REQUEST", "Generation Run muss ein strukturiertes Dokument sein.")
	var run: Dictionary = value
	var required := [
		"run_id", "content_fingerprint", "preparation_id", "engine_version", "catalog_version",
		"catalog_content_hash", "seed", "party", "session", "encounter_targets", "encounters",
		"treasures", "loot", "packing", "rewards", "formatted_text", "warnings", "audits",
	]
	if run.size() != required.size() or not _has_exact_fields(run, required):
		return _failure("INVALID_REQUEST", "Generation Run besitzt nicht die vollständige Version-1-Struktur.")
	if (
		not _hex_digest(str(run["run_id"]))
		or not str(run["content_fingerprint"]).begins_with("v1:")
		or not _hex_digest(str(run["content_fingerprint"]).trim_prefix("v1:"))
		or not _valid_identity(str(run["preparation_id"]))
		or str(run["engine_version"]).strip_edges().is_empty()
		or str(run["catalog_version"]).strip_edges().is_empty()
		or not _hex_digest(str(run["catalog_content_hash"]))
		or not _nonnegative_integer(run["seed"])
		or not run["party"] is Array
		or not run["session"] is Dictionary
		or not run["encounter_targets"] is Array
		or not run["encounters"] is Array
		or not run["treasures"] is Array
		or not run["loot"] is Array
		or not run["packing"] is Array
		or not run["rewards"] is Dictionary
		or not run["formatted_text"] is String
		or str(run["formatted_text"]).is_empty()
		or str(run["formatted_text"]).length() > MAX_TEXT_LENGTH
		or not run["warnings"] is Array
		or not run["audits"] is Array
	):
		return _failure("INVALID_REQUEST", "Generation Run besitzt ungültige Root-Fachwerte.")
	var party_validation := _validate_party(run["party"], run["session"])
	if not party_validation.get("ok", false):
		return party_validation
	var structure_validation := _validate_structure(run)
	if not structure_validation.get("ok", false):
		return structure_validation
	var expected := content_fingerprint(run)
	if run["content_fingerprint"] != expected:
		return _failure("INVALID_REQUEST", "Generation Run stimmt nicht mit seinem Inhaltsfingerprint überein.")
	return {"ok": true, "run": _canonical_value(run)}


func commit_run(payload_value: Variant, run_value: Variant) -> Dictionary:
	var payload_validation := validate_payload(payload_value)
	if not payload_validation.get("ok", false):
		return payload_validation
	var run_validation := validate_run(run_value)
	if not run_validation.get("ok", false):
		return run_validation
	var payload: Dictionary = payload_validation["payload"]
	var run: Dictionary = run_validation["run"]
	var run_id := str(run["run_id"])
	if payload["records"].has(run_id):
		var existing: Dictionary = payload["records"][run_id]
		if existing["content_fingerprint"] == run["content_fingerprint"] and _canonical_value(existing) == run:
			return {"ok": true, "status": "already_committed", "no_write": true, "payload": payload, "run": existing.duplicate(true)}
		return _failure("IDENTITY_CONFLICT", "Generation-Run-Identität bezeichnet bereits einen anderen Inhalt.")
	var next_payload: Dictionary = payload.duplicate(true)
	var records: Dictionary = payload["records"].duplicate(true)
	records[run_id] = run
	next_payload["records"] = records
	var next_validation := validate_payload(next_payload)
	if not next_validation.get("ok", false):
		return next_validation
	return {"ok": true, "status": "committed", "payload": next_validation["payload"], "run": run.duplicate(true)}


func load_run(payload_value: Variant, run_id: String) -> Dictionary:
	var validated := validate_payload(payload_value)
	if not validated.get("ok", false):
		return validated
	if not validated["payload"]["records"].has(run_id):
		return _failure("NOT_FOUND", "Generation Run wurde nicht gefunden.")
	return {"ok": true, "status": "SUCCESS", "run": validated["payload"]["records"][run_id].duplicate(true)}


func load_rewards(payload_value: Variant, references_value: Variant) -> Dictionary:
	var validated := validate_payload(payload_value)
	if not validated.get("ok", false):
		return validated
	if not references_value is Array or references_value.is_empty():
		return _failure("INVALID_REQUEST", "Reward-Abfrage braucht mindestens eine Referenz.")
	var seen := {}
	var rewards: Array = []
	var missing: Array = []
	for value in references_value:
		if not value is Dictionary or value.size() != 2:
			return _failure("INVALID_REQUEST", "Reward-Abfrage besitzt eine ungültige Referenz.")
		var run_id := str(value.get("run_id", ""))
		var treasure_id = value.get("treasure_id", null)
		var key := "%s|%s" % [run_id, treasure_id]
		if seen.has(key) or not _hex_digest(run_id) or not _positive_integer(treasure_id):
			return _failure("INVALID_REQUEST", "Reward-Referenzen müssen gültig und eindeutig sein.")
		seen[key] = true
		if not validated["payload"]["records"].has(run_id):
			missing.append({"run_id": run_id, "treasure_id": int(treasure_id)})
			continue
		var run: Dictionary = validated["payload"]["records"][run_id]
		var treasure: Dictionary = {}
		var item_lines: Array = []
		var packing_rows: Array = []
		for candidate in run["treasures"]:
			if int(candidate["treasure_id"]) == int(treasure_id):
				treasure = candidate.duplicate(true)
		for line in run["loot"]:
			if int(line["treasure_id"]) == int(treasure_id):
				item_lines.append(line.duplicate(true))
		for row in run["packing"]:
			if int(row["treasure_id"]) == int(treasure_id):
				packing_rows.append(row.duplicate(true))
		if treasure.is_empty():
			missing.append({"run_id": run_id, "treasure_id": int(treasure_id)})
			continue
		rewards.append({"run_id": run_id, "treasure": treasure, "loot": item_lines, "packing": packing_rows})
	return {"ok": true, "status": "SUCCESS", "rewards": rewards, "missing": missing}


func content_fingerprint(run: Dictionary) -> String:
	var semantic := [
		"session-generation-content-fingerprint", "v1", run.get("run_id", ""), run.get("engine_version", ""),
		run.get("preparation_id", ""), run.get("catalog_version", ""), run.get("catalog_content_hash", ""), run.get("seed", 0),
		run.get("party", []), run.get("session", {}), run.get("encounter_targets", []), run.get("encounters", []),
		run.get("treasures", []), run.get("loot", []), run.get("packing", []), run.get("rewards", {}),
		run.get("warnings", []), run.get("audits", []),
	]
	return "v1:%s" % _sha256_text(JSON.stringify(_canonical_value(semantic)))


func _validate_party(party: Array, session: Dictionary) -> Dictionary:
	if party.is_empty() or not _has_exact_fields(session, ["party_count", "adventure_day_units", "encounter_count", "day_xp_budget", "session_xp_target", "average_level_hundredths", "normal_budget_cp", "overstock_budget_cp", "non_magic_slots", "normal_magic", "overstock_magic", "treasure_count"]):
		return _failure("INVALID_REQUEST", "Generation Run besitzt keinen vollständigen Session-Kontext.")
	var previous_level := 0
	var party_count := 0
	for row in party:
		if not row is Dictionary or not _has_exact_fields(row, ["level", "count"]) or not _positive_integer(row.get("level")) or int(row["level"]) > 20 or not _positive_integer(row.get("count")) or int(row["level"]) <= previous_level:
			return _failure("INVALID_REQUEST", "Generation Run besitzt ungültige normalisierte Gruppenstufen.")
		previous_level = int(row["level"])
		party_count += int(row["count"])
	for key in session:
		if not _nonnegative_integer(session[key]):
			return _failure("INVALID_REQUEST", "Generation Run besitzt ungültige Session-Zahlen.")
	if party_count != int(session["party_count"]) or int(session["encounter_count"]) < 1 or int(session["encounter_count"]) > 10 or int(session["treasure_count"]) < 1:
		return _failure("INVALID_REQUEST", "Generation Run widerspricht seinem Session-Kontext.")
	return {"ok": true}


func _validate_structure(run: Dictionary) -> Dictionary:
	var count := int(run["session"]["encounter_count"])
	if run["encounter_targets"].size() != count or run["encounters"].size() != count or run["treasures"].size() != int(run["session"]["treasure_count"]) or run["packing"].size() != run["loot"].size() or run["audits"].is_empty():
		return _failure("INVALID_REQUEST", "Generation Run besitzt unvollständige strukturierte Kinder.")
	var target_sum := 0
	for index in count:
		var target = run["encounter_targets"][index]
		var encounter = run["encounters"][index]
		if not target is Dictionary or not encounter is Dictionary or int(target.get("encounter_number", -1)) != index + 1 or int(encounter.get("encounter_number", -1)) != index + 1 or not target.get("target_xp", null) is int and not target.get("target_xp", null) is float or not encounter.get("blocks", null) is Array or encounter["blocks"].is_empty():
			return _failure("INVALID_REQUEST", "Generation Run besitzt ungültige Encounter-Reihenfolge.")
		target_sum += int(target["target_xp"])
	if target_sum != int(run["session"]["session_xp_target"]):
		return _failure("INVALID_REQUEST", "Encounter-Ziele summieren sich nicht zum Session-Ziel.")
	var treasure_ids := {}
	for treasure in run["treasures"]:
		if not treasure is Dictionary or not _positive_integer(treasure.get("treasure_id")) or treasure_ids.has(int(treasure["treasure_id"])):
			return _failure("INVALID_REQUEST", "Generation Run besitzt ungültige Treasure-Identitäten.")
		treasure_ids[int(treasure["treasure_id"])] = true
	var line_ids := {}
	for line in run["loot"]:
		if not line is Dictionary or not _positive_integer(line.get("line_id")) or line_ids.has(int(line["line_id"])) or not treasure_ids.has(int(line.get("treasure_id", -1))):
			return _failure("INVALID_REQUEST", "Generation Run besitzt ungültige Loot-Zeilen.")
		line_ids[int(line["line_id"])] = true
	var packed_ids := {}
	for row in run["packing"]:
		if not row is Dictionary or not line_ids.has(int(row.get("line_id", -1))) or packed_ids.has(int(row.get("line_id", -1))) or not row.get("valid", false):
			return _failure("INVALID_REQUEST", "Generation Run besitzt ungültige Packing-Zeilen.")
		packed_ids[int(row["line_id"])] = true
	var audit_codes := {}
	for audit in run["audits"]:
		if not audit is Dictionary or str(audit.get("code", "")).is_empty() or audit_codes.has(audit["code"]) or audit.get("status", "") != "PASS":
			return _failure("INVALID_REQUEST", "Generation Run besitzt fehlgeschlagene oder doppelte Audits.")
		audit_codes[audit["code"]] = true
	return {"ok": true}


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


func _has_exact_fields(value: Dictionary, fields: Array) -> bool:
	if value.size() != fields.size():
		return false
	for field in fields:
		if not value.has(field):
			return false
	return true


func _positive_integer(value: Variant) -> bool:
	return _nonnegative_integer(value) and int(value) > 0


func _nonnegative_integer(value: Variant) -> bool:
	return (value is int or value is float and is_equal_approx(value, roundf(value))) and int(value) >= 0


func _valid_identity(value: String) -> bool:
	if value.is_empty() or value.length() > 256:
		return false
	for index in value.length():
		var code := value.unicode_at(index)
		if not ((code >= 48 and code <= 57) or (code >= 65 and code <= 90) or (code >= 97 and code <= 122) or code in [45, 46, 58, 95]):
			return false
	return true


func _hex_digest(value: String) -> bool:
	if value.length() != 64:
		return false
	for character in value:
		if character not in "0123456789abcdef":
			return false
	return true


func _sha256_text(value: String) -> String:
	var context := HashingContext.new()
	context.start(HashingContext.HASH_SHA256)
	context.update(value.to_utf8_buffer())
	return context.finish().hex_encode()


func _failure(status: String, message: String) -> Dictionary:
	return {"ok": false, "status": status, "error": message}
