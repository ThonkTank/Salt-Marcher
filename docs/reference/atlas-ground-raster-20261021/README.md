# Hauptatlas ohne doppelte Bodenbilder

Produktstand: `5a791e6f` auf dem Entwicklungszweig. Der normale Einstieg bleibt `npm run start:desktop` im Repository. Diese Änderung ergänzt die [Warteschlangenarbeit](../atlas-scheduling-20261021/README.md); sie ersetzt keine Gesamtleistungsabnahme.

## Änderung

Der Regionenabruf besaß weiterhin denselben Landschaftsraster wie die Canvas-Draufsicht. Main berechnete bis zu vier Boden-PNGs und der Renderer dekodierte sie, obwohl die räumliche Szene diese Kommandos übersprang und ihre eigene Geländeprojektion verwendete.

`AtlasRegionQuery.terrainRaster=false` lässt diese doppelte Bodenarbeit aus. Die Hauptkarte wählt dies bereits vor dem ersten GPU-Frame; die perspektivische GM-Ausgabe ebenfalls. Normale genaue Landschaftsobjekte, Labels, Referenzen und Auswahl bleiben erhalten. Bei dichten Landschaften entstehen weiterhin transparente Objektbilder mit Straßen, Flüssen, Bewuchs und Referenzumrissen. `LandscapeRaster.content=objects` kennzeichnet sie; die gemeinsame GPU-Szene legt sie auf die Geländeoberfläche statt sie wie doppelte Bodenbilder zu überspringen. Das vorhandene Budget und die genaue Auswahl bleiben maßgeblich.

Die Rasterart ist Teil des Cache-Schlüssels und des bestätigten UI-Quellenvergleichs. Bei tatsächlichem Grafikverlust fordert die Hauptkarte vollständige Bodenbilder nach; ausdrücklicher Kamera-Wiederanlauf fordert erneut die sparsame Region an. Wissensmaske und öffentliche Ausgabe behalten den vollständigen bisherigen Bodenpfad. Der Reader erzwingt diesen auch dann, wenn eine Wahrnehmungsabfrage zugleich `terrainRaster=false` übermittelt. Die Option ändert weder kanonische Daten noch Schreibbefugnisse.

## Gepaarte Messung

`tools/measure-atlas-ground-raster.mjs` verwendet vier Höhenfelder und denselben gepufferten Ausschnitt von 1.800×1.200 m. Jeder Lauf besitzt einen neuen echten Readonly-Service/Worker. Ein weit entfernter kleiner Abruf wärmt Index und IPC, ohne die gemessenen Bodenbilder zu füllen. Reihenfolge: vollständiger Boden / eigene Geländeprojektion / eigene Geländeprojektion / vollständiger Boden. Die Antwortdaten außerhalb der ausgelassenen Bodenbilder sind gleich.

| Lauf | Regionenabruf | Bodenbilder | Antwortgröße |
| --- | ---: | ---: | ---: |
| Vollständig 1 | 5.142 ms | 4 | 143.853 Byte |
| Eigene Projektion 1 | 2,27 ms | 0 | 1.386 Byte |
| Eigene Projektion 2 | 2,03 ms | 0 | 1.386 Byte |
| Vollständig 2 | 3.739 ms | 4 | 143.853 Byte |

[Rohmessung](measurement.json). Dies misst die beseitigte zusätzliche Regionenarbeit, nicht die weiterhin erforderliche Geländeprojektion, GPU-Ausgabe, Bildrate oder Eingabelatenz. Zwei Läufe pro Variante bilden keine belastbaren Perzentile. Keine eigene native Probe oder CPU-Prüfung lief parallel zur Messung; andere Hostarbeit kann die Werte beeinflussen.

## Regressionen und native Prüfungen

[107 gezielte Fälle](tests.log) bestehen. Sie prüfen unter anderem genaue und dichte Landschaften, transparente Objektpixel, Cachewechsel, erzwungenen vollständigen Wahrnehmungsboden, exakte Auswahl, GPU-Abbildung der Objektbilder sowie getrennte bestätigte Quellen vor/nach Grafikverlust. Bestehende Canvas-, Export-, Quellen- und Workerfälle bleiben enthalten. Die [erste Serie](initial-tests.log) deckte zwei unvollständige ältere Exportfixtures ohne das erforderliche `geometry.floors` und einen ungültigen Terrainnamen im neuen Fixture auf. Die Fixtures wurden korrigiert; Produktionsregeln wurden dafür nicht gelockert. [App-TypeScript](type-check.log) , [Desktop-TypeScript](desktop-type-check.log) und [Repositoryprüfung](repository-check.log) bestehen.

Der [normale Entwicklungsstart](repository-result.json) besteht Übersicht, Navigation während der Verfeinerung, gleiche Hauptfläche beim Neigen/Drehen, vorhandene Höhenlinien-Pixelprüfungen und Exportkachelgrenzen. Er prüft jetzt außerdem den tatsächlichen Verlust des WebGL-Kontexts: [vollständiger Canvas-Boden](graphics-fallback.png) und anschließende [Wiederherstellung der Hauptkamera](camera-recovered.png). Der Prozess endet normal mit verschwundenem PID und ohne Rendererfehler.

Die erste Übersicht erscheint in diesem Lauf bei 2.011 ms nach Seitenstart; weitere 4.030 ms später folgt die Detailfarbe. Die vorige Einzelprobe lag bei 14.391 ms beziehungsweise weiteren 7.271 ms. Das ist ein beobachteter Ablaufvergleich auf dem gemeinsamen Host, keine kontrollierte p95-Startzeit. Die erste Übersicht und die feine Farbe bleiben unterschiedliche Bereitschaftszustände.

Eine [separate native Dichteprobe](dense-result.json) setzt 601 überlappende Straßen auf dieselbe Hauptkarte. Sie überschreitet damit die Grenze zur verdichteten Darstellung und prüft echte Straßenpixel in Draufsicht und bei 45° Neigung. Je 169 von 169 geprüften Pixeln zeigen die Straßenfarbe. Der Prozess endet normal, sein PID ist verschwunden, Rendererfehler fehlen. [Geprüftes Bild](dense-tilted.png). Dies prüft Sichtbarkeit der verdichteten Ebene, nicht die Gestaltung einer natürlichen Landschaft oder das Leistungsziel für 601 räumlich getrennte Straßen.

Die [Gebäude-/Ausgabeprobe](objects-result.json) auf demselben Produktstand besteht Dachauswahl, schnelle Höhenänderungen bei erhaltener Raumgeometrie, gekachelte perspektivische PNG-Ausgabe und frisches Öffnen. Beide App-Prozesse enden normal mit verschwundenen PIDs und ohne Rendererfehler.

Die [Live-Pinselprobe](live-result.json) besteht Formen, Glätten, Farbe, Escape, Fokusverlust, Profil, geneigten Zug, frisches Öffnen und einmaliges Undo. Beide Prozesse enden normal, ihre PIDs sind verschwunden, Rendererfehler fehlen. Alle vier nativen Abläufe verwenden identische Main-, Preload-, Renderer- und HTML-Builds. `dirty: true` umfasst Belegdokumente, den neuen Dichte-Probenquelltext und erhaltene historische ungetrackte Verzeichnisse; der Produktcode ist im genannten Commit enthalten.

## Weiter offen

Feine Terrainfarbe benötigt weiterhin Sekunden. Die [Hauptansicht](main-atlas.png) zeigt weiterhin zu dichte beziehungsweise eckige Höhenlinien und bei starker Neigung einen Abdeckungsrand. Transparente Objektbilder bleiben begrenzt aufgelöste Übersichten; vollständige semantische Detailstufen, scharfe Küsten-/Wegdarstellung, große Welten und lange Sitzungen sind weiterhin zu bearbeiten. Candidate-CI am endgültigen SHA, Main-Integration, Pakete, Installation und Nutzerabnahme sind nicht behauptet. Die drei vollständigen kritischen Abschlussprüfungen haben nicht begonnen.
