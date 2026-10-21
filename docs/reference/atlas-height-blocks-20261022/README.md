# Dekodierte Höhenblöcke im gemeinsamen Projektionscache

Die erste Weltprojektion las dieselben Höhenkacheln mehrfach für Geometrie und
Farbraster. Jedes gelesene JSON erzeugte außerdem ein neues Kachelobjekt und
verlor dadurch die Wiederverwendung des bestehenden schwachen Decoder-Caches.
Die Diagnose zählte 4.950 Lesungen von 1.028 verschiedenen Höhenkacheln.

Die Änderung übernimmt das etablierte Muster eines begrenzten Rasterblockcaches,
wie es [GDAL für wiederholte Blockzugriffe beschreibt](https://gdal.org/en/stable/user/configoptions.html#performance-and-caching).
Verwendet werden der vorhandene `TerrainCache` und dessen LRU-Verdrängung. Es
wurde kein fremder Quellcode kopiert und keine neue Laufzeitabhängigkeit ergänzt.
Eine Simulation der tatsächlichen Lesereihenfolge zeigte zuvor: Vollständige
JSON-Datensätze würden unter der bestehenden Speichergrenze fast ständig
verdrängt; kompakte dekodierte Zahlenblöcke können deutlich häufiger bleiben.

Der readonly Höhenleser fragt zuerst die geordneten, räumlich gefilterten
Quellenschlüssel ab. Nur fehlende Blöcke lesen und dekodieren den kanonischen
Datensatz. Dekodiert wird weiterhin erst, wenn ein tatsächlich benötigter
Höhenknoten die Quelle berührt. Im Cache liegen Koordinaten, Höhenversion und
4.096 Float32-Werte; keine Autorenobjekte oder Base64-Zeichenketten. Die numerische
Interpolation bleibt dieselbe für den dekodierten und den bisherigen
Datensatzstrom. Quellenreset und dieselben räumlichen Änderungsbereiche
invalidieren die Blöcke; nach Verdrängung werden sie erneut gelesen.

## Kontrollierter Vergleich

[Messdaten](projection-parity.json) aus
[measure-terrain-height-blocks.mjs](../../../tools/measure-terrain-height-blocks.mjs):
Leser aus `14dea0132` gegen den geänderten Leser, gemeinsame übrige Module,
identische Eingabe und jeweils eigener gepinnter SQLite-Snapshot. Reihenfolge
Vorher–Nachher–Nachher–Vorher; keine parallelen eigenen Builds oder Tests.
Die Zähler erfassen gelesene Nutzdaten, keine physischen Plattenzugriffe.

| Erste vollständige Übersichtsprojektion | Vorher | Nachher |
| --- | ---: | ---: |
| Höhen-Nutzdatenlesungen | 4.950 | 1.904 |
| Gelesene Höhen-Nutzdaten | 109.861.228 B | 42.257.750 B |
| Laufzeit, erster Lauf | 2.221 ms | 1.481 ms |
| Laufzeit, zweiter Lauf | 1.962 ms | 1.130 ms |
| Belegter gemeinsamer Projektionscache | 899.139 B | 16.766.276 B |
| Unveränderte Cache-Obergrenze | 16.777.216 B | 16.777.216 B |

Farbpixel, Höhenraster und vollständige Projektionsantworten sind in allen vier
Läufen byteidentisch. Die tatsächliche Cachebelegung wächst innerhalb ihrer
bisherigen Grenze; das ist der Speicher-/Laufzeit-Tausch dieser Änderung.
Die Blöcke konkurrieren mit bereits vorhandenen Feldern und Farbkacheln um
dieselbe Quote. Arbeitsraster, GPU-Speicher und übriger Prozessspeicher sind in
dieser Cachezahl nicht enthalten. Zwei Vergleichspaare sind keine p95-/p99-Aussage.

## Normale App mit gemischter Welt

Verwendet wurde die vorhandene synthetische Welt mit 100.000 bearbeiteten
Geländezuordnungen, 1.028 Höhenkacheln, 5.000 Orten, 5.000 eingerichteten
Gebäudegruppen, 50 Detailbereichen und großem Dungeon.

[Öffnung ohne Detailwarteprüfung](opening.json): Gelände nach 5,104 s kalt und
5,081 s im frischen Prozess mit Objektcache. Der vollständige Objektausschnitt
war nach 10,708 beziehungsweise 8,464 s bereit. Vor dieser Änderung lagen die
entsprechenden ersten Geländebilder bei 5,940 beziehungsweise 5,786 s; das sind
getrennte lokale Läufe, kein isolierter Hardwarebenchmark.

[Zusätzliche vollständige Verfeinerung](refinement.json): erste Geländeübersicht
nach 4,932 beziehungsweise 4,808 s; **alle 48 Detailkacheln und der vollständige
Detailzustand erst nach 28,128 beziehungsweise 26,552 s**. Der Prüfweg kann mit
`ATLAS_WAIT_DETAIL=1` beide Bereitschaftsstufen und das vollständige Nachladen
getrennt erfassen. Der persistente Objektcache blieb beim Neustart unverändert.
Die [verfeinerte Aufnahme](refined.png) zeigt weiterhin synthetische Prüfdaten;
sie ist keine gestalterische Abnahme.

[Großer Pinsel und Navigation während des Abschlusses](brush.json): tatsächlicher
Sculpt-Radius 2.500 Meilen; nach Loslassen wurden die Werkzeuge nach 5,761 s
wieder freigegeben. Die Kamera änderte sich während des noch ausstehenden
Abschlusses. Die gemessenen 329 ms von Mausradversand bis Zustandsabfrage enthalten
eine feste 250-ms-Wartezeit und sind **keine Messung der ersten geänderten Pixel**.
Dieser Ablauf erfasst noch nicht die vollständige anschließende Verfeinerung.
Er enthält Main-/Renderer-Profiling und belegt keine isolierte Beschleunigung
des Pinselabschlusses durch diese einzelne Änderung.

Alle nativen Läufe endeten regulär mit Code 0, danach fehlten ihre PIDs; keine
Rendererfehler. Keine parallelen eigenen Builds/Tests während der Messungen.

## Regressionen und offene Arbeit

[37 unterschiedliche betroffene Fälle](tests.json) bestanden. Die neuen
[Blockcache-Prüfungen](../../../tests/terrain-height-blocks.test.mjs) verwenden
echte gespeicherte Höhen, andere Abtastgitter, Sculpt, Undo/Redo, gelöschte
Quellen, externe Änderungen bei gleicher Zeilenidentität und eine absichtlich
kleine Speicherquote. Mutierte Ausgabe-Arrays dürfen Quellensamples nicht ändern.
Dazu kommen [kanonische Feldarithmetik](../../../tests/terrain-field-stream.test.mjs),
[Projektionscache und Küstennähte](../../../tests/terrain-projection-cache.test.mjs),
[gestufte Ausgabe](../../../tests/terrain-progressive-projection.test.mjs),
[Quellenindizes](../../../tests/terrain-kind-index.test.mjs),
[Decoderfälle](../../../tests/terrain-height-codec.test.mjs) sowie echte
[Farbworker](../../../tests/terrain-color-service.test.mjs) und
[Projektionsworker](../../../tests/terrain-projection-service.test.mjs).

Renderer-/Desktop-Typprüfung, Desktop-Build und Repositoryprüfung bestanden
lokal. Candidate-CI, Mainintegration, Release und physischer Pentium-/Intel-UHD-Test
bleiben getrennte Liefer- und Abnahmestufen.

**Offen:** Das erste Weltbild liegt weiter über zwei Sekunden. Vollständige
Verfeinerung und großer Pinselabschluss sind weiterhin langsam. Nächste
Untersuchungen betreffen die initialen Landschaftsmetadaten und die wiederholte
Geländeberechnung der Detailfarben; die vorhandenen Auflösungsstufen und
GPU-Verfahren etablierter Kartenrenderer dienen dabei als Referenz. FPS-Ziele,
30-Minuten-Speicherplateau und ansprechende Fantasykartographie über alle
Maßstäbe sind durch diese Teilprüfung nicht nachgewiesen.
