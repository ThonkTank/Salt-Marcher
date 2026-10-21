# Hauptatlas mit gemeinsamer Kamera und Stadtobjekten

Lokale native Teilqualifikation vom 20.10.2026. Ausgangscommit `5d91cedda0b08c3c54fef086ada0fc4a75a72580` mit den im folgenden Implementierungscommit gesicherten Änderungen. Die einzelnen Resultate tragen Quell- und Bundlehashes; `source-hashes.json` bindet den abschließenden Implementierungsstand. Keine Paketinstallation, Main-Integration oder Ownerabnahme.

## Beobachtete Abläufe

- [Raumbearbeitung](room/result.json): normale Raum- und Objektauswahl bei 30° Neigung und 25° Drehung; Raumzug, Eckpunktänderung, Undo/Redo, senkrechtes Ausrichten auf demselben Canvas und erneutes Öffnen mit exakt gespeicherter Geometrie. Beide nativen Prozesse endeten mit Code 0. Diese Raumprobe entstand vor der zusätzlichen Fehlersperre und den abschließenden Farbkorrekturen; sie ist kein Beleg für diese späteren Änderungen.
- [Stadt und Grafikrecovery](city/result.json): zwölf Häuser und Straße unmittelbar auf der Landschaft, senkrecht und bei 45° Neigung. Das absichtlich magentafarbene historische Dokumentpapier erzeugt in beiden GPU-Bildern **0 Papierpixel**, während Dächer und Landschaft sichtbar bleiben. Ein Werkzeugwechsel behält die Kamera. Echter `WEBGL_lose_context`-Verlust führt einmalig zum bedienbaren Canvaspfad; Neuzeichnen startet keine Wiederholung. Der ausdrückliche Wiederanlauf stellt die Hauptkamera wieder her. Normaler Prozessabschluss Code 0.

Die diagonale dünne Linie im Stadtbild gehört zum eingeschalteten gemeinsamen Hexraster. Die Gebäude sind eine bewusst einfache funktionale Prüfanordnung, keine gestalterische Referenzstadt.

[Geländeoperationen auf der Hauptfläche](terrain/result.json) sind ebenfalls nativ erneut bestanden: Absenken, Glätten, Farbe/Entfernen, Undo/Redo, Pan/Zoom, Kameraausrichtung, gefilterte Wissensansicht und frisches Öffnen.

## Reproduktion

```sh
npm run build:desktop
QA_EVIDENCE_DIR=.build/atlas-main-check python3 tools/ui-session.py timeout --signal=TERM --kill-after=10s 300s node tools/test-desktop-atlas-main-camera.mjs
```

`--city-only` prüft die Stadt samt Grafikrecovery ohne erneute Raumoperationen. Alle Profile liegen auf Disk unter `~/.cache/saltmarcher/ui-profiles/`. Fehlversuche bleiben im lokalen `.build` erhalten: veralteter Werkzeugselektor, erwartetes Snapping, Seed-Command-ID, nicht eindeutige Stadtsuche und falsch benannter Canvas-Bereitschaftsstatus wurden als Probenfehler korrigiert; sie zählen nicht als Erfolge.

Die automatisierten Gegenproben liegen in `tests/atlas-spatial-scene.test.mjs`, `tests/desktop-atlas-canvas.test.mjs`, `tests/desktop-atlas-tool-hierarchy.test.mjs`, `tests/desktop-atlas-paint.test.mjs` und `tests/desktop-atlas-regions.test.mjs`. Insbesondere der dichte Stadtraster bleibt zwischen Objekten transparent.

## Offen

Die gemeinsame Fläche ist angeschlossen, aber das Gesamtprodukt bleibt in Arbeit: Gebäudevolumen und Geschossarbeitsebenen, kachelbasierte Detailstufen, scharfe Küsten, vollständige kartografische Beschriftung, schnelle große Terrainoperationen sowie gemeinsame Ausgabe/Spielerprojektion. Bei Wissensmaskierung bleibt der gefilterte Canvaspfad maßgeblich. Die alten Stadt-Dokumentmaße beeinflussen noch die räumliche Vorauswahl und werden als nächste Altlast entfernt.
