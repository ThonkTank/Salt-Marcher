# Schmalere Küstenkontur im Hauptatlas

Stand: 21.10.2026. Der breite, in die Farbtextur eingebrannte Küstensaum wird durch eine schmale Kontur ersetzt. Ein isolierter Vergleich im vorhandenen Renderer prüft Ausgangsstil, schmale Linie und Linie mit leichtem Saum bei zwei Maßstäben und zwei Neigungen. Höhengeometrie und Wasserentscheidungen bleiben identisch.

`terrain-coast.ts` zeichnet nur die unmittelbaren Wasser-/Land-Nachbarn auf dem vorhandenen zweifachen Raster. Die gewählte Variante benötigt keine Distanzkarte, keinen breiten Schatten und keine zwei zusätzlichen Distanzdurchläufe. Halo-Samples halten unabhängig gerenderte Kacheln nahtlos; die Ausgabe bleibt abbrechbar. Die direkte Rasterdarstellung verwendet außerdem gemeinsame Höhen-/Trassen-Suchgrenzen. Gelände, das ausschließlich durch eine Trasse entsteht, wird damit wie im Stream berücksichtigt.

Die betroffenen 38 Raster-, Kachel-, Cache-, Ausgabe- und Reliefprüfungen sowie App-/Desktop-Typprüfungen bestehen. Aktuelle native Anschlussbelege und Aufwandmessung werden nach Abschluss ergänzt. Dies löst nicht die Vergrößerung grober Übersichtstexturen, Bildschirmbreite unter jeder Perspektive oder die übrige Atlasroadmap.
