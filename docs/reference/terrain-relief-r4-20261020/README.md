# R4 · Gezeichnetes Relief · 20.10.2026

Die [Roadmap](../../plans/maps/terrain-relief.md) wurde nach der Nutzerentscheidung vom 20.10.2026 angepasst: R3 mit Spezialwerkzeugen und Höhenkartenimport entfällt. Dieses Arbeitspaket verändert die Darstellung der vorhandenen Pinsel-Höhenlandschaft. Es gibt weiterhin genau Land formen, Land bemalen und Glätten.

## Umsetzung und Zielabgleich

| Anforderung | Umsetzung und Nachweis | Stand |
| --- | --- | --- |
| Weiche Schattierung, Grate und hanggerichtete Felsstriche | Gemeinsamer Rasterkern; symmetrische Ableitungen, zurückhaltende konvexe Gratbetonung und weltverankerte Striche. `visual/comparison.html` vergleicht Schattierung, Zeichnung und Analyse. | Implementiert; Bilder beurteilt |
| Flächen ruhig; Steilheit statt Höhe steuert Felsen | Hochfläche bleibt ohne Striche; derselbe steile Hang erhält auch in geringer Höhe Striche. Keine Schnee-/Biomzuweisung. | Automatisiert geprüft |
| Maßstab und Kachelgrenzen | Zwei feste Strichraster werden überblendet. Keine von Kamera oder Kachelursprung abhängigen Zufallsstarts. Bytegleiche Rand-/Ausschnittproben einschließlich negativer Koordinaten und LOD-Grenzprobe. | Automatisiert und nativ in drei Maßstäben geprüft |
| Gemeinsame Palette, Licht und Stärke | Persistiertes Reliefprofil; gezeichnet als Standard, Schattierung oder Höhenfarben optional; Grund-/Strichfarbe, Lichtrichtung und Stärke. Renderer, Vorschau und PNG lesen denselben Vertrag. | Speicher, Undo/Redo, Neustart und Vorschau geprüft |
| R0-Landschaft mit vorhandenen Pinseln | `tools/terrain-relief-scene.mjs` speichert ausschließlich normale Pinselgesten für Küste, verzweigten Gebirgszug, Tal, Pass, Plateau und Glättung. Keine Spezialformen eingeführt. Native Probe ergänzt Fluss, Passstraße und tatsächlichen Ort. | Neun Vergleichsbilder und nativer Ablauf bestanden |
| Lesbarkeit, Küste, Straße und PNG | Beschriftung und Autorenlinien liegen nach der Reliefdarstellung; Felsstriche werden auf Land begrenzt. | Nativ geprüft; PNG und erneutes Öffnen bestanden |

Die bisherige Roughness verwendete periodische Sinusprodukte, die im Stilvergleich ein regelmäßiges Wellen-/Schachbrettmuster erzeugten. Neue Züge verwenden geglättetes deterministisches Rauschen in Weltkoordinaten; positive Modulation, Richtung und Zielgrenzen bleiben erhalten. Bestehende Höhen werden nicht neu berechnet.

## Prüfungen und Grenzen

79/79 betroffene Tests bestanden: `terrain-relief`, `terrain-brush`, `terrain-height`, `desktop-land-color-separation`, `desktop-atlas-canvas`. In der gemeinsamen Arbeitskopie bestanden zusätzlich 23 Fälle aus Relief, Pinsel und Werkzeughierarchie nach Übernahme der eigenen Änderungen unter Erhalt paralleler Vegetationsarbeit. Beide TypeScript-Prüfungen bestanden dort und im isolierten Stand; der isolierte Desktopbuild bestand. Die 23 Fälle überlappen die 79 und werden nicht addiert.

Der erste native Versuch scheiterte an einer verborgenen Checkbox: Das Hexraster befindet sich inzwischen im Menü Ansicht. `native-first-attempt` bewahrt den tatsächlichen Befund. Der korrigierte Ablauf öffnet dieses Menü durch echte Eingaben, bevor er das Raster ausschaltet. Dieser Fehler ist keine Ressourcenblockade und kein erfolgreicher Produktnachweis.

Die Bildzeiten in `visual/renders.json` sind Offline-Rasterzeiten, keine FPS-Messungen oder Pinsel-Latenzqualifikation. Die Testdaten umfassen 66 Höhenkacheln. R7-Leistungsziele, Main/Candidate-CI, Paketierung, Installation und Nutzerabnahme sind offen. R5–R7 bleiben separate Etappen.

## Abschlussprüfung

`native/result.json` enthält vier vollständige Ablaufprüfungen, `ok=true`, `normalExit=true` und keine Rendererfehler. Die Probe öffnet Ansicht → Hexraster, stellt Stil/Licht/Stärke ein, prüft Undo/Redo, drei Maßstäbe, einen echten Höhenpinselzug mit Vorschau/Rücknahme, Höhenlinien, den nativen PNG-Export und einen frischen Electron-Prozess. Höhenbytes, Ortspositionen und gespeichertes Reliefprofil bleiben erhalten. Alle 32 aufgezeichneten Quell-/Bundlehashes wurden nach dem Lauf unverändert bestätigt. Der Prozesswrapper beendete den Lauf regulär; keine eigene Electron-Testinstanz bleibt zurück.

Der Bildvergleich zeigt ruhige Hochflächen, gerichtete Striche an Hängen und lesbare Ortsnamen über dem Relief. Die erste periodische Roughness wurde verworfen; symmetrische Ableitungen mildern außerdem sichtbare Facetten der bilinearen Höhenzellen. Die normalen Autorenpinsel erzeugen alle Landschaftsformen. Die geraden Fluss-/Straßenabschnitte sind absichtlich einfache Autorenlinien und werden durch den Reliefstil nicht umgezeichnet.

R4 ist damit lokal implementiert und auf dem eingefrorenen Stand geprüft. Die eigenen Änderungen wurden in die gemeinsame Arbeitskopie übertragen; zwei Überschneidungen mit parallel hinzugefügten Vegetationsimports beziehungsweise Befehlsrouting wurden unter Erhalt beider Änderungen aufgelöst. Beide Typprüfungen und die 23 betroffenen Tests dort bestanden. Der native Nachweis gilt für den in `verification.json` bezeichneten isolierten Stand; spätere parallele Änderungen sind darin nicht enthalten. R5 ist die nächste eigenständige Phase.
