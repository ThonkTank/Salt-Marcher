# Aktueller Stand

Stand: 12. November 2026. **Land und Meer sind im Höhenwerkzeug des optionalen
Electron-/Pixi-Editors wieder verfügbar**, einschließlich runder und gekräuselter
Küste. Ausgangspunkt dieser Änderung ist `a5ede609` auf dem bestehenden
Draft-PR [#1469](https://github.com/ThonkTank/Salt-Marcher/pull/1469).
Der enthaltene Fachstand bleibt P3.3; die zusätzliche Werkzeugfunktion aktiviert
keinen weiteren Neubau-Planschritt.

## Ergebnis und Verhalten

- Höhen bietet Land, Meer, Anheben und Absenken. Küstenform und Rauheit stehen
  bei Land/Meer anstelle der zeitabhängigen Höhenrate. Moduserinnerung und
  Größen-Gesten gelten für alle vier Modi.
- Land hebt die bearbeitete Basis im Inneren auf mindestens +10 Fuß, Meer senkt
  auf höchstens −10 Fuß. Höhere beziehungsweise tiefere Werte bleiben erhalten.
  Halten und erneutes Übermalen derselben Geometrie verstärken die Küste nicht.
- Der räumliche V7-Auftrag wird in das additive Höhenmodell übersetzt:
  Grundhöhe, gröbere Beiträge und eigener Kontrollwert bestimmen den Zielauftrag.
  Feinere additive Autoren bleiben unverändert und tragen weiterhin zum sichtbaren
  Relief bei. Küstenform, Raster und Radius sind je Strich eingefroren.
- Land/Meer und Landschaft teilen die begrenzte Eingabe, Quellenhaltung und
  den Aktionsabschluss. Höhenpatches, History, geordneter Writer und Dateisnapshot
  bleiben gemeinsam. Ein späterer Fehler nimmt bereits gemalte Küste nicht zurück.
- Der 512-Pixel-Küstenpinsel ist auch an ungünstigen Rasterstufen abgedeckt:
  300.000 Kandidaten pro Batch und ein getrenntes Budget von 400.000 geänderten
  Küstenkontrollen. Das C1-Zeitpinselbudget bleibt bei 100.000. Kachelpuffer und
  die vorhandene regelmäßige Höhenabtastung vermeiden Objekte und erneute
  Punktsampler-Aufbereitung je Kontrollwert.

## Nachweis am aktuellen Produktstand

Der geprüfte Produktquellhash (`product-inputs-v1`) lautet:

`62ef2433878d2405b0e9cd263a2fd14ada91379080ff2f9a05d400526586e327`

Die Desktopprüfungen liefen auf dem daraus gebauten Entwicklungsprogramm mit
echtem Electron, Pixi und SQLite. Der lokale Build trägt noch den Ausgangscommit
und `dirty: true`; der Quellhash bindet ihn an die unten geprüften Produktdateien.
Ein Paket-/Releasebeleg wird daraus nicht abgeleitet.

| Prüfung                                                        | Ergebnis                                                                          |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| TypeScript und `build:atlas-p0`                                | PASS                                                                              |
| Vollständige Editor-Testreihe                                  | **1.053/1.053 PASS**                                                              |
| Darin Küstenmodell                                             | **26/26 PASS**                                                                    |
| Darin gemeinsamer Controller, Gesten und Writer                | **49/49 PASS**                                                                    |
| Echte Werkzeugoberfläche                                       | **66/66 PASS**                                                                    |
| Echte Land-/Meer-Integration                                   | **18/18 PASS**                                                                    |
| Gesamter normaler Desktop-Smoke                                | **121/121 PASS**: Start/Datei 13, Küste 18, Landschaft 35, Häuser 29, Gewässer 26 |
| Format der geänderten Code-/Testdateien und `git diff --check` | PASS                                                                              |

Die Küstenintegration prüft wirkliche Land-/Wasserpixel nach abgeschlossenem
GPU-Frame, positive und negative Kachelgrenzen, den vollständigen Strich in einem
Undo-Schritt, Land und Meer jeweils mit Undo/Redo, unabhängig rekonstruierte
SQLite-Autorenwerte sowie Speichern, Neu/Öffnen und einen normalen Prozessneustart
ohne Diagnosezugriff. Modell- und Controllertests ergänzen unter anderem
Mehrskaligkeit, Kräuselung, Weltgrenzen, Wiederholungen, kalte Quellen,
Dateibarrieren und erhaltene Änderungen nach Projektions-/Budgetfehlern.

Eine isolierte Gegenprobe meldet für bereits gemaltes Land fälschlich weiterhin
−100 Fuß. Der unveränderte zentrale Küsten-Smoke schlägt an der Höhenprüfung fehl,
setzt `passed: false` und endet mit Exitcode 1. Die produktiven Dateien und der
normale Prüfbuild bleiben dabei unverändert.

Detaillierte Belege liegen ignoriert unter
`src-tauri/target/diagnostics/height-land-sea/`: `final-ui/`, `final-coast/`,
`final-normal/` und `negative-control/`. Ein während der Modellüberarbeitung
erzeugter Zwischenbuild scheiterte im vorläufigen Küsten-Smoke; er ist unter
`preliminary-coast/` erhalten und kein Abschlussbeleg. Die Prüfungen oben beziehen
sich auf den anschließend vollständig neu gebauten, identischen Produktstand.

## Vorschau und weiterhin offene Abnahmen

Der bisher veröffentlichte Vorschau-Release ist **0.3.3-43128826913.1** von
[66d3f69](https://github.com/ThonkTank/Salt-Marcher/commit/66d3f6904e75347bad8579e5a8a17decd6650701).
Er enthält die vorausgehende Landschaftskorrektur. Änderungen am Vorschauzweig
starten den vorhandenen RPM-/ZIP-Prüf- und Veröffentlichungsworkflow; ein neuer
Release wird erst nach dessen erfolgreichem Abschluss als verfügbar bezeichnet.

Die letzte vollständige Höhen-GPU-Referenzreihe aus P3.2 bleibt historisch
**FAIL, 3/6**. R4-Halten, native Hardware-/Eingabelatenzabnahme, der frühere
Electron-Live-Feedfehler `net::ERR_EMPTY_RESPONSE` und eine tatsächliche
Fedora-DNF-/Polkit-Installation werden durch diese Funktionsprüfung nicht neu
abgenommen. Die gemeinsame Editorprüfung ersetzt auch keinen vollständigen
Repository-/V7-Baseline-Lauf.

Der nächste Fachschritt bleibt **P3.4 „Echte Fachkonkurrenz“** im einzigen
[Neubauplan](atlas-rebuild-plan.md).
