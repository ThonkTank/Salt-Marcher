# Weniger Farbarbeit bei gleicher Küstenschärfe

Rasterkern: `aadbbce8f1569b99fba4fb3767235796a37c02a6`; gemeinsame GPU-Übertragung: `9edbdabf1f6a5e017913e8061894beea1c8c20b2`. Ausgangsstand: `842ab13725e578bcd2880ab73149c98362aaa67d`. Der [vorige Schritt](../atlas-color-tiles-20261021/README.md) brachte frühe einzelne Farbkacheln, erhöhte aber die vollständige Rasterarbeit. Dieser Schritt verbessert denselben Renderer und den normalen Repository-Einstieg.

## Änderung

Die Höhenabtastung berechnet Zelladressen und die Bruchteile für bilineare Gewichte jetzt einmal je Achse und Höhenstufe. Float64-Adressen erhalten weit entfernte Weltkoordinaten; Reihenfolge, NaN-Vererbung, additive Höhen und Küsten bleiben unverändert. Die Reliefberechnung schattiert nur ausgegebene Pixel. Der unsichtbare Rand liefert weiterhin alle Höhenableitungen, Küstenabstände und Schraffuranker.

Eine 256er-Farbkachel verwendet vier 128er-Rasterpakete statt sechzehn 64er-Paketen. Das reduziert wiederholt abgetastete Ränder. Größere Pakete allein verschlechterten die Auswahlwartezeit. Deshalb liegen Unterbrechungspunkte jetzt auch innerhalb der Höhenabtastung (Zeilenbänder bis 16.384 Samples) und der Reliefschattierung. Der Worker kann zwischen ihnen Auswahl bearbeiten. SQL-Iteratoren sind vor jedem Haltepunkt geschlossen; bei Fortsetzung gilt weiterhin die Revisionsprüfung. Synchroner Export und Live-Ausgabe verwenden denselben Rasterkern ohne asynchrone Haltepunkte. Die Höhengeometrie und alle kanonischen Autorenwerte bleiben unverändert.

## Pixel und Regressionen

[27 gezielte Tests](tests.log) bestehen. Die neuen festen [Pixel-Goldens](../../../tests/fixtures/terrain-color-goldens.json) wurden aus dem unveränderten Ausgangsrenderer erzeugt: neun Kombinationen aus gezeichnetem, schattiertem und Höhenanalyse-Stil, Konturen und Maßstab. Die optimierte Ausgabe stimmt Byte für Byte überein. Weitere Fälle prüfen volle/gekachelte Projektionen, Sparse-Vererbung und additive Höhen, weit entfernte Koordinaten jenseits von 32-Bit-Zelladressen, Zeilenbandgrenzen, Abbruch ohne offene Iteratoren, lokalen Cache und Auswahl im echten Worker. [App-TypeScript](type-check.log) und [Desktop-TypeScript](desktop-type-check.log) bestehen.

## Übertragung zur GPU

`terrain-texture-upload.ts` bündelt bestätigte Rechtecke für Boden, feine Farbe und Live-Pinsel. Die verwendete Three-Version verarbeitet `DataTexture.updateRanges` zeilenweise; eine 256er-Kachel erzeugte dadurch 256 `texSubImage2D`-Aufrufe. Der gemeinsame Helfer verwendet die öffentliche Rechteckkopie von einer ausschließlich im CPU-Speicher gehaltenen Datenquelle. Sie teilt den vorhandenen Pixelpuffer und wird niemals als GPU-Quelle gebunden. Vollständige Bilder werden in einem Aufruf übertragen. Geometrie, Treffer und Schreibbefugnisse ändern sich nicht.

Die [35 weiteren Regressionen](texture-tests.log) prüfen betroffene Quellen-, Frame-, Detail-, Fokusnetz- und Trefferwege; [App-TypeScript](texture-type-check.log) und [Repositoryprüfung](repository-check.log) bestehen. Die Serien überlappen mit den oben genannten Tests. `tools/terrain-detail-probe.mjs` ergänzt den Entwicklungsstart um echte GPU-Pixel und gezählte Uploads für Boden und Detail. Rechtecke an verschiedenen Positionen müssen dieselben Ausgabepixel wie vollständiges Nachladen liefern; die Zahl belegter GPU-Texturen darf nicht steigen.

## Gepaarte Messung und ihre Grenzen

`tools/measure-terrain-colour-cost.mjs` baut beide Quellstände separat. Jeder Lauf erhält einen neuen Readonly-Worker mit derselben Küste aus vier Höhenfeldern. Eine Übersicht wärmt IPC, Index und Geometrie, bevor die 24 feinen Farbkacheln entstehen. Während jeder Kachel erfolgen wiederholt Auswahlabfragen mit wechselnden Abständen von 13/19/29 ms. Die gemessene Gesamtdauer enthält diese Proben und die kurzen Pollingpausen; sie ist keine reine CPU-Zeit. Alle vier Ausgaben besitzen denselben SHA-256-Pixeldigest.

[Messung am Produktcommit](worker-result.json):

| Lauf | Alle Farbkacheln | Auswahlabfragen | Längste Auswahlwartezeit |
| --- | ---: | ---: | ---: |
| Ausgangsstand 1 | 11.104 ms | 299 | 86,4 ms |
| Optimiert 1 | 7.409 ms | 242 | 27,6 ms |
| Optimiert 2 | 8.818 ms | 265 | 163,8 ms |
| Ausgangsstand 2 | 8.277 ms | 248 | 33,7 ms |

Der [Vorabvergleich derselben fachlichen Änderungen](working-tree-worker-result.json) lag bei 6.599/6.719 ms vorher und 4.764/5.206 ms optimiert, mit 34/72 ms beziehungsweise 20/20,5 ms maximaler Auswahlwartezeit. Die Wiederholung schwankt erheblich stärker und enthält einen langsamen optimierten Ausreißer. Daraus folgt **keine belastbare Latenz- oder Bildratengarantie**. Keine eigenen Tests, Builds oder nativen Proben liefen parallel zu den Messungen; übrige Hostarbeit wurde nicht verändert. Die ausgewiesenen Perzentile im JSON beschreiben nur diese Stichproben.

Ein [verworfener Zwischenschritt](height-bands-only-result.json) unterbrach die Höhenberechnung, ließ aber die gesamte Reliefschattierung am Stück laufen. Die durchgehenden Auswahlproben deckten Wartezeiten bis etwa 96 ms auf. Daraufhin wurden auch die Reliefzeilen unterbrechbar. Die Messwerkzeuge prüfen bewusst die gesamte Kachelberechnung, nicht nur ihren Anfang.

## Normaler Entwicklungsstart und GPU-Ausgabe

Der [wörtliche Repository-Start](repository-result.json) besteht Navigation während des Nachladens, Neigen/Drehen auf derselben Fläche, Höhenlinien-Pixel, Exportkachelgrenzen sowie echten Grafikverlust mit Canvasfallback und anschließendem Kamera-Wiederanlauf. Der Prozess endet normal, der PID ist verschwunden und Rendererfehler fehlen. Die [Hauptansicht](main-tilted.png) behält die bekannten gestalterischen Grenzen.

Die zusätzliche GPU-Probe zählt für die 256×256-Kachel **256 Aufrufe beim zeilenweisen Referenzpfad und einen Aufruf beim Rechteckpfad**, jeweils auf Boden und Detail. Ein zweites 31×17-Rechteck an anderer Position braucht entsprechend 17 beziehungsweise einen Aufruf. Alle vier partiellen Bilder stimmen vollständig mit nachfolgendem vollständigem Upload überein; die Zahl der GPU-Texturen bleibt konstant. Gemessene Einzelzeiten einschließlich Render/`gl.finish`: Detail 2,7 → 1,4 ms, Boden 2,6 → 0,4 ms für das große Rechteck. Dies ist ein isolierter GPU-Kernelvergleich, keine gemessene Bildrate der ganzen Anwendung.

| Nativer Zustand | Zeit relativ zum Seitenstart |
| --- | ---: |
| Übersicht | 2.024 ms |
| Erste feine Kachel | 2.368 ms |
| Vollständige Verfeinerung | 8.146 ms |

Damit erscheint erste feine Farbe 344 ms nach der Übersicht, vollständige Verfeinerung nach 6.122 ms. Der vorige Produktstand lag bei 426 ms beziehungsweise 7.246 ms. Die [Zwischenprobe nur mit Rasterkernänderung](cpu-native-result.json) war hingegen deutlich langsamer (Übersicht 3.589 ms, fertig 14.343 ms). Der [erste Detail-Upload-Lauf](detail-native-result.json) lag bei 1.994/8.315 ms. Diese Abläufe dokumentieren auch Schwankungen; sie begründen keine allgemeine Startzeit- oder Eingabelatenzgarantie.

Die [Live-Pinselprobe](live-result.json) besteht Formen, Glätten, kumulative Farbe, Escape, Fokusverlust, Profil, geneigten Zug, frisches Öffnen und einmaliges Undo. Die [Objekt-/Ausgabeprobe](objects-result.json) besteht Dachauswahl, schnelle Höhenänderungen mit erhaltenen Räumen, gekachelten perspektivischen Export und frisches Öffnen.

Die [Küstenprobe](coast-result.json) prüft schrittweises Nachladen und Neigung derselben Hauptfläche. [Zwischenstand](coast-middle.png) und [fertige Küste](coast-complete.png) wurden visuell geprüft: Der weiche Übergang und die fertige Küstenschärfe bleiben erhalten; die bekannten dichten/eckigen Höhenlinien sind unverändert. Der zusätzliche GPU-Pixelvergleich umfasst hier auch transparente und halbtransparente Pixel. Rechteck- und Vollupload stimmen wiederum vollständig überein.

Alle vier finalen nativen Abläufe verwenden identische Main-, Preload-, Renderer- und HTML-Builds des genannten GPU-Produktstands. Alle Prozesse enden normal mit verschwundenen PIDs und ohne Rendererfehler. `dirty: true` umfasst Belegdokumente, die ergänzte transparente Pixelprobe und erhaltene historische ungetrackte Verzeichnisse; die Produktquellen sind committed. Die Abläufe liefen nacheinander und ohne eigene parallele CPU-Prüfungen.

## Weiter offen

Kalte Farbe benötigt weiterhin Sekunden, und die schwankenden Auswahlzeiten benötigen weitere Qualifikation. Diese Änderung verbessert keine Höhenliniengestaltung, semantischen Objekt-/Namensstufen oder Horizontabdeckung. Große Welten, lange Sitzungen, Spieleranzeige und alle weiteren Punkte der [Roadmap](../../plans/maps/unified-spatial-atlas.md) bleiben offen. Candidate-CI, Main-Integration, Paket, Installation und Nutzerabnahme werden nicht behauptet. Die drei vollständigen kritischen Abschlussprüfungen haben nicht begonnen.
