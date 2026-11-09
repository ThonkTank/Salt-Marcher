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

**R1 ist umgesetzt; C1 ist für R2 ausgewählt. P0 bleibt nicht freigegeben.**
Der aktive Editor wurde durch diese Auswahlprüfung nicht auf die neue Regel
umgestellt. Endpunktverlust bei kurzen Großpinselgesten, normaler CPU-Fallback
und native Leistungs-/Paketabnahme bleiben offen. R2–R5 sind nicht implementiert.

C0 wurde an einem kleinen, vor dem Gegenvergleich festgelegten Fall widerlegt:
Radius 20, Rate 1, Stufe 0; A=(20,20) → B=(60,20) → A → B bei
0/20/40/70 ms, Up bei B, GPU-Rückmeldung erst bei 200 ms. Nur vier Punkte in
derselben Autorenkachel. Am Mittelpunkt erzeugt schon der reine C0-Wegauftrag
0,0533203125 Fuß; erlaubt sind höchstens 0,05 Fuß angewandte **plus reservierte**
unquittierte Wirkung. Weniger Zeitannahme oder feinere Belege lösen das nicht.
Die vollständige Eingabe und Stärkeanker wurden für C1 beibehalten.

C1 erhält deshalb je Stützstelle eine einmalige räumliche Mindestwirkung und
rechnet sie auf die kumulierte Zeitwirkung an: `V = max(F, T)`.
Halten und langsamere Züge vertiefen weiter; wiederholte Nullzeitbesuche stapeln
keine neuen Mindestimpulse. Dies ist die ausdrücklich gewählte D10-Änderung,
keine behauptete Gleichheit mit C0. Der Anfangsklick bleibt 1/60 Sekunde der
festen Rate. Die Normalzeitreferenz, der 50-%-Klickanker und alle Zeitbudgets
wurden nicht abgeschwächt.

Die Bereinigung vor R2 entfernt ungenutzte C0-Zeit-/Rekonstruktionsausgaben und
veraltete Stempelrest-Vorgaben; der räumliche Gegenbeweis bleibt ausführbar.
Testeingaben und Prüfpositionen sind vor dem Kandidatenlauf unveränderlich
festgelegt, die unabhängigen Sollwerte stehen vorher fest. Ein terminales
Eingabefenster verlangt ausdrücklich das tatsächliche Up-Sample, auch ohne
Positionsänderung. Leere Endfenster werden abgewiesen; verspätete Handler
erzeugen keine zusätzliche Haltezeit.

**Nächster Umsetzungsschritt ist R2:** Den ausgewählten C1 in einen vollständigen
Höhenweg integrieren: lokale D11-/Quellenprüfung, Reservierung vor Annahme,
begrenzte Fortsetzung nach Up, ein vollständiger Undo-/Save-Abschluss und
nachweislich passende Render-Receipts. Dabei die bestehenden Besitzer erhalten.
Das isolierte Auswahlmodell darf keine zweite Autorenautorität werden.
R3 begrenzt danach beziehungsweise gemeinsam damit den Renderpfad; R4 prüft
Ergebnistakt und Hardwarekosten. Erst ein positives R4 erlaubt die nötigen
P1/P2-Erweiterungen für den gemeinsamen P3-Fall/R5. P4–P9 bleiben gesperrt.

## R1: Umsetzung und Nachweis dieses Standes

| Kriterium                       | Umsetzung                                                                                                                                               | Nachweis                                                                                                                                                                                                                    | Status                        |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| Festes Eingabeverhalten         | `brush.ts`: vollständige Polylinie, kausale Uhr, gleiche/verspätete Zeitstempel, proportionaler Zeitverfall, terminaler Endpunkt und 128-Punkte-Grenze. | Analytische Gruppen, 30/60/120-Hz-Zustellung, RAF-Phasen, Up ohne letzten Move, Halten bis 120 mit Move110/Up115 und späte Geometrie über eine Sekundengrenze.                                                              | Verifiziert im reinen Modell. |
| Begrenzte Wirkung               | `BrushReservations` zählt angewandte und reservierte Beiträge gemeinsam; `PrepaidBrush` erhält Mindest-/Zeitkonto über Quittungen hinweg.               | Gleiche Kachel A/B, falsche/alte/doppelte Receipts, ausstehende Materialisierung, Zeitverfall ohne Replay; exakte Kapazität und ein Eintrag darüber. Positive Splinegewichte übertragen die Stützstellenschranke auf Höhen. | Verifiziert im reinen Modell. |
| Unabhängiger Sollinhalt         | `atlas-p0-brush-reference.mjs` importiert keinen Produktcode; eigene Quadratur, Pfadmaxima und kubische Rekonstruktion.                                 | Tatsächliche Kandidatenkoeffizienten und daraus rekonstruierte Höhen: Klick, zwei Haltedauern, Gerade, Ecken, Schleife, Umkehr, Wiederbesuche, Null-/Negativrate und alle 22 Stufen.                                        | Verifiziert.                  |
| Entscheidender Inhaltsauswerter | `evaluateC1StrokeContent` prüft jede Region, räumliche Mindestwirkung und vollständige Einsekundenfenster einschließlich Anrechnung.                    | 20 neue Fehlerkontrollen im vorhandenen Auswertertest; fehlende Mitte/Ecke/Ende, falsche Abkürzung, zu wenig/zu viel Wirkung, fehlende/nichtendliche Werte und inkonsistente Fenstersummen scheitern.                       | Verifiziert.                  |
| Begründete Auswahl              | C0-Widerspruch reproduzierbar; genau ein C1 behebt ihn bei denselben Eingaben.                                                                          | C1-Vergleich über 153 Autorenpositionen ohne Zwischenquittung; zusätzliche unabhängige Inhalts- und Kapazitätsprüfungen. C0 bleibt nur als negative Referenz.                                                               | C1 für R2 gewählt.            |

Die R1-Prüfung umfasst **495/495 P0-JavaScript-Tests in 16 Dateien**, darunter
alle 129 Auswertertests, sowie die vollständige TypeScript- und Tool-Typprüfung,
den P0-Build, Prettier und die Diffprüfung.
Die bisherigen aktiven Controller-, History-, Datei- und Rendererregeln bleiben
weiterhin geprüft. Relevante Quellen, Tests und Dokumente gehören zum selben
versionierten Stand; die Rohprotokolle liegen unter
`src-tauri/target/diagnostics/r1-selection-20261109/`.

Die neuen Modelle sind vom aktiven Controller nicht aufgerufen. C1 hält zwei
Float64-Konten pro Stützstelle; bei 100.000 Stellen sind das 1.600.000 Byte.
Diese sind in die gemeinsamen höchstens 32 MiB Reservierungs-/Receiptpuffer
eingerechnet. Hinzu kommt begrenzter JavaScript-Verwaltungsaufwand, dessen
Laufzeit und Gesamt-Heap hier nicht gemessen wurden. Keine neue Aussage zu
CPU-/GPU-Zeit, 20-ms-Ergebnistakt, nativer Präsentation oder installierter RPM.
Die tatsächlichen Quellen-/Renderbelege und die gemeinsamen Abschlussbarrieren
müssen erst R2 herstellen. Auch ein kurzer Anfang ohne zusätzliche Zeitwirkung
während des vorausbezahlten Klickanteils bleibt Teil der unveränderten R4-Abnahme.

Für den veröffentlichten Head gilt der verpflichtende Check
**Candidate · exact-SHA aggregate** auf [PR #1469](https://github.com/ThonkTank/Salt-Marcher/pull/1469/checks).
Das historische grüne Gate der Produktbasis unten wird nicht auf spätere Commits
übertragen. Ein neuer CI-Status ist jeweils gegen den exakten Head zu lesen.

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
