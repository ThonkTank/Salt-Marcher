extends SceneTree

const FileCampaignRegistry = preload("res://godot/src/platform/persistence/file_campaign_registry.gd")
const FileCampaignStore = preload("res://godot/src/platform/persistence/file_campaign_store.gd")
const CampaignRuntimeCoordinator = preload("res://godot/src/app/campaign_runtime_coordinator.gd")
const EncounterPlanKnowledge = preload("res://godot/src/features/encounter/encounter_plan_knowledge.gd")
const EncounterRuntimeKnowledge = preload("res://godot/src/features/encounter/encounter_runtime_knowledge.gd")
const PartyRoster = preload("res://godot/src/features/party/party_roster.gd")
const MainShell = preload("res://godot/src/ui/main_shell.gd")
const EncounterRuntimeWorkspace = preload("res://godot/src/ui/encounter_runtime_workspace.gd")

var _data_root := "user://saltmarcher-render-encounter/%s" % Time.get_ticks_usec()
var _output_path := "/tmp/saltmarcher-encounter-builder.png"


func _init() -> void:
	for argument in OS.get_cmdline_user_args():
		if argument.begins_with("--data-root="):
			_data_root = argument.trim_prefix("--data-root=")
		elif argument.begins_with("--output="):
			_output_path = argument.trim_prefix("--output=")
	call_deferred("_render")


func _render() -> void:
	root.size = Vector2i(1366, 768)
	var fixture := _prepare_fixture()
	if not fixture.get("ok", false):
		push_error("Encounter-Render-Fixture fehlgeschlagen: %s" % fixture.get("error", "Unbekannter Fehler"))
		quit(1)
		return
	var registry: FileCampaignRegistry = fixture["registry"]
	var runtime_coordinator := CampaignRuntimeCoordinator.new(_data_root, registry)
	var opened := runtime_coordinator.open_durable_active()
	if not opened.get("ok", false):
		push_error("Encounter-Render-Campaign konnte nicht geöffnet werden.")
		quit(1)
		return
	var shell := MainShell.new()
	shell.data_root = _data_root
	shell.registry = registry
	shell.runtime_coordinator = runtime_coordinator
	root.add_child(shell)
	await process_frame
	shell.show_route("encounter")
	var encounter := shell.route("encounter") as EncounterRuntimeWorkspace
	for _attempt in 1800:
		if encounter.snapshot().get("status", "") in ["ready", "empty", "unavailable", "incompatible", "failed"]:
			break
		await create_timer(0.001).timeout
	encounter.set("_tuning_expanded", true)
	encounter.call("_render")
	await process_frame
	await process_frame
	var error := root.get_texture().get_image().save_png(_output_path)
	if error != OK:
		push_error("Encounter-Builder-Render konnte nicht gespeichert werden: %d" % error)
		quit(1)
		return
	print("Encounter-Builder-Render: %s" % _output_path)
	quit(0)


func _prepare_fixture() -> Dictionary:
	var registry := FileCampaignRegistry.new(_data_root)
	var created := registry.create_campaign("Sturm über Grauhafen")
	if not created.get("ok", false):
		return created
	var campaign_id := str(created["campaign_id"])
	var store := FileCampaignStore.new(_data_root, campaign_id)
	var state := store.load_state()
	if not state.get("ok", false):
		return state

	var party_model := PartyRoster.new()
	var party_payload := party_model.empty_payload()
	var names := ["Iria", "Tamo", "Mara", "Borin"]
	for index in names.size():
		var character_id := "pc.render.%d" % (index + 1)
		var added := party_model.create_character(
			party_payload,
			names[index],
			{"level": 4 if index < 2 else 3},
			character_id,
			"2026-07-28T18:00:0%dZ" % index
		)
		party_payload = added.get("payload", party_payload)
		party_payload = party_model.set_membership(
			party_payload, character_id, "active", "2026-07-28T18:01:0%dZ" % index
		).get("payload", party_payload)

	var plan_model := EncounterPlanKnowledge.new()
	var encounter_payload: Dictionary = plan_model.create_plan(
		plan_model.empty_payload(),
		"Wache am Nordkai",
		[
			{"creature_id": "creature.wolf", "quantity": 3, "last_known_name": "Wolf"},
			{"creature_id": "creature.worg", "quantity": 1, "last_known_name": "Worg"},
		],
		"encounter_plan.render",
		"2026-07-28T18:02:00Z"
	).get("payload", plan_model.empty_payload())
	var runtime_model := EncounterRuntimeKnowledge.new()
	encounter_payload = runtime_model.open_saved_plan(
		encounter_payload,
		"encounter_plan.render",
		[
			{
				"creature_id": "creature.wolf", "name": "Wolf", "last_known_name": "Wolf",
				"quantity": 3, "challenge_rating": "1/4", "xp": 50, "hit_points": 11,
				"armor_class": 12, "initiative_bonus": 2,
			},
			{
				"creature_id": "creature.worg", "name": "Worg", "last_known_name": "Worg",
				"quantity": 1, "challenge_rating": "1/2", "xp": 100, "hit_points": 26,
				"armor_class": 13, "initiative_bonus": 1,
			},
		]
	).get("payload", encounter_payload)
	var render_tuning := runtime_model.default_tuning()
	render_tuning["difficulty"] = "MEDIUM"
	render_tuning["seed"] = "grauhafen"
	encounter_payload = runtime_model.update_tuning(encounter_payload, render_tuning).get("payload", encounter_payload)
	encounter_payload = runtime_model.update_source_filters(encounter_payload, {
		"encounter_table_ids": ["encounter_table.harbor", "encounter_table.docks"],
		"faction_ids": ["faction.harbor"],
		"location_id": "place.gray-harbor",
	}).get("payload", encounter_payload)
	encounter_payload = runtime_model.apply_generated_alternatives(
		encounter_payload,
		[
			{
				"alternative_id": "1".repeat(64), "label": "Vorschlag 1 · Mittel",
				"roster": [
					{"creature_id": "creature.wolf", "name": "Wolf", "last_known_name": "Wolf", "quantity": 4, "challenge_rating": "1/4", "xp": 50, "hit_points": 11, "armor_class": 12, "initiative_bonus": 2},
					{"creature_id": "creature.worg", "name": "Worg", "last_known_name": "Worg", "quantity": 2, "challenge_rating": "1/2", "xp": 100, "hit_points": 26, "armor_class": 13, "initiative_bonus": 1},
				],
				"summary": {"base_xp": 400, "adjusted_xp": 800, "difficulty": "MEDIUM", "creature_count": 6, "species_count": 2},
				"highlights": ["2 Arten · 6 Gegner", "Zielband 800–1199 angepasste XP", "STANDARD · EVEN · MEDIUM"],
			},
			{
				"alternative_id": "2".repeat(64), "label": "Vorschlag 2 · Mittel",
				"roster": [
					{"creature_id": "creature.wolf", "name": "Wolf", "last_known_name": "Wolf", "quantity": 2, "challenge_rating": "1/4", "xp": 50, "hit_points": 11, "armor_class": 12, "initiative_bonus": 2},
					{"creature_id": "creature.worg", "name": "Worg", "last_known_name": "Worg", "quantity": 3, "challenge_rating": "1/2", "xp": 100, "hit_points": 26, "armor_class": 13, "initiative_bonus": 1},
				],
				"summary": {"base_xp": 400, "adjusted_xp": 800, "difficulty": "MEDIUM", "creature_count": 5, "species_count": 2},
				"highlights": ["2 Arten · 5 Gegner", "Zielband 800–1199 angepasste XP", "STANDARD · EVEN · MEDIUM"],
			},
		],
		{
			"requested_difficulty": "MEDIUM", "resolved_difficulty": "MEDIUM",
			"resolved_amount": "STANDARD", "resolved_balance": "EVEN", "resolved_diversity": "MEDIUM",
			"solution_quality": "EXACT", "stop_category": "EXACT_OPTIONS_READY",
				"candidate_pool_size": 57, "attempt_count": 18420, "candidate_evaluation_count": 18420,
				"target_min_xp": 800, "target_max_xp": 1199,
				"source_mode": "GROUPED", "source_table_count": 2, "source_faction_count": 1,
				"source_location_selected": true, "loot_conflict": true,
			}
	).get("payload", encounter_payload)
	var committed := store.commit(
		int(state["generation"]),
		{PartyRoster.OWNER: party_payload, EncounterPlanKnowledge.OWNER: encounter_payload},
		state["runtime"]
	)
	if not committed.get("ok", false):
		return committed
	return {"ok": true, "registry": registry}
