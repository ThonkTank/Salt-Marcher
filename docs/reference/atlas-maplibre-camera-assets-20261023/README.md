# M1: erhöhte Kamera, genaue Treffer und lokale Kartenassets

Lokaler Fortschritt auf Basis von `b98c8bdd6a3edc23a3f45c34bc61aa5ae79959cb`
mit aufgezeichneten Arbeitskopie- und Buildhashes. Dies ergänzt die
[kanonische Szenenprobe](../atlas-maplibre-scene-20261023/README.md).
Der reguläre Atlas verwendet weiterhin den bisherigen Renderer. Keine
Produktleistungs-, Zielgeräte-, Paketinstallations- oder Nutzerabnahme.

## Umsetzung und gefundene Fehler

- Die [Kamera](../../../src/app/atlas-maplibre-camera.ts) führt den Weltfokus
  einschließlich physischer Höhe. MapLibres automatische Gelände-Höhenbindung
  wird vor der Pose deaktiviert: Ohne eigenes MapLibre-DEM setzte sie die
  gewünschte Höhe 145 m im nächsten Renderzyklus wieder auf 0 zurück.
  Visuelle Überhöhung multipliziert nur die Darstellungshöhe; Rücklesen liefert
  weiterhin die physische Höhe.
- Die GPU entscheidet weiterhin mit gemeinsamem Tiefenpuffer, welches Objekt
  sichtbar ist. Die zusätzliche GPU-Höhenrücklesung entfällt. Der
  [Kamerastrahl](../../../src/app/atlas-maplibre-ray.ts) schneidet ausschließlich
  das ausgewählte Mesh und dessen tatsächlich hochgeladene Float32-Dreiecke.
  Ein pro Objekt behaltenes räumliches Suchverzeichnis vermeidet wiederholte
  Vollscans. Ein verfehlter Teilpixel liefert keine erfundene Autorenposition.
- Der erste erhöhte Kameralauf lieferte noch GPU-Höhen um 145,14 m für einen
  Raum bei 145 m. Die genaue Verfeinerung deckte danach einen Dachspitzenfehler
  bei 75° Neigung auf. Mathematisch gleiche, numerisch unterschiedlich
  ausgeführte Matrixprodukte lagen am Eckpunkt knapp auseinander. Darstellung
  und Strahl verwenden nun denselben
  [Matrixadapter](../../../src/app/atlas-maplibre-matrices.ts).
  Eine auf 10 Nanometer physische Entfernung begrenzte numerische Randkorrektur
  bleibt auf dem ausgewählten Dreieck; ein 20-nm-Fehltreffer bleibt in der
  Gegenprobe leer. Das ist eine numerische Toleranz, keine allgemeine
  Nanometer-Genauigkeitszusage für Weltkoordinaten.
- `frameUsable` sperrt Auswahl nach Kamerabewegung, Resize und Beginn eines
  vollständigen Style-Wechsels bis zur nächsten tatsächlichen Matrixaufnahme.
  Deck behält währenddessen seinen letzten Frame. Auch unveränderte Matrizen
  werden nach einer neuen Aufnahme wieder freigegeben; Fehler und Dispose
  lassen keine gültige Trefferausgabe zurück.
- [Lokale Assets](../../../src/app/atlas-maplibre-assets.ts) bündeln Noto Sans
  und Noto Sans Symbols samt [Lizenz und Herkunft](../../../resources/atlas-maplibre-fonts/PROVENANCE.md).
  Ein erzeugter Marker benötigt keinen externen Sprite. Der Desktopbuild
  kopiert Fonts und Lizenztexte; Main gibt nur die beiden konkreten Fontpfade
  frei. MapLibre erhält lokale `font-faces`, keinen Glyph-PBF-Endpunkt.
  Die dokumentierten Zeichenbereiche sind begrenzt; weitere Schriftsysteme
  sind damit nicht qualifiziert.

## Native Gegenprüfung

Die Szenenprobe lädt unverändert kanonische Daten aus SQLite über die bestehende
Preload-Brücke in einem privaten Testprofil. Die zusätzliche Kartenfläche liegt
über der regulären Startansicht. Die normal gestartete Electron-Anwendung bleibt
isoliert (`sandbox`, `contextIsolation`, kein `nodeIntegration`).

| Prüfung | Finales Ergebnis |
| --- | --- |
| Fünf Maßstäbe | 40.000 km, 16.000 km, 4.000 km, 3 km und 20 m sichtbare Breite; MapLibre/Deck-Abweichung maximal rund 0,000000492 px |
| Geometrie | Keine Neuberechnung der jeweils aktiven Szenenpuffer durch Kamerabewegung; Innenraum verwendet den kanonischen Geschossstand |
| Gebäude/Dach | Richtige ID und XYZ-Abweichung unter 0,1 mm bei 0°/0°, 37°/55° und −143°/75° |
| Innenraum | Kanonischer Raum auf 145 m, Nahkamera bis 75°; XYZ-Abweichung unter 0,1 mm |
| Überhöhung | 0,25×, 1×, 8×: Kamera zeigt 36,25/145/1160 m, physischer Raumtreffer bleibt 145 m |
| Echte Eingabe | Die Folge aus Ziehen und Mausrad verändert den Weltfokus; Mausrad verändert Maßstab von 0,02222 auf rund 0,01962 m/px; Fokus bleibt 145 m |
| Verdeckung | Terrain verdeckt den darunterliegenden Raum; ohne Terrain trifft derselbe Raum; Wiederherstellung verdeckt ihn wieder |
| Lebenszyklus | Sofort nach Move, Resize und `setStyle` keine Auswahl; nach frischem Rendern wieder richtige Obergeschoss-ID; 800×580 und 24-Bit-Auswahltiefe |
| Lokale Beschriftung | Deutsch mit Umlauten, griechische und kyrillische Schrift sowie Pfeile und Marker sichtbar; beide Fontfaces geladen |
| Ressourcen | Alle sechs geprüften Runtime-/Worker-/CSS-/Fontrouten HTTP-Status 200; Bytehashes entsprechen dem Build; kein Glyph-PBF-Endpunkt |
| Prozessende | Szene PID 1062839 und Runtime PID 1063202: regulärer Exit 0 ohne Signal und danach nicht vorhanden; keine Renderer-/Konsolenfehler |

Die kleine 64-m-Testwelt ist in den drei weitesten Ansichten kleiner als ein
Pixel; dort gibt es ausdrücklich **keine** erfolgreiche Objektselektion.
Die fünf Maßstäbe belegen den gemeinsamen Koordinaten- und Kameravertrag,
nicht vollständige Welt-LOD, sichtbare Großweltinhalte oder deren Auswahl.

Sichtprüfung: [erhöhter Innenraum](canonical-elevated-interior.png),
[lokale Schrift und Marker](atlas-maplibre-local-typography.png).
Die einfache Raumfläche ohne vollständige Ausstattung und die technische
Hügelfixture sind keine gestalterische Abnahme.

## Prüfungen, Rohdaten und nächste Etappe

68 gezielte Tests bestanden ([vollständige Ausgabe](targeted-tests.txt)):
[Kamera](../../../tests/atlas-maplibre-camera.test.mjs),
[Strahl und aufgezeichnete Dachspitze](../../../tests/atlas-maplibre-ray.test.mjs),
[Assets](../../../tests/atlas-maplibre-assets.test.mjs),
[Bridge](../../../tests/atlas-maplibre-bridge.test.mjs),
[Szene](../../../tests/atlas-maplibre-scene.test.mjs),
[Szenenmodell](../../../tests/atlas-maplibre-scene-model.test.mjs),
[Picking-Ressourcen](../../../tests/atlas-maplibre-picking.test.mjs),
[Projektion](../../../tests/atlas-maplibre-projection.test.mjs),
[Meterraum](../../../tests/atlas-metric-space.test.mjs) und
[MapLibre-Abfrage](../../../tests/atlas-metric-query.test.mjs).
`npm run check`, `npm run check:desktop`, `npm run build:desktop` und
`npm run check:repo` bestanden. Die tatsächlichen Testdateien der beiden
geprüften Abläufe wurden im Capability-Katalog mit `--geprueft` nachgeführt.

[runs.json](runs.json) verbindet die sechs Läufe mit komprimierten Rohdaten,
Quell-/Buildhashes und Prozessbelegen. Die beiden Dachspitzenfehler bleiben
erhalten, einschließlich [aufgezeichnetem Eingabefall](roof-apex-input.json).
Fehlgeschlagene Läufe beanspruchen keinen regulären Exit; ihre PIDs wurden
anschließend als nicht vorhanden festgestellt. Der erste Kameralauf prüfte
den Mausrad-Zoom noch nicht vollständig; erst der finale Lauf wartet auf
tatsächliche Maßstabsänderung und Ende der Kamerabewegung.

**M1 bleibt offen:** Live-Erweiterung der Darstellungswurzel mit konsistentem
Quellen-/Szenenwechsel, vollständige Szenenauswahl und echte Autorenabläufe.
Ein bloßes `setProjection` reicht für den Wurzelwechsel nicht: alte transportierte
Quellkoordinaten würden andere Weltmeter bezeichnen. Neue Quellen, Bridge und
Szene müssen gemeinsam vorbereitet und erst nach erfolgreicher Darstellung
übernommen werden. M2–M8 und die abschließende Leistungsabnahme sind weiterhin offen.
