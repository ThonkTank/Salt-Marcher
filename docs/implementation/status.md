# Aktueller Stand

Stand: 10. November 2026. Ausgangspunkt dieser Übergabebereinigung ist
[R4-Commit `644e164`](https://github.com/ThonkTank/Salt-Marcher/commit/644e164977ffcd14507968665e4516f0da2a324b).
[PR #1469](https://github.com/ThonkTank/Salt-Marcher/pull/1469) bleibt Draft.
Atlas V7 ist der reguläre Einstieg mit Dateiformat 22; der optionale
Electron-/Pixi-Editor verwendet Format 24. Der
[Neubauplan](atlas-rebuild-plan.md) bleibt der einzige Ausführungsplan.

## Arbeitsentscheidung

**Der begrenzte R5-Fachfall ist zur Umsetzung freigegeben.** Der Nutzer hat am 10. November seinen letzten lokalen Test als ausreichend zum Weiterarbeiten
bestätigt und die Bereinigung vor dem nächsten Planschritt beauftragt.

Diese ausdrückliche Entscheidung ersetzt die frühere automatische R4-Sperre
für diesen begrenzten Schritt. Nächster Einstieg ist **P3.1 „Wald und Lichtung“**
mit ausschließlich den dafür nötigen P1/P2-Erweiterungen. Die R4-Auswertung
behält ihren formalen Befund einschließlich `allowNextPhase`; daraus entsteht
keine zusätzliche Sperre gegen diese Nutzerentscheidung.

Die offenen Messbefunde werden weitergeführt. Vollständige P0-Abnahme und
bestandener gemeinsamer P3-Fall bleiben Voraussetzungen für P4–P9.

## Bereinigte Übergabe

- README, Architektur und sämtliche R5-Einstiege des Plans verweisen auf diese
  Arbeitsentscheidung. Der Status enthält den aktuellen Stand und die nächste
  Übergabe; ausführliche R4-Messdetails bleiben im verlinkten R4-Commit erhalten.
- Der R4-Runner meldet `COLLECTION_FAILURE` nur noch bei tatsächlich vorhandenen
  Erhebungsfehlern. Ein vorgesehener Stop nach zentralem FAIL bewahrt die echten
  Inhalts-/Budgetfehler und die nicht ausgeführten Fälle. Er startet keine weitere
  Prozessgruppe und behauptet keinen zusätzlichen Laufzeitfehler mit leerer Liste.
- Produktquellen, Quellenmathematik, Budgets und unabhängige Prüfkriterien sind
  gegenüber R4 unverändert. Der Produktquellhash bleibt
  `66d56d12581e542651205e735a46328dbb2ccdf3b06c2080a54d5766dbd491b0`.

## Geprüfter Stand

Die vollständige GitHub-Prüfung von **`644e164`** ist erfolgreich:
[Candidate · exact-SHA aggregate](https://github.com/ThonkTank/Salt-Marcher/actions/runs/42719555905/job/129509728019).
Der Workflow prüft ausdrücklich den PR-Head und führt Paketprüfung,
`check:all` und den konfigurierten nativen RPM-Build in diesem Checkout aus.
Die [CI-Diagnosen](https://github.com/ThonkTank/Salt-Marcher/actions/runs/42719555905/artifacts/13722466496)
sind diesem Lauf zugeordnet. Dieser Erfolg gehört zu `644e164`; die CI eines
nachfolgenden Bereinigungscommits ist gesondert auf dessen SHA zu prüfen.

Am bereinigten Runner erneut ausgeführt:

| Prüfung                                               | Ergebnis                                                                                     |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Auswerter-, Timing-, Vorprüfungs- und Collectiontests | 323/323 in fünf Dateien bestanden                                                            |
| Tool-Typprüfung und Runner-Syntax                     | bestanden                                                                                    |
| Frischer P0-Desktop-Build                             | bestanden; Produktquellhash unverändert                                                      |
| Echter fester R4-Laborlauf zur Stopprüfung            | ein ausgeführter Fall in einer Prozessgruppe; übrige 23 Fälle erhalten; null Erhebungsfehler |
| Gemeinsames Urteil dieses Laufs                       | FAIL wegen gemessener GPU-/Submit-Grenzwertverstöße; kein zusätzlicher `COLLECTION_FAILURE`  |
| Formatierung und Diffprüfung                          | bestanden                                                                                    |

Die lokale Stopprüfung verwendet weiterhin die feste R4-Auswahl und belegt die
bereinigte Berichterstattung. Ihre Softwarezeiten sind keine native Abnahme.
Logs und Rohdaten liegen unter den ignorierten Laufverzeichnissen
`src-tauri/target/diagnostics/r5-handoff-verified/` und
`src-tauri/target/diagnostics/r5-handoff-direction/`; sie gehören nicht zum
versionierten Quellbaum.

## Offene Messbefunde

Der letzte R4-Haltebefund bleibt **FAIL**: Bei zehn Sekunden auf Level 4,
Scale 0,01 und 16-Pixel-Pinsel erreichte das Zentrum 200 statt 40.038,4
Referenzwirkung, ungefähr 0,5 Prozent. Während des Haltens wurde kein neues
Terrainpaket eingereicht. Die Codeableitung benennt wiederholt verworfene
Übersichtsvorbereitung: mindestens 133 Schritte für den betroffenen Auftrag,
bei höchstens 128 Schritten je RAF und erneutem Versionswechsel vor Fortsetzung.
Der Befund ist offen und wird durch die Nutzerentscheidung als bekannt in die
begrenzte Fortsetzung übernommen.

Der native Hardware-/20-ms-Ergebnistakt und die vollständige
Eingabe→Präsentationsabnahme bleiben offen. Erfolgreiche CI, Paketbau und der
lokale Nutzertest begründen die dokumentierte Arbeitsentscheidung; der formale
Messvertrag und die endgültigen Abnahmekriterien behalten ihre Bedeutung.

## Nächster Planschritt

**R5 beginnt mit P3.1 „Wald und Lichtung“.** Die gemeinsame Patchmenge zunächst
nur für Höhe und Landschaft erweitern. Landschaft erhält eine ausdrückliche
Autorenmaske und die vier bestehenden Deckungswerte: fehlend erbt, explizit leer
unterdrückt den groben Wald. Einen kleinen Landschaftspinsel einschließlich
Darstellung, History und echtem Dateirundlauf gemeinsam umsetzen.

Der erste Nachweis lautet: feine Lichtung → grobe Waldänderung → Detailrückkehr
→ Undo/Redo → Save/Neustart/Reopen. Landschaftsübersichten gegen einen
unabhängigen vollständigen Sampler prüfen. Danach folgen im begrenzten R5-Fall
Hausheader, vorbereitete Gewässerquellen, echte Fachkonkurrenz und der gemeinsame
Rundlauf gemäß P3. K1–K6 sind erledigt; zusätzliche allgemeine Konsolidierung ist
keine vorgeschaltete Aufgabe.
