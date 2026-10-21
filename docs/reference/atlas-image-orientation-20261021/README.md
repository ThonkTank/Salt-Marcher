# Bildkacheln bleiben an ihren Weltkoordinaten

21.10.2026. Folgeuntersuchung des im
[Waldvergleich](../forest-detail-20261021/README.md) erkannten Versatzes.

## Ursache und Korrektur

Die Canvas-Bildversorgung liefert `ImageBitmap` ohne Spiegelung. Die
GPU-Szene verwendete Texturkoordinaten für einen vertikal gespiegelten Upload.
Three.js wendet `UNPACK_FLIP_Y_WEBGL` bei `ImageBitmap` jedoch nicht an
(lokal geprüft in `WebGLTextures.js`). Dadurch wurden Objekt-Rasterkacheln
und andere Bitmapbilder innerhalb ihrer korrekten Weltumrisse gespiegelt.
Waldpunkte lagen außerhalb der Waldfläche; auch rasterisierte Wege waren
betroffen. Gespeicherte Geometrie und Terrainfarben waren korrekt.

`AtlasSpatialScene` verwendet jetzt für alle Bildquellen ungespiegelte Uploads
und Texturkoordinaten mit Ursprung oben. Damit funktioniert derselbe Pfad für
HTML-Bilder, Canvas und ImageBitmap, ohne quellabhängige Sondergeometrie.

## Nachweise

- Asymmetrische Testkachel mit vier farbigen Ecken: Canvas, HTML-Bild und
  ImageBitmap, jeweils in Draufsicht und bei 45° Neigung. Die
  [native Pixelprobe](../../../tools/test-desktop-atlas-image-orientation.mjs)
  prüft die exakten RGBA-Werte an vier Weltpositionen mit dem produktiven
  `AtlasSpatialScene`. [Vorher](before-pixels.json) sind ausschließlich
  Bitmapquellen vertauscht; [nachher](pixel-probe.json) stimmen alle sechs
  Fälle. [Bild vorher](before-bitmap.png), [Bild nachher](after-bitmap.png).
  Die Probe ist ein ergänzender Renderertest, keine neue Produktansicht.
- [Zehn Szenen-/Exportregressionen](tests.log) bestanden, ebenso beide TypeScript-
  Prüfungen und der Desktopbuild.

- [Native Hauptatlas-Wiederholung](main-atlas.json): 80 km, 6 km, 1,2 km,
  300 m und geneigte Hauptkamera, anschließend PNG speichern und unveränderte
  Landschaftszeilen frisch lesen. Normaler Exit 0, PID beendet, keine
  Rendererfehler. [Vorher](before-region.png) ragen die Waldpunkte in die
  Freifläche; [nachher](after-region.png) folgen sie dem Waldumriss.
  [Geneigter Hauptatlas](tilted.png). Quellstand war `7072c46b027d6650ab95bf6e26c665b86213b240`
  mit der lokalen Texturkorrektur; Quell- und Artefakthashes sind enthalten.

## Folgekorrektur: automatischer Bewuchs in PNG

Der visuelle Exportvergleich zeigte zusätzlich, dass die perspektivische
Ausgabe sämtliche Landschaftsraster verwarf. Bei dichten Bereichen liegen die
automatischen Bäume jedoch in Objektkacheln. Im [Zwischenstand](export-gap.png)
blieb deshalb allein der geschützte Einzelbaum sichtbar.

Die Ausgabe übernimmt jetzt Kacheln mit `content=objects`; den Boden liefert
weiterhin die Terrainprojektion. Der [Exporttest](../../../tests/atlas-terrain-export.test.mjs)
prüft Wald-/Wegkacheln, Weltpositionen und unveränderte Quellen sowie Ablehnung
unvollständiger Layer und gewechselter Quellenzäune.

Die [erneute Hauptatlas-Probe](export-native.json) speichert über den normalen
Ausgabedialog. Die rechte Bildhälfte, außerhalb des geschützten Einzelbaums,
enthält jetzt 24.961 dunkle Bewuchspixel statt vorher 0. Die
[PNG danach](export-fixed.png) wurde zusätzlich visuell geprüft. Normaler
Exit 0, PID beendet, keine Rendererfehler, unveränderte Landschaftszeilen beim
frischen Lesen. Geprüfter Basiscommit `fff2daa7982de8b43261212570e5484189b1d83b`
mit lokaler Exportkorrektur; Quell- und Artefakthashes sind beigefügt.

**Verbleibende Grenze:** Die Ausgabe verwendet bei dieser dichten Szene noch
Rasterpunkte statt der im Fenster sichtbaren räumlichen Einzelkronen. Sie
verliert den Bestand nicht mehr vollständig, erreicht aber noch keine gleiche
Detaildarstellung. Rasterauflösung, Kronenform, Waldtextur und stufenloser
Informationswechsel bleiben offen. Keine Paket- oder Nutzerabnahme, keine
abgeschlossene Gesamtprüfung.
