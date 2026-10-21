# Schmalere Küstenkontur im Hauptatlas

Stand: 21.10.2026. Produktänderung `2e8cdd400edbfce62e2db5348819da55d4c309d7`; erweiterte native Küstenprobe `e9395206d5697cf6bfabef4c9fd9572b3d5fb4db`.

Der breite, in die Farbtextur eingebrannte Küstensaum wird durch eine schmale Kontur ersetzt. Der [isolierte Stilvergleich](style-result.json) prüft Ausgangsstil, schmale Linie und Linie mit leichtem Saum bei zwei Maßstäben und zwei Neigungen. Höhengeometrie und Wasserentscheidungen bleiben identisch. [Vorher](style-before.png), [gewählte schmale Linie](style-after.png), [nähere Draufsicht](style-close.png). Das ist ein Versuch am Produktrenderer, kein Nachweis des normalen App-Einstiegs.

`terrain-coast.ts` zeichnet nur die unmittelbaren Wasser-/Land-Nachbarn auf dem vorhandenen zweifachen Raster. Die gewählte Variante benötigt keine Distanzkarte, keinen breiten Schatten und keine zwei zusätzlichen Distanzdurchläufe. Halo-Samples halten unabhängig gerenderte Kacheln nahtlos; die Ausgabe bleibt abbrechbar. Die direkte Rasterdarstellung verwendet außerdem gemeinsame Höhen-/Trassen-Suchgrenzen. Gelände, das ausschließlich durch eine Trasse entsteht, wird damit wie im Stream berücksichtigt.

[38 Raster-, Kachel-, Cache-, Ausgabe- und Reliefprüfungen](tests.log) sowie App-/Desktop-Typprüfungen bestanden. Die neue Küstenkontur entspricht pixelgenau dem gewählten Referenzalgorithmus. Neun neue Pixelgoldens sind absichtlich getrennt von den historischen Rekonstruktionsgoldens abgelegt.

Die [gepaarte Kernmessung](cost-result.json) isoliert Rasterzeichnung auf vorab berechneten Feldern (1024 × 768). Küste: alt 1293/748 ms, neu 756/702 ms. Binnenland: alt 685/626 ms, neu 772/700 ms. Diese streuenden Werte belegen keine allgemeine App-Beschleunigung; SQL, Höhenfeldaufbau und GPU fehlen. Der entfallende zusätzliche Speicher und die beiden entfallenen Distanzdurchläufe sind die strukturelle Änderung.

[Repository-Entwicklungsstart](repository-result.json) und [Hauptatlas-Küstenprobe](main-result.json) verwenden Quelle `e9395206` und identische Main-/Preload-/Renderer-/HTML-Artefakte. Beide laufen über die normalen Kampagnen- und Atlas-Einstiege. Alle gestarteten Prozesse endeten normal mit Exit 0 und bestätigter PID-Abwesenheit; keine Rendererfehler. Der Entwicklungsstart prüft Zoom während des Nachladens, dieselbe geneigte Kamera, GPU-Pixel und Grafikfallback/Wiederanlauf. Die Küstenprobe prüft schrittweise Farbe, [geneigten Hauptatlas](main-coast.png), [perspektivischen PNG-Export](main-export.png), Absenken unter Meereshöhe und einmaliges Undo mit exakter Wiederherstellung aller Autorenhöhen. Sie wartet nach dem Pinselzug bewusst nur auf bedienbare Geometrie.

Dabei wurde ein weiterer Fehler sichtbar: [Nach dem Pinselzug](edit-detail-loss.png) verlor auch die entfernte, unveränderte Küste vorübergehend ihre feine Farbe. Jede Revision leerte den Renderer-Cache. Dieser Fund wird im [nachfolgenden Schritt zur örtlichen Farberhaltung](../atlas-color-retention-20261021/README.md) behandelt; die schmale Kontur allein behebt ihn nicht.

Die Kontur ist bisher einen Rasterpixel breit, nicht unter jeder Perspektive einen logischen Bildschirmpixel. Grobe Kontexttexturen, weltweite Geometrie-LOD, semantische Objektstufen und die übrige Atlasroadmap bleiben offen. Keine Aussage zu Candidate-CI, Main-Integration, Paket, Installation oder Nutzerabnahme.
