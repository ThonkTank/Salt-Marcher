class_name PartyAdventuringDay
extends RefCounted

## Pure Party-owned adventuring-day budget, rest-cadence, and XP-progress rules.

const PartyRoster = preload("res://godot/src/features/party/party_roster.gd")

const MAX_GROUP_XP := 2_147_483_647
const MAX_EXACT_INTEGER := 9_007_199_254_740_991
const RULE_PROFILE_ID := "dnd5e-2014"
const ROUNDING_RULE_ID := "budget-thirds-positive-half-up; equal-xp-shares-ceiling"
const BUDGETS := [
	0,
	300,
	600,
	1_200,
	1_700,
	3_500,
	4_000,
	5_000,
	6_000,
	7_500,
	9_000,
	10_500,
	11_500,
	13_500,
	15_000,
	18_000,
	20_000,
	25_000,
	27_000,
	30_000,
	40_000,
]


func summary(active_characters: Array) -> Dictionary:
	if active_characters.is_empty():
		return _empty_summary("empty")
	var levels: Array = []
	var cadence: Array = []
	var remaining_to_short_total := 0
	var remaining_to_short_count := 0
	var remaining_to_long_total := 0
	var consumed_xp := 0
	var total_budget_xp := 0
	for value in active_characters:
		if not value is Dictionary:
			return _failure("Die aktuelle Party enthält einen ungültigen Charakter.")
		var character: Dictionary = value
		if character.get("level", null) == null:
			return _empty_summary("incomplete_levels")
		var level := int(character["level"])
		if level < 1 or level > 20:
			return _failure("Die aktuelle Party enthält eine ungültige Stufe.")
		levels.append(level)
		var budget: Dictionary = budget_for_level(level)
		var rests := clampi(int(character.get("short_rests_taken_since_long_rest", 0)), 0, 2)
		var target: int = int(budget["first_short_rest_xp"]) if rests == 0 else (
			int(budget["second_short_rest_xp"]) if rests == 1 else int(budget["total_budget_xp"])
		)
		var milestone: String = "short_rest_1" if rests == 0 else ("short_rest_2" if rests == 1 else "long_rest")
		var since_long := maxi(0, int(character.get("xp_since_long_rest", 0)))
		var delta := int(target) - since_long
		var segment := int(budget["final_segment_xp"] if rests >= 2 else budget["per_third_xp"])
		var soon_threshold := maxi(1, _round_ratio(segment, 1, 4))
		var urgency: String = "overdue" if delta <= 0 else ("soon" if delta <= soon_threshold else "normal")
		if rests < 2:
			remaining_to_short_total += maxi(0, delta)
			remaining_to_short_count += 1
		remaining_to_long_total += maxi(0, int(budget["total_budget_xp"]) - since_long)
		consumed_xp += since_long
		total_budget_xp += int(budget["total_budget_xp"])
		cadence.append({
			"character_id": str(character.get("character_id", "")),
			"next_milestone": milestone,
			"xp_delta": delta,
			"urgency": urgency,
		})
	return {
		"ok": true,
		"status": "ready",
		"active_levels": levels,
		"remaining_to_short_rest": 0 if remaining_to_short_count == 0 else _round_ratio(remaining_to_short_total, 1, remaining_to_short_count),
		"remaining_to_long_rest": _round_ratio(remaining_to_long_total, 1, active_characters.size()),
		"consumed_xp": consumed_xp,
		"total_budget_xp": total_budget_xp,
		"consumed_percent": 0 if total_budget_xp <= 0 else _round_ratio(consumed_xp, 100, total_budget_xp),
		"cadence": cadence,
		"provenance": _provenance(_rows_from_levels(levels), 0),
	}


func validate_request(levels_value: Variant, total_group_xp_value: Variant) -> Dictionary:
	if not levels_value is Array:
		return _failure("Adventuring-Day-Stufen müssen eine Liste sein.")
	var levels: Array = levels_value
	if levels.is_empty():
		return _failure("Füge mindestens einen Charakter hinzu.")
	var normalized: Array = []
	for value in levels:
		if not _integral_between(value, 1, 20):
			return _failure("Jede Charakterstufe muss zwischen 1 und 20 liegen.")
		normalized.append(int(value))
	if not _integral_between(total_group_xp_value, 0, MAX_GROUP_XP):
		return _failure("Gesamt-XP müssen zwischen 0 und %d liegen." % MAX_GROUP_XP)
	return {
		"ok": true,
		"levels": normalized,
		"rows": _rows_from_levels(normalized),
		"total_group_xp": int(total_group_xp_value),
	}


func validate_rows(rows_value: Variant, total_group_xp_value: Variant) -> Dictionary:
	if not rows_value is Array or rows_value.is_empty():
		return _failure("Füge mindestens einen Charakter hinzu.")
	if not _integral_between(total_group_xp_value, 0, MAX_GROUP_XP):
		return _failure("Gesamt-XP müssen zwischen 0 und %d liegen." % MAX_GROUP_XP)
	var counts_by_level := {}
	var total_characters := 0
	var total_budget := 0
	for value in rows_value:
		if not value is Dictionary:
			return _failure("Jede Adventuring-Day-Zeile braucht Stufe und Anzahl.")
		var row: Dictionary = value
		if not _integral_between(row.get("level", null), 1, 20):
			return _failure("Jede Charakterstufe muss zwischen 1 und 20 liegen.")
		if not row.get("count", null) is int or int(row["count"]) <= 0:
			return _failure("Jede Stufenzeile braucht mindestens einen Charakter.")
		var level := int(row["level"])
		var count := int(row["count"])
		var per_character_budget := int(BUDGETS[level])
		if total_characters > MAX_EXACT_INTEGER - count or count > (MAX_EXACT_INTEGER - total_budget) / per_character_budget:
			return _failure("Die Gruppe überschreitet den exakt berechenbaren Zahlenbereich.")
		total_characters += count
		total_budget += count * per_character_budget
		counts_by_level[level] = int(counts_by_level.get(level, 0)) + count
	var rows: Array = []
	for level in range(1, 21):
		if counts_by_level.has(level):
			rows.append({"level": level, "count": counts_by_level[level]})
	return {
		"ok": true,
		"rows": rows,
		"party_size": total_characters,
		"total_budget_xp": total_budget,
		"total_group_xp": int(total_group_xp_value),
	}


func calculate(
	levels_value: Variant,
	total_group_xp_value: Variant,
	cancellation: Callable = Callable()
) -> Dictionary:
	var validated := validate_request(levels_value, total_group_xp_value)
	if not validated.get("ok", false):
		return validated
	return calculate_rows(validated["rows"], validated["total_group_xp"], cancellation)


func calculate_rows(
	rows_value: Variant,
	total_group_xp_value: Variant,
	cancellation: Callable = Callable()
) -> Dictionary:
	var validated := validate_rows(rows_value, total_group_xp_value)
	if not validated.get("ok", false):
		return validated
	var rows: Array = validated["rows"]
	var total_group_xp := int(validated["total_group_xp"])
	var party_size := int(validated["party_size"])
	var plan := plan_for_rows(rows)
	var per_character_xp := _ceiling_division(total_group_xp, party_size)
	var level_progress := _build_level_progress(rows, per_character_xp)
	var cohorts: Array = []
	for row in rows:
		cohorts.append({
			"start_level": int(row["level"]),
			"current_level": int(row["level"]),
			"count": int(row["count"]),
		})
	var events: Array = []
	var consumed_group_xp := 0
	var remaining_group_xp := total_group_xp
	var day_number := 1
	var total_days := 0.0
	while remaining_group_xp > 0:
		if _cancelled(cancellation):
			return {"ok": false, "status": "cancelled", "error": "Adventuring-Day-Berechnung wurde ersetzt."}
		var day_plan := _plan_for_cohorts(cohorts)
		var day_total_xp := maxi(1, int(day_plan["total_budget_xp"]))
		var day_consumed_xp := mini(remaining_group_xp, day_total_xp)
		var day_start_xp := consumed_group_xp
		var day_end_xp := day_start_xp + day_consumed_xp
		var partial_day := day_consumed_xp < day_total_xp
		_append_rest_events(events, day_plan, day_consumed_xp, day_start_xp, day_number, partial_day)
		_append_level_up_events(
			events,
			cohorts,
			party_size,
			day_start_xp,
			day_end_xp,
			day_number,
			partial_day
		)
		if not partial_day:
			events.append(_event(day_end_xp, "long_rest", day_number, 0, 0, false))
		total_days += float(day_consumed_xp) / day_total_xp
		consumed_group_xp = day_end_xp
		remaining_group_xp -= day_consumed_xp
		day_number += 1
	events.sort_custom(func(left: Dictionary, right: Dictionary) -> bool:
		if int(left["group_xp"]) != int(right["group_xp"]):
			return int(left["group_xp"]) < int(right["group_xp"])
		var kind_order := {"level_up": 0, "short_rest": 1, "long_rest": 2}
		if int(kind_order[left["type"]]) != int(kind_order[right["type"]]):
			return int(kind_order[left["type"]]) < int(kind_order[right["type"]])
		return int(left["new_level"]) < int(right["new_level"])
	)
	var short_rests := 0
	var long_rests := 0
	for event in events:
		if event["type"] == "short_rest":
			short_rests += 1
		elif event["type"] == "long_rest":
			long_rests += 1
	return {
		"ok": true,
		"status": "ready",
		"budget": plan,
		"progress": {
			"total_group_xp": total_group_xp,
			"per_character_awarded_xp": per_character_xp,
			"party_size": party_size,
			"full_days": long_rests,
			"total_days": total_days,
			"short_rests": short_rests,
			"long_rests": long_rests,
			"level_progress": level_progress,
			"events": events,
		},
		"planning": {
			"total_budget_xp": plan["total_budget_xp"],
			"first_short_rest_xp": plan["first_short_rest_xp"],
			"second_short_rest_xp": plan["second_short_rest_xp"],
			"recommended_short_rests": short_rests,
			"recommended_long_rests": long_rests,
		},
		"provenance": _provenance(rows, total_group_xp),
	}


func budget_for_level(level: int) -> Dictionary:
	var safe_level := clampi(level, 1, 20)
	var total := int(BUDGETS[safe_level])
	var per_third := _round_ratio(total, 1, 3)
	var second := _round_ratio(total, 2, 3)
	return {
		"level": safe_level,
		"total_budget_xp": total,
		"per_third_xp": per_third,
		"first_short_rest_xp": per_third,
		"second_short_rest_xp": second,
		"final_segment_xp": maxi(0, total - second),
	}


func plan_for_levels(levels: Array) -> Dictionary:
	return plan_for_rows(_rows_from_levels(levels))


func plan_for_rows(rows: Array) -> Dictionary:
	var total := 0
	var character_count := 0
	for row in rows:
		var count := int(row.get("count", 0))
		total += int(BUDGETS[clampi(int(row.get("level", 1)), 1, 20)]) * count
		character_count += count
	return {
		"total_budget_xp": total,
		"per_third_xp": _round_ratio(total, 1, 3),
		"first_short_rest_xp": _round_ratio(total, 1, 3),
		"second_short_rest_xp": _round_ratio(total, 2, 3),
		"character_count": character_count,
	}


func _plan_for_cohorts(cohorts: Array) -> Dictionary:
	var rows: Array = []
	for cohort in cohorts:
		rows.append({"level": cohort["current_level"], "count": cohort["count"]})
	return plan_for_rows(rows)


func _build_level_progress(rows: Array, per_character_xp: int) -> Array:
	var grouped := {}
	var key_order: Array[String] = []
	for row in rows:
		var start_level := int(row["level"])
		var end_level := _level_after_award(start_level, per_character_xp)
		var key := "%d:%d" % [start_level, end_level]
		if not grouped.has(key):
			grouped[key] = {"start_level": start_level, "end_level": end_level, "character_count": 0, "level_ups": end_level - start_level}
			key_order.append(key)
		grouped[key]["character_count"] = int(grouped[key]["character_count"]) + int(row["count"])
	var result: Array = []
	for key in key_order:
		result.append(grouped[key])
	return result


func _level_after_award(start_level: int, awarded_xp: int) -> int:
	var total_xp := PartyRoster.new().minimum_xp_for_level(start_level)
	var level := start_level
	while level < 20 and total_xp + awarded_xp >= PartyRoster.new().minimum_xp_for_level(level + 1):
		level += 1
	return level


func _append_rest_events(events: Array, plan: Dictionary, consumed: int, start: int, day: int, partial: bool) -> void:
	if consumed >= int(plan["first_short_rest_xp"]):
		events.append(_event(start + int(plan["first_short_rest_xp"]), "short_rest", day, 0, 0, partial))
	if consumed >= int(plan["second_short_rest_xp"]):
		events.append(_event(start + int(plan["second_short_rest_xp"]), "short_rest", day, 0, 0, partial))


func _append_level_up_events(
	events: Array,
	cohorts: Array,
	party_size: int,
	day_start: int,
	day_end: int,
	day_number: int,
	partial: bool
) -> void:
	var grouped := {}
	for cohort in cohorts:
		while int(cohort["current_level"]) < 20:
			var next_level := int(cohort["current_level"]) + 1
			var required_per_character := (
				PartyRoster.new().minimum_xp_for_level(next_level)
				- PartyRoster.new().minimum_xp_for_level(int(cohort["start_level"]))
			)
			if required_per_character > 1 and party_size > (MAX_GROUP_XP - 1) / (required_per_character - 1):
				break
			var xp_breakpoint := (required_per_character - 1) * party_size + 1
			if xp_breakpoint <= day_start:
				cohort["current_level"] = next_level
				continue
			if xp_breakpoint > day_end:
				break
			var key := "%d:%d" % [xp_breakpoint, next_level]
			if not grouped.has(key):
				grouped[key] = {"group_xp": xp_breakpoint, "new_level": next_level, "count": 0}
			grouped[key]["count"] = int(grouped[key]["count"]) + int(cohort["count"])
			cohort["current_level"] = next_level
	var values: Array = grouped.values()
	values.sort_custom(func(left: Dictionary, right: Dictionary) -> bool:
		return int(left["group_xp"]) < int(right["group_xp"]) if int(left["group_xp"]) != int(right["group_xp"]) else int(left["new_level"]) < int(right["new_level"])
	)
	for value in values:
		events.append(_event(int(value["group_xp"]), "level_up", day_number, int(value["new_level"]), int(value["count"]), partial))


func _event(group_xp: int, type: String, day: int, new_level: int, affected: int, partial: bool) -> Dictionary:
	return {
		"group_xp": maxi(0, group_xp),
		"type": type,
		"day_number": maxi(1, day),
		"new_level": maxi(0, new_level),
		"affected_characters": maxi(0, affected),
		"partial_day": partial,
	}


func _rows_from_levels(levels: Array) -> Array:
	var counts := {}
	for level_value in levels:
		var level := int(level_value)
		counts[level] = int(counts.get(level, 0)) + 1
	var rows: Array = []
	for level in range(1, 21):
		if counts.has(level):
			rows.append({"level": level, "count": counts[level]})
	return rows


func _provenance(rows: Array, total_group_xp: int) -> Dictionary:
	return {
		"rule_profile_id": RULE_PROFILE_ID,
		"rounding_rule_id": ROUNDING_RULE_ID,
		"inputs": {
			"level_counts": rows.duplicate(true),
			"total_group_xp": total_group_xp,
		},
	}


func _empty_summary(status: String) -> Dictionary:
	return {
		"ok": true,
		"status": status,
		"active_levels": [],
		"remaining_to_short_rest": 0,
		"remaining_to_long_rest": 0,
		"consumed_xp": 0,
		"total_budget_xp": 0,
		"consumed_percent": 0,
		"cadence": [],
		"provenance": _provenance([], 0),
	}


func _integral_between(value: Variant, minimum: int, maximum: int) -> bool:
	if not value is int and not value is float:
		return false
	var numeric := float(value)
	return is_equal_approx(numeric, roundf(numeric)) and numeric >= minimum and numeric <= maximum


func _round_ratio(value: int, numerator: int, denominator: int) -> int:
	var scaled := value * numerator
	return scaled / denominator + (1 if (scaled % denominator) * 2 >= denominator else 0)


func _ceiling_division(value: int, divisor: int) -> int:
	return value / divisor + (1 if value % divisor != 0 else 0)


func _cancelled(cancellation: Callable) -> bool:
	return cancellation.is_valid() and bool(cancellation.call())


func _failure(message: String) -> Dictionary:
	return {"ok": false, "status": "invalid", "error": message}
