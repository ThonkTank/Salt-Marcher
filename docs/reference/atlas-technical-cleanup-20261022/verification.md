# Abschlussprüfung der technischen Bereinigung

Ergänzt den [ersten Bereinigungsnachweis](README.md). Die erste Lieferung
trennte die Zustandsbesitzer; ihr kleiner Leistungstest und die fehlende
explizite A–B–A-Probe reichten für das vereinbarte Abschlusskriterium nicht aus.
Diese Nachprüfung bleibt auf technische Bereinigung begrenzt. Sie schließt
weder SMR-04/AC-05 noch die offenen P0–P8-Produktabnahmen.

## Aufrufwege und Erreichbarkeit

Der Importgraph wurde mit esbuild `bundle:true, write:false, metafile:true`
über zwölf aktive Einstiegspunkte auf Basis `6489d2913` erfasst. Er umfasst
672 Eingabemodule. Die Einstiegspunkte folgen `tools/build-desktop.mjs`:

- Main und Preload: `desktop/main.ts`, `desktop/preload.ts`.
- Worker: `atlas-region-worker.ts`, `terrain-route-worker.ts`,
  `room-directory-worker.ts`, `backup-validation-worker.ts` in `desktop/`;
  `terrain-spatial-worker.ts`, `atlas-brush-worker.ts` in `src/app/`.
- GM: `src/app/renderer.ts` und das separat gebaute, dynamisch geladene
  `src/app/preset-settings-ui.ts`.
- Spielerfenster: `desktop/player-preload.ts`, `src/app/player-display.ts`.

Die per Dateiname gestarteten Worker werden ausdrücklich als Wurzeln erfasst;
ein reiner Importgraph der GM-Oberfläche würde sie übersehen. Main erlaubt die
zugehörigen Browserressourcen über seine Protokollroute. Die Spielerprojektion
bleibt ein eigener, passiver Verbraucher mit eigener Preload-Grenze.
Kanonische Bereichs-/Trassen-/Archivzugriffe bleiben im Main-/Storage-Pfad.
`atlas-paint-svg.ts`, Rasterfallback, Export und die unterstützten
Kampagnendaten-/Medienleser sind weiterhin erreichbar und werden behalten.

Von 64 Dateien mit `atlas-`, `campaign-atlas` oder `landscape-` im Namen sind
57 im Laufzeitgraphen enthalten. Sechs weitere sind reine Typverträge:
`atlas-label-source`, `atlas-presentation`, `atlas-travel-contracts`,
`atlas-workbench-types`, `campaign-atlas-contracts`, `landscape-workbench-types`.
`atlas-position.ts` ist ein separat getesteter Adresscodec in
`tests/desktop-atlas-transition.test.mjs`; fehlende Laufzeitanbindung ist kein
Beweis für überflüssige Format-/Grundlagenprüfungen. Er bleibt erhalten.

## Begründete Entfernungen

Eine Bezeichnerzählung aller versionierten TS-/JS-/MJS-/HTML-Dateien unter
`src`, `desktop`, `tests` und `tools` ergab jeweils nur die Deklaration.
Zusätzlich wurden Reexports, dynamische Einstiegspunkte und die gebauten
Main-/Renderer-/Spielerartefakte geprüft. Die vier Namen waren auch dort nicht
enthalten. Keine dieser Deklarationen ist ein IPC- oder Speichervertrag.

| Entfernt | Grund | Erhaltener aktiver Weg |
| --- | --- | --- |
| `cityDetailVisible` in `atlas-cartography.ts` | Unbenutzte Detail-Schwelle | Gemeinsame Maßstabsregeln und tatsächliche Zeichen-/Trefferverbraucher |
| `hexStrokePolygons` in `atlas-landscape.ts` | Unbenutzter Ein-Zug-Wrapper | `hexStrokesPolygons` erhält getrennte Gesten ohne Verbindungslinie |
| `atlasUnitFieldIds` in `atlas-units.ts` | Unbenutzte Registry-Aufzählung | Bestehende Feldbindung und Einheitenumrechnung |
| `UNPAINTED_LAND` in `landscape-raster.ts` | Unbenutzter alter RGB-Wert | Aktuelle Raster-/Geländefarben und Fallbacks |

Es wurden keine Tests oder Formatleser entfernt. Die Bezeichnungen `svg` in
echten SVG-Serialisierern und im passiven Spielerbild bleiben korrekt; die
Canvasbesitzer der Workbenches wurden bereits umbenannt.

## Lebenszyklus und Kompatibilität

`tests/atlas-controller-lifecycle.test.mjs` hält A- und B-Bereichsantworten
zurück, kehrt zum **gleichen A-Besitzerobjekt** zurück und lässt beide alten
Antworten vor der aktuellen Antwort eintreffen. Nur die aktuelle Anfrage darf
Geometrie veröffentlichen, die Nachladung starten oder die Trefferfreigabe
öffnen. Der PNG-Test ergänzt A–B–A sowohl während des Lesens als auch während
der ausstehenden Speicherantwort. Alte Finalizer dürfen den neuen Ausgabeauftrag
nicht entsperren oder Erfolg melden.

Die vorhandenen Fälle zu Werkzeugwechsel, Etage, abgebrochenen Pinselzügen,
ungeklärten Reise-/Schreibantworten, Canvas-Recovery, Quellwechseln und
eingefrorenen Exportparametern bleiben erhalten. 96 fokussierte Controller-,
Canvas-, Einheiten- und Übergangsfälle sowie 75 zusätzliche Reise-, Werkzeug-,
Draft-, Archiv-/Medien- und Spielerprojektionsfälle bestanden lokal.
Die Archivtests erhalten validierte Metadaten und exakte Medienbytes und
weisen beschädigte/manipulierte Pakete vor der Veröffentlichung zurück.
Die Spielerprobe hält private Prosa aus der passiven Projektion heraus.

## Längere Stadtmessung

Dieselbe geschlossene 5.000-Gebäude-Datenbank wurde in frischen Prozessen
kopiert. Je Prozess wurden sechs Zoomzyklen mit 56 Eingaben verwendet, mit
wechselnder Reihenfolge der Vorher-/Nachher-Runtime. Script, Plattform,
Darstellung und Datenbestand waren gleich. Laufreihenfolge und Zusammenfassung:
[erweiterter Vergleich](verification-performance.json);
[alle einzelnen Eingabemessungen](verification-performance-samples.csv).

Im ersten Paar lagen die Zoom-CPU-Mediane bei 86/82 ms und p95 bei 135/145 ms
(vorher/nachher). Während dieses Paars lief zeitweise eine Quelltextsuche;
es ist deshalb keine alleinige Leistungsqualifikation. Im zweiten Paar ohne
parallele eigene Prüfung und mit umgekehrter Reihenfolge lagen die Mediane bei 88/88 ms und p95 bei
142/132 ms. Ein drittes Paar, ebenfalls ohne parallele eigene Prüfung und
wieder in Vorher-/Nachher-Reihenfolge, ergab Mediane von 89/88 ms und p95 von
136/106 ms. In allen Läufen blieben gepufferte Szenen beim Pan erhalten;
Hover verursachte keine zusätzlichen SQLite-Leseaufträge. Die höheren Spitzen
des ersten kurzen Tests reproduzieren sich in den zwei längeren sauberen
Vergleichspaaren somit nicht. Bestehende absolute Latenzgrenzen bleiben offen;
aus diesen Messungen wird keine allgemeine Leistungssteigerung abgeleitet.

## Große Welt und native Belege

Zusätzlich lief die bestehende `tools/test-desktop-world-navigation.mjs` mit
`WORLD_POPULATED=1 WORLD_LARGE=1 WORLD_READBACK=off WORLD_PROFILE=0` jeweils
auf der eingefrorenen Vorher-Runtime und dem finalen Renderer. Beide Läufe
verwenden denselben deterministischen Fixtureaufbau in getrennten Profilen:
108.076 Records einschließlich Relief, Bewuchs, Straßen, Flächen und 5.000 Orten.
Die Runtime-Hashes identifizieren den tatsächlich ausgeführten Stand;
Checkout-SHA/Dirty-Angaben allein identifizieren die Vorher-Runtime nicht.

Beide vollständigen Abläufe bestanden: Navigation, echter großer Höhenpinsel,
Bestätigung der neuen Revision 9, Hex-/Kontur-/Detail-/Entwurfs-/Reuse-Pixelprüfungen,
keine Rendererfehler und reguläres Prozessende mit verschwundener PID.
Navigation-Frame-p95: 18,8/20,3 ms; Pinsel-Frame-p95: 22,5/22,3 ms
(vorher/nachher). Readback und CPU-Profiling waren für beide Läufe ausgeschaltet;
die Messung ist deshalb keine Eingabe-zu-Pixel-Latenzqualifikation.

- [Welt vorher](verification-world-before.json), [Bild vorher](verification-world-before.png)
- [Welt nachher](verification-world-after.json), [Bild nachher](verification-world-after.png)

Die bereits bestandenen nativen Kamera-, Bearbeitungs-, History-, Export-/Menü-
und 200-Prozent-Wiederöffnungsproben aus dem ersten Nachweis bleiben gültig:
die vier zusätzlichen Entfernungen ändern den gebauten Renderer nicht
(SHA256 weiterhin `be81c81d3fc9112d59061b8642cd3346f56bf3c52bf1e1cdd82405e0644bab2c`).
Öffentliche IPC-Verträge, Schema und Archivformate wurden nicht geändert.
Die alte Exportnaht und die dokumentierten bereits vorher fehlschlagenden
Proben bleiben ausdrücklich offen. Keine neue Produktanforderung wird durch
diese interne Bereinigung als erfüllt markiert.
