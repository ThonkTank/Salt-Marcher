# Viele kleine Gebäude im selben Ausschnitt – 22.10.2026

Die native Langzeitprobe fand vor Beginn der eigentlichen Speicherqualifikation
einen langen Stillstand: Welt → Region → Nachbarschaft ließ Auswahl und
Bearbeitung länger als 60 Sekunden gesperrt. Die Kamera zeigte weiterhin den
vorherigen Kartenstand. [Fehlerzustand und Workerzeiten](before-stall.json)
belegen eine einzelne Bereichslesung mit 49,82 Sekunden; ihre Synchronisation
brauchte nur 1,68 ms. Der Test wurde beendet und sein Prozess ist verschwunden.
Das ist ein fehlgeschlagener Test mit Notbereinigung, kein regulärer Abschluss.

![Vorheriger Kartenstand bleibt beim Hineinzoomen geladen](before-stall.png)

## Ursache und Korrektur

Raumgruppen besitzen voneinander unabhängige lokale Koordinaten. Viele kleine
Gebäude überlagern sich deshalb im lokalen räumlichen Index, obwohl sie im Atlas
an verschiedenen Weltpositionen liegen. Der ausschließlich räumlich beginnende
Join prüfte diese gemeinsamen Kandidaten für jedes Gebäude erneut. Bei einem
großen einzelnen Dungeon ist genau dieser Suchweg dagegen notwendig: dort muss
ein kleiner Ausschnitt nicht erst alle Objekte seines Besitzers durchlaufen.

`AtlasRegionReader.candidates` prüft nun höchstens 129 Einträge des bestehenden
Gruppenindex. Gruppen bis 128 Einträge beginnen dort und schlagen die räumlichen
Grenzen anschließend nach. Größere Gruppen beginnen weiterhin mit dem Rtree.
Beide Wege benutzen dieselben Rtree-Grenzen, Filter und Zeichenreihenfolge; es
gibt keine neue Quellzuordnung, Tabelle oder möglicherweise veraltete Größenliste.
Der Zusatz dient nur der Auswahl des günstigeren Abfrageplans.

## Vergleich auf identischer großer Welt

[Lesemessung](paired-reads.json) gegen den Main-Stand `da6c88eb`, gleiche Daten,
gleiche Abfragen und alle übrigen Abhängigkeiten unverändert:

| Ausschnitt | Vorher | Nachher |
| --- | ---: | ---: |
| Welt | 387 ms | 295 ms |
| Region | 62 ms | 69 ms |
| Einzelgebäude | 380 ms | 132 ms |
| Dungeon | 306 ms | 260 ms |
| Nachbarschaft, 11.200 sichtbare Geometrieobjekte | 56.018 ms | 2.835 ms |

**Alle fünf vollständigen Antworten einschließlich Raster sind bytegleich.**
Die Nachbarschaft ist derselbe Zwischenmaßstab wie im Fehlerlauf; reine Welt-
und Einzelgebäudeproben hatten ihn nicht abgedeckt. Es sind einzelne lokale
Messpaare, keine garantierten Laufzeiten. Auch 2,8 Sekunden liegen weiterhin
über dem Ziel unmittelbar nachladender Ansichten.

Der Vergleich ist mit `tools/measure-atlas-region-opening.mjs` und
`ATLAS_REGION_NEIGHBORHOOD=1` reproduzierbar. Die native Gegenprobe verwendet
`tools/test-desktop-atlas-scale-roundtrip.mjs` mit einer privaten Kopie der
synthetischen Mischwelt. Ohne Dauerparameter läuft sie einmal Welt → Region →
Nachbarschaft → Gebäude → Innenraum → Welt. `ATLAS_NAVIGATION_MINUTES=30` ergänzt
wiederholte Navigation mit PSS-/Heap-Messungen ohne erzwungene GC. Sie ersetzt
keine wiederholte Bearbeitungs- oder physische Pentium-Qualifikation.

## Native Gegenprobe und Regressionen

[Der vollständige Maßstabswechsel](roundtrip.json) ist nach der Korrektur
bestanden: 40.000 km → 2.000 km → 20 km → 400 m → 80 m → zurück zur Welt.
Die erste Runde einschließlich Wartezeiten und Rückweg dauerte rund 85 Sekunden.
Das 80-m-Bild erreicht den Innenraummaßstab, ist aber keine vollständige
Innenraumbearbeitung. Die sichtbare Karte ist eine technische Lastfixture, keine
gestalterische Referenz.

![Gebäude nach dem zuvor blockierenden Zwischenmaßstab](after-buildings.png)

Landschaft, Räume, Zeichnungselemente, Gebiete und Atlasrevision blieben nach
Hashvergleich unverändert. Der native Prozess endete regulär mit Code 0, ist
verschwunden und meldete keine Rendererfehler. Alle elf gebauten Artefakte
wurden abgeglichen. 65 betroffene Bereichs-/Cachetests, beide Typechecks,
Desktopbuild und Repositoryprüfung bestanden. Neue Regressionen prüfen 2.000
kleine Gruppen mit überlagerten lokalen Koordinaten, gleiche räumliche
Kandidaten/Zeichenreihenfolge sowie den Wechsel zum Rtree beim Wachstum einer
Gruppe. Der bestehende Fall für einen großen Einzelbesitzer bleibt bestanden.

## Wiederholte Navigation über 31 Minuten

Die [vollständige Speicherprobe](navigation-memory.json) durchlief 22 Runden
in 31,1 Minuten ohne erneuten Ladehänger oder Rendererfehler. Kartendaten und
Atlasrevision blieben gleich. Der Prozess endete regulär mit Code 0; alle vier
beobachteten Electron-Prozesse sind beendet. Die elf Build-Artefakte blieben
während des gesamten Laufs unverändert. Das abschließende Weltbild wurde geprüft.

Verglichen werden ausschließlich beruhigte Weltansichten, ohne erzwungene GC:

| Abschnitt | Prozess-PSS, Minimum / Median / Maximum | Renderer-JS-Heap, Median |
| --- | --- | ---: |
| Minute 5–15, 7 Messpunkte | 870 / 1.060 / 1.520 MiB | 48 MiB |
| Minute 15–31, 12 Messpunkte | 891 / 1.115 / 1.560 MiB | 51 MiB |

Der Lauf zeigt wiederkehrende Speicheranstiege und Rückgänge, keinen
fortlaufenden Anstieg. Das ist ein Teilbeleg für Navigation, keine abgeschlossene
Ressourcenabnahme: wiederholte Terrainbearbeitung fehlt, PSS erfasst nicht den
gesamten Grafikspeicher, und der Entwicklungsrechner ersetzt den Pentium-Laptop
nicht. In der Mitte des Laufs liefen kurze SQL-Diagnosen und gezielte Tests;
die Zeitwerte dieses Laufs sind deshalb keine isolierte Navigationsmessung.
Die rohe Messung und ihre Prüfsumme bleiben im kompakten Beleg referenziert.

## Folgeänderung nach der Releasequelle 0.185.0

Neu materialisierte Räume und Zeichnungselemente werden direkt für die aktuelle
Lesung verwendet. Der begrenzte Cache besitzt weiterhin ausschließlich ihren
serialisierten Text; spätere Zugriffe erhalten eigene Objekte. Die unmittelbar
nach dem Serialisieren erfolgte zweite JSON-Kopie entfällt. Historische
Stadtelemente behalten ihre JSON-Normalisierung, damit optionale Felder bei kalten
und warmen Lesungen identisch bleiben.

55 Bereichstests bestehen, einschließlich veränderter kalter und warmer
Ergebnisobjekte, Ausschnitten, Invalidierung und alten Stadtobjekten. Alle fünf
[vollständigen Vergleichsantworten](cold-shape-reads.json) bleiben bytegleich.
Die Nachbarschaftslesung benötigt in diesem einzelnen isolierten Paar 3.013
beziehungsweise 2.861 ms. Andere Ausschnitte schwanken in beide Richtungen;
daraus folgt keine allgemeine Latenzgarantie oder vollständige Leistungsabnahme.

Die [native Gegenprobe der Folgeänderung](cold-shape-native.json) erreicht erneut
alle sechs Maßstäbe und kehrt zur Welt zurück. Daten und Revision bleiben gleich,
der Prozess endet regulär und alle elf Artefakte stimmen überein. Gebäude- und
Weltbild wurden kontrolliert. Beide Typechecks, Desktopbuild und Repositoryprüfung
bestehen. Die Folgeänderung ist nicht im bereits veröffentlichten Paket 0.185.0.
