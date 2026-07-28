class_name FileCampaignRegistry
extends RefCounted

## Installation-scoped Campaign registry backed by immutable, checksummed JSON generations.
## A generation becomes visible only after its complete file has been flushed and renamed.

const FORMAT_ID := "saltmarcher.campaign-registry.v1"
const MAX_NAME_LENGTH := 160
const FileCampaignStore = preload("res://godot/src/platform/persistence/file_campaign_store.gd")
const ImmutableJsonFiles = preload("res://godot/src/platform/persistence/immutable_json_files.gd")
const SharedDefinitionStore = preload("res://godot/src/platform/persistence/shared_definition_store.gd")

var _data_root: String
var _registry_dir: String
var _campaigns_dir: String
var _trash_campaigns_dir: String
var _files: ImmutableJsonFiles
var _capacity_guard


func _init(
	data_root: String = "user://salt-marcher",
	fault_injector: Callable = Callable(),
	capacity_guard = null
) -> void:
	_data_root = data_root.trim_suffix("/")
	_registry_dir = _data_root + "/installation/registry"
	_campaigns_dir = _data_root + "/campaigns"
	_trash_campaigns_dir = _data_root + "/trash/campaigns"
	_capacity_guard = capacity_guard
	_files = ImmutableJsonFiles.new(fault_injector, capacity_guard)


func load_state() -> Dictionary:
	var directory_error := _ensure_directory(_registry_dir)
	if directory_error != OK:
		return _failure("Registry-Verzeichnis konnte nicht geöffnet werden: %s" % error_string(directory_error))

	var generations := _available_generations()
	if generations.is_empty():
		return {
			"ok": true,
			"recovered": false,
			"recovery_message": "",
			"generation": 0,
			"active_campaign_id": "",
			"campaigns": [],
			"shared_definitions_generation": 0,
		}

	generations.reverse()
	var rejected := 0
	for generation in generations:
		var candidate := _read_generation(generation)
		if candidate.get("ok", false):
			var state: Dictionary = candidate["state"]
			state["recovered"] = rejected > 0
			state["recovery_message"] = (
				"Die jüngste beschädigte Registry-Version wurde verworfen; Generation %d ist aktiv."
				% generation if rejected > 0 else ""
			)
			return state
		rejected += 1

	return _failure("Keine unverfälschte Campaign-Registry konnte wiederhergestellt werden.")


func create_campaign(raw_name: String, expected_generation: int = -1) -> Dictionary:
	var name := raw_name.strip_edges()
	if name.is_empty():
		return _operation_failure("Der Name braucht mindestens ein sichtbares Zeichen.")
	if name.length() > MAX_NAME_LENGTH:
		return _operation_failure("Der Name darf höchstens %d Zeichen enthalten." % MAX_NAME_LENGTH)

	var current := load_state()
	if not current.get("ok", false):
		return current
	if expected_generation >= 0 and int(current["generation"]) != expected_generation:
		return _stale(current)

	var campaign_id := _new_campaign_id()
	var created_at := Time.get_datetime_string_from_system(true)
	var staging_root := _data_root + "/staging/create-" + campaign_id
	var staged_campaign := staging_root + "/campaign"
	var campaign_store := FileCampaignStore.new(
		_data_root,
		campaign_id,
		Callable(),
		staged_campaign,
		_capacity_guard
	)
	var initialize_result := campaign_store.initialize(name, created_at)
	if not initialize_result.get("ok", false):
		_files.remove_tree(staging_root)
		return initialize_result
	var campaigns_directory_error := _ensure_directory(_campaigns_dir)
	if campaigns_directory_error != OK:
		_files.remove_tree(staging_root)
		return _operation_failure("Campaign-Zielverzeichnis konnte nicht vorbereitet werden.")
	var live_campaign := _campaigns_dir + "/" + campaign_id
	if DirAccess.dir_exists_absolute(_absolute(live_campaign)):
		_files.remove_tree(staging_root)
		return _operation_failure("Die neue Campaign-Identität kollidiert mit einer vorhandenen Campaign.")
	var promote_error := DirAccess.rename_absolute(
		_absolute(staged_campaign),
		_absolute(live_campaign)
	)
	if promote_error != OK:
		_files.remove_tree(staging_root)
		return _operation_failure("Vorbereitete Campaign konnte nicht veröffentlicht werden.")
	var manifest_validation := _validate_campaign_manifest(campaign_id)
	if not manifest_validation.get("ok", false):
		var validation_rollback := DirAccess.rename_absolute(
			_absolute(live_campaign),
			_absolute(staged_campaign)
		)
		if validation_rollback != OK:
			return _operation_failure("Ungültige Campaign konnte nicht aus der Live-Wurzel zurückgesetzt werden.")
		_files.remove_tree(staging_root)
		return manifest_validation

	var campaigns: Array = current["campaigns"].duplicate(true)
	campaigns.append({
		"id": campaign_id,
		"name": name,
		"created_at_utc": created_at,
	})
	_sort_campaigns(campaigns)

	var next_state := {
		"generation": _next_generation_number(),
		"parent_generation": int(current["generation"]),
		"active_campaign_id": campaign_id,
		"campaigns": campaigns,
		"shared_definitions_generation": current["shared_definitions_generation"],
	}
	var commit := _commit_generation(next_state)
	if not commit.get("ok", false):
		var rollback_error := DirAccess.rename_absolute(
			_absolute(live_campaign),
			_absolute(staged_campaign)
		)
		if rollback_error != OK:
			return _operation_failure("Campaign-Registry schlug fehl und die vorbereitete Campaign konnte nicht zurückgesetzt werden.")
		_files.remove_tree(staging_root)
		return commit
	_files.remove_tree(staging_root)
	commit["campaign_id"] = campaign_id
	commit["status"] = "created"
	return commit


func activate_campaign(campaign_id: String, expected_generation: int) -> Dictionary:
	var current := load_state()
	if not current.get("ok", false):
		return current
	if int(current["generation"]) != expected_generation:
		return {
			"ok": false,
			"status": "stale",
			"error": "Die Campaign-Liste wurde inzwischen geändert. Bitte erneut auswählen.",
			"state": current,
		}
	if not _contains_campaign(current["campaigns"], campaign_id):
		return _operation_failure("Die ausgewählte Campaign existiert nicht mehr.")
	var target_validation := _validate_campaign_manifest(campaign_id)
	if not target_validation.get("ok", false):
		return _operation_failure("Die ausgewählte Campaign kann nicht sicher geöffnet werden.")
	if current["active_campaign_id"] == campaign_id:
		return {"ok": true, "status": "unchanged", "state": current}

	var next_state := {
		"generation": _next_generation_number(),
		"parent_generation": expected_generation,
		"active_campaign_id": campaign_id,
		"campaigns": current["campaigns"].duplicate(true),
		"shared_definitions_generation": current["shared_definitions_generation"],
	}
	var commit := _commit_generation(next_state)
	if commit.get("ok", false):
		commit["status"] = "activated"
	return commit


func register_existing_campaign(
	campaign_id: String,
	name: String,
	created_at_utc: String,
	expected_generation: int,
	shared_definitions_generation: int = -1
) -> Dictionary:
	var current := load_state()
	if not current.get("ok", false):
		return current
	if int(current["generation"]) != expected_generation:
		return _stale(current)
	if _contains_campaign(current["campaigns"], campaign_id):
		return _operation_failure("Diese Campaign-Identität ist bereits registriert.")
	var store := FileCampaignStore.new(_data_root, campaign_id)
	var identity := store.validate_identity()
	var state := store.load_state()
	if not identity.get("ok", false) or not state.get("ok", false):
		return _operation_failure("Die importierte Campaign ist nicht vollständig lesbar.")
	if identity["identity"].get("name", "") != name or identity["identity"].get("created_at_utc", "") != created_at_utc:
		return _operation_failure("Importmetadaten und Campaign-Identität widersprechen sich.")
	var proposed_definition_generation := (
		shared_definitions_generation
		if shared_definitions_generation >= 0
		else int(current["shared_definitions_generation"])
	)
	var proposed_definitions := SharedDefinitionStore.new(_data_root).load_generation(proposed_definition_generation)
	if not proposed_definitions.get("ok", false):
		return _operation_failure("Die importierte Campaign verweist auf keinen lesbaren Shared-Definition-Stand.")
	if (
		proposed_definition_generation != int(current["shared_definitions_generation"])
		and int(proposed_definitions.get("parent_generation", -1)) != int(current["shared_definitions_generation"])
	):
		return _operation_failure("Der vorbereitete Shared-Definition-Stand basiert nicht auf der aktuellen Installation.")
	var definition_closure := SharedDefinitionStore.new(_data_root).definitions_for_refs(
		state.get("shared_definition_refs", []),
		proposed_definition_generation
	)
	if not definition_closure.get("ok", false):
		return _operation_failure("Die importierte Campaign besitzt keine vollständige Shared-Definition-Closure.")

	var campaigns: Array = current["campaigns"].duplicate(true)
	campaigns.append({
		"id": campaign_id,
		"name": name,
		"created_at_utc": created_at_utc,
	})
	_sort_campaigns(campaigns)
	var next_state := {
		"generation": _next_generation_number(),
		"parent_generation": expected_generation,
		"active_campaign_id": current["active_campaign_id"],
		"campaigns": campaigns,
		"shared_definitions_generation": proposed_definition_generation,
	}
	var commit := _commit_generation(next_state)
	if commit.get("ok", false):
		commit["status"] = "registered"
	return commit


func publish_shared_definitions_generation(
	shared_definitions_generation: int,
	expected_generation: int
) -> Dictionary:
	var current := load_state()
	if not current.get("ok", false):
		return current
	if int(current["generation"]) != expected_generation:
		return _stale(current)
	if shared_definitions_generation == int(current["shared_definitions_generation"]):
		return {"ok": true, "status": "unchanged", "state": current}
	var definitions := SharedDefinitionStore.new(_data_root).load_generation(shared_definitions_generation)
	if not definitions.get("ok", false):
		return _operation_failure("Vorbereitete Shared Definitions sind nicht vollständig lesbar.")
	if int(definitions.get("parent_generation", -1)) != int(current["shared_definitions_generation"]):
		return _operation_failure("Vorbereitete Shared Definitions basieren nicht auf dem aktuellen Installationsstand.")
	var next_state := {
		"generation": _next_generation_number(),
		"parent_generation": expected_generation,
		"active_campaign_id": current["active_campaign_id"],
		"campaigns": current["campaigns"].duplicate(true),
		"shared_definitions_generation": shared_definitions_generation,
	}
	var commit := _commit_generation(next_state)
	if commit.get("ok", false):
		commit["status"] = "shared_definitions_published"
	return commit


func trash_campaign(campaign_id: String, expected_generation: int) -> Dictionary:
	var current := load_state()
	if not current.get("ok", false):
		return current
	if int(current["generation"]) != expected_generation:
		return _stale(current)
	if not _contains_campaign(current["campaigns"], campaign_id):
		return _operation_failure("Die zu löschende Campaign existiert nicht mehr.")
	var directory_error := _ensure_directory(_trash_campaigns_dir)
	if directory_error != OK:
		return _operation_failure("Campaign-Trash konnte nicht geöffnet werden.")

	var deletion_id := _new_campaign_id()
	var trash_entry_id := "%s-%s" % [campaign_id, deletion_id]
	var source := _absolute(_campaigns_dir + "/" + campaign_id)
	var target := _absolute(_trash_campaigns_dir + "/" + trash_entry_id)
	var move_error := DirAccess.rename_absolute(source, target)
	if move_error != OK:
		return _operation_failure("Campaign konnte nicht in den wiederherstellbaren Trash verschoben werden: %s" % error_string(move_error))

	var campaigns: Array = []
	for campaign in current["campaigns"]:
		if campaign.get("id", "") != campaign_id:
			campaigns.append(campaign.duplicate(true))
	var next_state := {
		"generation": _next_generation_number(),
		"parent_generation": expected_generation,
		"active_campaign_id": "" if current["active_campaign_id"] == campaign_id else current["active_campaign_id"],
		"campaigns": campaigns,
		"shared_definitions_generation": current["shared_definitions_generation"],
	}
	var commit := _commit_generation(next_state)
	if not commit.get("ok", false):
		var rollback_error := DirAccess.rename_absolute(target, source)
		if rollback_error != OK:
			return _operation_failure("Campaign-Löschung schlug fehl und der Campaign-Ordner konnte nicht zurückgesetzt werden.")
		return commit
	commit["status"] = "trashed"
	commit["trash_entry_id"] = trash_entry_id
	return commit


func list_trashed_campaigns() -> Dictionary:
	var directory_error := _ensure_directory(_trash_campaigns_dir)
	if directory_error != OK:
		return _operation_failure("Campaign-Trash konnte nicht geöffnet werden.")
	var entries: Array = []
	var rejected_entries: Array = []
	var directory := DirAccess.open(_absolute(_trash_campaigns_dir))
	if directory == null:
		return _operation_failure("Campaign-Trash ist nicht lesbar.")
	directory.list_dir_begin()
	var entry_id := directory.get_next()
	while not entry_id.is_empty():
		if directory.current_is_dir() and _safe_entry_id(entry_id):
			var entry := _read_trash_entry(entry_id)
			if entry.get("ok", false):
				entries.append(entry["entry"])
			else:
				rejected_entries.append({
					"trash_entry_id": entry_id,
					"error": entry.get("error", "Trash-Eintrag ist beschädigt."),
				})
		entry_id = directory.get_next()
	directory.list_dir_end()
	entries.sort_custom(func(left: Dictionary, right: Dictionary) -> bool:
		return str(left["name"]).to_lower() < str(right["name"]).to_lower()
	)
	return {"ok": true, "entries": entries, "rejected_entries": rejected_entries}


func restore_trashed_campaign(trash_entry_id: String, expected_generation: int) -> Dictionary:
	if not _safe_entry_id(trash_entry_id):
		return _operation_failure("Ungültige Trash-Identität.")
	var current := load_state()
	if not current.get("ok", false):
		return current
	if int(current["generation"]) != expected_generation:
		return _stale(current)
	var trash_entry := _read_trash_entry(trash_entry_id)
	if not trash_entry.get("ok", false):
		return trash_entry
	var entry: Dictionary = trash_entry["entry"]
	var campaign_id := str(entry["campaign_id"])
	if _contains_campaign(current["campaigns"], campaign_id):
		return _operation_failure("Diese Campaign-Identität ist bereits live registriert.")

	var source := _absolute(_trash_campaigns_dir + "/" + trash_entry_id)
	var target := _absolute(_campaigns_dir + "/" + campaign_id)
	if DirAccess.dir_exists_absolute(target):
		return _operation_failure("Das Zielverzeichnis der Campaign ist bereits belegt.")
	var move_error := DirAccess.rename_absolute(source, target)
	if move_error != OK:
		return _operation_failure("Campaign konnte nicht aus dem Trash wiederhergestellt werden: %s" % error_string(move_error))

	var campaigns: Array = current["campaigns"].duplicate(true)
	campaigns.append({
		"id": campaign_id,
		"name": entry["name"],
		"created_at_utc": entry["created_at_utc"],
	})
	_sort_campaigns(campaigns)
	var next_state := {
		"generation": _next_generation_number(),
		"parent_generation": expected_generation,
		"active_campaign_id": current["active_campaign_id"],
		"campaigns": campaigns,
		"shared_definitions_generation": current["shared_definitions_generation"],
	}
	var commit := _commit_generation(next_state)
	if not commit.get("ok", false):
		var rollback_error := DirAccess.rename_absolute(target, source)
		if rollback_error != OK:
			return _operation_failure("Campaign-Wiederherstellung schlug fehl und der Trash-Eintrag konnte nicht zurückgesetzt werden.")
		return commit
	commit["status"] = "restored"
	commit["campaign_id"] = campaign_id
	return commit


func permanently_delete_trashed_campaign(
	trash_entry_id: String,
	confirmation: String
) -> Dictionary:
	if confirmation != trash_entry_id:
		return _operation_failure("Dauerhaftes Löschen erfordert die exakte Trash-Identität als Bestätigung.")
	var entry := _read_trash_entry(trash_entry_id)
	if not entry.get("ok", false):
		return entry
	var source := _trash_campaigns_dir + "/" + trash_entry_id
	var measurement := _files.measure_tree(source)
	if not measurement.get("ok", false):
		return measurement
	var deleting_root := _data_root + "/staging/permanent-delete-" + _new_campaign_id()
	var staging_error := _ensure_directory(_data_root + "/staging")
	if staging_error != OK:
		return _operation_failure("Dauerhafte Löschung konnte nicht vorbereitet werden.")
	var move_error := DirAccess.rename_absolute(_absolute(source), _absolute(deleting_root))
	if move_error != OK:
		return _operation_failure("Trash-Eintrag konnte nicht für die dauerhafte Löschung isoliert werden.")
	var removed := _files.remove_tree(deleting_root)
	if not removed.get("ok", false):
		return {
			"ok": false,
			"status": "permanent_delete_incomplete",
			"error": "Dauerhafte Löschung wurde begonnen, konnte aber nicht vollständig abgeschlossen werden.",
			"deleting_path": deleting_root,
			"cause": removed,
		}
	return {
		"ok": true,
		"status": "permanently_deleted",
		"trash_entry_id": trash_entry_id,
		"campaign_id": entry["entry"]["campaign_id"],
		"removed_file_count": measurement["file_count"],
		"removed_bytes": measurement["total_bytes"],
	}


func generation_path(generation: int) -> String:
	return _registry_dir + "/generation-%020d.json" % generation


func campaign_manifest_path(campaign_id: String) -> String:
	return _campaigns_dir + "/" + campaign_id + "/manifest.json"


func trash_entry_path(trash_entry_id: String) -> String:
	return _trash_campaigns_dir + "/" + trash_entry_id


func _available_generations() -> Array[int]:
	var result: Array[int] = []
	var directory := DirAccess.open(_absolute(_registry_dir))
	if directory == null:
		return result
	directory.list_dir_begin()
	var file_name := directory.get_next()
	while not file_name.is_empty():
		if not directory.current_is_dir() and file_name.begins_with("generation-") and file_name.ends_with(".json"):
			var raw_generation := file_name.trim_prefix("generation-").trim_suffix(".json")
			if raw_generation.is_valid_int():
				result.append(raw_generation.to_int())
		file_name = directory.get_next()
	directory.list_dir_end()
	result.sort()
	return result


func _read_generation(generation: int) -> Dictionary:
	var file := FileAccess.open(_absolute(generation_path(generation)), FileAccess.READ)
	if file == null:
		return _failure("Registry-Generation %d ist nicht lesbar." % generation)
	var raw := file.get_as_text()
	file.close()
	var parser := JSON.new()
	if parser.parse(raw) != OK:
		return _failure("Registry-Generation %d enthält kein gültiges JSON." % generation)
	var decoded = parser.data
	if not decoded is Dictionary:
		return _failure("Registry-Generation %d enthält kein gültiges Dokument." % generation)
	if decoded.get("format", "") != FORMAT_ID:
		return _failure("Registry-Generation %d hat ein unbekanntes Format." % generation)
	var payload = decoded.get("payload")
	if not payload is Dictionary:
		return _failure("Registry-Generation %d enthält keinen Payload." % generation)
	var expected_checksum := _checksum(payload)
	if decoded.get("payload_sha256", "") != expected_checksum:
		return _failure("Registry-Generation %d hat eine ungültige Prüfsumme." % generation)
	if not str(payload.get("generation", "")).is_valid_int():
		return _failure("Registry-Generation %d hat keine gültige Generation." % generation)
	if str(payload["generation"]).to_int() != generation:
		return _failure("Registry-Dateiname und Inhalt widersprechen sich.")
	var validation := _validate_payload(payload)
	if not validation.get("ok", false):
		return validation
	return {
		"ok": true,
		"state": {
			"ok": true,
			"generation": generation,
			"parent_generation": str(payload.get("parent_generation", "0")).to_int(),
			"active_campaign_id": payload["active_campaign_id"],
			"campaigns": payload["campaigns"].duplicate(true),
			"shared_definitions_generation": str(payload.get("shared_definitions_generation", "0")).to_int(),
		},
	}


func _validate_payload(payload: Dictionary) -> Dictionary:
	if not str(payload.get("parent_generation", "")).is_valid_int():
		return _failure("Campaign-Registry enthält keinen gültigen Vorgänger.")
	var generation := str(payload.get("generation", "0")).to_int()
	var parent_generation := str(payload["parent_generation"]).to_int()
	if parent_generation < 0 or parent_generation >= generation or (generation == 1 and parent_generation != 0):
		return _failure("Campaign-Registry enthält eine ungültige Generationsfolge.")
	if not str(payload.get("shared_definitions_generation", "0")).is_valid_int():
		return _failure("Campaign-Registry enthält keine gültige Shared-Definition-Generation.")
	var shared_generation := str(payload.get("shared_definitions_generation", "0")).to_int()
	if shared_generation < 0 or not SharedDefinitionStore.new(_data_root).load_generation(shared_generation).get("ok", false):
		return _failure("Campaign-Registry verweist auf keine lesbare Shared-Definition-Generation.")
	var campaigns = payload.get("campaigns")
	if not campaigns is Array:
		return _failure("Campaign-Registry enthält keine gültige Campaign-Liste.")
	var known_ids := {}
	for campaign in campaigns:
		if not campaign is Dictionary:
			return _failure("Campaign-Registry enthält einen ungültigen Eintrag.")
		var campaign_id := str(campaign.get("id", ""))
		var name := str(campaign.get("name", "")).strip_edges()
		if campaign_id.is_empty() or name.is_empty() or known_ids.has(campaign_id):
			return _failure("Campaign-Registry enthält eine ungültige oder doppelte Identität.")
		known_ids[campaign_id] = true
	var active_id := str(payload.get("active_campaign_id", ""))
	if not active_id.is_empty() and not known_ids.has(active_id):
		return _failure("Die aktive Campaign verweist auf keine registrierte Campaign.")
	return {"ok": true}


func _validate_campaign_manifest(campaign_id: String) -> Dictionary:
	return FileCampaignStore.new(_data_root, campaign_id).validate_identity()


func _commit_generation(state: Dictionary) -> Dictionary:
	var payload := {
		"generation": str(state["generation"]),
		"parent_generation": str(state["parent_generation"]),
		"active_campaign_id": state["active_campaign_id"],
		"campaigns": state["campaigns"],
		"shared_definitions_generation": str(state["shared_definitions_generation"]),
	}
	var envelope := {
		"format": FORMAT_ID,
		"payload": payload,
		"payload_sha256": _checksum(payload),
	}
	var result := _files.write_new_json(
		generation_path(int(state["generation"])),
		envelope,
		"registry_commit"
	)
	if not result.get("ok", false):
		if result.get("status", "") != "ambiguous_commit":
			return result
	var committed := load_state()
	if not committed.get("ok", false) or int(committed.get("generation", -1)) != int(state["generation"]):
		return _operation_failure("Die neue Registry-Generation konnte nicht bestätigt werden.")
	return {"ok": true, "state": committed}


func _checksum(payload: Dictionary) -> String:
	return _files.checksum(payload)


func _new_campaign_id() -> String:
	return _files.new_identity()


func _next_generation_number() -> int:
	var generations := _available_generations()
	return 1 if generations.is_empty() else generations.back() + 1


func _sort_campaigns(campaigns: Array) -> void:
	campaigns.sort_custom(func(left: Dictionary, right: Dictionary) -> bool:
		var left_name := str(left["name"]).to_lower()
		var right_name := str(right["name"]).to_lower()
		return left_name < right_name or (left_name == right_name and str(left["id"]) < str(right["id"]))
	)


func _contains_campaign(campaigns: Array, campaign_id: String) -> bool:
	for campaign in campaigns:
		if campaign is Dictionary and campaign.get("id", "") == campaign_id:
			return true
	return false


func _read_trash_entry(trash_entry_id: String) -> Dictionary:
	if not _safe_entry_id(trash_entry_id):
		return _operation_failure("Ungültige Trash-Identität.")
	var trash_directory := _trash_campaigns_dir + "/" + trash_entry_id
	var manifest := _files.read_json(trash_directory + "/manifest.json")
	if not manifest.get("ok", false) or not manifest.get("value") is Dictionary:
		return _operation_failure("Trash-Eintrag besitzt kein gültiges Campaign-Manifest.")
	var document: Dictionary = manifest["value"]
	if document.get("format", "") != FileCampaignStore.IDENTITY_FORMAT_ID:
		return _operation_failure("Trash-Eintrag besitzt ein unbekanntes Campaign-Format.")
	var payload = document.get("payload")
	if not payload is Dictionary or document.get("payload_sha256", "") != _files.checksum(payload):
		return _operation_failure("Trash-Eintrag besitzt eine ungültige Manifest-Prüfsumme.")
	var campaign_id := str(payload.get("campaign_id", ""))
	var store := FileCampaignStore.new(_data_root, campaign_id, Callable(), trash_directory)
	var state := store.load_state()
	if not state.get("ok", false):
		return _operation_failure("Trash-Eintrag enthält keine wiederherstellbare Campaign.")
	return {
		"ok": true,
		"entry": {
			"trash_entry_id": trash_entry_id,
			"campaign_id": campaign_id,
			"name": payload.get("name", ""),
			"created_at_utc": payload.get("created_at_utc", ""),
			"generation": state["generation"],
		},
	}


func _safe_entry_id(value: String) -> bool:
	if value.is_empty() or value.length() > 128 or value.contains(".."):
		return false
	for index in value.length():
		var code := value.unicode_at(index)
		var allowed := (code >= 97 and code <= 122) or (code >= 48 and code <= 57) or code == 45
		if not allowed:
			return false
	return true


func _stale(current: Dictionary) -> Dictionary:
	return {
		"ok": false,
		"status": "stale",
		"error": "Die Campaign-Liste wurde inzwischen geändert. Bitte erneut laden.",
		"state": current,
	}


func _ensure_directory(path: String) -> Error:
	return _files.ensure_directory(path)


func _absolute(path: String) -> String:
	return _files.absolute(path)


func _failure(message: String) -> Dictionary:
	return {"ok": false, "error": message}


func _operation_failure(message: String) -> Dictionary:
	return {"ok": false, "status": "storage_error", "error": message}
