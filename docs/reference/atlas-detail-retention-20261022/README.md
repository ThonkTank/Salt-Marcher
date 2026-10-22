# Detailbilder ohne vollständige Pixelschleife übernehmen

Lokale Änderung auf `54282002`, 22.10.2026. Die native volle Welt zeigte zuvor
184 ms aufsummierte Eigenzeit für `retainPrevious` im Renderer. Die vorhandene
Kartenfläche behält bereits geladene Details beim Maßstabwechsel; dafür muss sie
sie in das neue Raster übernehmen. Der alte Pfad kopierte auch bei identischer
Auflösung jeden RGBA-Kanal einzeln.

`retainTerrainDetail` übernimmt zusammenhängende Pixelzeilen direkt. Ob sie
zusammenhängen, wird aus den tatsächlich berechneten Abtastindizes bestimmt;
Rundung und Weltverankerung bleiben damit unverändert. Die Sampleindizes bleiben
64-Bit-Zahlen: Bei einem direkten Sprung vom kleinsten Detail zur Welt konnten
die bisherigen 32-Bit-Indizes überlaufen und weit entfernte Pixel zurück in das
alte Detail wickeln. Ein gezielter Test reproduzierte dieses Fehlbild vor der
Korrektur. Beim Vergrößern werden
wiederholte Quellzeilen aus der bereits abgetasteten Zielzeile kopiert. Für echte
Umskalierung werden ausgerichtete RGBA-Werte als undurchsichtige Vierbytewerte
übertragen, ohne Farb- oder Byteorder-Konvertierung. Nicht ausgerichtete
Arrayansichten behalten den Kanalpfad. Waldabdeckung folgt denselben Indizes.

Die Invalidierung berechnet den Beleuchtungs-/Küstenrand einmal pro Kachel statt
für jedes Änderungsrechteck erneut. Das bereits veröffentlichte Vorgängerbild
bleibt unverändert. Die Implementierung bleibt im bestehenden Detail-Loader;
es gibt keine weitere Datenhaltung oder Benutzeransicht.

## Nachweis und Grenzen

Eine unabhängige Pixelzentrum-Gegenprobe umfasst 450 Kombinationen aus positiven,
negativen und großen Weltursprüngen, verschiedenen Pixelgrößen, fünf Zoomfaktoren,
angeschnittenen oder vollständig fehlenden Überlappungen und vorhandenem/fehlendem
Waldkanal. Zusätzlich werden nicht ausgerichtete Byteansichten geprüft. Die
vorhandenen Prüfungen für Quellwechsel, Revisionen, Rücknahmen, Kachelränder und
Teil-Uploads bleiben bestehen.

15 lokale Tests bestanden, einschließlich der 450 Pixelkombinationen und der
Regression für den extremen Maßstabssprung. App- und
Desktop-Typprüfung sowie der Desktop-Build bestanden für den endgültigen Code.

Die [isolierte Gegenmessung](paired-cpu.json) vergleicht denselben 2048×1536-Puffer
mit dem exakten alten Code aus `54282002`. Nach einem Warmup folgen sechs
Messungen je Variante in wechselnder Reihenfolge; alle Ausgabehashes sind
identisch. Die Anlage der leeren Zielpuffer ist aus den Kopierzeiten ausgeklammert,
die Invalidierung enthält ihre unveränderlichen Pufferkopien. Während dieses
Laufs liefen keine eigenen Builds, Typprüfungen oder nativen Proben parallel.

| Vorgang | Vorher, Median | Nachher, Median |
| --- | ---: | ---: |
| Gleicher Ausschnitt und Maßstab | 107,22 ms | 9,15 ms |
| Verschieben um eine Kachel | 78,48 ms | 6,07 ms |
| Hineinzoomen | 114,55 ms | 34,69 ms |
| Herauszoomen | 31,23 ms | 24,78 ms |
| Invalidierung mit vielen Änderungsgrenzen | 11,79 ms | 7,48 ms |

Die Zeilenübernahme ist deutlich billiger; das Hineinzoomen liegt im gewählten
großen Einzelpuffer weiterhin über einem 16,7-ms-Framebudget. Auch das Herauszoomen
liegt in dieser Einzelpuffergröße noch über dem Framebudget. Das Vorziehen der
Randberechnung reduziert den CPU-Baustein der Invalidierung, beseitigt aber
nicht die großen unveränderlichen Pufferkopien.
Frühere Entwicklungsdurchläufe überlappten teilweise mit Typprüfungen und werden
nicht als Leistungsbeleg verwendet. Dies sind CPU-Bausteinmessungen, keine
vollständigen Frame- oder Interaktionszeiten.

## Native volle Welt

Die [native Lastprobe](world.json) verwendet denselben privaten, synthetischen
Weltbestand und 2.500-Meilen-Pinsel wie der
[vorherige Stand](../atlas-forest-integration-20261022/world.json). Nach dem ersten
Strich wird gezoomt, dann ein zweiter echter Strich vor Abschluss der feinen
Kacheln ausgeführt. Die alte Arbeitskopie oder eine echte Nutzerdatenbank wird
nicht verändert.

| Beobachtung | Vorher | Endgültiger Stand |
| --- | ---: | ---: |
| Öffnen bis bearbeitbar | 10,74 s | 11,34 s |
| Loslassen bis Bedienelemente frei | 2,67 s | 2,83 s |
| Loslassen bis erneut bearbeitbar | 5,21 s | 4,24 s |
| Zweiter Strich bis bearbeitbar | 3,14 s | 2,62 s |
| Eigenzeit der Detailübernahme im Rendererprofil | 184,10 ms | 24,14 ms |
| Eigenzeit der Invalidierung im Rendererprofil | 164,86 ms | 161,03 ms |

Die [Profilzusammenfassung](renderer-profile-summary.json) trennt CPU-Eigenzeiten
von den durchgängigen UI-Zeiten. Sie enthält Pfad und Hash der lokal erhaltenen
Rohprofile. Die beiden UI-Läufe sind Einzelmessungen; die gesamte verkürzte
Wartezeit ist nicht allein dieser Änderung zuzuschreiben. Insbesondere ist der
ursprünglich ebenfalls auffällige Invalidierungspfad im echten Ablauf weiter
teuer. Die rein numerische Vorberechnung seiner Randbox löst das Problem nicht.

Der endgültige Lauf erreicht 36/36 Detailkacheln mit sichtbarer, Autoren- und
[gespeicherter Revision](persisted.json) 14. Die [Aufnahme](world.png) wurde
visuell geprüft; das regelmäßige synthetische Raster ist kein Nachweis einer
gestalteten Fantasy-Welt. Prozessende mit Code 0, Prozess verschwunden,
keine Rendererfehler. Die endgültigen Buildhashes werden im Beleg festgehalten.

Der Renderer meldete noch einen Long Task von 393 ms und einen beobachteten
Frameabstand von 400,3 ms. Die Probe sammelt nur Abstände oberhalb 50 ms; daraus
lässt sich kein p95 über alle Frames berechnen.

Die volle Welt reagiert weiterhin nicht unmittelbar. Erste Pixel innerhalb
100 ms, Navigation mit p95 16,7 ms, eine Übersicht innerhalb zwei Sekunden,
30 Minuten Speicherstabilität und die physische Pentium-Hardware sind mit
diesem Schritt nicht qualifiziert. Die nächste Profilspur sind die weiter
teuren Pufferkopien bei Invalidierung und die Bestands-/Geometriearbeit beim
Abschluss eines Strichs.

## Normaler Zoom und Export

Der [normale Atlasablauf](normal-atlas.json) zoomt von 80 km über 60 km, 6 km
und 1,2 km auf 300 m, neigt die Hauptkamera und exportiert Welt- sowie Nah-PNG.
Die ersten vier Ansichtsaufnahmen und beide Exporte sind bytegleich mit dem
vorherigen Produktstand. Die zwei weiteren nativen Aufnahmen wurden erneut
visuell geprüft; die [geneigte Ansicht](tilted.png) ist beigefügt. Autorenobjekte
und die geschützte Eiche bleiben unverändert. Reguläres Prozessende, keine
Rendererfehler; alle elf Buildhashes stimmen mit dem endgültigen Weltlauf und
dem aktuellen lokalen Build überein.

Diese Änderung verbessert CPU-Arbeit und korrigiert einen Koordinatenfehler.
Sie ändert keine Gestaltung und ist noch nicht nach Main integriert oder als
Release veröffentlicht. Die erforderliche Candidate-CI bleibt eine getrennte
Lieferprüfung.
