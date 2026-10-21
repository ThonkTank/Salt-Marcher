# Gemeinsame Quellknoten für schnellere Geländeabtastung

Stand: 21.10.2026. Produkt- und nativer Prüfstand: `06e8dd03f85567ac8dead4c5c147b99d5737337f`. Vergleichsbasis: `ba32afaed086977fdb8ba8db7dd491b3b4e12679`. Die Änderung verbessert den vorhandenen Atlas aus `npm run start:desktop`; sie führt keine zweite Karte ein.

## Im Produkt umgesetzt

Bisher sammelte der Feldkern dieselben vier Höhenknoten für jedes Ausgabepixel erneut. `terrain-height-lattice.ts` bildet jetzt pro Auflösung die Menge tatsächlich benötigter Quellkoordinaten. Aufeinanderfolgende Ausgabepixel teilen deren Werte. Auch bei weit auseinanderliegenden Samples wird nur diese begrenzte Menge gehalten, kein vollständiger Ausschnitt der Autorenkacheln.

`terrain-field-stream.ts` bleibt Besitzer der Bandgrenzen, geschlossenen SQL-Iteratoren, Trassenkorrekturen und Wasserauflösung. Die neue Sammlung behält die bisherige bilineare Rechnung einschließlich ihrer Summenreihenfolge, Nullgewichte, NaN-Vererbung und additiven Höhenbänder. Die Speicherwerte und die angezeigte Geometrie ändern sich nicht. Weltkoordinaten bleiben Float64; die Indizes in den begrenzten Zwischenarrays dürfen Uint32 verwenden.

## Nachweis und begrenzte Messung

[23 Regressionen](tests.log) bestehen: exakte Übereinstimmung mit der kanonischen Punktabfrage, negative Kachelgrenzen, gebrochene Ursprünge, weit entfernte Koordinaten, wiederholte und disjunkte Quellzellen, doppelte Kacheln, additive/sparse Bänder, Teilblöcke, Seen/Trassen, Farbkacheln, lokale Cache-Invalidierung und abbrechbare Workeraufträge. Die neun aktuellen Pixelgoldens bleiben unverändert. [App](check.log), [Desktop](check-desktop.log) und [Repositoryprüfung](check-repo.log) bestehen.

Die [gepaarte Kernprobe](kernel-result.json) verarbeitet je Fall 1.048.576 Samples. Baseline und neuer Produktkern umrahmen die experimentellen Varianten in derselben Reihenfolge vorwärts/rückwärts. Es liefen keine eigenen nativen Proben oder CPU-Prüfungen parallel. Andere Hostarbeit wurde nicht verändert.

| Feld | Alte Sammlung | Neue Sammlung im Produkt |
| --- | ---: | ---: |
| Glatter Hügel, vollständige Höhenkacheln | 340 / 253 ms | 118 / 89 ms |
| Drei Auflösungen, absolute und additive Bänder mit Löchern | 864 / 762 ms | 298 / 321 ms |

Das sind isolierte Feldkernzeiten, keine Bildraten oder garantierten Eingabelatenzen. Frühere Messungen schwanken, zeigen aber dieselbe Richtung. Das Werkzeug [measure-terrain-interpolation.mjs](../../../tools/measure-terrain-interpolation.mjs) baut die unveränderte alte Feldsammlung aus dem genannten Gitstand und den aktuellen Produktkern. Es prüft deren vollständige Ergebnisgleichheit zusätzlich zu den Zeitmessungen.

Der [wörtliche Entwicklungsstart](repository-result.json) besteht normale Kampagnennavigation, Zoom während des Nachladens, Neigen/Drehen auf derselben Fläche, GPU-Konturen-/Upload-Pixel, Grafikverlust und Wiederanlauf. In diesem Lauf erscheint die Übersicht nach 2.316 ms, die erste feine Farbe 421 ms später und die vollständige Verfeinerung 5.232 ms nach der Übersicht. Die kalte Darstellung benötigt also weiterhin Sekunden.

Die [Live-Probe](live-result.json) besteht unmittelbares Formen, Glätten, kumulative Farbe, Escape, Fokusverlust, Höhenprofil, geneigten Pinselzug, frisches Öffnen und einmaliges Undo. Die [Küstenprobe](coast-result.json) besteht schrittweises Nachladen und geneigte Darstellung derselben Hauptfläche einschließlich tatsächlicher GPU-Upload-Pixel. [Hauptkarte](main-tilted.png) und [Küste](main-coast.png) wurden visuell geprüft; die bekannten eckigen Höhenlinien und teilweise weichen Küsten bleiben sichtbar.

Alle finalen nativen Abläufe verwenden identische Main-, Preload-, Renderer- und HTML-Builds. Sie liefen nacheinander, endeten normal mit verschwundenen PIDs und enthalten keine Rendererfehler. Historische ungetrackte Belege und neue Prüfwerkzeuge erklären `dirty: true`; die Produktänderung ist committed.

## Glattere Rekonstruktion: noch nicht integriert

Der [isolierte native Vergleich](interpolation-native-result.json) verwendet dieselben gespeicherten Knoten und den Produktrenderer. Je Variante werden Höhengeometrie und Gelände-Raster gemeinsam neu berechnet. Eine temporäre Änderung der Sampler-Klasse gilt ausschließlich im Prüfvorgang; es werden keine Landschaften geschrieben. Zwölf Bilder entstehen aus vier Motiven und drei Interpolationen. Die wesentlichen Varianten sind hier erhalten:

| Nahzoom auf dieselben 16-m-Höhendaten | Ergebnis |
| --- | --- |
| [Bilinear](hill-close-bilinear.png) | Sichtbar polygonale Höhenlinien; RMSE der Höhe 0,1634 m gegenüber dem analytischen Hügel |
| [Catmull-Rom](hill-close-catmull.png) | Sehr rund; Fehler 0,0020 m, aber unzulässiges Überschwingen an Plateaus |
| [Begrenzte kubische Interpolation](hill-close-monotone.png) | Rundere Konturen; Fehler 0,0217 m, ohne zusätzliche Extrema im Plateauversuch |

Beim Testübergang von −20 auf 100 m erzeugt Catmull-Rom −28,888 bis 108,888 m. Die begrenzte Variante bleibt exakt innerhalb −20 bis 100 m. Bilder: [überschwingende Variante](plateau-coast-catmull.png), [begrenzte Variante](plateau-coast-monotone.png). Catmull-Rom wird deshalb verworfen. Das [gemalte Relief](painted-region-monotone.png) zeigt trotz runderer Flanken weiterhin Treppen und gestalterisch grobe Plateaukanten; glatte Interpolation allein liefert noch keine fertige Kartengestaltung.

Der [erste gestreamte Versuch](first-kernel-result.json) ist etwa vier- bis fünfmal langsamer als die alte bilineare Sammlung. Eine [erste gemeinsame Quellknotensammlung](uncached-cubic-result.json) reicht allein noch nicht aus. Die endgültige experimentelle Variante ergänzt wiederverwendete horizontale Zwischenwerte; vollständige Zeilen werden einmal berechnet, Löcher fallen auf dieselbe kanonische Vererbung zurück. Sie stimmt in den geprüften Teilblöcken und negativen Kachelrändern exakt mit dem skalaren kubischen Prototyp überein. Im finalen Kernvergleich benötigt sie 73/55 ms für das vollständige Hügel-Feld und 1.171/1.236 ms für die Bänder mit Löchern. Gerade sparse Felder bleiben damit deutlich teurer als der neue bilineare Produktkern. Diese Variante ist weiterhin ausschließlich Prüfcode.

Die Probe belegt außerdem eine notwendige Anschlussänderung: Am Punkt (0,5; 7,125) ergibt ein vollständiges Testfeld 42,78125 m, das heutige Lesen mit einem Nachbarknoten nur 43,02429 m. Mit zwei Nachbarknoten stimmt das Ergebnis wieder exakt. Bloßes Auswechseln der Interpolationsformel würde somit neue Kachelnähte erzeugen.

Nächster gemeinsamer Anschluss:

1. Einen geprüften, begrenzten Kernel für kanonische Punktabfragen und den gestreamten Feldkern verwenden; gespeicherte Knotenwerte, additive Bänder und Vererbung erhalten.
2. Räumliche Lesebereiche und lokale Invalidierung um den erforderlichen zweiten Nachbarknoten erweitern. Bestehende SQL-/RTree-Metadaten, Undo/Redo und Paket-/Wiederöffnungswege ausdrücklich mitprüfen. Bisherige History-Zeilen dürfen keine alten, zu kleinen Grenzen wiederherstellen.
3. Terrainfarbe, Wasser-/Küstenentscheidung, Geländenetz, sichtbare Treffpunkte, Live-Pinsel und Export auf dieselbe Rekonstruktion prüfen. Sparse Feldkosten und große Operationen bleiben Leistungsprüfungen.
4. Den normalen Entwicklungsstart mit langsamem/schnellem Zoom, geneigter Bearbeitung, Kachelwechseln und frischem Öffnen visuell und numerisch nachprüfen. Die isolierten Bilder sind keine Hauptatlas-Abnahme.

Die Hilfswerkzeuge unter `tools/terrain-interpolation-*` gehören ausschließlich zum Versuch. Sie ändern keine Produktdateien und schlagen bei abweichenden erwarteten Quellstellen fehl. Ihr alter Rechenkern ist ausdrücklich auf den genannten Gitstand festgelegt.

## Offener Gesamtumfang

P3/P4 und die übrige [Roadmap](../../plans/maps/unified-spatial-atlas.md) bleiben offen: glatte kanonische Rekonstruktion, weltweite Geometrie-LOD, Küstenschärfe, semantische Straßen-/Fluss-/Bewuchs-/Objekt-/Namensstufen, Innenräume, Spieleranzeige sowie große Welten und lange Sitzungen. Candidate-CI, Main-Integration, Paket, Installation und Nutzerabnahme sind nicht erfolgt. Die drei vollständigen kritischen Abschlussprüfungen haben nicht begonnen.
