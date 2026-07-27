class_name PlatformVolumeCapacityProbe
extends RefCounted

## Reads one desktop volume snapshot without interpolating paths into a shell.

const KIBIBYTE := 1024
const MAX_SAFE_KIBIBYTES := 0x1fffffffffffff
const WINDOWS_SCRIPT := (
	"& { param([string]$p) try { "
	+ "$full = [System.IO.Path]::GetFullPath($p); "
	+ "$root = [System.IO.Path]::GetPathRoot($full); "
	+ "$drive = [System.IO.DriveInfo]::new($root); "
	+ "if (-not $drive.IsReady) { exit 3 }; "
	+ "$culture = [System.Globalization.CultureInfo]::InvariantCulture; "
	+ "[Console]::Out.Write($drive.TotalSize.ToString($culture) + '|' + "
	+ "$drive.AvailableFreeSpace.ToString($culture) + '|' + $drive.Name) "
	+ "} catch { [Console]::Error.Write($_.Exception.Message); exit 2 } }"
)

var _os_name_provider: Callable
var _process_executor: Callable


func _init(
	os_name_provider: Callable = Callable(),
	process_executor: Callable = Callable()
) -> void:
	_os_name_provider = os_name_provider
	_process_executor = process_executor


func probe(absolute_existing_directory: String) -> Dictionary:
	if absolute_existing_directory.is_empty() or not DirAccess.dir_exists_absolute(absolute_existing_directory):
		return _failure("Volume-Probe benötigt ein vorhandenes Verzeichnis.")
	var os_name := str(_os_name_provider.call()) if _os_name_provider.is_valid() else OS.get_name()
	match os_name:
		"Linux", "macOS", "FreeBSD", "NetBSD", "OpenBSD", "BSD":
			return _probe_posix(absolute_existing_directory, os_name)
		"Windows":
			return _probe_windows(absolute_existing_directory)
		_:
			return _failure("Volume-Kapazität wird auf dieser Plattform nicht unterstützt.", os_name)


func _probe_posix(path: String, os_name: String) -> Dictionary:
	var executed := _execute("/bin/df", PackedStringArray(["-Pk", path]))
	if not executed.get("ok", false):
		return _failure("POSIX-Volume-Probe konnte nicht ausgeführt werden.", os_name, executed)
	var lines: Array[String] = []
	for raw_line in str(executed["output"]).replace("\r", "").split("\n", false):
		var line := str(raw_line).strip_edges()
		if not line.is_empty():
			lines.append(line)
	if lines.size() < 2:
		return _failure("POSIX-Volume-Probe lieferte keine Datenzeile.", os_name)
	var fields: PackedStringArray = lines.back().replace("\t", " ").split(" ", false)
	if fields.size() < 6:
		return _failure("POSIX-Volume-Probe lieferte keine portable Feldfolge.", os_name)
	var total_blocks := str(fields[1])
	var available_blocks := str(fields[3])
	if not total_blocks.is_valid_int() or not available_blocks.is_valid_int():
		return _failure("POSIX-Volume-Probe lieferte ungültige Blockzahlen.", os_name)
	var total_bytes := _checked_kibibytes(total_blocks.to_int())
	var available_bytes := _checked_kibibytes(available_blocks.to_int())
	if total_bytes <= 0 or available_bytes < 0 or available_bytes > total_bytes:
		return _failure("POSIX-Volume-Probe lieferte widersprüchliche Kapazitätswerte.", os_name)
	var mount_parts := PackedStringArray()
	for index in range(5, fields.size()):
		mount_parts.append(str(fields[index]))
	return {
		"ok": true,
		"available_bytes": available_bytes,
		"volume_capacity_bytes": total_bytes,
		"volume_root": " ".join(mount_parts),
		"probe_backend": "posix-df-pk",
		"platform": os_name,
	}


func _probe_windows(path: String) -> Dictionary:
	var executed := _execute(
		_windows_powershell_executable(),
		PackedStringArray(["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", WINDOWS_SCRIPT, path])
	)
	if not executed.get("ok", false):
		return _failure("Windows-Volume-Probe konnte nicht ausgeführt werden.", "Windows", executed)
	var fields: PackedStringArray = str(executed["output"]).strip_edges().split("|", true, 2)
	if fields.size() != 3 or not str(fields[0]).is_valid_int() or not str(fields[1]).is_valid_int():
		return _failure("Windows-Volume-Probe lieferte keine gültige DriveInfo-Antwort.", "Windows")
	var total_bytes := str(fields[0]).to_int()
	var available_bytes := str(fields[1]).to_int()
	var volume_root := str(fields[2]).strip_edges()
	if total_bytes <= 0 or available_bytes < 0 or available_bytes > total_bytes or volume_root.is_empty():
		return _failure("Windows-Volume-Probe lieferte widersprüchliche Kapazitätswerte.", "Windows")
	return {
		"ok": true,
		"available_bytes": available_bytes,
		"volume_capacity_bytes": total_bytes,
		"volume_root": volume_root,
		"probe_backend": "windows-driveinfo",
		"platform": "Windows",
	}


func _execute(executable: String, arguments: PackedStringArray) -> Dictionary:
	if _process_executor.is_valid():
		var injected = _process_executor.call(executable, arguments)
		if not injected is Dictionary:
			return {"ok": false, "status": "invalid_executor_result"}
		if int(injected.get("exit_code", -1)) != 0:
			return injected
		return {"ok": true, "output": str(injected.get("output", ""))}
	var output: Array = []
	var exit_code := OS.execute(executable, arguments, output, true)
	if exit_code != 0:
		return {
			"ok": false,
			"status": "process_failed",
			"exit_code": exit_code,
		}
	return {"ok": true, "output": str(output[0]) if not output.is_empty() else ""}


func _windows_powershell_executable() -> String:
	var system_root := OS.get_environment("SystemRoot").strip_edges()
	if system_root.is_empty():
		return "powershell.exe"
	return system_root.path_join("System32/WindowsPowerShell/v1.0/powershell.exe")


func _checked_kibibytes(blocks: int) -> int:
	if blocks < 0 or blocks > MAX_SAFE_KIBIBYTES:
		return -1
	return blocks * KIBIBYTE


func _failure(message: String, platform: String = "", cause: Dictionary = {}) -> Dictionary:
	var result := {
		"ok": false,
		"status": "storage_probe_error",
		"error": message,
	}
	if not platform.is_empty():
		result["platform"] = platform
	if not cause.is_empty():
		result["cause"] = cause
	return result
