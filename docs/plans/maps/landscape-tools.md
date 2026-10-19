# Straßen, Flüsse und Landschaftspinsel

Beauftragter Ausbau vom 19.10.2026. Städte, Symbole, Generator und Heightmap-Import sind ausgeschlossen. Die ursprüngliche Lieferung ließ bestehende Karten unverändert; die unten beschriebene Landmasken-Umstellung übernimmt nun explizite Gelände-/Wasserflächen.

## Bedienung und Daten

Straßen und Flüsse speichern Weltmeter-Kontrollpunkte und optionale `line.version = 1`: Kurve, Farbe, Rauheit, Mäander, Quellverjüngung, Zufallsstart, Straßenmuster und Zeichenebene. Die zehn Straßenmuster bilden die sichtbaren Referenzvorschauen mit eigener Geometrie nach; proprietäre Assets werden nicht übernommen. Neue Vorgaben und ausgewählte Objekte besitzen getrennte Kontrollen. Umschalt-Klick erweitert die Auswahl derselben Verlaufsart; Ziehen verschiebt die ganze Auswahl. Breite/Stil lassen sich ausdrücklich gemeinsam anwenden. Punktaktionen bleiben erhalten. Teilen speichert angrenzende Tangenten und den bisherigen Verlaufabstand.

Land hinzufügen/radieren, Küste anheben/absenken und Süßwasser hinzufügen/radieren sind Wirkungen des Geländepinsels. Küstenänderungen betreffen nur den berührten Rand. Süßwasserradierung entfernt die eigene Wasserschicht und legt das darunterliegende Gelände frei. Die alte Eigenschafts-/Hexbearbeitung bleibt verfügbar.

Gelände- und Wasserfarbe speichern `paint.version = 1` ohne Spielwerte: Ziel, Farbe, Deckkraft, Auftragsstärke, Spitze, Radius, Zufallsstart und Strichpunkte. Auftragsstärke akkumuliert innerhalb eines Strichs; Deckkraft begrenzt den gesamten Auftrag. Füllen verwendet die zusammenhängende angelegte Land-/Wasserfläche. Farbmasken richten sich nach der aktuellen Wasserverteilung. Die Pipette liest den sichtbaren Kartenpixel; die Palette bleibt lokal erhalten. Farbradierer beschneiden nur Farbflächen.

Pinselzüge schließen beim Loslassen ab. Punktfolgen schließen per Rechtsklick oder Enter ab. Escape verwirft, Backspace entfernt den letzten Entwurfspunkt; Texteingaben bleiben geschützt. Eine Transaktion bildet einen Undo-Schritt. Bei einem Schreibfehler bleiben Entwurf und einzelne Pinselzüge erhalten; ein erneuter Versuch verbindet getrennte Züge nicht miteinander.

## Implementierung und Grenzen

`landscape-line.ts` erzeugt deterministische numerische Geometrie für Vorschau, Canvas, SVG-Adapter, Rasterübersicht, Export und genaue Abfragen. Bounds umfassen die erzeugte Kurve und ihre Breite. Datensätze ohne neue Optionen verwenden weiterhin ihre ursprünglichen Linien und Zeichenreihenfolgen. `landscape-brush.ts` speichert örtliche Polygonmasken; berechnet werden ausschließlich angeforderte Rasterkacheln. Es gibt keine weltgroße Farbfläche.

Die vorhandene SQLite-Schreibgrenze, Receipts, Undo/Redo, Archive und Wiederherstellung tragen die neuen optionalen Felder unverändert. Mehrfachbearbeitung und Radierung sind atomar. Kurven sind auf 2000 Kontrollpunkte begrenzt, Farbzüge auf 4000 Abdrücke, Füllen auf 10000 Autorenflächen. Extreme Pfeil-/Schraffurverläufe begrenzen die Anzahl ihrer Muster auf 2000; die Verteilung bleibt kameraunabhängig.

## Vergleich und Nachweise

Die ursprünglichen Fälle WD-005–007 und WD-009–012 bleiben erhalten. Wasserfarbe gehört zusätzlich zum vorhandenen WD-008. Kein ursprünglicher Abnahmestatus wird durch Implementierung oder Unit-Tests ersetzt.

| Paket | Bestehende Fälle | Gezielte Prüfung |
| --- | --- | --- |
| Kurvenbasis und Bearbeitung | WD-012.01–02 | Weltkoordinaten, Teilung ohne Kurvenwechsel, Verschieben, Batchkonflikt, Undo/Redo |
| Straßen | WD-011.01–02 | Zehn numerische Stile, getrennte Vorgaben, Ebene, lange schmale Verläufe |
| Flüsse | WD-010.01–03 | Breite, Quellverjüngung, deterministische Mäander, Kurvenabfrage und Endpunktanschluss |
| Land und Süßwasser | WD-005.01–02, WD-006.01–02, WD-009.01–02 | Küste erweitern/zurückdrängen, Radierung legt Originalgelände frei |
| Farbpinsel | WD-007.01–02, WD-008.01–02 | Drei Spitzen, getrennte Spielwerte, Wasser-/Landmaske, Auftragsstärke/Deckkraft, Füllen, Radieren, Archivkopie |

Automatische Regression: `tests/desktop-landscape-tools.test.mjs`, vorhandene Atlas-Region-/Frame-/Landschaftstests. Native Prüfung: `tools/test-desktop-landscape-tools.mjs` startet eine synthetische Kampagne in einem eigenen Datenordner und prüft echte Eingaben, Abschluss, Abbruch, Neustart, Bearbeitung und PNG-Ausgabe. `ATLAS_PACKAGE` richtet dieselbe Probe auf die installierte Kopie. Ergebnisse liegen unter dem durch `QA_EVIDENCE_DIR` bestimmten Verzeichnis.

Direkte Referenz: Wonderdraft 1.1.8.2 unter `/opt/Wonderdraft/Wonderdraft.x86_64`. Die isolierte Optionssitzung `/tmp/wonderdraft-options-bssu1c` zeigt erneut zehn Pfadvorschauen sowie Farbe, Breite, Rauheit und Zeichenebene (`path-options.png`). Dies ist ein Oberflächenbeleg. Die zuvor abgestürzte Wirkungsprobe bleibt fehlgeschlagen; die Optionssitzung liefert keinen abgeschlossenen Vorher-/Nachher-/Wiederöffnungsvergleich. Exakte Originalwirkungen von Rauheit, Mäanderabstand, Spitzen und Übergängen sowie vollständige grafische Gleichwertigkeit bleiben offen. Installation und bestandene Hostprüfungen allein schließen diese Paritätsabnahme nicht ab.


## Landmaske und vier Landpinsel · 19.10.2026

Dieser Ausbau ersetzt die oben beschriebene polygonbasierte Land-/Küstenbearbeitung. Unbearbeiteter Atlas ist Wasser. Land zeichnen, Land radieren, Fraktal erhöhen und Fraktal absenken bearbeiten eine gemeinsame kontinuierliche Maske; die Schwelle 32768 trennt Wasser von Land. Geografische Höhe bleibt unabhängig. Fraktale Pinsel wirken nach Einwirkzeit, auch ohne Bewegung und fern bestehender Küsten. Schnelles Streichen kann unter der sichtbaren Schwelle bleiben; diese Zwischenwerte bleiben gespeichert.

`land-mask.ts` enthält den gemeinsamen Pinselkern und verlustfreie 16-Bit-RLE-Kacheln mit 256 × 256 Werten. Weltkoordinaten und Zweierpotenz-Auflösungen erlauben unbegrenztes Schwenken und lokale Verfeinerung. Große Züge bearbeiten vorhandene feinere Kacheln mit. Kacheln sind normale `atlas_landscape`-Records mit `mask.version = 1`; ihre Rechtecke dienen ausschließlich der Bereichsabfrage. Die vorhandenen Transaktionen, History, Journale, Bereichsframes und Archive bleiben zuständig. Vorschauen lesen begrenzte Originalausschnitte ohne TEMP-Indexaufbau, damit der Quellen-Fence unverändert bleibt. Kamera und Export nutzen abgeleitete Raster, Punktabfragen die Originalwerte.

Format 47 übernimmt explizite alte Gelände-/Wasserflächen einmalig. Bisher implizites Land wird Wasser. Betroffene Kampagnen beginnen dabei einen neuen Atlas-Undo-Verlauf, weil alte Polygon-Deltas keine Masken wiederherstellen können; gespeicherte Inhalte bleiben erhalten. Ältere Appversionen dürfen das neue Format nicht öffnen. Vor der lokalen Installation wird deshalb die bisherige Profildatenbank gesichert.

Vier direkte Schalter, getrennte Größen für Land und Radierer sowie gemeinsame Größe/Rauheit für die Fraktalpinsel. Rauheit 0,1–2, Vorgabe 1; Größen in Weltmetern. Loslassen speichert einen Undo-Schritt, Escape verwirft. Stationäre Eingaben und zusammengefasste Pointerereignisse behalten ihre tatsächlichen Zeitstempel. Ein gescheiterter Schreibversuch behält die unveränderte Eingabe zum Wiederholen.

Gezielte Regression: `tests/desktop-land-mask.test.mjs`. Native Probe: `tools/test-desktop-land-mask.mjs`, auch mit `ATLAS_PACKAGE` auf einer gepackten Installation. Originalvergleich: Wonderdraft 1.1.8.2, vier Pinsel einschließlich schneller/langsamer Bewegung, Halten, Undo/Redo, Wiederöffnen und offiziell extrahierter Maskendaten. Die Originalimplementierung ist unbekannt; Verhalten und Formwirkung werden verglichen, keine identischen Pixel oder vollständige Wonderdraft-Parität behauptet.
