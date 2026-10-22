# Atlas: Präsentationspfad und native Prüfplattform

22.10.2026, Produktruntime `9ed6a9ae891d20cb02df158a65756874f9f9c5cf`,
Electron 44.7.0, Intel Core i5-8365U (4 Kerne/8 Threads), Fedora/Wayland.
Dieser Host ist **nicht** der gemeldete Pentium Gold 7505.

## Befund

Die gemeinsame native Probe erzwang bisher `--ozone-platform=x11`. Ein normaler
App-Start setzt diesen Schalter nicht. Seit Electron 38 ist `auto` Standard,
auf einer Wayland-Sitzung mit nativer Wayland-Auswahl:
[offizielle Änderung](https://www.electronjs.org/blog/electron-38-0).
Das ist ein Unterschied zwischen Prüfumgebung und normaler Anwendung.

Die vollständige Weltprobe wurde mit identischer Runtime über X11 und Wayland
aufgezeichnet. 100.000 Biomezuordnungen, 5.000 Orte, 5.000 ausgestattete Gebäude,
50 Details und 4.001 Dungeonräume; 108.076 Landschaftsrecords. Die Biome sind
keine 100.000 feinen Höhenbearbeitungen. Derselbe 2.500-Meilen-Pinsel, je zwei
Züge, gleiche Fenstergröße; zeitabhängige Navigation endet mit etwa 0,3 %
unterschiedlicher Ausschnittsbreite. Die beiden Übersichtsaufnahmen wurden
betrachtet: gleiche dichte Welt, keine verschwundenen Objektschichten als
Erklärung des Unterschieds. Noch unvollständig geladene Farbkacheln bleiben
in beiden Bildern sichtbar.

| Ablauf, p95 / p99 ms | [X11](x11/result.json) | [Wayland](wayland/result.json) |
| --- | --- | --- |
| Navigation | 35,7 / 50,0 | 23,7 / 166,7 |
| Sculpt | 40,4 / 54,3 | 22,9 / 50,0 |
| Erneuter Sculpt | 40,8 / 57,4 | 24,8 / 66,7 |

Beide Läufe: normales Schließen und verschwundene PIDs, keine Rendererfehler,
beide Pinsel gespeichert und abschließend 48/48 Farbkacheln. CPU-Profiling und
Chromium-Tracing waren aktiv und beeinflussen die Laufzeit. Readback war aus:
keine Eingabe-bis-verändertem-Pixel-Abnahme. Einzelne lange Pausen bleiben;
insbesondere verschlechterte sich der Navigations-p99. Das ist kein allgemeiner
Leistungsnachweis und keine belastbare Prozentangabe für alle Geräte.

Im X11-Trace dauerte `NativeViewGLSurfaceEGL:RealSwapBuffers` bei 99 Aufrufen
im Median 6,84 ms, p95 27,89 ms, maximal 31,93 ms. Die eigentliche
`ProxyMain::BeginMainFrame`-Arbeit blieb bei p95 10,05 ms. Unter Wayland trat
dieses EGL-Swap-Ereignis nicht auf; MainFrame-p95 war ähnlich (10,25 ms).
Die Wandzeiten überlappen; ihre Summen dürfen nicht als unabhängige CPU-Kosten
addiert werden. Der Unterschied begründet die Plattformgegenprobe, beweist
aber nicht, dass sämtliche Verzögerungen vom Fenstersystem stammen.

## Änderung und Prüfung

`tools/native-session.mjs` erzwingt keine andere Plattform mehr als der normale
App-Start. `QA_OZONE_PLATFORM=x11|wayland|auto` bleibt eine ausdrückliche
Vergleichsoption. Unbekannte Werte werden vor Profil-/Ergebnisänderungen
abgewiesen. Jeder Prozessbeleg hält Anforderung und Desktop-Sitzung fest;
das ist keine automatische Erkennung des intern gewählten Grafiktreibers.

[Normale Startprobe](default-launch.json): ohne Plattformschalter, kleine
Welt und großer Pinsel, normales Ende/PID abwesend/keine Fehler. Dieser Lauf
prüfte bereits den neuen Standard und enthielt noch einen danach entfernten
Versuch, die aufgelöste Plattform aus Rendererargumenten auszulesen
(`renderer: null`). Er ergab keinen zusätzlichen Nachweis; die unnötige
Prozessabfrage wurde entfernt. Sechs bestehende Editor-/Native-Abschlussfälle
bestanden. Die Produktanwendung und ihre Grafikoptionen wurden nicht geändert.

## Reproduzieren

Die Rohtraces, vollständigen Ergebnisse und CPU-Profile sind verlustfrei
gzip-komprimiert abgelegt. Lesbare Ergebniszusammenfassungen werden mit
`summarize-results.mjs PFAD/result.json.gz` daraus erzeugt; die vollständigen
Frame-/Änderungsarrays bleiben im Archiv, statt Reviews mit rund 39.000
zusätzlichen Zeilen zu überladen.
Sie lassen sich nach dem Entpacken in Chromium/Perfetto bzw. DevTools öffnen.
Die Zahlen oben berechnet:

```sh
node docs/reference/atlas-presentation-platform-20261022/summarize.mjs docs/reference/atlas-presentation-platform-20261022/x11
node docs/reference/atlas-presentation-platform-20261022/summarize.mjs docs/reference/atlas-presentation-platform-20261022/wayland
```

In einer isolierten Arbeitskopie von `9ed6a9ae`, Node 22, nach `npm ci` und
`npm run build:desktop`: die beiden `build-world-*-trace.mjs` hier nach `.build/`
kopieren und ausführen. Sie bündeln den vorhandenen Workflow mit den zusätzlichen
Tracekategorien; die Wayland-Variante ändert nur dessen explizite Startplattform.

```sh
node .build/build-world-presentation-trace.mjs
WORLD_WARM_OPEN=1 WORLD_POPULATED=1 WORLD_LARGE=1 WORLD_MIXED=1 WORLD_READBACK=off WORLD_PROFILE=1 WORLD_LAYOUT_TRACE=1 WORLD_DRAFT=1 WORLD_REPEAT=1 WORLD_PROGRESSIVE=1 WORLD_OVERLAY=1 QA_EVIDENCE_DIR=.build/x11-presentation-repeat python3 tools/ui-session.py timeout --signal=TERM 300s node .build/world-presentation-trace.mjs
node .build/build-world-wayland-trace.mjs
WORLD_WARM_OPEN=1 WORLD_POPULATED=1 WORLD_LARGE=1 WORLD_MIXED=1 WORLD_READBACK=off WORLD_PROFILE=1 WORLD_LAYOUT_TRACE=1 WORLD_DRAFT=1 WORLD_REPEAT=1 WORLD_PROGRESSIVE=1 WORLD_OVERLAY=1 QA_EVIDENCE_DIR=.build/wayland-presentation-repeat python3 tools/ui-session.py timeout --signal=TERM 300s node .build/world-wayland-trace.mjs
```

Nach Integration des neuen Helpers kann alternativ derselbe Workflow gezielt mit
`QA_OZONE_PLATFORM` ausgeführt werden. Keine parallelen nativen Proben; tatsächliche
Prozessbeendigung abwarten. Vorhandene Evidenz-/Profilordner nicht überschreiben.

## Konsequenz für die Architekturentscheidung

Drei weitere Ansätze: (1) Prüfumgebung an den tatsächlichen Start angleichen,
(2) GPU-/HUD-Komposition vereinfachen, (3) Terrain über GPU-Höhenfelder/Clipmaps
neu aufbauen. Die erste Option beseitigt hier eine nachgewiesene Messverzerrung
und ist vor einer Rangfolge der Renderer notwendig. Die zweite könnte
Präsentationsarbeit senken, braucht aber einen belegten doppelten Aufwand.
Die dritte bietet eine andere Grundlage für große Terrainoperationen, verursacht
aber den größten Eingriff und behebt nicht automatisch Eingabe-/Präsentationswartezeit.

Auch die bisherigen isolierten MapLibre-/deck.gl-Proben verwendeten X11.
Ihre Ergebnisse bleiben für dieses Protokoll gültig; sie sind keine Rangfolge
für den normalen Wayland-Start. Wiederholte, gleichwertige Detail-/Sculpt- und
Etagenfälle fehlen weiterhin. Kein Architekturgewinner, keine Gesamtproduktabnahme.

## Kartenbibliotheken mit normalem Start

Die kontrollierten Komponentenfolgen wurden anschließend ohne erzwungenen
Plattformschalter auf demselben Wayland-Desktop wiederholt. Die Engine-/Szenenquellen
blieben unverändert; nur Startargument und Plattformmetadaten des Laufskripts
änderten sich. Beide Prozesse endeten normal, PIDs abwesend, keine Fehler.

| Frame p95 / p99 ms | MapLibre 6.15.0 | deck.gl 9.4.0 |
| --- | --- | --- |
| Alles | 35,1 / 92,4 | 45,1 / 123,9 |
| Ohne Terrain | 19,6 / 61,4 | 23,8 / 24,4 |
| Alles erneut | 25,5 / 38,5 | 35,6 / 42,5 |
| Nur Terrain | 20,0 / 28,3 | 28,5 / 34,0 |
| Hintergrund | 20,9 / 21,2 | 20,4 / 20,7 |
| Leeres Electron | 16,8 / 16,8 | 16,7 / 16,8 |

[MapLibre-Rohdaten](maplibre-default/result.json.gz) und
[deck.gl-Rohdaten](deck-default/result.json.gz) enthalten die vollständigen
Frame-/CPU-/GPU-Samples und Quellenhashes. Reproduktion nach Aufbau der jeweiligen
[MapLibre-Fixture](../atlas-renderer-comparison-20261022/README.md) bzw.
[deck.gl-Fixture](../atlas-deck-comparison-20261022/README.md): das jeweilige
`maplibre-default/run.mjs` oder `deck-default/run.mjs` nach `.build/` kopieren
und mit neuem `QA_EVIDENCE_DIR` über `tools/ui-session.py timeout --signal=TERM 180s`
ausführen. Nicht parallel starten.

Das Vergleichsproblem der nicht gleichwertigen Vektor-/Textarbeit bleibt bestehen;
keine Engine-Rangfolge ableiten. Die Verbesserung mehrerer Werte gegenüber X11
bestätigt die Bedeutung des Startpfads; beide Szenen verfehlen weiterhin das
16,7-ms-Ziel und zeigen Ausreißer. Ein Wiederholungslauf ersetzt keine Statistik.

Im Produktrace bleibt darüber hinaus synchrone Style-/Layoutarbeit offen:
`regionQuery → refresh` löste unter Wayland acht Styleberechnungen mit zusammen
58 ms und acht Layouts mit 7,55 ms aus. Ein weiterer Stylelauf stammt aus dem
`maxWidth`-Callback während `advanceZoom`. Diese Stellen lesen `clientWidth`/
`clientHeight`; die Aufzeichnung liefert einen konkreten Prüfpunkt, noch keine
angenommene Korrektur oder Erklärung aller Ausreißer.

## Release dieses Zyklus

[v0.186.0](https://github.com/ThonkTank/Salt-Marcher/releases/tag/v0.186.0)
wurde um 12:04:39 Uhr Europe/Berlin veröffentlicht, nach sechs integrierten PRs
seit v0.185.0. Candidate 39757664396, Main 39758838404 und Linux-Release
39759940877 bestanden. Der heruntergeladene veröffentlichte Stand wurde
[erneut geprüft](release-0.186.0.json): Ed25519-Signatur, Archiv-/Indexhash,
129 Dateien und eingebettete Version/Commit stimmen. Keine Installation auf
dem Pentium-Laptop und keine Owner-Abnahme. Die spätere Helperänderung hier
ist nicht Bestandteil dieses Releases.
