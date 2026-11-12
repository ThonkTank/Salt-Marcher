# Aktueller Stand

Stand: 12. November 2026. **Die Oberfläche des optionalen Electron-/Pixi-Editors
ist weiter an die V7-Bedienung angepasst: einheitliche Werkzeugpanels, native
Regler mit genauer Werteingabe und übersichtlichere Eigenschaften.** Die zuvor
auf dem Vorschauzweig veröffentlichte Land-/Meer-Änderung `51a379f` ist vollständig
enthalten. Der Fachstand bleibt P3.3; diese Überarbeitung aktiviert keinen
weiteren Neubau-Planschritt. [PR #1469](https://github.com/ThonkTank/Salt-Marcher/pull/1469)
bleibt Draft.

## Ergebnis und Verhalten

- Pinselgrößen, Höhenrate, Küstenrauheit, Landschaftsdichte, Hausbreite/-tiefe,
  Drehung und Fundamentparameter verwenden ein gemeinsames Reglerformat mit
  sichtbarem Wert und Einheit. Höhenrate und Hausmaße sind logarithmisch
  verteilt, damit auch kleine Werte erreichbar bleiben.
- Ein Klick auf den Wert öffnet eine genaue Eingabe mit Punkt oder Komma.
  Enter/Blur übernimmt gültige Werte; Escape oder eine leere Eingabe erhält
  den vorherigen Wert. Ungültige Eingaben zeigen einen lokalen Fehler.
  Koordinaten bleiben direkte Zahlenfelder.
- Pinsel- und Landschaftseinstellungen werden während der Bedienung wirksam.
  Hausregler halten einen lokalen Entwurf und übernehmen ihn einmal beim
  Loslassen beziehungsweise Abschluss der Tastenbedienung. Eine veränderte
  ausgewählte Hausgeometrie bleibt eine Undo-Aktion; Escape verwirft den Entwurf.
- Alle Werkzeuge verwenden denselben Titel- und Feldaufbau. Abmessungen und
  Fundament sind getrennt. Ohne Hausauswahl erscheint ein echter Leerzustand.
  Nebeninformationen sind einklappbar; Gewässerbestand und neue Ableitungswarnungen
  öffnen den zugehörigen Bereich. Die Karte erhält wechselnde kurze Bedienhinweise.
- Einheitliche SVG-Symbole und kurze Werkzeugnamen vermeiden uneinheitliche
  Text-/Emoji-Icons. Auch bei 900 × 620 Pixeln bleiben Beschriftungen vollständig
  und die Karte nutzbar. Fokusmarkierungen und native Regler-Tastaturbedienung
  sind vorhanden.
- Nah-, Regions- und Weltansicht ändern nur den Maßstab am aktuellen Mittelpunkt.
  Nicht übernommene X-/Y-Eingaben beeinflussen diese Ansichtswahl nicht.
  Die bestehende Kamera und der vorhandene Navigationspfad bleiben zuständig.
- Land/Meer einschließlich runder/gekräuselter Küste, Moduserinnerung und
  Größen-Gesten bleiben erhalten. Die Küstenrauheit verwendet ebenfalls den
  gemeinsamen Regler. Die unterschiedlichen Escape-Regeln von Höhen/Küste und
  Landschaft stehen in der jeweiligen Hilfe.

## Nachweis am endgültigen Produktstand

Produktquellhash (`product-inputs-v1`):

`72e603e62eb44b35ca49340ad355e3dd3d7372adb4762ab96cd7fc11af3f4fbf`

Der Hash wurde aus den endgültigen Produktdateien unabhängig neu berechnet;
Desktopbuild und beide nativen Prüfberichte enthalten genau diesen Stand.
Die Prüfungen verwenden echtes Electron, Pixi und SQLite mit Softwaregrafik.
Der Entwicklungsbuild trägt den damaligen Zwischencommit mit `dirty: true`;
der Quellhash bindet die Nachweise an den abschließend versionierten Inhalt.

| Prüfung                                                    | Ergebnis                                                                          |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `npm run typecheck` und `npm run build:atlas-p0`           | PASS                                                                              |
| Gemeinsamer Controller, Gesten und Writer                  | **49/49 PASS**                                                                    |
| Native Bedienoberfläche                                    | **87/87 PASS**                                                                    |
| Normaler Desktop-Smoke                                     | **121/121 PASS**: Start/Datei 13, Küste 18, Landschaft 35, Häuser 29, Gewässer 26 |
| Visuelle Prüfung                                           | Höhen-, Küsten- und Hauspanel sowie Desktop-/900-×-620-Ansicht geprüft            |
| Format geänderter Code-/Testdateien und `git diff --check` | PASS                                                                              |

Die UI-Prüfung bedient echte Regler per Maus und Tastatur, prüft Grenzen und
logarithmische Werte, genaue Eingabe, Abbruch und ungültige Werte. Sie kontrolliert
unveränderte Dokumente bei Werkzeugeinstellungen, eine Hausänderung pro Drag
mit Undo/Redo, den erhaltenen Kartenausschnitt, Größen-Gesten, tatsächliche
Höhenwirkung, Speichern und das bestehende Updatefenster.

Der normale Smoke ergänzt echte Land-/Wasserpixel, lange Landschaftsstriche,
Haus-/Fundamentänderungen, kalte Rückkehr nach Navigation und unabhängig
geprüfte Dateirundläufe bis zum frischen Prozess. Die Testhelfer bedienen die
neue genaue Werteingabe und trennen Koordinatensprünge ausdrücklich von der
Ansichtswahl. Bestehende Inhalts-, Zeit- und History-Erwartungen wurden nicht
abgesenkt. Nachweise liegen ignoriert unter
`src-tauri/target/diagnostics/ui-refinement/ui-verified/` und `normal-verified/`.

## Vorschau und offene Abnahmen

Die lokale UI- und Funktionsabnahme ist abgeschlossen. Ein Paket-/Releasebeleg
für diese UI-Änderung wird erst nach erfolgreichem Abschluss des vorhandenen
Vorschauworkflows behauptet. Dessen Paketprüfung enthält dieselben UI- und
normalen Smoke-Fälle; Veröffentlichung und Updatekanal bleiben unverändert.

Die letzte vollständige Höhen-GPU-Referenzreihe aus P3.2 bleibt historisch
**FAIL, 3/6**. R4-Halten, native Hardware-/Eingabelatenzabnahme, der frühere
Electron-Live-Feedfehler und eine tatsächliche Fedora-DNF-/Polkit-Installation
werden durch diese UI-Prüfung nicht neu abgenommen. Sie ersetzt keinen
vollständigen Repository-/V7-Baseline-Lauf. Der nächste Fachschritt bleibt
**P3.4 „Echte Fachkonkurrenz“** im einzigen [Neubauplan](atlas-rebuild-plan.md).
