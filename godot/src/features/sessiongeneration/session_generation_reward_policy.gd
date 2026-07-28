class_name SessionGenerationRewardPolicy
extends RefCounted

## Pure treasure, structured loot, magic, packing, formatting, and audit stages.

const SessionGenerationCatalog = preload("res://godot/src/features/sessiongeneration/session_generation_catalog.gd")

const ENTROPY_MODULUS := 1_000_003
const FNV_OFFSET_SIGNED := -3_750_763_034_362_895_579
const FNV_PRIME := 1_099_511_628_211


func complete(encounter_stage_value: Variant, catalog_snapshot: Dictionary, cancellation: Callable = Callable()) -> Dictionary:
	if not encounter_stage_value is Dictionary or not encounter_stage_value.get("ok", false):
		return _failure("INVALID_REQUEST", "Reward-Stufen brauchen ein vollständiges Encounter-Ergebnis.")
	if _cancelled(cancellation):
		return _cancelled_result()
	var stage: Dictionary = encounter_stage_value
	var treasures := _plan_treasures(stage["session"], stage["encounters"], catalog_snapshot, int(stage["request"]["seed"]))
	if not treasures.get("ok", false):
		return treasures
	var loot := _generate_loot(stage["session"], stage["magic_rarities"], treasures["treasures"], catalog_snapshot, int(stage["request"]["seed"]), cancellation)
	if not loot.get("ok", false):
		return loot
	var packing := _pack(loot["loot"], catalog_snapshot, int(stage["request"]["seed"]))
	var rewards := _summarize(treasures["treasures"], loot["loot"])
	var formatted := _format(stage["encounters"], treasures["treasures"], loot["loot"], rewards)
	var run := {
		"run_id": _run_id(stage),
		"content_fingerprint": "",
		"preparation_id": stage["request"]["preparation_id"],
		"engine_version": stage["engine_version"],
		"catalog_version": stage["catalog_version"],
		"catalog_content_hash": stage["catalog_content_hash"],
		"seed": stage["request"]["seed"],
		"party": stage["request"]["party"].duplicate(true),
		"session": stage["session"].duplicate(true),
		"encounter_targets": stage["encounter_targets"].duplicate(true),
		"encounters": stage["encounters"].duplicate(true),
		"treasures": treasures["treasures"],
		"loot": loot["loot"],
		"packing": packing,
		"rewards": rewards,
		"formatted_text": formatted,
		"warnings": loot["warnings"],
		"audits": [],
	}
	var audits := _audit(run)
	for audit in audits:
		if audit["status"] == "FAIL":
			return _failure("GENERATION_FAILURE", "Session Generation hat eine harte Ergebnisprüfung nicht bestanden: %s" % audit["code"])
	run["audits"] = audits
	run["content_fingerprint"] = "v1:%s" % _sha256_text(JSON.stringify(_canonical_value(_fingerprint_value(run))))
	return {"ok": true, "status": "SUCCESS", "run": run}


func _plan_treasures(session: Dictionary, encounters: Array, snapshot: Dictionary, seed: int) -> Dictionary:
	var count := int(session["treasure_count"])
	if count <= 0:
		return _failure("GENERATION_FAILURE", "Generation braucht mindestens einen Treasure-Plan.")
	var normal_count := count - 1
	var slots := _allocate_slots(int(session["non_magic_slots"]), count)
	var boss_order := encounters.duplicate(true)
	boss_order.sort_custom(func(left: Dictionary, right: Dictionary) -> bool:
		if int(left["boss_score_millionths"]) == int(right["boss_score_millionths"]):
			return int(left["encounter_number"]) < int(right["encounter_number"])
		return int(left["boss_score_millionths"]) > int(right["boss_score_millionths"])
	)
	var catalog := SessionGenerationCatalog.new()
	var themes := catalog.rows(snapshot, "DB_Themes.tsv")
	if themes.is_empty():
		return _failure("CATALOG_FAILURE", "Generation-Katalog enthält keine Themes.")
	var plans: Array = []
	var quest_used := false
	var encounter_anchor := 0
	var normal_allocated := 0
	for index in count:
		var treasure_id := index + 1
		var stock := "NORMAL" if treasure_id <= normal_count else "OVERSTOCK"
		var target_cp: int
		if stock == "OVERSTOCK":
			target_cp = int(session["overstock_budget_cp"])
		elif treasure_id == normal_count:
			target_cp = int(session["normal_budget_cp"]) - normal_allocated
		else:
			var weight := 1.0 if normal_count == 1 else 1.2 - 0.4 * index / (normal_count - 1.0)
			target_cp = roundi(int(session["normal_budget_cp"]) * weight / normal_count)
			normal_allocated += target_cp
		var roll := posmod(seed + treasure_id * 719, 10_000) / 10_000.0
		var quest_weight := 0.0 if quest_used else 0.4
		var encounter_weight := 0.4 if encounter_anchor < boss_order.size() else 0.0
		var environment_weight := 0.2
		var total_weight := quest_weight + encounter_weight + environment_weight
		var quest_end := quest_weight / total_weight
		var encounter_end := quest_end + encounter_weight / total_weight
		var channel: String
		if roll < quest_end:
			channel = "QUEST"
			quest_used = true
		elif roll < encounter_end:
			channel = "ENCOUNTER"
		else:
			channel = "ENVIRONMENT"
		var anchor := 0
		if channel == "ENCOUNTER":
			anchor = int(boss_order[encounter_anchor]["encounter_number"])
			encounter_anchor += 1
		var theme: Dictionary = themes[posmod(seed + treasure_id * 997, themes.size())]
		var magic_slots := 1 if (
			(stock == "NORMAL" and treasure_id <= int(session["normal_magic"]))
			or (stock == "OVERSTOCK" and treasure_id - normal_count <= int(session["overstock_magic"]))
		) else 0
		plans.append({
			"treasure_id": treasure_id,
			"stock_class": stock,
			"channel": channel,
			"anchor_encounter_number": anchor,
			"theme": theme["Theme"],
			"magic_type": theme["Magic_Type"],
			"target_cp": target_cp,
			"non_magic_slots": slots[index],
			"magic_slots": magic_slots,
		})
	return {"ok": true, "treasures": plans}


func _allocate_slots(total_slots: int, treasure_count: int) -> Array:
	var result: Array = []
	for _index in treasure_count:
		result.append(1)
	var remaining := total_slots - treasure_count
	var weight_total := treasure_count * (treasure_count + 1) / 2
	var assigned := 0
	for index in treasure_count:
		var extra := int(remaining * (treasure_count - index) / weight_total)
		result[index] = int(result[index]) + extra
		assigned += extra
	var index := 0
	while assigned < remaining:
		result[index] = int(result[index]) + 1
		assigned += 1
		index = (index + 1) % treasure_count
	return result


func _generate_loot(session: Dictionary, rarities: Array, treasures: Array, snapshot: Dictionary, seed: int, cancellation: Callable) -> Dictionary:
	var result: Array = []
	var warnings: Array = []
	var line_id := 1
	for treasure in treasures:
		var spent := 0
		for slot in range(1, int(treasure["non_magic_slots"]) + 1):
			if _cancelled(cancellation):
				return _cancelled_result()
			var available := maxi(0, int((int(treasure["target_cp"]) - spent) / (int(treasure["non_magic_slots"]) - slot + 1)))
			var roll := _entropy_unit(seed, "loot-role", line_id, int(treasure["treasure_id"]))
			var role := "CARRIER" if roll < 0.60 else ("USEFUL" if roll < 0.90 else "FLAVOR")
			var selected := _select_mundane(snapshot, role, available, line_id, treasure, seed)
			if not selected.get("ok", false):
				return selected
			result.append({
				"line_id": line_id,
				"treasure_id": treasure["treasure_id"],
				"role": role,
				"item_id": selected["item_id"],
				"text": selected["text"],
				"quantity": selected["quantity"],
				"unit_cp": selected["unit_cp"],
				"actual_cp": selected["actual_cp"],
				"total_capacity_millionths": selected["total_capacity_millionths"],
				"allowed_containers": selected["allowed_containers"],
				"magic_rarity": "",
				"cursed": false,
			})
			line_id += 1
			spent += int(selected["actual_cp"])
	var magic_index := 0
	for treasure in treasures:
		for _slot in int(treasure["magic_slots"]):
			var rarity := "COMMON" if rarities.is_empty() else str(rarities[mini(magic_index, rarities.size() - 1)])
			var magic := _resolve_magic(snapshot, rarity, treasure, magic_index + 1, seed)
			if not magic.get("ok", false):
				return magic
			if magic.get("unresolved", false):
				warnings.append({"code": "unresolved-fallback", "line_id": line_id})
			result.append({
				"line_id": line_id,
				"treasure_id": treasure["treasure_id"],
				"role": "MAGIC",
				"item_id": magic["item_id"],
				"text": magic["text"],
				"quantity": 1,
				"unit_cp": 0,
				"actual_cp": 0,
				"total_capacity_millionths": 0,
				"allowed_containers": "none",
				"magic_rarity": _title(rarity),
				"cursed": magic["cursed"],
			})
			line_id += 1
			magic_index += 1
	return {"ok": true, "loot": result, "warnings": warnings}


func _select_mundane(snapshot: Dictionary, role: String, available: int, line_id: int, treasure: Dictionary, seed: int) -> Dictionary:
	var catalog := SessionGenerationCatalog.new()
	var pool: Array = []
	for item in catalog.rows(snapshot, "DB_LootItems.tsv"):
		if str(item["Loot_Class"]).to_upper() == role and catalog.integer(item, "Base_CP") > 0:
			pool.append(item)
	if pool.is_empty():
		return _failure("CATALOG_FAILURE", "Generation-Katalog enthält keine %s-Lootzeilen." % role)
	if role == "CARRIER":
		var bulk_roll := _entropy_unit(seed, "carrier-bulk", line_id, int(treasure["treasure_id"]))
		if bulk_roll < 0.25:
			var bulk: Array = []
			for item in pool:
				if item["Value_Form"] == "Quantity_Good" and _contextual_weight(item, available, catalog) >= 20.0:
					bulk.append(item)
			if not bulk.is_empty():
				pool = bulk
		else:
			var form := _entropy_index(seed, "carrier-form", line_id, int(treasure["treasure_id"]), 8)
			if form == 4:
				return _coins(available, line_id, int(treasure["treasure_id"]), seed)
			if form == 3:
				var adorned := _adorned(snapshot, available, line_id, treasure, seed)
				if adorned.get("ok", false):
					return adorned
			var shaped: Array = []
			for item in pool:
				if _carrier_form(item, form, available, catalog):
					shaped.append(item)
			if not shaped.is_empty():
				pool = shaped
	var candidates: Array = []
	for item in pool:
		var candidate := _candidate(item, role, available, catalog)
		if not candidate.is_empty():
			candidates.append(candidate)
	if candidates.is_empty():
		for item in pool:
			candidates.append(_fallback_candidate(item, available, catalog))
	var best_gap := 9_223_372_036_854_775_807
	for candidate in candidates:
		best_gap = mini(best_gap, absi(int(candidate["actual_cp"]) - available))
	var tolerance := roundi(available * 0.05)
	var near: Array = []
	for candidate in candidates:
		if absi(int(candidate["actual_cp"]) - available) <= best_gap + tolerance:
			near.append(candidate)
	near.sort_custom(func(left: Dictionary, right: Dictionary) -> bool: return int(left["sort_order"]) < int(right["sort_order"]))
	var selected: Dictionary = near[_entropy_index(seed, "loot-pick-%s" % treasure["theme"], line_id, int(treasure["treasure_id"]), near.size())]
	var selection := {
		"ok": true,
		"item_id": selected["item"]["Item_ID"],
		"text": "%dx %s" % [selected["quantity"], selected["item"]["Name"]],
		"quantity": selected["quantity"],
		"unit_cp": catalog.integer(selected["item"], "Base_CP"),
		"actual_cp": selected["actual_cp"],
		"total_capacity_millionths": roundi(catalog.decimal(selected["item"], "Capacity_Units") * int(selected["quantity"]) * 1_000_000.0),
		"allowed_containers": selected["item"]["Allowed_Containers_Cache"],
	}
	return _useful_variant(snapshot, selected["item"], selection, available, line_id, treasure, seed) if role == "USEFUL" else selection


func _adorned(snapshot: Dictionary, available: int, line_id: int, treasure: Dictionary, seed: int) -> Dictionary:
	var catalog := SessionGenerationCatalog.new()
	var loot := catalog.rows(snapshot, "DB_LootItems.tsv")
	var bases: Array = []
	for item in loot:
		if (
			catalog.integer(item, "Base_CP") > 0
			and catalog.integer(item, "Base_CP") <= available
			and not catalog.list(item, "Modular_Profile_Cache").is_empty()
			and not str(item["Allowed_Containers_Cache"]).is_empty()
		):
			bases.append(item)
	bases.sort_custom(func(left: Dictionary, right: Dictionary) -> bool:
		return absi(catalog.integer(left, "Base_CP") - available) < absi(catalog.integer(right, "Base_CP") - available)
	)
	if bases.size() > 20:
		bases.resize(20)
	var candidates: Array = []
	for base in bases:
		for modifier in catalog.rows(snapshot, "DB_LootModifiers.tsv"):
			if modifier["Modifier_Kind"] != "modular" or not _matches_modifier(snapshot, modifier, base):
				continue
			var base_value := catalog.integer(base, "Base_CP") + catalog.integer(modifier, "Flat_Value_CP")
			if str(modifier["Component_Type"]).is_empty() or modifier["Component_Type"] == "none":
				if base_value <= roundi(available * 1.05):
					candidates.append({"base": base, "modifier": modifier, "component": {}, "component_quantity": 0, "actual_cp": base_value})
				continue
			for component in loot:
				if component["Can_Adorn"] != "true" or str(component["Adornment_Type"]).to_lower() != str(modifier["Component_Type"]).to_lower() or catalog.integer(component, "Base_CP") <= 0:
					continue
				for quantity in range(maxi(1, catalog.integer(modifier, "Min_Qty")), maxi(catalog.integer(modifier, "Min_Qty"), catalog.integer(modifier, "Max_Qty")) + 1):
					var value := base_value + quantity * catalog.integer(component, "Base_CP")
					if value <= roundi(available * 1.05):
						candidates.append({"base": base, "modifier": modifier, "component": component, "component_quantity": quantity, "actual_cp": value})
	if candidates.is_empty():
		return {"ok": false}
	var best_gap := 9_223_372_036_854_775_807
	for candidate in candidates:
		best_gap = mini(best_gap, absi(int(candidate["actual_cp"]) - available))
	var near: Array = []
	for candidate in candidates:
		if absi(int(candidate["actual_cp"]) - available) <= best_gap + roundi(available * 0.05):
			near.append(candidate)
	var selected: Dictionary = near[_entropy_index(seed, "adorned-pick", line_id, int(treasure["treasure_id"]), near.size())]
	var component_name := "" if selected["component"].is_empty() else str(selected["component"]["Name"])
	var text := str(selected["modifier"]["Text_Template"]).replace("{item}", selected["base"]["Name"]).replace("{qty}", str(selected["component_quantity"])).replace("{component}", component_name)
	return {
		"ok": true,
		"item_id": "procedural:adorned:%s:%s" % [selected["base"]["Item_ID"], selected["modifier"]["Modifier_ID"]],
		"text": text,
		"quantity": 1,
		"unit_cp": selected["actual_cp"],
		"actual_cp": selected["actual_cp"],
		"total_capacity_millionths": roundi(catalog.decimal(selected["base"], "Capacity_Units") * 1_000_000.0),
		"allowed_containers": selected["base"]["Allowed_Containers_Cache"],
	}


func _useful_variant(snapshot: Dictionary, item: Dictionary, base: Dictionary, available: int, line_id: int, treasure: Dictionary, seed: int) -> Dictionary:
	var catalog := SessionGenerationCatalog.new()
	var modifiers: Array = []
	for modifier in catalog.rows(snapshot, "DB_LootModifiers.tsv"):
		if (
			modifier["Modifier_Kind"] == "variant"
			and _matches_modifier(snapshot, modifier, item)
			and int(base["actual_cp"]) + catalog.integer(modifier, "Flat_Value_CP") <= roundi(available * 1.05)
		):
			modifiers.append(modifier)
	if modifiers.is_empty():
		return base
	modifiers.sort_custom(func(left: Dictionary, right: Dictionary) -> bool:
		return absi(int(base["actual_cp"]) + catalog.integer(left, "Flat_Value_CP") - available) < absi(int(base["actual_cp"]) + catalog.integer(right, "Flat_Value_CP") - available)
	)
	var best_gap := absi(int(base["actual_cp"]) + catalog.integer(modifiers[0], "Flat_Value_CP") - available)
	var best: Array = []
	for modifier in modifiers:
		if absi(int(base["actual_cp"]) + catalog.integer(modifier, "Flat_Value_CP") - available) == best_gap:
			best.append(modifier)
	var selected: Dictionary = best[_entropy_index(seed, "useful-variant", line_id, int(treasure["treasure_id"]), best.size())]
	var details := catalog.list(selected, "Details", "|")
	var detail := "" if details.is_empty() else details[_entropy_index(seed, "variant-detail", line_id, int(treasure["treasure_id"]), details.size())]
	var actual := int(base["actual_cp"]) + catalog.integer(selected, "Flat_Value_CP")
	var result := base.duplicate(true)
	result["item_id"] = "%s:%s" % [base["item_id"], selected["Modifier_ID"]]
	result["text"] = str(selected["Text_Template"]).replace("{item}", item["Name"]).replace("{detail}", detail)
	result["unit_cp"] = actual
	result["actual_cp"] = actual
	return result


func _matches_modifier(snapshot: Dictionary, modifier: Dictionary, item: Dictionary) -> bool:
	if modifier["Loot_Type"] != "all" and modifier["Loot_Type"] != item["Loot_Type"]:
		return false
	var catalog := SessionGenerationCatalog.new()
	var profiles := catalog.list(modifier, "Allowed_Profiles_Cache")
	var categories := catalog.list(modifier, "Allowed_Categories_Cache")
	for relation in catalog.rows(snapshot, "DB_LootRelations.tsv"):
		if relation["Source_ID"] != modifier["Modifier_ID"]:
			continue
		if relation["Relation_Type"] == "MODIFIER_PROFILE":
			profiles.append(_normalize_relation_target(relation["Target_ID"]))
		elif relation["Relation_Type"] == "MODIFIER_CATEGORY":
			categories.append(_normalize_relation_target(relation["Target_ID"]))
	var profile_match := "all" in profiles
	for profile in catalog.list(item, "Modular_Profile_Cache"):
		for allowed in profiles:
			if _normalize(profile) == _normalize(allowed):
				profile_match = true
	if not profile_match:
		return false
	if categories.is_empty() or "all" in categories:
		return true
	for category in categories:
		if _normalize(category) == _normalize(item["Category"]):
			return true
	return false


func _candidate(item: Dictionary, role: String, available: int, catalog: SessionGenerationCatalog) -> Dictionary:
	var unit_cp := catalog.integer(item, "Base_CP")
	var cap := _quantity_cap(item, role)
	var ratio := float(available) / unit_cp
	var low := maxi(1, mini(cap, floori(ratio)))
	var high := maxi(1, mini(cap, ceili(ratio)))
	var quantity := low if high * unit_cp > roundi(available * 1.05) or absi(low * unit_cp - available) <= absi(high * unit_cp - available) else high
	var actual := quantity * unit_cp
	if actual > roundi(available * 1.05) or (role != "CARRIER" and actual < roundi(available * 0.50)):
		return {}
	return {"item": item, "quantity": quantity, "actual_cp": actual, "sort_order": catalog.integer(item, "Source_Row")}


func _fallback_candidate(item: Dictionary, available: int, catalog: SessionGenerationCatalog) -> Dictionary:
	var quantity := maxi(1, int(available / maxi(1, catalog.integer(item, "Base_CP"))))
	return {"item": item, "quantity": quantity, "actual_cp": quantity * catalog.integer(item, "Base_CP"), "sort_order": catalog.integer(item, "Source_Row")}


func _carrier_form(item: Dictionary, form: int, available: int, catalog: SessionGenerationCatalog) -> bool:
	var category := str(item["Category"]).to_lower()
	match form:
		0: return category.contains("ingot")
		1: return category.contains("art")
		2: return category.contains("gem")
		3: return category.contains("art") or category.contains("jewel")
		5: return item["Value_Form"] == "Quantity_Good" and _contextual_weight(item, available, catalog) < 20.0
		6: return item["Loot_Type"] == "livestock"
		7: return category.contains("clothing")
	return false


func _contextual_weight(item: Dictionary, available: int, catalog: SessionGenerationCatalog) -> float:
	var quantity := maxi(1, int(available / maxi(1, catalog.integer(item, "Base_CP"))))
	return catalog.decimal(item, "Base_LB") * quantity


func _quantity_cap(item: Dictionary, role: String) -> int:
	var name := str(item["Name"])
	var category := str(item["Category"])
	if name.contains("(lb)") or name.contains("(pint)") or name.contains("(fl oz)"):
		return 10_000
	if role == "FLAVOR":
		return 50
	if category.contains("Ammunition"):
		return 20
	if category.contains("Potion") or category.contains("Poison"):
		return 3
	return 250 if role == "CARRIER" else 1


func _coins(available: int, line_id: int, treasure_id: int, seed: int) -> Dictionary:
	var profiles := ["pp_gp", "gp_ep", "gp_sp", "ep_sp", "sp_cp", "pp_gp_ep", "pp_gp_sp", "gp_ep_sp", "ep_sp_cp"]
	var profile: String = profiles[_entropy_index(seed, "coin-profile", line_id, treasure_id, profiles.size())]
	var names := profile.split("_", false)
	var values: Array = []
	var counts: Array = []
	for name in names:
		values.append({"pp": 1000, "gp": 100, "ep": 50, "sp": 10, "cp": 1}[name])
		counts.append(0)
	var low := values.size() - 1
	counts[low] = 5
	if values.size() == 3:
		counts[1] = 1
	var reserved := int(counts[low]) * int(values[low]) + (int(values[1]) if values.size() == 3 else 0)
	var remaining := maxi(0, available - reserved)
	counts[0] = maxi(1, int(remaining / maxi(int(values[0]), 1)))
	remaining = maxi(0, remaining - int(counts[0]) * int(values[0]))
	if values.size() == 3:
		var extra_middle := mini(299, int(remaining / maxi(int(values[1]), 1)))
		counts[1] = int(counts[1]) + extra_middle
		remaining -= extra_middle * int(values[1])
	var extra_low := mini(25, int(remaining / maxi(int(values[low]), 1)))
	counts[low] = int(counts[low]) + extra_low
	var actual := 0
	for index in values.size():
		actual += int(counts[index]) * int(values[index])
	if actual == available:
		var delta := -1 if _entropy_unit(seed, "coin-rounding", line_id, treasure_id) < 0.5 and int(counts[low]) > 5 else 1
		if int(counts[low]) >= 30:
			delta = -1
		counts[low] = int(counts[low]) + delta
		actual += delta * int(values[low])
	var parts: Array[String] = []
	for index in names.size():
		parts.append("%d %s" % [counts[index], names[index]])
	var capacity := maxf(0.01, ceil(maxi(1, actual) / 10_000.0 * 100.0) / 100.0 / 50.0)
	return {"ok": true, "item_id": "synthetic:coins:%s" % profile, "text": ", ".join(parts), "quantity": 1, "unit_cp": actual, "actual_cp": actual, "total_capacity_millionths": roundi(capacity * 1_000_000.0), "allowed_containers": "Pouch,Chest"}


func _resolve_magic(snapshot: Dictionary, rarity: String, treasure: Dictionary, magic_index: int, seed: int) -> Dictionary:
	var catalog := SessionGenerationCatalog.new()
	var typed: Array = []
	var fallback: Array = []
	for item in catalog.rows(snapshot, "DB_MagicItems.tsv"):
		if _rarity(item["Rarity"]) != rarity:
			continue
		fallback.append(item)
		if item["Type"] == treasure["magic_type"]:
			typed.append(item)
	var pool := typed if not typed.is_empty() else fallback
	if pool.is_empty():
		return _failure("CATALOG_FAILURE", "Generation-Katalog enthält kein Magic Item der benötigten Seltenheit.")
	var selected: Dictionary = pool[_entropy_index(seed, "magic-item", magic_index, int(treasure["treasure_id"]), pool.size())]
	var resolution := {"text": str(selected["Item"]), "unresolved": false}
	match str(selected["Decision_Type"]):
		"fixed_variant":
			resolution["text"] = "%s — %s" % [selected["Item"], selected["Info_1"]]
		"variant_group":
			resolution = _resolve_variant(snapshot, selected, treasure, magic_index, seed)
		"spell_level":
			resolution = _resolve_spell(snapshot, selected, treasure, magic_index, seed)
		"enspelled_item":
			resolution = _resolve_enspelled(snapshot, selected, treasure, magic_index, seed)
	var cursed := false
	if _entropy_unit(seed, "magic-curse", magic_index, int(treasure["treasure_id"])) < 0.20:
		var curses := catalog.rows(snapshot, "DB_MagicCurses.tsv")
		if not curses.is_empty():
			var curse := _weighted_curse(curses, seed, magic_index, int(treasure["treasure_id"]), catalog)
			resolution["text"] += " [CURSED — %s: %s]" % [curse["Name"], curse["Effect"]]
			cursed = true
	return {"ok": true, "item_id": selected["Magic_Item_ID"], "text": resolution["text"], "unresolved": resolution["unresolved"], "cursed": cursed}


func _resolve_variant(snapshot: Dictionary, selected: Dictionary, treasure: Dictionary, magic_index: int, seed: int) -> Dictionary:
	var catalog := SessionGenerationCatalog.new()
	var variants: Array = []
	for value in catalog.rows(snapshot, "DB_MagicVariants.tsv"):
		if value["Group_Key"] == selected["Info_1"]:
			variants.append(value)
	if variants.is_empty():
		return {"text": selected["Item"], "unresolved": false}
	var variant: Dictionary = variants[_entropy_index(seed, "magic-variant", magic_index, int(treasure["treasure_id"]), variants.size())]
	return {"text": "%s — %s" % [selected["Item"], variant["Option"]], "unresolved": false}


func _resolve_spell(snapshot: Dictionary, selected: Dictionary, treasure: Dictionary, magic_index: int, seed: int) -> Dictionary:
	var bounds := _digit_bounds(str(selected["Info_1"]))
	var spells := _themed_spells(snapshot, treasure, bounds[0], bounds[1])
	if spells.is_empty():
		return {"text": "%s [unresolved]" % selected["Item"], "unresolved": true}
	var spell: Dictionary = spells[_entropy_index(seed, "magic-spell-%s" % treasure["theme"], magic_index, int(treasure["treasure_id"]), spells.size())]
	return {"text": "%s — %s" % [selected["Item"], spell["Spell"]], "unresolved": false}


func _resolve_enspelled(snapshot: Dictionary, selected: Dictionary, treasure: Dictionary, magic_index: int, seed: int) -> Dictionary:
	var catalog := SessionGenerationCatalog.new()
	var rules: Array = []
	for rule in catalog.rows(snapshot, "DB_EnspelledRules.tsv"):
		if str(rule["Chassis"]).to_lower() == str(selected["Info_1"]).to_lower() and _rarity(rule["Rarity"]) == _rarity(selected["Rarity"]):
			rules.append(rule)
	if rules.is_empty():
		return {"text": "%s [unresolved]" % selected["Item"], "unresolved": true}
	var rule: Dictionary = rules[_entropy_index(seed, "enspelled-rule", magic_index, int(treasure["treasure_id"]), rules.size())]
	var spell_level := catalog.integer(rule, "Spell_Level")
	var spells := _themed_spells(snapshot, treasure, spell_level, spell_level)
	if spells.is_empty():
		return {"text": "%s [unresolved]" % selected["Item"], "unresolved": true}
	var expression := RegEx.new()
	if expression.compile(str(rule["Base_Item_Regex"])) != OK:
		return {"text": "%s [unresolved]" % selected["Item"], "unresolved": true}
	var bases: Array = []
	var max_capacity := catalog.decimal(rule, "Max_Base_Capacity")
	for item in catalog.rows(snapshot, "DB_LootItems.tsv"):
		if item["Loot_Type"] == "object" and expression.search("%s %s" % [item["Name"], item["Category"]]) != null and (max_capacity <= 0.0 or catalog.decimal(item, "Capacity_Units") <= max_capacity):
			bases.append(item)
	if bases.is_empty():
		return {"text": "%s [unresolved]" % selected["Item"], "unresolved": true}
	var spell: Dictionary = spells[_entropy_index(seed, "enspelled-spell", magic_index, int(treasure["treasure_id"]), spells.size())]
	var base: Dictionary = bases[_entropy_index(seed, "enspelled-base", magic_index, int(treasure["treasure_id"]), bases.size())]
	return {"text": "Enspelled %s — %s (%d charges; regains %s at dawn; DC %d/+%d)" % [base["Name"], spell["Spell"], catalog.integer(rule, "Max_Charges"), rule["Recharge"], catalog.integer(rule, "Save_DC"), catalog.integer(rule, "Attack_Bonus")], "unresolved": false}


func _themed_spells(snapshot: Dictionary, treasure: Dictionary, minimum: int, maximum: int) -> Array:
	var catalog := SessionGenerationCatalog.new()
	var all: Array = []
	for spell in catalog.rows(snapshot, "DB_Spells.tsv", false):
		var level := catalog.integer(spell, "Level")
		if level >= minimum and level <= maximum:
			all.append(spell)
	var colors: Array[String] = []
	for theme in catalog.rows(snapshot, "DB_Themes.tsv"):
		if theme["Theme"] == treasure["theme"]:
			colors = catalog.list(theme, "Spell_Colors")
	if colors.is_empty():
		return all
	var themed: Array = []
	for spell in all:
		for element in catalog.list(spell, "Elements"):
			if element in colors:
				themed.append(spell)
				break
	return all if themed.is_empty() else themed


func _weighted_curse(curses: Array, seed: int, magic_index: int, treasure_id: int, catalog: SessionGenerationCatalog) -> Dictionary:
	var total := 0
	for curse in curses:
		total += catalog.integer(curse, "Weight")
	var ticket := _entropy_index(seed, "curse-ticket", magic_index, treasure_id, maxi(1, total)) + 1
	var cursor := 0
	for curse in curses:
		cursor += catalog.integer(curse, "Weight")
		if cursor >= ticket:
			return curse
	return curses[-1]


func _pack(loot: Array, snapshot: Dictionary, seed: int) -> Array:
	var catalog := SessionGenerationCatalog.new()
	var by_name := {}
	for container in catalog.rows(snapshot, "DB_Containers.tsv", false):
		by_name[container["Container"]] = container
	var cumulative := {}
	var result: Array = []
	for line in loot:
		if _loose(line):
			result.append(_packing_row(line, "none", 0, "none"))
			continue
		var choices: Array = []
		for name_value in str(line["allowed_containers"]).split(",", false):
			_add_packing_choice(choices, line, by_name.get(str(name_value).strip_edges(), {}), catalog)
		if int(line["quantity"]) >= 5 and not str(line["text"]).contains("pint") and not str(line["text"]).contains("fl oz"):
			_add_packing_choice(choices, line, by_name.get("Pile", {}), catalog)
		if choices.is_empty():
			result.append(_packing_row(line, "none", 0, "none"))
			continue
		var minimum := 2_147_483_647
		for choice in choices:
			minimum = mini(minimum, int(choice["count"]))
		var eligible: Array = []
		for choice in choices:
			if int(choice["count"]) <= minimum * 4 and float(choice["fill"]) >= 0.25:
				eligible.append(choice)
		if eligible.is_empty():
			var best := 0.0
			for choice in choices:
				best = maxf(best, float(choice["fill"]))
			for choice in choices:
				if is_equal_approx(float(choice["fill"]), best):
					eligible.append(choice)
		var choice: Dictionary = eligible[_entropy_index(seed, "packing", int(line["line_id"]), int(line["treasure_id"]), eligible.size())]
		if choice["container"]["Hide_In_Output"] == "true":
			result.append(_packing_row(line, "none", 0, "none"))
		else:
			var group := "%d|%s" % [line["treasure_id"], choice["container"]["Container"]]
			var used := int(cumulative.get(group, 0)) + int(line["total_capacity_millionths"])
			cumulative[group] = used
			var capacity := roundi(catalog.decimal(choice["container"], "Capacity_Units") * 1_000_000.0)
			var group_end := ceili(float(used) / capacity)
			var container_name := str(choice["container"]["Container"])
			var container_id := "%s 1" % container_name if group_end == 1 else "%s 1-%d" % [container_name, group_end]
			result.append(_packing_row(line, container_name, choice["count"], container_id))
	return result


func _add_packing_choice(choices: Array, line: Dictionary, container: Dictionary, catalog: SessionGenerationCatalog) -> void:
	if container.is_empty() or catalog.decimal(container, "Capacity_Units") <= 0.0:
		return
	var capacity := roundi(catalog.decimal(container, "Capacity_Units") * 1_000_000.0)
	var count := maxi(1, ceili(float(line["total_capacity_millionths"]) / capacity))
	choices.append({"container": container, "count": count, "fill": float(line["total_capacity_millionths"]) / (capacity * count)})


func _loose(line: Dictionary) -> bool:
	return (
		int(line["total_capacity_millionths"]) <= 0
		or str(line["allowed_containers"]).is_empty()
		or str(line["allowed_containers"]).to_lower() == "none"
		or (int(line["quantity"]) <= 1 and int(line["total_capacity_millionths"]) >= 2_000_000 and not str(line["text"]).contains("(lb)") and not str(line["text"]).contains("pint") and not str(line["text"]).contains("fl oz"))
	)


func _packing_row(line: Dictionary, container_type: String, count: int, container_id: String) -> Dictionary:
	return {"line_id": line["line_id"], "treasure_id": line["treasure_id"], "container_type": container_type, "container_count": count, "container_id": container_id, "valid": true}


func _summarize(treasures: Array, loot: Array) -> Dictionary:
	var stocks := {}
	for treasure in treasures:
		stocks[treasure["treasure_id"]] = treasure["stock_class"]
	var normal := 0
	var overstock := 0
	var magic := 0
	for line in loot:
		if stocks[line["treasure_id"]] == "NORMAL":
			normal += int(line["actual_cp"])
		else:
			overstock += int(line["actual_cp"])
		if line["role"] == "MAGIC":
			magic += 1
	return {"normal_actual_cp": normal, "overstock_actual_cp": overstock, "magic_count": magic}


func _format(encounters: Array, treasures: Array, loot: Array, rewards: Dictionary) -> String:
	var output := "Rewards: %d gp" % roundi(int(rewards["normal_actual_cp"]) / 100.0)
	if int(rewards["overstock_actual_cp"]) > 0:
		output += " + %d gp Overstock" % roundi(int(rewards["overstock_actual_cp"]) / 100.0)
	output += "\nMagic Items: %d\n\n" % rewards["magic_count"]
	for encounter in encounters:
		output += "%d. %s [%d XP]: %s\n   Loot\n" % [encounter["encounter_number"], encounter["difficulty"], encounter["adjusted_xp"], encounter["monster_summary"]]
		var treasure_ids: Array = []
		for treasure in treasures:
			if treasure["channel"] == "ENCOUNTER" and treasure["anchor_encounter_number"] == encounter["encounter_number"]:
				treasure_ids.append(treasure["treasure_id"])
		var found := false
		for line in loot:
			if line["treasure_id"] in treasure_ids:
				output += "   %s\n" % line["text"]
				found = true
		if not found:
			output += "   —\n"
		output += "\n"
	return output.strip_edges()


func _audit(run: Dictionary) -> Array:
	var audits: Array = []
	_add_audit(audits, "party-count", int(run["session"]["party_count"]) == _sum(run["party"], "count"))
	_add_audit(audits, "encounter-target-sum", _sum(run["encounter_targets"], "target_xp") == int(run["session"]["session_xp_target"]))
	_add_audit(audits, "one-plan-per-target", run["encounters"].size() == run["encounter_targets"].size())
	_add_audit(audits, "treasure-count", run["treasures"].size() == int(run["session"]["treasure_count"]))
	var quest_count := 0
	var anchors := {}
	for treasure in run["treasures"]:
		if treasure["channel"] == "QUEST":
			quest_count += 1
		if int(treasure["anchor_encounter_number"]) > 0:
			anchors[treasure["anchor_encounter_number"]] = true
	_add_audit(audits, "quest-cap", quest_count <= 1)
	var encounter_treasure_count := 0
	for treasure in run["treasures"]:
		if int(treasure["anchor_encounter_number"]) > 0:
			encounter_treasure_count += 1
	_add_audit(audits, "encounter-anchor-uniqueness", anchors.size() == encounter_treasure_count)
	_add_audit(audits, "slot-total", _sum(run["treasures"], "non_magic_slots") == int(run["session"]["non_magic_slots"]))
	var non_increasing := true
	for index in range(1, run["treasures"].size()):
		if int(run["treasures"][index]["non_magic_slots"]) > int(run["treasures"][index - 1]["non_magic_slots"]):
			non_increasing = false
	_add_audit(audits, "slot-curve", non_increasing)
	var magic_count := 0
	var magic_on_top := true
	var packing_valid: bool = run["packing"].size() == run["loot"].size()
	for line in run["loot"]:
		if line["role"] == "MAGIC":
			magic_count += 1
			magic_on_top = magic_on_top and int(line["actual_cp"]) == 0 and int(line["unit_cp"]) == 0
	_add_audit(audits, "magic-count", magic_count == int(run["session"]["normal_magic"]) + int(run["session"]["overstock_magic"]))
	_add_audit(audits, "magic-on-top", magic_on_top)
	_add_audit(audits, "packing-valid", packing_valid)
	_add_audit(audits, "unique-line-ids", _unique_count(run["loot"], "line_id") == run["loot"].size())
	_add_audit(audits, "final-output", not str(run["formatted_text"]).is_empty())
	return audits


func _add_audit(audits: Array, code: String, passes: bool) -> void:
	audits.append({"code": code, "status": "PASS" if passes else "FAIL", "detail": "" if passes else "invariant violated"})


func _sum(rows: Array, field: String) -> int:
	var result := 0
	for row in rows:
		result += int(row[field])
	return result


func _unique_count(rows: Array, field: String) -> int:
	var values := {}
	for row in rows:
		values[row[field]] = true
	return values.size()


func _fingerprint_value(run: Dictionary) -> Array:
	return [
		"session-generation-content-fingerprint", "v1", run["run_id"], run["engine_version"],
		run["preparation_id"], run["catalog_version"], run["catalog_content_hash"], run["seed"], run["party"], run["session"],
		run["encounter_targets"], run["encounters"], run["treasures"], run["loot"], run["packing"],
		run["rewards"], run["warnings"], run["audits"],
	]


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


func _run_id(stage: Dictionary) -> String:
	var parts: Array[String] = [stage["request"]["preparation_id"], stage["engine_version"], stage["catalog_content_hash"], str(stage["request"]["seed"]), _day_text(int(stage["request"]["adventure_day_units"])), "auto" if stage["request"]["encounter_count"] == null else str(stage["request"]["encounter_count"])]
	for row in stage["request"]["party"]:
		parts.append("%d:%d" % [row["level"], row["count"]])
	return _sha256_text("|".join(parts))


func _day_text(units: int) -> String:
	var whole := int(units / 10_000)
	var fraction := "%04d" % posmod(units, 10_000)
	while fraction.ends_with("0"):
		fraction = fraction.left(-1)
	return str(whole) if fraction.is_empty() else "%d.%s" % [whole, fraction]


func _entropy_unit(seed: int, key: String, first: int, second: int) -> float:
	var key_hash := FNV_OFFSET_SIGNED
	for value in key.to_utf8_buffer():
		key_hash = (key_hash ^ int(value)) * FNV_PRIME
	var base := seed + key_hash + first * 1009 + second * 719
	var mixed := base * base + first * second * 2131
	return posmod(mixed, ENTROPY_MODULUS) / float(ENTROPY_MODULUS)


func _entropy_index(seed: int, key: String, first: int, second: int, size: int) -> int:
	return mini(size - 1, floori(_entropy_unit(seed, key, first, second) * size))


func _digit_bounds(value: String) -> Array:
	var regex := RegEx.new()
	regex.compile("[0-9]+")
	var matches := regex.search_all(value)
	if matches.is_empty():
		return [0, 9]
	var low := str(matches[0].get_string()).to_int()
	var high := str(matches[1].get_string()).to_int() if matches.size() > 1 else low
	return [low, high]


func _rarity(value: String) -> String:
	return value.strip_edges().to_upper().replace(" ", "_")


func _normalize_relation_target(value: String) -> String:
	var separator := value.find(":")
	return _normalize(value.substr(separator + 1) if separator >= 0 else value)


func _normalize(value: String) -> String:
	return value.strip_edges().to_lower().replace("-", "_").replace(" ", "_")


func _title(value: String) -> String:
	var lower := value.to_lower().replace("_", " ")
	return lower.left(1).to_upper() + lower.substr(1)


func _sha256_text(value: String) -> String:
	var context := HashingContext.new()
	context.start(HashingContext.HASH_SHA256)
	context.update(value.to_utf8_buffer())
	return context.finish().hex_encode()


func _cancelled(callback: Callable) -> bool:
	return callback.is_valid() and callback.call()


func _cancelled_result() -> Dictionary:
	return {"ok": false, "status": "CANCELLED", "error": "Session Generation wurde ersetzt."}


func _failure(status: String, message: String) -> Dictionary:
	return {"ok": false, "status": status, "error": message}
