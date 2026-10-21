# Kameragerechte Namen im normalen Atlas

Stand: 21.10.2026. Produktquelle `e8540a6f0bcc276f5c575dcf2316191b3d8c21aa`.

Bisher wurden automatisch angeordnete Namen als Texte in Weltgröße auf die räumliche Karte gelegt. Ihre Anordnung folgte dem flachen Kartenrechteck. Kamerabewegung konnte daher Schriftgrößen verändern, Namen am geneigten Boden abschneiden und Kollisionen an der falschen Stelle prüfen. [Vorherige geneigte Hauptkarte](before-main.png), Quelle `66f3f21c`.

Die normale Atlasfläche veröffentlicht jetzt zusätzlich ihre begrenzten Namenskandidaten als `AtlasPaint.mapLabels`. `AtlasSpatialLabels` verwendet die gemeinsame Hauptkamera: logische Schriftgröße, lokale Maßstäbe, projizierter Linienwinkel, leserichtige Ausrichtung und Bildschirmkollisionen. Die bestehende `MapLabelLayout`-Priorität, Objekt-/Ortsdeduplizierung, manuelle Anker und Alternativpositionen bleiben gemeinsam. Nahe und entfernte Namen werden über weiche Maßstabsbereiche ein-/ausgeblendet; ausgewählte Namen bleiben sichtbar. Die Lesbarkeit einer zugehörigen Straße oder eines Flusses begrenzt deren Namen weiterhin.

Die Namenskandidaten bleiben beim Kamerazug verfügbar. Der normale Bereichsleser entfernt sie nicht mehr vorzeitig anhand der flachen Bildschirmbreite. Kandidatenbudget und Schutz der öffentlichen Projektion bleiben erhalten. Frisch gelesene Namen außerhalb des bisherigen Bereichs benötigen weiterhin Daten; dies ist keine weltweite Vorladung.

Texttexturen, Textbreiten und Geländeanker werden wiederverwendet. Eine geänderte Kamera ordnet die vorhandenen Kandidaten neu an, ohne neue Datenabfrage. Die Geländeverdeckung wird erst für platzierbare Namen am Anker geprüft. Danach wird der vollständige Schriftzug gezeichnet, statt einzelne Buchstaben am geneigten Boden abzuschneiden. Unbelegte Terrainbereiche erhalten keine schwebenden Namen. Entfernte Kandidaten geben ihre GPU-Ressourcen frei.

Die Kollisionsprüfung verwendet numerische Bildschirmzellen und einen wiederverwendbaren Prüfrahmen. Nur angenommene Rechtecke werden gespeichert. Ein unabhängiger vollständiger Rechteckvergleich prüft 1200 deterministische Versuche einschließlich gemeinsamer Zellränder. Die perspektivische PNG-Ausgabe ordnet Namen über den vollständigen Ausgabeframe an und behält diese Anordnung über die Teilbilder hinweg.

## Automatisierte Prüfung

- [30 Beschriftungs-/Regionsfälle](label-tests.log): projizierte Kollisionen, weiche Sichtbarkeit, ausgewählte Namen, physische Linienlesbarkeit, verzögerte Verdeckung, Rechteckoracle, Quellenkandidaten, öffentliche Nichtfreigabe, manuelle Anker und vorhandene Regions-/Speicher-/Exportregressionen.
- [28 Kamera-/Treffer-/Beschriftungsfälle](spatial-tests.log): große Koordinaten, Perspektivprojektion, eingefrorene Pinsel-Treffer, partielle GPU-Updates und Auswahl der kanonischen Straßen-ID. Die Renderer-Doubles initialisieren nun die neue Namensebene und bilden die vorhandenen Pixelratio- und Materialaufrufe vor dem Zeichnen nach; die fachlichen Assertions bleiben erhalten.
- [Vorangehende 36 Fälle](source-tests.log) umfassen zusätzlich Szenengeometrie und Ausgabefehler-/Abbruchverhalten. Diese Testmengen überlappen und werden nicht zu einer Gesamtzahl addiert.
- App-/Desktop-Typprüfung, Repositoryprüfung und Desktopbuild bestanden; Logs liegen neben diesem Beleg.

## Native Hauptkarte und GPU

[Hauptatlas-Probe](main-result.json): normale Kampagne öffnen, von 12 km auf 328 m Ausschnittbreite zoomen, 60° neigen und eine schmale Straße am sichtbaren Rand auswählen. Derselbe Canvas bleibt erhalten; alle Autorenrecords sind unverändert. [Aktuelle geneigte Karte](after-main.png). Prozess beendet sich normal mit Exit 0 und bestätigter PID-Abwesenheit; keine Rendererfehler.

Die zusätzliche [isolierte GPU-Szene](gpu-names.png) im selben nativen Prozess prüft 12-/14-Pixel-Schriften bei Nah-/Fernzoom, Neigung und DPR 1/2, leserichtige Linienwinkel, identische Textur-IDs nach Neuveröffentlichung und vollständige Gelände-Verdeckung. Sie zeichnet durch den Produktrenderer. Die Gesamt- und Teilbildausgaben stimmen pixelgenau überein. Das ist getrennt vom eigentlichen Kampagnenablauf protokolliert.

Der [vollständige Regionsablauf](cartography-result.json) besteht 14 Schritte: malen, Nachbargrenzen verfeinern, Undo/Redo, [Name manuell platzieren](manual-region-name.png), eigene Ebene, neue Region, Neustart, Gebäudenamen-Bedeutung, Zoom ohne Autorenänderung und [PNG-Ausgabe](cartography-export.png). Beide Prozesse beenden sich normal mit Exit 0 und bestätigter PID-Abwesenheit; keine Rendererfehler. Quelle und gebaute Artefakte stimmen mit der Hauptatlas-Probe überein.

Der [wörtliche Repository-Start](repository-result.json) über `npm run start:desktop` besteht auf derselben Produktquelle mit identischen Main-/Preload-/Renderer-/HTML-Hashes. Zoom während der Verfeinerung, dieselbe geneigte/gedrehte Kamera, GPU-Höhenlinien und tatsächlicher Grafikverlust mit Fallback/Wiederanlauf sind geprüft. Normaler Exit 0, PID abwesend, keine Rendererfehler. `dirty: true` der anderen Proben bezeichnet die laufende Dokumentation und vorhandenen historischen Belegordner; Produktcode und gebaute Artefakte sind über Quelle und Hashes gebunden.

## Leistung und Abnahmegrenzen

Die [erste dichte Probe](initial-cost.json) mit 1200 Kandidaten und 210 sichtbaren Namen benötigte im kombinierten Messschritt 31,1 ms Median und 129,7 ms p95. Nach Wiederverwendung von Textmaßen/Ankern und späterer Geländeprüfung lagen diese Werte bei [18,7/119,8 ms](retained-cost.json). Der kombinierte Schritt enthält zwei Zeichnungen und Diagnoseabfragen; er ist kein Bildintervall. Eine ergänzende einzelne Kamerazeichnung benötigte 16,8/22,7 ms, darin die Namensanordnung 12,5/16,2 ms. Diese Befunde begründeten die anschließende Verringerung der Kollisionsallokationen.

Nach Verringerung der Kollisionsallokationen liegen im aktuellen Lauf der kombinierte Schritt bei 20,5/148,3 ms und die einzelne Kamerazeichnung bei 15,3/31,5 ms (Median/p95). Die Namensanordnung darin benötigt 9,9/23,5 ms. Der geringere Median ist kein Nachweis einer allgemein verbesserten Latenz: Die Ausreißer bleiben hoch, einzelne Messungen streuen und es fehlen echte Bildintervalle.

Eine zusätzliche [gepaarte reine Layoutmessung](layout-comparison.json) vergleicht denselben Kandidatensatz im selben Node-Prozess in wechselnder Reihenfolge: 100 Drehschritte, davon 20 Aufwärmschritte, und exakte Gleichheit aller platzierten Namen/Rechtecke bei jedem Schritt. Median/p95 sinken von 5,50/8,19 ms auf 4,06/6,38 ms. [Messskript](compare-layout.mjs), vom Repositorywurzelverzeichnis mit `node docs/reference/atlas-camera-labels-20261021/compare-layout.mjs` ausführen. Diese Messung isoliert die Kollisionsänderung; Terrain-Verdeckung, GPU und App-Bildintervalle fehlen.

Die Gesamtziele für 1080p, lange Sitzungen und große Welten sind damit nicht abgenommen. Kalte Erstellung vieler Glyphentexturen, maximale Textspeicherbelegung, Übergänge bei neu eintreffenden Kandidaten, dichte Rasterobjekte, Bewuchs, Geländekontext am Horizont und die übrige Roadmap bleiben offen. Freie Textbearbeitung nach WD-022/HEX-20, Originalvergleich, Nutzerabnahme, Candidate-CI, Main-Integration, Paket und Installation werden hier nicht als abgeschlossen ausgewiesen.
