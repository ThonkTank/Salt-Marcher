# Vollständig abdeckender Index für Terrain-Grundflächen

Die Detailverfeinerung der großen Prüfwelt prüfte für jeden Farbausschnitt erneut
die Metadaten von 100.000 Grundflächen. Ein CPU-Profil der 48 Detailkacheln und
der Kontexttextur zeigte rund 4,6 Sekunden in diesen SQLite-Abfragen.

Die Änderung ergänzt einen partiellen, räumlich geordneten Btree-Index auf der
vorhandenen Metadatentabelle. Er enthält alle Filter-, Sortier- und Ausgabewerte.
Die bestehenden Abfragen, genaue Abtastung, Zeichenreihenfolge und Datensatzseiten
bleiben unverändert. SQLite pflegt den Index bei Änderungen und Rollbacks.
Es gibt keinen zusätzlichen Aufbauprozess, keine neue Gültigkeitsverwaltung und
keine neue Laufzeitabhängigkeit.

Der Index entsteht erst bei der Farbverfeinerung. Die erste Geländeübersicht
wartet weiterhin nicht darauf. Seine einmalige Erstellung ist synchron im
Readonly-Worker; dies ist kein garantierter Acht-Millisekunden-Schritt.
Der normale Worker behält seine dateibasierte TEMP-Ablage und acht MiB
Seitencache. Zusätzliche TEMP-Seiten sind zusätzlicher Speicherbedarf, keine
Speicherplateau-Abnahme.

## Warum diese Indexspalten?

Das etablierte Verfahren eines
[vollständig abdeckenden Index](https://www.sqlite.org/queryplanner.html#covering_indexes)
vermeidet zusätzliche Zugriffe auf die ursprüngliche Tabelle. Bei diesem
Ausdrucksindex müssen auch der Prädikatswert terrain_kind und die rohe Spalte
paint_order enthalten sein, zusätzlich zu coalesce(paint_order,0).
Ohne diese Werte waren die untersuchten Varianten deutlich langsamer.

Die Regression prüft deshalb neben EXPLAIN QUERY PLAN auch das SQL-Programm:
Die Kandidatenabfrage darf die Metadatentabelle überhaupt nicht öffnen.
Das ist ein konkreter Befund für die eingesetzte SQLite-Version; die bloße
Bezeichnung „COVERING“ im Abfrageplan reichte beim untersuchten Ausdrucksindex
nicht aus.

## Verworfener Rtree-Versuch

Der zunächst untersuchte Rtree verringerte die gesamte Rasterzeit, kostete aber
zusätzlichen Aufbau und verzögerte frühe Detailkacheln. Varianten mit direkter
SQL-Übertragung und abwechselnden Raster-/Aufbauabschnitten beseitigten den
Zielkonflikt nicht überzeugend. Der Großpinselabschluss lag in den Proben bei
7,69 / 7,86 / 8,15 / 8,53 Sekunden. Eine zeitnahe Gegenprobe mit dem vorherigen
Terrain-Leser in ansonsten denselben Anwendungsartefakten benötigte 7,15 Sekunden;
der ältere Einzelwert von 5,76 Sekunden war kein belastbarer alleiniger Vergleich.

Der Rtree-Prototyp wurde vollständig aus dem Produktcode entfernt. Sein
[Patch gegen 5f0968763](rtree-prototype.patch), die
[Rastermessung der Bulk-Variante](rtree-parity.json), die
[native Öffnungsprobe einer früheren Variante](rtree-opening.json),
[erste Pinselprobe](rtree-brush-first.json),
[Wiederholung](rtree-brush-repeat.json),
[Bulk-Variante](rtree-brush-bulk.json),
[abwechselnde Variante](rtree-brush-interleaved.json) und die
[Kontrollprobe](reader-control-brush.json) bleiben nachvollziehbar.
Die damaligen [Regressionen](rtree-tests.json) gelten dem verworfenen Prototyp,
nicht der aktuellen Implementierung. Die Pinselproben liefen mit CPU-Profiling;
sie belegen weder eine p95-Reaktion noch den Pentium-Laptop.

Der einfachere abdeckende Index wurde zunächst in
[drei Varianten verglichen](index-variants.json): 15,96 Sekunden ohne Index,
12,47 Sekunden einschließlich 0,24 Sekunden Aufbau beim räumlichen Index,
14,42 Sekunden beim nach Zeichenreihenfolge sortierten Index. Alle Ausgaben
waren identisch. Der folgende kontrollierte Vergleich und die nativen Proben
gelten der tatsächlich übernommenen Variante.

## Grenzen

Die synthetische Welt enthält 100.000 Geländezuordnungen, 1.028 Höhenkacheln,
5.000 eingerichtete Gebäude und einen großen Dungeon. Sie ist keine natürliche
Fantasykarte und kein Nachweis für 100.000 fein bearbeitete Höhenkacheln.
Unmittelbare Weltkarten-Navigation und Bearbeitung, die physische Abnahme auf
dem Pentium-Gold-Laptop und die gestalterische Qualität bleiben offen.

## Übernommene Variante: kontrollierter Vergleich

[ABBA-Messung](projection-parity.json) mit dem Reader aus 5f0968763 und dem
aktuellen Reader, sonst denselben Modulen, Daten und SQLite-Budgets.
Reproduktion: tools/measure-terrain-base-index.mjs mit TERRAIN_INDEX_SOURCE auf
die behaltene synthetische Welt. Die Messung beginnt vor der Erzeugung des
Generators und schließt dadurch den synchronen Indexaufbau ausdrücklich ein.

| Lauf | 48 Detailkacheln und Kontext einschließlich Aufbau | Erste feine Kachel |
| --- | ---: | ---: |
| Vorher 1 | 15.398 ms | 529 ms |
| Nachher 1 | 12.348 ms | 692 ms |
| Nachher 2 | 11.723 ms | 655 ms |
| Vorher 2 | 13.717 ms | 358 ms |

Übersicht, sämtliche Detailpixel und vollständige Kontextprojektion sind in
allen vier Läufen bytegleich. Der einmalige Aufbau benötigt 236–263 ms und
verteuert die erste feine Kachel. Die gesamte Verfeinerung wird schneller.
Die erste Übersicht baut den Index noch nicht auf. Die zusätzlich belegten
TEMP-Seiten betragen 8.847.360 Byte. Das ist kein Prozess-RAM-Messwert.

Die [19 Regressionen und Typ-/Buildprüfungen](tests.json) umfassen den tatsächlichen
SQL-Zugriff, exakte Reihenfolge auch mit großen 64-Bit-IDs, Abtastraster,
Quellenänderungen und Rollbacks sowie vorhandene Farb-/Bewuchsdaten und die
Worker-Unterbrechung. Einzelne bestehende Rasterabschnitte benötigen weiterhin
bis rund 305 ms. Diese vier CPU-Läufe sind keine p95- oder Hardwareabnahme.

## Großer Pinsel im normalen Atlas

[Native Probe](native-brush.json), normaler Kampagneneinstieg und ein Radius von
4.023.360 Metern beziehungsweise 2.500 Meilen. Loslassen bis wieder verfügbare
Werkzeuge: 5.553 ms; die abschließende [Kontrollprobe](full-control-brush.json)
mit sämtlichen exakt bestätigten Anwendungsartefakten des vorherigen Stands
5f0968763 lag bei 6.256 ms. Der Kamerazustand änderte sich auch während des noch laufenden
Abschlusses. Die 356 ms bis zur beobachteten Kameraänderung enthalten eine feste
250-ms-Wartezeit und sind kein erster sichtbarer Frame.

Der Prozess endete regulär mit Code 0, war danach nicht mehr vorhanden und
meldete keine UI-Fehler. Die Probe enthält CPU-Profiling und ist ein einzelner
Durchlauf. Sie belegt keine unmittelbare Bearbeitung und keine verlässliche
Perzentilverteilung. Die mehreren Sekunden nach dem Pinselzug bleiben offen.

## Kaltes Öffnen und neuer Prozess

[Native Öffnungsprobe](native-opening.json) über den normalen Kampagneneinstieg,
mit tools/test-desktop-atlas-cache-reopen.mjs und ATLAS_WAIT_DETAIL=1.
Alle nativen Proben liefen zeitlich begrenzt durch tools/ui-session.py.

| Beobachtung | Kalt | Neuer Prozess mit vorhandenem Objektcache |
| --- | ---: | ---: |
| Erstes Gelände | 4.772 ms | 5.010 ms |
| Objektbereich bereit | 10.863 ms | 8.785 ms |
| Alle 48 Detailkacheln bereit | 25.342 ms | 24.208 ms |

Der vorherige Stand benötigte 28.128/26.552 ms bis zu allen Detailkacheln,
belegt in [der Höhenblock-Messung](../atlas-height-blocks-20261022/refinement.json).
Das sind nacheinander ausgeführte Einzelproben auf dem Entwicklungshost.
Während dieser Messungen liefen keine parallelen eigenen Builds oder Tests.

Der Objektcache wurde beim Wiederöffnen nicht neu geschrieben. Beide Prozesse
endeten regulär mit Code 0 und waren danach nicht mehr vorhanden; keine UI-Fehler.
Die Artefakthashes sind in den Rohdateien enthalten. firstDetailMs ist eine
Beobachtung nach dem Warten auf den Objektbereich, daher eine obere Zeitgrenze
und kein GPU-Zeitstempel der ersten sichtbaren Detailpixel.

Die [Aufnahme](reopened.png) zeigt weiterhin die regelmäßige synthetische
Prüfwelt. Die unveränderte Darstellung ist keine gestalterische Abnahme.
Die erste Geländeöffnung von rund fünf Sekunden und der mehrsekündige
Pinselabschluss bleiben eigenständige Leistungsprobleme.
