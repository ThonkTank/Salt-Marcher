# Räumlichen Objektindex nach einem Neustart wiederverwenden

Der normale Atlas kann seinen kompakten Objektindex nach einem Prozessneustart
wiederverwenden. Der Cache enthält Identitäten, lokale Grenzen, Zeichenreihenfolge,
fehlerhafte Objekt-IDs und Geschossausdehnungen. Geometrie, Einrichtung und Texte
bleiben in SQLite; angeforderte genaue Formen werden weiterhin dort gelesen.

## Quellenbindung und Lebensdauer

Ein optionaler `atlas-shape-source`-Vermerk im vorhandenen `world_record`-Format
bindet den Cache an den Objektbestand. Persistente SQL-Trigger erhöhen seinen
Zähler mit jeder Änderung der relevanten Quellen, auch über andere Verbindungen.
Rollback nimmt die Erhöhung zurück; Undo und Redo erzeugen neue Quellenstände.
Beim Öffnen wird die Epoche für die nächste Änderung erneuert. Unveränderte
Bestände behalten ihren gültigen Cache; nach einer wiederhergestellten Sicherung
kann eine neue Bearbeitung keinen alten, abweichenden Bearbeitungszweig treffen.
Fehlende oder ersetzte Trigger deaktivieren die Wiederverwendung und erneuern bei
der nächsten Store-Öffnung die Quellenbindung.

Der Worker prüft den Quellenstand im gepinnten SQLite-Snapshot. Dateiidentität,
Kampagne, Formatversion und Quellenstand müssen zum Cache passen. Ein SHA-256-Abschluss
schützt den begrenzten Zeilenstrom vor unvollständigen oder veränderten Dateien.
Fehler rollen die temporär geladenen Zeilen zurück; anschließend wird aus den
Originaldaten aufgebaut. Graphische Entwürfe verwenden diesen dauerhaften Cache
nicht. Schreibfehler im Lesecache verhindern keine Kartenöffnung.

Es gibt höchstens eine fertige Cachedatei pro Datenbankpfad und Kampagne, begrenzt
auf 96 MiB. Eine neue Datei ersetzt die vorige atomar; abgebrochene Kandidaten
werden beim nächsten App-Start vor dem Start der Leser entfernt. Endgültiges
Kampagnenlöschen stoppt Leser und entfernt auch zugehörige Cachedateien. Der Cache
gehört weder zum Archiv noch zur History und dient keiner Regelentscheidung.

**Keine vollständigen Cachekopien während interaktiver Objektänderungen:** Der
laufende temporäre Index wird weiterhin inkrementell gepflegt. Sein gespeicherter
Vorgänger wird durch den geänderten Quellenstand unbrauchbar. Der nächste kalte
Neuaufbau ersetzt ihn einmal. Terrainänderungen ohne Objektänderungen erhalten
den gültigen Objektcache.

## Vollständige synthetische Prüfwelt

[Messung und Gleichheit](projection-parity.json): 15.701 Räume und 48.670
Zeichnungselemente, 100.000 bearbeitete Quellhexe, 5.000 möblierte Raumgruppen,
5.000 Orte, 50 Detailbereiche und ein Dungeon mit mehr als 4.000 Räumen.
Die Quelldatenbank wird ausschließlich readonly geöffnet und für die Messung kopiert.
Kein paralleler eigener Build oder Test während dieser Messung.

| Indexsynchronisation einschließlich Landschaftsindex | Zeit | Neu projizierte Objektquellen |
| --- | ---: | ---: |
| Ohne dauerhaften Cache | 5,470 s | 64.371 |
| Erster Aufbau einschließlich Cache schreiben | 6,096 s | 64.371 |
| Neue Verbindung mit vorhandenem Cache | 3,858 s | 0 |

Welt-, Regions-, Gebäude- und Dungeonausschnitt liefern byteidentische Ergebnisse
mit vollständiger Abdeckung, einschließlich Raster und Metadaten. Die Cachedatei
belegt 9.897.192 Byte. Das ist eine einzelne kontrollierte Modulmessung, keine
p95-/p99- oder Gerätequalifikation. Der erste Aufbau kostet hier zusätzlich
0,626 Sekunden; Wiederöffnen spart gegenüber dem Leser ohne dauerhaften Cache
1,612 Sekunden. Der Landschaftsindex und die eigentliche Darstellung bleiben
im gemessenen Pfad. Das Zwei-Sekunden-Ziel ist weiterhin offen.

Reproduktion:

```
ATLAS_MIXED_SOURCE=<synthetische-workbench.sqlite> \
QA_EVIDENCE_DIR=.build/region-cache-measurement \
node tools/measure-atlas-region-cache.mjs
```

## Gegenproben und Liefergrenze

94 betroffene Tests bestanden: zehn neue Cache-/Quellenprüfungen und 84 bestehende
Region-, Terrainobjekt-, Gebiets- und Terrainhistory-Prüfungen. Die neuen Fälle
prüfen frisches Öffnen ohne erneute Gesamtprojektion, externe Writes,
Insert-or-Replace/Delete, Rollback, Undo, versteckte und beschädigte Räume,
Triggermängel, Cachekorruption, Schreibausfall, graphische Entwürfe, Archivkopien,
Rückspielen einer vollständigen Sicherung, Löschen und unterbrochene Kandidaten.
Sie belegen außerdem, dass eine interaktive Objektänderung den Gesamtcache nicht
neu schreibt. Beide Typprüfungen, Desktop-Build und Repositoryprüfung bestanden.

Die Änderung ist lokal. Main-Integration, exact-SHA Candidate-CI und Release sind
separate Schritte im vereinbarten Fünfstundenrhythmus. Pentium Gold 7505,
30-Minuten-Speicherplateau, erste Pixelreaktion und gestalterische Fantasykarten-
Abnahme sind durch diese Messung nicht belegt.

## Normaler App-Einstieg mit zwei Prozessen

[Native Öffnung und frisches Wiederöffnen](native-reopen.json),
[Ansicht nach Wiederöffnen](reopened.png): dieselbe volle Prüfwelt und dieselbe
Weltkamera über die Kampagnenkarte der normalen Anwendung geöffnet. Erster Start
mit Cacheaufbau: **12,782 s** bis zur Terrainübersicht. Frischer zweiter Prozess:
**10,584 s**. Dateiname, Größe und Änderungszeit des Cache bleiben unverändert;
er wurde geladen und nicht neu geschrieben. Beide Ansichten melden dieselbe
Kamera und Übersichtsqualität. PIDs 3250183 und 3250445 endeten regulär mit Code 0
und waren anschließend abwesend. Keine Rendererfehler; die gebundenen App- und
Workerdateien blieben über den gesamten Lauf unverändert. Währenddessen liefen
keine weiteren eigenen Builds, Tests oder Messungen.

Der Gewinn von 2,198 Sekunden ist keine unmittelbare Kartenöffnung. Die erste
Terrainaufbereitung und Übergabe bleiben zu langsam. Das Bild zeigt weiterhin
eine verwaschene synthetische Testwelt; eine gestalterische Abnahme folgt daraus
nicht. Der nächste Schritt betrifft eine frühe, brauchbare Terrainübersicht und
ihre Verfeinerung im bestehenden Atlas.

```
python3 tools/ui-session.py timeout --signal=TERM 180s env \
ATLAS_MIXED_SOURCE=<synthetische-workbench.sqlite> \
QA_EVIDENCE_DIR=.build/atlas-cache-reopen \
node tools/test-desktop-atlas-cache-reopen.mjs
```

[Zusätzliche native Gegenprobe mit 2.500-Meilen-Pinsel](native-brush.json):
Erste Terrainübersicht 12,505 s, Pinselbeginn bis Werkzeugfreigabe 12,713 s.
Zoom senden bis Zustandsantwort 0,321 s, einschließlich der absichtlichen
250-ms-Wartezeit des Messwerkzeugs; keine Messung erster Bildreaktion oder FPS.
PID 3251273 schloss normal mit Code 0 und war anschließend abwesend, keine
Rendererfehler. Der große Pinsel bleibt ein offener Latenzbefund. Während dieser
Probe liefen keine parallelen eigenen Builds, Tests oder anderen Messungen.
