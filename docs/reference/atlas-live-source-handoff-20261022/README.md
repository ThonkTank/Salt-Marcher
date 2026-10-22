# Bestätigte Pinseloberfläche beim Quellenwechsel behalten

## Problem und Änderung

Nach einem Terrain-Pinselzug lag bereits ein vollständiges, von Main bestätigtes
Höhengitter vor. Der anschließende Regionswechsel verwarf es dennoch und lud
vor der nächsten Bearbeitung eine neue Übersicht. Die vorherige native Probe
brauchte dadurch nach Freigabe der Bedienelemente weitere rund 1,6 Sekunden,
bis ein Folgezug tatsächlich angenommen wurde.

`TerrainSpatialUI` trennt jetzt die Revision von den übrigen Eingaben seiner
Quellenkennung. Ein bestätigtes Live-Gitter wird nur übernommen, wenn:

- Revision und Quellenkennung mit der frisch bestätigten Atlasregion übereinstimmen;
- Kampagne, beibehaltener Ausschnitt, Pixeldichte, Glättungsrand, Überhöhung,
  Objektquellen und Landschaftsobjektstände unverändert sind;
- Abtastbereich, lokale Verfeinerung und Gittermaße dem normalen Ladeplan entsprechen;
- die bestehende Quelle bereit ist und weder Entwurf noch Quellenklärung vorliegt.

Die Übernahme behält die sichtbaren Höhen und Farben ohne erneuten Mesh-Upload.
Sie aktualisiert die Sichtprüfungsparameter und verwirft alte Autorenrecord-Caches.
Feine Farben werden anschließend über den vorhandenen Hintergrundpfad geladen.
Andere Revisionen, fremde Quellen, veränderte Geometrie und größere Kamerasprünge
benutzen weiterhin den regulären Übersichtsaufbau. Es gibt keinen neuen Speicher,
keinen zweiten Renderer und keine neue Schreibautorität.

## Prüfungen

Gezielte Tests prüfen die tatsächliche Übergabe, den nächsten Ladeauftrag ohne
zweite Übersicht, spätere Farbverfeinerung, veraltete Antworten während eines
zweiten Pinselzugs und Gegenfälle für Quellen-, Gitter- und Kontextänderungen.
84 gezielte Tests bestanden (einschließlich 14 negativer Übergabefälle):

- `tests/terrain-spatial-source.test.mjs`
- `tests/terrain-projection-ui.test.mjs`
- `tests/terrain-presentation.test.mjs`
- `tests/terrain-frame-delta.test.mjs`
- `tests/terrain-commit-display.test.mjs`
- `tests/terrain-live-stroke.test.mjs`
- `tests/terrain-projection-service.test.mjs`

App- und Desktop-Typprüfung sowie Desktop-Build bestanden. Das Prüfmanifest
steht in [tests.json](tests.json). Die gemeinsame R7-Fähigkeit verweist auf die
tatsächlichen Quelldateien; daraus folgt keine vollständige R7-Abnahme.

## Native Gegenprobe auf der befüllten Welt

Die vorhandene synthetische Welt enthält 100.000 Geländezuordnungen, 5.000 Orte,
5.000 eingerichtete Gebäudegruppen, 50 Detailbereiche und einen Dungeon mit
über 4.000 Räumen. Diese 100.000 Zuordnungen sind keine 100.000 fein bearbeiteten
Höhenkacheln. Jeder Lauf öffnet eine eigene Datenbankkopie im normalen Atlas.
Pinselradius: 2.500 Meilen (4.023.360 m). Der erste Zug hält drei Sekunden, zieht
60 px und hält eine weitere Sekunde; danach folgt ein tatsächlich ausgeführter
kurzer Folgezug. Die Freigabe verlangt bestätigte Höhenrevision und fertigen
Atlascanvas, nicht nur aktivierte Bedienelemente.

| Fester Ausschnitt | Vorher | Nachher |
| --- | ---: | ---: |
| Loslassen → Bedienelemente frei | 3.839 ms | 3.775 ms |
| Loslassen → Folgezug möglich | 5.593 ms | 4.040 ms |
| Zweiter Zug: Loslassen → erneut bereit | 5.017 ms | 2.840 ms |
| Zweiter Zug: Loslassen → alle Detailkacheln | 19.613 ms | 17.013 ms |

[Vorher](native-before-fixed.json), [nachher](native-after-fixed.json) und
[ausgerechnete Intervalle mit Speicherprüfung](measurements.json).
Die Bedienelemente melden nachher bereits `terrainReady=ready`, zuvor noch
`loading`. Beide Folgezüge erhöhen den bestätigten Stand von 10 auf 12; nach
normalem Prozessende enthält SQLite ebenfalls Revision 12. Anschließend sind
alle 48 Detailkacheln der letzten Revision fertig. Die Höhenübernahme ersetzt
keine gespeicherten Operationen und lässt keine feinen Farben dauerhaft aus.

Die [zusätzliche Zoomprobe](native-zoom.json) benötigt nach dem ersten Zug
weiterhin 5.251 ms: Der Zoom auf 78,7 % der bisherigen Breite verlässt das
80-%-Fenster des beibehaltenen Gitters und muss neu laden. Beim anschließenden
Zug im unveränderten Ausschnitt sind es 3.407 ms; alle 36 Detailkacheln werden
fertig. Die Optimierung darf eine veränderte Abdeckung nicht einfach freigeben.

Diese einzelnen Profilingläufe sind keine p95-Messung. Die Differenzen der
Gesamtlaufzeiten enthalten Schwankungen anderer Phasen. Insbesondere bleibt
der Abschluss trotz entfallener Doppelarbeit mehrere Sekunden lang.

## Reproduktion und Artefaktidentität

Werkzeug: `tools/measure-desktop-backup-impact.mjs`; der neue optionale Schalter
`BACKUP_SKIP_WHEEL=1` unterdrückt ausschließlich den sonst unveränderten Zoom.
`BACKUP_WAIT_DETAIL=1` prüft die tatsächliche Bereitschaft und fertige Details,
`BACKUP_REPEAT_STROKE=1` führt den Folgezug aus. Alle drei nativen Prozesse
wurden durch `tools/ui-session.py` auf 240 Sekunden begrenzt und endeten normal
mit Code 0; ihre PIDs waren danach tatsächlich verschwunden, Fehlerlisten leer.

Für die Vorherprobe wurde allein `terrain-spatial-ui.ts` aus `940b254f` per
esbuild-Loader in das normale Renderer-Bundle eingebunden. Alle elf erfassten
Laufzeitartefakte entsprachen bytegenau der vorherigen
[Abschlussprobe](../atlas-brush-finish-20261022/native-repeat.json).
Danach wurde das aktuelle Renderer-Bundle wiederhergestellt. Beide Nachherläufe
und der am Ende vorhandene Build besitzen dieselben elf Prüfsummen.
Keine Arbeitskopie oder Benutzer-Datenbank wurde für den Kontrolllauf ersetzt.

Die Rohproben und CPU-Profile liegen unter `.build/terrain-adoption-native/`,
`.build/terrain-adoption-before-fixed/` und `.build/terrain-adoption-after-fixed/`.
Das [Abschlussbild](after-fixed.png) zeigt den normalen Atlas und die absichtlich
regelmäßige Lastfixture. Es ist kein Beleg für eine ansprechende Fantasykarte
oder die vollständige Autorenreise vom Kontinent bis zum Gebäude.

Diese Änderung allein erfüllt weder die Latenzziele noch die Zielgeräteabnahme.
