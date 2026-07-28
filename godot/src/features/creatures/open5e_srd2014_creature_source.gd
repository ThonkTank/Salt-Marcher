class_name Open5eSrd2014CreatureSource
extends RefCounted

## GET-only operator source for the pinned Open5e V2 2014 SRD Creature feed.

const API_HOST := "api.open5e.com"
const CREATURES_PATH := "/v2/creatures/"
const DOCUMENT_PATH := "/v2/documents/srd-2014/"
const DOCUMENT_KEY := "srd-2014"
const PAGE_SIZE := 100
const REQUEST_TIMEOUT_MSEC := 30_000

var _client := HTTPClient.new()


func fetch_corpus(progress_callback: Callable = Callable()) -> Dictionary:
	var source_document := _fetch_json(DOCUMENT_PATH)
	if not source_document.get("ok", false):
		return source_document
	var results: Array = []
	var expected_count := -1
	var page := 1
	while true:
		var path := "%s?document__key__in=%s&limit=%d&page=%d&ordering=key" % [
			CREATURES_PATH, DOCUMENT_KEY, PAGE_SIZE, page,
		]
		var fetched := _fetch_json(path)
		if not fetched.get("ok", false):
			return fetched
		var document: Variant = fetched.get("document")
		if not document is Dictionary or not document.get("results") is Array:
			return _source_failure("Öffentliche Monster-Seite besitzt kein Ergebnisfeld.")
		var count = document.get("count")
		if not _whole_number(count) or int(count) <= 0:
			return _source_failure("Öffentliche Monster-Seite besitzt keine gültige Gesamtzahl.")
		if expected_count < 0:
			expected_count = int(count)
		elif expected_count != int(count):
			return _source_failure("Öffentlicher Monster-Korpus änderte sich während des Abrufs.")
		for entry in document["results"]:
			results.append(entry)
		if progress_callback.is_valid():
			progress_callback.call(mini(results.size(), expected_count), expected_count)
		var next_value = document.get("next")
		if next_value == null:
			break
		if not next_value is String or not str(next_value).begins_with("https://%s%s?" % [API_HOST, CREATURES_PATH]):
			return _source_failure("Öffentliche Monster-Seite verweist außerhalb des festgelegten Feeds.")
		page += 1
		if page > int(ceil(float(expected_count) / float(PAGE_SIZE))) + 1:
			return _source_failure("Öffentliche Monster-Pagination besitzt keine endliche Grenze.")
	_client.close()
	if results.size() != expected_count:
		return _source_failure("Öffentlicher Monster-Korpus ist unvollständig.")
	return {
		"ok": true,
		"status": "fetched",
		"source_document": source_document["document"],
		"count": expected_count,
		"results": results,
	}


func _fetch_json(path: String) -> Dictionary:
	var deadline := Time.get_ticks_msec() + REQUEST_TIMEOUT_MSEC
	var connected := _ensure_connected(deadline)
	if not connected.get("ok", false):
		return connected
	var request_error := _client.request(
		HTTPClient.METHOD_GET,
		path,
		PackedStringArray(["Accept: application/json", "User-Agent: SaltMarcher-Godot-Creatures-Import"])
	)
	if request_error != OK:
		_client.close()
		return _source_failure("Öffentliche Monster-Anfrage konnte nicht gesendet werden.")
	while _client.get_status() == HTTPClient.STATUS_REQUESTING:
		_client.poll()
		if Time.get_ticks_msec() >= deadline:
			_client.close()
			return _source_failure("Öffentliche Monster-Anfrage hat das Zeitlimit überschritten.")
		OS.delay_msec(5)
	if not _client.has_response() or _client.get_response_code() != 200:
		var status_code := _client.get_response_code()
		_client.close()
		return _source_failure("Öffentliche Monster-Anfrage lieferte HTTP %d." % status_code)
	var bytes := PackedByteArray()
	while _client.get_status() == HTTPClient.STATUS_BODY:
		_client.poll()
		var chunk := _client.read_response_body_chunk()
		if not chunk.is_empty():
			bytes.append_array(chunk)
		if Time.get_ticks_msec() >= deadline:
			_client.close()
			return _source_failure("Öffentliche Monster-Antwort hat das Zeitlimit überschritten.")
		if chunk.is_empty():
			OS.delay_msec(2)
	var parsed = JSON.parse_string(bytes.get_string_from_utf8())
	if not parsed is Dictionary:
		return _source_failure("Öffentliche Monster-Antwort enthält kein gültiges JSON-Dokument.")
	return {"ok": true, "document": parsed}


func _ensure_connected(deadline: int) -> Dictionary:
	if _client.get_status() == HTTPClient.STATUS_CONNECTED:
		return {"ok": true}
	_client.close()
	var connect_error := _client.connect_to_host(API_HOST, 443, TLSOptions.client())
	if connect_error != OK:
		return _source_failure("Öffentliche Monster-Quelle konnte nicht verbunden werden.")
	while _client.get_status() in [HTTPClient.STATUS_RESOLVING, HTTPClient.STATUS_CONNECTING]:
		_client.poll()
		if Time.get_ticks_msec() >= deadline:
			_client.close()
			return _source_failure("Öffentliche Monster-Quelle hat beim Verbindungsaufbau das Zeitlimit überschritten.")
		OS.delay_msec(5)
	if _client.get_status() != HTTPClient.STATUS_CONNECTED:
		_client.close()
		return _source_failure("Öffentliche Monster-Quelle ist nicht erreichbar.")
	return {"ok": true}


func _whole_number(value: Variant) -> bool:
	return value is int or (value is float and is_equal_approx(float(value), floorf(float(value))))


func _source_failure(message: String) -> Dictionary:
	return {"ok": false, "status": "source_error", "error": message}
