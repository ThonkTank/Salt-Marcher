class_name CampaignBundle
extends RefCounted

## Streaming, current-format Campaign export/import without archive expansion.

const ImmutableJsonFiles = preload("res://godot/src/platform/persistence/immutable_json_files.gd")
const FileCampaignStore = preload("res://godot/src/platform/persistence/file_campaign_store.gd")
const SharedDefinitionStore = preload("res://godot/src/platform/persistence/shared_definition_store.gd")
const StorageCapacityGuard = preload("res://godot/src/platform/persistence/storage_capacity_guard.gd")

const FORMAT_ID := "saltmarcher.campaign-bundle.v1"
const IMPORT_OPERATION_FORMAT_ID := "saltmarcher.campaign-import-operation.v1"
const MAGIC := "SALTMARCHER-BUNDLE-1\n"
const CHUNK_SIZE := 1024 * 1024
const MAX_MANIFEST_BYTES := 256 * 1024 * 1024
const MAX_FILE_COUNT := 2_000_000
const MAX_SHARED_DEFINITION_COUNT := 1_000_000
const MAX_SAFE_BYTES := 0x3fffffffffffffff

var _data_root: String
var _registry
var _files: ImmutableJsonFiles
var _capacity_guard
var _definition_store: SharedDefinitionStore
var _progress_callback: Callable
var _cancellation_callback: Callable


func _init(data_root: String, registry, capacity_guard = null) -> void:
	_data_root = data_root.trim_suffix("/")
	_registry = registry
	_capacity_guard = capacity_guard if capacity_guard != null else StorageCapacityGuard.new()
	_files = ImmutableJsonFiles.new(Callable(), _capacity_guard)
	_definition_store = SharedDefinitionStore.new(_data_root, Callable(), _capacity_guard)


func export_campaign(
	campaign_id: String,
	destination_path: String,
	progress_callback: Callable = Callable(),
	cancellation_callback: Callable = Callable()
) -> Dictionary:
	_set_observers(progress_callback, cancellation_callback)
	_emit_progress("validating", 0, 1, "Campaign wird für den Export geprüft.")
	if _is_cancelled():
		return _cancelled_failure()
	var store := FileCampaignStore.new(_data_root, campaign_id)
	var state := store.load_state()
	if not state.get("ok", false):
		return _failure("Campaign kann nicht vollständig exportiert werden: %s" % state.get("error", "unbekannter Fehler"))
	var binary_validation := store.validate_binary_closure(state)
	if not binary_validation.get("ok", false):
		return _failure("Campaign kann nicht vollständig exportiert werden: Asset- oder Chunk-Closure ist beschädigt.")
	var registry_state: Dictionary = _registry.load_state()
	if not registry_state.get("ok", false):
		return _failure("Installationweite Referenzen können nicht vollständig exportiert werden.")
	var definition_generation := int(registry_state.get("shared_definitions_generation", 0))
	var required_definitions := _definition_store.definitions_for_refs(
		state.get("shared_definition_refs", []),
		definition_generation
	)
	if not required_definitions.get("ok", false):
		return _failure("Campaign verweist auf eine fehlende oder beschädigte Shared Definition.")
	var absolute_destination := _files.absolute(destination_path)
	var absolute_campaign := _files.absolute(store.campaign_directory())
	if absolute_destination == absolute_campaign or absolute_destination.begins_with(absolute_campaign + "/"):
		return _failure("Ein Campaign-Export darf nicht in seine eigene Datenwurzel geschrieben werden.")
	if FileAccess.file_exists(absolute_destination) or DirAccess.dir_exists_absolute(absolute_destination):
		return _failure("Das Exportziel existiert bereits.")
	var parent := absolute_destination.get_base_dir()

	var inventory := _inventory(absolute_campaign)
	if not inventory.get("ok", false):
		return inventory
	if _is_cancelled():
		return _cancelled_failure()
	var identity: Dictionary = state["identity"]
	var payload := {
		"source_campaign_id": campaign_id,
		"name": identity["name"],
		"created_at_utc": identity["created_at_utc"],
		"campaign_generation": str(state["generation"]),
		"exported_at_utc": Time.get_datetime_string_from_system(true),
		"shared_definitions": required_definitions["definitions"],
		"files": inventory["files"],
	}
	var manifest := {
		"format": FORMAT_ID,
		"payload": payload,
		"payload_sha256": _files.checksum(payload),
	}
	var manifest_bytes := (JSON.stringify(manifest, "", true, true) + "\n").to_utf8_buffer()
	if manifest_bytes.size() > MAX_MANIFEST_BYTES:
		return _failure("Exportmanifest überschreitet die zulässige Größe.")
	var declared_output_bytes := MAGIC.to_utf8_buffer().size() + 8 + manifest_bytes.size()
	for entry in inventory["files"]:
		declared_output_bytes += 4 + str(entry["path"]).to_utf8_buffer().size() + 8 + str(entry["size"]).to_int()
	var admission: Dictionary = _capacity_guard.admit(destination_path, declared_output_bytes)
	if not admission.get("ok", false):
		return admission
	var parent_error := DirAccess.make_dir_recursive_absolute(parent)
	if parent_error != OK:
		return _failure("Exportziel konnte nicht vorbereitet werden.")

	var temporary_path := absolute_destination + ".pending-%s" % _files.new_identity()
	var output := FileAccess.open(temporary_path, FileAccess.WRITE)
	if output == null:
		return _failure("Exportdatei konnte nicht geöffnet werden.")
	output.store_buffer(MAGIC.to_utf8_buffer())
	output.store_64(manifest_bytes.size())
	output.store_buffer(manifest_bytes)
	var exported_file_count := 0
	for entry in inventory["files"]:
		if _is_cancelled():
			output.close()
			DirAccess.remove_absolute(temporary_path)
			return _cancelled_failure()
		var relative_path := str(entry["path"])
		var path_bytes := relative_path.to_utf8_buffer()
		output.store_32(path_bytes.size())
		output.store_buffer(path_bytes)
		output.store_64(str(entry["size"]).to_int())
		var copy := _copy_file_into_bundle(
			absolute_campaign + "/" + relative_path,
			output,
			str(entry["sha256"])
		)
		if not copy.get("ok", false):
			output.close()
			DirAccess.remove_absolute(temporary_path)
			return copy
		exported_file_count += 1
		_emit_progress(
			"writing",
			exported_file_count,
			inventory["files"].size(),
			"Campaign-Dateien werden in das Transferpaket geschrieben."
		)
	var closing_inventory := _inventory(absolute_campaign)
	var closing_registry: Dictionary = _registry.load_state()
	if (
		not closing_inventory.get("ok", false)
		or _files.canonical_json(closing_inventory["files"]) != _files.canonical_json(inventory["files"])
		or not closing_registry.get("ok", false)
		or int(closing_registry.get("shared_definitions_generation", -1)) != definition_generation
	):
		output.close()
		DirAccess.remove_absolute(temporary_path)
		return _failure("Campaign oder Shared Definitions wurden während des Exports verändert; Export wurde verworfen.")
	if _is_cancelled():
		output.close()
		DirAccess.remove_absolute(temporary_path)
		return _cancelled_failure()
	output.flush()
	var write_error := output.get_error()
	output.close()
	if write_error != OK:
		DirAccess.remove_absolute(temporary_path)
		return _failure("Exportdatei konnte nicht vollständig geschrieben werden.")
	var rename_error := DirAccess.rename_absolute(temporary_path, absolute_destination)
	if rename_error != OK:
		DirAccess.remove_absolute(temporary_path)
		return _failure("Exportdatei konnte nicht veröffentlicht werden.")
	_emit_progress("completed", 1, 1, "Campaign-Export ist vollständig geschrieben.")
	return {
		"ok": true,
		"status": "exported",
		"path": destination_path,
		"file_count": inventory["files"].size(),
		"shared_definition_count": required_definitions["definitions"].size(),
		"payload_bytes": inventory["total_bytes"],
	}


func import_campaign(
	bundle_path: String,
	expected_registry_generation: int,
	progress_callback: Callable = Callable(),
	cancellation_callback: Callable = Callable()
) -> Dictionary:
	_set_observers(progress_callback, cancellation_callback)
	_emit_progress("validating", 0, 1, "Transferpaket wird geprüft.")
	if _is_cancelled():
		return _cancelled_failure()
	var staged := _stage_and_validate_bundle(bundle_path, "import")
	if not staged.get("ok", false):
		return staged
	var current: Dictionary = _registry.load_state()
	if not current.get("ok", false):
		_remove_tree(_files.absolute(staged["staging_root"]))
		return current
	if int(current["generation"]) != expected_registry_generation:
		_remove_tree(_files.absolute(staged["staging_root"]))
		return _stale_import(current)
	var plan := _plan_shared_definitions(staged, current, {})
	if not plan.get("ok", false):
		_remove_tree(_files.absolute(staged["staging_root"]))
		return plan
	if not plan["conflicts"].is_empty():
		var operation := _persist_import_operation(staged, current, plan["conflicts"])
		if not operation.get("ok", false):
			_remove_tree(_files.absolute(staged["staging_root"]))
			return operation
		return {
			"ok": false,
			"status": "definition_conflicts",
			"error": "Shared-Definition-Konflikte benötigen eine ausdrückliche Entscheidung.",
			"import_id": staged["operation_id"],
			"conflicts": plan["conflicts"],
			"choices": ["keep_existing", "use_imported", "retain_both"],
		}
	return _complete_staged_import(staged, current, {})


func resolve_import(
	import_id: String,
	expected_registry_generation: int,
	decisions: Dictionary,
	progress_callback: Callable = Callable(),
	cancellation_callback: Callable = Callable()
) -> Dictionary:
	_set_observers(progress_callback, cancellation_callback)
	_emit_progress("resolving", 0, 1, "Konfliktentscheidungen werden geprüft.")
	if _is_cancelled():
		return _cancelled_failure()
	var operation := _read_import_operation(import_id)
	if not operation.get("ok", false):
		return operation
	var current: Dictionary = _registry.load_state()
	if not current.get("ok", false):
		return current
	if int(current["generation"]) != expected_registry_generation:
		return _stale_import(current)
	var payload: Dictionary = operation["payload"]
	if int(payload["expected_registry_generation"]) != expected_registry_generation:
		return _failure("Der staged Import gehört nicht mehr zum aktuellen Installationsstand.")
	var conflicts: Array = payload["conflicts"]
	if decisions.size() != conflicts.size():
		return _failure("Für jeden Shared-Definition-Konflikt ist genau eine Entscheidung erforderlich.")
	for conflict in conflicts:
		var definition_id := str(conflict["definition_id"])
		var choice := str(decisions.get(definition_id, ""))
		if choice not in ["keep_existing", "use_imported", "retain_both"]:
			return _failure("Ungültige oder fehlende Konfliktentscheidung für %s." % definition_id)
	var staged := {
		"payload": payload["bundle_payload"],
		"staging_root": payload["staging_root"],
		"staged_campaign": payload["staged_campaign"],
		"operation_id": import_id,
	}
	return _complete_staged_import(staged, current, decisions)


func discard_import(import_id: String) -> Dictionary:
	var operation := _read_import_operation(import_id)
	if not operation.get("ok", false):
		return operation
	var staging_root := str(operation["payload"]["staging_root"])
	_remove_tree(_files.absolute(staging_root))
	return {"ok": true, "status": "import_discarded", "import_id": import_id}


func _complete_staged_import(staged: Dictionary, current: Dictionary, decisions: Dictionary) -> Dictionary:
	if _is_cancelled():
		_cleanup_cancelled_staging(str(staged["staging_root"]))
		return _cancelled_failure()
	var plan := _plan_shared_definitions(staged, current, decisions)
	if not plan.get("ok", false):
		return plan
	if not plan["conflicts"].is_empty():
		return _failure("Shared-Definition-Konflikte sind noch nicht vollständig aufgelöst.")
	var staging_root := str(staged["staging_root"])
	var staged_campaign := str(staged["staged_campaign"])
	var payload: Dictionary = staged["payload"]
	var source_id := str(payload["source_campaign_id"])
	var staged_store := FileCampaignStore.new(_data_root, source_id, Callable(), staged_campaign)
	var staged_state := staged_store.load_state()
	if not staged_state.get("ok", false):
		return _failure("Der staged Import ist nicht mehr vollständig lesbar.")
	var remapped_refs: Array = []
	for definition_id_value in staged_state.get("shared_definition_refs", []):
		var definition_id := str(definition_id_value)
		remapped_refs.append(plan["reference_remap"].get(definition_id, definition_id))
	remapped_refs.sort()
	if remapped_refs != staged_state.get("shared_definition_refs", []):
		var remap_commit := staged_store.commit(
			int(staged_state["generation"]),
			{},
			staged_state["runtime"],
			[],
			0,
			remapped_refs
		)
		if not remap_commit.get("ok", false):
			return _failure("Retain-both-Referenzen konnten im staged Import nicht veröffentlicht werden.")

	var active_definition_generation := int(current.get("shared_definitions_generation", 0))
	var prepared := _definition_store.prepare_generation(
		active_definition_generation,
		plan["definitions_to_publish"],
		_progress_callback,
		_cancellation_callback
	)
	if not prepared.get("ok", false):
		if prepared.get("status", "") == "cancelled":
			_cleanup_cancelled_staging(staging_root)
		return prepared
	if _is_cancelled():
		if prepared.get("status", "") == "prepared":
			_definition_store.discard_unselected_generation(int(prepared["generation"]))
		_cleanup_cancelled_staging(staging_root)
		return _cancelled_failure()
	var next_definition_generation := int(prepared["generation"])
	var new_campaign_id := _files.new_identity()
	var replace_identity := _replace_staged_identity(
		staged_campaign,
		new_campaign_id,
		str(payload["name"]),
		str(payload["created_at_utc"])
	)
	if not replace_identity.get("ok", false):
		_discard_failed_import(staging_root, prepared)
		return replace_identity

	var target_campaign := _data_root + "/campaigns/" + new_campaign_id
	var campaigns_directory_error := _files.ensure_directory(_data_root + "/campaigns")
	if campaigns_directory_error != OK:
		_discard_failed_import(staging_root, prepared)
		return _failure("Campaign-Zielverzeichnis konnte nicht vorbereitet werden.")
	if DirAccess.dir_exists_absolute(_files.absolute(target_campaign)):
		_discard_failed_import(staging_root, prepared)
		return _failure("Die neue Import-Identität kollidiert mit einer vorhandenen Campaign.")
	var promote_error := DirAccess.rename_absolute(
		_files.absolute(staged_campaign),
		_files.absolute(target_campaign)
	)
	if promote_error != OK:
		_discard_failed_import(staging_root, prepared)
		return _failure("Importierte Campaign konnte nicht veröffentlicht werden.")

	var register: Dictionary = _registry.register_existing_campaign(
		new_campaign_id,
		str(payload["name"]),
		str(payload["created_at_utc"]),
		int(current["generation"]),
		next_definition_generation
	)
	if not register.get("ok", false):
		var rollback_error := DirAccess.rename_absolute(
			_files.absolute(target_campaign),
			_files.absolute(staged_campaign)
		)
		if rollback_error != OK:
			return _failure("Import-Registrierung schlug fehl und die isolierte Campaign konnte nicht zurückgesetzt werden.")
		_discard_failed_import(staging_root, prepared)
		return register
	_remove_tree(_files.absolute(staging_root))
	register["status"] = "imported"
	register["campaign_id"] = new_campaign_id
	register["source_campaign_id"] = source_id
	register["shared_definitions_generation"] = next_definition_generation
	register["definition_decisions"] = decisions.duplicate(true)
	register["definition_reference_remap"] = plan["reference_remap"].duplicate(true)
	_emit_progress("completed", 1, 1, "Campaign und Definitionen wurden importiert.")
	return register


func _discard_failed_import(staging_root: String, prepared: Dictionary) -> void:
	_remove_tree(_files.absolute(staging_root))
	if prepared.get("status", "") == "prepared":
		_definition_store.discard_unselected_generation(int(prepared["generation"]))


func _cleanup_cancelled_staging(staging_root: String) -> void:
	if not FileAccess.file_exists(_files.absolute(staging_root + "/operation.json")):
		_remove_tree(_files.absolute(staging_root))


func _plan_shared_definitions(staged: Dictionary, current: Dictionary, decisions: Dictionary) -> Dictionary:
	var active_generation := int(current.get("shared_definitions_generation", 0))
	var active := _definition_store.load_generation(active_generation)
	if not active.get("ok", false):
		return active
	var definitions_to_publish: Array = []
	var reference_remap := {}
	var conflicts: Array = []
	for imported_value in staged["payload"]["shared_definitions"]:
		if _is_cancelled():
			return _cancelled_failure()
		var validation := _definition_store.validate_definition(imported_value)
		if not validation.get("ok", false):
			return validation
		var imported: Dictionary = validation["definition"]
		var definition_id := str(imported["definition_id"])
		if not active["definitions"].has(definition_id):
			definitions_to_publish.append(imported)
			continue
		var existing := _definition_store.read_definition(definition_id, active_generation)
		if not existing.get("ok", false):
			return existing
		if _files.canonical_json(existing["definition"]) == _files.canonical_json(imported):
			continue
		var conflict := _definition_conflict(definition_id, existing["definition"], imported, current)
		var choice := str(decisions.get(definition_id, ""))
		if choice.is_empty():
			conflicts.append(conflict)
		elif choice == "keep_existing":
			pass
		elif choice == "use_imported":
			definitions_to_publish.append(imported)
		elif choice == "retain_both":
			var retained: Dictionary = imported.duplicate(true)
			var retained_id := "%s-imported-%s" % [definition_id, _files.new_identity()]
			retained["definition_id"] = retained_id
			definitions_to_publish.append(retained)
			reference_remap[definition_id] = retained_id
		else:
			return _failure("Unbekannte Shared-Definition-Konfliktentscheidung.")
	return {
		"ok": true,
		"definitions_to_publish": definitions_to_publish,
		"reference_remap": reference_remap,
		"conflicts": conflicts,
	}


func _definition_conflict(
	definition_id: String,
	existing: Dictionary,
	imported: Dictionary,
	registry_state: Dictionary
) -> Dictionary:
	var affected_campaigns: Array = []
	for campaign in registry_state["campaigns"]:
		var campaign_id := str(campaign["id"])
		var state := FileCampaignStore.new(_data_root, campaign_id).load_state()
		if state.get("ok", false) and definition_id in state.get("shared_definition_refs", []):
			affected_campaigns.append({"campaign_id": campaign_id, "name": campaign["name"]})
	return {
		"definition_id": definition_id,
		"existing": {
			"kind": existing["kind"],
			"name": existing["name"],
			"sha256": _files.checksum(existing),
		},
		"imported": {
			"kind": imported["kind"],
			"name": imported["name"],
			"sha256": _files.checksum(imported),
		},
		"affected_existing_campaigns": affected_campaigns,
		"consequences": {
			"keep_existing": "Die importierte Campaign verwendet künftig die vorhandene Variante; ihre abgeschlossene Historie bleibt unverändert.",
			"use_imported": "%d vorhandene Campaign(s) verwenden künftig die importierte Variante; abgeschlossene Historie bleibt unverändert." % affected_campaigns.size(),
			"retain_both": "Die importierte Campaign erhält eine neue Definition-ID; vorhandene Campaigns behalten die bisherige Variante.",
		},
	}


func _persist_import_operation(staged: Dictionary, current: Dictionary, conflicts: Array) -> Dictionary:
	var payload := {
		"import_id": staged["operation_id"],
		"expected_registry_generation": str(current["generation"]),
		"staging_root": staged["staging_root"],
		"staged_campaign": staged["staged_campaign"],
		"bundle_payload": staged["payload"],
		"conflicts": conflicts,
	}
	return _files.write_new_json(
		str(staged["staging_root"]) + "/operation.json",
		{
			"format": IMPORT_OPERATION_FORMAT_ID,
			"payload": payload,
			"payload_sha256": _files.checksum(payload),
		},
		"import_operation"
	)


func _read_import_operation(import_id: String) -> Dictionary:
	if not _portable_segment(import_id):
		return _failure("Ungültige Import-Identität.")
	var staging_root := _data_root + "/staging/import-" + import_id
	var read := _files.read_json(staging_root + "/operation.json")
	if not read.get("ok", false) or not read.get("value") is Dictionary:
		return _failure("Der staged Import ist nicht lesbar.")
	var document: Dictionary = read["value"]
	if document.get("format", "") != IMPORT_OPERATION_FORMAT_ID or not document.get("payload") is Dictionary:
		return _failure("Der staged Import besitzt ein unbekanntes Format.")
	var payload: Dictionary = document["payload"]
	if document.get("payload_sha256", "") != _files.checksum(payload):
		return _failure("Der staged Import besitzt eine ungültige Prüfsumme.")
	if (
		payload.get("import_id", "") != import_id
		or payload.get("staging_root", "") != staging_root
		or payload.get("staged_campaign", "") != staging_root + "/campaign"
		or not payload.get("bundle_payload") is Dictionary
		or not payload.get("conflicts") is Array
		or not str(payload.get("expected_registry_generation", "")).is_valid_int()
	):
		return _failure("Der staged Import enthält ungültige Metadaten.")
	var source_id := str(payload["bundle_payload"].get("source_campaign_id", ""))
	var staged_store := FileCampaignStore.new(_data_root, source_id, Callable(), str(payload["staged_campaign"]))
	var state := staged_store.load_state()
	if not state.get("ok", false):
		return _failure("Die staged Campaign ist nicht mehr vollständig lesbar.")
	var closure := _validate_definition_closure(payload["bundle_payload"], state)
	if not closure.get("ok", false):
		return closure
	return {"ok": true, "payload": payload}


func _replace_staged_identity(
	staged_campaign: String,
	new_campaign_id: String,
	name: String,
	created_at_utc: String
) -> Dictionary:
	var identity_payload := {
		"campaign_id": new_campaign_id,
		"name": name,
		"created_at_utc": created_at_utc,
	}
	var identity_document := {
		"format": FileCampaignStore.IDENTITY_FORMAT_ID,
		"payload": identity_payload,
		"payload_sha256": _files.checksum(identity_payload),
	}
	var manifest_path := _files.absolute(staged_campaign + "/manifest.json")
	var replace_manifest := FileAccess.open(manifest_path, FileAccess.WRITE)
	if replace_manifest == null:
		return _failure("Importierte Campaign-Identität konnte nicht neu vergeben werden.")
	replace_manifest.store_string(JSON.stringify(identity_document, "  ", true, true) + "\n")
	replace_manifest.flush()
	var identity_error := replace_manifest.get_error()
	replace_manifest.close()
	if identity_error != OK:
		return _failure("Importierte Campaign-Identität konnte nicht vollständig geschrieben werden.")
	return {"ok": true}


func _validate_definition_closure(payload: Dictionary, campaign_state: Dictionary) -> Dictionary:
	var bundled_ids := {}
	for definition_value in payload.get("shared_definitions", []):
		var validation := _definition_store.validate_definition(definition_value)
		if not validation.get("ok", false):
			return _failure("Campaign-Bundle enthält eine ungültige Shared Definition.")
		bundled_ids[str(validation["definition"]["definition_id"])] = true
	var referenced_ids := {}
	for definition_id_value in campaign_state.get("shared_definition_refs", []):
		referenced_ids[str(definition_id_value)] = true
	var bundled_keys: Array = bundled_ids.keys()
	var referenced_keys: Array = referenced_ids.keys()
	bundled_keys.sort()
	referenced_keys.sort()
	if _files.canonical_json(bundled_keys) != _files.canonical_json(referenced_keys):
		return _failure("Campaign-Bundle ist keine geschlossene Shared-Definition-Übertragung.")
	return {"ok": true}


func _stale_import(current: Dictionary) -> Dictionary:
	return {
		"ok": false,
		"status": "stale",
		"error": "Die Installation wurde während des Imports geändert. Bitte Import erneut prüfen.",
		"state": current,
	}


func validate_bundle(bundle_path: String) -> Dictionary:
	_set_observers(Callable(), Callable())
	var staged := _stage_and_validate_bundle(bundle_path, "validation")
	if not staged.get("ok", false):
		return staged
	var payload: Dictionary = staged["payload"]
	_remove_tree(_files.absolute(staged["staging_root"]))
	return {
		"ok": true,
		"status": "validated",
		"source_campaign_id": payload["source_campaign_id"],
		"name": payload["name"],
		"created_at_utc": payload["created_at_utc"],
		"campaign_generation": str(payload["campaign_generation"]).to_int(),
		"file_count": payload["files"].size(),
		"shared_definition_count": payload["shared_definitions"].size(),
	}


func stage_validated_bundle(bundle_path: String, purpose: String) -> Dictionary:
	_set_observers(Callable(), Callable())
	if not _portable_segment(purpose):
		return _failure("Ungültiger Staging-Zweck.")
	return _stage_and_validate_bundle(bundle_path, purpose)


func discard_staging(staging_root: String) -> void:
	var owned_prefix := _files.absolute(_data_root + "/staging/")
	var absolute_staging := _files.absolute(staging_root)
	if absolute_staging.begins_with(owned_prefix):
		_remove_tree(absolute_staging)


func _stage_and_validate_bundle(bundle_path: String, purpose: String) -> Dictionary:
	if _is_cancelled():
		return _cancelled_failure()
	var bundle := FileAccess.open(_files.absolute(bundle_path), FileAccess.READ)
	if bundle == null:
		return _failure("Campaign-Bundle ist nicht lesbar.")
	var manifest_result := _read_and_validate_manifest(bundle)
	if not manifest_result.get("ok", false):
		bundle.close()
		return manifest_result
	var payload: Dictionary = manifest_result["payload"]
	if _is_cancelled():
		bundle.close()
		return _cancelled_failure()
	var operation_id := _files.new_identity()
	var staging_root := _data_root + "/staging/%s-%s" % [purpose, operation_id]
	var staged_campaign := staging_root + "/campaign"
	var admission: Dictionary = _capacity_guard.admit(staged_campaign, int(manifest_result["total_bytes"]))
	if not admission.get("ok", false):
		bundle.close()
		return admission
	var staging_error := _files.ensure_directory(staged_campaign)
	if staging_error != OK:
		bundle.close()
		return _failure("Campaign-Staging konnte nicht erstellt werden.")

	var extraction := _extract_entries(bundle, payload["files"], staged_campaign)
	bundle.close()
	if not extraction.get("ok", false):
		_remove_tree(_files.absolute(staging_root))
		return extraction
	var source_id := str(payload["source_campaign_id"])
	var staged_store := FileCampaignStore.new(_data_root, source_id, Callable(), staged_campaign)
	var source_state := staged_store.load_state()
	if not source_state.get("ok", false):
		_remove_tree(_files.absolute(staging_root))
		return _failure("Campaign-Bundle besteht die semantische Campaign-Validierung nicht.")
	var binary_validation := staged_store.validate_binary_closure(source_state)
	if not binary_validation.get("ok", false):
		_remove_tree(_files.absolute(staging_root))
		return _failure("Campaign-Bundle besitzt keine vollständige Asset-/Chunk-Closure.")
	if int(source_state["generation"]) != str(payload["campaign_generation"]).to_int():
		_remove_tree(_files.absolute(staging_root))
		return _failure("Exportmanifest und Campaign-Generation widersprechen sich.")
	var source_identity: Dictionary = source_state["identity"]
	if (
		source_identity.get("campaign_id", "") != source_id
		or source_identity.get("name", "") != payload["name"]
		or source_identity.get("created_at_utc", "") != payload["created_at_utc"]
	):
		_remove_tree(_files.absolute(staging_root))
		return _failure("Exportmanifest und Campaign-Identität widersprechen sich.")
	var closure_validation := _validate_definition_closure(payload, source_state)
	if not closure_validation.get("ok", false):
		_remove_tree(_files.absolute(staging_root))
		return closure_validation
	return {
		"ok": true,
		"payload": payload,
		"state": source_state,
		"staging_root": staging_root,
		"staged_campaign": staged_campaign,
		"operation_id": operation_id,
	}


func _read_and_validate_manifest(bundle: FileAccess) -> Dictionary:
	var magic_bytes := bundle.get_buffer(MAGIC.to_utf8_buffer().size())
	if magic_bytes.get_string_from_utf8() != MAGIC:
		return _failure("Campaign-Bundle besitzt keine gültige SaltMarcher-Signatur.")
	var manifest_size := bundle.get_64()
	if manifest_size <= 0 or manifest_size > MAX_MANIFEST_BYTES or manifest_size > bundle.get_length() - bundle.get_position():
		return _failure("Campaign-Bundle deklariert eine ungültige Manifestgröße.")
	var parser := JSON.new()
	if parser.parse(bundle.get_buffer(manifest_size).get_string_from_utf8()) != OK or not parser.data is Dictionary:
		return _failure("Campaign-Bundle enthält kein gültiges Manifest.")
	var manifest: Dictionary = parser.data
	if manifest.get("format", "") != FORMAT_ID or not manifest.get("payload") is Dictionary:
		return _failure("Campaign-Bundle besitzt ein unbekanntes Format.")
	var payload: Dictionary = manifest["payload"]
	if manifest.get("payload_sha256", "") != _files.checksum(payload):
		return _failure("Campaign-Bundle besitzt eine ungültige Manifest-Prüfsumme.")
	if not payload.get("shared_definitions") is Array or payload["shared_definitions"].size() > MAX_SHARED_DEFINITION_COUNT:
		return _failure("Campaign-Bundle enthält keine zulässige Shared-Definition-Sammlung.")
	var known_definition_ids := {}
	for definition_value in payload["shared_definitions"]:
		var definition_validation := _definition_store.validate_definition(definition_value)
		if not definition_validation.get("ok", false):
			return _failure("Campaign-Bundle enthält eine ungültige Shared Definition.")
		var definition_id := str(definition_validation["definition"]["definition_id"])
		if known_definition_ids.has(definition_id):
			return _failure("Campaign-Bundle enthält eine doppelte Shared Definition.")
		known_definition_ids[definition_id] = true
	if not payload.get("files") is Array or payload["files"].size() <= 0 or payload["files"].size() > MAX_FILE_COUNT:
		return _failure("Campaign-Bundle enthält eine unzulässige Dateianzahl.")
	if str(payload.get("name", "")).strip_edges().is_empty() or not str(payload.get("campaign_generation", "")).is_valid_int():
		return _failure("Campaign-Bundle enthält ungültige Campaign-Metadaten.")

	var known_paths := {}
	var total_bytes := 0
	var framed_bytes := 0
	for entry in payload["files"]:
		if not entry is Dictionary:
			return _failure("Campaign-Bundle enthält einen ungültigen Dateieintrag.")
		var path := str(entry.get("path", ""))
		var normalized_path := path.to_lower()
		if not _safe_relative_path(path) or known_paths.has(normalized_path):
			return _failure("Campaign-Bundle enthält einen unsicheren oder doppelten Pfad.")
		if not str(entry.get("size", "")).is_valid_int():
			return _failure("Campaign-Bundle enthält eine ungültige Dateigröße.")
		var size := str(entry["size"]).to_int()
		if size < 0 or size > MAX_SAFE_BYTES:
			return _failure("Campaign-Bundle enthält eine nicht sicher darstellbare Dateigröße.")
		total_bytes += size
		framed_bytes += 12 + path.to_utf8_buffer().size() + size
		if total_bytes > MAX_SAFE_BYTES or framed_bytes > MAX_SAFE_BYTES:
			return _failure("Campaign-Bundle enthält eine nicht sicher darstellbare Gesamtgröße.")
		if not _valid_sha256(str(entry.get("sha256", ""))):
			return _failure("Campaign-Bundle enthält eine ungültige Dateiprüfsumme.")
		known_paths[normalized_path] = true
	if framed_bytes != bundle.get_length() - bundle.get_position():
		return _failure("Campaign-Bundle-Größe und Manifest widersprechen sich.")
	return {"ok": true, "payload": payload, "total_bytes": total_bytes}


func _extract_entries(bundle: FileAccess, entries: Array, staging_campaign: String) -> Dictionary:
	var extracted_file_count := 0
	for expected in entries:
		if _is_cancelled():
			return _cancelled_failure()
		if bundle.get_length() - bundle.get_position() < 12:
			return _failure("Campaign-Bundle endet vor dem nächsten Dateieintrag.")
		var path_size := bundle.get_32()
		if path_size <= 0 or path_size > 4096 or path_size > bundle.get_length() - bundle.get_position():
			return _failure("Campaign-Bundle enthält eine ungültige Pfadlänge.")
		var path := bundle.get_buffer(path_size).get_string_from_utf8()
		var content_size := bundle.get_64()
		if path != expected["path"] or content_size != str(expected["size"]).to_int():
			return _failure("Campaign-Bundle-Datei und Manifest widersprechen sich.")
		if content_size > bundle.get_length() - bundle.get_position():
			return _failure("Campaign-Bundle-Datei ist unvollständig.")
		var destination := staging_campaign + "/" + path
		var directory_error := _files.ensure_directory(destination.get_base_dir())
		if directory_error != OK:
			return _failure("Importziel für Campaign-Datei konnte nicht erstellt werden.")
		var output := FileAccess.open(_files.absolute(destination), FileAccess.WRITE)
		if output == null:
			return _failure("Importierte Campaign-Datei konnte nicht geschrieben werden.")
		var hashing := HashingContext.new()
		hashing.start(HashingContext.HASH_SHA256)
		var remaining := content_size
		while remaining > 0:
			if _is_cancelled():
				output.close()
				return _cancelled_failure()
			var chunk := bundle.get_buffer(mini(CHUNK_SIZE, remaining))
			if chunk.is_empty():
				output.close()
				return _failure("Campaign-Bundle-Datei ist während des Imports abgebrochen.")
			output.store_buffer(chunk)
			hashing.update(chunk)
			remaining -= chunk.size()
		output.flush()
		var output_error := output.get_error()
		output.close()
		if output_error != OK or hashing.finish().hex_encode() != expected["sha256"]:
			return _failure("Importierte Campaign-Datei besteht die Prüfsummenvalidierung nicht.")
		extracted_file_count += 1
		_emit_progress(
			"extracting",
			extracted_file_count,
			entries.size(),
			"Campaign-Dateien werden isoliert geprüft."
		)
	if bundle.get_position() != bundle.get_length():
		return _failure("Campaign-Bundle enthält nicht deklarierte zusätzliche Daten.")
	return {"ok": true}


func _inventory(root_path: String) -> Dictionary:
	var relative_paths: Array[String] = []
	var scan := _collect_paths(root_path, "", relative_paths)
	if not scan.get("ok", false):
		return scan
	relative_paths.sort()
	if relative_paths.size() > MAX_FILE_COUNT:
		return _failure("Campaign überschreitet die zulässige Export-Dateianzahl.")
	var entries: Array = []
	var total_bytes := 0
	var inventoried_file_count := 0
	for relative_path in relative_paths:
		if _is_cancelled():
			return _cancelled_failure()
		var source := FileAccess.open(root_path + "/" + relative_path, FileAccess.READ)
		if source == null:
			return _failure("Campaign-Datei ist während des Exports nicht lesbar.")
		var size := source.get_length()
		var checksum_result := _hash_open_file(source)
		source.close()
		if not checksum_result.get("ok", false):
			return checksum_result
		total_bytes += size
		if total_bytes > MAX_SAFE_BYTES:
			return _failure("Campaign überschreitet die sicher darstellbare Export-Gesamtgröße.")
		entries.append({
			"path": relative_path,
			"size": str(size),
			"sha256": checksum_result["sha256"],
		})
		inventoried_file_count += 1
		_emit_progress(
			"inventory",
			inventoried_file_count,
			relative_paths.size(),
			"Campaign-Inhalt wird vollständig erfasst."
		)
	return {"ok": true, "files": entries, "total_bytes": total_bytes}


func _collect_paths(root_path: String, relative_dir: String, output: Array[String]) -> Dictionary:
	var absolute_dir := root_path if relative_dir.is_empty() else root_path + "/" + relative_dir
	var directory := DirAccess.open(absolute_dir)
	if directory == null:
		return _failure("Campaign-Verzeichnis ist während des Exports nicht lesbar.")
	directory.list_dir_begin()
	var name := directory.get_next()
	while not name.is_empty():
		if _is_cancelled():
			directory.list_dir_end()
			return _cancelled_failure()
		var relative_path := name if relative_dir.is_empty() else relative_dir + "/" + name
		if directory.is_link(name):
			directory.list_dir_end()
			return _failure("Campaign-Export folgt keinen symbolischen Links.")
		if directory.current_is_dir():
			var nested := _collect_paths(root_path, relative_path, output)
			if not nested.get("ok", false):
				directory.list_dir_end()
				return nested
		elif not name.contains(".pending-"):
			if not _safe_relative_path(relative_path):
				directory.list_dir_end()
				return _failure("Campaign enthält einen nicht portablen Dateipfad.")
			output.append(relative_path)
		name = directory.get_next()
	directory.list_dir_end()
	return {"ok": true}


func _copy_file_into_bundle(path: String, output: FileAccess, expected_checksum: String) -> Dictionary:
	var source := FileAccess.open(path, FileAccess.READ)
	if source == null:
		return _failure("Campaign-Datei verschwand während des Exports.")
	var hashing := HashingContext.new()
	hashing.start(HashingContext.HASH_SHA256)
	while source.get_position() < source.get_length():
		if _is_cancelled():
			source.close()
			return _cancelled_failure()
		var chunk := source.get_buffer(mini(CHUNK_SIZE, source.get_length() - source.get_position()))
		if chunk.is_empty():
			source.close()
			return _failure("Campaign-Datei konnte nicht vollständig gelesen werden.")
		output.store_buffer(chunk)
		hashing.update(chunk)
	source.close()
	if hashing.finish().hex_encode() != expected_checksum:
		return _failure("Campaign wurde während des Exports verändert; Export wurde verworfen.")
	return {"ok": true}


func _hash_open_file(source: FileAccess) -> Dictionary:
	var hashing := HashingContext.new()
	if hashing.start(HashingContext.HASH_SHA256) != OK:
		return _failure("Campaign-Dateiprüfsumme konnte nicht begonnen werden.")
	while source.get_position() < source.get_length():
		if _is_cancelled():
			return _cancelled_failure()
		var chunk := source.get_buffer(mini(CHUNK_SIZE, source.get_length() - source.get_position()))
		if chunk.is_empty():
			return _failure("Campaign-Datei konnte nicht vollständig gelesen werden.")
		if hashing.update(chunk) != OK:
			return _failure("Campaign-Dateiprüfsumme konnte nicht fortgesetzt werden.")
	return {"ok": true, "sha256": hashing.finish().hex_encode()}


func _safe_relative_path(path: String) -> bool:
	if path.is_empty() or path.begins_with("/") or path.contains("\\") or path.contains(":") or path.to_utf8_buffer().has(0):
		return false
	for segment in path.split("/", false):
		if not _portable_segment(segment):
			return false
	return true


func _portable_segment(segment: String) -> bool:
	if segment.is_empty() or segment == "." or segment == ".." or segment.ends_with(".") or segment.ends_with(" "):
		return false
	var stem := segment.get_basename().to_upper()
	var reserved := ["CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9"]
	if stem in reserved:
		return false
	for index in segment.length():
		if segment.unicode_at(index) < 32:
			return false
	return true


func _valid_sha256(value: String) -> bool:
	if value.length() != 64:
		return false
	for index in value.length():
		var code := value.unicode_at(index)
		if not ((code >= 48 and code <= 57) or (code >= 97 and code <= 102)):
			return false
	return true


func _remove_tree(absolute_path: String) -> void:
	if not DirAccess.dir_exists_absolute(absolute_path):
		return
	var directory := DirAccess.open(absolute_path)
	if directory == null:
		return
	directory.list_dir_begin()
	var name := directory.get_next()
	while not name.is_empty():
		var child := absolute_path + "/" + name
		if directory.current_is_dir() and not directory.is_link(name):
			_remove_tree(child)
		else:
			DirAccess.remove_absolute(child)
		name = directory.get_next()
	directory.list_dir_end()
	DirAccess.remove_absolute(absolute_path)


func _set_observers(progress_callback: Callable, cancellation_callback: Callable) -> void:
	_progress_callback = progress_callback
	_cancellation_callback = cancellation_callback


func _emit_progress(phase: String, completed: int, total: int, message: String) -> void:
	if _progress_callback.is_valid():
		_progress_callback.call({
			"phase": phase,
			"completed": completed,
			"total": total,
			"message": message,
		})


func _is_cancelled() -> bool:
	return _cancellation_callback.is_valid() and bool(_cancellation_callback.call())


func _cancelled_failure() -> Dictionary:
	return {
		"ok": false,
		"status": "cancelled",
		"error": "Vorgang wurde vor der Veröffentlichung abgebrochen.",
	}


func _failure(message: String) -> Dictionary:
	return {"ok": false, "status": "portability_error", "error": message}
