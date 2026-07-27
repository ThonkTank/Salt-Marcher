class_name StorageCapacityGuard
extends RefCounted

## Rejects writes before SaltMarcher's owned operation would consume the reserve.

const MINIMUM_RESERVE_BYTES := 2 * 1024 * 1024 * 1024
const RESERVE_PERCENT_NUMERATOR := 5
const RESERVE_PERCENT_DENOMINATOR := 100

var _capacity_probe: Callable


func _init(capacity_probe: Callable = Callable()) -> void:
	_capacity_probe = capacity_probe


func admit(path: String, declared_write_bytes: int) -> Dictionary:
	if declared_write_bytes < 0:
		return _failure("Negativer Speicherbedarf ist ungültig.")
	var capacity := _probe(path)
	if not capacity.get("ok", false):
		return capacity
	var available_bytes := int(capacity["available_bytes"])
	var volume_capacity_bytes := int(capacity.get("volume_capacity_bytes", -1))
	var reserve_bytes := MINIMUM_RESERVE_BYTES
	var capacity_known := volume_capacity_bytes > 0
	if capacity_known:
		reserve_bytes = maxi(
			reserve_bytes,
			_ceiling_fraction(
				volume_capacity_bytes,
				RESERVE_PERCENT_NUMERATOR,
				RESERVE_PERCENT_DENOMINATOR
			)
		)
	if declared_write_bytes > available_bytes or available_bytes - declared_write_bytes < reserve_bytes:
		return {
			"ok": false,
			"status": "storage_pressure",
			"error": "Lokaler Speicher hat die SaltMarcher-Sicherheitsreserve erreicht. Neue Schreibarbeit wurde vor der Bestätigung abgelehnt.",
			"required_write_bytes": declared_write_bytes,
			"available_bytes": available_bytes,
			"reserve_bytes": reserve_bytes,
			"volume_capacity_bytes": volume_capacity_bytes,
			"capacity_known": capacity_known,
			"safe_read_available": true,
			"external_export_available": true,
			"retry_available": true,
		}
	return {
		"ok": true,
		"status": "admitted",
		"required_write_bytes": declared_write_bytes,
		"available_bytes": available_bytes,
		"reserve_bytes": reserve_bytes,
		"volume_capacity_bytes": volume_capacity_bytes,
		"capacity_known": capacity_known,
	}


func _probe(path: String) -> Dictionary:
	if _capacity_probe.is_valid():
		var probed = _capacity_probe.call(path)
		if not probed is Dictionary:
			return _failure("Speicherkapazitätsprobe lieferte kein gültiges Ergebnis.")
		if not probed.get("ok", false):
			return probed
		if int(probed.get("available_bytes", -1)) < 0:
			return _failure("Verfügbarer Speicher konnte nicht bestimmt werden.")
		return probed
	var existing_directory := _nearest_existing_directory(ProjectSettings.globalize_path(path))
	if existing_directory.is_empty():
		return _failure("Dateisystem für die Speicherprüfung ist nicht erreichbar.")
	var directory := DirAccess.open(existing_directory)
	if directory == null:
		return _failure("Dateisystem für die Speicherprüfung ist nicht lesbar.")
	var available_bytes := directory.get_space_left()
	if available_bytes < 0:
		return _failure("Verfügbarer Speicher konnte nicht bestimmt werden.")
	return {
		"ok": true,
		"available_bytes": available_bytes,
		# Godot exposes free bytes but not total volume capacity. A later platform
		# probe must provide that value before the percentage half is qualified.
		"volume_capacity_bytes": -1,
	}


func _nearest_existing_directory(absolute_path: String) -> String:
	var candidate := absolute_path if DirAccess.dir_exists_absolute(absolute_path) else absolute_path.get_base_dir()
	while not candidate.is_empty() and not DirAccess.dir_exists_absolute(candidate):
		var parent := candidate.get_base_dir()
		if parent == candidate:
			return ""
		candidate = parent
	return candidate


func _ceiling_fraction(value: int, numerator: int, denominator: int) -> int:
	return (value * numerator + denominator - 1) / denominator


func _failure(message: String) -> Dictionary:
	return {
		"ok": false,
		"status": "storage_probe_error",
		"error": message,
		"safe_read_available": true,
		"external_export_available": true,
		"retry_available": true,
	}
