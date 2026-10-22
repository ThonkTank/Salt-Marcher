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
Main-/Renderer-/Spielerartefakte geprüft. Die sechs Namen waren auch dort nicht
enthalten. Keine dieser Deklarationen ist ein IPC- oder Speichervertrag.
Der ergänzende Suchlauf bezieht auch `campaign-atlas*` und die Atlasmodule in
`src/app/storage` und `desktop` ein.

| Entfernt | Grund | Erhaltener aktiver Weg |
| --- | --- | --- |
| `cityDetailVisible` in `atlas-cartography.ts` | Unbenutzte Detail-Schwelle | Gemeinsame Maßstabsregeln und tatsächliche Zeichen-/Trefferverbraucher |
| `hexStrokePolygons` in `atlas-landscape.ts` | Unbenutzter Ein-Zug-Wrapper | `hexStrokesPolygons` erhält getrennte Gesten ohne Verbindungslinie |
| `atlasUnitFieldIds` in `atlas-units.ts` | Unbenutzte Registry-Aufzählung | Bestehende Feldbindung und Einheitenumrechnung |
| `UNPAINTED_LAND` in `landscape-raster.ts` | Unbenutzter alter RGB-Wert | Aktuelle Raster-/Geländefarben und Fallbacks |
| `recoverAtlasWrite` in `campaign-atlas-author.ts` | Kein Aufrufer des alten Vollbild-Recoverypfads | `recoverAtlasCommit` mit derselben gespeicherten Auftragskennung und kompakter Bestätigung |
| `frameTransform` in `campaign-atlas-model.ts` | Unbenutzter SVG-Transformationsstring | Numerische `frameMatrix`/Koordinatentransformationen; aktive SVG-Serializer bleiben erhalten |

Sieben ausschließlich innerhalb ihrer eigenen Datei verwendete Helfer sind
jetzt privat: `atlasCameraBasis`, `footprintVisible`, `EARTH_WIDTH`,
`reshapeTerritory`, `writeAtlas`, `installLandscapeIndex`, `atlasReadJournal`.
Der jetzt private `writeAtlas` benötigt keinen unbenutzten Recoveryparameter
mehr; offene Aufträge bleiben gesperrt und werden weiterhin ausdrücklich
über `recoverAtlasCommit` geklärt. Historischer Adapter, separat getesteter
Positionscodec und die parallel bearbeitete `landscape-brush.ts` bleiben
außerhalb dieser API-Verkleinerung.

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
Nach der Verkleinerung der internen APIs bestanden weitere 159 gezielte
Bereichs-, Raumlese-, Dungeonautoren-, Controller- und Canvasfälle. Darunter
sind verlorene Schreibantworten mit identischer Auftragskennung, gesperrte
Folgeschreibversuche und Klärung über den unveränderten kompakten Recoverypfad.

## Vollständiger Zeichnungsbesitzer und wiederholte Framearbeit

Die Nachprüfung fand noch den eigentlichen Szenenaufbau in der Workbench.
Auch dieser liegt jetzt in `AtlasDrawing.draw`: behaltene Stadt-/Raumgeometrie,
Autorenkonturen, Beschriftungen, Ausgabeauswahl und Reisezeichnung. Die Workbench
koordiniert weiterhin die vorhandenen Quellen-/Trefferfreigaben und übergibt
nur Szene, bestätigte Daten, Ausschnitt und Maßstab. Die bisherigen Cache-Schlüssel
und die Fachbesitzer bleiben erhalten; es gibt keine neue Vermittlungsschicht.

Die Profile zeigten wiederholt Zahlenformatierung im Kamerapfad. Maß- und
Reisebeschriftung verwendeten zwei identische `toLocaleString`-Definitionen.
Beide verwenden jetzt denselben `Intl.NumberFormat` mit unveränderten
`de-DE`-/Drei-Ziffern-Optionen. `geometryCurrent` verwendet für Abdeckung und
Auflösung dieselbe Eingabeaufnahme, statt die Bedienelemente und Viewportmaße
zweimal synchron zu lesen. Die getrennten Prüfungen für sichtbare Geometrie
und bearbeitbare Treffer bleiben bestehen. Nach diesen Änderungen bestanden
128 Controller-, Canvas-, Autoren- und Bereichsfälle sowie 14 Maß-, Navigations-
und Trasseneinheitenfälle.

## Längere Stadtmessung

Dieselbe geschlossene 5.000-Gebäude-Datenbank wurde in frischen Prozessen
kopiert. Je Prozess wurden sechs Zoomzyklen mit 56 Eingaben verwendet, mit
wechselnder Reihenfolge der Vorher-/Nachher-Runtime. Script, Plattform,
Darstellung und Datenbestand waren gleich. Laufreihenfolge und Zusammenfassung:
[erweiterter Vergleich](verification-performance.json);
[alle einzelnen Eingabemessungen](verification-performance-samples.csv).

Im ersten Paar lagen die Zoom-CPU-Mediane bei 86/82 ms und p95 bei 135/145 ms
(vorher/nachher). Während dieses Paars lief zeitweise eine Quelltextsuche;
es ist deshalb keine alleinige Leistungsqualifikation. Zwei weitere Paare
ohne parallele eigene Prüfungen ergaben p95 von 142/132 und 136/106 ms.
Der Zwischenstand nach API-Verkleinerung lag bei Median 90 und p95 144 ms.
Der abschließende Vergleich mit vollständigem Zeichnungsbesitzer und geteilter
Zahlenformatierung ergibt Median **91/86 ms**, p95 **143/114 ms**.
In allen Läufen blieb die gepufferte Szene beim Pan erhalten; Hover verursachte
keine zusätzlichen SQLite-Leseaufträge. Bestehende absolute Latenzziele bleiben
offen. Diese begrenzten Messungen belegen keine allgemeine Leistungssteigerung.

## Große Welt und Leistungsdiagnose

`tools/test-desktop-world-navigation.mjs` lief mit
`WORLD_POPULATED=1 WORLD_LARGE=1 WORLD_READBACK=off WORLD_PROFILE=0` auf
der eingefrorenen Vorher-Runtime und den jeweils bezeichneten Zwischenständen.
Der deterministische Fixtureaufbau enthält 108.076 Records einschließlich
Relief, Bewuchs, Straßen, Flächen und 5.000 Orten. Runtime-Hashes identifizieren
den ausgeführten Stand; Checkout-SHA/Dirty-Angaben allein identifizieren eine
eingespielte Vorher-Runtime nicht.

Der erste Vergleich ergab Navigation-p95 18,8/20,3 ms. Weitere Wechselmessungen
bestätigten einen kleinen Abstand: drei Paare lagen bei 16,8/19,5,
16,8/19,1 und 16,7/20,2 ms. Dieser Befund wurde zunächst als offener Rückschritt
behandelt. Profilierte Läufe dienten der Zuordnung von Arbeit und werden nicht
mit den Messungen ohne Profiler vermischt. Sie zeigen wiederholte
Zahlenformatierung und Bereichsabfragen, aber keinen zusätzlichen veralteten
Kameraframe. [Profilkosten](world-profile-costs.json).

Nach der oben beschriebenen Nacharbeit wurde dieselbe Sequenz erneut
in wechselnder Reihenfolge geprüft:

| Paar, Navigation-Frame-p95 | Vorher | Nachher | Einordnung |
| --- | ---: | ---: | --- |
| Neuer Stand, Paar 1 | 22,5 ms | 20,3 ms | Ohne eigene parallele Prüfjobs |
| Neuer Stand, Paar 2 | 20,3 ms | 38,5 ms | Belastet: gleichzeitig laufende `tsc --noEmit` und Desktop-`tsc` im anderen Arbeitsstand |
| Neuer Stand, Paar 3 | 23,7 ms | 20,9 ms | Gleiche Messserie; Hintergrundlast nicht durchgehend erfasst |
| Abschließendes überwachtes Paar | **21,5 ms** | **20,6 ms** | Während beider Prozesse keine aktiven Node-Prüfjobs im anderen Arbeitsstand erfasst |

Im überwachten Paar beträgt Pinsel-p95 21,4/21,8 ms. Alle vollständigen Abläufe
bestanden: Navigation, großer Höhenpinsel, bestätigte Revision 9,
Hex-/Kontur-/Detail-/Entwurfs-/Reuse-Pixelprüfungen, keine Rendererfehler und
reguläres Prozessende. Der vorher wiederholte Navigationsabstand reproduziert
sich nach der Nacharbeit nicht. Dies ist keine vollständige Lastisolation des
Hosts und keine Eingabe-zu-Pixel-Latenzqualifikation; Readback war ausgeschaltet.
Asynchrone Nachladung und die interpolierte Kamera führen zu leicht verschiedenen
Endausschnitten und Szenengenerationen; Generation 5 und 6 kommen bereits in
der Baseline vor. Die Cache-/Reuse-Prüfungen und Bildvergleiche bleiben maßgeblich,
nicht eine als Vollaufbauzahl fehlinterpretierte Szenengeneration.

- [Alle Weltläufe mit Laufzeit-Hashes und Prüfwerten](world-comparisons.json)
- [Alle Frameabstände](world-frame-samples.csv), [Prozessbeobachtung des letzten Paars](world-process-monitor.json)
- [Erster Vorherlauf](verification-world-before.json), [Bild vorher](verification-world-before.png)
- [Erster Nachherlauf](verification-world-after.json), [Bild nachher](verification-world-after.png)

Identische aufeinanderfolgende Detail-Uploadaufrufe sind in der Übersicht als
`callRuns` mit Anzahl zusammengefasst; ihre Reihenfolge und Dimensionen bleiben
nachvollziehbar. Auch schlechte, profilierte und belastete Messungen bleiben
erhalten. Es wurden keine fehlgeschlagenen Leistungswerte aus der Serie entfernt.

## Native Abschlussprüfung und Grenzen

Die finalen nativen Proben belegen Auswahl bei geneigter/gedrehter Hauptkamera,
Raumeckpunktbearbeitung, Undo/Redo, Stadtobjekte, GPU-Kontextverlust mit expliziter
Wiederherstellung, reguläres Beenden und kanonische Änderungen nach frischem Öffnen.
PNG-Ausgabe wird bei 100 und 200 Prozent jeweils durch Menübedienung,
Katalogwechsel, erneute Raumauswahl und frisches Öffnen ergänzt:
[Hauptkamera](qualified-camera.json), [100 Prozent](qualified-output-100.json),
[200 Prozent](qualified-output-200.json).

Die ersten vier Entfernungen ließen den Renderer bytegleich bei
`be81c81d3fc9112d59061b8642cd3346f56bf3c52bf1e1cdd82405e0644bab2c`.
Der API-Zwischenstand hatte
`1173d1f23358932be655eb4d3618e5454ebc53174a6cdd43d4ca073ff7c01f4a`.
Der abschließend geprüfte Renderer hat SHA256
`2c029bac3ea492e60486fc2564c95181f8f43bc8ed23fc8d9779fff073116f21`.
Main bleibt bytegleich bei SHA256
`218492b9908d9da2c595d27d10c66a35e96f71796fc4242316daf2e8457e9d5a`.
Öffentliche IPC-Verträge, Schema und Archivformate wurden nicht geändert.
Die alte Exportnaht und die im ersten Bericht bereits vorher fehlschlagenden
Proben bleiben ausdrücklich offen. Keine neue Produktanforderung wird durch
diese interne Bereinigung als erfüllt markiert. Paketbau und Installation
werden durch diese Quellcode-/Native-Prüfung nicht behauptet.
