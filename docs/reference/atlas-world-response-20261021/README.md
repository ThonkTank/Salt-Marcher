# Weltmaßstab: Navigation, Höhenlinien und großer Pinsel

Auslöser: v0.178.0 reagiert laut Eigentümer auf einem Pentium Gold 7505
(2 Kerne/4 Threads, Intel UHD Tiger Lake-LP GT2) selbst mit wenig Gelände erst
nach Sekunden auf Zoom/Pan. Pinselradius: 2.500 statute miles = 4.023.360 m.
Unmittelbare Reaktion ist ausdrücklich auch für eine gefüllte Welt gefordert.

## Ursache und begrenzte Verbesserungen

Die CPU-Probe der dünn belegten Welt verbrachte rund 55 von 61 Sekunden im
Aufbau auf das Gelände projizierter Hexgitter-Dreiecke. Das Gitter liegt jetzt
prozedural auf dem bestehenden Bodenmaterial: Weltanker und Überblendung der
zwei Maßstäbe bleiben erhalten, ohne pro Kamerabild neue Pfade oder Meshes.
Canvas-Fallback und Vektorausgabe behalten ihre Pfade.

Automatische Höhenlinien wählten ihre Höhenstufe zuvor für jedes Fragment aus
der örtlichen Steigung. Dieselbe Höhenlinie konnte deshalb mitten im Hang
verschwinden. Die Auswahl verwendet jetzt eine gemeinsame Steigungsreferenz
des geladenen Fokusbereichs; Pixelbreite und Dichteblende bleiben lokal.

Unsichtbare Trassen werden vor der GPU-Einreichung konservativ ausgesondert;
die bisherigen Geometrien erscheinen beim Heranzoomen ohne Neulesen wieder.
Weltweite Waldübersichten lesen ihre Höhenumgebung erst, wenn tatsächlich ein
Einzelobjekt benötigt wird. Zuvor überschritt bereits der Übersichtswald das
16-MiB-Limit für Autorenrecords und meldete die Landschaft als nicht verfügbar.

Benachbarte invalidierte Höhen-/Farbblöcke teilen nun einen Quellabruf. Die
Invalidierung bleibt kleinräumig, aber ein großer Strich dekodiert dieselben
Quellen nicht mehr für jeden 4×4-Höhenblock erneut.

## Native Messung

Werkzeug: [test-desktop-world-navigation.mjs](../../../tools/test-desktop-world-navigation.mjs).
Normaler App-Einstieg, isoliertes Profil, 1440×900, DPR 1, Intel UHD 620 über
ANGLE/Mesa auf i5-8365U. **Kein Test auf dem gemeldeten Pentium.** Auf dem Host
laufen außerdem andere Desktopanwendungen; dies ist keine isolierte Hardwaremessung.

Die dünne Welt enthält vier additive Höhenkacheln. Die gefüllte Lastprobe
ergänzt 1.024 Höhenkacheln, 1.024 Wälder und 1.024 Straßen über 33.554 km je
Achse. Das ist ein kontrollierter Lastfall mit 3.076 Records, nicht die vollständige
Abnahmewelt und nicht die geforderte selbst erstellte Fantasywelt bis ins Gebäude.

| Lauf | Navigation RAF p95 / Maximum | Aussage |
| --- | --- | --- |
| Dünne Welt vorher | 2.284 / 6.651 ms | Hexgitter blockiert CPU; betreffender Pfad seit v0.178.0 unverändert |
| Dünne Welt, GPU-Gitter | 36,9 / 266,8 ms | Kein Gitter-Meshaufbau pro Kamerabild |
| Gefüllt, vor Trassen-Aussonderung | 133,4 / 372 ms | Viele unsichtbare GPU-Einreichungen; Waldlesefehler noch vorhanden |
| Gefüllt, finaler Stand dieser Änderung | 40,8 / 283,5 ms | Waldübersicht lesbar; kein Sekundenstillstand durch Hexgeometrie |

RAF-Abstände mit CPU-Profiler sind **keine Input-to-photon-Messung**. Insbesondere
die Maxima enthalten Messgrenzen und asynchrone Nachladearbeit. Sie qualifizieren
die Roadmapziele von p95 16,7 ms/p99 33,3 ms nicht. Rohdaten und Zwischenstufen:
[measurements.json](measurements.json). Bilder: [dünne Welt](sparse-contours.png),
[gefüllte Welt](populated-world.png), [bestätigter Pinselstand](populated-sculpt.png).
Die gefüllte Darstellung bleibt sichtbar grob; die Bilder sind keine ästhetische Abnahme.

Alle aufgeführten nativen Prozesse endeten normal (Exit 0, PID anschließend
abwesend). Der große Strich wurde gespeichert und sein bestätigter Höhenstand
nach Abschluss sichtbar. **Die Live-Reaktion ist weiterhin unzureichend:**
Die schnellere Höhenberechnung benötigte im letzten Lauf höchstens 63 ms statt
zuvor 600 ms. Der gesamte erste Live-Frame benötigte dennoch 4.747 ms, folgende
1.612 und 1.700 ms. Diese synchrone Farbarbeit blockiert auch den nächsten
Autorenauftrag im gemeinsamen Worker. Ein p95-RAF von 16,8 ms während des
Strichs beweist hier nur eine weiterlaufende Anzeige, keine schnelle Geländeänderung.
Dieses Problem bleibt offen; der nächste Schritt muss bestätigte Höhenänderung
und teure Farbverfeinerung entkoppeln.

## Gegenprüfungen

87 gezielte Node-Regressionen, beide TypeScript-Prüfungen, Desktopbuild und
`check:repo` bestanden. Der zusätzliche wörtliche `npm run start:desktop`
bestand Navigation während Farbverfeinerung, Neigen/Drehen auf derselben
Atlasfläche sowie echten WebGL-Verlust mit Canvas-Fallback und Wiederanlauf.
[Startprotokoll](development-start.json), [geneigter Hauptatlas](development-tilt.png).
Auch dieser Prozess endete mit Exit 0 und anschließend abwesender PID.

- GPU-Hexorakel: sichtbare Kanten, weißes Zentrum, keine zusätzlichen Gitterobjekte;
  entfernte Weltanker und gekachelte Ausgabe bytegleich (Abweichung 0).
- GPU-Höhenlinien: durchgehende gleiche Höhe über unterschiedliche Hangneigungen;
  automatische Stufen und DPR 1/1,5/2 entsprechen CPU-Referenz bis auf 1 Farbwert;
  Ausgabe-Kachelgrenze ohne Pixelabweichung.
- Höhen-/Farbcache: lokale Änderungen, ungerade Raster, gebrochene Weltursprünge,
  Kachelränder und Undo entsprechen vollständiger Neuberechnung. Fehler lassen
  schmutzige Blöcke erneut lesbar; vorher veröffentlichte Puffer bleiben unverändert.
- Weltwald: >16 MiB Höhenbestand wird für eine reine Übersicht nicht gelesen;
  ein geschützter Baum liest nur seine lokale Umgebung und behält die korrekte Höhe.

Zuständige Regressionen: `tests/terrain-hex-grid.test.mjs`,
`tests/terrain-contours.test.mjs`, `tests/terrain-route-display.test.mjs`,
`tests/vegetation.test.mjs`, `tests/terrain-surface-cache.test.mjs`,
`tests/terrain-projection-cache.test.mjs`. Vollständige Autorenreise, Zielhardware,
100.000-Hex-Abnahme, Veröffentlichung und Eigentümerabnahme bleiben getrennt.
