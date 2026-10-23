# M1: instanzeigener Kartenanschluss und Desktop-Laufzeit

Historischer Integrationsstand: MapLibre wurde anschließend durch den direkten metrischen Atlas ersetzt. Die historischen Codepfade beziehen sich auf den erhaltenen lokalen Übergangsstand `c891b74b0d6b9f91c4f5f746f93d3fa74db63768`; Wiederholungen dieser historischen Probe benötigen dessen Checkout. Einzeldateien lassen sich mit `git show c891b74b0:PFAD` lesen. Dieser Checkpoint ist noch nicht veröffentlicht.

Stand 23.10.2026. **Der ausgelagerte Anschluss und sein Laden im Desktop sind
geprüft; die vollständige M1-Produktetappe bleibt offen.** Grundlage ist die
[vorherige Integrationsprobe](../atlas-maplibre-interop-20261023/README.md),
verbindlicher Umfang die [Atlas-Roadmap](../../plans/maps/unified-spatial-atlas.md).

## Umsetzung

- AtlasMapLibreBridge (`src/app/atlas-maplibre-bridge.ts`, historischer Checkpoint) besitzt pro Karte
  den festen Szenenursprung, Darstellungswurzel, Matrixaufnahme, Deck-Viewport,
  Overlay und Style-Lebenszyklus. Die Probe enthält diese Implementierung nicht
  mehr als globale Kopie. Der Besitzer ruft `dispose()` vor `map.remove()` auf.
- Eine Änderung der Projektions- **oder** Hauptmatrix invalidiert den Deck-Viewport.
  Wiederholtes gleichzeitiges Anbinden und fremde Layer-IDs werden zurückgewiesen;
  Entfernen räumt nur eigene Layer, Listener und wartende Aufgaben auf.
  Überholte Style-Abschlüsse werden durch eine Generation entwertet.
- Der gemeinsame CRS-Decoder (`src/app/atlas-maplibre-projection.ts`, historischer Checkpoint)
  versorgt Renderer und den lokal gebauten GeoJSON-Worker. Er unterstützt auch
  kanonisch geschriebene Exponentialwerte für kleine/große Darstellungswurzeln.
- Runtime (`src/app/atlas-maplibre-runtime.ts`, historischer Checkpoint), Worker, CRS-Handler und CSS
  liegen im Desktopbuild. Die Runtime wird erst bei Bedarf geladen; die normale
  Atlas-Workbench verwendet weiterhin ihren bisherigen Renderer.
- Die fünf direkten Bibliotheken sind jetzt in der Haupt-`package.json` und
  Sperrdatei festgelegt. Der separate Abhängigkeitsbaum der Probe wurde entfernt.
  `npm ci` im Repository stellt die gemeinsame Installation her.
- Main erlaubt vier konkrete neue UI-Dateien unter `campaign://app`. CSP erlaubt
  Worker, Verbindungen und Fonts ausschließlich vom eigenen Ursprung; die
  bestehende Netzwerkfilterung und Renderer-Sandbox bleiben erhalten.
- Der Build kopiert 59 mitgelieferte Lizenztexte für 58 installierte Runtimepakete
  einschließlich transitiver Abhängigkeiten nach `licenses/atlas/`. Das Manifest
  enthält Namen, Versionen und Originalquellen. `murmurhash-js` liefert seinen
  originalen MIT-Text im README; er wird daraus übernommen.

Vor dem ersten neuen Desktopbuild wurde die lauffähige Main-Referenz
`d3d31363fc40cff1f0f2f5d0b6699dacd54e8b30` unter
`.build/atlas-reference-d3d31363/desktop` erhalten. Es wurden keine Anwenderdaten
oder installierten Pakete ersetzt.

## Gefundener Fehler und Nacharbeit

`before-style-fix.json.gz` dokumentiert Lauf `1792780289601-1020176`:
Alle 17 Endzustandsprüfungen waren wahr, trotzdem ist der Lauf **fehlgeschlagen**.
Ein `styledata`-Zwischenereignis verlangte einen Deck-Viewport, während die alte
Matrix bereits gelöscht und die erste neue Matrix noch nicht aufgenommen war.
Der Driver verweigert Erfolg bei jedem Rendererfehler, auch bei grünen Einzelgates.

Die Bridge behält jetzt die letzte gültige Projektion. Eine separate Bereitschaft
wartet auf den ersten Render der neu eingebauten Aufnahmeschicht. Ein eigener
Regressionstest löst das problematische Zwischenereignis vor diesem Render aus
und prüft sowohl den verfügbaren Viewport als auch das weitere Warten.

## Native Wiederholung der Integrationsprobe

`interop.json.gz` stammt aus Lauf `1792780492298-1022575`, Quellenbasis
`5ee895c10ef453517b0e363b226f6645f8a60922` plus die im Ergebnis gehashten Änderungen.
Alle **17 Prüfungen bestehen**: fünf Maßstäbe, exakte MapLibre-Auswahl,
synthetische Deck-Geometrieauswahl, gemeinsame Tiefe, ortsfeste Geometrie,
360°-Äquivalenz, neu aufgebaute größere Darstellungswurzel, vollständiger
Style-Ersatz sowie native Pan-/Wheel-/Dreh-/Neigegesten und Fenstergrößenwechsel.
Der Probe- und der Produktbuild verwenden die neue Bridge und den gemeinsamen
Workerdecoder. Die neu aufgebaute größere Wurzel ist weiterhin kein laufender
Wurzelwechsel mit aktiver Bearbeitung.

Alle aufgezeichneten Eingabe-Hashes blieben gleich; Renderer-, Probe- und
Console-Fehler sind leer. Electron PID 1022620 endete regulär mit Code 0,
ohne Signal, danach nicht mehr vorhanden. `shared-canvas.png` und
`native-gestures.png` zeigen die synthetische gemeinsame Fläche.

## Laden im regulären Desktopfenster

`desktop-runtime.json.gz` stammt aus dem separaten Lauf
`1792780627471-1024155`. Der native Desktoptest (`tools/test-desktop-atlas-maplibre-runtime.mjs`, historischer Checkpoint)
startet den normalen gebauten Main-/Preload-/Rendererpfad mit einem frischen,
eigenen Profil. Im bestehenden Kampagnenfenster lädt er die neue Runtime und
stellt vorübergehend eine kleine Markerkarte bereit. Das ist ein
**Laufzeit-/Protokolltest, kein vollständiger Atlas-Autorenablauf**.

Bestanden:

- Import des gebauten Moduls über `campaign://app/atlas-maplibre-runtime.js`;
  wiederholte Initialisierung teilt denselben Workeraufbau.
- Lokale CSS-Datei, Worker und CRS-Handler; erfolgreiche Initialisierung und
  Darstellung/Abfrage eines workerverarbeiteten GeoJSON-Markers bei 75° Neigung.
- Alle vier Ressourcen liefern Status 200 und exakt die SHA-256-identischen
  Bytes des Desktopbuilds. Worker-Subrequests erscheinen in dieser Electron-
  Session nicht im normalen `onCompleted`-Recorder. Deshalb prüft der Test die
  Byteauslieferung durch zusätzliche Same-Origin-Reads und die tatsächliche
  Workerausführung separat über Markerprojektion und Auswahl.
- Gemeinsames Canvas und WebGL2-Objekt sowie endliche Projektionsmatrizen.
- `nodeIntegration=false`, `contextIsolation=true`, `sandbox=true` und kein
  `window.require`; keine Änderung der produktiven CSP für den Test.
- Entfernen von Bridge, Karte, Container und Stylesheet; das Kampagnenfenster
  bleibt intakt. Keine Renderer- oder Console-Fehler.
- Unveränderte Build-/Quellen-Hashes; regulärer Prozessabschluss von PID 1024188
  mit Code 0, ohne Signal, danach nicht mehr vorhanden.

`desktop-runtime.png` wurde im nativen Fenster aufgenommen und sichtbar geprüft.
Der vorherige Messversuch `worker-response-observation-gap.json.gz` scheiterte an
fehlenden Worker-Ereignissen im Recorder, nicht an fehlgeschlagenen HTTP-Antworten.
Er wurde nicht nachträglich als erfolgreicher Prozessabschluss umgedeutet.

## Prüfungen und Reproduktion

32 gezielte Unit-Tests bestehen: 13 Bridge-/Lifecyclefälle, zwei gemeinsame
CRS-/Workerfälle, zwölf Auswahladapterfälle und fünf Meterraumfälle.
TypeScript-Prüfung, Desktop-TypeScript-Prüfung und Desktopbuild bestanden;
Repository-, Link- und Whitespaceprüfung bestanden beim lokalen Abschluss.

```sh
npm ci
node tools/atlas-maplibre-interop-prepare.mjs
node tools/atlas-maplibre-interop-build.mjs
npm run build:desktop
node --test tests/atlas-metric-space.test.mjs tests/atlas-metric-query.test.mjs tests/atlas-maplibre-projection.test.mjs tests/atlas-maplibre-bridge.test.mjs
node tools/atlas-maplibre-interop-run.mjs
python3 tools/ui-session.py node tools/test-desktop-atlas-maplibre-runtime.mjs
npm run check
npm run check:desktop
npm run check:repo
```

Native Läufe nacheinander ausführen, ohne parallele Builds. Der Capability-Katalog
verknüpft die tatsächlichen Testdateien; eine Verknüpfung ersetzt keine Abnahme.

## M1-Abgleich und nächste Arbeit

| M1-Ziel | Aktueller Beleg / offene Arbeit |
| --- | --- |
| MapLibre-Kamera und gemeinsamer Deck-Kontext | Gekapselte Bridge, 17 native Integrationsprüfungen und Laden unter Produktions-CSP bestanden. |
| Meterraum, 360°, 0–75°, Zoom am Weltpunkt | Bestehende Fünfmaßstabs- und native Gestenprüfungen bestehen mit der ausgelagerten Bridge. |
| Gemeinsamer Projektionsadapter | Renderer-/Worker-Decoder und Bridge vorhanden; normale Autorenwerkzeuge und echte Szenendaten noch nicht angeschlossen. |
| Wachsende Darstellungswurzel | Äquivalente neu aufgebaute Karte geprüft; laufender Wechsel mit Erhalt der Bearbeitung und produktiver Kacheladressen offen. |
| Lokales Bündeln | Bibliotheken, Worker, CRS-Handler, CSS und Lizenztexte im Desktopbuild; Schrift-/Glyph- und Symbolpipeline noch offen. |
| Terrain, Gebäude und Raum gemeinsam | Synthetische Extrusions-/DEM-Proben; reale ko-registrierte Terrain-/Gebäude-/Raumszene und sichtbare Gesamtszenenauswahl fehlen. |

Nächster Umsetzungsschritt ist die echte Szenenanbindung an diesen Besitzer,
einschließlich gemeinsamer Terrain-/Objektprojektion und sichtbarer Auswahl.
Die normalen Werkzeuge bleiben bis zur vollständigen Übernahme erreichbar.
M2–M8, Produktleistungsziele, Zielgerät, Paketierung/Installation und persönliche
Nutzerabnahme werden durch diese technischen Prüfungen nicht als erledigt erklärt.
