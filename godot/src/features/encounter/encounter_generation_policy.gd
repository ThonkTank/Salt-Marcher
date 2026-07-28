class_name EncounterGenerationPolicy
extends RefCounted

## Pure Encounter-owned policy for deterministic generated batches and XP summaries.

const MAX_INTENTS := 200
const MAX_BLOCKS_PER_INTENT := 200
const MAX_QUANTITY := 1_000_000
const MAX_TEXT_LENGTH := 256
const MAX_EXACT_INTEGER := 9_007_199_254_740_991

const EASY_THRESHOLDS := [
	0, 25, 50, 75, 125, 250, 300, 350, 450, 550, 600,
	800, 1000, 1100, 1250, 1400, 1600, 2000, 2100, 2400, 2800,
]
const MEDIUM_THRESHOLDS := [
	0, 50, 100, 150, 250, 500, 600, 750, 900, 1100, 1200,
	1600, 2000, 2200, 2500, 2800, 3200, 3900, 4200, 4900, 5700,
]
const HARD_THRESHOLDS := [
	0, 75, 150, 225, 375, 750, 900, 1100, 1400, 1600, 1900,
	2400, 3000, 3400, 3800, 4300, 4800, 5900, 6300, 7300, 8500,
]
const DEADLY_THRESHOLDS := [
	0, 100, 200, 400, 500, 1100, 1400, 1700, 2100, 2400, 2800,
	3600, 4500, 5100, 5700, 6400, 7200, 8800, 9500, 10900, 12700,
]
const MULTIPLIERS := [1.0, 1.5, 2.0, 2.5, 3.0, 4.0]
const FREE_DIFFICULTIES := ["AUTO", "EASY", "MEDIUM", "HARD", "DEADLY"]
const FREE_AMOUNTS := ["AUTO", "FEW", "STANDARD", "MANY"]
const FREE_BALANCES := ["AUTO", "FOCUSED", "EVEN", "VARIED"]
const FREE_DIVERSITIES := ["AUTO", "LOW", "MEDIUM", "HIGH"]
const FREE_MAX_ALTERNATIVES := 8
const FREE_MAX_QUANTITY := 20


func generate_alternatives(
	party_levels_value: Variant,
	definitions_value: Variant,
	request_value: Variant,
	cancellation: Callable = Callable()
) -> Dictionary:
	var levels := _validate_party_levels(party_levels_value)
	if not levels.get("ok", false):
		return levels
	var request := _validate_free_request(request_value)
	if not request.get("ok", false):
		return request
	var candidates := _candidate_snapshot(definitions_value)
	if not candidates.get("ok", false):
		return candidates
	var source: Dictionary = request["source_constraints"]
	var filtered: Array = []
	for candidate_value in candidates["rows"]:
		if _cancelled(cancellation):
			return _cancelled_failure()
		var candidate: Dictionary = candidate_value.duplicate(true)
		if source["active"] and candidate["creature_id"] not in source["allowed_creature_ids"]:
			continue
		if _matches_free_filters(candidate, request["pool_filters"], bool(source["active"])):
			candidate["source_weight"] = int(source["weights"].get(candidate["creature_id"], 1))
			candidate["maximum_quantity"] = int(source["maximum_quantities"].get(candidate["creature_id"], FREE_MAX_QUANTITY))
			filtered.append(candidate)
	if filtered.is_empty():
		return _failure("NO_CREATURES", "Die aktuellen Filter und Quellen lassen keine vollständigen Monster übrig.")
	var tuning: Dictionary = request["tuning"]
	var resolved := {
		"difficulty": "MEDIUM" if tuning["difficulty"] == "AUTO" else tuning["difficulty"],
		"amount": "STANDARD" if tuning["amount"] == "AUTO" else tuning["amount"],
		"balance": "EVEN" if tuning["balance"] == "AUTO" else tuning["balance"],
		"diversity": "MEDIUM" if tuning["diversity"] == "AUTO" else tuning["diversity"],
		"source_constraints": source,
	}
	var target := _difficulty_target(str(resolved["difficulty"]), levels["levels"])
	var search := _search_free_compositions(
		filtered,
		levels["levels"],
		resolved,
		target,
		str(tuning["seed"]),
		cancellation
	)
	if not search.get("ok", false):
		return search
	var ranked: Array = search["exact"] if not search["exact"].is_empty() else search["fallback"]
	if ranked.is_empty():
		return _failure("NO_SOLUTION", "Aus dem gefilterten Monsterpool lässt sich keine gültige Aufstellung bilden.")
	ranked.sort_custom(Callable(self, "_free_option_precedes"))
	var alternatives: Array = []
	var limit := mini(int(tuning["alternative_count"]), ranked.size())
	for index in limit:
		alternatives.append(_free_alternative(ranked[index], index, target, resolved))
	var exact: bool = not search["exact"].is_empty()
	return {
		"ok": true,
		"status": "SUCCESS" if exact else "FALLBACK",
		"alternatives": alternatives,
		"diagnostics": {
			"requested_difficulty": tuning["difficulty"],
			"resolved_difficulty": resolved["difficulty"],
			"resolved_amount": resolved["amount"],
			"resolved_balance": resolved["balance"],
			"resolved_diversity": resolved["diversity"],
			"solution_quality": "EXACT" if exact else "FALLBACK",
			"stop_category": "EXACT_OPTIONS_READY" if exact else "BEST_FALLBACK",
			"candidate_pool_size": filtered.size(),
			"attempt_count": int(search["attempt_count"]),
			"candidate_evaluation_count": int(search["evaluation_count"]),
			"target_min_xp": int(target["minimum"]),
			"target_max_xp": int(target["maximum"]),
			"source_mode": "GROUPED" if source["active"] else "CATALOG",
			"source_table_count": int(source["table_ids"].size()),
			"source_faction_count": int(source["faction_ids"].size()),
			"source_location_selected": not str(source["location_id"]).is_empty(),
			"loot_conflict": bool(source["loot_conflict"]),
		},
	}


func prepare_batch(
	source_value: Variant,
	intents_value: Variant,
	party_levels_value: Variant,
	definitions_value: Variant,
	cancellation: Callable = Callable()
) -> Dictionary:
	var command := _validate_prepare_command(source_value, intents_value)
	if not command.get("ok", false):
		return command
	var levels := _validate_party_levels(party_levels_value)
	if not levels.get("ok", false):
		return levels
	var candidates := _candidate_snapshot(definitions_value)
	if not candidates.get("ok", false):
		return candidates
	if candidates["rows"].is_empty():
		return _failure("UNRESOLVABLE", "Für den Batch stehen keine vollständigen Creature-Kandidaten bereit.")
	var source: Dictionary = command["source"]
	var by_key: Dictionary = candidates["by_key"]
	var batch_usage := {}
	var roster_fingerprints := {}
	var rosters: Array = []
	for intent_value in command["intents"]:
		if _cancelled(cancellation):
			return _cancelled_failure()
		var resolved := _resolve_intent(
			source,
			intent_value,
			levels["levels"],
			by_key,
			batch_usage,
			roster_fingerprints
		)
		if not resolved.get("ok", false):
			return resolved
		var roster: Dictionary = resolved["roster"]
		rosters.append(roster)
		roster_fingerprints[roster["roster_fingerprint"]] = true
		for creature in roster["creatures"]:
			var creature_id := str(creature["creature_id"])
			batch_usage[creature_id] = int(batch_usage.get(creature_id, 0)) + int(creature["quantity"])
	var batch := {
		"source": source.duplicate(true),
		"batch_fingerprint": "",
		"rosters": rosters,
	}
	batch["batch_fingerprint"] = fingerprint(_batch_fingerprint_text(batch))
	return {
		"ok": true,
		"status": "SUCCESS",
		"batch": batch,
		"diagnostics": {
			"candidate_snapshot_count": 1,
			"candidate_count": candidates["rows"].size(),
			"intent_count": rosters.size(),
		},
	}


func validate_prepared_batch(batch_value: Variant) -> Dictionary:
	if not batch_value is Dictionary:
		return _failure("INVALID_REQUEST", "Der vorbereitete Encounter-Batch ist ungültig.")
	var batch: Dictionary = batch_value
	if batch.size() != 3 or not batch.get("source", null) is Dictionary or not batch.get("rosters", null) is Array:
		return _failure("INVALID_REQUEST", "Der vorbereitete Encounter-Batch ist ungültig.")
	var source := _validate_source(batch["source"])
	if not source.get("ok", false) or batch["rosters"].is_empty() or batch["rosters"].size() > MAX_INTENTS:
		return _failure("INVALID_REQUEST", "Der vorbereitete Encounter-Batch ist ungültig.")
	var seen_numbers := {}
	for roster_value in batch["rosters"]:
		var validation := _validate_prepared_roster(roster_value)
		if not validation.get("ok", false):
			return validation
		var number := int(roster_value["encounter_number"])
		if seen_numbers.has(number):
			return _failure("INVALID_REQUEST", "Encounter-Nummern im vorbereiteten Batch müssen eindeutig sein.")
		seen_numbers[number] = true
	var expected := fingerprint(_batch_fingerprint_text(batch))
	if str(batch.get("batch_fingerprint", "")) != expected:
		return _failure("INVALID_REQUEST", "Der vorbereitete Encounter-Batch besitzt einen ungültigen Fingerprint.")
	return {"ok": true, "batch": batch.duplicate(true)}


func summaries_for_plans(
	plan_ids_value: Variant,
	payload_value: Variant,
	party_levels_value: Variant,
	definitions_value: Variant,
	cancellation: Callable = Callable()
) -> Dictionary:
	if not plan_ids_value is Array or plan_ids_value.is_empty() or plan_ids_value.size() > MAX_INTENTS:
		return _failure("INVALID_REQUEST", "Die Encounter-Summary-Abfrage braucht Plan-Identitäten.")
	var seen_ids := {}
	for plan_id_value in plan_ids_value:
		var plan_id := str(plan_id_value)
		if not _valid_id(plan_id) or seen_ids.has(plan_id):
			return _failure("INVALID_REQUEST", "Encounter-Plan-Identitäten müssen gültig und eindeutig sein.")
		seen_ids[plan_id] = true
	var levels := _validate_party_levels(party_levels_value)
	if not levels.get("ok", false):
		return levels
	var candidates := _candidate_snapshot(definitions_value)
	if not candidates.get("ok", false):
		return candidates
	if not payload_value is Dictionary or not payload_value.get("records", null) is Dictionary:
		return _failure("STORAGE_FAILURE", "Gespeicherte Encounter konnten nicht gelesen werden.")
	var entries: Array = []
	for plan_id_value in plan_ids_value:
		if _cancelled(cancellation):
			return _cancelled_failure()
		var plan_id := str(plan_id_value)
		if not payload_value["records"].has(plan_id):
			entries.append({"requested_plan_id": plan_id, "status": "MISSING"})
			continue
		var summary := summary_for_plan(payload_value["records"][plan_id], candidates["by_id"], levels["levels"])
		if not summary.get("ok", false):
			entries.append({"requested_plan_id": plan_id, "status": "UNRESOLVABLE"})
		else:
			entries.append({
				"requested_plan_id": plan_id,
				"status": "FOUND",
				"summary": summary["summary"],
			})
	return {
		"ok": true,
		"status": "SUCCESS",
		"entries": entries,
		"diagnostics": {
			"plan_partition_read_count": 1,
			"party_snapshot_count": 1,
			"creature_snapshot_count": 1,
		},
	}


func summary_for_plan(record_value: Variant, definitions_by_id: Dictionary, party_levels: Array) -> Dictionary:
	if not record_value is Dictionary or not record_value.get("roster", null) is Array:
		return _failure("UNRESOLVABLE", "Der Encounter Plan besitzt kein lesbares Roster.")
	var roster: Array = []
	var base_xp := 0
	var creature_count := 0
	for entry_value in record_value["roster"]:
		if not entry_value is Dictionary:
			return _failure("UNRESOLVABLE", "Der Encounter Plan besitzt eine ungültige Rosterzeile.")
		var creature_id := str(entry_value.get("creature_id", ""))
		var quantity := int(entry_value.get("quantity", 0))
		var candidate: Dictionary = definitions_by_id.get(creature_id, {})
		if candidate.is_empty() or quantity <= 0:
			return _failure("UNRESOLVABLE", "Aktuelle Creature-Fakten für den Encounter Plan fehlen.")
		if int(candidate["xp"]) > 0 and quantity > (MAX_EXACT_INTEGER - base_xp) / int(candidate["xp"]):
			return _failure("UNRESOLVABLE", "Encounter-XP überschreiten den unterstützten Bereich.")
		base_xp += int(candidate["xp"]) * quantity
		creature_count += quantity
		roster.append({
			"creature_id": creature_id,
			"quantity": quantity,
			"last_known_name": str(candidate["name"]),
		})
	if roster.is_empty() or creature_count <= 0 or base_xp <= 0:
		return _failure("UNRESOLVABLE", "Der Encounter Plan kann nicht bewertet werden.")
	return {
		"ok": true,
		"summary": _summary(
			str(record_value.get("record_id", "")),
			str(record_value.get("name", "")),
			roster,
			base_xp,
			creature_count,
			party_levels
		),
	}


func thresholds_for(party_levels: Array) -> Dictionary:
	var result := {"easy": 0, "medium": 0, "hard": 0, "deadly": 0}
	for level_value in party_levels:
		var level := clampi(int(level_value), 1, 20)
		result["easy"] += EASY_THRESHOLDS[level]
		result["medium"] += MEDIUM_THRESHOLDS[level]
		result["hard"] += HARD_THRESHOLDS[level]
		result["deadly"] += DEADLY_THRESHOLDS[level]
	return result


func multiplier_for(creature_count: int, party_size: int) -> float:
	var index := 0
	if creature_count <= 1:
		index = 0
	elif creature_count == 2:
		index = 1
	elif creature_count <= 6:
		index = 2
	elif creature_count <= 10:
		index = 3
	elif creature_count <= 14:
		index = 4
	else:
		index = 5
	if party_size < 3:
		index = mini(index + 1, MULTIPLIERS.size() - 1)
	elif party_size > 5:
		index = maxi(index - 1, 0)
	return MULTIPLIERS[index]


func difficulty_for(adjusted_xp: int, party_levels: Array) -> String:
	var thresholds := thresholds_for(party_levels)
	if adjusted_xp >= int(thresholds["deadly"]):
		return "DEADLY"
	if adjusted_xp >= int(thresholds["hard"]):
		return "HARD"
	if adjusted_xp >= int(thresholds["medium"]):
		return "MEDIUM"
	return "EASY"


func fingerprint(value: String) -> String:
	var context := HashingContext.new()
	context.start(HashingContext.HASH_SHA256)
	context.update(value.to_utf8_buffer())
	return context.finish().hex_encode()


func _resolve_intent(
	source: Dictionary,
	intent: Dictionary,
	party_levels: Array,
	by_key: Dictionary,
	batch_usage: Dictionary,
	previous_rosters: Dictionary
) -> Dictionary:
	var selections: Array = []
	var roster_usage := {}
	for block in intent["blocks"]:
		var key := "%s|%d" % [str(block["challenge_rating"]), int(block["xp"])]
		var options: Array = by_key.get(key, []).duplicate(true)
		if options.is_empty():
			return _failure(
				"UNRESOLVABLE",
				"Encounter %d kann aus den aktuellen Creature-Fakten nicht aufgelöst werden." % int(intent["encounter_number"])
			)
		var requested_role := str(block["requested_role"])
		var tie_prefix := "%s|%s|%s|%d|%s|" % [
			source["engine_version"], source["preparation_id"], source["generation_run_id"],
			int(intent["encounter_number"]), str(block["block_id"]),
		]
		options.sort_custom(func(left: Dictionary, right: Dictionary) -> bool:
			var left_key := [
				_role_rank(requested_role, str(left["role"])),
				int(batch_usage.get(str(left["creature_id"]), 0)),
				int(roster_usage.get(str(left["creature_id"]), 0)),
				fingerprint(tie_prefix + str(left["creature_id"])),
				str(left["creature_id"]),
			]
			var right_key := [
				_role_rank(requested_role, str(right["role"])),
				int(batch_usage.get(str(right["creature_id"]), 0)),
				int(roster_usage.get(str(right["creature_id"]), 0)),
				fingerprint(tie_prefix + str(right["creature_id"])),
				str(right["creature_id"]),
			]
			return _less_rank_key(left_key, right_key)
		)
		var selected: Dictionary = options[0]
		roster_usage[str(selected["creature_id"])] = (
			int(roster_usage.get(str(selected["creature_id"]), 0)) + int(block["quantity"])
		)
		selections.append({"block": block.duplicate(true), "options": options, "index": 0})
	var creatures := _aggregate_selections(selections)
	var roster_fingerprint := fingerprint(_roster_fingerprint_text(creatures))
	if previous_rosters.has(roster_fingerprint):
		var diversified := _first_diverse_selections(selections, previous_rosters)
		if not diversified.is_empty():
			selections = diversified
			creatures = _aggregate_selections(selections)
			roster_fingerprint = fingerprint(_roster_fingerprint_text(creatures))
	var base_xp := 0
	var creature_count := 0
	for creature in creatures:
		base_xp += int(creature["xp"]) * int(creature["quantity"])
		creature_count += int(creature["quantity"])
	var persisted_roster: Array = []
	for creature in creatures:
		persisted_roster.append({
			"creature_id": creature["creature_id"],
			"quantity": creature["quantity"],
			"last_known_name": creature["last_known_name"],
		})
	var intent_fingerprint := fingerprint(_intent_fingerprint_text(intent))
	var summary := _summary(
		"",
		str(intent["display_label"]),
		persisted_roster,
		base_xp,
		creature_count,
		party_levels
	)
	return {
		"ok": true,
		"roster": {
			"encounter_number": intent["encounter_number"],
			"display_label": intent["display_label"],
			"intent_fingerprint": intent_fingerprint,
			"roster_fingerprint": roster_fingerprint,
			"creatures": persisted_roster,
			"summary": summary,
		},
	}


func _aggregate_selections(selections: Array) -> Array:
	var by_id := {}
	var ordered: Array = []
	for selection in selections:
		var candidate: Dictionary = selection["options"][int(selection["index"])]
		var creature_id := str(candidate["creature_id"])
		var quantity := int(selection["block"]["quantity"])
		if not by_id.has(creature_id):
			by_id[creature_id] = {
				"creature_id": creature_id,
				"quantity": quantity,
				"last_known_name": candidate["name"],
				"xp": candidate["xp"],
			}
			ordered.append(creature_id)
		else:
			by_id[creature_id]["quantity"] = int(by_id[creature_id]["quantity"]) + quantity
	var result: Array = []
	for creature_id in ordered:
		result.append(by_id[creature_id].duplicate(true))
	return result


func _first_diverse_selections(selections: Array, previous_rosters: Dictionary) -> Array:
	for selection_index in range(selections.size()):
		var selection: Dictionary = selections[selection_index]
		for option_index in range(1, selection["options"].size()):
			var changed: Array = selections.duplicate(true)
			changed[selection_index]["index"] = option_index
			var candidate_fingerprint := fingerprint(_roster_fingerprint_text(_aggregate_selections(changed)))
			if not previous_rosters.has(candidate_fingerprint):
				return changed
	return []


func _summary(
	plan_id: String,
	label: String,
	roster: Array,
	base_xp: int,
	creature_count: int,
	party_levels: Array
) -> Dictionary:
	var adjusted_xp := roundi(float(base_xp) * multiplier_for(creature_count, party_levels.size()))
	var roster_text: Array[String] = []
	for creature in roster:
		roster_text.append("%dx %s" % [int(creature["quantity"]), str(creature["last_known_name"])])
	return {
		"plan_id": plan_id,
		"label": label,
		"roster": roster.duplicate(true),
		"creature_count": creature_count,
		"base_xp": base_xp,
		"adjusted_xp": adjusted_xp,
		"difficulty": difficulty_for(adjusted_xp, party_levels),
		"display_summary": ", ".join(roster_text),
	}


func _validate_free_request(value: Variant) -> Dictionary:
	if not value is Dictionary or value.size() not in [2, 3]:
		return _failure("INVALID_REQUEST", "Freie Encounter-Generierung braucht Pool-Filter und Tuning.")
	var filters := _normalize_free_filters(value.get("pool_filters"))
	if not filters.get("ok", false):
		return filters
	var tuning := _normalize_free_tuning(value.get("tuning"))
	if not tuning.get("ok", false):
		return tuning
	var source := _normalize_source_constraints(value.get("source_constraints", _default_source_constraints()))
	if not source.get("ok", false):
		return source
	return {
		"ok": true,
		"pool_filters": filters["filters"],
		"tuning": tuning["tuning"],
		"source_constraints": source["source_constraints"],
	}


func _normalize_free_filters(value: Variant) -> Dictionary:
	if not value is Dictionary:
		return _failure("INVALID_REQUEST", "Encounter-Pool-Filter fehlen.")
	var expected := [
		"search_text", "sizes", "types", "subtypes", "environments", "alignments",
		"minimum_challenge_rating", "maximum_challenge_rating", "encounter_table_ids",
		"faction_ids", "location_id",
	]
	if value.size() != expected.size():
		return _failure("INVALID_REQUEST", "Encounter-Pool-Filter besitzen unerwartete Felder.")
	var search_text := str(value.get("search_text", "")).strip_edges()
	var location_id := str(value.get("location_id", "")).strip_edges()
	if search_text.length() > MAX_TEXT_LENGTH or (not location_id.is_empty() and not _valid_id(location_id)):
		return _failure("INVALID_REQUEST", "Encounter-Pool-Filter enthalten ungültigen Text.")
	var minimum = value.get("minimum_challenge_rating")
	var maximum = value.get("maximum_challenge_rating")
	if (
		(minimum != null and (not minimum is int and not minimum is float or not is_finite(float(minimum)) or float(minimum) < 0.0))
		or (maximum != null and (not maximum is int and not maximum is float or not is_finite(float(maximum)) or float(maximum) < 0.0))
		or (minimum != null and maximum != null and float(minimum) > float(maximum))
	):
		return _failure("INVALID_REQUEST", "Encounter-HG-Filter sind ungültig.")
	var normalized := {
		"search_text": search_text,
		"minimum_challenge_rating": null if minimum == null else float(minimum),
		"maximum_challenge_rating": null if maximum == null else float(maximum),
		"location_id": location_id,
	}
	for key in ["sizes", "types", "subtypes", "environments", "alignments"]:
		var values := _normalized_text_values(value.get(key), false)
		if not values.get("ok", false):
			return values
		normalized[key] = values["values"]
	for key in ["encounter_table_ids", "faction_ids"]:
		var values := _normalized_text_values(value.get(key), true)
		if not values.get("ok", false):
			return values
		normalized[key] = values["values"]
	return {"ok": true, "filters": normalized}


func _normalize_free_tuning(value: Variant) -> Dictionary:
	if not value is Dictionary or value.size() != 6:
		return _failure("INVALID_REQUEST", "Encounter-Tuning besitzt unerwartete Felder.")
	var difficulty := str(value.get("difficulty", "")).to_upper()
	var amount := str(value.get("amount", "")).to_upper()
	var balance := str(value.get("balance", "")).to_upper()
	var diversity := str(value.get("diversity", "")).to_upper()
	var seed := str(value.get("seed", "")).strip_edges()
	var alternative_count = value.get("alternative_count")
	if (
		difficulty not in FREE_DIFFICULTIES
		or amount not in FREE_AMOUNTS
		or balance not in FREE_BALANCES
		or diversity not in FREE_DIVERSITIES
		or seed.length() > MAX_TEXT_LENGTH
		or not _positive_integer(alternative_count)
		or int(alternative_count) > FREE_MAX_ALTERNATIVES
	):
		return _failure("INVALID_REQUEST", "Encounter-Tuning enthält ungültige Werte.")
	return {"ok": true, "tuning": {
		"difficulty": difficulty,
		"amount": amount,
		"balance": balance,
		"diversity": diversity,
		"seed": seed,
		"alternative_count": int(alternative_count),
	}}


func _normalized_text_values(value: Variant, identities: bool) -> Dictionary:
	if not value is Array:
		return _failure("INVALID_REQUEST", "Encounter-Filterlisten müssen Listen sein.")
	var result: Array = []
	for entry_value in value:
		if not entry_value is String:
			return _failure("INVALID_REQUEST", "Encounter-Filterlisten enthalten ungültige Werte.")
		var entry := str(entry_value).strip_edges()
		if entry.is_empty() or entry.length() > MAX_TEXT_LENGTH or (identities and not _valid_id(entry)):
			return _failure("INVALID_REQUEST", "Encounter-Filterlisten enthalten ungültige Werte.")
		if entry not in result:
			result.append(entry)
	result.sort()
	return {"ok": true, "values": result}


func _default_source_constraints() -> Dictionary:
	return {
		"active": false,
		"allowed_creature_ids": [],
		"weights": {},
		"maximum_quantities": {},
		"table_ids": [],
		"faction_ids": [],
		"location_id": "",
		"linked_loot_table_ids": [],
		"loot_conflict": false,
	}


func _normalize_source_constraints(value: Variant) -> Dictionary:
	if not value is Dictionary or value.size() != 9 or not value.get("active", null) is bool:
		return _failure("INVALID_REQUEST", "Generator-Quellen besitzen ein unerwartetes Format.")
	var normalized := _default_source_constraints()
	normalized["active"] = bool(value["active"])
	for key in ["allowed_creature_ids", "table_ids", "faction_ids", "linked_loot_table_ids"]:
		var values := _normalized_text_values(value.get(key), true)
		if not values.get("ok", false):
			return values
		normalized[key] = values["values"]
	var location_id := str(value.get("location_id", "")).strip_edges()
	if not location_id.is_empty() and not _valid_id(location_id):
		return _failure("INVALID_REQUEST", "Generator-Ort besitzt keine gültige Identität.")
	normalized["location_id"] = location_id
	for pair in [["weights", 1, 10], ["maximum_quantities", 0, 2_147_483_647]]:
		var source_values = value.get(pair[0])
		if not source_values is Dictionary:
			return _failure("INVALID_REQUEST", "Generator-Quellen enthalten ungültige Mengenwerte.")
		var target := {}
		for creature_id_value in source_values:
			var creature_id := str(creature_id_value)
			var number = source_values[creature_id_value]
			if not _valid_id(creature_id) or not _integer(number) or int(number) < int(pair[1]) or int(number) > int(pair[2]):
				return _failure("INVALID_REQUEST", "Generator-Quellen enthalten ungültige Mengenwerte.")
			target[creature_id] = int(number)
		normalized[pair[0]] = target
	if not value.get("loot_conflict", null) is bool:
		return _failure("INVALID_REQUEST", "Generator-Loot-Hinweis ist ungültig.")
	normalized["loot_conflict"] = bool(value["loot_conflict"])
	if (
		normalized["active"]
		and (normalized["table_ids"].is_empty() or normalized["allowed_creature_ids"].is_empty())
	):
		return _failure("NO_CREATURES", "Die gewählten Quellen enthalten keine verwendbare Encounter-Tabelle.")
	return {"ok": true, "source_constraints": normalized}


func _matches_free_filters(candidate: Dictionary, filters: Dictionary, grouped_source: bool) -> bool:
	var needle := str(filters["search_text"]).to_lower()
	if not needle.is_empty() and not str(candidate["name"]).to_lower().contains(needle):
		return false
	if filters["minimum_challenge_rating"] != null and float(candidate["challenge_rating_decimal"]) < float(filters["minimum_challenge_rating"]):
		return false
	if filters["maximum_challenge_rating"] != null and float(candidate["challenge_rating_decimal"]) > float(filters["maximum_challenge_rating"]):
		return false
	for pair in [["sizes", "size"], ["alignments", "alignment"]]:
		if not filters[pair[0]].is_empty() and candidate[pair[1]] not in filters[pair[0]]:
			return false
	if not grouped_source:
		for pair in [["types", "creature_type"], ["subtypes", "subtype"]]:
			if not filters[pair[0]].is_empty() and candidate[pair[1]] not in filters[pair[0]]:
				return false
	if not grouped_source and not filters["environments"].is_empty():
		var shared := false
		for environment in candidate["environments"]:
			if environment in filters["environments"]:
				shared = true
				break
		if not shared:
			return false
	return true


func _difficulty_target(difficulty: String, levels: Array) -> Dictionary:
	var thresholds := thresholds_for(levels)
	match difficulty:
		"EASY":
			return {"minimum": 1, "maximum": maxi(1, int(thresholds["medium"]) - 1)}
		"HARD":
			return {"minimum": int(thresholds["hard"]), "maximum": maxi(int(thresholds["hard"]), int(thresholds["deadly"]) - 1)}
		"DEADLY":
			return {"minimum": int(thresholds["deadly"]), "maximum": maxi(int(thresholds["deadly"]) + 100, roundi(float(thresholds["deadly"]) * 1.5))}
		_:
			return {"minimum": int(thresholds["medium"]), "maximum": maxi(int(thresholds["medium"]), int(thresholds["hard"]) - 1)}


func _search_free_compositions(
	candidates: Array,
	levels: Array,
	resolved: Dictionary,
	target: Dictionary,
	seed: String,
	cancellation: Callable
) -> Dictionary:
	var exact: Array = []
	var fallback: Array = []
	var seen := {}
	var evaluation_count := 0
	var attempt_count := 0
	var shortlist := _free_shortlist(candidates, 32)
	for candidate in candidates:
		for quantity in range(1, mini(FREE_MAX_QUANTITY, int(candidate["maximum_quantity"])) + 1):
			if _cancelled(cancellation):
				return _cancelled_failure()
			attempt_count += 1
			evaluation_count += 1
			_collect_free_option([candidate], [quantity], levels, resolved, target, seed, seen, exact, fallback)
	for left_index in shortlist.size():
		for right_index in range(left_index + 1, shortlist.size()):
			for left_quantity in range(1, mini(10, int(shortlist[left_index]["maximum_quantity"])) + 1):
				for right_quantity in range(1, mini(10, int(shortlist[right_index]["maximum_quantity"])) + 1):
					if _cancelled(cancellation):
						return _cancelled_failure()
					attempt_count += 1
					evaluation_count += 1
					_collect_free_option(
						[shortlist[left_index], shortlist[right_index]],
						[left_quantity, right_quantity], levels, resolved, target, seed,
						seen, exact, fallback
					)
	var triple_shortlist := _free_shortlist(candidates, 18)
	for first_index in triple_shortlist.size():
		var second_index := (first_index + 1) % triple_shortlist.size()
		var third_index := (first_index + 2) % triple_shortlist.size()
		if first_index == second_index or second_index == third_index:
			continue
		for first_quantity in range(1, mini(6, int(triple_shortlist[first_index]["maximum_quantity"])) + 1):
			for second_quantity in range(1, mini(6, int(triple_shortlist[second_index]["maximum_quantity"])) + 1):
				for third_quantity in range(1, mini(6, int(triple_shortlist[third_index]["maximum_quantity"])) + 1):
					if _cancelled(cancellation):
						return _cancelled_failure()
					attempt_count += 1
					evaluation_count += 1
					_collect_free_option(
						[triple_shortlist[first_index], triple_shortlist[second_index], triple_shortlist[third_index]],
						[first_quantity, second_quantity, third_quantity], levels, resolved, target, seed,
						seen, exact, fallback
					)
	return {
		"ok": true,
		"exact": exact,
		"fallback": fallback,
		"attempt_count": attempt_count,
		"evaluation_count": evaluation_count,
	}


func _free_shortlist(candidates: Array, limit: int) -> Array:
	var sorted := candidates.duplicate(true)
	sorted.sort_custom(func(left: Dictionary, right: Dictionary) -> bool:
		if int(left["xp"]) == int(right["xp"]):
			return str(left["creature_id"]) < str(right["creature_id"])
		return int(left["xp"]) < int(right["xp"])
	)
	if sorted.size() <= limit:
		return sorted
	var result: Array = []
	for index in limit:
		result.append(sorted[roundi(float(index) * float(sorted.size() - 1) / float(limit - 1))])
	return result


func _collect_free_option(
	selected: Array,
	quantities: Array,
	levels: Array,
	resolved: Dictionary,
	target: Dictionary,
	seed: String,
	seen: Dictionary,
	exact: Array,
	fallback: Array
) -> void:
	var roster: Array = []
	var base_xp := 0
	var creature_count := 0
	var quantity_max := 0
	var source_weight_penalty := 0
	for index in selected.size():
		var candidate: Dictionary = selected[index]
		var quantity := int(quantities[index])
		base_xp += int(candidate["xp"]) * quantity
		creature_count += quantity
		quantity_max = maxi(quantity_max, quantity)
		source_weight_penalty += (10 - int(candidate["source_weight"])) * quantity
		roster.append({
			"creature_id": candidate["creature_id"],
			"name": candidate["name"],
			"last_known_name": candidate["name"],
			"quantity": quantity,
			"challenge_rating": candidate["challenge_rating"],
			"xp": candidate["xp"],
			"hit_points": candidate["hit_points"],
			"armor_class": candidate["armor_class"],
			"initiative_bonus": candidate["initiative_bonus"],
		})
	roster.sort_custom(func(left: Dictionary, right: Dictionary) -> bool:
		return str(left["creature_id"]) < str(right["creature_id"])
	)
	var roster_key_parts: Array[String] = []
	for entry in roster:
		roster_key_parts.append("%s:%d" % [entry["creature_id"], int(entry["quantity"])])
	var roster_key := "|".join(roster_key_parts)
	if seen.has(roster_key):
		return
	seen[roster_key] = true
	var adjusted_xp := roundi(float(base_xp) * multiplier_for(creature_count, levels.size()))
	var midpoint: int = roundi(float(int(target["minimum"]) + int(target["maximum"])) / 2.0)
	var score: int = absi(adjusted_xp - midpoint)
	score += _amount_penalty(creature_count, str(resolved["amount"])) * maxi(1, midpoint / 4)
	score += abs(selected.size() - _desired_species(str(resolved["diversity"]))) * maxi(1, midpoint / 5)
	score += _balance_penalty(quantities, creature_count, quantity_max, str(resolved["balance"])) * maxi(1, midpoint / 10)
	score += source_weight_penalty * maxi(1, midpoint / 1000)
	var option := {
		"alternative_id": fingerprint("free|%s|%s" % [seed, roster_key]),
		"roster": roster,
		"base_xp": base_xp,
		"adjusted_xp": adjusted_xp,
		"difficulty": difficulty_for(adjusted_xp, levels),
		"creature_count": creature_count,
		"species_count": selected.size(),
		"score": score,
	}
	if adjusted_xp >= int(target["minimum"]) and adjusted_xp <= int(target["maximum"]):
		_retain_free_option(exact, option, 128)
	else:
		_retain_free_option(fallback, option, 128)


func _retain_free_option(collection: Array, option: Dictionary, limit: int) -> void:
	if collection.size() < limit:
		collection.append(option)
		return
	var worst_index := 0
	for index in range(1, collection.size()):
		if _free_option_precedes(collection[worst_index], collection[index]):
			worst_index = index
	if _free_option_precedes(option, collection[worst_index]):
		collection[worst_index] = option


func _amount_penalty(count: int, amount: String) -> int:
	var minimum: int = int({"FEW": 1, "STANDARD": 2, "MANY": 5}.get(amount, 2))
	var maximum: int = int({"FEW": 3, "STANDARD": 6, "MANY": 12}.get(amount, 6))
	return minimum - count if count < minimum else count - maximum if count > maximum else 0


func _desired_species(diversity: String) -> int:
	return int({"LOW": 1, "MEDIUM": 2, "HIGH": 3}.get(diversity, 2))


func _balance_penalty(quantities: Array, count: int, quantity_max: int, balance: String) -> int:
	if quantities.size() <= 1:
		return 0 if balance == "FOCUSED" else 2
	var minimum := int(quantities[0])
	for quantity in quantities:
		minimum = mini(minimum, int(quantity))
	match balance:
		"FOCUSED":
			return maxi(0, count * 2 / 3 - quantity_max)
		"VARIED":
			return 0 if quantity_max > minimum else 2
		_:
			return quantity_max - minimum


func _free_option_precedes(left: Dictionary, right: Dictionary) -> bool:
	if int(left["score"]) != int(right["score"]):
		return int(left["score"]) < int(right["score"])
	return str(left["alternative_id"]) < str(right["alternative_id"])


func _free_alternative(option: Dictionary, index: int, target: Dictionary, resolved: Dictionary) -> Dictionary:
	var highlights: Array = [
		"%d Arten · %d Gegner" % [int(option["species_count"]), int(option["creature_count"])],
		"Zielband %d–%d angepasste XP" % [int(target["minimum"]), int(target["maximum"])],
		"%s · %s · %s" % [resolved["amount"], resolved["balance"], resolved["diversity"]],
	]
	if resolved.get("source_constraints", {}).get("active", false):
		var source: Dictionary = resolved["source_constraints"]
		highlights.append("%d Tabellen · %d Fraktionen%s" % [
			source["table_ids"].size(),
			source["faction_ids"].size(),
			" · 1 Ort" if not str(source["location_id"]).is_empty() else "",
		])
		if source["loot_conflict"]:
			highlights.append("Loot-Konflikt · mehrere verknüpfte Beutequellen")
	return {
		"alternative_id": option["alternative_id"],
		"label": "Vorschlag %d · %s" % [index + 1, str(option["difficulty"]).capitalize()],
		"roster": option["roster"].duplicate(true),
		"summary": {
			"base_xp": int(option["base_xp"]),
			"adjusted_xp": int(option["adjusted_xp"]),
			"difficulty": option["difficulty"],
			"creature_count": int(option["creature_count"]),
			"species_count": int(option["species_count"]),
		},
		"highlights": highlights,
	}


func _candidate_snapshot(definitions_value: Variant) -> Dictionary:
	if not definitions_value is Array:
		return _failure("STORAGE_FAILURE", "Creature-Fakten konnten nicht als Snapshot gelesen werden.")
	var rows: Array = []
	var by_id := {}
	var by_key := {}
	for definition_value in definitions_value:
		var projected := _project_candidate(definition_value)
		if not projected.get("ok", false):
			continue
		var candidate: Dictionary = projected["candidate"]
		if by_id.has(candidate["creature_id"]):
			return _failure("STORAGE_FAILURE", "Creature-Snapshot enthält doppelte Identitäten.")
		by_id[candidate["creature_id"]] = candidate
		rows.append(candidate)
		var key := "%s|%d" % [candidate["challenge_rating"], int(candidate["xp"])]
		if not by_key.has(key):
			by_key[key] = []
		by_key[key].append(candidate)
	rows.sort_custom(func(left: Dictionary, right: Dictionary) -> bool:
		return str(left["creature_id"]) < str(right["creature_id"])
	)
	return {"ok": true, "rows": rows, "by_id": by_id, "by_key": by_key}


func _project_candidate(value: Variant) -> Dictionary:
	if not value is Dictionary or value.get("kind", "") != "creature" or not value.get("content", null) is Dictionary:
		return _failure("INVALID_REQUEST", "Definition ist keine Creature.")
	var creature_id := str(value.get("definition_id", ""))
	var name := str(value.get("name", "")).strip_edges()
	var content: Dictionary = value["content"]
	var projection: Dictionary = value.get("catalog_projection", {})
	if (
		not _valid_id(creature_id)
		or name.is_empty()
		or not content.get("challenge_rating", null) is String
		or str(content["challenge_rating"]).strip_edges().is_empty()
		or not _positive_integer(content.get("xp", null))
		or not _nonnegative_integer(content.get("hit_points", null))
		or not _nonnegative_integer(content.get("armor_class", null))
		or not _integer(content.get("initiative_bonus", null))
		or not _nonnegative_integer(content.get("legendary_action_count", null))
		or (projection.has("challenge_rating_decimal") and not projection.get("challenge_rating_decimal") is int and not projection.get("challenge_rating_decimal") is float)
		or (projection.has("environments") and not projection.get("environments") is Array)
	):
		return _failure("INVALID_REQUEST", "Creature besitzt keine vollständigen Generatorfakten.")
	var candidate := {
		"creature_id": creature_id,
		"name": name,
		"challenge_rating": str(content["challenge_rating"]).strip_edges(),
		"challenge_rating_decimal": float(projection.get("challenge_rating_decimal", _challenge_rating_decimal(str(content["challenge_rating"])))),
		"xp": int(content["xp"]),
		"hit_points": int(content["hit_points"]),
		"armor_class": int(content["armor_class"]),
		"initiative_bonus": int(content["initiative_bonus"]),
		"legendary_action_count": int(content["legendary_action_count"]),
		"fly_speed": int(content.get("fly_speed", 0)) if _nonnegative_integer(content.get("fly_speed", 0)) else 0,
		"swim_speed": int(content.get("swim_speed", 0)) if _nonnegative_integer(content.get("swim_speed", 0)) else 0,
		"climb_speed": int(content.get("climb_speed", 0)) if _nonnegative_integer(content.get("climb_speed", 0)) else 0,
		"burrow_speed": int(content.get("burrow_speed", 0)) if _nonnegative_integer(content.get("burrow_speed", 0)) else 0,
		"size": str(projection.get("size", "")),
		"creature_type": str(projection.get("creature_type", "")),
		"subtype": str(projection.get("subtype", "")),
		"alignment": str(projection.get("alignment", "")),
		"environments": projection.get("environments", []).duplicate(),
	}
	candidate["role"] = _classify_role(candidate)
	return {"ok": true, "candidate": candidate}


func _challenge_rating_decimal(value: String) -> float:
	var parts := value.split("/")
	if parts.size() == 2 and str(parts[0]).is_valid_float() and str(parts[1]).is_valid_float() and not is_zero_approx(float(parts[1])):
		return float(parts[0]) / float(parts[1])
	return float(value) if value.is_valid_float() else 0.0


func _classify_role(candidate: Dictionary) -> String:
	if int(candidate["legendary_action_count"]) > 0 or int(candidate["xp"]) >= 10_000:
		return "BOSS"
	if int(candidate["hit_points"]) >= 120 and int(candidate["armor_class"]) <= 16:
		return "BRUTE"
	if (
		int(candidate["initiative_bonus"]) >= 5
		or int(candidate["fly_speed"]) > 0
		or int(candidate["swim_speed"]) > 0
		or int(candidate["climb_speed"]) > 0
		or int(candidate["burrow_speed"]) > 0
	):
		return "SKIRMISHER"
	if int(candidate["armor_class"]) >= 18 or int(candidate["xp"]) >= 1_800:
		return "ELITE"
	if int(candidate["xp"]) <= 100 and int(candidate["hit_points"]) <= 30:
		return "MINION"
	return "STANDARD"


func _role_rank(requested: String, actual: String) -> int:
	var preferred: String = {
		"MINION": "MINION",
		"SUPPORT": "STANDARD",
		"STANDARD": "STANDARD",
		"ELITE": "ELITE",
		"BOSS": "BOSS",
	}.get(requested, "STANDARD")
	if actual == preferred:
		return 0
	return int({"STANDARD": 1, "MINION": 2, "ELITE": 3, "BOSS": 4, "BRUTE": 5, "SKIRMISHER": 6}.get(actual, 7))


func _less_rank_key(left: Array, right: Array) -> bool:
	for index in range(left.size()):
		if left[index] == right[index]:
			continue
		return left[index] < right[index]
	return false


func _validate_prepare_command(source_value: Variant, intents_value: Variant) -> Dictionary:
	var source := _validate_source(source_value)
	if not source.get("ok", false):
		return source
	if not intents_value is Array or intents_value.is_empty() or intents_value.size() > MAX_INTENTS:
		return _failure("INVALID_REQUEST", "Ein Generated Encounter Batch braucht mindestens einen Intent.")
	var seen_numbers := {}
	var intents: Array = []
	for intent_value in intents_value:
		var intent := _validate_intent(intent_value)
		if not intent.get("ok", false):
			return intent
		var number := int(intent["intent"]["encounter_number"])
		if seen_numbers.has(number):
			return _failure("INVALID_REQUEST", "Encounter-Nummern müssen im Batch eindeutig sein.")
		seen_numbers[number] = true
		intents.append(intent["intent"])
	return {"ok": true, "source": source["source"], "intents": intents}


func _validate_source(value: Variant) -> Dictionary:
	if not value is Dictionary:
		return _failure("INVALID_REQUEST", "Generated Encounter Source fehlt.")
	var source: Dictionary = value
	var normalized := {
		"engine_version": str(source.get("engine_version", "")).strip_edges(),
		"preparation_id": str(source.get("preparation_id", "")).strip_edges(),
		"generation_run_id": str(source.get("generation_run_id", "")).strip_edges(),
	}
	if source.size() != 3:
		return _failure("INVALID_REQUEST", "Generated Encounter Source besitzt unerwartete Felder.")
	for field in normalized:
		if str(normalized[field]).is_empty() or str(normalized[field]).length() > MAX_TEXT_LENGTH:
			return _failure("INVALID_REQUEST", "Generated Encounter Source ist unvollständig.")
	return {"ok": true, "source": normalized}


func _validate_intent(value: Variant) -> Dictionary:
	if not value is Dictionary or not value.get("blocks", null) is Array:
		return _failure("INVALID_REQUEST", "Generated Encounter Intent ist ungültig.")
	var intent: Dictionary = value
	if intent.size() != 5:
		return _failure("INVALID_REQUEST", "Generated Encounter Intent besitzt unerwartete Felder.")
	var number = intent.get("encounter_number", null)
	var target_xp = intent.get("target_xp", null)
	var label := str(intent.get("display_label", "")).strip_edges()
	var difficulty := str(intent.get("difficulty", "")).to_upper()
	if (
		not _positive_integer(number)
		or not _positive_integer(target_xp)
		or label.is_empty()
		or label.length() > MAX_TEXT_LENGTH
		or difficulty not in ["EASY", "MEDIUM", "HARD", "DEADLY"]
		or intent["blocks"].is_empty()
		or intent["blocks"].size() > MAX_BLOCKS_PER_INTENT
	):
		return _failure("INVALID_REQUEST", "Generated Encounter Intent besitzt ungültige Fachwerte.")
	var blocks: Array = []
	var seen_blocks := {}
	for block_value in intent["blocks"]:
		var block := _validate_block(block_value)
		if not block.get("ok", false):
			return block
		var block_id := str(block["block"]["block_id"])
		if seen_blocks.has(block_id):
			return _failure("INVALID_REQUEST", "Block-Identitäten müssen pro Encounter eindeutig sein.")
		seen_blocks[block_id] = true
		blocks.append(block["block"])
	return {
		"ok": true,
		"intent": {
			"encounter_number": int(number),
			"display_label": label,
			"target_xp": int(target_xp),
			"difficulty": difficulty,
			"blocks": blocks,
		},
	}


func _validate_block(value: Variant) -> Dictionary:
	if not value is Dictionary:
		return _failure("INVALID_REQUEST", "Generated Encounter Block ist ungültig.")
	var block: Dictionary = value
	if block.size() != 5:
		return _failure("INVALID_REQUEST", "Generated Encounter Block besitzt unerwartete Felder.")
	var block_id := str(block.get("block_id", "")).strip_edges()
	var role := str(block.get("requested_role", "")).to_upper()
	var challenge_rating := str(block.get("challenge_rating", "")).strip_edges()
	if (
		block_id.is_empty()
		or block_id.length() > MAX_TEXT_LENGTH
		or role not in ["MINION", "SUPPORT", "STANDARD", "ELITE", "BOSS"]
		or challenge_rating.is_empty()
		or challenge_rating.length() > 32
		or not _positive_integer(block.get("xp", null))
		or not _positive_integer(block.get("quantity", null))
		or int(block["quantity"]) > MAX_QUANTITY
		or int(block["xp"]) > MAX_EXACT_INTEGER / int(block["quantity"])
	):
		return _failure("INVALID_REQUEST", "Generated Encounter Block besitzt ungültige Fachwerte.")
	return {
		"ok": true,
		"block": {
			"block_id": block_id,
			"requested_role": role,
			"challenge_rating": challenge_rating,
			"xp": int(block["xp"]),
			"quantity": int(block["quantity"]),
		},
	}


func _validate_prepared_roster(value: Variant) -> Dictionary:
	if not value is Dictionary or value.size() != 6 or not value.get("creatures", null) is Array:
		return _failure("INVALID_REQUEST", "Ein vorbereitetes Encounter-Roster ist ungültig.")
	if (
		not _positive_integer(value.get("encounter_number", null))
		or str(value.get("display_label", "")).strip_edges().is_empty()
		or str(value.get("display_label", "")).strip_edges().length() > 160
		or not _valid_sha256(str(value.get("intent_fingerprint", "")))
		or not _valid_sha256(str(value.get("roster_fingerprint", "")))
		or value["creatures"].is_empty()
		or not value.get("summary", null) is Dictionary
	):
		return _failure("INVALID_REQUEST", "Ein vorbereitetes Encounter-Roster ist unvollständig.")
	var seen := {}
	var total_quantity := 0
	var display_parts: Array[String] = []
	for creature in value["creatures"]:
		if not creature is Dictionary or creature.size() != 3:
			return _failure("INVALID_REQUEST", "Ein vorbereitetes Roster enthält eine ungültige Creature.")
		var creature_id := str(creature.get("creature_id", ""))
		if (
			not _valid_id(creature_id)
			or seen.has(creature_id)
			or not _positive_integer(creature.get("quantity", null))
			or str(creature.get("last_known_name", "")).strip_edges().is_empty()
			or str(creature.get("last_known_name", "")).strip_edges().length() > 160
		):
			return _failure("INVALID_REQUEST", "Ein vorbereitetes Roster enthält eine ungültige Creature.")
		seen[creature_id] = true
		if int(creature["quantity"]) > MAX_EXACT_INTEGER - total_quantity:
			return _failure("INVALID_REQUEST", "Ein vorbereitetes Roster überschreitet den unterstützten Mengenbereich.")
		total_quantity += int(creature["quantity"])
		display_parts.append("%dx %s" % [int(creature["quantity"]), str(creature["last_known_name"])])
	if str(value["roster_fingerprint"]) != fingerprint(_roster_fingerprint_text(value["creatures"])):
		return _failure("INVALID_REQUEST", "Ein vorbereitetes Roster besitzt einen ungültigen Fingerprint.")
	var summary: Dictionary = value["summary"]
	if (
		summary.size() != 8
		or summary.get("plan_id", "") != ""
		or summary.get("label", "") != value["display_label"]
		or summary.get("roster", []) != value["creatures"]
		or int(summary.get("creature_count", -1)) != total_quantity
		or not _positive_integer(summary.get("base_xp", null))
		or not _positive_integer(summary.get("adjusted_xp", null))
		or summary.get("difficulty", "") not in ["EASY", "MEDIUM", "HARD", "DEADLY"]
		or summary.get("display_summary", "") != ", ".join(display_parts)
	):
		return _failure("INVALID_REQUEST", "Ein vorbereitetes Roster besitzt eine ungültige Summary.")
	return {"ok": true}


func _validate_party_levels(value: Variant) -> Dictionary:
	if not value is Array or value.is_empty():
		return _failure("UNRESOLVABLE", "Die aktive Party enthält keine Mitglieder.")
	var levels: Array = []
	for level_value in value:
		if not _integer(level_value) or int(level_value) < 1 or int(level_value) > 20:
			return _failure("UNRESOLVABLE", "Jedes aktive Party-Mitglied braucht eine Stufe zwischen 1 und 20.")
		levels.append(int(level_value))
	return {"ok": true, "levels": levels}


func _intent_fingerprint_text(intent: Dictionary) -> String:
	var parts: Array[String] = [
		str(intent["encounter_number"]), str(intent["display_label"]),
		str(intent["target_xp"]), str(intent["difficulty"]),
	]
	for block in intent["blocks"]:
		parts.append("%s:%s:%s:%d:%d" % [
			block["block_id"], block["requested_role"], block["challenge_rating"],
			int(block["xp"]), int(block["quantity"]),
		])
	return "|".join(parts)


func _roster_fingerprint_text(roster: Array) -> String:
	var parts: Array[String] = []
	for creature in roster:
		parts.append("%s:%d" % [creature["creature_id"], int(creature["quantity"])])
	return "|".join(parts)


func _batch_fingerprint_text(batch: Dictionary) -> String:
	var source: Dictionary = batch["source"]
	var parts: Array[String] = [
		source["engine_version"], source["preparation_id"], source["generation_run_id"],
		str(batch["rosters"].size()),
	]
	for roster in batch["rosters"]:
		parts.append("%d:%s:%s" % [
			int(roster["encounter_number"]), roster["intent_fingerprint"], roster["roster_fingerprint"],
		])
	return "|".join(parts)


func _valid_id(value: String) -> bool:
	if value.is_empty() or value.length() > 160:
		return false
	for index in value.length():
		var code := value.unicode_at(index)
		if not ((code >= 48 and code <= 57) or (code >= 97 and code <= 122) or code in [45, 46, 95]):
			return false
	return value not in [".", ".."]


func _valid_sha256(value: String) -> bool:
	if value.length() != 64:
		return false
	for character in value:
		if character not in "0123456789abcdef":
			return false
	return true


func _integer(value: Variant) -> bool:
	if not value is int and not value is float:
		return false
	var numeric := float(value)
	return is_finite(numeric) and is_equal_approx(numeric, roundf(numeric))


func _positive_integer(value: Variant) -> bool:
	return _integer(value) and float(value) > 0 and float(value) <= MAX_EXACT_INTEGER


func _nonnegative_integer(value: Variant) -> bool:
	return _integer(value) and float(value) >= 0 and float(value) <= MAX_EXACT_INTEGER


func _cancelled(callback: Callable) -> bool:
	return callback.is_valid() and callback.call()


func _cancelled_failure() -> Dictionary:
	return _failure("CANCELLED", "Generated Encounter Vorbereitung wurde ersetzt.")


func _failure(status: String, message: String) -> Dictionary:
	return {"ok": false, "status": status, "error": message}
