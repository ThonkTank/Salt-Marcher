# CITY-01: Vorschlag zum bestehenden Atlasanschluss

Planlauf CITY-01-INTEGRATION-P01; angefragt vom Atlasbesitzer nach HEX-02-N01. Dies ist ein quellenbasierter Vorschlag für den konkreten HEX-04/05-Vertrag, keine bereits vereinbarte API und keine vorgezogene CITY-01-Abnahme. Voraussetzungen der Stadtroadmap bleiben HEX-05 und anschließend CITY-01 bis CITY-04.

## Vorhandene Anschlüsse

- `src/features/atlas/atlas-renderer.ts`: eine Application, `detailLayer`, Kamera/Viewport, `worldPoint`, ein `schedule`/`draw`-Frame. `changed()` läuft derzeit **nach** `application.render()`.
- `src/features/atlas/atlas-editor.ts`: Pointercapture, Werkzeugwahl, Queue, Historysubscriber, Flush/Discard/Destroy. `terrain.history` ist die gemeinsame History. Subscriber ruft `storage.changed()`; das beweist noch keine Stadtpersistenz.
- `src/features/city/commands.ts`: CitySource registriert einmal eine Dokumentkennung in der übergebenen AtlasHistory; Änderungen besitzen vollständige validierte Before/After-Dokumente.
- `city/scene.ts`, `gestures.ts`, `renderer.ts`: meterbasierte Szene/Treffer, beginbasierte CityGesture-Vorschau und Apply/Cancel, CityRenderer ohne Kamera, RAF oder Persistenz.
- `atlas-repository.ts` und `atlas-draft.ts`: heutiger Snapshot/Entwurf/Save verarbeitet Welt und Terrainchunks. Der strikte Entwurf lässt keine Stadtdateien zu. CitySource allein einzuhängen würde keine wiederherstellbare Stadt speichern.

## Konkrete Integrationsfolge

1. HEX-03 liefert stabile Orts-/Weltplatzierung und deren gemeinsam journalisierte Speicherung; HEX-04/05 liefert die tatsächlich vereinbarte Welt-/Lokalabbildung und denselben Frame-/Pointerbesitz für Dungeon und Stadt. City erfindet keine zweite Placementdatenhaltung.
2. Atlas hält CitySource und CityRenderer für die Lebensdauer des geladenen Stadtbesitzers. Quelle einmal in derselben History registrieren, Rendercontainer einmal an detailLayer hängen. Nie im Zeichenframe neu registrieren/hydrieren. Fremde oder kollidierende Kennung sichtbar ablehnen; vorhandene fachliche IDs nicht still umbenennen.
3. Im vorhandenen `draw` **vor** `application.render()` die aktuelle Szene oder gültige Vorschau mit der Platzierung und aktuellen Kamera/Viewport zeichnen. Nachgeschaltetes `changed()` ist dafür zu spät. Kein eigener RAF und kein gespeicherter Kameracallback im CityRenderer. Pan, Zoom, Resize und Historyänderung benutzen denselben Frame.
4. Vor Beginn der Stadtgeste wandelt der Atlas Pointer → Viewport → Welt → Stadtmeter um und bindet Source, Ziel-ID sowie Anfangspointer. Aktueller gemeinsamer Router führt Updates, Apply oder Cancel aus. CityGesture verändert Werkzeugwahl/Capture nicht. Trefferreihenfolge folgt sichtbarer Ebenenreihenfolge; Höfe bleiben transparent. Zwischen Hex, Stadt und Dungeon keine Kontext-/Betretenaktion.
5. Ein erfolgreicher Apply geht durch dieselbe History und bestehende Persistenzqueue. Die noch zu erweiternde gemeinsame Snapshot-/Entwurf-/Journalstrecke muss Stadtdatei und Platzierung zusammen erfassen, Konflikte vor Schreiben prüfen und frische Wiederherstellung ermöglichen. Kein lokaler Stadt-Autosave neben dem Atlasjournal. Undo/Redo und Discard erhalten Stadtbesitzer/Dateien genauso wie Terrain.
6. Flush/Save/Sourcewechsel beenden ausstehende Gesten mit ausdrücklich vereinbarter Policy. Aktuell schließt Terrain bei pointercancel/blur via finishStroke ab; CityDraft.cancel schreibt nichts. Diese unterschiedlichen Regeln dürfen nicht unbemerkt vermischt werden. Danach Capture lösen, Vorschau/Quellenbindungen entfernen und CityRenderer vor dem übergeordneten Application-Destroy genau einmal freigeben. Späte Lade-/Speicherantworten dürfen den neuen Sourcezustand nicht verändern.

## Im HEX-04/05-Plan gemeinsam festzulegen

Platzierungsbesitz und validierte Transformation; Zeitpunkt des Detailzeichnens vor Render; Auswahl-/Trefferpriorität und meterbasierte Toleranz aus Bildschirmabstand; Lebensdauer geladener Owner; gemeinsame Gestenabschluss-/Cancelpolicy; vollständige City-/Placement-Snapshot-, Journal-, Discard- und Konfliktwiederherstellung. Es existiert derzeit kein zugesagter Frame-Subscriber/Cityhitrouter. Bei nicht gleichförmiger affiner Platzierung genügt ein einzelner lokaler Kreisradius nicht für exakte konstante Bildschirmtoleranz; dies muss am tatsächlichen Transformvertrag gelöst werden.

## Abnahmefolge nach Anschluss

Native Stadt am Ort mit Straße, Platz und zwei Häusern anlegen; Straße/Knoten und Haus bewegen, drehen und skalieren; Cancel/No-op/Stale prüfen. Zwischen Stadt und Hex zoomen und bearbeiten, gemeinsame Undo/Redo-Folge, Save und frischer Prozess. Hausbindung und Dungeon-/Keyfolge anschließend in CITY-03. Viewportresize, große Weltposition, lokale Metergeometrie, Höfe und Breiten bleiben deckungsgleich. Unterbrochener Mehrdateisave, fremde Bytes und Sourcewechsel gehören zur Persistenzabnahme. Keine eigene zweite Editorinstanz; bestehende Testregion und native GUI-Slotkoordination nutzen. Lokale Unit-/Rendererprüfungen ersetzen diese Hostfolge nicht.

Verweise, Quellenstand und offene Vertragspunkte mit dem Anschlussbeitrag pflegen; vorgeschlagene Grenzen nicht als implementierte APIs ausgeben. Dieser Vorschlag bewahrt den damaligen Quellstand. Vor Weiterarbeit vorhandene Anschlüsse nach dem [CITY-01-Anschlussplan](ROADMAP-CITIES-CITY01-INTEGRATION-PLAN.md) verwenden; keine erneute Plan-/Cleanup-Folge dieses historischen Vorschlags starten.

R01-Aufräumen: Befundabschluss gilt ausschließlich für den Anschlussvorschlag. Quellen und Gegenprobe sind unter /home/aaron/.cache/dungeon-native-qa/city-plans/city01-integration-review-20261009/ erhalten. Keine Produktsource/API durch diesen Dokumentlauf geändert.

## Nachbesserung N01 aus R01

- **R01-01, relative Koordinatenkomposition:** Vorwärtszeichnung muss lokale Stadtmeter erst nach Bildung des kamera-/platzierungsrelativen großen Offsets addieren. Beim Pointerweg darf keine kleine Bildschirmverschiebung erst zu einer großen absoluten Weltkoordinate addiert und anschließend der Platzierungsanker abgezogen werden. Die konkrete gemeinsame Transformfunktion bleibt HEX-04/05-Besitz. Keine zweite Kamera, kein getrennt gespeichertes City-Weltkoordinatenmodell. Gegenprobe: Weltanker/Kameramitte1e16, .01m/Pixel, lokaler Punkt(.01,.01) muss1px Verschiebung ergeben und wieder in denselben lokalen Punkt umkehrbar sein. Rotation, Größenwechsel, große entfernte Platzierungen und unauflösbare Eingaben zusätzlich prüfen. Eine generische absolute worldToScreen-Komposition reicht dafür nicht.
- **R01-02, gültige Placement-/Entwurfsstrecke:** `OverworldDocument.placements: never[]` und `parseOverworld` lehnen derzeit belegte Platzierungen ab. `AtlasDraft.sameWorld` lässt gegenüber der Basis nur Chunkänderungen zu. HEX-03/04 muss ein explizit validiertes neues natives Placement-/Entwurfsschema einschließlich Versionsentscheidung bereitstellen. Unbekannte Formate erhalten und sichtbar abweisen; keine stillen Felder anhängen. CITY speichert Stadt- und Placementänderungen erst über die gemeinsam erweiterte Snapshot-/Journalstrecke. Tests müssen Platzierungsanlage/-verschiebung, unterbrochenes Journal, Discard und frisches Laden tatsächlich abdecken.
- **R01-03, gemeinsames Einpassen:** Die belegte Ausdehnung für Fit kommt aus Terrain sowie sichtbaren geladenen Stadt-/Dungeoninhalten und ihren tatsächlichen Weltbindungen. Stadt-only, weit entfernte Stadt und leere Szene sind explizite Fälle. `CityScene.extent === null` trägt keine falschen Ursprungspunkte bei; vorhandene Szenengrenzen werden über die vereinbarte Platzierung abgebildet. Kein privater City-Fit und keine Kameraverlagerung beim bloßen Zoom-/Detailwechsel. Große Grenzen müssen in der gleichen präzisen relativen Abbildung verarbeitet werden.

Diese Punkte sind verbindliche Umsetzung-/Abnahmepflichten des Anschlusses, keine bereits existierenden Shared-APIs. R02 kann die Vollständigkeit dieses Vorschlags prüfen; formale gemeinsame Vertragsfreigabe und sichtbare Produktabnahme bleiben separat offen.

N01-Aufräumen: Befundabschluss gilt ausschließlich für den Anschlussvorschlag. Quellen und Gegenprobe sind unter /home/aaron/.cache/dungeon-native-qa/city-plans/city01-integration-review-20261009/ erhalten. Keine Produktsource/API durch diesen Dokumentlauf geändert.

R02-Aufräumen: Befundabschluss gilt ausschließlich für den Anschlussvorschlag. Quellen und Gegenprobe sind unter /home/aaron/.cache/dungeon-native-qa/city-plans/city01-integration-review-20261009/ erhalten. Keine Produktsource/API durch diesen Dokumentlauf geändert.

HEX03-Peerreview: Exakter Plan cb869951a1bb5aad43fa422794247268669e04b2 enthält die drei Anschlussauflagen sowie die frühe native Ortsfolge und vollständige Copy/Discard/Recovery. Aus City-Planperspektive keine zusätzliche Pflichtlücke; keine Produkt-/API-/gemeinsame Vertragsfreigabe. Beleg: /home/aaron/.cache/dungeon-native-qa/city-plans/hex03-owner-plan-review-20261009/review.json.
