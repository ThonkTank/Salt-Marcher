# Pinselanzeige ohne Neuaufbau unveränderter Kartenobjekte

21.10.2026, Änderung auf `0ce4b6590`, Version 0.180.0.
Host i5-8365U / UHD 620; keine Qualifikation auf dem Pentium Gold 7505.

## Ursache und Umsetzung

Hover, Pointerdown und Pointermove der direkten Pinsel riefen denselben
vollständigen Zeichenweg wie geänderte Autorenobjekte auf. Dadurch entstand
eine neue `AtlasCanvasScene`, und der GPU-Adapter baute die Kartenobjekte
erneut auf. Die [vorherige Profilierung und Messkorrektur](../atlas-brush-response-measurement-20261021/README.md)
trennt diese Arbeit von der tatsächlichen Höhenvorschau und vom Messaufwand.

`LandscapeWorkbench` verwendet für Sculpt, Glätten und Farbe jetzt den
vorhandenen Overlay-Zeichenweg. Die Karte behält ihre veröffentlichte Szene;
Cursor, Maße, Höhenablesung, Werkzeugzustand und die direkte Geländeanzeige
werden unabhängig aktualisiert. Eine verspätete gültige Höhenablesung ändert
nur diese Anzeige. Auch Speicherstatusereignisse aktualisieren während einer
aktiven GPU-Pinselpräsentation nur Bedienelemente und Overlay. Erst der Abschluss
löscht diese Präsentation und aktualisiert den Autorenbestand. Der Canvas-Fallback
veröffentlicht bestätigte Terrainbilder weiterhin über seinen normalen Zeichenweg.
Geometrieänderungen, andere Pinselentwürfe und das Ende
eines Zugs behalten den vollständigen Aktualisierungsweg. Main bleibt der
Besitzer von Schreiben, Revisionen und History.

Der generische Pinselkreis gehört jetzt zur flüchtigen Ebene. Bei Sculpt,
Glätten und Farbe zeichnet der GPU-Atlas bereits seinen dauerhaften
Geländecursor; der zusätzliche Kreis entfällt. Der Canvas-Fallback und andere
Werkzeuge erhalten ihren Kreis weiterhin, einschließlich Weltposition,
Radius und Ausblenden beim Verlassen der Karte. Es entsteht kein neuer Cache.

## Regressionen

[DOM-Prüfungen](../../../tests/desktop-atlas-frame-loading.test.mjs) führen
Hover, Beginn und Bewegung für alle drei direkten Pinsel aus und verlangen
Overlay-Aktualisierungen ohne Invalidation der Kartengeometrie. Der Wechsel
zu einem Geometrieentwurf muss wieder vollständig zeichnen. Eine weitere
Prüfung trennt den Cursor vom Karteninhalt und prüft Fallback, GPU-Modus,
anderen Pinseltyp, Position, Radius und Verlassen.

141 betroffene Tests bestanden, einschließlich Canvas-Veröffentlichung,
Autorenebenen und Speicherung/Abschluss direkter Züge. Beide TypeScript-Prüfungen
und Desktop-Build bestanden.

[Speicher-/Darstellungsregressionen](../../../tests/terrain-commit-display.test.mjs)
prüfen zusätzlich, dass Statusaktualisierungen alle Bedienelemente erreichen,
aber die aktive GPU-Karte erhalten. Abschluss, normale Änderungen und Fallback
müssen den vollständigen Zeichenweg weiter erreichen.

## Native Prüfungen

Der [Weltprüfweg](../../../tools/test-desktop-world-navigation.mjs) ergänzt
`WORLD_OVERLAY=1` zwischen zwei großen Zügen: Zwölf echte Mausbewegungen
müssen dieselbe veröffentlichte Kartenszene und ihre GPU-Programme behalten.
Pixelreaktion, bestätigte neue Revisionen und vollständige Detailverfeinerung
bleiben eigene Prüfungen. `WORLD_READBACK=async WORLD_PROFILE=0` trennt diese
Zeitmessung vom CPU-Profiling. [Abschließende Weltprobe](world.json), [Ansicht](world.png): 108.076 Objekte,
2.500-Meilen-Pinselradius, ungeprofilte Messung. Zwölf Hoverbewegungen halten
Szene `25`; es entstehen und verschwinden **keine GPU-Programme**. Während
des anschließenden großen Zugs bleibt ebenfalls Szene `25`, obwohl die
bestätigte Autorenrevision von 9 auf 12 steigt. Die Terrainanzeige folgt dabei
ihrem eigenen Vorschau-/Bestätigungsweg.

| Abschnitt | RAF p95 / p99 / Maximum | Erste Änderung im Pinsel | Vollständige Details nach Loslassen |
| --- | ---: | ---: | ---: |
| Navigation | 34,3 / 48,1 / 66,7 ms | nicht gemessen | nicht gemessen |
| Erster Zug | 38,4 / 43,0 / 83,5 ms | 207,6 ms | 38.586,6 ms |
| Zweiter Zug | 36,6 / 41,0 / 55,0 ms | 124,3 ms | 8.410,1 ms |

Beide Züge erreichen gespeicherte neue Revisionen (9 und 14) mit 48/48 Kacheln.
Alle bestehenden GPU-Gegenproben bestanden; keine Rendererfehler, Prozess
3096680 endete normal mit Code 0, PID verschwunden. Keine anderen eigenen
Builds oder nativen Prozesse während dieser Messung.

Die [erste Teilprüfung](initial.json), noch ohne die Abkürzung für Speicherstatus,
erreichte ebenfalls erhaltene Hover-Szene und Programme, aber 234,5 / 135,6 ms
bis zur ersten Änderung. Das begründete die zusätzliche Eingrenzung des
Statuspfads. Prozess 3093843 endete ebenfalls normal, ohne Rendererfehler.

Die [vorherige unveränderte Produktbasis](../atlas-brush-response-measurement-20261021/final.json)
maß 201,4 / 185,9 ms. Der erste Zug ist daher nicht nachweislich schneller;
der neue Befund beim Wiederholen ist ein einzelner Vergleich, kein p95-Beleg.
Die Pixelzeiten enthalten weiterhin GPU-Ausleseaufwand und sind keine
Compositor-Zeitstempel. Die unveränderte Szene und ausbleibende Programmwechsel
belegen die beseitigte Arbeit direkt. Die 100-ms-/60-FPS-Ziele, kalte
Detailverfeinerung, vollständige Mischlast und Speicherplateau bleiben offen.
Die synthetische Rasterwelt ist keine Fantasy-Gestaltungsabnahme.

[Native Pinselbedienung](brush-ux.json): neun Prüfgruppen bestanden, darunter
schmale Fenster bis 200 % Skalierung, fünf Vorlagen, Radiusbindung,
Höhenänderung mit Undo/Redo, andere Pinselfamilien, Shift+Mausrad,
gekippte Kamera, PNG und frisches Öffnen bei 125 % Browserzoom.
Prozesse 3097819 und 3098411 endeten normal mit Code 0 und verschwanden;
keine Rendererfehler.

Das [geprüfte Kippbild](tilted-brush.png) zeigt allerdings erneut einen
unbrauchbar steilen kleinen Geländeauszug: Der Test kombiniert 100 m/s
Höhenwirkung mit einem Radius unter einem Meter. Es belegt die technischen
Bedienzustände, keine natürliche Geländeform oder geeignete Werkzeugwerte
über alle Maßstäbe. Diese gestalterische Bedienlücke bleibt offen.

## Autorenweg vom Kontinent zum Raum

[Nativer Autorenablauf](authoring.json): acht Schritte von der leeren Kampagne
über Kontinente, Relief, Wald, ein unabhängiges Königreichsgebiet, Straße und
Gebäude bis zu einem benannten Raum und frischem Öffnen. Prozesse 3099009
und 3100060 endeten normal mit Code 0, PIDs verschwunden, keine Rendererfehler.

Die Bilder [Kontinente](02-continents.png), [Wald](04-continental-forest.png)
und [frisch geöffnetes Gebäude](08-reopened.png) wurden angesehen. Navigation,
Bearbeitung und Wiederaufnahme funktionieren. Die Kontinente wirken weiterhin
wie breite Pinselstriche; Relief ist zu schwach, der ferne Wald eine flache
grüne Fläche. Das erfüllt noch nicht die gewünschte Fantasy-Kartengestaltung.
Der technische Autorenablauf ersetzt diese visuelle Abnahme ausdrücklich nicht.
