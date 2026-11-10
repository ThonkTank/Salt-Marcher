# Aktueller Stand

Stand: 10. November 2026. Ausgangspunkt dieser Bereinigung ist
[Übergabecommit `9d7635c`](https://github.com/ThonkTank/Salt-Marcher/commit/9d7635c693f1906c5df33fda8fc337c9d1db4d05).
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

## Bereinigung vor P3.1

- `EditorDocument` besitzt für Höhenpinsel ausschließlich den C1-Weg. Der bisher
  nur noch von Tests benutzte direkte Integrator ist entfernt; Initialisierung
  und Historyabschluss sind interne Schritte der angenommenen Fortsetzung.
- Modell-, Renderer-, Session- und Skalierungsfixtures verwenden echte
  C1-Annahme und Materialisierung. Der gemeinsame Testhelfer berechnet keine
  Autorenwerte, teilt keine langen Zeitfenster auf und bestätigt Wirkung nur
  auf ausdrücklichen Aufruf. Er liefert keinen Präsentationsnachweis.
- Die 52 Höhentests bleiben erhalten. Sie prüfen jetzt räumliche Mindestwirkung,
  deren einmalige Anrechnung, zulässige Zeitfenster und ausdrückliche
  Modellrückmeldung. Quellen-, History-, Speicher-, Weltgrenzen- und
  512-Kachel-Prüfungen bleiben abgedeckt. Analytische Kerneltests und die
  unabhängige C0/C1-Referenz bleiben erhalten.
- Der gemeinsame Zeitsegmenttyp liegt bei den Datenverträgen. Der aktive
  C1-Algorithmus, Laufzeitbudgets, unabhängige Referenz und Leistungsziele
  bleiben unverändert; diese Bereinigung implementiert noch keine Landschaft.

## Geprüfter Stand

Der Produktquellhash der lokalen Prüfung ist
`a220f249ca7394b3d3daaf4c4b23c2490701231fd86730fdb3fc65ed437ba8d4`.

| Prüfung                                                   | Ergebnis                                                                                                            |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Gesamte TypeScript-Typprüfung                             | bestanden                                                                                                           |
| P0-Editor-Tests                                           | 728/728 in 22 Dateien bestanden; die 52 Höhentests nach der letzten Präzisierung erneut bestanden                   |
| Tool-Typprüfung und frischer P0-Desktop-Build             | bestanden                                                                                                           |
| Echte Electron-/SQLite-Store- und Skalierungstests        | 15/15 bestanden, einschließlich unabhängigem Höhenvergleich, Dateirundlauf und Fine-Digest-Fehlerkontrolle          |
| Vollständiger Electron-Smoke                              | 120 Prüfungen bestanden: Normalbetrieb, Hänger und Datei-/Abschlusslebenszyklus                                     |
| GPU-Pixelreferenz                                         | 6/6 Fälle bestanden, einschließlich aller 22 Ebenen, Weltgrenzen und extremer endlicher Auslöschung                 |
| Isolierte negative Kontrolle der umgestellten Modelltests | Entfernte C1-Mindestwirkung macht den zeitlosen Geometrietest rot; Wiederherstellung macht ihn grün                 |
| Unabhängige Diffprüfung                                   | kein weiterer Integrator, keine verlorene fachliche Abdeckung und keine Änderung der aktiven C1-Berechnung gefunden |

Die vollständige GitHub-Prüfung des Ausgangscommits **`9d7635c`** ist ebenfalls
erfolgreich: [Candidate · exact-SHA aggregate](https://github.com/ThonkTank/Salt-Marcher/actions/runs/42803063239/job/129785215139).
Sie umfasst Paketprüfung, `check:all` und den konfigurierten nativen RPM-Build.
Dieser Erfolg gehört zum Ausgangscommit; die CI des veröffentlichten
Bereinigungscommits wird gesondert auf dessen SHA bewertet. Lokale Funktions-
und Pixelprüfungen sind keine native Leistungsabnahme.

Rohbelege liegen ignoriert unter `src-tauri/target/diagnostics/c1-cleanup/`,
`src-tauri/target/diagnostics/atlas-gpu-reference/` und den
`artifacts/atlas-rebuild/smoke-*`-Laufverzeichnissen.

## Offene Messbefunde

Der letzte R4-Haltebefund bleibt **FAIL**: Bei zehn Sekunden auf Level 4,
Scale 0,01 und 16-Pixel-Pinsel erreichte das Zentrum 200 statt 40.038,4
Referenzwirkung, ungefähr 0,5 Prozent. Während des Haltens wurde kein neues
Terrainpaket eingereicht. Die Codeableitung benennt wiederholt verworfene
Übersichtsvorbereitung: mindestens 133 Schritte für den betroffenen Auftrag,
bei höchstens 128 Schritten je RAF und erneutem Versionswechsel vor Fortsetzung.
Die Bereinigung repariert diesen Befund nicht und ersetzt ihn nicht durch eine
neue Performanceaussage. Er bleibt als bekannt in die begrenzte Fortsetzung
übernommen.

Der native Hardware-/20-ms-Ergebnistakt und die vollständige
Eingabe→Präsentationsabnahme bleiben offen. Die Arbeitsentscheidung erlaubt den
begrenzten Fachfall; der formale Messvertrag bleibt bestehen.

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
