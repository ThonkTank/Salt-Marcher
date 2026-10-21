# Direkte Höhenvorschau im normalen Atlas

21.10.2026. Lokaler Zwischenstand auf `3cc9aed49`; die JSON-Belege halten
Build-Hashes, schmutzigen Arbeitsstand, Testprofil und Prozessende fest.
Keine Leistungs- oder Produktabnahme und kein Nachweis auf dem Pentium Gold 7505.

## Änderung

Der geladene Geländeausschnitt enthält neben der sichtbaren Oberfläche auch den
Boden unter Wasser und potenzielle See-/Flusspegel. Derselbe begrenzte Stream
liefert diese Daten; Cache, Invalidierung, bestätigte Frame-Deltas und
Byteabrechnung berücksichtigen die zusätzlichen Arrays.

Ein Höhenzug verarbeitet neue Eingabesegmente direkt auf dem geladenen Raster
(maximal 257 × 257 Knoten). Vorschau und Speicherung teilen Zeitintegration,
Feather, Stärke und Rauschfunktion. Präzise Autorendaten, Trassenschutz und
Speicherung bleiben bei Main. Die Arbeitsfassung ist eine Näherung: grobe
Anzeigeauflösung, Glättung und geschützte Trassen können vom bestätigten Ergebnis
abweichen. Die Vorschau schreibt weder Autorenobjekte noch History.

Bestehende Landfarben bleiben erhalten; ein Materialzusatz zeigt entstehendes
Land und absinkende Küsten sofort. Höhenlinien lesen dieselben geänderten
Vertices. Updates und Steigungsprüfung betreffen die geänderte Rasterfläche;
Three.js muss nicht für jedes Bild alle Vertices nach einer neuen Bounding-Sphere
durchlaufen. Kamera und Treffpunktbasis bleiben während des Zugs fixiert.

Die Arbeitsfassung bleibt am Anfangszustand verankert, während bestätigte
Speicherstände eintreffen. Beim Abschluss ersetzt der neueste bestätigte Stand
die Arbeitsfassung vollständig. Ohne bestätigte Änderung wird der Ausgangsstand
wiederhergestellt. Die Anzeige darf die Vorschau nicht als gespeicherte Revision
etikettieren. Der unabhängige Eingabetakt wartet nicht auf Speicherantworten.

## Große native Welt

[Messung](world.json), [abschließendes Bild](world-sculpt.png).
40.000 × 20.000 km verteilte 100.000 Flächen und 5.000 Ortsobjekte ergänzen die
vorhandene Höhen-/Bewuchs-/Straßenfixture: insgesamt **108.076 Landschaftsobjekte**.
Das erfüllt noch nicht die gesamte Lastmatrix mit Gebäuden, Dungeonobjekten und
Volumen. Die regelmäßigen Rechtecke sind absichtlich erzeugte Lastdaten;
das Bild ist keine natürlich gestaltete Fantasykarte.

Im normalen Electron-Atlas: Navigation, 2.500-Meilen-Pinsel halten und bewegen,
Loslassen und gespeichertes Gelände anzeigen. Rendererfehler: keine.
PID 2980566 beendete sich normal mit Code 0; Abwesenheit anschließend geprüft.
GPU: Intel UHD 620, Host i5-8365U; nicht der angegebene Pentium-Laptop.

- Erste geänderte GPU-Pixel im 32 × 32-Pixel-Bereich in der Pinselmitte:
  **201,3 ms** nach Pointerdown (mindestens vier Pixel mit Kanaländerung ≥3).
  Das ist ein einzelner instrumentierter Lauf, keine p95-Latenzverteilung und
  kein physischer Bildschirmnachweis. Frühere Revisionsmessungen sind eine
  andere Metrik und kein direkter Vorher-Nachher-Pixelvergleich.
- RAF-Abstände: Navigation p95 **33,4 ms**, Maximum **266,6 ms**;
  Sculpt p95 **38,9 ms**, Maximum **133,4 ms**. Kein 60-fps-Nachweis.
- Abschluss: gespeichert, Revision 9, arbeitsfähige Übersicht. Vollständig
  nachgeladene Detailtexturen sind in diesem Lauf ausdrücklich nicht bestätigt.
- GPU-Orakel im gleichen Electron-Prozess: Unterwasser-Anheben erzeugt noch
  kein Land; Überschreiten des Wasserspiegels zeigt die eingestellte Landfarbe;
  Absenken zeigt Wasser; Verwerfen stellt dieselben ursprünglichen Pixel wieder
  her. Hexraster, Höhenlinien und Detailmaterial bestehen ebenfalls.

Der [erste Lauf](initial-run.json) hatte 242 ms erste Pixel und Sculpt-p95 46 ms.
Das Profil zeigte vollständige Steigungs- und Bounding-Sphere-Berechnungen pro
Bild; diese Arbeit wurde anschließend begrenzt. Der erste Lauf scheiterte
außerdem beim Warten auf sämtliche feinen Texturen nach 60 Sekunden. Dies bleibt
eine offene Leistungsgrenze. Der zweite Lauf prüft deshalb ausdrücklich die
Arbeitsfassung und den gespeicherten Übersichtszustand; er ersetzt keine
Detail-Abnahme. Beide Prozesse sind beendet.

Reproduktion nach `npm run build:desktop`:

```sh
SALTMARCHER_TERRAIN_TRACE=1 WORLD_POPULATED=1 WORLD_LARGE=1 WORLD_DRAFT=1 \
QA_EVIDENCE_DIR=.build/world-draft-108k \
python3 tools/ui-session.py timeout --signal=TERM 240s \
node tools/test-desktop-world-navigation.mjs
```

`WORLD_PROGRESSIVE=1` fordert zusätzlich sämtliche finalen Detailtexturen;
bei dieser Last ist diese zusätzliche Prüfung bislang fehlgeschlagen.

## Bedienung, Speichergrenze und lokale Prüfungen

[Native Bedienprobe](brush-ux.json), [frisch geöffneter Atlas](reopened.png):
Vorlagen und Radiusmodi, gesperrte Kamera während des Zugs, Undo/Redo, gekippter
Atlas, Reliefstil, PNG-Ausgabe und frischer Prozess mit 125 % Oberflächenskalierung
bestanden. Die kleine Raumfixture prüft die Bedienung, nicht die große Weltlast.
PIDs 2983903 und 2984470 endeten normal mit Code 0 und waren anschließend nicht
mehr vorhanden; Rendererfehler: keine. Dieser Lauf enthält auch die abschließende
Korrektur, die beim Verwerfen die tatsächliche vorherige Detailstufe beibehält.

Lokale Typprüfungen für Anwendung und Desktop, Desktopbuild sowie betroffene
Regressionen bestanden. Neue Fälle in `tests/terrain-brush-draft.test.mjs`
vergleichen additive Wirkungen mit dem kanonischen Writer und prüfen
Unterwasserhöhe, Zeitintegration, Glättung, Ziele und Sichtbarkeit. Erweiterte
Feld-/Cache-/Frame-Tests prüfen potenzielle Wasserpegel, Besitzer der Arrays,
Bytequoten, Invalidierung und Änderungen unter einer unveränderten Wasserfläche.
`tests/terrain-projection-ui.test.mjs` prüft bestätigte Präfixe während der
Arbeitsfassung und die vollständige Wiederherstellung ohne bestätigte Änderung.
Die bestehenden Brush-/Spatial-/Commit-/Live-Stroke-/Konturregressionen bleiben
die Gegenproben für Speicherung, Undo, Auswahl und Quellenwechsel.

## Offene Arbeit

Die Anforderungen ≤100 ms Pinselrückmeldung, flüssige Navigation, komplette
Weltlast, schnelle Detailverfeinerung, dauerhafte Speichergrenzen und passende
Fantasygestaltung bleiben offen. Die Vorschau verkürzt den Weg zur sichtbaren
Geländeänderung; sie löst noch nicht die Kosten der bestätigten Projektion,
Nachladeaufträge oder gesamten Szenendarstellung. Der Gesamtauftrag bleibt aktiv.
