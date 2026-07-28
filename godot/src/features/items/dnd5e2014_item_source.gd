class_name Dnd5e2014ItemSource
extends RefCounted

## GET-only operator source for the pinned public 2014 SRD item feeds.

const API_HOST := "www.dnd5eapi.co"
const API_ROOT := "https://www.dnd5eapi.co"
const EQUIPMENT_INDEX := "/api/2014/equipment"
const MAGIC_ITEM_INDEX := "/api/2014/magic-items"
const REQUEST_TIMEOUT_MSEC := 30_000

var _client := HTTPClient.new()


func fetch_corpus(progress_callback: Callable = Callable()) -> Dictionary:
	var equipment := _fetch_json(EQUIPMENT_INDEX)
	if not equipment.get("ok", false):
		return equipment
	var magic_items := _fetch_json(MAGIC_ITEM_INDEX)
	if not magic_items.get("ok", false):
		return magic_items
	var paths := _index_paths(equipment.get("document"), EQUIPMENT_INDEX)
	if not paths.get("ok", false):
		return paths
	var magic_paths := _index_paths(magic_items.get("document"), MAGIC_ITEM_INDEX)
	if not magic_paths.get("ok", false):
		return magic_paths
	var details := {}
	var all_paths: Array = paths["paths"] + magic_paths["paths"]
	for index in all_paths.size():
		var path_value = all_paths[index]
		var path := str(path_value)
		var detail := _fetch_json(path)
		if not detail.get("ok", false):
			return detail
		details[path] = detail["document"]
		if progress_callback.is_valid():
			progress_callback.call(index + 1, all_paths.size())
	_client.close()
	return {
		"ok": true,
		"status": "fetched",
		"equipment_index": equipment["document"],
		"magic_item_index": magic_items["document"],
		"details": details,
	}


func _fetch_json(path: String) -> Dictionary:
	var deadline := Time.get_ticks_msec() + REQUEST_TIMEOUT_MSEC
	var connected := _ensure_connected(deadline)
	if not connected.get("ok", false):
		return connected
	var request_error := _client.request(
		HTTPClient.METHOD_GET,
		path,
		PackedStringArray(["Accept: application/json", "User-Agent: SaltMarcher-Godot-Items-Import"])
	)
	if request_error != OK:
		_client.close()
		return _source_failure("Öffentliche Items-Anfrage konnte nicht gesendet werden.")
	while _client.get_status() == HTTPClient.STATUS_REQUESTING:
		_client.poll()
		if Time.get_ticks_msec() >= deadline:
			_client.close()
			return _source_failure("Öffentliche Items-Anfrage hat das Zeitlimit überschritten.")
		OS.delay_msec(5)
	if not _client.has_response() or _client.get_response_code() != 200:
		var status_code := _client.get_response_code()
		_client.close()
		return _source_failure("Öffentliche Items-Anfrage lieferte HTTP %d." % status_code)
	var bytes := PackedByteArray()
	while _client.get_status() == HTTPClient.STATUS_BODY:
		_client.poll()
		var chunk := _client.read_response_body_chunk()
		if not chunk.is_empty():
			bytes.append_array(chunk)
		if Time.get_ticks_msec() >= deadline:
			_client.close()
			return _source_failure("Öffentliche Items-Antwort hat das Zeitlimit überschritten.")
		if chunk.is_empty():
			OS.delay_msec(2)
	var parsed = JSON.parse_string(bytes.get_string_from_utf8())
	if not parsed is Dictionary:
		return _source_failure("Öffentliche Items-Antwort enthält kein gültiges JSON-Dokument.")
	return {"ok": true, "document": parsed}


func _ensure_connected(deadline: int) -> Dictionary:
	if _client.get_status() == HTTPClient.STATUS_CONNECTED:
		return {"ok": true}
	_client.close()
	var connect_error := _client.connect_to_host(API_HOST, 443, TLSOptions.client())
	if connect_error != OK:
		return _source_failure("Öffentliche Items-Quelle konnte nicht verbunden werden.")
	while _client.get_status() in [HTTPClient.STATUS_RESOLVING, HTTPClient.STATUS_CONNECTING]:
		_client.poll()
		if Time.get_ticks_msec() >= deadline:
			_client.close()
			return _source_failure("Öffentliche Items-Quelle hat beim Verbindungsaufbau das Zeitlimit überschritten.")
		OS.delay_msec(5)
	if _client.get_status() != HTTPClient.STATUS_CONNECTED:
		_client.close()
		return _source_failure("Öffentliche Items-Quelle ist nicht erreichbar.")
	return {"ok": true}


func _index_paths(document: Variant, endpoint: String) -> Dictionary:
	if not document is Dictionary or not document.get("results") is Array:
		return _source_failure("Öffentlicher Items-Index besitzt kein Ergebnisfeld.")
	var paths: Array[String] = []
	for value in document["results"]:
		if not value is Dictionary:
			return _source_failure("Öffentlicher Items-Index enthält einen ungültigen Eintrag.")
		var path := str(value.get("url", ""))
		if not path.begins_with(endpoint + "/"):
			return _source_failure("Öffentlicher Items-Index verweist außerhalb seines festgelegten Feeds.")
		paths.append(path)
	var count = document.get("count")
	if not _whole_number(count) or int(count) != paths.size() or paths.is_empty():
		return _source_failure("Öffentlicher Items-Index ist unvollständig.")
	return {"ok": true, "paths": paths}


func _whole_number(value: Variant) -> bool:
	return value is int or (value is float and is_equal_approx(float(value), floorf(float(value))))


func _source_failure(message: String) -> Dictionary:
	return {"ok": false, "status": "source_error", "error": message}
