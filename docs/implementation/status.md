# Aktueller Stand

Stand: 9. November 2026. Atlas V7 bleibt der reguläre Produkteinstieg mit
Dateiformat 22; der optionale Electron-/Pixi-Höheneditor verwendet Format 24.
[README](../../README.md) enthält Befehle, [Architektur](../architecture.md)
Zuständigkeiten und [Produktvertrag](../product-contract.md) Verhalten und Grenzen.
[PR #1469](https://github.com/ThonkTank/Salt-Marcher/pull/1469) bleibt Draft.

## Ergebnis und Auftragsgrenze

**Der beauftragte Strukturumbau ist umgesetzt. Die Großpinselabnahme bleibt rot.**
Dokument, Eingabe, Darstellung und Projektsitzung haben vier klar abgegrenzte
Besitzer. Ein gemeinsames Journal ersetzt doppelte Schreibwarteschlangen.
Lokale numerische Deltas ersetzen während eines warmen Strichs die erneute
Rekonstruktion aller unveränderten Höhenstufen.

Im unveränderten Softwarevergleich sinkt die Offscreen-GPU-Komposition bei 22
belegten Stufen von zuvor **591,2–677,1 ms auf 35,9–39,4 ms Median je
Terrain-Draw**. Alle sechs neuen Pinselprozesse komponieren im warmen Verlauf
null kanonische Samples; die Arbeit besteht aus Deltas, Farbe und der anfänglichen
Ankerkopie. Die maximale Rückmeldungspause der Mehrstufenfälle sinkt von
683,7–766,4 ms auf 79,2–90,9 ms.

Das ist noch keine ausreichende Bedienleistung: Alle sechs instrumentierten
Pinselprozesse überschreiten mit 53,4–58,4 ms p95 die 50-ms-Grenze bis zum Submit. Der normale lange
Großpinsel erreicht **53,7 ms p95**, obwohl seine Kontinuität mit **81,7 ms** die
100-ms-Grenze jetzt erfüllt. Auch die kurzen 512-Pixel-Fälle scheitern in der
anschließenden Serie überwiegend; der periodische Neuaufbau legt einen
zusätzlichen Engpass offen. Diese Fehler wurden weder wiederholt, bis sie
verschwanden, noch durch andere Grenzen oder kleinere Pinsel ersetzt.

**P0 ist nicht freigegeben.** Hier fehlen natives Display und Hardwaregrafik;
zusätzlich ist die Zuordnung einer Terrainrevision zur ersten tatsächlichen
Präsentation noch nicht bewiesen. GPU-Abschluss, CPU-Submit und Bildschirmpräsentation
bleiben verschieden. Der vollständige Atlas-Neubau und das spätere gemischte
Landschafts-/Hausbeispiel behalten das bestehende native P0-Gate.

## Implementierter Stand

- `EditorDocument` besitzt Autoren, History und das geordnete Journal. History und
  Pending teilen unveränderliche Vorher-/Nachherbilder. Nur die exakte Quittung
  des ältesten offenen Eintrags gibt Retry- und Projektionsdaten gemeinsam frei.
- `ProjectSession` besitzt eine Schreibpumpe, Projekt-/Savedmetadaten,
  Dateivorgänge und Wiederherstellung. `EditorController` hält Eingabe und einen
  aktuellen Quellenbedarf mit einem Lesezustand. Doppelte Schreibsammlungen,
  Ladeflags und Navigationstoken entfallen.
- `HeightField` ergänzt einen festen ungeklemmten numerischen Gesamtstand um die
  Differenz zwischen aktuellem Autor und Gestenbeginn. Es berechnet tatsächliche
  Teilrechtecke auf dem unveränderten 128²-Raster. Kalte, ungültige oder numerisch
  ungeeignete Anker nutzen die kanonische GPU- beziehungsweise Float64-Rekonstruktion.
  Begrenzte Ankerübernahmen und eine konservative Zulassungsregel verhindern eine
  unbegrenzte Fortschreibung; sie sind kein universeller GLSL-Fehlerbeweis.
- `WorldRenderer` übernimmt Quellen anhand ihres Inhalts und prüft die
  Uploadbereitschaft pro Kachel. Eine nicht blockierend geprüfte GPU-Fence
  verhindert ein zweites ausstehendes Zeichenpaket. Vorbereitete Kacheln werden
  nach einem Kontextwechsel oder einer ungültigen Delta-Bindung erneut gebunden,
  auch wenn ihre Dokumentrevision gleich geblieben ist.
- Der Auswerter berechnet validierte Falldaten einmal und verwendet sie für
  begrenzte und native Urteile. Fehlende, doppelte und unzugeordnete Evidenz bleibt
  ein Fehler. GPU-Zeitabfragen und Produktfakten besitzen ein gemeinsames
  vollständiges Messfenster; fehlende Messungen werden nicht als null Millisekunden
  ausgegeben.

Autorenformat, Halten, langsam/stärker, tatsächliche Kurven, maximal 50 ms Dosis,
Überlastabwurf, kurze freigegebene Down/Up- und Move/Up-Eingaben sowie der gemeinsame
Undo-/Speicherabschluss bleiben erhalten. Neue Wirkung nach Loslassen ist weiterhin
verboten. Keine Produkt- oder Abnahmegrenze wurde gelockert.

## Verifikation am integrierten Stand

| Prüfung                               | Ergebnis                                                                                                                                                                                                     |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Gesamter JavaScript-Testlauf          | **840 Tests in 54 Dateien bestanden.** Fünf V7-Transporttests konnten wegen fehlendem Cargo nicht starten; der Gesamtbefehl ist deshalb nicht grün.                                                          |
| TypeScript                            | Allgemeine Typprüfung, Tool-Typprüfung und P0-Build bestanden.                                                                                                                                               |
| Format und Diff                       | Repositoryweite Prettier-Prüfung sowie `git diff --check` bestanden. Rustformat-/Vertragsprüfung ist lokal mangels Cargo nicht ausführbar.                                                                   |
| Electron-/SQLite-/Fixturetests        | **15/15 bestanden.**                                                                                                                                                                                         |
| Desktop, Fehler und Dateilebenszyklus | **83/83 bestanden**, einschließlich echter Speichervorgänge und Neustart.                                                                                                                                    |
| GPU-Inhalt                            | **5/5 Referenzfälle bestanden**, einschließlich aller 22 Stufen, Grenzen, Auslöschung, 64 Transaktionen, feiner Autoren unter Übersichten und Kontextwiederherstellung.                                      |
| Normale Interaktionen                 | **19/20 bestanden**; der lange Großpinsel verfehlt 50 ms p95 und verwirft eine letzte Bewegung beim Loslassen. Geknickter Strich, Halten, langsam/stärker, echter Hänger, History und Dateiinhalte bestehen. |
| Fehler-/Erholungskontrollen           | **5/5 bestanden.**                                                                                                                                                                                           |
| Grafikmatrix                          | **9/9 Diagnosefälle vollständig**, gültige und eindeutig zugeordnete GPU-Abfragen. Alle sechs Pinselprozesse verfehlen die 50-ms-Grenze bis zum Submit.                                                      |
| Quellen-/Residenzskalierung           | **32 / 1.024 / 9.000 Kacheln bestanden**, einschließlich grob/fein, Undo/Redo, Speichern und Neustart.                                                                                                       |
| Kurze 512-Pixel-Serie                 | **FAIL:** drei Gruppen jeweils nach 17 von 100 angeforderten Versuchen abgebrochen; der 17. Versuch verfehlt die Endpunktwirkung.                                                                            |
| Native Vorprüfung                     | **BLOCKED / Exit 2:** `NO_NATIVE_DISPLAY`, `NATIVE_PRESENTATION_MAPPING_UNPROVEN`; keine Fixtures und kein Programmstart.                                                                                    |

Die 64er-GPU-Folge enthält 1.070.316 tatsächlich komponierte Deltasamples und
32.768 spätere kanonische Samples. Pixel und gespeicherte Autoren stimmen an
allen Checkpoints und nach Kontextwiederherstellung mit der CPU-Referenz überein.
Die beiden feinen Übersichtsfälle treffen tatsächlich Power 3/Level 0 und
Power 4/Level 1. Dies prüft Farbe und Float64-Autoren; es ist kein bitgleicher
Readback aller numerischen GPU-Zwischenwerte.

Die größte Skalierungsfixture enthält 294.912.000 Byte Autorendaten. Am geprüften
Endzustand hält der Renderer 11.337.728 Byte Quellen und 49.893.120 Byte
GPU-Ressourcen, ohne ausstehende Uploads oder Komposition. Der grobe Eingriff
benötigt in allen drei Größen keine zusätzlichen Quellenreads.

Die Skalierungsserie aktiviert nach dem groben Level-9-Eingriff allerdings den
konservativen CPU-Fallback: winzige positive Randkoeffizienten von etwa
`1,1–1,2 × 10^-29` Fuß fallen nach der Skalierung unter die bestehende
GPU-Sicherheitsgrenze. Ihre großen Quellseiten betreffen am Ende alle 96
Darstellungskacheln. Diese Serie belegt Quellenbegrenzung, Inhalt und Persistenz,
keine Beschleunigung durch den GPU-Anker. Der Fallback bleibt damit auch bei
bestimmten gewöhnlichen Grobpinseln eine reale Performancegrenze.

## Grafikvergleich mit unveränderten Eingaben

Drei Wiederholungen je Fall, jeweils frischer Prozess, Electron 44.10.2,
1440 × 960, DPR 1, ANGLE/Vulkan mit SwiftShader. Der lange Strich behält 101
Positionen, 24-ms-Abstände, 512 Pixel und 4.000 Fuß/Sekunde. Zusätzliche konstante
Felder heben sich im Eingriffsbereich auf; das Ausgangsrelief bleibt vergleichbar.

| Maß; Bereich der drei Wiederholungen                 |             Vorher |    Neuer Stand |
| ---------------------------------------------------- | -----------------: | -------------: |
| Einfache Karte: Offscreen-GPU-Median je Terrain-Draw |       46,0–46,9 ms |   37,0–38,2 ms |
| 22 Stufen: Offscreen-GPU-Median je Terrain-Draw      |     591,2–677,1 ms |   35,9–39,4 ms |
| 22 Stufen: Offscreen-GPU-p95 je Terrain-Draw         |     886,4–889,7 ms |   40,3–43,9 ms |
| 22 Stufen: GPU-Arbeit je 1 Mio komponierter Samples  | 1.754,6–1.778,0 ms | 113,8–124,2 ms |
| 22 Stufen: maximale Bewegungspause                   |     683,7–766,4 ms |   79,2–90,9 ms |
| 22 Stufen: aktuelle Eingabeframes vor Release        |          4 / 4 / 6 |   36 / 33 / 34 |
| 22 Stufen: verworfene von 101 Edit-Eingaben          |       96 / 96 / 94 |   50 / 54 / 51 |

Die neue Offscreen-Zeit umfasst numerische Projektion, Farbdarstellung und
Ankerkopien. Die Normalisierung verwendet tatsächliche komponierte Samples,
nicht GL-Aufrufzahl mal Kachelfläche. Die vollständige Rekonstruktion entfällt
in allen sechs warmen Strichen. Statische Kontrollen haben jeweils null
Komposition und Uploads bei unveränderten Autoren; ihre Canvas-Mediane bleiben
bei 17,8–18,2 ms. Canvas-Mediane der Mehrstufenfälle liegen bei 16,1–17,7 ms.

Die alte Offscreen-Zuordnung ist vollständig. Ihre Canvas-Auswertung ließ einzelne
Aufrufe am Rand des früheren Beobachtungsfensters unzugeordnet; der neue Runner
erfasst das gemeinsame Fenster vollständig. Daraus wird kein scheinbar genauer
Vorher-/Nachhervergleich sämtlicher Canvas-Aufrufe konstruiert.

Eingabe bis Submit überschreitet in allen sechs Pinselprozessen die unveränderten
50 ms: einfache Karte **56,0 / 53,8 / 58,4 ms p95**, Mehrstufenkarte
**53,4 / 54,7 / 57,4 ms p95**. Zwei Mehrstufenläufe verfehlen zusätzlich den
separaten Livebefund wegen einer beim Loslassen nicht angenommenen letzten
Bewegung. Die Kontinuität liegt in allen sechs Läufen unter 100 ms; alle
Inhalts-/Undo-Kontrollen bestehen. Trace und GPU-Abfragen können die Laufzeit beeinflussen; die Zahlen
belegen diesen Softwarevergleich, keine Zielhardwareleistung oder Präsentation.

## Verbleibender Großpinselengpass

Der normale lange Strich hat 50 angenommene und 51 verworfene Edit-Eingaben,
35 aktuelle Eingabeframes, 27,1 ms Median / 53,7 ms p95 / 56,7 ms Maximum bis
zum Submit und 2,2 ms bis zum Pointerup-Abschluss. Inhalt, History, Dosisbilanz
und der getrennte echte 200-ms-Hänger bestehen. Die maximale Bewegungspause
von 81,7 ms erfüllt jetzt die Kontinuitätsgrenze, die Latenzgrenze bleibt verfehlt.
Zusätzlich hält der Auswerter die letzte, beim Loslassen nicht angenommene
Bewegung als `INPUT_NOT_ACCEPTED` mit Grund `pointerup` fest.

Die kurze Serie erhält dieselben vier Positionen und 24-ms-Abstände. In den
48 Versuchen vor der Rebasegrenze bestehen nur fünf den Mindestnachweis zweier
vollständiger Liveframes vor Up. Zehn zweite Dosen kommen als einzelnes Paket
knapp nach Up; 33 benötigen zwei Kompositionspakete und einen zusätzlichen
Rückkopplungszyklus. Die Endbilder und History dieser 48 Versuche sind korrekt.

Nach jeweils 32 Edit-/Undo-Transaktionen benötigt Versuch 17 einen kanonischen
Neuaufbau. Seine Anfangsdosis verteilt 25 Kacheln auf 21 + 4 Kacheln. Die
vollständige GPU-Rückmeldung liegt erst 114,4–124,0 ms nach Down vor, während Up
nach 96,4–99,4 ms eintrifft. Deshalb wird keine Endpunktdosis mehr angenommen;
alle drei Gruppen brechen am tatsächlich unveränderten Endpunkt ab. Nachträgliches
Malen würde die Eingaberegel verletzen und wird nicht als Reparatur verwendet.

Alle 135 untersuchten Draws haben keine ausstehenden Uploadbytes. Es gibt weder
verlorene/falsch zugeordnete Completions noch einen zweiten Draw vor Abschluss
des vorherigen Pakets; die abschließenden Submitted-/Completed-Frames stimmen.
Der konkrete Engpass ist die Kombination aus begrenzten Kompositionspaketen und
langsamer Grafik-/Browserrückkopplung. Deren beobachteter Abfragezeitpunkt ist
keine native GPU-Zeitmessung. Die nächste Leistungsentscheidung benötigt einen
qualifizierten Hardwarevergleich und denselben unveränderten Großpinsel inklusive
Rebase; eine weitere allgemeine Besitzer- oder Autorenmigration ersetzt ihn nicht.

## Identität und Belege

Sauberer gemessener Produktbuild: `e45eae95892cb2d81eef2881690e11c2f0c9bf91`,
`dirty: false`. Produktquellhash:
`e536c95255f07c90e86523a3812c29e206a2838e80701c578cbcb90c5d0fa3f0`.
Lockhash: `b471b4a1da63f4226f95a28b60f3345aa03e51803f0ef1982624cd16a2d35bc2`.
Die anschließende Statuspflege verändert keine Produkt- oder Prüfquellen.

Aktuelle Belege liegen unter `src-tauri/target/diagnostics/structure-20261109/`:
`tests-final.log`, `store-final.log`, `desktop-final/`, `gpu-final/`,
`graphics-final/`, `interactions-final/`, `warm512-final/`, `scaling-final/`
und `native-final/`. Gegenprüfungen der einmaligen Auswertung und absichtlich
unvollständiger GPU-Evidenz liegen unter `structure-evaluator/`.
Der erhaltene Vergleichsstand liegt unter `brush-path/graphics-final/`.

Der erforderliche Repositoryjob bleibt **Candidate · exact-SHA aggregate** für
den veröffentlichten Head; sein aktueller Zustand und die Zuordnung zum geprüften
Quellbaum stehen im PR. Installierte RPM-Bedienabnahme, qualifizierte Hardwaremessung
und native Leistungsfreigabe bleiben offen. Dieser Auftrag aktiviert nicht den
vollständigen Atlas-Neubau.
