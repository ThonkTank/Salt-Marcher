# Aktueller Stand

Stand: 9. November 2026. Atlas V7 bleibt der reguläre Produkteinstieg mit
Dateiformat 22; der optionale Electron-/Pixi-Höheneditor verwendet Format 24.
[README](../../README.md) enthält Befehle, [Architektur](../architecture.md)
Zuständigkeiten und [Produktvertrag](../product-contract.md) Verhalten und Grenzen.
[PR #1469](https://github.com/ThonkTank/Salt-Marcher/pull/1469) bleibt Draft.

## Ergebnis und Auftragsgrenze

Der beauftragte numerische GPU-Renderweg für den Großpinsel ist implementiert.
Der gewöhnliche Höhenpfad überträgt geänderte Koeffizienten und numerische
Übersichten; die GPU rekonstruiert daraus beibehaltene Farbkacheln. Der bisherige
CPU-Rasterworker, seine Aufträge/Antworten und die zugehörige Diagnose sind entfernt.

**Die Rendererumstellung ist umgesetzt; die Großpinsel-Abnahme bleibt FAIL.**
Alle drei unveränderten kurzen 512-Pixel-Proben scheitern im verfügbaren
SwiftShader-Labor an Inhalt, Livewirkung oder Zeitgrenzen. Der lange Verlauf
zeigt tatsächliche Terrainänderungen, verfehlt aber ebenfalls den Zeitvertrag.
Die native Abnahme bleibt zusätzlich blockiert. P0 ist nicht freigegeben;
P1/P2/P3 und der vollständige F01–F19-Umfang behalten ihr bestehendes Gate.

## Implementierter Stand

- `EditorDocument` bleibt alleiniger Besitzer der Float64-Autoren. Der begrenzte
  GPU-Atlas enthält abgeleitete Kopien samt kubischem Nachbarrand. High-/Low-Paare
  bewahren Koeffizienten, Achsengewichte und Übersichten über alle 22 Stufen.
- Der Shader berechnet geänderte 128×128-Farbkacheln. Kamera, Cursor und Overlay
  verwenden die vorhandenen GPU-Farbkacheln. Die CPU berechnet die unveränderten
  kubischen Achsengewichte einmal; gewöhnliche Pinseländerungen erzeugen keine
  CPU-RGBA-Rasterbilder. Endliche numerische Ausnahmefälle behalten den kanonischen
  Float64-Rasterweg für die betroffenen Darstellungskacheln.
- Speicherallokation und tatsächliche Uploads sind getrennt. Auch kalte Texturen
  und Wiederherstellungen halten das 4-MiB-Uploadbudget je Frame ein. Fehlgeschlagene
  Uploads bleiben wiederholbar. Kontextverlust entwertet sämtliche Bildbelege;
  erneute Übertragung und Komposition müssen vor einer neuen lokalen Freigabe bestehen.
- Der bestehende Controller besitzt weiterhin den Frameablauf und den einzigen
  Pinselanker. Lokale Freigabe folgt einem tatsächlichen Draw. Dosis entsteht
  höchstens für 50 ms je Folgeschritt; blockierte Zeit und Wege werden verworfen.
  Loslassen fügt keine neue Dosis hinzu. Undo und Persistenz verwenden dieselben Autoren.
- Die gemeinsame Darstellung stabilisiert die Farbgrenzen bei 0 und 12 Fuß mit
  einem Band von `1e-6` Fuß. Modellwerte, genaue Abfragen und Dateidaten bleiben
  unverändert. Beliebig nahe an einer Bandgrenze ist keine Bitgleichheit versprochen.

Aktuelle Berichte verwenden Schema 4. `height-draw` verbindet numerischen Upload
und tatsächlichen Draw mit Session, Ansicht, Revision und Frame. Alte Rasterzeiten
werden nicht als GPU-Zeiten umgedeutet. Auswerter und Zeitzerlegung teilen dieselben
Belege. Die drei neuen Großpinsel-/Stufenprüfungen sind Pflichtbestandteile;
fehlende, doppelte oder fehlgeschlagene Ergebnisse werden abgelehnt.

## Verifikation

| Prüfung                                                     | Ergebnis                                                                                                                                                                                          |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Editor-, Modell-, Controller-, Renderer- und Auswertertests | **314 Tests in zwölf Dateien bestanden.**                                                                                                                                                         |
| Allgemeine TypeScript-Prüfung und Tool-Typen                | Beide bestanden.                                                                                                                                                                                  |
| `npm run check:atlas-p0`                                    | Sauberer Build; **15** echte Electron-/SQLite-/Fixturetests, **83** Start-/Hänger-/Lifecyclechecks und **fünf** GPU-Referenzfälle bestanden.                                                      |
| GPU-Inhalt                                                  | Küsten-/Kachelgrenzen, alle 22 Stufen, große gewöhnliche Auslöschung ohne CPU-Fallback, Weltrand und extreme endliche Auslöschung mit Fallback bestanden.                                         |
| Echter WebGL-Kontextverlust                                 | Freigabe verloren, Ressourcen neu aufgebaut, neues Bild eingereicht; vollständige Canvas-PNG, Pixelproben, Autorenhash und Projektdatei unverändert.                                              |
| Reale Interaktionen                                         | **18 von 19** Funktionsprüfungen bestanden. Der lange Großpinsel scheitert am Zeit-/Kontinuitätsvertrag; dessen Inhalt, History, Dosis und Stallbilanz bestehen.                                  |
| Fehlerkontrollen                                            | Ignorierter Zoom, Darstellung erst nach Pointerup, Verzögerung und verworfener Draw werden erkannt. Die abschließende ungestörte Erholungsprobe verfehlt die Zeit-/Eingabekriterien; siehe unten. |
| Skalierung                                                  | **32, 1.024 und 9.000** echte Quellkacheln bestanden, einschließlich Grob-/Feinerhalt, Undo/Redo, Save/Reopen und Prozessneustart.                                                                |
| Unveränderter warmer 512-Pixel-Fall                         | **Drei unabhängige kurze Proben: alle FAIL.**                                                                                                                                                     |
| Native Vorprüfung                                           | **BLOCKED / Exit 2**; keine Fixtures oder Programmstarts.                                                                                                                                         |

Der große Skalierungsfall enthält 294.912.000 dekodierte Autorenbytes und
überschreitet damit tatsächlich das 256-MiB-Quellenbudget. Im groben Ausschnitt
werden diese feinen Autoren nicht geladen. Nach dem groben Eingriff halten
Dokument und Renderer jeweils vier Autorenkacheln mit 131.072 Bytes;
der GPU-Bestand beträgt rund 10,4 MiB. Die gespeicherten feinen Daten bleiben
identisch. Nach Rückkehr in die Detailansicht beträgt der Rendererbestand
rund 21,8 MiB CPU und 17,0 MiB GPU und bleibt innerhalb der Grenzen.

## Unveränderte Großpinsel-Abnahme

Die kurzen Proben verwenden jeweils vier Positionen, 24-ms-Eingabeabstände und
512 Pixel Durchmesser. Umgebung: Electron 44.10.2, 1.440 × 960, DPR 1,
ANGLE/Vulkan mit SwiftShader. Alle Ergebnisse bleiben erhalten.

| Probe | Down → Submit | Größter angenommener Input einschließlich Up → Submit | Aktuelle Eingabeframes vor Release | Inhalt einschließlich Endpunkt | Ergebnis |
| ----- | ------------: | ----------------------------------------------------: | ---------------------------------: | ------------------------------ | -------- |
| 1     |       12,5 ms |                                               65,9 ms |                                  1 | Bestanden                      | FAIL     |
| 2     |       13,5 ms |                                               22,7 ms |                                  2 | Endpunkt nicht belegt          | FAIL     |
| 3     |       23,6 ms |                                               76,2 ms |                                  2 | Endpunkt nicht belegt          | FAIL     |

Die D10-Zeitbilanz und begrenzte Dosis bestehen in allen drei Proben. Eine
abgewiesene letzte Bewegung wird nicht nach Release nachgemalt. Zwei Liveframes
allein ersetzen weder den Endpunkt- noch den Zeitnachweis.

Der zusätzliche 2,424-s-Verlauf verwendet 101 Positionen und dieselben
24-ms-Abstände. Im letzten ungestörten Zeitlauf liegen **36** aktuelle
Eingabeframes vor Release vor. Die 38 angenommenen Eingabe-/Up-Belege erreichen
**109,1 ms p95**, maximal **121,4 ms** bis zur Zeicheneinreichung; die längste
bewertete Bewegungspause beträgt **133,4 ms**. Damit sind sowohl 50 ms als auch
die 100-ms-Pausengrenze verfehlt. Das sind Submission-Untergrenzen einer
Laborprobe, keine native Präsentationsmessung oder vollständige P0-Stichprobe.

Der getrennte Inhaltslauf zeigt frühen, mittleren und späten Terrainfortschritt
während derselben gehaltenen Geste. Nach einem tatsächlichen 207-ms-Stall werden
159,1 ms verworfen; kein Folgeschritt nimmt mehr als 50 ms an oder zeichnet einen
alten gedeckelten Weg nach. Längeres Halten, langsameres Ziehen, fehlende Nachdosis,
Undo/Redo und die Stufenfolge 0 → 4 → 0 bestehen.

Auch die abschließende ungestörte Erholungsprobe mit 16-Pixel-Pinsel bleibt im
letzten Lauf **FAIL**: eine angenommene Bewegung benötigt 62,7 ms, die letzte
Bewegung wird bei Pointerup verworfen. Die vorherige integrierte Probe desselben
Produktquellstands hatte diese Kontrolle bestanden. Der Fehler wird nicht durch
einen ausgewählten erfolgreichen Wiederholungslauf ersetzt.

## Inhaltsaufnahme und Präsentationsgrenze

`capturePage` kann nach einem vollständigen GL-Submit noch die vorherige
Compositoroberfläche liefern. Eine gezielte Probe zeigte alte Farben nach der
letzten Dosis und anschließend korrekte Farben bei unveränderten Modellwerten.
Der dazwischenliegende Overlayframe übertrug keine Daten und komponierte keine
Höhenkacheln. Dieser Befund ist in den Diagnoseartefakten erhalten.

Ausschließlich die ungestörte Stufen-/Undo-/Redo-Inhaltsprobe wartet deshalb nach
vollständigem Submit zwei RAF-Gelegenheiten. Session, Revision, Sequenz, Ansicht,
Kamera und beendete Geste müssen dabei unverändert bleiben; alle echten Pixel-
und Höhenvergleiche bleiben verpflichtend. Diese Phase wird ausdrücklich als
Inhaltsstabilisierung protokolliert. Warm512, Langzug, Fehlerkontrollen und
sämtliche Zeitmessungen erhalten keine zusätzliche Wartezeit.

Die native Vorprüfung nennt `NO_NATIVE_DISPLAY` und
`NATIVE_PRESENTATION_MAPPING_UNPROVEN`. Die Bindung des tatsächlichen Karteninhalts
an seine erste Präsentation bleibt offen. Eine qualifizierte GPU-Messung und
diese Präsentationszuordnung sind vor der nativen Freigabe notwendig.
Die bekannten Laborfehler bleiben bis zu einer begründeten Lösung Fehler;
die Umstellung allein belegt keine ausreichende Beschleunigung.

## Identität und Belegpfade

Sauberer Produktbuild: `e31b3f0813816d6088a3eec0e2c055fa5f135032`, `dirty: false`.
Produktquellhash: `d4b93c955c84a6b2aa42f94c711f3753beefd301c45f7e6ac165a256a038b5b4`.
Lockhash: `b471b4a1da63f4226f95a28b60f3345aa03e51803f0ef1982624cd16a2d35bc2`.
Alle genannten Desktopläufe verwenden diesen identischen Produktquellstand.
Der nachfolgende Commit `b76f314` ändert ausschließlich die beschriebene
nicht zeitgemessene Stufenaufnahme; dessen integrierter Lauf ist maßgeblich für die
19 Interaktionsprüfungen und die letzte Erholungsprobe. Produktquellen,
Warm512-Eingaben und Zeitregeln bleiben identisch.

Belege liegen unter:

- `src-tauri/target/diagnostics/gpu-final-unit.log` und `gpu-final-desktop.log`;
- `src-tauri/target/diagnostics/atlas-gpu-reference/report.json`;
- `artifacts/atlas-rebuild/smoke-2026-11-09T01-27-52.736Z/`;
- `artifacts/atlas-rebuild/gpu-final-warm512/` und `gpu-verified-interactions/`;
- `artifacts/atlas-rebuild/gpu-final-scaling/` und `gpu-final-native-preflight/`;
- `src-tauri/target/diagnostics/gpu-stage-capture-journal/`.

Der erforderliche Repositoryjob bleibt **Candidate · exact-SHA aggregate** für
den veröffentlichten Head; sein Zustand steht im PR. Frühere CI-Läufe ersetzen
ihn nicht. Installierte RPM-Bedienabnahme und native Leistungsfreigabe bleiben
eigene offene Kriterien. Der aktuelle Umsetzungsauftrag aktiviert weder den
vollständigen Atlas-Neubau noch dessen spätere Produktpakete.
