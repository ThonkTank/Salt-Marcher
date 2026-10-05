# DD-043: isolierter Rasterdatei-Encoder

`src/features/verwaltung/raster-files.ts` kodiert eine bereits vollständig gerenderte `HTMLCanvasElement`-Zeichenfläche über `toBlob` als PNG, JPEG oder WEBP. Der Baustein zeichnet nicht neu, ändert die Pixelabmessungen nicht und gibt das unveränderte Encoder-Ergebnis samt ursprünglicher Breite und Höhe zurück. Er prüft Format, optionale JPEG-/WEBP-Qualität (0–1), positive Abmessungen, leere Ergebnisse und den tatsächlichen Blob-MIME-Typ. Damit wird die stille PNG-Ersatzausgabe von Chromium bei nicht verfügbarem JPEG/WEBP als Fehler sichtbar.

Bezug zum Original: Die Formate sind in der Dungeondraft-1.2.0.1-Exportoberfläche unter `/home/aaron/.cache/dungeon-native-qa/audit-20261004/karten-verwaltung/dd036-native-20261004-223413/evidence/20-export-modes.png` inventarisiert. Dieses Paket belegt nur die technische Dateikodierung. Der tatsächliche Bildinhalt des Host-Renderers, native Raster-/Licht-/Ebenen-/Crop-Optionen, JPEG-Hintergrund bei Transparenz, Dateinamen und Dateidialog sind weiterhin offen. Ein grafischer Hosttest ist noch nicht erfolgt.

Test: kontrollierte Canvas-Attrappe für alle drei MIME-Typen, unveränderte Dimensionen/Bilddaten, Qualitätsgrenzen, PNG-Fallback, Null-/Leer-Blob, Encoderfehler und Änderung der Zeichengröße während des asynchronen Exports. Die Attrappe ersetzt keinen echten Chromium-Encoderlauf.
