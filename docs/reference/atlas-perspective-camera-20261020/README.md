# Perspektivische Kamera im vorhandenen Atlas: erster integrierter Schritt

Lokaler Arbeitsstand vom 20.10.2026 auf `codex/unified-spatial-atlas`, aufbauend auf dem bestehenden Atlas. Die [beauftragte Roadmap](../../plans/maps/unified-spatial-atlas.md#beauftragte-umsetzung-vorhandenen-atlas-weiterentwickeln) bleibt insgesamt offen; insbesondere ist keine Engine ausgewählt.

## Änderung

Der vorhandene `TerrainSpatialView` verwendet eine perspektivische Kamera. Die gemeinsame Meterprojektion in `atlas-camera.ts` dient Bildschirmprojektion, Navigation auf der Arbeitsebene und kanonischer Geländeverdeckung. Drehung und Neigung bis 75 Grad verwenden bestehende GPU-Puffer. Die bestehende Atlas-Zoomanimation und Mittelmaustasten-Navigation bewegen die bestätigte Oberfläche auch während der Detailberechnung. Workerantworten erhalten die aktuelle Kamerapose. Ältere orthografische Pinselschnappschüsse bleiben gültig.

Die bestehende Hauptoberfläche, Terrainwerkzeuge, IDs, Main/SQLite-Schreibbefehle und History werden weiterverwendet. Der bisherige Kipp-Einstieg bleibt während dieses Teilanschlusses bestehen. Er ist noch nicht die geforderte gemeinsame Kamera für sämtliche Kartenobjekte und Innenräume.

## Prüfungen

- 17 gezielte Tests bestanden: [Kameraprojektion, tatsächliche Three.js-Raycasts, GPU-Pufferwiederverwendung und Zoomanker](../../../tests/atlas-perspective-camera.test.mjs), [bisherige Projektions-/Verdeckungsfälle](../../../tests/terrain-tilted-atlas.test.mjs), [kanonischer Commit, Vorschau, Undo/Redo und Wiederöffnung für beide Projektionsarten](../../../tests/terrain-tilted-atlas-storage.test.mjs).
- `npm run check`, `npm run check:desktop`, `npm run build:desktop` und `npm run check:repo` bestanden. Keine vollständige Candidate-CI, Integration oder Paketlieferung.
- Native Kameraprobe: [Ergebnis mit Quellenhashes](result.json), [75 Grad](camera-75-degrees.png), [Pan bei ausstehender Detailberechnung](camera-pending-pan.png). Änderungen der tatsächlichen Canvaspixel wurden geprüft; Drehen/Neigen startete keinen Geländeauftrag. Mittelmaustasten-Ziehen im Himmel löste keine 2D-Ersatznavigation aus. Terrain-Workeraufträge wurden anschließend im Prüfprozess zurückgehalten, während Zoom und Pan weiter sichtbar reagierten. Dies ist ein Funktionstest und keine Messung von Eingabe-bis-Pixel-Latenz oder Bildintervallen.
- Bestehender nativer Autorenablauf: [Ergebnis mit Quellenhashes](author-result.json), [abgesenkter Pass](03-lowered.png). Pass absenken, gemeinsame Küste, Undo/Redo, Escape, Glätten, Bemalen/Radieren, Navigation, Auswahl, bestehende Wissensmasken-Sperre und frischer Prozess bestanden. Endprozess mit Code 0 beendet; danach keine Prozesse mit der jeweiligen Probe-Sitzungskennung vorhanden.
- Der Capability-Katalog verknüpft die beiden neuen/erweiterten Testdateien mit dem tatsächlichen R5-Arbeitsablauf und führt die Prüfung mit `--geprueft`. Diese Teilbelege bedeuten keine vollständige R5- oder P1-Abnahme.

## Grenzen und nächste Arbeit

Die Rasteroberfläche bleibt sichtbar unscharf, Linien/Labels sind noch nicht vollständig an die gemeinsame Kamera angeschlossen. Höhenraster und Detailanfragen werden weiterhin ausschnittsbezogen neu berechnet. Im Autorenlauf betrug die beobachtete Wartezeit auf den Vorschau-Status 1.174 ms und ein beobachtetes Warten nach Loslassen 4.931 ms. Diese Statusbeobachtungen unter nicht kontrollierter Hostlast sind keine Pixelmessung und belegen die geforderten Leistungsziele ausdrücklich nicht.

Der MapLibre-Vergleich wurde anschließend auf ausdrücklichen Nutzerwunsch eingestellt; weitere Arbeit verbessert unmittelbar den bestehenden Atlas. Gebäude/Innenräume, vollständige Tiefenbeziehungen, Kachel-LOD, scharfe Kartografie, unmittelbare große Pinsel, gemeinsame Ausgabe und Spieleranzeige sind weitere Roadmapschritte. Der alte Darstellungsweg wird erst nach deren belegter Funktionsdeckung abgelöst.

## Reproduktion

Node.js 22 und vorbereitete Testassets (`node build.mjs --test`). Danach die drei genannten Testdateien mit `node --test --test-concurrency=1 …` ausführen und `npm run build:desktop` bauen.

```sh
python3 tools/ui-session.py timeout --signal=TERM --kill-after=10s 240s node tools/test-desktop-terrain-tilted-atlas.mjs --camera-only
QA_EVIDENCE_DIR=.build/atlas-perspective-author-native python3 tools/ui-session.py timeout --signal=TERM --kill-after=10s 300s node tools/test-desktop-terrain-tilted-atlas.mjs
```

Die Probe nutzt ein eigenes Profil unter `~/.cache/saltmarcher/ui-profiles/`. Auf tatsächliches Prozessende warten, bevor eine weitere Probe beginnt. Keine Nutzerdaten werden geöffnet.
