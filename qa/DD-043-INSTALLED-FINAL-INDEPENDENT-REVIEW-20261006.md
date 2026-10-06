# DD-043.01/.23: unabhängige Prüfung des installierten Teilpakets

6. Oktober 2026. Ausschließlich vorhandene Dateien gelesen; kein GUI, Build, Produkt- oder Vault-Edit. Grundlage: Installationsmanifest `qa/releases/dd043-minimal-20261006/installation-manifest.json`, die beiden Läufe unter `qa/dd043-minimal-installed-host/evidence/1791291787919-dd043-minimal-edit` und `1791291799388-dd043-minimal-reopen` sowie die V2-Proben unter `qa/dd043-minimal-installed-v2/evidence/1791291829822-v2-open-edit` und `1791291842603-v2-open-reopen`. Alle Pfade beziehen sich auf `/home/aaron/.cache/dungeon-native-qa/implementation-20261005/`.

## Unabhängig nachgeprüft

- Das Manifest nennt genau 17 Installationspfade. Ihre aktuellen Dateien im produktiven Plugin stimmen sämtlich mit den `after`-SHA-256-Werten überein. `main.js` hat SHA-256 `064bebec8543a534dcfea223d82c886e10543bff9c99b7cb53ef82fa95041c23`; derselbe Hash steht in beiden isolierten Hostkopien und ihren `build.json`-Dateien. Das Manifest belegt den geplanten Dateisatz; diese Prüfung liest keine frühere Plugin-Gesamtaufnahme erneut ein.
- Alle 93 Einträge in `protected-before.sha256` stimmen beim erneuten Lesen im Nutzervault bytegenau. Darunter ist `acceptance.json`.
- Installierter Host: Edit und frischer Hostprozess melden je `passed=true`, keine Fehler und drei `pass`-Records. Beide erzeugten PNGs sind bytegleich, SHA-256 `4b30519df9f47b6b7ead54a46012fd61714983dceda75ad14982f955de279e2c`, 2048 × 2048 Pixel. Die aufgezeichnete Baufläche und das Raster erreichen den unteren rechten Kartenbereich (`contentDifference=350`, `gridDifference=32`).
- Beide produktiven V2-Karten wurden nur als isolierte Kopien im echten Obsidian geöffnet, nach V3 gespeichert und in einem frischen Prozess erneut geöffnet. Edit und Reopen melden je `passed=true`, `errors=[]`; beim Speichern änderte sich laut Feldvergleich nur die Versionsangabe. Diese Läufe sind eine Migrationsregression, kein eigener Exportbeleg.

## Fallentscheidung

| Fall | Ergebnis am installierten Stand | Grenze |
| --- | --- | --- |
| DD-043.01 | Im engen Fallumfang **gleichwertig belegt**: Exportmenü öffnet auf gespeicherter Karte den Dialog mit PNG, JPEG, WEBP und Universal VTT; Edit und Frischstart bestanden. | Die tatsächlichen Formatdateien sind andere Unterfälle. |
| DD-043.23 | Im engen Fallumfang **gleichwertig belegt**: sichtbares X schließt vor der Dateiausgabe; null Blob-URLs und Download-Klicks, Kartenhash, Dokument, Dirty-Flag, History und Kamera bleiben gleich; Edit und Frischstart bestanden. | Abbruch nach bereits gestarteter Dateierzeugung wurde nicht gemessen. |
| DD-043.15 | **Weiter offen als ganzer Pflichtfall.** Der Default-Unterfall 8 × 8 Felder bei 256 Pixel/Feld ist am installierten Stand belegt, einschließlich 2048 × 2048 Ausgabe und Inhalt/Raster bis unten rechts. | Der Hostlauf ändert weder Pixel-pro-Feld-Wert noch Grid-Preset oder Crop. Die Wirkung veränderter Dialogwerte beziehungsweise Ausschnitte bleibt laut Fallziel und Original-Lücke zu paaren. Das `pass` im Host-Record gilt daher nur für den Default-Unterfall. |

Kein neuer Installationsblocker für DD-043.01/.23 erkennbar. Die Belege rechtfertigen weder eine volle DD-043-Abnahme noch ein `equal` für DD-043.15.
