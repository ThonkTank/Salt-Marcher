# Aktueller Stand

Stand: 9. November 2026. Atlas V7 bleibt der reguläre Produkteinstieg mit
Dateiformat 22; der optionale Electron-/Pixi-Höheneditor verwendet Format 24.
[README](../../README.md) enthält Befehle, [Architektur](../architecture.md)
Zuständigkeiten und [Produktvertrag](../product-contract.md) Verhalten und Grenzen.
[PR #1469](https://github.com/ThonkTank/Salt-Marcher/pull/1469) bleibt Draft.

## Ergebnis und Auftragsgrenze

Der begrenzte Korrekturschnitt erhält den tatsächlichen zeitlichen Bewegungsweg
und beseitigt den erzwungenen zusätzlichen Abschlussframe bei bereits gezeichnetem
Terrain. Die integrierten Fach- und Beobachtungstests bestehen. Reale Desktop-
und Grafikmessungen dieses Produktstands stehen vor der folgenden Buildprüfung
noch aus. Die vorherigen Leistungsfehler gelten dadurch nicht als bestanden.

**P0 bleibt nicht freigegeben.** Die native Abnahme ist durch fehlendes Display
und die weiterhin unbewiesene Zuordnung einer Terrainrevision zur ersten
­tatsächlichen Präsentation blockiert. Der vollständige F01–F19-Umfang sowie
P1/P2/P3 behalten ihr bestehendes Gate.

## Implementierter Stand

- Der Pinsel erhält einen zeitgestempelten Verlauf mit höchstens 128 wartenden
  Punkten. Eine angenommene Dosis integriert dessen Teilstrecken und die
  Verweilzeit am letzten Punkt. Normale Ereigniszusammenfassung schneidet keine
  Kurvenecken mehr ab; browserseitig zusammengefasste Punkte bleiben erhalten.
- Alle Zwischenpunkte und der vollständige Wirkbereich müssen lokal freigegeben
  sein. `EditorDocument.applySegments` prüft das gesamte Dosisfenster einschließlich
  gemeinsamer Budgets vor jeder Mutation. Der Einzelabschnitt delegiert an diesen
  Integrator. Eine Dosis erzeugt einen Patchsatz und eine Revision.
- Anfangsimpuls, zeitabhängiges Halten, 50-ms-Dosisgrenze und höchstens eine
  ausstehende eigene Dosis bleiben erhalten. Überlauf, erfolglose Zeichenrunde
  und echter Zeitsprung verwerfen alte Zeit und Wege ausdrücklich. Nach Loslassen
  oder Abbruch entsteht keine weitere Wirkung. History und Speichern behalten
  ihren gemeinsamen Abschlussweg.
- Ein vollständig aktueller letzter Terrainframe kann den Pointerup-Abschluss
  unmittelbar bestätigen. Sein tatsächlicher Submitzeitpunkt bleibt erhalten;
  der Abschlusszeitpunkt liegt frühestens beim Commit. Fehlende, ausstehende oder
  veraltete Bereiche warten weiterhin auf einen tatsächlichen passenden Draw.
- Schema 5 trennt Edit bis Submit und Pointerup bis Abschluss. Vollständige
  zeitliche Teilstrecken sind Pflichtbelege; fehlende oder widersprüchliche
  Geometrie liefert keinen Erfolg. Mehrere Eingaben einer Dosis behalten ihre
  eigenen Eingabezeiten; derselbe Frame zählt nur einmal als Livefortschritt.
- Der begrenzte Grafikdriver vergleicht einfache und lokal mit 22 Höhenstufen
  belegte Quellen sowie eine statische Kontrolle aus bereits komponierten
  Kacheln. Tracing und optionale asynchrone GPU-Zeitabfragen sind Diagnose;
  weder die Kontrolle noch ein Submit ersetzen native Präsentationsbelege.

## Bisherige Verifikation dieses Stands

| Prüfung                                                           | Ergebnis                                                                                                                                                                                               |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run test:atlas-p0`                                           | **371 Tests in zwölf Dateien bestanden.**                                                                                                                                                              |
| Aussagekraft der Kurvenregressionen                               | Vier identische Fälle mit 16/512 Pixeln und getrennten/browserseitig zusammengefassten Ereignissen scheitern am Ausgangsstand `f3ded38` an tatsächlichen Terrainwerten und bestehen mit der Korrektur. |
| Atomare Anwendung und Grenzen                                     | Ganze Pfade, fehlende spätere Quellen, gemeinsame Budgets, unsichtbare Zwischenpunkte, erlaubte Randüberlappung und Überlaufbilanz bestanden.                                                          |
| Abschluss und Nachweis                                            | Bereits gezeichnetes Terrain ohne weiteren RAF, noch ausstehendes Terrain mit tatsächlichem Draw sowie ungültige Session-/Ansichts-/Zeit-/Geometriebelege geprüft.                                     |
| TypeScript                                                        | Allgemeine Typprüfung und Tool-Typprüfung bestanden.                                                                                                                                                   |
| Sauberer Desktopbuild, echte SQLite-/Desktop-/GPU-Prüfung         | Ausstehend für diesen Produktstand.                                                                                                                                                                    |
| Drei kurze 512-Pixel-Proben, reale Interaktionen und Grafikmatrix | Ausstehend für diesen Produktstand.                                                                                                                                                                    |
| Native Vorprüfung                                                 | **BLOCKED / Exit 2:** `NO_NATIVE_DISPLAY`, `NATIVE_PRESENTATION_MAPPING_UNPROVEN`; keine Fixtures und kein Programmstart.                                                                              |

Die vorherigen SwiftShader-Messungen zeigten einen weiterhin scheiternden großen
Pinsel und lange inklusive Swap-Spannen. Sie werden mit ihrem damaligen Schema
und Harness erhalten und nicht als neue Abschluss- oder GPU-Zeiten umgedeutet.
Ein weiterer Umbau des Autorenmodells oder der vollständige Atlas-Neubau ist
daraus nicht freigegeben.

## Belegpfade und verbleibende Freigabe

- `src-tauri/target/diagnostics/brush-path/red-f3ded38.log`;
- `src-tauri/target/diagnostics/brush-path/native-preflight/native-preflight.json`.

Die folgende Desktopprüfung muss einen sauberen Build und dessen Produktquell-
und Lockhash festhalten. Messungen müssen genau diesen gebauten Stand verwenden.
Der erforderliche Repositoryjob bleibt **Candidate · exact-SHA aggregate** für
den veröffentlichten Head. Installierte RPM-Bedienabnahme, qualifizierte
Hardwaremessung und native Leistungsfreigabe bleiben offen.
