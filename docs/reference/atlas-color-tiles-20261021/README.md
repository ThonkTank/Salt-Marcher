# Schrittweise Farbkacheln im Hauptatlas

Produktstand: `b5b8e63af3375e901a30051bc7d54f02b2b54e3a`, aufbauend auf `d7a53f702`. Einstieg: `npm run start:desktop` im Root-Repository. Dies ergänzt die [Beseitigung doppelter Bodenbilder](../atlas-ground-raster-20261021/README.md); es ist keine Gesamtleistungsabnahme.

## Änderung und Grenzen

Die Hauptkamera zeigt zuerst dieselbe vollständige Geländegeometrie mit einer kleinen 128er-Farbübersicht. Die zentrale Farbe folgt jetzt in weltfest ausgerichteten 256×256-Kacheln, von der Mitte nach außen. Jede Antwort aktualisiert ausschließlich die entsprechenden Zeilen einer Detailtextur. Höhenmesh, Treffer, Straßen und Gebäude werden dafür nicht neu aufgebaut. Erst danach folgt die feinere 512er-Kontextfarbe.

`terrain-color-raster.ts` ist der gemeinsame Rasterkern für vollständige Projektionen und einzelne Farbkacheln. Die neue, validierte Readonly-Anfrage enthält weder Schreibbefugnisse noch Autorengeometrie. Main prüft Token, Revision und Quellenfence; Workerfortsetzungen prüfen die Revision erneut. Die Arbeit gibt den Worker nach kleinen Rasterpaketen frei. Auswahl hat Vorrang; Gesten und neuere Quellen widerrufen alte Antworten vor Veröffentlichung und Cacheaufnahme.

Ein 32-MiB-LRU im Renderer hält abgeleitete Kachelpixel. Pan und kleine Zoomänderungen verwenden passende Weltkacheln wieder. Kampagnentoken, Revision, Fence und die Auswahl rasterisierter Trassen bilden die Cacheidentität. Ein Fehler behält fertige Kacheln und die Übersicht; ausdrücklicher Wiederanlauf nutzt den vorhandenen Fortschritt. Änderungen verwerfen derzeit konservativ den gesamten Renderer-Farbcache; die örtliche Backend-Invalidierung bleibt erhalten.

Das Weltgitter verwendet Zweierpotenzen und unterschreitet die bisherige zentrale 1024-Pixel-Dichte nicht. Mit Randkacheln entstehen höchstens 9×9 Kacheln beziehungsweise 2304×2304 Pixel. Das erhöht stellenweise die berechnete Pixelmenge deutlich. Die zusammengesetzte Textur braucht bis zu rund 20,3 MiB CPU-Speicher, zeitweise zusätzlich das vorherige Bild, außerdem GPU-Speicher. Die Cachegrenze ist deshalb keine Gesamt-RAM-Garantie; Gesamt-RSS und Langzeitsitzungen wurden hier nicht qualifiziert.

## Sichtbarer Übergang

Die erste native Küstenprobe auf `d7a53f702` zeigte [einen störenden rechteckigen Schärfesprung](coast-before.png). Ihre [Rohdaten](coast-before-result.json) bleiben erhalten. Daraufhin kam eine kleine Verfügbarkeitsmaske hinzu: Geladene Kacheln mischen ihre Ränder weich mit noch fehlenden Nachbarn. Sobald alles geladen ist, entfällt diese zusätzliche Mischung. Vollständige Projektionen und Live-Pinsel besitzen keine solche Maske.

Die wiederholte Probe auf `b5b8e63a` zeigt [den frühen Übergang](coast-partial.png), [die vollständige Küste](coast-complete.png) und [dieselbe Hauptfläche bei 45° Neigung](coast-tilted.png). Die Bilder wurden angesehen: Der harte rechteckige Einschnitt der ersten Probe ist verschwunden; die fertige Küste bleibt scharf. Die frühe Übersicht ist weiterhin deutlich unscharf. Dichte, eckige Höhenlinien und eine feine streifige Terrainstruktur sind weiterhin sichtbar und nicht als gestalterisch fertig bewertet. Die Küste ist ein gezieltes synthetisches Höhenfixture, keine Abnahme einer natürlichen Weltkarte. [Probenresultat](coast-result.json). Eine zusätzliche Aufnahme [bei mindestens halber Kachelbelegung](coast-middle.png) zeigt den weichen Übergang zur noch groben Umgebung; [erneuter Ablauf mit zusätzlicher Zwischenaufnahme](coast-middle-result.json), identischer Produktbuild.

## Zeitbeobachtung

Der [erneute wörtliche Entwicklungsstart](repository-result.json) misst folgende Zustände relativ zum Seitenstart:

| Zustand | Zeit |
| --- | ---: |
| Bedienbare Übersicht | 1.962 ms |
| Erste feine Kachel | 2.388 ms |
| Alle 24 Farbkacheln | 8.588 ms |
| Zusätzlich feiner Kontext, vollständig | 9.208 ms |

Erste feine Farbe erscheint damit **426 ms nach der Übersicht**, vollständige Verfeinerung nach weiteren **7.246 ms**. Im vorherigen Einzelablauf ohne Kachelausgabe erschienen alle Details gemeinsam etwa 4.030 ms nach der Übersicht. Die Änderung verbessert also die frühe schrittweise Information, erhöht hier aber durch mehr Detailpixel die gesamte Arbeit. Kein allgemeiner Geschwindigkeitssieg, keine Bildraten- oder p95-Garantie: Einzelproben auf gemeinsamem Host, unterschiedliche erzeugte Pixelmengen. Eigene CPU-Prüfungen und native Abläufe liefen nicht gleichzeitig.

## Regressionen und weitere native Abläufe

Die [23 Fälle des Worker-/Projektionslaufs](worker-tests.log) prüfen unter anderem Auswahlpriorität im echten Worker, Quellenwechsel, bytegleiche Farbpixel benachbarter Kacheln zur vollständigen Projektion, unveränderte Geometrie, Pan-Wiederverwendung und Gestenwiderruf. Die [26 Fälle nach der Übergangskorrektur](coverage-tests.log) ergänzen Verfügbarkeitsmaske, deren Entfernung vor vollständigen/Live-Texturen und Fehler mit anschließendem Wiederanlauf aus dem Cache. Die Serien überlappen; ihre Zahlen werden nicht zu einer Gesamtdeckung addiert. [App-TypeScript](type-check.log) und [Desktop-TypeScript](desktop-type-check.log) sowie [Repositoryprüfung](repository-check.log) bestehen.

Der normale Entwicklungsstart prüft zusätzlich Wheel-Navigation bei laufender Verfeinerung, dieselbe Fläche beim Neigen/Drehen, GPU-Höhenlinien-Pixel und Exportkachelgrenzen. Tatsächlicher WebGL-Kontextverlust lädt vollständigen Canvasboden; ausdrücklicher Wiederanlauf stellt die Hauptkamera wieder her. Der Prozess endet normal, der PID ist verschwunden, Rendererfehler fehlen.

Die [Objektprobe](objects-result.json) besteht Dachauswahl, schnelle Höhenänderungen mit unveränderten Raumdaten, gekachelten perspektivischen Export und frisches Öffnen. Beide App-Prozesse enden normal und ihre PIDs sind verschwunden. Die Kamera bleibt auf derselben Hauptfläche.

Die [Live-Pinselprobe](live-result.json) besteht Formen, Glätten, Farbe, Escape, Fokusverlust, Profil, geneigten Zug, frisches Öffnen und einmaliges Undo. Beide Prozesse enden normal; ihre PIDs sind auch nach Ende der Probe nicht vorhanden. Alle vier nativen Abläufe verwenden identische Main-, Preload-, Renderer- und HTML-Builds. `dirty: true` umfasst Belegdokumente, Probenquelltext und erhaltene historische ungetrackte Verzeichnisse; der Produktcode ist im genannten Commit enthalten.

## Weiter offen

Vollständige kalte Farbe bleibt zu teuer. Weltweites Geometrie-LOD, präzisere Invalidierung im Renderer, Höhenliniengestaltung, Horizontabdeckung, semantische Objekt-/Namensdarstellung, große Welten und Langzeitsitzungen bleiben Teil der [Roadmap](../../plans/maps/unified-spatial-atlas.md). Candidate-CI am endgültigen SHA, Main-Integration, Pakete, Installation und Nutzerabnahme sind nicht behauptet. Die drei vollständigen kritischen Abschlussprüfungen haben nicht begonnen.
