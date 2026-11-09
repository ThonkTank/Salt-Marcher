# Aktueller Stand

Stand: 9. November 2026. Atlas V7 bleibt der reguläre Produkteinstieg mit
Dateiformat 22; der optionale Electron-/Pixi-Höheneditor verwendet Format 24.
[README](../../README.md) enthält Befehle, [Architektur](../architecture.md)
Zuständigkeiten und [Produktvertrag](../product-contract.md) Verhalten und Grenzen.
[PR #1469](https://github.com/ThonkTank/Salt-Marcher/pull/1469) bleibt Draft.

## Ergebnis und Auftragsgrenze

**Die vier Besitzer und die feste numerische Stufenbasis sind umgesetzt und
inhaltlich geprüft. Die Großpinselabnahme bleibt offen.** Dokument, Eingabe,
Darstellung und Projektsitzung teilen ein Änderungsjournal. Der Renderer hält
jetzt eine Basis über gleichstufige Gesten und Undo hinweg; ein Neuaufbau nach
jeweils 32 Gestentransaktionen entfällt. Die kubische Projektion verwendet einen
horizontalen Zwischenpass und berechnet anschließend die vertikalen Beiträge.

Im unveränderten Softwarevergleich sinkt die Offscreen-Komposition auf dichtem
22-Stufen-Gelände vom zuletzt veröffentlichten Stand mit **35,9–39,4 ms auf
23,1–23,7 ms Median je Terrain-Draw**. Alle sechs instrumentierten Pinselprozesse
bleiben nun unter 50 ms p95 bis zum Submit. Der normale lange 512-Pixel-Strich
besteht mit **39,5 ms p95 und 56,3 ms maximaler Bewegungspause**.

Die kurzen 512er-Gesten sind trotzdem nicht zuverlässig: Von 300 angeforderten
Versuchen werden **15 ausgeführt**, bevor alle drei Gruppen an einer fehlenden
Endpunktwirkung abbrechen. Eine zusätzliche Serie auf dichtem Gelände bricht
nach **53/100** ab. Die letzten Bewegungen werden wegen noch ausstehender
Rückkopplung beim Up nicht mehr angenommen. Hier sind weder Basisneuaufbau noch
Paketaufteilung die Ursache. Nachträgliches Malen oder andere Grenzwerte werden
nicht als Reparatur verwendet.

**P0 ist nicht freigegeben.** Ein natives Display und qualifizierte Hardwaremessung
fehlen; zusätzlich ist die Zuordnung zur ersten tatsächlichen Präsentation
unbewiesen. GPU-Abschluss, CPU-Submit und Bildschirmpräsentation bleiben getrennt.
Der vollständige Atlas-Neubau und das spätere Landschafts-/Hausbeispiel behalten
das bestehende native P0-Gate. Dieser Auftrag aktiviert nicht den vollständigen
P0–P9-Neubau.

## Implementierter Stand

- `EditorDocument` besitzt Autoren, History und das einzige Pendingjournal.
  History und Pending teilen unveränderliche Vorher-/Nachherbilder; nur die
  exakte Quittung des ältesten Eintrags gibt dessen Retry- und Projektionsdaten frei.
- `ProjectSession` besitzt einen Writer, Dateiabläufe, Savedmetadaten und Recovery.
  `EditorController` hält Eingabe, einen aktuellen Quellenbedarf und einen
  Readzustand. Die zweite Schreibsammlung und zusätzliche Nachladeflags entfallen.
- `HeightField` berechnet `H_basis + (C_aktuell − C_basis)`. Die Basis enthält
  Gesamthöhe und damaligen Beitrag derselben Autorenstufe. Gleichstufige Gesten
  und Undo verwenden sie weiter. Deltaatlas, geliehene Gestenanker und synthetische
  History-Gesten im Renderer entfallen.
- Ein warmer Stufenwechsel übernimmt gültiges H und projiziert nur den neuen
  Beitrag. Fehlerbudget und tatsächliche Übernahmetiefe bleiben erhalten;
  höchstens 32 warme Übernahmen führen zum kanonischen Neuaufbau. Unsichere Werte
  behalten den kanonischen GPU-/Float64-Pfad. Die numerische Zulassung ist eine
  konservative Schutzregel, kein universeller GLSL-Fehlerbeweis.
- Quellenresidenz, Änderungen an Übersichten und nicht residente History-Patches
  entwerten die betroffene Basis korrekt. Tatsächliche Änderungsrechtecke erhalten
  unveränderte Kacheln. Die lokale Freigabe prüft zusätzlich eine monotone
  Vorbereitungskennung im passenden GPU-Fence; ein alter Abschluss genügt nicht.
- Die separable Projektion berechnet benötigte Viererzeilen einmal. Numerik und
  Farbe bleiben getrennt; Produktbudgets sind unverändert. Die RGBA32F-Ziele
  kosten zusammen 512 KiB je Kachel, bei 96 Kacheln 48 MiB, zusätzlich zum
  variablen Zwischenraster und den übrigen gezählten Ressourcen.
- Die echte GPU-Prüfung fand einen reservierten GLSL-Bezeichner und einen
  unzureichenden Pixi-Blendzustand. Beide sind korrigiert; eine Regression verwendet
  echte Pixi-Mesh-/RenderGroup-/MeshPipe-Logik. Console-Shaderfehler werden mitgesammelt.
- Der V7-Resize-Test wartet zuerst auf zusammenpassende CSS-/Canvas-Dimensionen.
  Die anschließenden Kamera-, Weltmittelpunkt- und Revisionsprüfungen bleiben streng.

Halten, langsam/stärker, Kurven, höchstens 50 ms je Dosis, Überlastabwurf,
freigegebene kurze Down/Up- und Move/Up-Eingaben, History und Dateiabschluss bleiben
im Produktvertrag unverändert. Beobachtungsabfragen treiben keine Vorbereitung an.

## Verifikation des integrierten Kandidaten

| Prüfung                        | Ergebnis                                                                                                                                          |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| JavaScript                     | **855 Tests in 54 Dateien bestanden.** Fünf V7-Transporttests mangels Cargo nicht gestartet; der lokale Gesamtbefehl bleibt deshalb rot.          |
| TypeScript / Format            | Vollständige Typprüfung, Tool-Typprüfung, P0-Build, repositoryweites Prettier und Diffprüfung bestanden. Rustprüfungen benötigen die CI-Umgebung. |
| Electron-/SQLite-/Fixturetests | **15/15 bestanden.**                                                                                                                              |
| Desktop / Fehler / Datei       | **83/83 bestanden**, einschließlich Save/Discard/Cancel, Wiederherstellung und Prozessneustart.                                                   |
| GPU-Inhalt                     | **5/5 Fälle, 9/9 Ansichten, 182/182 Aktionen, 28/28 Live-Checkpoints bestanden.**                                                                 |
| Normale Interaktionen          | **20/20 Funktionschecks und 5/5 Fehler-/Erholungskontrollen bestanden.** Langer 512er-Zeitlauf innerhalb beider Zeitgrenzen.                      |
| Grafikmatrix                   | **9/9 vollständige Diagnosefälle**, alle sechs Submit-p95 unter 50 ms; **5/6 strenge Liveurteile** bestanden.                                     |
| Kurze 512er-Serie              | **FAIL: 15/300 ausgeführt; 12/15 Endpunktbilder, 15/15 Undo, 7/15 Liveurteile bestanden.**                                                        |
| Dichte 22-Stufen-Kurzserie     | **FAIL: 53/100 ausgeführt; 52/53 Endpunktbilder, 53/53 Undo, 38/53 Liveurteile bestanden.**                                                       |
| Quellen-/Residenzskalierung    | **32 / 1.024 / 9.000 Kacheln bestanden**, einschließlich Inhalt, grob/fein, Undo/Redo, Speichern und Neustart.                                    |
| Native Vorprüfung              | **BLOCKED / Exit 2:** `NO_NATIVE_DISPLAY`, `NATIVE_PRESENTATION_MAPPING_UNPROVEN`; keine Fixtures, kein Programmstart, keine technischen Fehler.  |

Die GPU-Wechselkette umfasst 106 Transaktionen mit 1.992.192 Deltasamples sowie
späteren 1.310.720 kanonischen Samples und 80 kanonischen Basisaufbauten. Die
anschließenden **64 gleichstufigen Transaktionen** enthalten 51.805.600 Deltasamples;
im vollständigen späteren Ereignisfenster einschließlich Zwischenarbeiten bleiben
kanonische Samples, Basis-Capture-Samples und kanonische Basisaufbauten jeweils **null**.
Die exakte Übernahmegrenze wird zusätzlich gezielt geprüft.

CPU-Referenz, Pixel und gespeicherte Autoren stimmen auch bei Level 0/Power 3,
Level 1/Power 4 sowie nach Kontextwiederherstellung. Alle fünf Projektquellen bleiben
unverändert. Das ist kein bitgleicher Readback sämtlicher GPU-Zwischenwerte.

## Grafik und Ressourcen

Drei frische Prozesse je Fall, Electron 44.10.2, 1440 × 960, DPR 1,
ANGLE/Vulkan mit SwiftShader. Unverändert: 101 Positionen, 24-ms-Abstände,
512 Pixel, 4.000 Fuß/Sekunde. Instrumentierung kann Laufzeiten beeinflussen.

| Maß; Bereich der drei Wiederholungen             | Letzter veröffentlichter Stand | Aktueller Kandidat |
| ------------------------------------------------ | -----------------------------: | -----------------: |
| Einfache Karte: Offscreen-Median je Terrain-Draw |                   37,0–38,2 ms |       22,9–23,3 ms |
| 22 Stufen: Offscreen-Median je Terrain-Draw      |                   35,9–39,4 ms |       23,1–23,7 ms |
| 22 Stufen: Offscreen-p95 je Terrain-Draw         |                   40,3–43,9 ms |       28,1–29,7 ms |
| Einfache Karte: Eingabe → Submit p95             |                   53,8–58,4 ms |       38,5–43,7 ms |
| 22 Stufen: Eingabe → Submit p95                  |                   53,4–57,4 ms |       42,9–44,3 ms |
| Einfache Karte: gezählte GPU-Ressourcen          |                28.331.456 Byte |    49.564.608 Byte |
| 22 Stufen: gezählte GPU-Ressourcen               |                54.611.392 Byte |    67.898.304 Byte |

Alle sechs warmen Striche haben null kanonische Samples und null Basisaufnahmen;
alle Inhalte und Undo-Kontrollen bestehen. Ein einfacher Lauf verfehlt das
Liveurteil mit 106,7 ms maximaler Bewegungspause und einem beim Up verworfenen Move.
Die übrigen fünf bleiben bei 56,9–71,3 ms. Die drei statischen Kontrollen benötigen
null Komposition und Uploads; ihre Canvas-Mediane liegen bei 17,5–18,5 ms.
24.987 Timerabfragen sind 528 Frames vollständig zugeordnet, ohne Drops,
Disjoint oder Truncation.

Die größte Skalierungsfixture enthält 294.912.000 Byte Autoren. Am geprüften
Endzustand hält der Renderer 11.272.192 Byte Quellen und 83.702.528 Byte
GPU-Ressourcen. Der grobe Eingriff benötigt in keiner Größe zusätzliche Reads.
Alle drei Fälle haben null ausstehende Uploadbytes und null sichtbare Kacheln in
der Queue, aber noch 16 nicht neu komponierte Cachekacheln. Der geprüfte lokale
Bereich ist bereit und GPU-abgeschlossen. Dies ist kein Nullbefund sämtlicher
Cachearbeit; sichtbarer Zustand, Inhalt und Budgets bestehen.

Der grobe Level-9-Eingriff aktiviert weiterhin den konservativen Float64-Fallback
wegen winziger Randkoeffizienten unterhalb des sicheren skalierten GPU-Bereichs.
Am Endzustand sind in allen drei Größen 96 Fallbackkacheln und 3.407.872 kumulierte
Fallbacksamples gezählt. Die Skalierung belegt daher Quellenbegrenzung, Inhalt
und Persistenz, keine Beschleunigung dieses Grobpinsels durch die feste Basis.

## Verbleibende kurze Endbewegung

Die drei kurzen Küstengruppen brechen nach 3, 3 und 9 Versuchen ab.
Alle 15 Versuche haben zwei Submits vor Up und erfüllen die 100-ms-Kontinuität;
die Gruppen-p95 liegen bei 39,1 / 36,2 / 39,1 ms. Acht beim Up verworfene
Moveinputs erklären die acht roten Liveurteile. Die drei Inhaltsabbrüche
ändern den Endpunkt nicht: 24 Fuß vorher/nachher, Delta null.

Alle 30 angenommenen Dosen werden vollständig in je einem Paket eingereicht.
Es gibt weder kanonischen Neuaufbau, Basisaufnahme, Fallback noch ausstehende
Komposition oder Uploads in diesen Draws. Die zweite GPU-Rückmeldung wird bei den
Abbrüchen erst 9,1–19,8 ms nach Up beobachtet; Endbewegung und Up erreichen den
Handler unmittelbar nacheinander. Eine Endpunktdosis wird nicht angenommen.
Das ist kein Verlust einer bereits angenommenen Modelländerung.

Die zusätzliche dichte Serie bestätigt dieselbe Grenze nach 53 Versuchen:
107 angenommene Dosen jeweils in einem vollständigen Paket, weiterhin null
kanonische Arbeit und Basisaufnahmen, aber 15 beim Up verworfene Moves und ein
wirklich unveränderter Endpunkt. Ihre Submit-p95 von 36,6 ms und maximale
Bewegungspause von 72,2 ms ersetzen diesen Inhaltsbefund nicht.

Die normale lange Probe hat 77 angenommene und 24 ausdrücklich verworfene
Editinputs, 51 Liveframes und keine Pointerup-Verwerfung. Ihr logischer Abschluss
nach 1,1 ms ist kein Grafikabschluss: Der letzte Fence wird erst 42,5 ms nach Up
beobachtet. Zeiten bis zur Fence-Abfrage sind keine isolierten Shaderzeiten.
Der nächste P0-Nachweis benötigt denselben kurzen und langen Verlauf auf
qualifizierter Hardware sowie eine belastbare Präsentationszuordnung.

## Identität und Belege

Sauberer gemessener Produktbuild: `f196f99c5d1e888c84190f725ab691c9d6e25b16`,
`dirty: false`. Produktquellhash:
`ddc867acd33effd222cb8214a6d757134406ab852226e1efe047a3f4ead63148`.
Lockhash: `b471b4a1da63f4226f95a28b60f3345aa03e51803f0ef1982624cd16a2d35bc2`.
Die spätere Diagnose-/Statuspflege verändert keine Produktquellen.

Belege: `src-tauri/target/diagnostics/separable-20261109/basis-final/`, insbesondere
`tests-fixed.log`, `store.log`, `smoke/`, `gpu-fixed/`, `interactions/`, `warm512/`,
`graphics-complete/`, `scaling/` und `native/`. Die Zusatzserie liegt daneben unter
`dense22-basis/`. Referenzvergleich: `structure-20261109/graphics-final/`.

Der fehlgeschlagene GPU-Vorlauf `gpu/` bleibt erhalten. Ebenso bleibt die erste
Grafikmatrix `graphics/` sichtbar: Ein Fall erreichte die alte Diagnosegrenze von
4.096 Timerabfragen und wurde korrekt als unvollständig verworfen. Die vollständige
Matrix verwendet eine begrenzte Kapazität von 32.768; tatsächlicher Überlauf bleibt
rot. Die Grenzfall- und Overflowprüfung erhält alle Draws und gibt alle Queries frei.
Produktbudgets, Eingaben und Abnahmegrenzen sind unverändert.

Erforderlicher Repositoryjob: **Candidate · exact-SHA aggregate** für den
veröffentlichten Head. Sein aktueller Zustand und die Zuordnung zum geprüften
Quellbaum stehen im PR. Installierte RPM-Bedienabnahme, qualifizierte Hardwaremessung
und native Leistungsfreigabe bleiben offen.
