# Vorhandene Atlasfläche bei kleinen Kamerabewegungen wiederverwenden

Lokaler Implementierungsstand vom 20.10.2026 auf `6289e0977` mit den in den Ergebnisdateien aufgeführten Quellhashes. Der ausdrücklich eingestellte MapLibre-Vergleich ist kein Bestandteil dieser Änderung. Produktziel und offene Arbeit: [Roadmap](../../plans/maps/unified-spatial-atlas.md).

## Änderung und geprüfter Umfang

Der bestehende Three.js-Atlas hält einen geladenen oder gerade angeforderten Geländeausschnitt während kleiner Zoom-/Panbewegungen fest. Die sichtbare Kamera läuft unabhängig davon weiter. Quellenrevision, Kampagne, Konturen, Überhöhung, Glättungsrand und veränderte Objektquellen invalidieren weiterhin; eine andere Reihenfolge derselben Objekte allein tut dies nicht. Detailgrad, Pixelmaßstab und Abdeckung begrenzen die Wiederverwendung. Identische Kameraaufrufe zeichnen nicht doppelt.

- [Kameraprobe](camera-result.json): tatsächliche Canvaspixel ändern sich bei Neigung bis 75°, Drehung und kleinem Zoom/Pan mit **0 neuen Geländeaufträgen**. Größerer Zoom erzeugt **1 Auftrag**; Zoom und Pan bleiben bei absichtlich zurückgehaltenem Worker sichtbar. Kanonische Höhen bleiben bytegleich.
- [Autorenprobe](author-result.json): sichtbaren Pass absenken, Küste, Undo/Redo, Vorschau verwerfen, Glätten, Bemalen/Löschen, Navigation, Ortsauswahl, Wissensmasken und frisches Öffnen bestehen im nativen Electron-Fenster.
- Beide Prozesse beenden sich normal mit Exitcode 0; keine Rendererfehler und keine zurückbleibenden Prozesse der Probe.
- 21 gezielte Tests bestehen: [Bereichswiederverwendung](../../../tests/terrain-spatial-source.test.mjs), [Perspektive](../../../tests/atlas-perspective-camera.test.mjs), [Geländetreffer](../../../tests/terrain-tilted-atlas.test.mjs), [kanonische Bearbeitung/History](../../../tests/terrain-tilted-atlas-storage.test.mjs). Zusätzlich bestehen Typprüfung, Desktop-Typprüfung, Desktopbuild und Repositoryprüfung.

## Sichtbare Grenzen

[Kontrollbild nach Zoom und Pan](camera-reused-surface.png): Die Navigation verwendet das vorhandene Gelände, Küsten und Relief bleiben jedoch sichtbar weich. Diese Änderung löst weder die Rasterauflösung noch semantische Höhenlinien, Beschriftungsdichte oder das vollständige Kachel-LOD. Der bisherige Wechsel zur Draufsicht für weitere Werkzeuge besteht weiterhin.

Dies ist ein Funktionsbeleg für weniger unnötige Geländeaufträge, keine 60-FPS-, Pinsel-Latenz-, Langzeitspeicher- oder Gesamtproduktabnahme. Die Statuswartezeiten der Autorenprobe sind keine Messung der ersten tatsächlichen Pixeländerung. Candidate-CI, Integration, Paket und Installation wurden für diesen Stand nicht ausgeführt. Die drei geforderten abschließenden Untersuchungen ohne Arbeitsfund sind wegen bekannter offener Arbeit noch nicht begonnen.
