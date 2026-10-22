# Weltübersicht mit kompaktem Objektindex und begrenztem Detailcache

## Befund und Umsetzung

Die vollständige gemischte Prüfwelt benötigt beim ersten Blick 15.701 Räume und 48.670 Zeichnungselemente als Quellen. `AtlasRegionReader.sync` baute bisher vor der ersten Ansicht eine vollständige zweite Zeichenkopie aller Objekte auf. Jeder Eintrag pflegte einzeln den Rtree. Außerdem verwendete SQLite für jeden 128-Zeilen-Block einen Kampagnenindex und sortierte den verbleibenden Bestand erneut, statt dem vorhandenen Rowid-Cursor zu folgen.

Der Leser hält nun im temporären Gesamtindex ausschließlich Identität, Lage, Grenzen und Zeichenreihenfolge. Der räumliche Index wird beim Neuaufbau einmal als ganzer SQL-Auftrag gefüllt; spätere Änderungen aktualisieren nur betroffene Einträge. Die Quellabfrage läuft einmal in Rowid-Reihenfolge ohne erneute Sortierung des Restbestands. Genaue Zeichenkopien werden aus den kanonischen Quellen gelesen, wenn der Ausschnitt oder die Auswahl sie benötigt. Ein gemeinsamer vorhandener LRU begrenzt diese Kopien auf 4 MiB Textspeicher. Slices und Stile verändern ausschließlich die jeweilige Ansicht, nicht den Cacheinhalt. Geometrieänderungen leeren den Detailcache; Terrainänderungen ohne Objektänderung tun das nicht.

Die anfängliche Prüfung von Prüfsummen, Konturen und Verankerungen bleibt erhalten. **Die erste Grenzermittlung liest damit weiterhin den gesamten Objektbestand.** Diese Änderung vermeidet vollständige gespeicherte Zeichenkopien und wiederholte Sortierung, erfüllt aber allein noch kein konstantes Öffnungsbudget für beliebig große Bestände. Es gibt keinen neuen kanonischen Writer, keine Formatänderung und keine zweite Karte.

## Gleichheit und Aufwand des Lesers

[Direkter Vergleich](projection-parity.json): Der alte `AtlasRegionReader` aus `e4d361c0f` und der neue Leser laufen nacheinander gegen dieselbe synthetische Datenbank, jeweils mit einem gepinnten SQLite-Snapshot wie im Worker. Gemeinsame Abhängigkeiten sind identisch aus der aktuellen Arbeitskopie; dies ist ein Vergleich dieses Moduls, kein Vergleich zweier vollständiger Releases.

| Beobachtung | Vorher | Nachher |
| --- | ---: | ---: |
| Erstmaliger Projektionsaufbau | 16,409 s | 5,504 s |
| Belegte temporäre SQLite-Seiten, einschließlich Landschaftsindex | 78.839.808 Byte | 28.901.376 Byte |
| Detailcache nach vier Ausschnitten | alle Projektionen in SQLite | 126.850 Byte |

Welt, Region, Gebäude und Dungeon liefern **byteidentische JSON-Ergebnisse**, einschließlich Rasterbildern, Konturen, Beschriftungen, Auswahlmetadaten und Abdeckungsangaben. Der Gebäudeausschnitt enthält neun Räume und 36 Zeichnungselemente, der Dungeonausschnitt 98 Räume. Die Weltübersicht umfasst 5.051 sichtbare Gruppenmarker. Der neue Cache hat ein 4-MiB-Limit; temporäre Datenbankseiten und Prozess-RSS sind davon verschiedene Größen.

Reproduktion nach `node build.mjs --test`:

```
ATLAS_REGION_BASELINE=e4d361c0f \
ATLAS_MIXED_SOURCE=<behaltene-synthetische-workbench.sqlite> \
QA_EVIDENCE_DIR=.build/region-opening-parity \
node tools/measure-atlas-region-opening.mjs
```

Die Quelle ist eine unveränderte synthetische Prüfwelt, keine aktive Nutzerdatenbank. Der Leser öffnet sie ausschließlich readonly. Das Werkzeug behält auch abweichende Ergebnisse zur Prüfung und behauptet bei ungleichen Hashes keine Gleichheit.

## Native Prüfung und verbleibende Lücken

[Vorher](before.json), [erster Nachlauf](first-after.json). Normaler App-Einstieg, dieselbe volle gemischte Welt und derselbe 2.500-Meilen-Pinsel. Keine parallelen eigenen Builds oder Tests während der nativen Messung. Erste Terrainbereitschaft: 22,619 → 12,015 Sekunden. Pinselbeginn bis Werkzeugfreigabe: 13,453 → 13,515 Sekunden; dieser verbleibende Engpass wurde durch den Objektindex nicht verbessert. Zoom senden bis Zustandsantwort: 0,360 → 0,417 Sekunden, einschließlich einer absichtlichen 250-ms-Wartezeit. Diese Größe ist keine Messung erster Bildreaktion oder Framerate. PID 3231163 endete normal mit Code 0 und war anschließend abwesend; keine Rendererfehler.

Die native Evidenzhilfe bindet künftig zusätzlich die erzeugten Hauptprozess- und Renderer-Workerdateien per SHA-256 an den Lauf. Zuvor enthielt sie nur Main, Preload und die zentralen UI-Dateien, obwohl der geänderte Regionleser in einem separaten Worker liegt.

Das Ziel von zwei Sekunden bis zur nutzbaren Übersicht bleibt verfehlt. Nächster Schritt ist, die einmalige Gesamterfassung der Grenzen und die erste grobe Terrainaufbereitung aus dem sichtbaren Öffnungspfad zu nehmen, mit eindeutig gültigem Quellenstand und weiterhin exakter Auswahl. 30-Minuten-Speicherplateau, Pentium Gold 7505, vollständige Frameratequalifikation und Fantasykartografie sind hier nicht abgenommen.

## Gegenproben

79 betroffene Fälle bestanden: Atlasregionen einschließlich 4.000/5.000 Objekten, exakte Treffer, Scan-Fallback, graphischer Entwurf, versteckte und beschädigte Räume, verankerte Einrichtung, Änderungen/Rollback/Undo, Geländebindung, Territorien, voller gemischter Bestandsaufbau und Landschaftsränder. Die zusätzliche Gegenprobe prüft einen leeren Detailcache nach dem Weltindex, World-Marker ohne Raumkopien, nur benötigte Raumkopien, unveränderte Cachegeometrie nach Slicewechsel sowie die tatsächlich ausgeführten SQL-Ladepläne. Sechs bestehende Fälle der nativen Abschluss-/Übergangshilfe bestanden ebenfalls. Beide Typprüfungen und Desktop-Build bestanden. Diese Änderung ist lokal; Candidate-CI, Main-Integration und Release erfolgen im festgelegten Fünfstundenrhythmus.

Der [zweite native Nachlauf mit vollständiger Workerbindung](after.json) bestätigt 12,023 Sekunden bis Terrainbereitschaft, 12,931 Sekunden bis zum Pinselabschluss und 0,346 Sekunden bis zur Zoom-Zustandsantwort. [Atlas nach Abschluss](after.png). Alle zentralen Workerdateien blieben zwischen Start und Ende byteidentisch; die SHA-256-Werte stehen im Ergebnis. Normaler Prozessabschluss und Abwesenheit wurden geprüft, keine Rendererfehler. Die zwei Nachläufe sind Wiederholungen dieser einen synthetischen Aufgabe, keine p95-/p99-Qualifikation und keine gestalterische Abnahme.
