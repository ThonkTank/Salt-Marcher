# Aktueller Stand

Stand: 9. November 2026. R4 baut auf R3-Checkpoint
`cd755d58d7c254880aab8c1f1a9e76bcd245c5c7` auf.
Atlas V7 bleibt der reguläre Einstieg mit Dateiformat 22; der optionale
Electron-/Pixi-Höheneditor verwendet Format 24.
[README](../../README.md) enthält Befehle, [Architektur](../architecture.md)
Zuständigkeiten und [Produktvertrag](../product-contract.md) Verhalten und Grenzen.
[PR #1469](https://github.com/ThonkTank/Salt-Marcher/pull/1469) bleibt Draft;
der [Neubauplan](atlas-rebuild-plan.md) bleibt der einzige Ausführungsplan.

## Übergabe

**Der R4-Prüfpfad ist integriert. Das Richtungsurteil ist FAIL; R5 und weiterer
Werkzeugausbau sind nicht freigegeben.** Ein normaler zehnsekündiger Haltefall
erzeugt während der Eingabe keine neue Terrain-Einreichung und erreicht am
Zentrum nur etwa 0,5 Prozent der unabhängigen Referenzwirkung. Die Ursache liegt
vor der GPU in der wiederholt verworfenen Übersichtsvorbereitung.

Die native Leistungsabnahme ist zusätzlich BLOCKED: Diese Umgebung besitzt
keine native Anzeige/GPU, und der vorhandene Beobachtungsweg qualifiziert keine
Zeitintervalle tatsächlich sichtbarer geänderter Terrainbilder. Softwareläufe
ersetzen diese Belege nicht. Fehlende Hardware macht den nachgewiesenen
funktionalen Fehler nicht zu einem bloßen Umgebungsblocker.

## Umgesetzter Prüfpfad

| Kriterium                             | Umsetzung und Beleg                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Feste Auswahl                         | `p0:direction` verwendet den vorhandenen Runner mit zwölf Fällen in zwei frischen Prozessgruppen. Kurze Fälle verlangen je 30 Gesten, Kurve/Halten mindestens zehn Sekunden. `--only`, `--case`, `--runs` und eine verkleinerte R4-Abnahme sind ausgeschlossen.                                                                                                                        |
| Normale Wirkung und vollständiger Weg | Feste Eingaben und Autorenstützstellen werden unabhängig rekonstruiert. Echte Autorenwerte, C1-Mindest-/Zeitkonten, Abschluss und Undo sind an das rohe Session-/Gestenjournal gebunden. Ungekappte normale Zeitwirkung muss mindestens 90 Prozent erreichen, auch nach Regionen und ganzen Sekunden. Unzureichende zeitliche Auflösung bleibt BLOCKED.                                |
| Reale Ausgangslagen                   | Separater erster lokal freigegebener Klick nach Navigation; normale Wege verlangen vorhandene Bereitschaft der ganzen Spur. Weitere definierte Fälle enthalten Stufenwechsel, Undo, wirklich laufendes Save sowie dieselbe lokale Bearbeitung bei 32/1.024/9.000 Quellen. Dichte Fixtures enthalten alle 22 Autorenstufen.                                                             |
| CPU, Vorbereitung und Ressourcen      | Ein gemeinsames Urteil prüft tatsächliche RAF-Arbeit einschließlich zusätzlicher Annahme-/Beobachtungsarbeit, Vorbereitung, Uploads, Slots und reservierte Ressourcen. Es gibt keine Mittelung über unterschiedliche Normalfälle.                                                                                                                                                      |
| Vollständige GPU-Pakete               | Optionale asynchrone Queries umfassen alle GL-Mutatoren bis zum bestehenden Produkt-Fence, auch Allokation, Upload, Kopien und vorgezogene Freigaben. Das tatsächliche WebGLSync bindet Query und Produktpaket an dieselbe eindeutige Fence-ID. Ein gemeinsamer Mapper prüft vollständige Einmalzuordnung und Reihenfolge; keine zusätzlichen Fences oder synchronen GPU-Warteaufrufe. |
| Fehlerschließende Entscheidung        | Verlorene Eingabe, schwache Wirkung und gemessene Budgetfehler bleiben FAIL. Fehlende Stichproben, Hardware oder sichtbare Zeitbelege werden nicht grün. Nach dem entscheidenden Fehler stoppt der Lauf; nicht ausgeführte Fälle bleiben erhalten und spätere große Fixtures werden nicht erzeugt.                                                                                     |

Die Produktänderungen dienen ausschließlich der begrenzten, ausdrücklich
aktivierten Diagnose. Quellenmathematik, Eingabeprogramm, C1-Reservierungen,
50-ms-Wirkungsreserve und Arbeitsbudgets wurden nicht verändert. Der normale
Start greift auf keinen GPU-Diagnosehook zu.

## Entscheidender Normalfall

`R4-small-L4-hold` verwendet einen 16-Pixel-Pinsel auf Autorenstufe 4,
Kamera-Scale 0,01 und 4.000 Fuß/s für mindestens zehn Sekunden.
Der frische Lauf am endgültigen Build hält 10,0096 Sekunden. Alle zehn
vollständigen Sekundenfenster verfehlen die unabhängige Inhaltsreferenz;
es gibt dabei keine unqualifizierten Inhaltsintervalle.

| Direkt beobachteter Wert                                           | Ergebnis                                   |
| ------------------------------------------------------------------ | ------------------------------------------ |
| Annahmen insgesamt                                                 | 603                                        |
| Materialisierungen / Frames während des Haltens                    | 601 / 601                                  |
| Terrain-Pakete / Draws / eingefrorene Aufträge während des Haltens | 0 / 0 / 0                                  |
| Vorbereitungen an der 128-Schritte-Grenze                          | 597 von 601                                |
| Veröffentlichte Renderer-Quellen während des Haltens               | durchgehend 0                              |
| Zentrum vorher / nachher / nach Undo                               | 0 / 200 / 0                                |
| Unabhängige Referenz am Zentrum                                    | 40.038,4                                   |
| Erreichte normale Wirkung                                          | 0,4995 Prozent statt mindestens 90 Prozent |

Die erste Brush-Submission erscheint erst rund 365 ms nach Up. Die 602
später zugeordneten Brush-Submissions sind keine fortlaufenden sichtbaren
Aktualisierungen während der Geste. Das Journal verliert keine Ereignisse.
Auch die korrigierte GPU-Messung dieses Laufs ist vollständig: 82 Queries
gehören eindeutig zu 41 Terrain- und 41 Scene-Paketen; null unzugeordnete
Queries. Die Software-Terrainzeit liegt bei p95 10,39 ms und maximal 21,66 ms.

Die Codeursache ist klar abgrenzbar: Der Controller materialisiert vor
`prepareFrame()` die nächste Änderung. Dadurch steigt die Version derselben
wartenden Übersicht. `drainSources()` verwirft ihren begonnenen Generator
bei Versionswechsel. Bei vier beteiligten Patches braucht
`prepareOverview()` bereits ohne vorhandene Basis mindestens
`4 × (1 + 16) + 64 + 1 = 133` Generatoraufrufe; ein RAF darf höchstens
128 Schritte ausführen. Vor seiner Fortsetzung kommt die nächste Version.
Mit vorhandener Basis kommen weitere 64 Kopierschritte hinzu.

Offene Übersichten verhindern Quellenveröffentlichung und das Einfrieren des
lokalen Renderauftrags; auch der Hintergrundweg wartet. Ohne Renderbeleg wird
die lokale Wirkungsreserve nicht freigegeben. Sie beträgt hier
`4.000 × 0,05 = 200` Fuß. Der überwiegende Zeitanteil wird deshalb verworfen,
während kleine Randänderungen weiterhin neue Revisionen erzeugen.

Die Versionsabbrüche besitzen keinen eigenen Ereigniszähler. Diese Ursache
ist eine Codeableitung aus der Ausführungsreihenfolge und der harten
133/128-Schranke, gestützt durch die beobachteten Vorbereitungsdurchläufe und
fehlenden Veröffentlichungen. Eine schnellere GPU beseitigt diese Schranke nicht.

## Tatsächliche Läufe und Grenzen

- **Fester R4-Laborlauf am endgültigen Build: FAIL, Exit 1.** Die ersten
  30 lokal freigegebenen Klicks bestehen sämtlich die unabhängige Inhaltsprüfung.
  Alle 30 GPU-Fenster sind gültig: 905 Queries entsprechen 439 Terrain-
  und 466 Scene-Paketen, einschließlich 29 Arbeitsintervallen vor dem
  CPU-Paketmarker. Es gibt keine unzugeordnete Query mehr.
  Input→Submit liegt insgesamt bei p95 166,7 ms statt höchstens 50 ms;
  das größte Terrainpaket benötigt 15,05 ms statt höchstens 4 ms.
  Das sind Softwarewerte. Der Runner stoppt nach diesem roten Fall; die
  übrigen 23 geplanten Fälle bleiben ausdrücklich nicht ausgeführt.
- **Native R4-Vorprüfung: BLOCKED, Exit 2.** Alle 24 geplanten Fälle bleiben
  im Index; Sammlung und Fixtureerzeugung beginnen nicht.
  Native Anzeige, qualifizierter sichtbarer Ergebnistakt und Hardware-
  Referenzprofil fehlen. Es gibt keinen Laufzeitfehler.
- **Begrenzter erneuter Haltefall:** bestätigt den oben beschriebenen
  funktionalen Fehler am selben Build. Ein einzelner Diagnoselauf ersetzt
  weder die zwei unabhängigen Prozessgruppen noch die feste Gesamtmatrix.

Die früheren begrenzten Inhaltsdiagnosen bestanden beim ersten freigegebenen
L0-Klick, beim normalen L0-Weg, bei dichtem L4 nach Undo und bei L9 knapp über
0,01 nach Stufenwechsel. Der L21-Weltfall erreichte an einer geprüften
Stützstelle 200 statt etwa 230,055, also rund 86,94 Prozent. Das sind einzelne
Softwarediagnosen, keine vollständigen R4-Stichproben und keine Hardwareabnahme.

Die zunächst verwendete rein zeitliche GPU-Zuordnung verwarf bei 28 von
30 Klickfenstern vollständige Queries, weil GL-Freigaben vor dem protokollierten
Paketbeginn lagen. Diese Messlücke wurde durch die Bindung an das echte
Fence-Objekt geschlossen. Der gesamte Vorlauf zählt weiterhin; alte ungebundene
Rohdaten werden nicht nachträglich als qualifizierte Pakete umgedeutet.

## Verifikation am endgültigen Stand

- **728/728 Editor-Tests in 22 Dateien bestanden**, einschließlich
  Inhaltsreferenz, Journalbindung, GPU-Fence-Identität, fehlender/mehrfacher
  Zuordnung, vollständigem GL-Vorlauf, Ruhezustand und Fehlerisolation.
- Vollständige TypeScript-Typprüfung, Tool-Typprüfung und frischer
  P0-Desktop-Build bestanden.
- **120/120 reale Electron-Desktop-/Lifecycleprüfungen am endgültigen Build
  bestanden.** Vollständige Restarbeit, Undo/Redo, Save/Reopen sowie
  Cancel/Save/Discard behalten ihre Inhalts- und Abschlussbedingungen.
- Fünf isolierte Manipulationen des endgültigen realen R4-Berichts lösen
  jeweils den zuvor fehlenden zentralen Fehler aus: abgelöste Endwerte,
  geschwächte Materialisierung, fehlender Pfadendpunkt, wiederverwendete PID
  und als Hardware umdeklarierte Software. Jede verweigert R5; anschließend
  liefert das unveränderte Original wieder dasselbe Ergebnis.
- Der vollständige `check:atlas-p0` bestand vor der letzten reinen
  Fence-Diagnosebindung: **15/15 SQLite-/Fixturetests, 120/120 Desktopchecks
  und 6/6 GPU-Referenzfälle**. Dieser Lauf gehört zum vorherigen Produkt-Hash
  `cec93b91539d02f6cd97c2b91a5e75fdcf7836469c5f74589264f34b6280cae3`.
  Die danach betroffenen Typ-, Editor-, Desktop- und R4-Nachweise wurden
  am endgültigen Stand erneut ausgeführt; die Fachmathematik blieb unverändert.
- Formatierung und Diffprüfung bestanden. `check:all`, Rustprüfungen,
  installierte Paketabnahme und native Präsentation sind damit nicht
  als vollständig bestanden ausgewiesen.

Der abschließende Build verwendet Node 24.22.1 und Electron 44.10.2.
Produktquellhash:
`66d56d12581e542651205e735a46328dbb2ccdf3b06c2080a54d5766dbd491b0`.
Der Build entstand mit lokalen Änderungen auf R3-Checkpoint `cd755d5`;
der endgültige Produktinhalt wurde vor Veröffentlichung mit diesem Hash
abgeglichen. Dokumentation und Prüfscripts gehören nicht zu diesem Produkt-Hash;
die R4-Berichte halten ihre eigene Harness-Identität fest.

Endstandslogs liegen unter
`src-tauri/target/diagnostics/r4-final-verified/`,
R4-Bericht und zentrale Manipulationskontrollen unter
`src-tauri/target/diagnostics/r4-fence-direction/`,
die native Vorprüfung unter
`src-tauri/target/diagnostics/r4-fence-hardware/`
und der erneute Haltefall samt Bauidentität und Rohjournal unter
`src-tauri/target/diagnostics/r4-hold-fence-identity/`.
Der abschließende Smoke-Report liegt unter
`artifacts/atlas-rebuild/smoke-2026-11-09T23-11-20.842Z/report.json`.
Frühere Rohbelege bleiben unverändert.

Für den veröffentlichten Head gilt **Candidate · exact-SHA aggregate** auf
[PR #1469](https://github.com/ThonkTank/Salt-Marcher/pull/1469/checks).
Ein historischer grüner Check wird nicht auf diesen Commit übertragen.

## Nächste begrenzte Korrekturentscheidung

Den unveränderlichen Autorenstand und seinen Effektbeleg vor Beginn der
mehrteiligen Übersichtsableitung binden. Spätere Patches müssen sich begrenzt
im Nachfolger sammeln, ohne den begonnenen Auftrag wieder zu entwerten.
Quittierung bleibt an die vollständige Darstellung genau dieses Standes gebunden.

Diese Korrektur ist noch nicht umgesetzt. Zuerst muss derselbe Haltefall
vollständigen fortlaufenden Renderfortschritt und mindestens 90 Prozent
Referenzwirkung nachweisen. Anschließend ist dieselbe feste R4-Matrix mit
qualifiziertem Hardware-/Sichtbarkeitsnachweis erforderlich. Das Schrittlimit,
die Inhaltsreferenz und die Zeitziele bleiben unverändert; R5/P3 beginnen erst
nach einer positiven Richtungsentscheidung.
