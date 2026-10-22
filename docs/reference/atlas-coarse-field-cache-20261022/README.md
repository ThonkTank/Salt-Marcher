# Lokale Wiederverwendung der Live-Abtastfelder

## Ursache und Änderung

Ein grobes Live-Farbbild liest einen 16 Pixel breiten Rand für Schattierung und
Küsten mit. Ein großer Weltpinsel kann deshalb alle vier bisherigen 32-Pixel-
Farbteile gleichzeitig invalidieren. Die Zahl der Ausgabepixel allein beschreibt
nicht die wiederholte Höhenarbeit.

Für Live-Bilder bis 64 Pixel hält der vorhandene Projektionscache jetzt auch
die numerischen Höhen- und Wasserentscheidungen dieses Rasters fest. Er nutzt
dieselben Vier-Knoten-Blöcke, lokale Invalidierung, begrenzten Leseschritte und
atomare Veröffentlichung wie die Höhengitter. Wasser wird exakt aufbewahrt;
ein Vergleich bereits gerundeter Float32-Höhen würde nahe der Wasserlinie eine
andere Entscheidung liefern. Früher zurückgegebene Felder bleiben unverändert.

Diese kleinen Farbfelder haben im bestehenden LRU Vorrang vor gewöhnlichen
Quellblöcken und Bildern. Sie dürfen höchstens ein Viertel seines Budgets
belegen: 4 MiB innerhalb derselben 16 MiB, nicht zusätzlich. Eine zweite
LRU-Reihenfolge verhindert, dass das Durchlesen einer großen Welt die gerade
fertigen Felder sofort verdrängt. Ihre eigene Obergrenze verhindert umgekehrt,
dass viele Kameraausschnitte sämtliche Quellblöcke verdrängen. Normale
128-Pixel-Übersichten und feine Kacheln behalten den bisherigen Rasterpfad.
Beim Wechsel zu normalen Kamera- oder Farbanfragen gibt `AtlasRegionReader`
diese bevorzugten Felder wieder frei. Feine Live-Antworten behalten sie dagegen
für den nächsten bestätigten Pinselstand.
Es ändern sich weder Autorenwerte noch SQLite-Schema oder Speicherautorität.

## Nicht übernommene Varianten

Die erste Variante ohne Cachepriorität reduzierte die gelesenen Samples nicht:
die Felder wurden sofort verdrängt. Danach geschützte allgemeine Gitter/Bilder
und Felder bis 128 Pixel beschleunigten zwar wiederholte 64-Pixel-Bilder,
verschlechterten aber den Aufbau der 128-Pixel-Übersicht auf etwa 1,5–1,8 statt
1,0–1,1 Sekunden. Diese Varianten sind verworfen. Die endgültige Priorität gilt
nur für die kleinen numerischen Live-Farbfelder; andere Einträge behalten ihre
gewöhnliche Verdrängung.

## Nachweise

### Rechenkern: wechselnder Vorher-/Nachhervergleich

[ABBA-Messung](parity.json), vorher `9f3ec8ab5`. Beide Varianten lesen dieselbe
synthetische Welt und invalidieren mehrfach eine Fläche mit 2.500 Meilen Radius.
Die Datenbank wird dabei nicht geändert; echte Schreib- und Undo-Fälle stehen
in den Regressionstests. Pro Runde neue Reader und dieselben SQLite-Cachegrenzen.
Alle vollständigen Projektionen, einschließlich Höhen und Farbbytes, stimmen
per SHA-256 überein.

| 64-Pixel-Bild | Vorher, beide Läufe | Nachher, beide Läufe | Abgetastete Werte nachher |
| --- | --- | --- | ---: |
| Erstes kaltes Bild | 783 / 624 ms | 741 / 629 ms | 104.981 |
| Erste Invalidierung | 518 / 516 ms | 440 / 415 ms | 68.373 |
| Zweite Invalidierung | 519 / 423 ms | 204 / 192 ms | 16.746 |
| Dritte Invalidierung | 467 / 467 ms | 216 / 195 ms | 1.312 |

Vorher werden bei jeder Invalidierung erneut 104.981 Werte abgetastet.
Die normale 128-Pixel-Übersicht braucht kalt weiterhin etwa 1,04–1,09 Sekunden.
Ihr Weg bleibt unverändert; für die erste kalte Ansicht wird kein Gewinn
behauptet. Der gemeinsame Cache bleibt in allen Läufen unter 16 MiB.
Die 4-MiB-Obergrenze ist keine zusätzliche Speicherzusage; temporäre Felder,
aktive Antworten, SQL- und GPU-Speicher sind in diesem Zähler nicht enthalten.
Eine RAM-Plateauprüfung ersetzt das nicht.

[Untersuchungen der verworfenen Varianten](experiments.json) halten die
Zwischenergebnisse getrennt. Der Versuch ohne abschließende Cacheübergabe
beschleunigte zwar den Abschluss, verschob aber Aufwand in das Nachladen:
[5,5 Sekunden bis zum Folgezug](without-handoff-native.json). Erst die explizite
Freigabe bei normaler Navigation gehört zum finalen Stand.

### Native Bedienung

Die normale Atlasprobe verwendet dieselbe befüllte Welt wie
[der vorherige Quellenübergabe-Test](../atlas-live-source-handoff-20261022/README.md):
100.000 Geländezuordnungen, 5.000 Orte, 5.000 eingerichtete Gebäudegruppen,
50 Detailbereiche und einen Dungeon mit über 4.000 Räumen. Das ist keine Welt
mit 100.000 fein bearbeiteten Höhenkacheln und keine Fantasy-Stilabnahme.

Werkzeug: `tools/measure-desktop-backup-impact.mjs`, unveränderter Standardzoom,
`BACKUP_WAIT_DETAIL=1` und `BACKUP_REPEAT_STROKE=1`. Radius 4.023.360 m;
drei Sekunden halten, 60 px ziehen, eine weitere Sekunde halten, loslassen,
zoomen, tatsächliche Autorenbereitschaft abwarten und einen kurzen Folgezug
setzen. Alle Messungen sind einzelne Profilingläufe auf diesem Entwicklungsrechner.

| Nach dem Loslassen | Vorher (`9f3ec8ab5`) | Nachher |
| --- | ---: | ---: |
| Bedienelemente frei | 3.647 ms | 2.854 ms |
| Erster Folgezug nach Zoom möglich | 5.251 ms | 4.316 ms |
| Zweiter Zug: erneut bereit | 3.407 ms | 2.914 ms |
| Zweiter Zug: alle 36 Detailkacheln fertig | 16.551 ms | 15.199 ms |

[Finale Rohprobe](native.json), [Intervalle und kanonische Speicherprüfung](measurements.json).
Die Bereitschaft verlangt fertigen Atlascanvas und übereinstimmende bestätigte
Höhenrevision. Der Folgezug erhöht den Stand von 12 auf 14; SQLite enthält nach
normalem Programmende ebenfalls Revision 14. Der vorherige Lauf endete bei 12:
Die gleiche zeitbasierte Geste kann unterschiedlich viele bestätigte Teilstände
erzeugen. Das ist keine bytegleiche Autorenoperation; der numerische Vergleich
oben und die festen Sculpt/Undo/Redo-Tests prüfen die Gleichheit separat.
Alle 36 Detailkacheln der letzten Revision werden fertig. Prozess 3376956 endete
normal mit Code 0 und war anschließend tatsächlich verschwunden; Fehlerliste leer.
Die elf Laufzeitartefakte stimmen mit dem abschließend vorhandenen Desktop-Build
überein. Der verworfene native Vorlauf war ebenfalls vollständig beendet.

Das [Abschlussbild](after.png) zeigt den normalen Atlas mit der absichtlich
regelmäßigen Lastfixture. Es ist weder eine ästhetische Abnahme noch die
vollständige Autorenreise vom Kontinent bis zum Gebäude.

### Regressionen und Grenzen

58 unterschiedliche gezielte Fälle: zunächst 56 im gesamten betroffenen
Neun-Dateien-Satz, anschließend 24 im von der Cacheübergabe betroffenen
Vier-Dateien-Satz einschließlich zwei neuer Fälle. Wiederholungen werden nicht
addiert. [tests.json](tests.json) nennt die Quelldateien und finalen Prüfsummen.
App-/Desktop-Typprüfung, Desktop-Build und Repositoryprüfung bestanden.

Die Tests prüfen exakte Wasserentscheidungen trotz Float32-Rundung,
fraktionale Rasterränder, lokale Seen und Löschung, Sculpt/Undo/Redo gegen eine
unabhängige kalte Projektion, unveränderliche Antwortpuffer, atomare Freigabe bei
Abbruch/Quellenwechsel, Cachekontingente und 100 verschiedene behaltene Felder.
Die vorhandenen Serviceprüfungen testen auch Unterbrechung durch Auswahl,
aktuellere Kameraaufträge und veraltete Quellen.

Native p95/p99-Reaktion, physischer Pentium-Laptop, erster Überblick in zwei
Sekunden, große voll bearbeitete Welten und 30-Minuten-RAM-Plateau bleiben offen.
Der Pinselabschluss braucht weiterhin Sekunden; diese Änderung allein erfüllt
das Produktziel nicht.
Der Rechenkernvergleich ersetzt keine native Bedienmessung oder Zielgeräteabnahme.
