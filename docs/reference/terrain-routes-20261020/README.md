# Straßen und Flüsse auf dem Höhenmodell · 20.10.2026

Lokale Implementierung des [beauftragten Verlaufsmodells](../../plans/maps/terrain-routes.md). Die gemeinsame Arbeitskopie enthält außerdem parallel entstandene Gelände-/Bewuchsarbeiten; die unten aufgeführten Quell- und Bundlehashes binden den nativen Lauf an seinen tatsächlich gebauten Stand.

Die spätere [Vorbereitung auf aktuellem Main](main-integration/README.md) dokumentiert den kombinierten Kandidaten und dessen eigene native Nachprüfung.

## Ergebnis und Grenzen

65 betroffene automatisierte Fälle bestanden. Der native Lauf bestand sieben Ablaufprüfungen mit echten Eingaben, ohne Rendererfehler und mit zwei regulär beendeten Electron-Prozessen. Der isolierte Bildvergleich zeigt fünf synthetische Fälle. Typprüfungen, Web-/Desktop-Build und Repository-Prüfung bestanden.

Das ist eine lokale Prüfung. Candidate-CI, Main-Integration, Paketinstallation, Benutzerabnahme und R7-Leistungsziele sind nicht nachgewiesen. Der Bildvergleich ist eine gezielte synthetische Gegenüberstellung ungeplanter Linien und geplanter Verläufe, kein Vergleich mit einem Konkurrenzprodukt und keine vollständige Landschaftsabnahme.

## Sichtbare Belege

- [Straße in Draufsicht](01-road-top.png) und [gekippt](02-road-tilted.png): Pflichtpunkte, Hangtrasse und gemeinsames Profil im Editor.
- [Flussvorschau](03-river-preview.png): fallendes Wasserprofil, Quellverjüngung und Bett. Orange markiert das ausgewählte Objekt.
- [Gemeinsamer gekippter Atlas](04-shared-tilted-atlas.png) und [Geländepinsel über geschütztem Fluss](04b-protected-brush.png).
- [Frischer Prozess](05-fresh-process.png): Wiederöffnung nach regulärem Abschluss.
- [Isolierter Vergleich gekippt](prototype-tilt.png) und [in Draufsicht](prototype-top.png): von oben nach unten Brücke, Fluss, Hangstraße, Tunnel, Furt. Links ungeplante Linien, rechts Profile und verbundene Geländeform. Tunnelportale sind in dieser Kamerarichtung nur seitlich sichtbar.

## Prüfungen

`tests/terrain-route.test.mjs` prüft 12 Modell-/Speicherfälle: Pflichtpunkte, Determinismus und Steigungsgrenzen; fallendes Flussprofil und rückstandslos entfernbares Bett; unzulässiges Gefälle; Mündungsanschlüsse und Zyklen; geschützte Pinselbegrenzung und ungeschützte Konflikte; Brücken/Tunnel; gemeinsame Linien-/Meshgeometrie; Vorschau/Übernahme/Undo/Redo/Löschen/Wiederöffnung; veraltete Schreibversuche; gemeinsame Geländehistory; ferne Weltkoordinaten und Bounds.

Die breitere Regression umfasst diese Datei sowie `terrain-brush`, `terrain-height`, `terrain-spatial`, `terrain-tilted-atlas`, `terrain-tilted-atlas-storage`, `desktop-landscape-tools` und `vegetation-spatial`: [65 Fälle](regression.log).

`tools/test-desktop-terrain-routes.mjs` belegt:

1. Bestehende Straße planen, Draufsicht/gekippt, Read-only-Vorschau und atomare Übernahme.
2. Fluss mit echten Punktklicks setzen, Koordinaten korrigieren und fallendes Profil speichern.
3. Schutz aus- und einschalten und jeweils speichern.
4. Löschen und Atlas-Undo einschließlich Geländeform.
5. Gespeicherte Verläufe im gemeinsamen gekippten Atlas.
6. Echter Höhenpinselzug am geschützten Verlauf; ein Undo stellt Gelände und Profile wieder her.
7. Frischer Prozess mit unveränderten Objekten/Profilen/Schutzwerten.

[Nativer Bericht mit Quell-/Bundlehashes und Prozessabschlüssen](native-result.json), [Ablauflog](native.log), [Prototypbericht](prototype-result.json).

Die native Probe schreibt ausschließlich über Produktaktionen. Direkte SQLite-Lesezugriffe vergleichen Ergebnisse; allein die initiale synthetische Kampagne wird vor dem Appstart aufgebaut. Temporäre Profile liegen unter `~/.cache/saltmarcher/`. Alle GUI-Proben laufen begrenzt durch `tools/ui-session.py`.

Die neuen Testdateien sind im gemeinsamen Capability-Katalog am bestehenden Reiseregion-Ablauf verknüpft und mit `--geprueft` registriert. Diese Prüfung betrifft dessen Straßen-/Flussanteil; sie behauptet keinen neuen vollständigen Hextml-Vergleich und keine Abnahme aller übrigen Teilaufgaben.

## Wiederholung

```sh
node build.mjs --test
node --test --test-concurrency=1 tests/terrain-route.test.mjs tests/terrain-brush.test.mjs tests/terrain-height.test.mjs tests/terrain-spatial.test.mjs tests/terrain-tilted-atlas.test.mjs tests/terrain-tilted-atlas-storage.test.mjs tests/desktop-landscape-tools.test.mjs tests/vegetation-spatial.test.mjs
python3 tools/ui-session.py timeout --signal=TERM 240s node tools/test-desktop-terrain-routes.mjs
python3 tools/ui-session.py timeout --signal=TERM 180s node tools/render-terrain-routes.mjs
npm run check
npm run check:desktop
npm run build
npm run build:desktop
npm run check:repo
```
