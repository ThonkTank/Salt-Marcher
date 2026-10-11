---
area: city
owner: Stadt
issue: 92
status: active
checkpoint: cityExecution
---
# Gebäudenamen im gemeinsamen Atlas bearbeiten

Nutzerweg: vorhandenes Haus auswählen → Namen exakt bearbeiten → gemeinsames
Undo/Redo → Save → frischer Prozess erhält Namen und Hausgeometrie.
[#92](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/92)
gehört zur individuellen Hauskorrektur in CITY-01/CITY-04. Volle Stadtparität und
bessere Bedienung bleiben der Gesamtumfang; dieser Weg ist keine Gesamtfreigabe.

## Arbeitsstand #92

Branch city/building-name-inspector auf Shared ca29032. Erste Fachaktion
`set-building-name` in CityEdit ist umgesetzt. Bestehender Citycodec prüft den
vollständigen Endzustand; Namensbytes werden weder getrimmt noch normalisiert.
IDs, Grundriss samt Hof, Pose, Plotreferenz und andere Elemente bleiben erhalten.
Der vorhandene CitySource/cityDocumentChange-Anschluss verwendet AtlasHistory;
kein zusätzlicher Store, Snapshot-, Kamera- oder Publishvertrag.

Zwei direkte Gegenproben FAIL vor/PASS nach Implementierung: exakte Namensänderung
mit unveränderten übrigen Daten und Undo/Redo; ungültiger Name, fehlendes/fremdes
Element, doppeltes Schreibziel, Getter ohne Aufruf und stale Beforebasis ohne
Teilpublikation. 576 gebaute Kerntests PASS. Typprüfung/Build/Repositoryprüfung PASS. Unabhängiger Fachbefehlreview
[CITY-BUILDING-NAME-R01](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/93#pullrequestreview-5481404923) PASS auf 793a68e; dieser Befund betrifft noch nicht den neuen Inspector.

Der sichtbare Consumer ist im vorhandenen AtlasEditor umgesetzt und mit Hex
abgeglichen (#92/6103962651): CityHit liefert Owner/Building-ID; ein Hausklick
öffnet ein Namenstextfeld in derselben Keyseitenleiste. Der bestehende CityDraft
bindet die Eingabe an ihre Basis und dieselbe AtlasHistory. Apply, Escape,
Zur Karte, Auswahlwechsel, Undo/Redo und Save nutzen applyKeys; ungültige und
stale Eingaben bleiben sichtbar. Zurück zur Karte übernimmt zuerst und gibt
anschließend den Fokus zurück. Alte Feldcallbacks nach Hauswechsel sowie
History-ABA und widerrufener Context können keine neue Eingabe veröffentlichen.

Ein Textarea erhält auch vorhandene Zeilenumbrüche, Tabs und Leerzeichen ohne
Normalisierung. Interne Navigation darf unter ihrer vorübergehenden UI-Sperre
geprüft flushen; direkte Feldaktionen bleiben während der Sperre blockiert.
Die Cacheidentität berücksichtigt den tatsächlichen CitySource. Explizites
Verwerfen validiert die neue Basis, bevor der alte Entwurf abgelöst wird.

Schlussprüfung: vollständige Suite 1000 PASS / 0 FAIL / ein bestehender Skip;
Typprüfung, Produktbuild, Repositoryprüfung und Diffprüfung PASS.
Drei neue Managed-DOM-/Repositoryfälle PASS: synthetisch gepinnter CityHit am
Rendereranschluss durch den tatsächlichen Pointerrouter; exakter Hausname,
eine Leiste und unveränderte Kamera/Context/History; Undo/Redo, nativer Save und
neuer Hostmodellmount mit vollständiger Citygeometrie; ungültiger Name blockiert
Escape/Navigation, IME und Eingabesperre erhalten den Entwurf; alte Feldcallbacks,
History-ABA und queued Escape nach Contextwiderruf schreiben nicht. Fremde
Native-Dateien bleiben bytegleich; der eigene temporäre Atlasdraft wird gemäß
bestehendem Savevertrag entfernt. GPU-Initialisierung ist im DOM-Harness
ersetzt; Picking und echter Prozess-Neustart sind damit nicht qualifiziert.

## Verbleibende Umsetzung und Abnahme

1. Unabhängiger Review des sichtbaren Inspector-/Editor-Diffs auf exakter SHA;
   der vorher angefragte Fachbefehlreview bleibt getrennt im Umfang.
2. Frühe freie GM-Bedienprobe sowie isolierte native Save-/Frischstartprobe nach
   konkret abgestimmtem GUI-Slot; Nutzervault bleibt unberührt.
3. Reale Fehler-/Recovery- und physische Abnahme nach dem Fachvertrag.

DOM-/Repository-/Modellreopen-Belege sind keine GPU-, native GUI-/Prozess-,
Gesamt-E2E- oder Paritätsfreigabe. Kein Eingriff in #80-H01-Belege.

## Tatsächliche Hostprobe

`tools/host/city-building-name.cjs` ergänzt den bestehenden isolierten Harness
über `node tools/host-test.cjs --city-building-name` und separat `--restart`.
Eigenes `DUNGEON_QA_ROOT`, eigener Debugport und synthetischer Source-Vault;
Produktstand 0315b13, kein Nutzervault. Fixture-Entry/Citynavigation sind Bootstrap,
Hausklick läuft anschließend ohne gepinnten Hit durch tatsächliche Szene/Picking.
Haus B wird außerhalb seines Hofs selektiert. Invalider Name + Escape bleibt
sichtbar, korrigierter Unicode-/LF-/Tabtext + Escape wird genau übernommen;
Undo/Redo, cached Rückkehr/Zur Karte, Save mit vollständiger City-/Fremdbyteprüfung.
Zweiter Prozess prüft gespeicherte Hashes, echte Hausauswahl, Namensfeld, alle
Citydaten und leere frische History. Der bestehende Harness protokolliert Build,
Screenshots und normales Quit; physische und unabhängige GM-Abnahme bleiben offen.

Enger unabhängiger Inspector-R02 auf0315b13 ist PASS; Exact-SHA-CI38100640175
SUCCESS. Kein Pflichtbefund im UI-Diff. Atlas-QA hat seinen gleichzeitigen Scope
zugunsten des bestehenden Reviewers zurückgegeben, keine doppelte Abschlussrunde.
Erster tatsächlicher Versuch scheiterte vor Mutation: Bei Cityentry1m/px lag
der Hauspunkt(7,9) im Ortsmarkergriff; Orts-Key statt Haus-Key. FehlerPNG und
Lifecycle unter eigenem QA-Root erhalten, Prozess normal beendet/Exit0, keine
Zwangs-PIDs. Prüfer ergänzt sichtbaren Ctrl+Wheel-Zoom0.1m/px vor Picking.
Korrigierter Edit-/Freshlauf braucht die neue konkret angefragte Slotfreigabe;
noch kein nativer PASS. Produktcode bleibt bytegleich0315b13.
