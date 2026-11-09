# Aktueller Stand

Stand: 9. November 2026. Geprüfte Produktbasis:
`96637b0e399fa9da73a73cd8bfb9dd6c8df10ba3`.
Atlas V7 bleibt der reguläre Einstieg mit Dateiformat 22; der optionale
Electron-/Pixi-Höheneditor verwendet Format 24.
[README](../../README.md) enthält Befehle, [Architektur](../architecture.md)
Zuständigkeiten und [Produktvertrag](../product-contract.md) Verhalten und Grenzen.
[PR #1469](https://github.com/ThonkTank/Salt-Marcher/pull/1469) bleibt Draft.
Umsetzungsgrundlage ist der [Neubauplan](atlas-rebuild-plan.md) einschließlich
Testzuordnung im selben versionierten Stand dieser Übergabe auf dem PR-Branch
`work/atlas-p0-feasibility`.

## Übergabe und nächster Schritt

**P0 ist nicht freigegeben.** Die vier Besitzer, das gemeinsame Änderungsjournal,
die feste numerische Stufenbasis und die separable GPU-Projektion sind umgesetzt.
Kurze Großpinselgesten verlieren weiterhin Endpunktwirkung; normale kleine
Koeffizienten können den synchronen CPU-Fallback auslösen. Native Leistungs- und
Paketabnahme bleiben offen. Die Korrektur R1–R5 im
[Neubauplan](atlas-rebuild-plan.md) ist **geplant, noch nicht implementiert**.
Die Planungs- und Vorbereitungsschritte belegen keine neue Produktmessung.

**Nächster Umsetzungsschritt ist R1:** Die einfache Weg-/Zeitreferenz C0 mit festen
Eingaben, Normierung und unabhängiger Inhaltsreferenz prüfen. Analytische Klick-,
Halte- und Geradenfälle, andere Zustellung desselben Wegs, Wiederbesuche sowie
Up-/Überlastfälle müssen die Sollwirkung unabhängig vom Kandidaten bestimmen.
Die alte Freigabe nach einer einzelnen Dosis darf dabei nicht das neue Soll
vorgeben. Genau ein Gegenkandidat C1 mit anderer Dosierungsregel ist nur bei
einem benannten Pflichtfehler zulässig; Auswahl und Szenarien stehen im Plan.

Erst danach folgen der vollständige Höhenweg und die begrenzte Renderarbeit in
R2/R3, dann die Hardware-Richtungsprobe R4. Eine positive Richtungsprobe erlaubt
nur die benötigten P1/P2-Erweiterungen für den gemeinsamen P3-Fall und R5.
P4–P9 bleiben bis zur vollständigen nativen P0- und gemeinsamen P3-Abnahme gesperrt.
Vorbereitungsarbeit allein aktiviert keine Produktimplementierung.

## Geprüfter Bestand

- `EditorDocument` besitzt Autoren, History und das einzige Pendingjournal;
  `ProjectSession` einen Writer, Dateiabläufe, Savedmetadaten und Recovery.
  Der Controller hält Eingabe, einen aktuellen Quellenbedarf und einen Readzustand.
  Lokale Reads bleiben während asynchroner Save-Dateiphasen möglich.
- `HeightField` verwendet `H_basis + (C_aktuell − C_basis)` über gleichstufige
  Gesten und Undo hinweg. Ein kanonischer Neuaufbau folgt spätestens nach
  32 tatsächlichen warmen Basisübernahmen. Die separable Projektion berechnet die benötigten
  Viererzeilen einmal; Numerik und Farbe bleiben getrennt.
- Quellenresidenz, Übersichtspatches, nicht residente Historyänderungen und
  Kontextwiederherstellung erhalten Inhalt und lokale Invalidierung. Die Freigabe
  prüft eine passende Vorbereitungskennung im GPU-Fence. Beobachtungsabfragen
  treiben keine Vorbereitung an.

Der derzeitige Produktvertrag bleibt maßgeblich; geplante Eingabeversiegelung,
reservierte Restarbeit und vollständige lokale Render-Receipts sind noch kein
implementiertes Verhalten.

## Verifikation der Produktbasis

Das Repository-Gate der Produktbasis ist grün:
[Repository baseline · Run 42604271611](https://github.com/ThonkTank/Salt-Marcher/actions/runs/42604271611)
ist für `96637b0` mit `completed/success` abgeschlossen. Dieser Beleg gilt nicht
für spätere Planungs- oder Vorbereitungscommits. Der erforderliche Check bleibt
**Candidate · exact-SHA aggregate** am jeweiligen veröffentlichten Head.

| Bereich                     | Vorhandener Beleg und Grenze                                                                                                                                                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typen und lokale Tests      | Typ-/Tool-Typprüfung, P0-Build, Prettier und Diffprüfung bestanden; 855 JavaScript-Tests in 54 Dateien bestanden. Fünf V7-Transporttests und Rustprüfungen waren lokal mangels Cargo nicht ausgeführt; das Repository-Gate der Basis ist separat oben belegt. |
| Desktop und Dateien         | 15/15 Electron-/SQLite-/Fixturetests und 83/83 Desktop-/Fehler-/Dateifälle bestanden, einschließlich Save/Discard/Cancel, Recovery und Prozessneustart.                                                                                                       |
| GPU-Inhalt                  | 5/5 Fälle, 9/9 Ansichten, 182/182 Aktionen und 28/28 Live-Checkpoints bestanden. CPU-Referenz, Pixel und gespeicherte Autoren stimmen auch bei Level 0/Power 3, Level 1/Power 4 und nach Kontextwiederherstellung überein.                                    |
| Interaktion und Grafik      | 20/20 Funktionschecks, 5/5 Fehler-/Erholungskontrollen und 9/9 vollständige Grafikdiagnosen bestanden; nur 5/6 strenge Liveurteile. Der lange 512-Pixel-Strich erreicht 39,5 ms Input→Submit-p95 und 56,3 ms maximale Bewegungspause.                         |
| Kurze 512er-Gesten          | **FAIL:** 15/300 ausgeführt; 12/15 Endpunktbilder, 15/15 Undo und 7/15 Liveurteile bestanden. Unabhängige Gegenprüfung: Abbruch nach 22/100 Gesten, davon 11 mit bestandenem Liveurteil.                                                                      |
| Dichte 22-Stufen-Kurzserie  | **FAIL:** 53/100 ausgeführt; 52/53 Endpunktbilder, 53/53 Undo und 38/53 Liveurteile bestanden.                                                                                                                                                                |
| Quellen-/Residenzskalierung | 32 / 1.024 / 9.000 Kacheln bestanden, einschließlich Grob/Fein, Undo/Redo, Save und Neustart; der Level-9-Eingriff verwendet weiterhin CPU-Fallback.                                                                                                          |
| Native Vorprüfung           | **BLOCKED / Exit 2:** `NO_NATIVE_DISPLAY`, `NATIVE_PRESENTATION_MAPPING_UNPROVEN`; keine Fixtures oder Programmstarts dieser Vorprüfung.                                                                                                                      |

## Offene Inhalts-, Performance- und Freigabegrenzen

1. **Endpunktverlust:** Der letzte Move wird bei ausstehender Rückmeldung bis Up
   nicht mehr angenommen; der Endpunkt bleibt unverändert. Der deterministische
   Gegenfall scheitert auch, wenn der Fence beim Move offen und beim Up bereits
   fertig ist. Die angenommenen Dosen werden vollständig eingereicht; weder
   Basisneuaufbau noch Paketaufteilung erklären diesen Fehler. R2 muss Eingabeende
   und Abschluss angenommener, reservierter Arbeit gemeinsam korrigieren.
2. **Renderkosten und Fallback:** Vorbereitung erfolgt vor der Budgetauswahl.
   Winzige normale Randkoeffizienten um Kameraskala 0,01 lösen den konservativen
   Float64-Fallback aus. Beim Level-9-Skalierungsfall entstehen 96 Fallbackkacheln
   und 3.407.872 kumulierte Fallbacksamples. R3 muss den normalen GPU-Pfad sowie
   vorab begrenzte Vorbereitung und Grafikpakete nachweisen.
3. **Messgrenze:** Die Grafikwerte stammen aus SwiftShader mit Electron 44.10.2,
   1440 × 960 und DPR 1. Auf dichtem 22-Stufen-Gelände sank der Offscreen-Median
   gegenüber dem Referenzstand von 35,9–39,4 auf 23,1–23,7 ms; alle sechs
   Submit-p95 liegen unter 50 ms. Ein Lauf verfehlt dennoch das Liveurteil mit
   106,7 ms Bewegungspause und einem beim Up verworfenen Move. Diese Softwarewerte
   und grüne Inhaltsprüfungen ersetzen keine native Leistungsfreigabe.
4. **Native Abnahme:** Qualifizierte Hardware, installierte RPM-Bedienabnahme und
   die erste tatsächliche Präsentation sind nicht belegt. GPU-Fence, Submit und
   Bildschirmpräsentation bleiben getrennt. Vollständige Freigabe benötigt den
   Präsentationsnachweis oder eine qualifizierte konservative Deadline gemäß Plan.

Die feste Basis ist durch 64 gleichstufige Transaktionen ohne kanonische Samples,
Basis-Capture oder Basisneuaufbau belegt. Bei 9.000 gespeicherten Kacheln mit
294.912.000 Byte Autoren hält der geprüfte Renderer-Endzustand 11.272.192 Byte
Quellen und 83.702.528 Byte GPU-Ressourcen. Sichtbare Arbeit und Uploads sind
abgeschlossen, aber 16 Cachekacheln noch nicht neu komponiert. Diese Befunde
belegen begrenzte Residenz und korrekten Inhalt, keine Beschleunigung des
Level-9-Fallbacks oder einen vollständigen Leerlauf sämtlicher Cachearbeit.

## Identität und Rohbelege

Der ursprüngliche saubere Messbuild ist
`f196f99c5d1e888c84190f725ab691c9d6e25b16`, `dirty: false`.
Die Gegenprüfung auf Produktbasis `96637b0` verwendet denselben Produktquellhash:
`ddc867acd33effd222cb8214a6d757134406ab852226e1efe047a3f4ead63148`.
Lockhash: `b471b4a1da63f4226f95a28b60f3345aa03e51803f0ef1982624cd16a2d35bc2`.
Die folgenden vorhandenen Verweise bleiben erhalten; ihre historischen Messungen
werden durch diese Übergabe nicht neu ausgeführt oder als neue Ergebnisse gewertet.

- `src-tauri/target/diagnostics/independent-review/`: `short512/`, `input/`,
  `render/` und die Auswerter-Gegenprobe.
- `src-tauri/target/diagnostics/separable-20261109/basis-final/`:
  `tests-fixed.log`, `store.log`, `smoke/`, `gpu-fixed/`, `interactions/`,
  `warm512/`, `graphics-complete/`, `scaling/` und `native/`.
- Zusatzserie: `src-tauri/target/diagnostics/separable-20261109/dense22-basis/`;
  Referenzvergleich: `src-tauri/target/diagnostics/structure-20261109/graphics-final/`.
- Fehlgeschlagene Vorläufe `gpu/` und `graphics/` bleiben unter `basis-final/`
  erhalten. Die erste Grafikmatrix war wegen Timerquery-Überlauf unvollständig;
  die vollständige Matrix und die Overflowkontrolle ersetzen diesen Befund nicht
  rückwirkend. Produktbudgets, Eingaben und Abnahmegrenzen bleiben unverändert.
