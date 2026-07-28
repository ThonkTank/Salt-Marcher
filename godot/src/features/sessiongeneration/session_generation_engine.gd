class_name SessionGenerationEngine
extends RefCounted

## Pure deterministic Session Generation stages. No file, clock, or foreign-owner access.

const ENGINE_VERSION := "saltmarcher-v1"
const DAY_UNITS_PER_DAY := 10_000
const SessionGenerationCatalog = preload("res://godot/src/features/sessiongeneration/session_generation_catalog.gd")


func validate_request(
	preparation_id: String,
	party_value: Variant,
	adventure_day_units: int,
	encounter_count_value: Variant,
	seed: int
) -> Dictionary:
	if not _valid_preparation_id(preparation_id):
		return _invalid("Generation braucht eine gültige Vorbereitungsidentität.")
	if not party_value is Array or party_value.is_empty():
		return _invalid("Generation braucht mindestens eine Stufenzeile.")
	if adventure_day_units < 0 or adventure_day_units > 1_000_000:
		return _invalid("Abenteuertage liegen außerhalb des unterstützten Bereichs.")
	if seed < 0:
		return _invalid("Seed darf nicht negativ sein.")
	if encounter_count_value != null and (
		not encounter_count_value is int or int(encounter_count_value) < 1 or int(encounter_count_value) > 10
	):
		return _invalid("Explizite Encounter-Anzahl muss zwischen 1 und 10 liegen.")
	var counts := {}
	var total := 0
	for value in party_value:
		if not value is Dictionary:
			return _invalid("Jede Stufenzeile braucht Stufe und Anzahl.")
		var level_value = value.get("level", null)
		var count_value = value.get("count", null)
		if not level_value is int or int(level_value) < 1 or int(level_value) > 20:
			return _invalid("Stufen müssen zwischen 1 und 20 liegen.")
		if not count_value is int or int(count_value) < 0:
			return _invalid("Stufenanzahlen dürfen nicht negativ sein.")
		var level := int(level_value)
		if counts.has(level):
			return _invalid("Stufenzeilen müssen eindeutig sein.")
		counts[level] = int(count_value)
		total += int(count_value)
	if total <= 0:
		return _invalid("Generation braucht mindestens einen Charakter.")
	var party: Array = []
	for level in range(1, 21):
		if int(counts.get(level, 0)) > 0:
			party.append({"level": level, "count": counts[level]})
	return {
		"ok": true,
		"request": {
			"preparation_id": preparation_id,
			"party": party,
			"adventure_day_units": adventure_day_units,
			"encounter_count": encounter_count_value,
			"seed": seed,
		},
	}


func generate_encounter_stage(
	preparation_id: String,
	party_value: Variant,
	adventure_day_units: int,
	encounter_count_value: Variant,
	seed: int,
	catalog_snapshot: Dictionary,
	cancellation: Callable = Callable()
) -> Dictionary:
	var validated := validate_request(preparation_id, party_value, adventure_day_units, encounter_count_value, seed)
	if not validated.get("ok", false):
		return validated
	if _cancelled(cancellation):
		return _cancelled_result()
	var request: Dictionary = validated["request"]
	var context := _session_context(request, catalog_snapshot)
	if not context.get("ok", false):
		return context
	if int(context["session"]["session_xp_target"]) <= 0:
		return _failure("GENERATION_FAILURE", "Der gewählte Tagesanteil erzeugt kein positives Encounter-Budget.")
	var targets := _allocate_targets(request, context["session"], catalog_snapshot)
	if not targets.get("ok", false):
		return targets
	var candidates := _build_candidates(targets["targets"], context["session"], catalog_snapshot, cancellation)
	if not candidates.get("ok", false):
		return candidates
	var encounters := _select_encounters(targets["targets"], candidates["candidates"], seed)
	if encounters.size() != targets["targets"].size():
		return _failure("GENERATION_FAILURE", "Nicht jeder Encounter-Zielwert besitzt einen gültigen Strukturkandidaten.")
	_with_boss_scores(encounters, request["party"])
	return {
		"ok": true,
		"status": "SUCCESS",
		"engine_version": ENGINE_VERSION,
		"catalog_version": catalog_snapshot.get("catalog_version", ""),
		"catalog_content_hash": catalog_snapshot.get("content_hash", ""),
		"request": request,
		"session": context["session"],
		"magic_rarities": context["magic_rarities"],
		"encounter_targets": targets["targets"],
		"encounters": encounters,
		"diagnostics": {
			"candidate_count": candidates["candidates"].size(),
			"target_count": targets["targets"].size(),
		},
	}


func _valid_preparation_id(value: String) -> bool:
	if value.is_empty() or value.length() > 256:
		return false
	for index in value.length():
		var code := value.unicode_at(index)
		if not ((code >= 48 and code <= 57) or (code >= 65 and code <= 90) or (code >= 97 and code <= 122) or code in [45, 46, 58, 95]):
			return false
	return true


func _session_context(request: Dictionary, snapshot: Dictionary) -> Dictionary:
	var catalog := SessionGenerationCatalog.new()
	var progression_rows := catalog.rows(snapshot, "DB_Progression.tsv", false)
	var by_level := {}
	for row in progression_rows:
		by_level[catalog.integer(row, "Level")] = row
	var party_count := 0
	var day_xp := 0
	var weighted_gold_rate := 0.0
	var weighted_magic_rates := [0.0, 0.0, 0.0, 0.0, 0.0]
	for party_row in request["party"]:
		var level := int(party_row["level"])
		var count := int(party_row["count"])
		if not by_level.has(level):
			return _failure("CATALOG_FAILURE", "Progressionsdaten für eine Gruppenstufe fehlen.")
		var row: Dictionary = by_level[level]
		party_count += count
		day_xp += catalog.integer(row, "Day_XP_Per_Character") * count
		weighted_gold_rate += catalog.decimal(row, "Gold_Per_XP") * count
		for index in 5:
			weighted_magic_rates[index] += catalog.decimal(row, [
				"Common_Per_XP", "Uncommon_Per_XP", "Rare_Per_XP", "Very_Rare_Per_XP", "Legendary_Per_XP",
			][index]) * count
	var day_units := int(request["adventure_day_units"])
	var session_target := _rounded_ratio(day_xp, day_units, DAY_UNITS_PER_DAY)
	var average_level := _interpolated_average_level(day_xp, progression_rows, catalog)
	var per_character_xp := float(session_target) / maxi(1, party_count)
	var normal_budget := roundi(per_character_xp * weighted_gold_rate * 100.0)
	var overstock_budget := roundi(normal_budget * 0.20)
	var magic := _magic_targets(int(request["seed"]), per_character_xp, weighted_magic_rates)
	var enhanced_cap := mini(2, maxi(1, int(ceil(float(day_units) * 2.0 / DAY_UNITS_PER_DAY))))
	var normal_magic := mini(magic.size(), enhanced_cap)
	var overstock_magic := _stochastic_round(normal_magic * 0.20, posmod(int(request["seed"]) + 4049, 10_000) / 10_000.0)
	var full_day_treasures := clampi(2 + posmod(int(request["seed"]) + 997 * 719 + 1009, 3), 2, 4)
	var scaled_treasures := _rounded_ratio(full_day_treasures, mini(day_units, DAY_UNITS_PER_DAY), DAY_UNITS_PER_DAY)
	var treasure_count := maxi(2, scaled_treasures)
	var full_day_slots := 6 + posmod(int(request["seed"]) + 1009 * 719 + 997, 5)
	var scaled_slots := _rounded_ratio(full_day_slots, mini(day_units, DAY_UNITS_PER_DAY), DAY_UNITS_PER_DAY)
	var encounter_count = request["encounter_count"]
	if encounter_count == null:
		encounter_count = _automatic_encounter_count(day_units, int(request["seed"]))
	return {
		"ok": true,
		"session": {
			"party_count": party_count,
			"adventure_day_units": day_units,
			"encounter_count": int(encounter_count),
			"day_xp_budget": day_xp,
			"session_xp_target": session_target,
			"average_level_hundredths": roundi(average_level * 100.0),
			"normal_budget_cp": normal_budget,
			"overstock_budget_cp": overstock_budget,
			"non_magic_slots": maxi(treasure_count, scaled_slots),
			"normal_magic": normal_magic,
			"overstock_magic": overstock_magic,
			"treasure_count": treasure_count,
		},
		"magic_rarities": magic.slice(0, normal_magic),
	}


func _allocate_targets(request: Dictionary, session: Dictionary, snapshot: Dictionary) -> Dictionary:
	var count := int(session["encounter_count"])
	if count == 1:
		return {"ok": true, "targets": [{"encounter_number": 1, "target_xp": session["session_xp_target"]}]}
	var catalog := SessionGenerationCatalog.new()
	var by_level := {}
	for row in catalog.rows(snapshot, "DB_Progression.tsv", false):
		by_level[catalog.integer(row, "Level")] = row
	var medium := 0
	var hard := 0
	var deadly := 0
	for party_row in request["party"]:
		var row: Dictionary = by_level[int(party_row["level"])]
		var players := int(party_row["count"])
		medium += catalog.integer(row, "Medium_XP_Per_Character") * players
		hard += catalog.integer(row, "Hard_XP_Per_Character") * players
		deadly += catalog.integer(row, "Deadly_XP_Per_Character") * players
	var raw: Array[float] = [medium * 0.85]
	for index in range(1, count - 1):
		var fraction := float(index) / (count - 1)
		raw.append(medium + (hard - medium) * fraction)
	raw.append(float(deadly))
	var total := 0.0
	for value in raw:
		total += value
	if total <= 0.0:
		return _failure("GENERATION_FAILURE", "Encounter-Schwellen ergeben kein positives Ziel.")
	var targets: Array = []
	var allocated := 0
	for index in raw.size():
		var value := int(session["session_xp_target"]) - allocated if index == raw.size() - 1 else roundi(raw[index] * int(session["session_xp_target"]) / total)
		targets.append({"encounter_number": index + 1, "target_xp": value})
		allocated += value
	return {"ok": true, "targets": targets}


func _build_candidates(targets: Array, session: Dictionary, snapshot: Dictionary, cancellation: Callable) -> Dictionary:
	var catalog := SessionGenerationCatalog.new()
	var party_level := clampi(roundi(float(session["average_level_hundredths"]) / 100.0), 1, 20)
	var ranks := {}
	for row in catalog.rows(snapshot, "DB_CR.tsv"):
		ranks[str(row["CR_ID"])] = row
	var ranks_by_role := {}
	for row in catalog.rows(snapshot, "DB_EncounterRoleBands.tsv"):
		if catalog.integer(row, "Party_Level") != party_level:
			continue
		var role := str(row["Role"]).to_upper()
		if not ranks_by_role.has(role):
			ranks_by_role[role] = []
		if ranks.has(row["CR_ID"]):
			ranks_by_role[role].append(ranks[row["CR_ID"]])
	var patterns := catalog.rows(snapshot, "DB_EncounterPatterns.tsv")
	patterns.sort_custom(func(left: Dictionary, right: Dictionary) -> bool:
		return catalog.integer(left, "Sort_Order") < catalog.integer(right, "Sort_Order")
	)
	var candidates: Array = []
	for target in targets:
		for pattern in patterns:
			if _cancelled(cancellation):
				return _cancelled_result()
			var roles: Array[String] = []
			for field in ["Role_1", "Role_2", "Role_3"]:
				var role := str(pattern[field]).strip_edges().to_upper()
				if not role.is_empty():
					roles.append(role)
			var pools: Array = []
			for role in roles:
				var desired := float(target["target_xp"]) / roles.size()
				var blocks := _blocks(role, ranks_by_role.get(role, []), int(target["target_xp"]), catalog)
				blocks.sort_custom(func(left: Dictionary, right: Dictionary) -> bool:
					var left_gap := absf(_adjusted_block_xp(left) - desired)
					var right_gap := absf(_adjusted_block_xp(right) - desired)
					if is_equal_approx(left_gap, right_gap):
						return str(left["block_id"]) < str(right["block_id"])
					return left_gap < right_gap
				)
				if blocks.size() > 4:
					blocks.resize(4)
				if blocks.is_empty():
					pools.clear()
					break
				pools.append(blocks)
			if pools.size() == roles.size():
				_combine_candidate(target, pools, 0, [], candidates)
	return {"ok": true, "candidates": candidates}


func _blocks(role: String, rank_rows: Array, target_xp: int, catalog: SessionGenerationCatalog) -> Array:
	var minimum := 4 if role == "MINION" else (2 if role == "SUPPORT" else 1)
	var maximum := 10 if role == "MINION" else (5 if role in ["SUPPORT", "STANDARD"] else (2 if role == "ELITE" else 1))
	var result: Array = []
	for rank in rank_rows:
		for quantity in range(minimum, maximum + 1):
			var block := {
				"block_id": "%s_CR%s_Nr%d" % [_title(role), str(rank["CR_Label"]).replace("/", "_"), quantity],
				"role": role,
				"challenge_code": catalog.integer(rank, "CR_Code"),
				"challenge_label": rank["CR_Label"],
				"unit_xp": catalog.integer(rank, "XP"),
				"quantity": quantity,
			}
			if _adjusted_block_xp(block) <= target_xp * 1.05:
				result.append(block)
	return result


func _combine_candidate(target: Dictionary, pools: Array, index: int, selected: Array, output: Array) -> void:
	if index < pools.size():
		for block in pools[index]:
			selected.append(block)
			_combine_candidate(target, pools, index + 1, selected, output)
			selected.pop_back()
		return
	var max_unit := 0
	for block in selected:
		max_unit = maxi(max_unit, int(block["unit_xp"]))
	var effective_count := 0.0
	var raw_xp := 0
	var monster_count := 0
	var ids: Array[String] = []
	for block in selected:
		effective_count += int(block["quantity"]) * sqrt(float(block["unit_xp"]) / max_unit)
		raw_xp += int(block["unit_xp"]) * int(block["quantity"])
		monster_count += int(block["quantity"])
		ids.append(block["block_id"])
	var multiplier := _multiplier(effective_count)
	var adjusted := roundi(raw_xp * multiplier)
	output.append({
		"encounter_number": target["encounter_number"],
		"candidate_id": "%d:%s" % [target["encounter_number"], "|".join(ids)],
		"blocks": selected.duplicate(true),
		"adjusted_xp": adjusted,
		"delta": adjusted - int(target["target_xp"]),
		"monster_count": monster_count,
		"multiplier_milli": roundi(multiplier * 1000.0),
	})


func _select_encounters(targets: Array, candidates: Array, seed: int) -> Array:
	var result: Array = []
	for target in targets:
		var ordered: Array = []
		for candidate in candidates:
			if candidate["encounter_number"] == target["encounter_number"]:
				ordered.append(candidate)
		ordered.sort_custom(func(left: Dictionary, right: Dictionary) -> bool:
			var left_gap := absi(int(left["delta"]))
			var right_gap := absi(int(right["delta"]))
			return str(left["candidate_id"]) < str(right["candidate_id"]) if left_gap == right_gap else left_gap < right_gap
		)
		if ordered.is_empty():
			continue
		var fits: Array = []
		for candidate in ordered:
			if absi(int(candidate["delta"])) <= int(target["target_xp"]) * 0.05:
				fits.append(candidate)
		var pool := fits if not fits.is_empty() else ordered
		if pool.size() > 3:
			pool = pool.slice(0, 3)
		var selected: Dictionary = pool[posmod(seed + int(target["encounter_number"]) * 719, pool.size())]
		var monster_parts: Array[String] = []
		var max_code := -3
		for block in selected["blocks"]:
			monster_parts.append("%dx CR %s" % [block["quantity"], block["challenge_label"]])
			max_code = maxi(max_code, int(block["challenge_code"]))
		result.append({
			"encounter_number": target["encounter_number"],
			"target_xp": target["target_xp"],
			"adjusted_xp": selected["adjusted_xp"],
			"difficulty": _difficulty(int(target["encounter_number"]), targets.size()),
			"candidate_id": selected["candidate_id"],
			"monster_summary": ", ".join(monster_parts),
			"monster_count": selected["monster_count"],
			"multiplier_milli": selected["multiplier_milli"],
			"max_challenge_code": max_code,
			"boss_score_millionths": 0,
			"blocks": selected["blocks"].duplicate(true),
		})
	return result


func _with_boss_scores(encounters: Array, party: Array) -> void:
	var total_adjusted := 0
	var max_level := 1
	for encounter in encounters:
		total_adjusted += int(encounter["adjusted_xp"])
	for row in party:
		max_level = maxi(max_level, int(row["level"]))
	for index in encounters.size():
		var encounter: Dictionary = encounters[index].duplicate(true)
		var xp_share := float(encounter["adjusted_xp"]) / maxi(1, total_adjusted)
		var difficulty_weight: float = {"EASY": 1.0, "MEDIUM": 1.5, "HARD": 2.0, "DEADLY": 3.0}[encounter["difficulty"]]
		var challenge_weight := minf(2.5, 1.0 + float(encounter["max_challenge_code"]) / maxi(1, max_level))
		encounter["boss_score_millionths"] = roundi(xp_share * difficulty_weight * challenge_weight * 1_000_000.0)
		encounters[index] = encounter


func _interpolated_average_level(day_xp: int, rows: Array, catalog: SessionGenerationCatalog) -> float:
	var ordered := rows.duplicate()
	ordered.sort_custom(func(left: Dictionary, right: Dictionary) -> bool:
		return catalog.integer(left, "Day_XP_Party_4") < catalog.integer(right, "Day_XP_Party_4")
	)
	if day_xp <= catalog.integer(ordered[0], "Day_XP_Party_4"):
		return float(catalog.integer(ordered[0], "Level"))
	if day_xp >= catalog.integer(ordered[-1], "Day_XP_Party_4"):
		return float(catalog.integer(ordered[-1], "Level"))
	for index in range(ordered.size() - 1):
		var lower := catalog.integer(ordered[index], "Day_XP_Party_4")
		var upper := catalog.integer(ordered[index + 1], "Day_XP_Party_4")
		if day_xp >= lower and day_xp <= upper:
			return snappedf(catalog.integer(ordered[index], "Level") + float(day_xp - lower) / (upper - lower), 0.01)
	return 1.0


func _magic_targets(seed: int, xp: float, rates: Array) -> Array:
	var labels := ["COMMON", "UNCOMMON", "RARE", "VERY_RARE", "LEGENDARY"]
	var priorities := {"LEGENDARY": 0, "VERY_RARE": 1, "RARE": 2, "UNCOMMON": 3, "COMMON": 4}
	var result: Array = []
	for index in labels.size():
		var expected := xp * float(rates[index])
		var base := floori(expected)
		var roll := posmod(seed + (index + 1) * 997, 10_000) / 10_000.0
		var target := base + (1 if roll < expected - base else 0)
		for _count in target:
			result.append(labels[index])
	result.sort_custom(func(left, right) -> bool: return priorities[left] < priorities[right])
	return result


func _automatic_encounter_count(day_units: int, seed: int) -> int:
	var value := absf(sin((seed + 409) * 12.9898)) * 1_000_000.0
	var full_day := 6 + posmod(floori(value), 3)
	return maxi(1, _rounded_ratio(full_day, day_units, DAY_UNITS_PER_DAY))


func _stochastic_round(value: float, roll: float) -> int:
	var base := floori(value)
	return base + (1 if roll < value - base else 0)


func _rounded_ratio(value: int, numerator: int, denominator: int) -> int:
	return int((value * numerator + denominator / 2) / denominator)


func _adjusted_block_xp(block: Dictionary) -> float:
	return int(block["unit_xp"]) * int(block["quantity"]) * _multiplier(int(block["quantity"]))


func _multiplier(quantity: float) -> float:
	if quantity <= 1.0:
		return 1.0
	if quantity <= 2.0:
		return 1.5
	if quantity <= 6.0:
		return 2.0
	if quantity <= 10.0:
		return 2.5
	if quantity <= 14.0:
		return 3.0
	return 4.0


func _difficulty(number: int, count: int) -> String:
	if count == 1 or number == count:
		return "DEADLY"
	if number == 1:
		return "EASY"
	return "MEDIUM" if float(number) / (count + 1) <= 0.5 else "HARD"


func _title(value: String) -> String:
	var lower := value.to_lower().replace("_", " ")
	return lower.left(1).to_upper() + lower.substr(1)


func _cancelled(callback: Callable) -> bool:
	return callback.is_valid() and callback.call()


func _cancelled_result() -> Dictionary:
	return {"ok": false, "status": "CANCELLED", "error": "Session Generation wurde ersetzt."}


func _invalid(message: String) -> Dictionary:
	return _failure("INVALID_REQUEST", message)


func _failure(status: String, message: String) -> Dictionary:
	return {"ok": false, "status": status, "error": message}
