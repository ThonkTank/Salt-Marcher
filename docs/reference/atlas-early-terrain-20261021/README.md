# Gelände öffnen, bevor der vollständige Objektindex bereitsteht

Der normale Atlas beginnt jetzt mit der Geländeübersicht. Eine kleine Anfrage
liefert dafür die aktuelle Geländerevision; anschließend lädt die bestehende
räumliche Hauptansicht ihre normale erste Projektion. Sobald diese gezeichnet
ist, beginnt die vollständige Objektabfrage. Die Kamera kann das vorhandene
Gelände währenddessen bewegen. Auswahl und Schreiben benötigen weiterhin den
bestätigten Objektausschnitt. Es gibt keine zusätzliche Kartenansicht und keine
vorgetäuschte leere, vollständige Objektantwort.

Der gemeinsame Kartenworker synchronisiert für Terrainaufträge zunächst nur
Landschaftsdaten. Ein begrenzter Akkumulator sammelt die dabei konsumierten
Objektänderungen bis zur nächsten Geometrieabfrage. Wiederholte Änderungen
werden je Tabelle/ID zusammengeführt; oberhalb von 10.000 Schlüsseln oder 1 MiB
Schlüsselbudget wird ein Neuaufbau vorgemerkt. Quellenreset, Workerwechsel und
Transaktionsrollback dürfen keinen teilweise aufgebauten Index als gültig
zurücklassen. Fehlerhafte Anfragen auf einem unveränderten Geländestand erhalten
die genaue Bereichsinvalidierung; reine Terrainfehler verwerfen keinen fertigen
Objektindex.

Fehlt die Terrainvorbereitung, scheitert sie oder benötigt die Ansicht den
Canvas-Fallback, übernimmt weiterhin die vollständige Objektabfrage. Bei einer
inzwischen geänderten Terrainquelle wartet die Vorbereitung auf diese neue
Objektantwort. Verlassen des Atlas und Kampagnenwechsel lösen wartende
Vorbereitungen auf und verwerfen verspätete Antworten.

## Native Prüfung

Dieselbe synthetische gemischte Welt wie in der
[vorherigen Linienoptimierung](../terrain-line-stream-20261021/README.md):
100.000 bearbeitete Geländezuordnungen, 5.000 Orte, 1.028 Höhenkacheln,
5.000 eingerichtete Gebäudegruppen, 50 Detailbereiche und ein großer Dungeon.
Das sind keine 100.000 fein bearbeiteten Höhenkacheln.

[Öffnen und frischer Prozess](reopen.json), lokale Entwicklungsfassung:

| Zustand | Erste Geländeübersicht | Vollständiger Objektausschnitt |
| --- | ---: | ---: |
| Ohne vorhandenen Objektcache | 5,940 s | 11,626 s |
| Neuer Prozess mit Objektcache | 5,786 s | 8,818 s |

Bei beiden ersten Geländebildern war der Objektausschnitt noch im Ladezustand.
Der persistente Objektcache blieb beim Neustart byte- und zeitstempelgleich.
Die frühere Messung wartete zunächst auch auf den Objektausschnitt und zeigte
12,197 beziehungsweise 9,831 Sekunden. Der neue Prüfweg erfasst die beiden
Bereitschaftszeitpunkte ausdrücklich getrennt. Einzelne lokale Läufe liefern
keine p95-/p99- oder Zielgerätequalifikation.

[Zurückgehaltene echte Objektantwort](navigation.json): Die normale Arbeitsfläche
zeigt Gelände trotz ausstehender Objektantwort. Mausradzoom und Verschieben mit
der mittleren Maustaste ändern sowohl Kamera/Projektion als auch das tatsächliche
Terrainbild. Ein zusätzlich versuchter Pinselzug vor Verfügbarkeit der Objekte erzeugt keinen Atlas-Commit. Nach Freigabe der Antwort bleibt
die navigierte Kamera erhalten und der Objektausschnitt wird verfügbar. Der
Prüfeingriff hält nur die Objektantwort zurück; er ersetzt keine Geländedaten.

Die Öffnen-/Neustartmessung entstand vor den letzten Absicherungen der
Fehlerpfade für veraltete Quellen und Rollback. Die abschließende native
Navigationsprobe verwendet die fertige Implementierung; die jeweiligen
Build-Hashes stehen in den JSON-Belegen.

Alle aufgeführten nativen Prozesse endeten regulär mit Code 0, waren danach
nachweislich beendet und meldeten keine Rendererfehler. Die Aufnahmen zeigen
synthetische Daten und eine noch unscharfe Geländeübersicht. Sie belegen weder
ansprechende Fantasykartographie noch vollständige Detailverfeinerung.

## Regressionen und Zuständigkeiten

- [Begrenzte ausstehende Objektänderungen](../../../tests/atlas-deferred-geometry.test.mjs).
- [Index, echte Worker, Änderungen zwischen Terrainaufträgen und Rollback](../../../tests/desktop-atlas-regions.test.mjs).
- [Normale Atlasöffnung und Fallback/Kampagnenwechsel](../../../tests/desktop-atlas-canvas.test.mjs), [Arbeitsflächenfreigabe](../../../tests/desktop-atlas-opening.test.mjs).
- [Frühe Terrainveröffentlichung, Abbruch und veraltete Quelle](../../../tests/terrain-spatial-source.test.mjs), [Darstellungsrevisionen](../../../tests/terrain-projection-ui.test.mjs).
- [Worker-Projektion und genaue Invalidierung](../../../tests/terrain-projection-service.test.mjs), [persistenter Objektcache](../../../tests/desktop-atlas-region-cache.test.mjs).
- Native Prüfprogramme: [frühe Navigation](../../../tools/test-desktop-atlas-early-terrain.mjs), [Öffnen/Neustart](../../../tools/test-desktop-atlas-cache-reopen.mjs).

[172 unterschiedliche betroffene automatisierte Fälle](tests.json) bestanden, einschließlich
der nach den Gegenproben korrigierten Fehlerpfade. TypeScript für Renderer und
Desktop, Desktop-Build und Repositoryprüfung bestanden lokal. Die
verpflichtende Candidate-CI, Mainintegration und Veröffentlichung sind getrennte
Lieferstufen.

**Weiter offen:** erste grobe Karte innerhalb von zwei Sekunden, unmittelbar
reagierende volle Welt auf Pentium Gold 7505/Intel UHD, schnelle vollständige
Detailverfeinerung und große Pinselabschlüsse, lesbare Höhenlinien und die
ästhetische Abnahme über alle Maßstäbe. Der nächste Engpass liegt in der ersten
Terrainprojektion einschließlich Landschaftsmetadaten und Höhenkachellesungen.
