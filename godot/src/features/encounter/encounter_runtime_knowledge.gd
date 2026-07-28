class_name EncounterRuntimeKnowledge
extends RefCounted

## Pure Encounter-owned runtime state. Saved plans remain a separate collection
## in the same owner partition and are only copied into a runtime roster on an
## explicit open command.

const FORMAT_ID := "saltmarcher.encounter-runtime.v3"
const LEGACY_FORMAT_ID := "saltmarcher.encounter-runtime.v2"
const MANUAL_CONTEXT_ID := "encounter_context.manual"
const MODES := ["builder", "initiative", "combat", "results"]
const KINDS := ["pc", "enemy", "ally"]
const MAX_COLLECTION_SIZE := 10_000
const MAX_TEXT_LENGTH := 512


func empty_runtime() -> Dictionary:
	return {
		"format": FORMAT_ID,
		"source_revision": 0,
		"focused_context_id": MANUAL_CONTEXT_ID,
		"contexts": {},
	}


func empty_context(context_id: String = MANUAL_CONTEXT_ID) -> Dictionary:
	return {
		"context_id": context_id,
		"revision": 0,
		"mode": "builder",
		"status": "Gespeicherten Encounter öffnen, um die Laufzeit vorzubereiten.",
		"active_plan_id": "",
		"roster": [],
		"initiative": [],
		"combatants": [],
		"current_turn_index": -1,
		"round": 1,
		"result": _empty_result(),
		"removed_roster_entry": {},
	}


func validate_runtime(value: Variant) -> Dictionary:
	if not value is Dictionary:
		return _failure("Encounter-Laufzeitdaten müssen ein Dokument sein.")
	var runtime: Dictionary = value.duplicate(true)
	if runtime.get("format", "") == LEGACY_FORMAT_ID:
		runtime = _upgrade_v2_runtime(runtime)
	if (
		runtime.size() != 4
		or runtime.get("format", "") != FORMAT_ID
		or not _nonnegative_integer(runtime.get("source_revision", null))
		or not _valid_id(str(runtime.get("focused_context_id", "")))
		or not runtime.get("contexts", null) is Dictionary
		or runtime["contexts"].size() > MAX_COLLECTION_SIZE
	):
		return _failure("Encounter-Laufzeitdaten besitzen kein unterstütztes Format.")
	var contexts: Dictionary = runtime["contexts"]
	if not contexts.is_empty() and not contexts.has(runtime["focused_context_id"]):
		return _failure("Der fokussierte Encounter-Kontext fehlt.")
	for context_id_value in contexts:
		var context_id := str(context_id_value)
		var validation := _validate_context(context_id, contexts[context_id_value])
		if not validation.get("ok", false):
			return validation
	return {"ok": true, "runtime": runtime.duplicate(true)}


func _upgrade_v2_runtime(runtime_value: Dictionary) -> Dictionary:
	var runtime := runtime_value.duplicate(true)
	runtime["format"] = FORMAT_ID
	var contexts: Dictionary = runtime.get("contexts", {}).duplicate(true)
	for context_id in contexts:
		if contexts[context_id] is Dictionary and not contexts[context_id].has("removed_roster_entry"):
			var context: Dictionary = contexts[context_id].duplicate(true)
			context["removed_roster_entry"] = {}
			contexts[context_id] = context
	runtime["contexts"] = contexts
	return runtime


func snapshot(owner_payload: Dictionary, context_id: String = "") -> Dictionary:
	var validation := validate_runtime(owner_payload.get("runtime", null))
	if not validation.get("ok", false):
		return validation
	var runtime: Dictionary = validation["runtime"]
	var selected_id := context_id if not context_id.is_empty() else str(runtime["focused_context_id"])
	var context: Dictionary = runtime["contexts"].get(selected_id, empty_context(selected_id)).duplicate(true)
	return {
		"ok": true,
		"status": "empty" if context["roster"].is_empty() else "ready",
		"context": _with_projection(context),
		"context_count": runtime["contexts"].size(),
		"source_revision": int(runtime["source_revision"]),
	}


func open_saved_plan(
	owner_payload: Dictionary,
	plan_id: String,
	prepared_roster: Array,
	context_id: String = MANUAL_CONTEXT_ID
) -> Dictionary:
	var state := _mutable_state(owner_payload, context_id)
	if not state.get("ok", false):
		return state
	if not owner_payload.get("records", {}).has(plan_id):
		return _failure("Gespeicherter Encounter fehlt: %s" % plan_id, "missing")
	var normalized := _normalize_prepared_roster(prepared_roster)
	if not normalized.get("ok", false):
		return normalized
	var roster_validation := _validate_prepared_roster(normalized["roster"])
	if not roster_validation.get("ok", false):
		return roster_validation
	var context := empty_context(context_id)
	context["revision"] = _next_revision(state["context"])
	context["status"] = "Encounter-Aufstellung ist bereit."
	context["active_plan_id"] = plan_id
	context["roster"] = normalized["roster"].duplicate(true)
	return _publish_context(state["payload"], state["runtime"], context, "plan_opened")


func add_creature(
	owner_payload: Dictionary,
	prepared_creature: Dictionary,
	context_id: String = MANUAL_CONTEXT_ID
) -> Dictionary:
	var state := _mutable_state(owner_payload, context_id)
	if not state.get("ok", false):
		return state
	var normalized := _normalize_prepared_roster([prepared_creature])
	if not normalized.get("ok", false):
		return normalized
	var entry: Dictionary = normalized["roster"][0]
	var context: Dictionary = state["context"]
	match str(context["mode"]):
		"builder":
			var roster: Array = context["roster"].duplicate(true)
			var merged := false
			for index in roster.size():
				if str(roster[index]["creature_id"]) == str(entry["creature_id"]) and str(roster[index]["kind"]) == "enemy":
					roster[index] = roster[index].duplicate(true)
					roster[index]["quantity"] = int(roster[index]["quantity"]) + 1
					merged = true
					break
			if not merged:
				roster.append(entry.duplicate(true))
			context["roster"] = roster
			context["active_plan_id"] = ""
			context["removed_roster_entry"] = {}
			context["status"] = "%s zur manuellen Aufstellung hinzugefügt." % entry["name"]
			context["revision"] = _next_revision(context)
			return _publish_context(state["payload"], state["runtime"], context, "creature_added")
		"combat":
			var active_id := _active_combatant_id(context)
			var combatants: Array = context["combatants"].duplicate(true)
			var combatant_id := "reinforcement.%s.%d" % [str(entry["creature_id"]), int(context["revision"]) + 1]
			combatants.append({
				"combatant_id": combatant_id,
				"name": str(entry["name"]),
				"kind": "enemy",
				"creature_id": str(entry["creature_id"]),
				"party_member_id": "",
				"current_hp": int(entry["hit_points"]),
				"max_hp": int(entry["hit_points"]),
				"armor_class": int(entry["armor_class"]),
				"initiative": 12 + clampi(int(entry["initiative_bonus"]), -3, 6),
				"xp": int(entry["xp"]),
				"order": combatants.size(),
			})
			combatants.sort_custom(Callable(self, "_combatant_precedes"))
			context["combatants"] = combatants
			context["current_turn_index"] = _combatant_index(combatants, active_id)
			context["status"] = "%s als Verstärkung hinzugefügt." % entry["name"]
			context["revision"] = _next_revision(context)
			return _publish_context(state["payload"], state["runtime"], context, "reinforcement_added")
		_:
			return _failure("Monster können nur in der Aufstellung oder im laufenden Kampf hinzugefügt werden.")


func adjust_roster_quantity(
	owner_payload: Dictionary,
	slot_id: String,
	delta: int,
	context_id: String = MANUAL_CONTEXT_ID
) -> Dictionary:
	var state := _manual_builder_state(owner_payload, context_id)
	if not state.get("ok", false):
		return state
	if not _valid_id(slot_id) or delta not in [-1, 1]:
		return _failure("Roster-Menge braucht eine gültige Zeile und genau einen Schritt.")
	var context: Dictionary = state["context"]
	var roster: Array = context["roster"].duplicate(true)
	for index in roster.size():
		if str(roster[index]["slot_id"]) != slot_id:
			continue
		var next_quantity := int(roster[index]["quantity"]) + delta
		if next_quantity <= 0:
			return _failure("Menge eins wird über Entfernen aus der Aufstellung genommen.")
		roster[index] = roster[index].duplicate(true)
		roster[index]["quantity"] = next_quantity
		context["roster"] = roster
		context["active_plan_id"] = ""
		context["removed_roster_entry"] = {}
		context["status"] = "%s auf ×%d gesetzt." % [roster[index]["name"], next_quantity]
		context["revision"] = _next_revision(context)
		return _publish_context(state["payload"], state["runtime"], context, "roster_quantity_changed")
	return _failure("Roster-Zeile fehlt: %s" % slot_id, "missing")


func remove_roster_slot(
	owner_payload: Dictionary,
	slot_id: String,
	context_id: String = MANUAL_CONTEXT_ID
) -> Dictionary:
	var state := _manual_builder_state(owner_payload, context_id)
	if not state.get("ok", false):
		return state
	if not _valid_id(slot_id):
		return _failure("Roster-Zeile besitzt keine gültige Identität.")
	var context: Dictionary = state["context"]
	var roster: Array = context["roster"].duplicate(true)
	for index in roster.size():
		if str(roster[index]["slot_id"]) != slot_id:
			continue
		var removed: Dictionary = roster[index].duplicate(true)
		roster.remove_at(index)
		context["roster"] = roster
		context["active_plan_id"] = ""
		context["removed_roster_entry"] = {"index": index, "entry": removed}
		context["status"] = "%s aus der Aufstellung entfernt." % removed["name"]
		context["revision"] = _next_revision(context)
		return _publish_context(state["payload"], state["runtime"], context, "roster_slot_removed")
	return _failure("Roster-Zeile fehlt: %s" % slot_id, "missing")


func undo_roster_removal(
	owner_payload: Dictionary,
	context_id: String = MANUAL_CONTEXT_ID
) -> Dictionary:
	var state := _manual_builder_state(owner_payload, context_id)
	if not state.get("ok", false):
		return state
	var context: Dictionary = state["context"]
	var removed: Dictionary = context["removed_roster_entry"]
	if removed.is_empty():
		return _failure("Es gibt keine entfernte Roster-Zeile zum Wiederherstellen.", "missing")
	var entry: Dictionary = removed["entry"].duplicate(true)
	var roster: Array = context["roster"].duplicate(true)
	for value in roster:
		if str(value["slot_id"]) == str(entry["slot_id"]):
			return _failure("Die entfernte Roster-Zeile ist bereits vorhanden.")
	roster.insert(clampi(int(removed["index"]), 0, roster.size()), entry)
	context["roster"] = roster
	context["active_plan_id"] = ""
	context["removed_roster_entry"] = {}
	context["status"] = "%s wiederhergestellt." % entry["name"]
	context["revision"] = _next_revision(context)
	return _publish_context(state["payload"], state["runtime"], context, "roster_removal_undone")


func open_initiative(
	owner_payload: Dictionary,
	active_party: Array,
	context_id: String = MANUAL_CONTEXT_ID
) -> Dictionary:
	var state := _mutable_state(owner_payload, context_id)
	if not state.get("ok", false):
		return state
	var context: Dictionary = state["context"]
	if context["roster"].is_empty():
		return _failure("Kampfstart braucht mindestens eine Kreatur.")
	var party_validation := _validate_active_party(active_party)
	if not party_validation.get("ok", false):
		return party_validation
	var initiative: Array = []
	for index in active_party.size():
		var member: Dictionary = active_party[index]
		initiative.append({
			"combatant_id": str(member["character_id"]),
			"label": "%s%s" % [str(member["name"]), "" if member["level"] == null else " · Stufe %d" % int(member["level"])],
			"kind": "pc",
			"initiative": 10 + index,
			"initiative_bonus": 0,
		})
	for roster_entry in context["roster"]:
		var bonus := clampi(int(roster_entry["initiative_bonus"]), -3, 6)
		initiative.append({
			"combatant_id": str(roster_entry["slot_id"]),
			"label": "%s%s · %+d" % [
				str(roster_entry["name"]),
				"" if int(roster_entry["quantity"]) == 1 else " ×%d" % int(roster_entry["quantity"]),
				int(roster_entry["initiative_bonus"]),
			],
			"kind": str(roster_entry["kind"]),
			"initiative": 12 + bonus,
			"initiative_bonus": int(roster_entry["initiative_bonus"]),
		})
	context["mode"] = "initiative"
	context["status"] = "Initiativewerte prüfen und Kampf starten."
	context["initiative"] = initiative
	context["combatants"] = []
	context["current_turn_index"] = -1
	context["round"] = 1
	context["result"] = _empty_result()
	context["revision"] = _next_revision(context)
	return _publish_context(state["payload"], state["runtime"], context, "initiative_opened")


func set_initiative(
	owner_payload: Dictionary,
	combatant_id: String,
	value: int,
	context_id: String = MANUAL_CONTEXT_ID
) -> Dictionary:
	var state := _mutable_state(owner_payload, context_id)
	if not state.get("ok", false):
		return state
	var context: Dictionary = state["context"]
	if context["mode"] != "initiative" or value < -100 or value > 200:
		return _failure("Initiative kann nur in der Initiativephase zwischen -100 und 200 gesetzt werden.")
	var found := false
	var initiative: Array = context["initiative"].duplicate(true)
	for index in initiative.size():
		if initiative[index]["combatant_id"] == combatant_id:
			initiative[index]["initiative"] = value
			found = true
			break
	if not found:
		return _failure("Initiativezeile fehlt: %s" % combatant_id, "missing")
	context["initiative"] = initiative
	context["status"] = "Initiativewert aktualisiert."
	context["revision"] = _next_revision(context)
	return _publish_context(state["payload"], state["runtime"], context, "initiative_updated")


func roll_all_initiative(
	owner_payload: Dictionary,
	rolls: Dictionary,
	context_id: String = MANUAL_CONTEXT_ID
) -> Dictionary:
	var state := _mutable_state(owner_payload, context_id)
	if not state.get("ok", false):
		return state
	var context: Dictionary = state["context"]
	if context["mode"] != "initiative" or rolls.size() != context["initiative"].size():
		return _failure("Alle sichtbaren Initiativezeilen brauchen genau einen W20-Wurf.")
	var initiative: Array = context["initiative"].duplicate(true)
	for index in initiative.size():
		var id := str(initiative[index]["combatant_id"])
		var roll = rolls.get(id, null)
		if not _positive_integer(roll) or int(roll) > 20:
			return _failure("Initiativewürfe müssen zwischen 1 und 20 liegen.")
		initiative[index]["initiative"] = int(roll) + int(initiative[index]["initiative_bonus"])
	context["initiative"] = initiative
	context["status"] = "Alle Initiativewerte wurden gewürfelt."
	context["revision"] = _next_revision(context)
	return _publish_context(state["payload"], state["runtime"], context, "initiative_rolled")


func confirm_initiative(owner_payload: Dictionary, context_id: String = MANUAL_CONTEXT_ID) -> Dictionary:
	var state := _mutable_state(owner_payload, context_id)
	if not state.get("ok", false):
		return state
	var context: Dictionary = state["context"]
	if context["mode"] != "initiative" or context["initiative"].is_empty():
		return _failure("Der Kampf braucht vollständige Initiativewerte.")
	var roster_by_id := {}
	for roster_entry in context["roster"]:
		roster_by_id[str(roster_entry["slot_id"])] = roster_entry
	var combatants: Array = []
	var order := 0
	for initiative_entry in context["initiative"]:
		var id := str(initiative_entry["combatant_id"])
		if initiative_entry["kind"] == "pc":
			combatants.append({
				"combatant_id": id,
				"name": str(initiative_entry["label"]).split(" · ")[0],
				"kind": "pc",
				"creature_id": "",
				"party_member_id": id,
				"current_hp": 0,
				"max_hp": 0,
				"armor_class": 0,
				"initiative": int(initiative_entry["initiative"]),
				"xp": 0,
				"order": order,
			})
			order += 1
			continue
		if not roster_by_id.has(id):
			return _failure("Initiative und Encounter-Aufstellung widersprechen sich.")
		var roster_entry: Dictionary = roster_by_id[id]
		for member_index in int(roster_entry["quantity"]):
			combatants.append({
				"combatant_id": "%s.member.%d" % [id, member_index + 1],
				"name": str(roster_entry["name"]) if int(roster_entry["quantity"]) == 1 else "%s #%d" % [str(roster_entry["name"]), member_index + 1],
				"kind": str(roster_entry["kind"]),
				"creature_id": str(roster_entry["creature_id"]),
				"party_member_id": "",
				"current_hp": int(roster_entry["hit_points"]),
				"max_hp": int(roster_entry["hit_points"]),
				"armor_class": int(roster_entry["armor_class"]),
				"initiative": int(initiative_entry["initiative"]),
				"xp": int(roster_entry["xp"]),
				"order": order,
			})
			order += 1
	combatants.sort_custom(Callable(self, "_combatant_precedes"))
	context["mode"] = "combat"
	context["status"] = "Kampf läuft. Trefferpunkte und Initiative bleiben Encounter-Wahrheit."
	context["combatants"] = combatants
	context["current_turn_index"] = 0 if not combatants.is_empty() else -1
	context["round"] = 1
	context["result"] = _empty_result()
	context["revision"] = _next_revision(context)
	return _publish_context(state["payload"], state["runtime"], context, "combat_started")


func advance_turn(owner_payload: Dictionary, context_id: String = MANUAL_CONTEXT_ID) -> Dictionary:
	var state := _mutable_state(owner_payload, context_id)
	if not state.get("ok", false):
		return state
	var context: Dictionary = state["context"]
	if context["mode"] != "combat" or context["combatants"].is_empty():
		return _failure("Es läuft kein Kampf mit Zugfolge.")
	var current := int(context["current_turn_index"])
	var next := current
	var round := int(context["round"])
	var found := false
	for _attempt in context["combatants"].size():
		next = (next + 1) % context["combatants"].size()
		if next == 0:
			round += 1
		if _combatant_alive(context["combatants"][next]):
			found = true
			break
	if found:
		context["current_turn_index"] = next
		context["round"] = round
	context["status"] = "Runde %d · nächster Zug." % int(context["round"])
	context["revision"] = _next_revision(context)
	return _publish_context(state["payload"], state["runtime"], context, "turn_advanced")


func mutate_hp(
	owner_payload: Dictionary,
	combatant_id: String,
	amount: int,
	healing: bool,
	context_id: String = MANUAL_CONTEXT_ID
) -> Dictionary:
	var state := _mutable_state(owner_payload, context_id)
	if not state.get("ok", false):
		return state
	var context: Dictionary = state["context"]
	if context["mode"] != "combat" or amount <= 0 or amount > 1_000_000:
		return _failure("Trefferpunkte brauchen einen positiven Betrag im laufenden Kampf.")
	var combatants: Array = context["combatants"].duplicate(true)
	var found := false
	for index in combatants.size():
		if combatants[index]["combatant_id"] != combatant_id:
			continue
		if combatants[index]["kind"] == "pc":
			return _failure("SC-Trefferpunkte gehören noch nicht zum Encounter-Laufzeitvertrag.")
		var current := int(combatants[index]["current_hp"])
		var maximum := int(combatants[index]["max_hp"])
		combatants[index]["current_hp"] = mini(maximum, current + amount) if healing else maxi(0, current - amount)
		found = true
		break
	if not found:
		return _failure("Kampfteilnehmer fehlt: %s" % combatant_id, "missing")
	context["combatants"] = combatants
	context["status"] = "Trefferpunkte aktualisiert."
	context["revision"] = _next_revision(context)
	return _publish_context(state["payload"], state["runtime"], context, "hp_updated")


func set_combat_initiative(
	owner_payload: Dictionary,
	combatant_id: String,
	value: int,
	context_id: String = MANUAL_CONTEXT_ID
) -> Dictionary:
	var state := _mutable_state(owner_payload, context_id)
	if not state.get("ok", false):
		return state
	var context: Dictionary = state["context"]
	if context["mode"] != "combat" or value < -100 or value > 200:
		return _failure("Kampfinitiative kann nur im laufenden Kampf gesetzt werden.")
	var active_id := _active_combatant_id(context)
	var combatants: Array = context["combatants"].duplicate(true)
	var found := false
	for index in combatants.size():
		if combatants[index]["combatant_id"] == combatant_id:
			combatants[index]["initiative"] = value
			found = true
			break
	if not found:
		return _failure("Kampfteilnehmer fehlt: %s" % combatant_id, "missing")
	combatants.sort_custom(Callable(self, "_combatant_precedes"))
	context["combatants"] = combatants
	context["current_turn_index"] = _combatant_index(combatants, active_id)
	context["status"] = "Kampfinitiative aktualisiert."
	context["revision"] = _next_revision(context)
	return _publish_context(state["payload"], state["runtime"], context, "combat_initiative_updated")


func end_combat(owner_payload: Dictionary, context_id: String = MANUAL_CONTEXT_ID) -> Dictionary:
	var state := _mutable_state(owner_payload, context_id)
	if not state.get("ok", false):
		return state
	var context: Dictionary = state["context"]
	if context["mode"] != "combat":
		return _failure("Es läuft kein Kampf, der beendet werden kann.")
	var enemies: Array = []
	var party_member_ids: Array = []
	var eligible_xp := 0
	for combatant in context["combatants"]:
		if combatant["kind"] == "pc":
			party_member_ids.append(str(combatant["party_member_id"]))
			continue
		var defeated := int(combatant["current_hp"]) <= 0
		if defeated and combatant["kind"] == "enemy":
			eligible_xp += int(combatant["xp"])
		if combatant["kind"] == "enemy":
			enemies.append({
				"combatant_id": combatant["combatant_id"],
				"name": combatant["name"],
				"creature_id": combatant["creature_id"],
				"hp_loss": int(combatant["max_hp"]) - int(combatant["current_hp"]),
				"xp": int(combatant["xp"]),
				"defeated": defeated,
			})
	var party_size := party_member_ids.size()
	context["result"] = {
		"enemies": enemies,
		"eligible_xp": eligible_xp,
		"per_player_xp": 0 if party_size == 0 else int(floori(float(eligible_xp) / float(party_size))),
		"party_member_ids": party_member_ids,
		"xp_awarded": false,
		"award_status": "",
	}
	context["mode"] = "results"
	context["status"] = "Kampfergebnis bereit."
	context["revision"] = _next_revision(context)
	return _publish_context(state["payload"], state["runtime"], context, "combat_ended")


func mark_xp_awarded(owner_payload: Dictionary, context_id: String = MANUAL_CONTEXT_ID) -> Dictionary:
	var state := _mutable_state(owner_payload, context_id)
	if not state.get("ok", false):
		return state
	var context: Dictionary = state["context"]
	if context["mode"] != "results" or context["result"]["xp_awarded"]:
		return _failure("Dieses Kampfergebnis kann keine XP mehr verteilen.")
	if int(context["result"]["per_player_xp"]) <= 0 or context["result"]["party_member_ids"].is_empty():
		return _failure("Dieses Kampfergebnis enthält keine verteilbaren XP.")
	context["result"]["xp_awarded"] = true
	context["result"]["award_status"] = "XP an die Kampfgruppe verteilt."
	context["status"] = "XP-Verteilung bestätigt."
	context["revision"] = _next_revision(context)
	return _publish_context(state["payload"], state["runtime"], context, "xp_awarded")


func return_to_builder(owner_payload: Dictionary, context_id: String = MANUAL_CONTEXT_ID) -> Dictionary:
	var state := _mutable_state(owner_payload, context_id)
	if not state.get("ok", false):
		return state
	var context: Dictionary = state["context"]
	if context["mode"] not in ["initiative", "results"]:
		return _failure("Nur Initiative oder Ergebnis können zum Planer zurückkehren.")
	context["mode"] = "builder"
	context["status"] = "Encounter-Aufstellung ist bereit."
	context["initiative"] = []
	context["combatants"] = []
	context["current_turn_index"] = -1
	context["round"] = 1
	context["result"] = _empty_result()
	context["revision"] = _next_revision(context)
	return _publish_context(state["payload"], state["runtime"], context, "builder_restored")


func focus_context(owner_payload: Dictionary, context_id: String) -> Dictionary:
	var validation := validate_runtime(owner_payload.get("runtime", null))
	if not validation.get("ok", false):
		return validation
	var runtime: Dictionary = validation["runtime"]
	if not runtime["contexts"].has(context_id):
		return _failure("Encounter-Kontext fehlt: %s" % context_id, "missing")
	if runtime["focused_context_id"] == context_id:
		return {
			"ok": true,
			"status": "unchanged",
			"payload": owner_payload.duplicate(true),
			"context": _with_projection(runtime["contexts"][context_id]),
			"no_write": true,
		}
	var next_runtime := runtime.duplicate(true)
	next_runtime["focused_context_id"] = context_id
	var next_payload := owner_payload.duplicate(true)
	next_payload["runtime"] = next_runtime
	return {
		"ok": true,
		"status": "context_focused",
		"payload": next_payload,
		"context": _with_projection(next_runtime["contexts"][context_id]),
	}


func synchronize_contexts(
	owner_payload: Dictionary,
	source_revision: int,
	focused_context_id: String,
	specs: Array
) -> Dictionary:
	var validation := validate_runtime(owner_payload.get("runtime", null))
	if not validation.get("ok", false):
		return validation
	if source_revision < 0 or not _valid_id(focused_context_id) or specs.is_empty() or specs.size() > MAX_COLLECTION_SIZE:
		return _failure("Scene-Synchronisierung besitzt ungültige Grenzen.")
	var runtime: Dictionary = validation["runtime"]
	if source_revision < int(runtime["source_revision"]):
		return {
			"ok": true,
			"status": "stale_ignored",
			"payload": owner_payload.duplicate(true),
			"accepted_revision": runtime["source_revision"],
			"no_write": true,
		}
	var desired_contexts := {}
	for value in specs:
		if not value is Dictionary:
			return _failure("Scene-Synchronisierung enthält einen ungültigen Kontext.")
		var spec: Dictionary = value
		var context_id := str(spec.get("context_id", ""))
		var active_plan_id := str(spec.get("active_plan_id", ""))
		if (
			spec.size() != 4
			or not _valid_id(context_id)
			or desired_contexts.has(context_id)
			or (not active_plan_id.is_empty() and not _valid_id(active_plan_id))
			or not spec.get("party", null) is Array
			or not spec.get("roster", null) is Array
		):
			return _failure("Scene-Synchronisierung enthält ungültige Kontextfakten.")
		var party_validation := _validate_active_party(spec["party"], true)
		if not party_validation.get("ok", false):
			return party_validation
		var roster_normalized := _normalize_prepared_roster(spec["roster"])
		if not roster_normalized.get("ok", false):
			return roster_normalized
		var current: Dictionary = runtime["contexts"].get(context_id, empty_context(context_id)).duplicate(true)
		desired_contexts[context_id] = _reconcile_context(
			current,
			spec["party"],
			roster_normalized["roster"],
			active_plan_id
		)
	if not desired_contexts.has(focused_context_id):
		return _failure("Fokussierter Scene-Encounter fehlt in der Synchronisierung.")
	var contexts: Dictionary = runtime["contexts"].duplicate(true)
	for id_value in contexts.keys():
		var id := str(id_value)
		if id.begins_with("encounter_context.scene.") and not desired_contexts.has(id):
			contexts.erase(id)
	for id_value in desired_contexts:
		contexts[id_value] = desired_contexts[id_value]
	var next_runtime := runtime.duplicate(true)
	next_runtime["source_revision"] = source_revision
	next_runtime["focused_context_id"] = focused_context_id
	next_runtime["contexts"] = contexts
	var next_validation := validate_runtime(next_runtime)
	if not next_validation.get("ok", false):
		return next_validation
	if next_runtime == runtime:
		return {
			"ok": true,
			"status": "unchanged",
			"payload": owner_payload.duplicate(true),
			"accepted_revision": source_revision,
			"no_write": true,
		}
	var next_payload := owner_payload.duplicate(true)
	next_payload["runtime"] = next_validation["runtime"]
	return {
		"ok": true,
		"status": "contexts_synchronized",
		"payload": next_payload,
		"accepted_revision": source_revision,
		"context": _with_projection(next_runtime["contexts"][focused_context_id]),
	}


func _reconcile_context(
	current_value: Dictionary,
	party: Array,
	roster: Array,
	active_plan_id: String
) -> Dictionary:
	var current := current_value.duplicate(true)
	var next := current_value.duplicate(true)
	next["active_plan_id"] = active_plan_id
	next["roster"] = roster.duplicate(true)
	if next["roster"] != current["roster"]:
		next["removed_roster_entry"] = {}
	match str(current["mode"]):
		"builder":
			pass
		"initiative":
			next["initiative"] = _reconciled_initiative(current["initiative"], party, roster)
		"combat":
			var active_id := _active_combatant_id(current)
			next["combatants"] = _reconciled_combatants(current["combatants"], party, roster)
			next["current_turn_index"] = _combatant_index(next["combatants"], active_id)
			if next["combatants"].is_empty():
				next["current_turn_index"] = -1
		"results":
			pass
	if next != current:
		next["status"] = "Scene-Besetzung und Encounter-Kontext sind synchron."
		next["revision"] = _next_revision(current)
	return next


func _reconciled_initiative(current: Array, party: Array, roster: Array) -> Array:
	var existing := {}
	for value in current:
		existing[str(value["combatant_id"])] = value
	var result: Array = []
	for index in party.size():
		var member: Dictionary = party[index]
		var id := str(member["character_id"])
		var prior: Dictionary = existing.get(id, {})
		result.append({
			"combatant_id": id,
			"label": "%s%s" % [str(member["name"]), "" if member["level"] == null else " · Stufe %d" % int(member["level"])],
			"kind": "pc",
			"initiative": int(prior.get("initiative", 10 + index)),
			"initiative_bonus": 0,
		})
	for entry_value in roster:
		var entry: Dictionary = entry_value
		var id := str(entry["slot_id"])
		var prior: Dictionary = existing.get(id, {})
		result.append({
			"combatant_id": id,
			"label": "%s%s · %+d" % [str(entry["name"]), "" if int(entry["quantity"]) == 1 else " ×%d" % int(entry["quantity"]), int(entry["initiative_bonus"])],
			"kind": str(entry["kind"]),
			"initiative": int(prior.get("initiative", 12 + clampi(int(entry["initiative_bonus"]), -3, 6))),
			"initiative_bonus": int(entry["initiative_bonus"]),
		})
	return result


func _reconciled_combatants(current: Array, party: Array, roster: Array) -> Array:
	var existing := {}
	for value in current:
		existing[str(value["combatant_id"])] = value
	var result: Array = []
	var order := 0
	for index in party.size():
		var member: Dictionary = party[index]
		var id := str(member["character_id"])
		var combatant: Dictionary = existing.get(id, {
			"combatant_id": id,
			"name": str(member["name"]),
			"kind": "pc",
			"creature_id": "",
			"party_member_id": id,
			"current_hp": 0,
			"max_hp": 0,
			"armor_class": 0,
			"initiative": 10 + index,
			"xp": 0,
			"order": order,
		}).duplicate(true)
		combatant["name"] = str(member["name"])
		combatant["order"] = order
		result.append(combatant)
		order += 1
	for entry_value in roster:
		var entry: Dictionary = entry_value
		for member_index in int(entry["quantity"]):
			var id := "%s.member.%d" % [str(entry["slot_id"]), member_index + 1]
			var combatant: Dictionary = existing.get(id, {
				"combatant_id": id,
				"name": str(entry["name"]) if int(entry["quantity"]) == 1 else "%s #%d" % [str(entry["name"]), member_index + 1],
				"kind": str(entry["kind"]),
				"creature_id": str(entry["creature_id"]),
				"party_member_id": "",
				"current_hp": int(entry["hit_points"]),
				"max_hp": int(entry["hit_points"]),
				"armor_class": int(entry["armor_class"]),
				"initiative": 12 + clampi(int(entry["initiative_bonus"]), -3, 6),
				"xp": int(entry["xp"]),
				"order": order,
			}).duplicate(true)
			combatant["name"] = str(entry["name"]) if int(entry["quantity"]) == 1 else "%s #%d" % [str(entry["name"]), member_index + 1]
			combatant["kind"] = str(entry["kind"])
			combatant["order"] = order
			result.append(combatant)
			order += 1
	result.sort_custom(Callable(self, "_combatant_precedes"))
	return result


func _mutable_state(owner_payload: Dictionary, context_id: String = MANUAL_CONTEXT_ID) -> Dictionary:
	var runtime_validation := validate_runtime(owner_payload.get("runtime", null))
	if not runtime_validation.get("ok", false):
		return runtime_validation
	var runtime: Dictionary = runtime_validation["runtime"]
	if not _valid_id(context_id):
		return _failure("Encounter-Kontext besitzt keine gültige Identität.")
	var context: Dictionary = runtime["contexts"].get(context_id, empty_context(context_id)).duplicate(true)
	return {"ok": true, "payload": owner_payload.duplicate(true), "runtime": runtime, "context": context}


func _manual_builder_state(owner_payload: Dictionary, context_id: String) -> Dictionary:
	if context_id != MANUAL_CONTEXT_ID:
		return _failure("Die freie Roster-Bearbeitung gehört nur zur manuellen Encounter-Aufstellung.")
	var state := _mutable_state(owner_payload, context_id)
	if not state.get("ok", false):
		return state
	if state["context"]["mode"] != "builder":
		return _failure("Roster-Zeilen können nur in der Aufstellung bearbeitet werden.")
	return state


func _publish_context(owner_payload: Dictionary, runtime: Dictionary, context: Dictionary, status: String) -> Dictionary:
	var contexts: Dictionary = runtime["contexts"].duplicate(true)
	contexts[context["context_id"]] = context.duplicate(true)
	var next_runtime: Dictionary = runtime.duplicate(true)
	next_runtime["focused_context_id"] = context["context_id"]
	next_runtime["contexts"] = contexts
	var validation := validate_runtime(next_runtime)
	if not validation.get("ok", false):
		return validation
	var next_payload := owner_payload.duplicate(true)
	next_payload["runtime"] = validation["runtime"]
	return {"ok": true, "status": status, "payload": next_payload, "context": _with_projection(context)}


func _with_projection(context_value: Dictionary) -> Dictionary:
	var context := context_value.duplicate(true)
	var alive_enemies := 0
	var total_enemies := 0
	for combatant in context["combatants"]:
		if combatant["kind"] == "enemy":
			total_enemies += 1
			if _combatant_alive(combatant):
				alive_enemies += 1
	context["active_combatant_id"] = _active_combatant_id(context)
	context["alive_enemy_count"] = alive_enemies
	context["enemy_count"] = total_enemies
	context["all_enemies_defeated"] = total_enemies > 0 and alive_enemies == 0
	return context


func _validate_context(context_id: String, value: Variant) -> Dictionary:
	if not _valid_id(context_id) or not value is Dictionary:
		return _failure("Encounter-Kontext besitzt keine gültige Identität.")
	var context: Dictionary = value
	if (
		context.size() != 12
		or context.get("context_id", "") != context_id
		or not _nonnegative_integer(context.get("revision", null))
		or context.get("mode", "") not in MODES
		or not _valid_text(context.get("status", null), true)
		or not _valid_optional_id(context.get("active_plan_id", null))
		or not context.get("roster", null) is Array
		or not context.get("initiative", null) is Array
		or not context.get("combatants", null) is Array
		or not _integer(context.get("current_turn_index", null))
		or not _positive_integer(context.get("round", null))
		or not context.get("result", null) is Dictionary
		or not context.get("removed_roster_entry", null) is Dictionary
	):
		return _failure("Encounter-Kontext %s besitzt ungültige Grundwerte." % context_id)
	for collection in [context["roster"], context["initiative"], context["combatants"]]:
		if collection.size() > MAX_COLLECTION_SIZE:
			return _failure("Encounter-Kontext %s überschreitet seine Laufzeitgrenze." % context_id)
	var roster_validation := _validate_prepared_roster(context["roster"], true)
	if not roster_validation.get("ok", false):
		return roster_validation
	var removed_validation := _validate_removed_roster_entry(context["removed_roster_entry"])
	if not removed_validation.get("ok", false):
		return removed_validation
	var seen_initiative := {}
	for entry in context["initiative"]:
		if not _valid_initiative(entry) or seen_initiative.has(entry["combatant_id"]):
			return _failure("Encounter-Kontext %s besitzt ungültige Initiative." % context_id)
		seen_initiative[entry["combatant_id"]] = true
	var seen_combatants := {}
	for combatant in context["combatants"]:
		if not _valid_combatant(combatant) or seen_combatants.has(combatant["combatant_id"]):
			return _failure("Encounter-Kontext %s besitzt ungültige Kampfteilnehmer." % context_id)
		seen_combatants[combatant["combatant_id"]] = true
	if context["combatants"].is_empty():
		if int(context["current_turn_index"]) != -1:
			return _failure("Leerer Kampf darf keinen aktiven Zug besitzen.")
	elif int(context["current_turn_index"]) < 0 or int(context["current_turn_index"]) >= context["combatants"].size():
		return _failure("Aktiver Encounter-Zug liegt außerhalb der Reihenfolge.")
	if not _valid_result(context["result"]):
		return _failure("Encounter-Kontext %s besitzt ein ungültiges Ergebnis." % context_id)
	return {"ok": true}


func _validate_removed_roster_entry(value: Dictionary) -> Dictionary:
	if value.is_empty():
		return {"ok": true}
	if (
		value.size() != 2
		or not _nonnegative_integer(value.get("index", null))
		or not value.get("entry", null) is Dictionary
	):
		return _failure("Entfernte Roster-Zeile besitzt kein unterstütztes Undo-Format.")
	var validation := _validate_prepared_roster([value["entry"]])
	if not validation.get("ok", false):
		return validation
	return {"ok": true}


func _validate_prepared_roster(roster: Array, empty_allowed: bool = false) -> Dictionary:
	if roster.is_empty() and not empty_allowed:
		return _failure("Eine Laufzeit-Aufstellung braucht mindestens eine Kreatur.")
	var seen_slots := {}
	for value in roster:
		if not value is Dictionary:
			return _failure("Encounter-Laufzeitaufstellung enthält eine ungültige Zeile.")
		var entry: Dictionary = value
		var slot_id := str(entry.get("slot_id", ""))
		var creature_id := str(entry.get("creature_id", ""))
		if (
			entry.size() != 11
			or not _valid_id(slot_id)
			or seen_slots.has(slot_id)
			or not _valid_id(creature_id)
			or entry.get("kind", "") not in ["enemy", "ally"]
			or not _valid_text(entry.get("name", null))
			or not _positive_integer(entry.get("quantity", null))
			or not _valid_text(entry.get("challenge_rating", null))
			or not _positive_integer(entry.get("xp", null))
			or not _nonnegative_integer(entry.get("hit_points", null))
			or not _nonnegative_integer(entry.get("armor_class", null))
			or not _integer(entry.get("initiative_bonus", null))
			or not _valid_text(entry.get("last_known_name", null))
		):
			return _failure("Encounter-Laufzeitaufstellung enthält ungültige Creature-Fakten.")
		seen_slots[slot_id] = true
	return {"ok": true}


func _normalize_prepared_roster(roster: Array) -> Dictionary:
	var normalized: Array = []
	for value in roster:
		if not value is Dictionary:
			return _failure("Encounter-Laufzeitaufstellung enthält eine ungültige Zeile.")
		var entry: Dictionary = value.duplicate(true)
		if entry.size() == 9:
			entry["slot_id"] = "slot.%s" % str(entry.get("creature_id", ""))
			entry["kind"] = "enemy"
		normalized.append(entry)
	var validation := _validate_prepared_roster(normalized, true)
	if not validation.get("ok", false):
		return validation
	return {"ok": true, "roster": normalized}


func _validate_active_party(active_party: Array, empty_allowed: bool = false) -> Dictionary:
	if active_party.is_empty() and not empty_allowed:
		return _failure("Kampfstart braucht aktive Party-Mitglieder.")
	var seen := {}
	for value in active_party:
		if not value is Dictionary:
			return _failure("Aktive Party enthält ungültige Fakten.")
		var id := str(value.get("character_id", ""))
		if not _valid_id(id) or seen.has(id) or not _valid_text(value.get("name", null)):
			return _failure("Aktive Party enthält ungültige oder doppelte Mitglieder.")
		var level = value.get("level", null)
		if level != null and (not _positive_integer(level) or int(level) > 20):
			return _failure("Aktive Party enthält eine ungültige Stufe.")
		seen[id] = true
	return {"ok": true}


func _valid_initiative(value: Variant) -> bool:
	if not value is Dictionary:
		return false
	var entry: Dictionary = value
	return (
		entry.size() == 5
		and _valid_id(str(entry.get("combatant_id", "")))
		and _valid_text(entry.get("label", null))
		and entry.get("kind", "") in KINDS
		and _integer(entry.get("initiative", null))
		and int(entry["initiative"]) >= -100
		and int(entry["initiative"]) <= 200
		and _integer(entry.get("initiative_bonus", null))
	)


func _valid_combatant(value: Variant) -> bool:
	if not value is Dictionary:
		return false
	var entry: Dictionary = value
	var kind := str(entry.get("kind", ""))
	return (
		entry.size() == 11
		and _valid_id(str(entry.get("combatant_id", "")))
		and _valid_text(entry.get("name", null))
		and kind in KINDS
		and _valid_optional_id(entry.get("creature_id", null))
		and _valid_optional_id(entry.get("party_member_id", null))
		and _nonnegative_integer(entry.get("current_hp", null))
		and _nonnegative_integer(entry.get("max_hp", null))
		and int(entry["current_hp"]) <= int(entry["max_hp"])
		and _nonnegative_integer(entry.get("armor_class", null))
		and _integer(entry.get("initiative", null))
		and _nonnegative_integer(entry.get("xp", null))
		and _nonnegative_integer(entry.get("order", null))
		and ((kind == "pc" and str(entry["party_member_id"]) != "" and str(entry["creature_id"]) == "") or (kind != "pc" and str(entry["creature_id"]) != "" and str(entry["party_member_id"]) == ""))
	)


func _valid_result(value: Variant) -> bool:
	if not value is Dictionary:
		return false
	var result: Dictionary = value
	if (
		result.size() != 6
		or not result.get("enemies", null) is Array
		or not _nonnegative_integer(result.get("eligible_xp", null))
		or not _nonnegative_integer(result.get("per_player_xp", null))
		or not result.get("party_member_ids", null) is Array
		or not result.get("xp_awarded", null) is bool
		or not _valid_text(result.get("award_status", null), true)
	):
		return false
	var seen_enemies := {}
	for value_enemy in result["enemies"]:
		if not value_enemy is Dictionary:
			return false
		var enemy: Dictionary = value_enemy
		var id := str(enemy.get("combatant_id", ""))
		if (
			enemy.size() != 6
			or not _valid_id(id)
			or seen_enemies.has(id)
			or not _valid_text(enemy.get("name", null))
			or not _valid_id(str(enemy.get("creature_id", "")))
			or not _nonnegative_integer(enemy.get("hp_loss", null))
			or not _nonnegative_integer(enemy.get("xp", null))
			or not enemy.get("defeated", null) is bool
		):
			return false
		seen_enemies[id] = true
	var seen_party := {}
	for party_id_value in result["party_member_ids"]:
		var party_id := str(party_id_value)
		if not _valid_id(party_id) or seen_party.has(party_id):
			return false
		seen_party[party_id] = true
	return true


func _empty_result() -> Dictionary:
	return {
		"enemies": [],
		"eligible_xp": 0,
		"per_player_xp": 0,
		"party_member_ids": [],
		"xp_awarded": false,
		"award_status": "",
	}


func _next_revision(context: Dictionary) -> int:
	return int(context.get("revision", 0)) + 1


func _combatant_precedes(left: Dictionary, right: Dictionary) -> bool:
	if int(left["initiative"]) != int(right["initiative"]):
		return int(left["initiative"]) > int(right["initiative"])
	if left["kind"] != right["kind"]:
		return left["kind"] == "pc"
	return int(left["order"]) < int(right["order"])


func _combatant_alive(combatant: Dictionary) -> bool:
	return combatant["kind"] == "pc" or int(combatant["current_hp"]) > 0


func _active_combatant_id(context: Dictionary) -> String:
	var index := int(context.get("current_turn_index", -1))
	var combatants: Array = context.get("combatants", [])
	return "" if index < 0 or index >= combatants.size() else str(combatants[index]["combatant_id"])


func _combatant_index(combatants: Array, combatant_id: String) -> int:
	for index in combatants.size():
		if combatants[index]["combatant_id"] == combatant_id:
			return index
	return 0 if not combatants.is_empty() else -1


func _valid_text(value: Variant, empty_allowed: bool = false) -> bool:
	return value is String and str(value).length() <= MAX_TEXT_LENGTH and (empty_allowed or not str(value).strip_edges().is_empty())


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
	if not value is int and not value is float:
		return false
	return is_finite(float(value)) and is_equal_approx(float(value), roundf(float(value)))


func _nonnegative_integer(value: Variant) -> bool:
	return _integer(value) and int(value) >= 0


func _positive_integer(value: Variant) -> bool:
	return _integer(value) and int(value) > 0


func _failure(message: String, status: String = "invalid") -> Dictionary:
	return {"ok": false, "status": status, "error": message}
