class_name SessionPreparationCoordinator
extends Node

## Bounded generate -> durable run -> durable Encounter batch -> final Session cutover workflow.

const FileCampaignRegistry = preload("res://godot/src/platform/persistence/file_campaign_registry.gd")
const FileCampaignStore = preload("res://godot/src/platform/persistence/file_campaign_store.gd")
const SharedDefinitionStore = preload("res://godot/src/platform/persistence/shared_definition_store.gd")
const SessionPlanKnowledge = preload("res://godot/src/features/sessionplanner/session_plan_knowledge.gd")
const SessionPreparationPolicy = preload("res://godot/src/features/sessionplanner/session_preparation_policy.gd")
const PartyRoster = preload("res://godot/src/features/party/party_roster.gd")
const EncounterPlanKnowledge = preload("res://godot/src/features/encounter/encounter_plan_knowledge.gd")
const EncounterGenerationPolicy = preload("res://godot/src/features/encounter/encounter_generation_policy.gd")
const SessionGenerationCatalog = preload("res://godot/src/features/sessiongeneration/session_generation_catalog.gd")
const SessionGenerationEngine = preload("res://godot/src/features/sessiongeneration/session_generation_engine.gd")
const SessionGenerationRewardPolicy = preload("res://godot/src/features/sessiongeneration/session_generation_reward_policy.gd")
const SessionGenerationRunKnowledge = preload("res://godot/src/features/sessiongeneration/session_generation_run_knowledge.gd")

signal progress_changed(stage: String, message: String)
signal completed(result: Dictionary)

var _data_root: String
var _runtime_coordinator
var _thread: Thread
var _mutex := Mutex.new()
var _active := false
var _cancel_requested := false
var _prepared: Dictionary = {}
var _campaign_state: Dictionary = {}
var _activation_generation := 0
var _ticket_id := ""
var _ticket_session
var _commit_stage := ""
var _point_of_no_return := false


func _init(data_root: String, runtime_coordinator) -> void:
	_data_root = data_root.trim_suffix("/")
	_runtime_coordinator = runtime_coordinator
	set_process(false)


func start(session_id: String, revision: int, encounter_count: Variant, seed: int) -> Dictionary:
	if busy():
		return {"ok": false, "status": "busy", "error": "Eine Session-Vorbereitung läuft bereits."}
	if _runtime_coordinator == null or _runtime_coordinator.current_session() == null:
		return {"ok": false, "status": "campaign_required", "error": "Wähle zuerst eine Campaign."}
	var runtime_session = _runtime_coordinator.current_session()
	var snapshot: Dictionary = runtime_session.snapshot()
	if not snapshot.get("admitted", false):
		return {"ok": false, "status": "revoked", "error": "Die aktive Campaign wird gerade gewechselt."}
	_mutex.lock()
	_active = true
	_cancel_requested = false
	_mutex.unlock()
	_activation_generation = int(snapshot["activation_generation"])
	_campaign_state = snapshot["campaign_state"].duplicate(true)
	var request := {
		"campaign_id": snapshot["campaign_id"],
		"session_id": session_id,
		"revision": revision,
		"encounter_count": encounter_count,
		"seed": seed,
		"campaign_state": _campaign_state.duplicate(true),
	}
	_thread = Thread.new()
	var error := _thread.start(_prepare_on_worker.bind(request))
	if error != OK:
		_thread = null
		_reset()
		return {"ok": false, "status": "worker_error", "error": "Session-Vorbereitung konnte nicht gestartet werden."}
	progress_changed.emit("preparing", "Katalog, Encounter und Belohnungen werden vorbereitet …")
	return {"ok": true, "status": "started"}


func cancel() -> Dictionary:
	_mutex.lock()
	var was_active := _active
	var too_late := was_active and _point_of_no_return
	_cancel_requested = was_active and not too_late
	_mutex.unlock()
	if too_late:
		return {"ok": true, "status": "point_of_no_return"}
	if was_active:
		progress_changed.emit("cancelling", "Vorbereitung wird nach dem sicheren Grenzpunkt abgebrochen …")
	return {"ok": true, "status": "cancellation_requested" if was_active else "idle"}


func cancellable() -> bool:
	_mutex.lock()
	var value := _active and not _point_of_no_return
	_mutex.unlock()
	return value


func busy() -> bool:
	_mutex.lock()
	var value := _active
	_mutex.unlock()
	return value


func resource_snapshot() -> Dictionary:
	return {
		"active_count": 1 if busy() else 0,
		"worker_handle_count": 1 if _thread != null else 0,
		"ticket_count": 0 if _ticket_id.is_empty() else 1,
		"stage": _commit_stage,
	}


func _prepare_on_worker(request: Dictionary) -> void:
	var store := FileCampaignStore.new(_data_root, str(request["campaign_id"]))
	var state: Dictionary = request["campaign_state"]
	var session_read := store.read_partition(SessionPlanKnowledge.OWNER, state)
	var party_read := store.read_partition(PartyRoster.OWNER, state)
	var encounter_read := store.read_partition(EncounterPlanKnowledge.OWNER, state)
	var generation_read := store.read_partition(SessionGenerationRunKnowledge.OWNER, state)
	var reads := [session_read, party_read, encounter_read, generation_read]
	for read in reads:
		if not read.get("ok", false):
			_finish_worker(read)
			return
	if _cancelled_from_worker():
		_finish_worker(_cancelled_result())
		return
	var session_model := SessionPlanKnowledge.new()
	var session_validation := session_model.validate_payload(session_read.get("payload", session_model.empty_payload()))
	var party_model := PartyRoster.new()
	var party_validation := party_model.validate_payload(party_read.get("payload", party_model.empty_payload()))
	if not session_validation.get("ok", false):
		_finish_worker(session_validation)
		return
	if not party_validation.get("ok", false):
		_finish_worker(party_validation)
		return
	var session_id := str(request["session_id"])
	if not session_validation["payload"]["records"].has(session_id):
		_finish_worker(_failure("missing", "Die zu generierende Session fehlt."))
		return
	var source_session: Dictionary = session_validation["payload"]["records"][session_id]
	if int(source_session["revision"]) != int(request["revision"]):
		_finish_worker(_failure("stale", "Die Session wurde vor Beginn der Vorbereitung geändert."))
		return
	var levels: Array = []
	var counts := {}
	for participant_id_value in source_session["participant_ids"]:
		var participant_id := str(participant_id_value)
		if not party_validation["payload"]["characters"].has(participant_id):
			_finish_worker(_failure("UNRESOLVABLE", "Ein Charakter der Planungsgruppe fehlt."))
			return
		var character: Dictionary = party_validation["payload"]["characters"][participant_id]
		if character.get("level", null) == null:
			_finish_worker(_failure("UNRESOLVABLE", "Jedes Mitglied der Planungsgruppe braucht eine Stufe."))
			return
		var level := int(character["level"])
		levels.append(level)
		counts[level] = int(counts.get(level, 0)) + 1
	if levels.is_empty():
		_finish_worker(_failure("UNRESOLVABLE", "Generation braucht eine Planungsgruppe."))
		return
	levels.sort()
	var party_rows: Array = []
	for level in range(1, 21):
		if counts.has(level):
			party_rows.append({"level": level, "count": counts[level]})
	var policy := SessionPreparationPolicy.new()
	var preparation_id := policy.preparation_id(
		session_id, int(source_session["revision"]), levels,
		int(source_session["encounter_days_units"]), request["encounter_count"], int(request["seed"])
	)
	var catalog_result := SessionGenerationCatalog.new().load()
	if not catalog_result.get("ok", false):
		_finish_worker(catalog_result)
		return
	var generation_stage := SessionGenerationEngine.new().generate_encounter_stage(
		preparation_id, party_rows, int(source_session["encounter_days_units"]),
		request["encounter_count"], int(request["seed"]), catalog_result["snapshot"], Callable(self, "_cancelled_from_worker")
	)
	if not generation_stage.get("ok", false):
		_finish_worker(generation_stage)
		return
	var completed_generation := SessionGenerationRewardPolicy.new().complete(
		generation_stage, catalog_result["snapshot"], Callable(self, "_cancelled_from_worker")
	)
	if not completed_generation.get("ok", false):
		_finish_worker(completed_generation)
		return
	var registry_state := FileCampaignRegistry.new(_data_root).load_state()
	if not registry_state.get("ok", false) or registry_state.get("active_campaign_id", "") != request["campaign_id"]:
		_finish_worker(_failure("stale", "Die aktive Campaign änderte sich während der Vorbereitung."))
		return
	var definitions := SharedDefinitionStore.new(_data_root).definitions_of_kind(
		int(registry_state.get("shared_definitions_generation", 0)), "creature", Callable(self, "_cancelled_from_worker")
	)
	if not definitions.get("ok", false):
		_finish_worker(definitions)
		return
	var run: Dictionary = completed_generation["run"]
	var batch_result := EncounterGenerationPolicy.new().prepare_batch(
		policy.encounter_source(run), policy.encounter_intents(run), levels,
		definitions["definitions"], Callable(self, "_cancelled_from_worker")
	)
	if not batch_result.get("ok", false):
		_finish_worker(batch_result)
		return
	var batch: Dictionary = batch_result["batch"]
	var assembled := policy.assemble(source_session, run, batch)
	if not assembled.get("ok", false):
		_finish_worker(assembled)
		return
	var run_model := SessionGenerationRunKnowledge.new()
	var run_change := run_model.commit_run(generation_read.get("payload", run_model.empty_payload()), run)
	if not run_change.get("ok", false):
		_finish_worker(run_change)
		return
	var encounter_model := EncounterPlanKnowledge.new()
	var encounter_change := encounter_model.commit_generated_batch(
		encounter_read.get("payload", encounter_model.empty_payload()), batch
	)
	if not encounter_change.get("ok", false):
		_finish_worker(encounter_change)
		return
	var session_change := session_model.commit_prepared_session(
		session_validation["payload"], assembled["prepared"], encounter_change["mappings"]
	)
	if not session_change.get("ok", false):
		_finish_worker(session_change)
		return
	_finish_worker({
		"ok": true,
		"status": "prepared",
		"run_change": run_change,
		"encounter_change": encounter_change,
		"session_change": session_change,
		"run_id": run["run_id"],
		"preparation_id": preparation_id,
		"scene_count": session_change["session"]["scenes"].size(),
		"reward_count": session_change["session"]["generated_rewards"].size(),
	})


func _finish_worker(result: Dictionary) -> void:
	call_deferred("_prepared_on_main", result)


func _prepared_on_main(result: Dictionary) -> void:
	_join_worker()
	if not result.get("ok", false):
		_finish(result)
		return
	if _is_cancel_requested():
		_finish(_cancelled_result())
		return
	_prepared = result
	_commit_stage = "run"
	_advance_commit()


func _advance_commit() -> void:
	if _is_cancel_requested():
		_finish(_cancelled_result())
		return
	match _commit_stage:
		"run":
			progress_changed.emit("commit_run", "Generation Run wird dauerhaft gesichert …")
			if _prepared["run_change"].get("no_write", false):
				_commit_stage = "encounters"
				_advance_commit()
			else:
				_submit_partition(SessionGenerationRunKnowledge.OWNER, _prepared["run_change"]["payload"])
		"encounters":
			progress_changed.emit("commit_encounters", "Generierte Encounter werden als vollständiger Batch gesichert …")
			if _prepared["encounter_change"].get("no_write", false):
				_commit_stage = "session"
				_advance_commit()
			else:
				_submit_partition(EncounterPlanKnowledge.OWNER, _prepared["encounter_change"]["payload"])
		"session":
			_mutex.lock()
			_point_of_no_return = true
			_mutex.unlock()
			progress_changed.emit("commit_session", "Vorbereiteter Ablauf ersetzt die Session atomar …")
			if _prepared["session_change"].get("no_write", false):
				_complete_success()
			else:
				_submit_partition(SessionPlanKnowledge.OWNER, _prepared["session_change"]["payload"])


func _submit_partition(owner: String, payload: Dictionary) -> void:
	var submitted: Dictionary = _runtime_coordinator.submit_current_commit(
		_activation_generation,
		int(_campaign_state["generation"]),
		{owner: payload},
		_campaign_state["runtime"]
	)
	if not submitted.get("ok", false):
		_finish(submitted)
		return
	_ticket_id = str(submitted["ticket_id"])
	_ticket_session = _runtime_coordinator.current_session()
	set_process(true)


func _process(_delta: float) -> void:
	if _ticket_id.is_empty():
		set_process(false)
		return
	var polled: Dictionary = _ticket_session.poll_commit(_ticket_id)
	if polled.get("status", "") == "pending":
		return
	set_process(false)
	_ticket_id = ""
	_ticket_session = null
	_runtime_coordinator.flush_backup_notifications()
	var result: Dictionary = polled.get("result", polled)
	if not result.get("ok", false):
		_finish(result)
		return
	_campaign_state = result["state"].duplicate(true)
	if _is_cancel_requested():
		_finish(_cancelled_result())
		return
	match _commit_stage:
		"run": _commit_stage = "encounters"
		"encounters": _commit_stage = "session"
		"session":
			_complete_success()
			return
	_advance_commit()


func _complete_success() -> void:
	_finish({
		"ok": true,
		"status": "SUCCESS",
		"run_id": _prepared["run_id"],
		"preparation_id": _prepared["preparation_id"],
		"scene_count": _prepared["scene_count"],
		"reward_count": _prepared["reward_count"],
		"campaign_generation": _campaign_state.get("generation", 0),
	})


func _finish(result: Dictionary) -> void:
	_reset()
	completed.emit(result.duplicate(true))


func _reset() -> void:
	set_process(false)
	_ticket_id = ""
	_ticket_session = null
	_prepared.clear()
	_campaign_state.clear()
	_commit_stage = ""
	_mutex.lock()
	_active = false
	_cancel_requested = false
	_point_of_no_return = false
	_mutex.unlock()


func _cancelled_from_worker() -> bool:
	return _is_cancel_requested()


func _is_cancel_requested() -> bool:
	_mutex.lock()
	var value := _cancel_requested
	_mutex.unlock()
	return value


func _cancelled_result() -> Dictionary:
	return {"ok": false, "status": "CANCELLED", "error": "Session-Vorbereitung wurde abgebrochen; vorhandene immutable Vorstufen bleiben unsichtbar und wiederverwendbar."}


func _failure(status: String, message: String) -> Dictionary:
	return {"ok": false, "status": status, "error": message}


func _join_worker() -> void:
	if _thread != null:
		_thread.wait_to_finish()
		_thread = null


func _exit_tree() -> void:
	cancel()
	_join_worker()
