class_name SceneReadController
extends Node

## Latest-wins projection of the Scene workspace plus bounded Party, World,
## Creature, and focused Encounter facts.

const FileCampaignRegistry = preload("res://godot/src/platform/persistence/file_campaign_registry.gd")
const FileCampaignStore = preload("res://godot/src/platform/persistence/file_campaign_store.gd")
const SharedDefinitionStore = preload("res://godot/src/platform/persistence/shared_definition_store.gd")
const SceneKnowledge = preload("res://godot/src/features/scene/scene_knowledge.gd")
const EncounterPlanKnowledge = preload("res://godot/src/features/encounter/encounter_plan_knowledge.gd")
const EncounterRuntimeKnowledge = preload("res://godot/src/features/encounter/encounter_runtime_knowledge.gd")
const PartyRoster = preload("res://godot/src/features/party/party_roster.gd")
const WorldPlannerKnowledge = preload("res://godot/src/features/worldplanner/world_planner_knowledge.gd")

signal query_started(request: Dictionary)
signal result_published(result: Dictionary)

var _data_root: String
var _thread: Thread
var _mutex := Mutex.new()
var _active_request: Dictionary = {}
var _pending_request: Dictionary = {}
var _cancel_active := false
var _latest_epoch := 0


func _init(data_root: String) -> void:
	_data_root = data_root.trim_suffix("/")


func query(search_text: String = "") -> Dictionary:
	_mutex.lock()
	_latest_epoch += 1
	var request := {"epoch": _latest_epoch, "search_text": search_text.strip_edges()}
	if not _active_request.is_empty():
		_pending_request = request
		_cancel_active = true
		_mutex.unlock()
		return {"ok": true, "status": "queued", "epoch": request["epoch"]}
	_active_request = request
	_cancel_active = false
	_mutex.unlock()
	return _start(request)


func cancel_all() -> Dictionary:
	_mutex.lock()
	_latest_epoch += 1
	_pending_request.clear()
	_cancel_active = not _active_request.is_empty()
	var active := not _active_request.is_empty()
	_mutex.unlock()
	return {"ok": true, "status": "cancellation_requested" if active else "idle"}


func is_active() -> bool:
	_mutex.lock()
	var active := not _active_request.is_empty()
	_mutex.unlock()
	return active


func resource_snapshot() -> Dictionary:
	_mutex.lock()
	var result := {
		"active_count": 0 if _active_request.is_empty() else 1,
		"pending_count": 0 if _pending_request.is_empty() else 1,
		"worker_handle_count": 1 if _thread != null else 0,
		"latest_epoch": _latest_epoch,
	}
	_mutex.unlock()
	return result


func _start(request: Dictionary) -> Dictionary:
	_thread = Thread.new()
	var start_error := _thread.start(_run_query.bind(request.duplicate(true)))
	if start_error != OK:
		_thread = null
		_mutex.lock()
		_active_request.clear()
		_mutex.unlock()
		return {"ok": false, "status": "worker_error", "error": "Scene-Arbeitsbereich konnte nicht geladen werden."}
	query_started.emit(request.duplicate(true))
	return {"ok": true, "status": "started", "epoch": request["epoch"]}


func _run_query(request: Dictionary) -> void:
	var registry := FileCampaignRegistry.new(_data_root)
	var registry_state: Dictionary = registry.load_state()
	var result: Dictionary
	var campaign_id := str(registry_state.get("active_campaign_id", ""))
	if not registry_state.get("ok", false):
		result = registry_state
	elif campaign_id.is_empty():
		result = {"ok": false, "status": "campaign_required", "error": "Wähle zuerst eine Campaign."}
	else:
		var store := FileCampaignStore.new(_data_root, campaign_id)
		var campaign_state := store.load_state()
		if not campaign_state.get("ok", false):
			result = campaign_state
		else:
			result = _project(store, campaign_state, registry_state, request)
			if result.get("ok", false):
				var confirmed_registry := registry.load_state()
				var confirmed_campaign := store.load_state()
				if (
					not confirmed_registry.get("ok", false)
					or confirmed_registry.get("active_campaign_id", "") != campaign_id
					or int(confirmed_registry.get("generation", -1)) != int(registry_state.get("generation", -2))
					or int(confirmed_registry.get("shared_definitions_generation", -1)) != int(registry_state.get("shared_definitions_generation", -2))
					or not confirmed_campaign.get("ok", false)
					or int(confirmed_campaign.get("generation", -1)) != int(campaign_state.get("generation", -2))
				):
					result = {"ok": false, "status": "stale", "error": "Campaign änderte sich während der Scene-Abfrage."}
				else:
					result["campaign_id"] = campaign_id
					result["campaign_generation"] = campaign_state["generation"]
	result["epoch"] = request["epoch"]
	call_deferred("_finish_on_main", result)


func _project(store, campaign_state: Dictionary, registry_state: Dictionary, request: Dictionary) -> Dictionary:
	var scene_model := SceneKnowledge.new()
	var scene_read: Dictionary = store.read_partition(SceneKnowledge.OWNER, campaign_state)
	if not scene_read.get("ok", false):
		return scene_read
	var scene_payload: Dictionary = scene_read.get("payload", scene_model.empty_payload())
	var scene_snapshot := scene_model.snapshot(scene_payload)
	if not scene_snapshot.get("ok", false):
		return scene_snapshot
	if _cancelled_from_worker():
		return _cancelled_result()
	var party_model := PartyRoster.new()
	var party_read: Dictionary = store.read_partition(PartyRoster.OWNER, campaign_state)
	if not party_read.get("ok", false):
		return party_read
	var party_snapshot := party_model.snapshot(
		party_read.get("payload", party_model.empty_payload()),
		"",
		false,
		PartyRoster.MAX_SEARCH_PAGE_SIZE,
		Callable(self, "_cancelled_from_worker")
	)
	if not party_snapshot.get("ok", false):
		return party_snapshot
	var world_model := WorldPlannerKnowledge.new()
	var world_read: Dictionary = store.read_partition(WorldPlannerKnowledge.OWNER, campaign_state)
	if not world_read.get("ok", false):
		return world_read
	var world_validation := world_model.validate_payload(world_read.get("payload", world_model.empty_payload()))
	if not world_validation.get("ok", false):
		return world_validation
	var encounter_model := EncounterPlanKnowledge.new()
	var encounter_read: Dictionary = store.read_partition(EncounterPlanKnowledge.OWNER, campaign_state)
	if not encounter_read.get("ok", false):
		return encounter_read
	var encounter_validation := encounter_model.validate_payload(encounter_read.get("payload", encounter_model.empty_payload()))
	if not encounter_validation.get("ok", false):
		return encounter_validation
	var creature_metadata := SharedDefinitionStore.new(_data_root).query_catalog(
		int(registry_state.get("shared_definitions_generation", 0)),
		"creature",
		str(request["search_text"]),
		0,
		200,
		"name",
		true,
		Callable(self, "_cancelled_from_worker")
	)
	if not creature_metadata.get("ok", false):
		return creature_metadata
	var creature_ids: Array = []
	for row in creature_metadata["rows"]:
		creature_ids.append(str(row["definition_id"]))
	var creature_definitions := SharedDefinitionStore.new(_data_root).definitions_for_refs(
		creature_ids,
		int(registry_state.get("shared_definitions_generation", 0)),
		Callable(self, "_cancelled_from_worker")
	)
	if not creature_definitions.get("ok", false):
		return creature_definitions
	var creature_choices: Array = []
	for definition in creature_definitions["definitions"]:
		if _valid_combat_definition(definition):
			creature_choices.append({
				"definition_id": definition["definition_id"],
				"name": definition["name"],
				"challenge_rating": definition["content"]["challenge_rating"],
			})
	var labels := _creature_labels(scene_snapshot["scenes"], int(registry_state.get("shared_definitions_generation", 0)))
	if not labels.get("ok", false):
		return labels
	var projected_scenes := _project_scenes(
		scene_snapshot["scenes"],
		party_snapshot["active"],
		world_validation["payload"]["records"],
		labels["labels"],
		encounter_validation["payload"]
	)
	var focused: Dictionary = {}
	for scene in projected_scenes:
		if scene["scene_id"] == scene_snapshot["focused_scene_id"]:
			focused = scene.duplicate(true)
			break
	var assigned_npc := {}
	for id in scene_snapshot["assigned_npc_ids"]:
		assigned_npc[id] = true
	var needle := str(request["search_text"]).to_lower()
	return {
		"ok": true,
		"status": "ready",
		"revision": scene_snapshot["revision"],
		"focused_scene_id": scene_snapshot["focused_scene_id"],
		"primary_scene_id": scene_snapshot["primary_scene_id"],
		"scenes": projected_scenes,
		"focused": focused,
		"unassigned_npcs": _world_choices(world_validation["payload"]["records"], "npc", assigned_npc, needle),
		"location_choices": _world_choices(world_validation["payload"]["records"], "place", {}, needle),
		"creature_choices": creature_choices,
		"search_text": request["search_text"],
		"source_revision": scene_snapshot["revision"],
	}


func _project_scenes(
	scenes: Array,
	active_party: Array,
	world_records: Dictionary,
	creature_labels: Dictionary,
	encounter_payload: Dictionary
) -> Array:
	var party_by_id := {}
	for member in active_party:
		party_by_id[str(member["character_id"])] = member
	var result: Array = []
	for value in scenes:
		var scene: Dictionary = value.duplicate(true)
		var party_rows: Array = []
		for id in scene["party_member_ids"]:
			party_rows.append(party_by_id.get(id, {"character_id": id, "name": "%s · fehlt" % id, "level": null}).duplicate(true))
		var npc_rows: Array = []
		for id in scene["npc_ids"]:
			var record: Dictionary = world_records.get(id, {})
			npc_rows.append({
				"npc_id": id,
				"name": str(record.get("name", "%s · fehlt" % id)),
				"creature_id": str(record.get("creature_id", "")),
				"lifecycle_status": str(record.get("lifecycle_status", "missing")),
			})
		var mob_rows: Array = []
		for mob in scene["mobs"]:
			mob_rows.append({
				"assignment_id": mob["assignment_id"],
				"creature_id": mob["creature_id"],
				"name": creature_labels.get(mob["creature_id"], "%s · fehlt" % mob["creature_id"]),
				"count": mob["count"],
			})
		var location: Dictionary = world_records.get(scene["location_id"], {})
		var context_id := SceneKnowledge.new().encounter_context_id(str(scene["scene_id"]))
		var encounter := EncounterRuntimeKnowledge.new().snapshot(encounter_payload, context_id)
		scene["party_members"] = party_rows
		scene["npcs"] = npc_rows
		scene["mob_rows"] = mob_rows
		scene["location_name"] = "Kein Ort" if scene["location_id"].is_empty() else str(location.get("name", "%s · fehlt" % scene["location_id"]))
		scene["display_name"] = _scene_display_name(scene, party_rows)
		scene["encounter_context_id"] = context_id
		scene["encounter"] = encounter.get("context", EncounterRuntimeKnowledge.new().empty_context(context_id))
		result.append(scene)
	return result


func _creature_labels(scenes: Array, generation: int) -> Dictionary:
	var ids: Array = []
	var seen := {}
	for scene in scenes:
		for mob in scene["mobs"]:
			var id := str(mob["creature_id"])
			if not seen.has(id):
				seen[id] = true
				ids.append(id)
	if ids.is_empty():
		return {"ok": true, "labels": {}}
	return SharedDefinitionStore.new(_data_root).reference_labels(
		ids, generation, "creature", Callable(self, "_cancelled_from_worker")
	)


func _valid_combat_definition(value: Variant) -> bool:
	if not value is Dictionary or not value.get("content", null) is Dictionary:
		return false
	var content: Dictionary = value["content"]
	return (
		content.get("challenge_rating", null) is String
		and not str(content["challenge_rating"]).strip_edges().is_empty()
		and _positive_integer(content.get("xp", null))
		and _nonnegative_integer(content.get("hit_points", null))
		and _nonnegative_integer(content.get("armor_class", null))
		and _integer(content.get("initiative_bonus", null))
	)


func _integer(value: Variant) -> bool:
	return (value is int or value is float) and is_finite(float(value)) and is_equal_approx(float(value), roundf(float(value)))


func _nonnegative_integer(value: Variant) -> bool:
	return _integer(value) and int(value) >= 0


func _positive_integer(value: Variant) -> bool:
	return _integer(value) and int(value) > 0


func _scene_display_name(scene: Dictionary, party_rows: Array) -> String:
	if bool(scene.get("primary", false)):
		return "Hauptgruppe"
	var names: Array[String] = []
	for member in party_rows:
		names.append(str(member["name"]))
	return "Teilgruppe · %s" % ", ".join(names)


func _world_choices(records: Dictionary, kind: String, assigned: Dictionary, needle: String) -> Array:
	var rows: Array = []
	for id_value in records:
		var id := str(id_value)
		var record: Dictionary = records[id_value]
		if record["kind"] != kind or assigned.has(id):
			continue
		if kind == "npc" and record.get("lifecycle_status", "") != "active":
			continue
		if not needle.is_empty() and not str(record["name"]).to_lower().contains(needle):
			continue
		rows.append({"reference_id": id, "name": record["name"]})
	rows.sort_custom(func(left: Dictionary, right: Dictionary) -> bool:
		var order := str(left["name"]).naturalnocasecmp_to(str(right["name"]))
		return str(left["reference_id"]) < str(right["reference_id"]) if order == 0 else order < 0
	)
	if rows.size() > 200:
		rows.resize(200)
	return rows


func _cancelled_from_worker() -> bool:
	_mutex.lock()
	var cancelled := _cancel_active
	_mutex.unlock()
	return cancelled


func _cancelled_result() -> Dictionary:
	return {"ok": false, "status": "cancelled", "error": "Scene-Abfrage wurde ersetzt."}


func _finish_on_main(result: Dictionary) -> void:
	if _thread != null:
		_thread.wait_to_finish()
		_thread = null
	_mutex.lock()
	var finished_epoch := int(_active_request.get("epoch", -1))
	var publish := finished_epoch == _latest_epoch and int(result.get("epoch", -2)) == finished_epoch
	_active_request.clear()
	_cancel_active = false
	var next_request: Dictionary = _pending_request.duplicate(true)
	_pending_request.clear()
	if not next_request.is_empty():
		_active_request = next_request
	_mutex.unlock()
	if publish:
		result_published.emit(result.duplicate(true))
	if not next_request.is_empty():
		_start(next_request)


func _exit_tree() -> void:
	cancel_all()
	if _thread != null:
		_thread.wait_to_finish()
		_thread = null
