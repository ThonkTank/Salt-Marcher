# M2: begrenzte grobe Geometrie der festen Welt

Isolierter Atlasumbau, noch keine Produktübernahme. Ausgangscommit
`323c0b4ae`; der Bericht belegt den Arbeitsstand über Quell- und Build-Hashes.
Die normale Atlasoberfläche nutzt weiterhin ihren bisherigen Renderer.

## Änderung und Grenzen

Der bisherige vollständige Geometrie-DTO bricht im festen 4096-m-Ausschnitt am
Quellenbudget ab. Die grobe Kachel (`lod >= 1`) liest nun Seiten von höchstens
32 Kandidaten und leitet die physische Raum-/Gebäudegeometrie mit dem bestehenden
kanonischen Adapter ab. Kein SQLite-Iterator überlebt eine Worker-Unterbrechung.
Die 48.670 dort vorhandenen Zeichnungselemente werden gezählt und als fehlende
Darstellung ausgewiesen; ihre vollständigen Nutzdaten werden nicht geladen.

Ein fester 256×256-Akkumulator schneidet tatsächliche Dreiecke auf Zellen und
behält ihre XY-Grenzen und Z-Hülle. Wenn mehr als 16.384 Zellen belegt sind,
werden ausschließlich disjunkte 2×2-Gruppen zusammengefasst, zuerst jene mit
der geringsten zusätzlichen Fläche pro eingesparter Zelle. Die Ausgabe bleibt
bei höchstens zwei Meshes und 5.898.240 Byte numerischen Puffern. Das ist eine
**Kachelgrenze**, keine Grenze für den ganzen sichtbaren Atlas oder den gesamten
Worker-RAM. Bindings und Bereichsmetadaten werden weiterhin kampagnenweit gelesen.

Die Hülle ist ausdrücklich ungenau und nicht semantisch auswählbar. Geschosse,
Räume und Dächer können sich innerhalb einer Zelle überlagern. Bei ausgewähltem
Scope/Geschoss oder geöffneten Dächern unterdrückt der Präsentationsadapter die
Hülle und fordert Detailkacheln. Feinkacheln behalten ihre kanonischen IDs und
exakte Dreiecks-Auswahl. Quellengestützte Auswahl aus einer reinen Übersicht
und automatische Werkzeugübernahme sind noch offen.

Unveränderte Quellenversionen laden gespeicherte Puffer ohne erneute Quellen-
oder Höhenabfragen. Bei Änderungen entscheidet ein lokaler Quellenfingerabdruck
mit physischen Höhenabhängigkeiten. Höchstens 32.768 Höhenanker werden gespeichert;
größere Ankersätze führen nach Änderungen zu einem konservativen Neuaufbau.
Vorschauquellen bleiben flüchtig. Der bestehende gemeinsame Cache besitzt die
Atomarität, Verdrängung und Plattengrenzen.

## Nacharbeit aus der Sichtprüfung

Die erste Variante füllte jede belegte 128×128-Zelle vollständig. In der festen
Welt schloss das viele Zwischenräume zwischen den im 30-m-Raster stehenden
Raumgruppen: Die native Ansicht wirkte wie eine Platte. Der flache Screenshot
scheiterte zudem an der allgemeinen Prüfung auf genügend unterschiedliche Farben.
Dieser Lauf ist **keine erfolgreiche native Qualifikation**.

Die endgültige Variante verdoppelt die Abtastauflösung und verwendet engere,
aus den Dreiecken abgeleitete XY-Grenzen. Die Grenze der ausgegebenen Zellen
bleibt gleich. Ein zusätzlicher dichter Häuserfall prüft erhaltene Leerflächen.
Die native Probe besitzt außerdem eine eigene Canvas-Pixelprüfung, getrennt
vom technischen Kopftext außerhalb des Canvas. Der Kopftext ist Probeoberfläche,
kein neuer Produktdialog.

## Prüfwege

- `tests/atlas-geometry-overview.test.mjs`: Löcher, winzige und vertikale Geometrie,
  Halboffengrenzen, physische Höhen, entfernte Koordinaten, voller Ausgabefall
  und Zwischenräume bei hoher Dichte.
- `tests/atlas-geometry-tiles.test.mjs`: persistente Wiederöffnung ohne Quellenlesen,
  lokale/entfernte Änderungen, Umbenennung, Terrain, Undo/Redo, versteckte
  Geschosse und unveränderte physische Gebäudehöhe; fein und grob.
- `tests/atlas-geometry-overview-service.test.mjs`: 1.500 Räume im echten Worker,
  Neustart, typisierte Puffer, Revisionwechsel nach tatsächlicher Unterbrechung,
  Verwerfen des Teilergebnisses und Vergleich mit einem frischen Worker.
- `tests/atlas-deck-geometry-overview.test.mjs` und
  `tests/atlas-deck-surface.test.mjs`: nicht auswählbare Übersichtsmeshes,
  behaltene GPU-Puffer und Kameratransformationen.
- `tests/atlas-geometry-mesh.test.mjs`: exakte feine Raum-/Gebäudekacheln.
- `tools/measure-atlas-geometry-world.mjs`: Quellenabfrage und Kachelaufbereitung
  der unveränderten eingefrorenen M0-Welt; ohne Worker-IPC und GPU.
- `tools/test-desktop-atlas-geometry-overview.mjs`: dieselbe M0-Welt durch
  Preload/Main/Worker, gekippte und flache Übersicht, sichtbare Zwischenräume,
  keine erfundenen Auswahlziele, frischer Prozess mit identischen Cachepuffern,
  separate feine Raumdarstellung mit exakter Auswahl. Keine automatische
  Zoom-/Werkzeugübernahme und kein vollständiger Atlasablauf.

## Ergebnis des endgültigen Arbeitsstands

33 gezielte Tests bestanden; `npm run check`, `npm run check:desktop` und
`npm run build:desktop` bestanden. Getrennte Protokolle:
[Tests](tests.log.gz), [Offline-Welt](world-result.json.gz),
[native Messung](native-result.json.gz).

Die feste Welt enthält 5.000 Raumgruppen und 15.701 Räume insgesamt. Im
4096-m-Ausschnitt gehen 11.500 sichtbare Räume in **ein Mesh mit 979.272 Byte**
und 27.202 Dreiecken ein. Die 48.670 Zeichnungselemente bleiben ausdrücklich
offen. Das Mesh ist eine vereinfachte Hülle, keine Rekonstruktion aller Details.

| Messung | Einzellauf |
| --- | ---: |
| Offline: kalter Projektionsindex, vor Kachelaufbereitung | 4.11 s |
| Offline: neue grobe Kachel bei bereitstehendem Index | 3,96 s |
| Offline: Kachelcache wieder öffnen, gleicher Reader/Index | 49 ms, 0 Quellen-SQL |
| Native: erste grobe Kachelabfrage einschließlich Worker/Index/IPC | 7,56 s |
| Native: danach Renderaufbau bis erstem verwendbaren Bild | 249 ms |
| Native: grobe Kachelabfrage in frischem Prozess, gleicher Cache | 401 ms |
| Native: neue Feinkachel, 272 exakte Raumobjekte | 635 ms Daten + 781 ms Renderaufbau |

Diese Zeiträume sind getrennt: Der native Abfragebeginn liegt **nach**
Kampagnenaktivierung und Quellenversionsermittlung. Die Summe von Abfrage und
Renderaufbau ist kein vollständiger App-Startbenchmark. Die warmen 401 ms messen
die Datenantwort, nicht einen erneut angezeigten Übersichtsframe. Alle Werte
stammen aus einzelnen lokalen Läufen, ohne p95-Aussage.

Beide nativen Prozesse beendeten sich regulär mit Exit 0; ihre PIDs waren danach
nicht vorhanden. Keine Rendererfehler. Die frische Übersicht besitzt dieselben
Pufferdigests. Die geprüften kanonischen Tabellen und Atlasrevision 4 blieben
unverändert. In der feinen Ansicht wurde Raum
`mixed-house:0:1e7u1vv:room:103` auf 1703,051 m exakt getroffen.

Die unabhängige Pixelprüfung findet 14.114 Geometriepixel; deren Anteil innerhalb
ihrer sichtbaren Begrenzung beträgt 13,8 %, also klar erkennbare Zwischenräume.
Das ist kein Flächenfehlermaß gegenüber dem vollständigen Autorenmodell.

- [Verworfene Vollzellen-Übersicht](rejected-full-cells.png): qualitativer
  Sichtbefund des fehlgeschlagenen ersten Versuchs, keine bestandene Qualifikation.
- [Endgültige flache Übersicht](overview-flat.png) und
  [gekippte Übersicht](overview-tilt45.png).
- [Separate exakte Raumansicht](fine-room.png).

## Einordnung

M2 bleibt offen: Kalte Weltaufbereitung, weitere Objektklassen, flächengetreue
Materialstufen, globales Budget einschließlich Projektionsindizes und vollständige
Weltinteraktion sind nicht durch diese Teilprüfung erledigt. Einzelne Messungen
sind keine p95-Qualifikation. Eine bestandene technische Probe ist weder
Main-/Release-Nachweis noch Produkt- oder Owner-Abnahme.
