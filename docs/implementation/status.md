# Aktueller Stand

Stand: 12. November 2026. **Der Standardratenfall ist als unabhängige Prüfung
implementiert; der warme Höhenrenderer ist deutlich schneller, besteht die
vereinbarte Wirkungs- und Leistungsabnahme aber noch nicht.** Der begrenzte
Auftrag H1–H4 erreicht damit seine vorab festgelegte H2-Stopentscheidung.
Breite H3-Integration und H4-Abnahme bleiben blockiert. Die Integration des Kandidaten in Main ist keine Leistungsfreigabe.

Main übernimmt den Stand `2ea19ad2f` aus `work/atlas-p0-feasibility` und damit den geprüften
Höhenkandidaten aus `b5168be` sowie den veröffentlichten Land-/Meer- und
Reglerstand `798cf97`. Die Integration erhält die zwischenzeitlichen
Planungsänderungen aus `068dbc3`. Der reguläre Atlas-V7-Einstieg und der
Fachstand P3.3 bleiben erhalten; dieser begrenzte Höhenauftrag führt keinen
weiteren P0–P9-Planschritt aus.
Die Integration umfasst [#1467](https://github.com/ThonkTank/Salt-Marcher/pull/1467),
[#1468](https://github.com/ThonkTank/Salt-Marcher/pull/1468) und
[#1469](https://github.com/ThonkTank/Salt-Marcher/pull/1469). Der einzige
Mergekonflikt betraf `AGENTS.md`; Neubauauftrag und Arbeitsregeln bleiben erhalten.
Der Produktquellhash ist unverändert. Lokal bestehen beide Typprüfungen,
alle 1.524 TypeScript-Tests, der Electron-Build und 121/121 Desktop-Funktionsprüfungen
(Start/Datei, Küste, Landschaft, Haus und Gewässer; SwiftShader). Integrationsbelege liegen unter
`src-tauri/target/diagnostics/main-integration-20261112/`.
Der Vorschauworkflow für `2ea19ad2f` (Lauf `43219637820`) ist erfolgreich;
der vollständige Repository-Baseline-Lauf `43219892131` war bei der lokalen
Integration noch aktiv. Daraus wird keine vollständige V7- oder Leistungsabnahme abgeleitet.

**Planungsstand:** Der bestehende [Neubauplan](atlas-rebuild-plan.md) ist nach dem
Architekturvergleich vom 12. November präzisiert: gemeinsame räumliche
Abhängigkeiten und Ansichtsregeln, beibehaltene Objektgeometrie in P3.5 sowie ein
begrenzter Oberfläche/Stil-Vergleich in P4. Das sind nächste Arbeitsaufträge,
keine neu implementierten Funktionen oder zusätzlichen Leistungsbelege.

## Arbeitsentscheidung

Die bereits erteilte R5-Freigabe gilt für den begrenzten gemeinsamen P3-Fall und
seine notwendigen P1/P2-Erweiterungen weiter. Nach P3.1–P3.3 folgen **P3.4 echte
Fachkonkurrenz** und **P3.5 gemeinsamer Rundlauf** einschließlich des Objektpfads
am vorhandenen Haus. Die offene formale R4-/P0-Abnahme ist keine neue Vorbedingung
für diese freigegebene Arbeit. Vor dem vollständigen Ausbau P4–P9 bleiben der
bestandene gemeinsame P3-Fall und die vollständige P0-Abnahme erforderlich.
Die Plananpassung verändert weder die veröffentlichte Vorschau noch die unten
dokumentierten Produktnachweise.

Die H2-Stopentscheidung gilt für den gesonderten Höhenauftrag. Sie hebt die
bestehende R5-Freigabe für P3.4/P3.5 nicht auf.

## Implementiertes Verhalten

- Ein normaler warmer Höhenauftrag zeichnet seinen vollständigen sichtbaren
  Einfluss als gemeinsamen Terrain-Batch. Die vorhandene separable Projektion
  behält ihre Hi/Lo-Arithmetik, feste numerische Basis und exakten Sampleorte.
  Achsgewichte, Seitenzuordnung und Geometrie werden bei gleicher Identität
  wiederverwendet. Reine Werteänderungen bauen diese Metadaten nicht neu auf.
- Der Wirkungsreceipt enthält ausschließlich bereits materialisierte, noch
  unbestätigte Koeffizienten und deren vollständigen kubischen Einfluss. Der
  Zeichenauftrag entsteht aus genau dieser Menge. Ein alter ACK entfernt nur
  seine eingefrorenen Beträge; neuere und lediglich reservierte Wirkung bleibt
  offen. Bereits fertige alte Strichteile vergrößern die nächste Nachweisgruppe
  nicht automatisch.
- Der früheste Vorherwert bleibt auch bei zunächst leerer Quelle erhalten.
  Dadurch löst der erste lokale Strich keine unnötige kanonische Neuprojektion
  aus. CPU-Vorbereitung darf an noch ungebundenen Zielkacheln weiterlaufen,
  während die Grafik andere bereits eingereichte Ressourcen verwendet.
- Eine konservative Speicherreservierung je synchronem Vorbereitungsbatch
  ersetzt wiederholte vollständige Inventurrundgänge. Reicht diese Schätzung
  nicht, erfolgt erneut der bestehende tatsächliche Ressourcenabgleich.
  Laufende und eingefrorene Ressourcen bleiben geschützt; Limits sind unverändert.
- C1-Wirkung, Float64-Autoren, lokale 50-ms-Wirkungsreserve und geordneter
  Writer bleiben erhalten. Bei tatsächlicher lokaler Sättigung erscheint
  „Darstellung holt auf – Höhenwirkung begrenzt“. Freie andere Stellen bleiben
  nutzbar. Nach Erholung wird frische Haltezeit angenommen; verworfene Zeit
  wird nicht nachgeholt. Die Anzeige endet mit der Sättigung.
- Überschreitet eine dichte Gewässer-/Fundamentkomposition das bestehende
  Arbeitsbudget, bleibt sie begrenzt fortsetzbar. Ein abgebrochener Auftrag
  gibt weiterhin benötigte Seiten eines wiederverwendeten Deskriptors nicht
  frei. Beide Grenzfälle sind gezielt geprüft.
- Ein bereits in P3.3 eingeführter Weltrandfehler ist behoben: Nur die
  Dokumentabfragen der Gewässerdarstellung werden auf die Weltgrenze begrenzt;
  Kachelursprung, Raster und lokale Oberflächenkoordinaten bleiben erhalten.
  Regressionen decken alle vier Ecken und die exakte Seemaske am Rand ab.

Der direkte 4×4-Kandidat wurde mit genau einem separablen Gegenversuch verglichen
und entfernt. In der separablen Kostenprobe benötigte die Terrainarbeit median
33,53 ms; die Summe separat gemessener Draws betrug 33,41 ms. Numerische Projektion
und Farbe dominierten die horizontale Projektion. Ihre Kosten stiegen mit der
Pixelzahl; ein dominanter fixer Zielwechsel-/Drawaufwand wurde nicht belegt.
Deshalb wurde kein weiterer gemeinsamer Texturcache eingeführt. Diese Zeiten
stammen ausschließlich aus SwiftShader, nicht von Aarons Grafikkarte.

## Ergebnis am tatsächlichen Standardratenfall

`M03-height-standard-rate` verwendet den vorhandenen Electron-Runner und den
zentralen Auswerter: neue Welt, echte UI-Eingaben für 512 Pixel und
20 ft/s = 6,096 m/s, `scale=0.25`, Autorenstufe 4 und zehn Sekunden tatsächliches
Halten. Zehn feste Einsekundenfenster prüfen jeweils fünf Modellorte und den
zu vollständigen Szenenquittungen gehörenden Höhenstand. Die ungedrosselte
C1-Referenz verwendet die physischen Eingabezeiten; angenommene Produktzeit ist
niemals ihr Nenner. Echte Pixel prüfen Land vor sechs Sekunden und beim
Abschluss. Endmodell, ein Historyschritt, exaktes Undo und Budgets gehören dazu.

Ausgangshöhe ist −30,48 m. Die unabhängige Referenz ergibt nach zehn Sekunden
ungefähr +29,99 m; mindestens 90 % Wirkung erfordern etwa +23,94 m Endhöhe.
Die Tabelle zeigt feste Zehnsekundenwerte aus dem unveränderten Ausgangsstand
und den Nachläufen am endgültigen Kandidaten:

| Stand                                                    | Modellzentrum nach 10 s | Zu quittierter Szene gehörende Höhe | Modellwirkung / Soll | Ergebnis |
| -------------------------------------------------------- | ----------------------: | ----------------------------------: | -------------------: | -------- |
| Unveränderter `66d3f69`                                  |               −25,492 m |                           −25,797 m |               8,25 % | FAIL     |
| Endgültiger warmer Batch                                 |                +4,234 m |                            +3,929 m |              57,41 % | FAIL     |
| Endgültiger Kandidat, Quittierung frühestens nach 400 ms |               −25,679 m |                           −25,984 m |               7,94 % | FAIL     |

Die zweite Höhenspalte ist eine Float64-Rekonstruktion des zu abgeschlossenen
GPU-Receipts gehörenden Autorenstands, kein separat ausgelesener numerischer
GPU-Pixel. Das Abschlussbild entsteht nach zehn Sekunden Halten und der
anschließenden Abschlusswartezeit; es ist keine Aufnahme exakt bei t = 10 s.

Beim endgültigen Normalfall liegt das Modellzentrum nach sechs Sekunden noch
bei −9,793 m. Am Abschluss ist die Mitte Land; die vier weiteren Proben auf
halbem Radius bleiben unter Wasser. Alle 124 lokalen Receipts enthalten je
**ein Terrain-Paket mit 36 Kacheln und 313.600 Delta-Pixeln**. Es gibt dabei
keine kanonische Neuprojektion und keinen Basis-Capture. Die normale Arbeit
beträgt 119.300 Einheiten, im ersten Auftrag 136.564; die bestehende Grenze
bleibt 376.832. Mengen-, Upload-, Slot- und Speicherprüfung bestehen.

Zeit und Wirkung scheitern tatsächlich: Der vollständige Scene-Abschluss folgt
median 69,6 ms nach Freeze; der p95-Ergebnisabstand beträgt 105,3 ms statt
höchstens 20 ms. CPU-Arbeit liegt bei 8,5 ms p95 statt 8 ms. Nach Up benötigt
der letzte nötige Bildstand weitere 475,7 ms statt höchstens 50 ms.
Vorbereitungs- und GPU-Zeitgrenzen sind ebenfalls rot. Ein vorheriger
Zwischenlauf erreichte 61,58 % Wirkung; beide Läufe bleiben klar unter 90 %.
Das ist keine bestandene Leistungsabnahme, der lediglich ein Hardwarebeleg fehlt.

Die reale Gegenkontrolle gibt echte GPU-Quittungen frühestens 400 ms nach
Einreichung frei. Am endgültigen Build: medianer ACK 429,5 ms, medianer
Ergebnisabstand 433,4 ms. Szenario und Gesamtprüfung werden rot. Weitere gezielte
Negativkontrollen erkennen fehlende Mitte, fehlende nötige Kachel, fehlenden
Landpixel und vorzeitigen ACK. Half-open-Kachelgrenzen verhindern falsche
Bestätigungen durch benachbarte Kacheln. Dauer und genau ein Down/Up werden aus
den tatsächlichen Eingabeereignissen geprüft; zehn Fenster und fünf Orte bleiben
verbindlich. Der normale zentrale Nachlauf erfolgte nach der Gegenkontrolle.

## Nachweis am endgültigen Produktstand

Produktquellhash (`product-inputs-v1`):

`984708d5613b7fdb30472c4e3ed6a23273af89d32839fa1a858608130e4feb0e`

Die finale Build enthält die beiden HeightField-Grenzfallkorrekturen und die
Weltgrenzenkorrektur. Der Entwicklungsbuild trägt den damaligen Zwischencommit
`930d93f` mit `dirty: true`; der Quellhash bindet die Nachweise an den tatsächlichen
Produktinhalt. Dokumentation und Testwerkzeuge sind nicht Teil dieses Produktquellhashs.

Die Integration in den bestehenden Vorschauzweig verändert gegenüber `b5168be`
nur Plan und Status. Der Produktquellhash wurde nach der Zusammenführung erneut
berechnet und ist identisch; die vorhandenen Produktnachweise bleiben gültig.

| Prüfung                                              | Ergebnis                                                                                       |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `npm run typecheck` und `npm run typecheck:p0-tools` | PASS                                                                                           |
| `npm run test:atlas-p0`                              | **1.088/1.088 PASS**, 33 Testdateien                                                           |
| `npm run build:atlas-p0`                             | PASS                                                                                           |
| Vollständige GPU-Referenzreihe am finalen Hash       | **6/6 PASS**: 10 Ansichten, 190 Liveaktionen, 36 Referenzcheckpoints und Contextloss/Restore   |
| Normaler Electron-Funktionstest                      | **121/121 PASS**: Start/Datei 13, Küste 18, Landschaft 35, Häuser 29, Gewässer 26              |
| Zentraler Standardratenfall                          | **FAIL** wegen realer Wirkung, Landbildung und Zeitbudgets; keine fehlenden Belege im Szenario |
| Reale 400-ms-Gegenkontrolle                          | Szenario und Gesamtprüfung korrekt FAIL                                                        |

Die Formatprüfung aller geänderten Dateien und `git diff --check` sind grün.

### Abschlusskriterien H1–H4

| Kriterium                                                           | Umsetzung                                               | Nachweis am Stand                                                                            | Status                              |
| ------------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------- |
| H1: Standardrate und unabhängige Gegenkontrollen                    | Vorhandener Collector und zentraler Auswerter           | Baseline und echte 400-ms-Kontrolle scheitern passend; zentrale Metadaten-/Negativtests grün | Erfüllt                             |
| H2: vollständiger warmer Zeichenbatch und passender Wirkungsreceipt | Höhenrenderer, stabile Metadaten, sparse Wirkungskonten | 124/124 lokale Aufträge mit genau einem vollständigen Terrain-Paket                          | Struktur nachgewiesen               |
| H2: normale Wirkung bei bestehenden Zeit-/Ressourcengrenzen         | Direkter Kandidat und ein separabler Gegenversuch       | 57,41 % statt mindestens 90 %; kein Land nach sechs Sekunden                                 | **FAIL; Stopentscheidung erreicht** |
| Unveränderte Präzision, Schutzregeln und abhängige Darstellungen    | Controller, Modell, Renderer und Oberflächen            | 1.088 Unitprüfungen, 6 GPU-Referenzfälle und 121 normale Funktionsprüfungen grün             | Geprüfte Gegenfälle PASS; H3 offen  |
| H3: vollständige Integration und Kürzung                            | Nicht freigegeben                                       | Erst nach bestandener H2-Probe                                                               | Blockiert                           |
| H4: endgültiges Paket und Auslieferungsnachweis                     | Keine Paket- oder Auslieferungsprüfung ausgeführt       | Keine Freigabe aus einem roten H2-Fall                                                       | Blockiert                           |

## Bestehender Vorschau-Nachweis

Vor der Höhenintegration wurde **Vorschau 0.3.3-43208901872.1 veröffentlicht**.
Ihr Programmstand ist
[798cf97](https://github.com/ThonkTank/Salt-Marcher/commit/798cf974ce32018ebd5c3d373bc6903fc7f95c32).
Der [Release-Lauf 43208901872](https://github.com/ThonkTank/Salt-Marcher/actions/runs/43208901872)
ist vollständig erfolgreich: Typ-/Updateprüfungen, tatsächlicher RPM-/ZIP-Bau,
normaler Paket-Smoke, gepackte UI-Prüfung, Update-Dialog/IPC und Veröffentlichung.
Der öffentliche Update-Feed und der Release-Tag wurden beim damaligen
Veröffentlichungsabschluss mit genau diesem Commit und Revision 43208901872.1
abgeglichen. Die hochgeladenen Quellbäume entsprachen dem lokal geprüften Inhalt;
der damalige abschließende Statuscommit änderte nur dieses Dokument.

Die damaligen Paketlinks sind
[Fedora-RPM](https://github.com/ThonkTank/Salt-Marcher/releases/download/atlas-preview/saltmarcher-atlas-p0-0.3.3-43208901872.1.x86_64.rpm)
oder [portable ZIP](https://github.com/ThonkTank/Salt-Marcher/releases/download/atlas-preview/saltmarcher-atlas-p0-0.3.3-43208901872.1.linux-x64.zip).

Der separate Repository-Baseline-Lauf war beim Veröffentlichungsabschluss noch
aktiv. Aus dem erfolgreichen Vorschauworkflow wird kein vollständiger
Repository-/V7-Nachweis abgeleitet.

Der bestehende Vorschauworkflow bleibt unverändert und startet bei
Produktänderungen auf diesem Branch automatisch. Seine Paket-, UI- und
Updateprüfungen sowie eine mögliche Vorschauveröffentlichung sind getrennt
von der weiterhin fehlenden H1–H4-Leistungsabnahme zu bewerten. Der obige
Veröffentlichungsnachweis gehört zu `798cf97`, nicht zum Höhenkandidaten.

## Verbleibende Grenze und Übergabe

Die vorhandenen Kachelziele und die feste Basis sparen Arbeit, reichen auf der
verfügbaren Softwaregrafik für das vereinbarte Normalverhalten aber nicht aus.
Ein gesamter neuer Quellenstand wird noch nicht parallel zum eingefrorenen
Vorgänger vorbereitet. Nach Up kann die letzte Reständerung in die langsame
Hintergrundabarbeitung fallen. Diese Punkte sind offene Integrationsarbeit und
werden nicht als erfülltes H3 dargestellt.

Der bestehende [H1–H4-Plan](atlas-rebuild-plan.md#korrektur-des-höhenpinsels-bei-standardrate)
fordert nach diesem begrenzten Gegenversuch eine neue Richtungsentscheidung
vor breiter Integration. Die 90-%-Wirkung, Landbildung nach sechs Sekunden,
50-ms-Reserve und bestehenden Zeit-/Speichergrenzen wurden nicht gelockert.
Eine repräsentative Hardwaremessung kann den verbleibenden Grafikanteil
einordnen; sie garantiert kein Bestehen. In dieser Umgebung ist kein natives
GPU-Gerät zugänglich. GPU-Fence und CapturePage belegen weiterhin keinen physischen
Präsentationszeitpunkt.

Finale Rohbelege bleiben ignoriert unter
`src-tauri/target/diagnostics/height-h2-final/`, `height-h1-delay-final/`,
`height-h2-gpu-final/` und `height-h2-normal-final/`.
Die Kostenzerlegung liegt unter `height-h2-timers/`; die unabhängige Baseline im
benachbarten Worktree
`height-standard-baseline/src-tauri/target/diagnostics/standard-height-h1/`.
Der Kandidat ersetzt weder die vollständige native R4-/Hardwareabnahme noch
Paket-/Fedora-Installationsbelege oder die offene Live-Feed-Abnahme.
Der nächste Fachschritt des umfassenden Neubauplans bleibt P3.4;
dieser begrenzte Höhenauftrag führt ihn nicht aus.
