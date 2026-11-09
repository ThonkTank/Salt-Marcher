# Aktueller Stand

Stand: 9. November 2026. Atlas V7 bleibt der reguläre Produkteinstieg mit
Dateiformat 22; der optionale Electron-/Pixi-Höheneditor verwendet Format 24.
[README](../../README.md) enthält Befehle, [Architektur](../architecture.md)
Zuständigkeiten und [Produktvertrag](../product-contract.md) Verhalten und Grenzen.
[PR #1469](https://github.com/ThonkTank/Salt-Marcher/pull/1469) bleibt Draft.

## Ergebnis und Auftragsgrenze

Der tatsächliche zeitliche Bewegungsweg bleibt jetzt einschließlich Kurvenecken
und Verweilzeit erhalten. Ein bereits gezeichneter Endzustand kann den
Pointerup-Abschluss ohne zusätzlichen identischen Terrainframe bestätigen.
Beide Korrekturen sind fachlich und im echten Desktopablauf geprüft.

Alle drei unveränderten kurzen 512-Pixel-Proben bestehen ihre lokalen Inhalts-,
Live- und Zeitkriterien. **Der große Pinsel bleibt insgesamt FAIL:** Der lange
Strich überschreitet mit 120,8 ms die erlaubte 100-ms-Rückmeldungspause. Inhalt,
History und Zeitbilanz bestehen; 67 von 101 Edit-Eingaben werden im langsamen
Softwarelauf ausdrücklich verworfen. Die guten Latenzen der angenommenen
Eingaben ersetzen deshalb keine kontinuierliche Bedienbarkeit.

Die neue begrenzte Grafikmatrix lokalisiert die zusätzliche Arbeit in diesem
Backend auf die Terrain-Komposition: 22 lokale Höhenstufen benötigen pro
rekonstruiertem Sample etwa das 15-Fache der einfachen Karte. Die Ausgabe bereits
fertiger Kacheln bleibt wesentlich günstiger. Das ist ein belastbarer Befund
innerhalb von SwiftShader, keine Aussage über die Leistung einer echten GPU.

**P0 bleibt nicht freigegeben.** Der Hardwarevergleich ist hier durch fehlendes
Display und Hardwaregrafik blockiert. Für die native Abnahme fehlt zusätzlich die
Zuordnung einer Terrainrevision zur ersten tatsächlichen Präsentation. Der
vollständige F01–F19-Umfang sowie P1/P2/P3 behalten ihr bestehendes Gate.

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
- Der begrenzte Grafikdriver verwendet vorhandenen Desktoplauncher und
  Pinselverlauf. Die zusätzliche statische Kontrolle verändert keine Autorenwerte.
  Trace und optionale asynchrone GPU-Zeitabfragen liefern Diagnose; weder die
  Kontrolle noch ein Submit ersetzen native Präsentationsbelege.

## Verifikation am Produktquellstand

| Prüfung                             | Ergebnis                                                                                                                                                                                               |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run test:atlas-p0`             | **371 Tests in zwölf Dateien bestanden.**                                                                                                                                                              |
| Aussagekraft der Kurvenregressionen | Vier identische Fälle mit 16/512 Pixeln und getrennten/browserseitig zusammengefassten Ereignissen scheitern am Ausgangsstand `f3ded38` an tatsächlichen Terrainwerten und bestehen mit der Korrektur. |
| Atomare Anwendung und Grenzen       | Ganze Pfade, fehlende spätere Quellen, gemeinsame Budgets, unsichtbare Zwischenpunkte, erlaubte Randüberlappung und Überlaufbilanz bestanden.                                                          |
| Abschluss und Nachweis              | Bereits gezeichnetes Terrain ohne weiteren RAF, noch ausstehendes Terrain mit tatsächlichem Draw sowie ungültige Session-/Ansichts-/Zeit-/Geometriebelege geprüft.                                     |
| TypeScript und Format               | Allgemeine Typprüfung, Tool-Typprüfung, betroffene Formatierung und `git diff --check` bestanden.                                                                                                      |
| `npm run check:atlas-p0`            | Sauberer Build, **15** echte Electron-/SQLite-/Fixturetests, **83** Desktop-/Hänger-/Lifecyclechecks und **fünf** GPU-Pixelreferenzen bestanden.                                                       |
| Reale Interaktionen                 | **18/19 bestanden**; allein die Kontinuität des langen Großpinsels scheitert. Inhalt, History, Halten, langsam/stärker, Stall und fein/grob/fein bestehen.                                             |
| Fehler-/Erholungskontrollen         | **Alle fünf bestanden**, einschließlich ungestörter abschließender Erholung.                                                                                                                           |
| Begrenzte Grafikmatrix              | Alle **neun** geplanten Fälle vollständig ausgewertet; gültige GPU-Abfragen, Inhalts-/Undo-Kontrollen und statische Nullarbeit bestätigt. Die darin roten Bedienkriterien bleiben erhalten.            |
| Native Vorprüfung                   | **BLOCKED / Exit 2:** `NO_NATIVE_DISPLAY`, `NATIVE_PRESENTATION_MAPPING_UNPROVEN`; keine Fixtures und kein Programmstart.                                                                              |

Die GPU-Pixelreferenzen enthalten alle 22 Stufen, Kachel-/Farbgrenzen, gewöhnliche
und extreme endliche Auslöschung sowie den Weltrand und Kontextwiederherstellung.
Die frühere separate Skalierungsserie 32/1.024/9.000 wurde bei diesem begrenzten
Eingabeschnitt nicht als neuer Nachweis wiederholt.

## Drei unveränderte kurze Großpinsel-Proben

Vier Positionen mit 24-ms-Abständen, 512 Pixel, jeweils eigener Prozess.
Electron 44.10.2, 1440 × 960, DPR 1, ANGLE/Vulkan mit SwiftShader. Inhalt,
Endpunkt, Undo und D10-Zeitbilanz bestehen in allen drei Proben.

| Probe | Down → Submit | Größter angenommener Edit → Submit | Up → Abschluss | Aktuelle Eingabeframes vor Release | Verworfene Edit-Eingaben | Ergebnis   |
| ----- | ------------: | ---------------------------------: | -------------: | ---------------------------------: | -----------------------: | ---------- |
| 1     |       14,7 ms |                            22,5 ms |        17,5 ms |                                  2 |                  2 von 4 | PROXY_ONLY |
| 2     |       16,2 ms |                            32,6 ms |        10,9 ms |                                  2 |                  1 von 4 | PROXY_ONLY |
| 3     |       18,4 ms |                            27,5 ms |         5,8 ms |                                  2 |                  1 von 4 | PROXY_ONLY |

Die größte bewertete Bewegungspause beträgt 82,5 / 56,7 / 52,6 ms.
`PROXY_ONLY` bedeutet bestandene lokale Kriterien bei weiterhin unbewiesener
nativer Präsentation. Diese kurzen Proben sind keine vollständige p95-Abnahmeserie.
Schema 5 misst den Abschluss getrennt vom ursprünglichen Draw; alte
Schema-4-Up-bis-Folgeframe-Zeiten werden nicht als dieselbe Messgröße verglichen.

## Langer Strich: verbleibender Fehler

Der ungestörte Verlauf behält 101 Positionen und 24-ms-Abstände. Seine 34
angenommenen Edit-Eingaben erreichen **20,9 ms Median, 36,2 ms p95 und 37,7 ms
Maximum** bis zur Zeicheneinreichung. Der Abschluss benötigt **13,3 ms**.
Es liegen 33 aktuelle Eingabeframes vor Release; 67 Edit-Eingaben werden
verworfen. Die größte Bewegungspause beträgt **120,8 ms** und überschreitet
unverändert die 100-ms-Grenze. Daher bleibt der Gesamtfall FAIL.

Angenommene laufende Dosiszeit: 1696,1 von 2507,8 ms gehaltener Zeit, zusätzlich
der nominale Anfangsimpuls. 803,5 ms werden durch die Zeitgrenze verworfen;
8,2 ms verbleiben beim Loslassen ohne zusätzliche Wirkung. Die Bilanz besteht.
Der getrennte Inhaltslauf zeigt Terrainänderungen während der Geste. Ein echter
200-ms-Hänger verwirft 150,7 ms; keine Folgedosis überschreitet 50 ms oder holt
einen alten Weg nach. Undo/Redo und der Wechsel zwischen feinen und groben
Autorenstufen bestehen.

## Grafikdiagnose: Komposition als zusätzlicher Kostenfaktor

Drei Wiederholungen vergleichen denselben echten Langzug auf einer einfachen
Karte und auf lokal mit 22 Höhenstufen belegtem Terrain. Zusätzliche konstante
Felder heben sich im Pinselbereich auf; das Ausgangsrelief bleibt vergleichbar.
Die tatsächliche Darstellungsquellenauswahl bei Power 2 enthält alle 22 Stufen
und keine Übersichtskacheln. Eine dritte Kontrolle bewegt ausschließlich den
Cursor über bereits komponierte Kacheln.

Die folgende Tabelle zeigt die Bereiche der Werte aus den drei Wiederholungen;
Median und p95 sind jeweils angegeben. Die Normalisierung verwendet die gesamte
Kompositionsarbeit und alle tatsächlich komponierten Samples.

| Maß                                           | Einfache Karte | 22 lokale Höhenstufen | Fertige Kacheln |
| --------------------------------------------- | -------------: | --------------------: | --------------: |
| Offscreen-Komposition je Terrain-Draw, Median |   46,0–46,9 ms |        591,2–677,1 ms |           Keine |
| Offscreen-Komposition je Terrain-Draw, p95    |   64,3–64,8 ms |        886,4–889,7 ms |           Keine |
| GPU-Arbeit je 1 Mio komponierter Samples      | 115,1–117,0 ms |      1754,6–1778,0 ms |           Keine |
| Finale Canvas-Zeichenarbeit je Bild, Median   |   18,2–18,7 ms |          17,8–18,5 ms |    17,9–18,5 ms |
| Inklusive Swap-Spanne, Median                 |   67,6–69,3 ms |        600,6–618,7 ms |    21,9–22,5 ms |

Alle GPU-Zeitabfragen sind gültig, ohne Disjoint-Meldung oder Trunkierung.
Jede Offscreen-Abfrage lässt sich eindeutig einem tatsächlichen `height-draw`
zuordnen; ihre Anzahl mal 128² stimmt in jedem Draw mit den komponierten Samples
überein. Die statische Kontrolle hat jeweils null Komposition, null Uploadbytes,
null ausstehende Arbeit und unveränderte Autorenwerte bei 100/101/101 echten
Cursor-Draws.

Die Mehrstufenfälle erfüllen ihre Bedienkriterien in keiner Wiederholung:
683,7 / 766,4 / 750,2 ms maximale Bewegungspause, nur 4/4/6 aktuelle
Eingabeframes vor Release und 96/96/94 verworfene von 101 Edit-Eingaben. Die
Inhaltsänderungen und Undo bestehen. Die einfachen instrumentierten Läufe
bestehen ihre lokale Live-/Submitkontrolle zweimal; einmal überschreitet die
Pause mit 105,9 ms die Grenze. Kein Ergebnis wird durch Wiederholung ersetzt.

Damit ist die zusätzliche Arbeit innerhalb dieses Softwarebackends enger als
zuvor lokalisiert: Viele überlagerte Stufen verteuern die Höhenrekonstruktion
stark, während die finale Ausgabe ähnlich bleibt. Trace und GPU-Abfragen können
Laufzeiten beeinflussen. Der Vergleich beweist weder Zielhardwareleistung noch
die erste tatsächliche Bildschirmpräsentation. Die gleiche begrenzte Matrix auf
geeigneter Hardware ist der nächste Richtungsnachweis; weitere allgemeine
Autoren-, Cache- oder Engineumbauten ersetzen ihn nicht.

## Identität und Belegpfade

Sauberer Produktbuild: `e980fdc6a188b60fe09a44cde6f5ff6eed1060bb`, `dirty: false`.
Produktquellhash: `a15ae399dd3588b0bf9a4924cb4bcb2585f4c44441f35c230358764f275211b3`.
Lockhash: `b471b4a1da63f4226f95a28b60f3345aa03e51803f0ef1982624cd16a2d35bc2`.
Die anschließende Statuspflege ändert keine Produkt- oder Prüfquellen.

- `src-tauri/target/diagnostics/brush-path/red-f3ded38.log`;
- `src-tauri/target/diagnostics/brush-path/desktop-check.log`;
- `src-tauri/target/diagnostics/atlas-gpu-reference/report.json`;
- `artifacts/atlas-rebuild/smoke-2026-11-09T07-35-39.654Z/`;
- `artifacts/atlas-rebuild/brush-path-warm512/` und `brush-path-interactions/`;
- `src-tauri/target/diagnostics/brush-path/graphics-final/report.json`;
- `src-tauri/target/diagnostics/brush-path/graphics-final/comparison-summary.json`;
- `src-tauri/target/diagnostics/brush-path/native-preflight/native-preflight.json`.

Der erforderliche Repositoryjob bleibt **Candidate · exact-SHA aggregate** für
den veröffentlichten Head; sein aktueller Zustand steht im PR. Installierte
RPM-Bedienabnahme, qualifizierte Hardwaremessung und native Leistungsfreigabe
bleiben offen. Der begrenzte Auftrag aktiviert nicht den vollständigen Atlas-Neubau.
