# Sichtbare Pinselreaktion auf der großen Welt messen

21.10.2026, Produktcode `2073c7f95`, Version 0.180.0. Nur Prüfwerkzeuge
geändert. Host i5-8365U / UHD 620, kein Test auf dem Pentium Gold 7505.
Die [Leistungsziele](../../plans/maps/unified-spatial-atlas.md#4-verbindliche-abnahme-und-testfälle)
bleiben offen, auch für die vollständig gefüllte Welt.

## Warum die bisherige Pinselmitte nicht genügt

Der bisherige Prüfweg vergleicht 32×32 GPU-Pixel in der Mitte des Pinsels.
Bei einem großen Höhenpinsel kann diese Fläche vollständig im flachen Kern
liegen. Dort verändert eine Höhenänderung in der Draufsicht zunächst weder
Schattierung noch Farbe. Sichtbare Änderungen an der Flanke liegen außerhalb
des Messfensters. Die früher veröffentlichten Werte bleiben Messungen dieses
kleinen Ausschnitts; sie sind keine Messung der ersten Änderung im ganzen Pinsel.

Der Weltprüfweg behält die Mitte als `firstPixelMs` und ergänzt
`firstBrushPixelMs`: mindestens vier Pixel mit einer RGB-Kanaländerung von
mindestens 3 innerhalb von 90 % des Bildschirmradius. Der äußere Cursorring
zählt nicht. Das Ausgangsbild stammt vom Pointerdown vor der Autorenbehandlung.
Die Probe beendet neue Aufnahmen bei Zeigerbewegung oder Loslassen. Sie prüft
damit die anfängliche Reaktion eines stationären Pinsels in Draufsicht.

Die neuen Modi `WORLD_READBACK=async` und `sync` lesen dieselbe Fläche.
`legacy` bleibt zur Wiederholung alter Messungen verfügbar. Im asynchronen
Modus halten drei begrenzte Pixelpuffer die GPU-Schnappschüsse. CPU-Kopien
erfolgen erst nach signalisierter Fence. Einreichen, Verfügbarkeit und Kopieren
werden getrennt aufgezeichnet. Die verwendete Zeit bis zur Verfügbarkeit ist
eine **obere Grenze einschließlich Messaufwand**, kein Zeitstempel der tatsächlichen
Bildschirmausgabe. Auch asynchrones Einreichen und Kopieren können Zeit kosten.
Der [WebGL2-Vertrag](https://registry.khronos.org/webgl/specs/latest/2.0/)
beschreibt Pixelpuffer und Fence-Synchronisation.

CPU-Profiling ist in den neuen Modi standardmäßig ausgeschaltet und mit
`WORLD_PROFILE=1` separat zuschaltbar. Der Phasenstart setzt die RAF-Uhr nach
dem Einschalten des Profilers zurück; dessen Startpause gehört nicht mehr
zum ersten Navigationsintervall. Profilaufzeichnungen enthalten eine geklammerte
Zuordnung zwischen Renderer- und CDP-Uhr. Die Phasen speichern auch p99.

## Zwei Züge, identischer Produktcode

[Asynchroner Lauf](async.json) und [synchrone Gegenprobe](sync.json): jeweils
108.076 Landschaftsobjekte, Weltübersicht und 2.500-Meilen-Radius. Nach dem
ersten Zug wird die bestätigte vollständige Detailansicht abgewartet und erst
dann der zweite Zug begonnen. Beide Läufe ohne CPU-Profiling; kein eigener
Build oder zweiter nativer Lauf parallel. Das ist ein Landschaftslastfall,
noch nicht die vollständige Gebäuderaum-/Volumen-/Dauerlastqualifikation.

| Messung | Asynchron | Synchron |
| --- | ---: | ---: |
| Navigation RAF p95 / p99 | 36,0 / 61,6 ms | 28,3 / 50,0 ms |
| Erster Zug, erste Änderung im Pinsel | 247,2 ms | 202,8 ms |
| Erster Zug, erste Änderung in der Mitte | 282,9 ms | 243,3 ms |
| Zweiter Zug, erste Änderung im Pinsel | 169,8 ms | 163,1 ms |
| Zweiter Zug, erste Änderung in der Mitte | 627,5 ms | 744,7 ms |

Beim ersten geänderten Bild des zweiten Zuges hatten bereits 1.465 bzw. 1.671
Pixel im Pinsel ihre Farbe geändert, aber **kein** Pixel in dessen Mitte.
Das bestätigt die bisherige Messlücke am tatsächlichen Hauptatlas.

Das Auslesen belastet die Messung weiterhin: asynchron kostete allein die
erste Baseline-Kopie 25,9 ms, synchron das erste geänderte Bild 41,2 ms.
Die unterschiedlichen Navigationswerte sind Streuung zwischen zwei Läufen;
während Navigation wird kein Pinselbild ausgelesen. Daraus folgt kein
Geschwindigkeitsvorteil einer Messmethode. Zwei Züge ergeben zudem kein
belastbares p95 der Eingabelatenz. Die 100-ms- und Navigationsziele sind
weiterhin nicht nachgewiesen.

Beide Züge beider Läufe erreichen neue gespeicherte Revisionen und 48/48
Detailkacheln. Alle vorhandenen GPU-Gegenproben bestanden, keine Rendererfehler.
Prozesse 3077628 und 3080454 endeten normal mit Code 0; PIDs verschwunden.
Die Belege enthalten unveränderte Bildintervalle, Eingabeereignisse und
Readback-Samples sowie Quellenbindung und Prozessabschluss. Wiederholte
identische Präsentationszustände sind zu ihren Übergängen zusammengefasst.
Die vollständigen Rohdateien mit zusätzlichen Backend-Traces bleiben lokal;
ihre Hashes stehen im jeweiligen Beleg.

Die separate CPU-Profilierung zeigte unnötige Abfragen des Pixelpack-Zustands
beim Kopieren fertiger Puffer. Die Probe erhält dort jetzt nur die tatsächlich
benötigte Pufferbindung; Pixelpack-Einstellungen betreffen das vorherige
`readPixels`, nicht `getBufferSubData`. Der [abschließende ungeprofilte Lauf](final.json)
mit diesem Prüfcode misst 201,4 / 185,9 ms bis zur ersten Änderung im Pinsel
und 256,9 / 636,3 ms in der Mitte. Navigation: p95 29,8 ms, p99 50,0 ms.
Beide bestätigten Revisionen erreichen wieder 48/48 Kacheln; sämtliche
GPU-Gegenproben bestanden. Prozess 3084078 endete normal mit Code 0,
PID verschwunden, keine Rendererfehler. Die Kopien kosten weiterhin messbare
Zeit; daraus folgt keine unbeobachtete Latenz oder Produktbeschleunigung.

## Gegenprüfungen und Reproduktion

[Node-Regressionen](../../../tests/terrain-pixel-readback.test.mjs) prüfen
Warteschlangengrenze, keine CPU-Kopie vor GPU-Fertigmeldung, Reihenfolge,
Wiederherstellung des Pixelpack-Zustands, Fehlerpfad, Freigabe und die
räumliche Vergleichsmaske. Zwei Tests bestanden.

Die [native GPU-Gegenprobe](../../../tools/terrain-pixel-readback-probe.mjs)
vergleicht synchron und asynchron gelesene Bytes exakt, zeichnet zwischen
zwei Leseaufträgen um und prüft Reihenfolge, volle Warteschlange, fremde
Pufferbindung und nicht standardmäßige Packparameter. Sie läuft nach den
Zeitmessungen und bestand in beiden Weltläufen. Desktop-Build bestanden.

```sh
WORLD_POPULATED=1 WORLD_LARGE=1 WORLD_DRAFT=1 WORLD_PROGRESSIVE=1 \
WORLD_REPEAT=1 WORLD_READBACK=async WORLD_PROFILE=0 \
SALTMARCHER_TERRAIN_TRACE=1 QA_EVIDENCE_DIR=.build/world-response \
python3 tools/ui-session.py timeout --signal=TERM 300s \
  node tools/test-desktop-world-navigation.mjs
```

`WORLD_READBACK=sync` wiederholt den Vergleich mit synchronen Pixelkopien.
`WORLD_PROFILE=1` dient der Ursachenanalyse; solche Läufe getrennt von den
ungeprofilten Latenzwerten beurteilen. Die nächste Produktarbeit muss die
verbleibende Arbeit vor dem ersten Bild und die laufenden Bildintervalle
senken. Diese Änderung verbessert den Nachweis, nicht die Produktleistung.
