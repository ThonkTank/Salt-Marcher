# HEX-03: ein Ort mit Key direkt auf der Hexkarte

Voraussetzung: HEX-02-Inselablauf, unabhängiger R01/R02 und getrenntes Aufräumen im dokumentierten Umfang abgeschlossen. [Atlas-Roadmap](ROADMAP-HEX-ATLAS.md), [Stadtanschlussvorschlag](ROADMAP-CITIES-ATLAS-INTEGRATION-PROPOSAL.md) und [Architektur](ARCHITECTURE.md) bleiben verbindlich. Verantwortlich: Hex/Atlas; eigener Paketbranch `hex/hex03-p01-20261009`. Dungeon-/City-/SMR-Besitz und deren Belege bleiben getrennt.

**Benutzbares Ergebnis:** Auf derselben Karte Stadt oder POI setzen → Namen und zwei Markdown-Abschnitte rechts bearbeiten → Abschnitte ordnen → Ort direkt verschieben → Hex weiterzeichnen → gemeinsame Undo/Redo-Folge → speichern → frischer Prozess → denselben Ort und Abschnitt wiederfinden. Keine andere Editorinstanz, kein Ortsmodus. Der Stadtmarker ist ein Orts-Key; gezeichnete Stadtpläne folgen mit dem bereits vorbereiteten Citykern.

## Konkrete Daten- und Besitzentscheidung

- Neues `.location`, `kind=location`, Version1: stabile Dokument-ID, Name, `type=city|poi`, geordnete Abschnitte mit eigener ID, Titel und unverändertem Markdown, sowie explizite Detail-/Keyverweise. Parser prüft geschlossene Objekte, dichte Listen, eindeutige IDs und native Werte **vor** JSON-Konversion; unbekannte Daten/Versionen werden erhalten und abgewiesen. Ein Ort enthält keine Weltposition oder Kamera.
- Die reservierte `placements`-Liste der Overworld-Version1 erhält einen ausdrücklich validierten ersten Typ `location`: stabile Platzierungs-ID, `locationId` und Weltposition in Metern. Bestehende gültige leere Overworlds bleiben unverändert lesbar. Kein stilles Hinzufügen ungeprüfter Felder; neue City-/Dungeon-Platzierungstypen bleiben HEX-04/05. Ein Ort wird pro Welt zunächst einmal platziert. Ortsdokument und Platzierung haben getrennte IDs.
- Welt-/Terrainwerte verwenden **denselben** Weltowner in AtlasHistory. Der Weltvalidator wird um das ausdrücklich benannte Platzierungsziel erweitert; kein zweiter Worldowner oder paralleler Befehlsstapel. LocationSource ist einmal pro Dokument/Historylebensdauer registriert und hält den aktuellen Wert allein in History. `null` ist die ausdrücklich validierte Abwesenheit für gemeinsame Anlage/Entfernung. Undo entfernt die ganze Anlage; Redo verwendet dieselben IDs. Owner bleiben für die Historylebensdauer registriert.
- Ein einheitliches Key-Ziel benennt Art, Dokument-ID, optional Raum-/Abschnitts-ID und Atlas-ID für den räumlichen Fokus. Vorhandene Dungeon-Raumlinks bleiben erhalten; der neue Ortspfad wird zunächst hinzugefügt. Keine falsche Raumhülle um einen Orts-Key. Ein enger Key-Panel-Adapter verwendet Markdownanzeige, Vorschau, Übernehmen/Verwerfen und stabile Abschnittsauswahl nach vorhandenen Bedienmustern; der Dungeonadapter wird erst gemeinsam in HEX-05 angeschlossen.

## Frühe sichtbare Umsetzung statt weiterer Vorarbeiten

| Lauf | Konkretes Ergebnis | Unmittelbares Tor |
|---|---|---|
| I01a | Location-Codec, geprüfte Platzierungs-/Key-Ziele und Location-History-Befehle | Geschlossene Schema-/Text-/ID-Prüfung; Ortanlage/Entfernung/Änderung, stale/duplicate/no-op; atomare reale Terrain+Location-Undo/Redo-Folge. Noch keine Aktivierung belegter Worldplacements ohne Speicherstrecke. |
| I01b | Weltplacement, Name/Typ/Marker, rechter Key, Verschieben und vollständige Speicherung anschließen | **Erster tatsächlicher nativer Ortsablauf** auf der vorhandenen Insel: zwei Orte, Text, Reihenfolge, Drag, Hex, gemeinsame History, Save und frischer Prozess. Diese Bedienprüfung kommt vor weiteren Link-/Komfortfunktionen. |
| I01c | ID-Index, direkte Abschnittslinks, Umbenennung und gezielte Unterbrechungen vervollständigen | Tatsächliches Linköffnen nach `.location`-/Atlas-Dateiumbenennung und frischem Prozess; beschädigte/fehlende/mehrdeutige Dokumente sichtbar, keine Ersatzorte. Mehrdatei-Unterbruch/externes CAS schützen Text und Referenzen. |
| R01/N | Unabhängiger Fachreview und erforderliche Reparaturen | Exaktes Kandidaten-SHA, Text-/Referenz-/UI-/Speicherwirkung; kein Phasen-Go aus Kernzahlen. |
| CLEAN-P/I/R | Getrenntes begrenztes Aufräumen | Danach HEX-04/05 mit konkreter gemeinsamer City-/Dungeon-Anschlussgrenze. |

## Speicherstrecke ist Teil der sichtbaren Ortsfunktion

AtlasRepository-Snapshots erfassen Weltplatzierungen, Terrain und alle ausdrücklich geänderten Locationowner; ungeladene referenzierte Dokumente gelten niemals als leer. Neu angelegte Ortsdateien liegen zunächst unter `Orte/<id>.location`; Dateiumbenennung verändert keine fachliche Referenz. Der ID-Index löst den aktuellen Pfad auf und weist doppelte IDs ab. Exakte Baselinebytes und gemeinsam validierte Before/After-Zustände schützen vorhandene Orte.

Ein neuer streng geprüfter Atlasentwurf Version2 ergänzt die Locationdeltas und Placementänderungen. Die bestehenden aktuellen Terrainentwürfe Version1 bleiben exakt geprüft lesbar; ihr Chunk-only-Vertrag wird nicht still als Ortsentwurf ausgelegt. Die gemeinsame FileTransaction schreibt Kinddateien, Weltverweise und den eigenen Draft mit demselben Vaultscope. Save erfasst seinen Aufrufstand; späte Texte/Drags bleiben als neuer Draft erhalten. Discard ersetzt sämtliche betroffenen Quellen gemeinsam bei unveränderter Kamera/Werkzeugwahl. Ein unübernommener Key-Text wird vor Save/Navigation entweder erfolgreich übernommen oder sichtbar erhalten; Texteingabe löst keine Kartenaktionen aus.

**Kopie muss vollständig bleiben:** Sobald Ortsplacements aktiviert werden, kopiert SaveAs sämtliche zugehörigen Ortsdokumente unter neuen Dokument-/Platzierungs-IDs und remappt eigene interne Keyverweise. Keine stillen gemeinsamen Ortsdateien oder verwaisten Verweise. Die explizite Copy-Recovery akzeptiert dann nur die exakt geschlossene neue Zielwelt mit Terrain und ihren neuen Locations. Externe Detailkartenverweise bleiben identifizierte Referenzen; City-/Dungeon-Geometriekopie wird nicht vor ihrer späteren Besitzentscheidung behauptet. Kopie/Discard/Recovery sind Pflichtteile von I01b, keine nachträglichen offenen Helfer.

## Gemeinsame Fläche und direkte Links

Ortsmarker und Namen liegen im bestehenden Atlas-Renderframe. Auswahl und Key sind Teil desselben Editors; Zoomen erzeugt keinen Ortsmodus. Ortshandles verwenden dieselben Pointer-/Capture-/Flushregeln und die gemeinsame History. Fit berücksichtigt Terrain und Ortspositionen, darunter Ort-only, weit entfernte Orte und leere Inhalte. Kameraänderungen erzeugen keine Dokumentwerte.

Der Index enthält stabile IDs statt dauerhafter Pfadreferenzen; aktuelle Vault-Create/Modify/Rename/Delete-Ereignisse aktualisieren ihn, frisches Öffnen baut ihn neu auf. Der Link nennt Atlas und Location/Abschnitt. Er fokussiert das vorhandene Atlasblatt und öffnet dort den rechten Key. Fehlender/mehrdeutiger Owner oder Abschnitt ergibt einen verständlichen Fehler; kein stiller anderer Ort. Ein Index allein ist kein Beweis für konfliktfreies Speichern nach Rename: Repositorybasen und noch offene Drafts müssen ebenfalls am wirklichen Pfad validiert bleiben. Der Umbenennungslauf ist darum ausdrücklich ein natives Tor.

## Aus dem Stadtvorschlag übernommene Anschlussauflagen

HEX-03 liefert nur den ersten geprüften Weltpunkt und Mehrdateivertrag. HEX-04/05 entscheidet und implementiert die konkreten City-/Dungeon-Transforms und Router zusammen mit den Besitzern:

- Detailzeichnung **vor** `application.render()`, in `AtlasRenderer.detailLayer`; der bisher nachgeschaltete `changed()`-Callback ist kein Zeichenhook.
- Relative Vorwärts-/Inversekomposition erhält kleine Stadtmeter an großen Weltankern. Gegenprobe: Anker/Kameramitte `1e16`, `0.01 m/px`, lokaler Punkt `(0.01,0.01)` bleibt um einen Pixel versetzt und korrekt invertierbar. Keine erst gerundete absolute Summe; unauflösbare Eingaben sichtbar abweisen. Erst HEX-04/05 liefert diesen Transform, keine heute konsumierbare API.
- Owner-/Renderer-Lebensdauer, räumliche Trefferfolge, transparente Höfe und Fit aus echten Detailausdehnungen; City-only/ferne/leere Szene prüfen. Keine neue Kamera, RAF oder History.
- Terrain beendet heute pointercancel/blur durch Abschluss; CityGesture.cancel verwirft. Die gemeinsame konkrete Abschluss-/Cancelpolicy muss ausdrücklich festgelegt und direkt getestet werden.
- City-/Placement-Snapshots, Draft, Journal, Konflikt/Discard und Sourcewechsel gemeinsam erweitern. Ein Rendercontainer oder CitySource allein ist keine gespeicherte Stadt.

## Nachweise und Grenzen

Neue gezielte Core-/Adaptertests nur für die benannten Daten-/History-/Speicherfehler. Schlanke check/test/build-Gates, genaue Buildtriplets und normale isolierte Hostexits. Echte Bilder und Texte ansehen; Wortlaut und IDs nach Neuöffnung vergleichen. Fremde Checkpointwurzeln, lokale Teständerungen, Originalkarten/Belege und Nutzervault bleiben geschützt. Laufanfang/-ende und konkrete SHAs über Issue1 koordinieren; regelmäßig normal veröffentlichen und Upstream integrieren.

Native Ortfunktion, vollständiger gemeinsamer Zoom, Cityerzeugung, sämtliche Hexstufen, Wonderdraft-Parität, Großwelt, physische Eingabe und Installation bleiben jeweils eigene Nachweise. Dieser Plan schließt keine dieser Abnahmen vorweg.

## I01b-Zwischenstand: gemeinsamer Entwurfcodec

HEX-03-I01b-draft2 auf `05f4f5c` erfasst Version2 mit Ortsbytes und Placements sowie Terrain; sechs neue Fälle, tatsächlicher FileTransaction-Rollback/Retry und saubere check/test403/build bestanden. Version1 bleibt separat lesbar. Das ist noch kein Repository-/Marker-/Key-/Hostanschluss. Nächster Schritt bleibt der vollständige gemeinsame Speicherweg, unmittelbar danach der erste native Ortsablauf. Neue Fachübergaben werden in Issue #7 geführt, Bereichsrisiken zur Plattform in Issue #11; Issue #1 dient nur dem übergreifenden Index.

## I01b-Zwischenstand: Repository-Speicheranschluss

`HEX-03-I01b-repository` auf `adebea3` verbindet Worldplacements und Locationowner mit der gemeinsamen History und vollständigem V2 Save/Copy/Discard/Recovery. Elf gezielte Fälle und sauberer check/test417/build bestanden: ungeladene Orte bleiben erhalten, Kopien erhalten eigene Orts-/Placement-IDs und umgebogene interne Keyziele, späte Keybearbeitung bleibt nach Save als neuer Entwurf bestehen. Ortsjournal-Besitzprüfung gilt auch bei interner Transaction-Recovery; Konflikte erhalten fremde Bytes. Der aufgelöste Pfadadapter ist noch kein Vault-ID-Index oder nativer Renamebeleg.

**Unmittelbar weiter mit Marker/Key/Drag/Fit und dem ersten Obsidian-Ortsablauf samt frischem Prozess.** Der bestehende Host bleibt bis zum vollständigen UI-Anschluss geschlossen; die Speicherstrecke ist ausdrücklich opt-in. Keine Link-/Komfortarbeit davor, keine HEX-03-Phasenfreigabe aus Kernprüfungen. Fachreview, Nachbesserung und Aufräumen bleiben getrennte Läufe.

## Gemeinsames E2E-Gate vor dem nächsten sichtbaren Schnitt

Die [Hex-Traceability-Entscheidung und der feste eigene Fixture-Anteil](ROADMAP-HEX-ATLAS-E2E-PLAN.md) ordnen Marker/Key/Drag/Fit und HEX-04/05 dem gemeinsamen E2E-01 zu. Issue #12 bestätigt zuvor Integrationsregel, Steward/Reviewer, Ownerbindungen und Planreview. Ein reiner Orts-Kern- oder Hostbeleg bleibt davon getrennt; keine stellvertretende City-/Dungeon-/Plattformratifikation. Danach unmittelbar der erste sichtbare Ortsablauf, vor Detaillinks.
