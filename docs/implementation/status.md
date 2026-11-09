# Aktueller Stand

Stand: 9. November 2026. Atlas V7 bleibt der reguläre Produkteinstieg mit
Dateiformat 22; der optionale Electron-/Pixi-Höheneditor verwendet Format 24.
[README](../../README.md) enthält Befehle, [Architektur](../architecture.md)
Zuständigkeiten und [Produktvertrag](../product-contract.md) Verhalten und Grenzen.
[PR #1469](https://github.com/ThonkTank/Salt-Marcher/pull/1469) bleibt Draft.

## Ergebnis und Auftragsgrenze

Die bisherige P0-Fortsetzung begrenzt nun Quellen einschließlich Metadaten und
verbessert den Rasterablauf
für große Pinsel. Der vorhandene Beobachter wurde an einem tatsächlich
nachgewiesenen Messfehler korrigiert. Die kleine Präsentationsprobe ist
implementiert und ausgeführt; sie beweist die erforderliche native Zuordnung
weiterhin nicht. **P0 ist nicht freigegeben.** Der gemeinsame P1/P2/P3-Produktfall
und der vollständige F01–F19-Ausbau bleiben gemäß Plan an dieses Gate gebunden.

**Nächster Schritt nur geplant:** Der Nutzerauftrag vom 9. November verlangt vor
weiterer Arbeit eine einfachere Implementation desselben P0-Verhaltens.
[Abschnitt 5 des bestehenden Plans](atlas-rebuild-plan.md#p0-fortsetzung-und-nächster-produktnachweis)
beschreibt dafür eindeutige Pinselzustände, explizite Abschnitte, gemeinsame lokale
Submitfakten, einen gerichteten Frameablauf und passive Diagnose. Dieser
Planungsstand verändert keinen Produkt- oder Prüfcode. Vereinfachung,
Großpinselkorrektur und native Freigabe haben getrennte Abschlusskriterien.

| Kriterium                                         | Implementierung                                                                                                     | Nachweis / Status                                                                |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Quellen und Metadaten begrenzen                   | Gemeinsame Begrenzung von Autoren und Flächenbelegen nach Bereich und Stufe; keine historischen `unknown`-Einträge. | Reise-, Halo-, alte-Read-, History- und Controllerfälle bestanden.               |
| Großpinsel kausal verbessern                      | Restbatches derselben Revision direkt disponieren; Farben direkt in den Puffer schreiben.                           | Regelmäßige Rückmeldung verbessert; die festen Zeit-/Liveziele bleiben offen.    |
| Beobachtung ohne eigene Frameblockade             | Journal erst nach dem passenden Commit-Submit oder Timeout übertragen.                                              | Reale Trace und Gegenprobe bestätigen die entfernte Störung.                     |
| Inhalt einer nativen Präsentation zuordnen        | CDP-Bilder, verlustfreie Framekennungen, strikte Reporterprüfung und echte Fehlerkontrollen.                        | `NATIVE_PRESENTATION_MAPPING_UNPROVEN`: konkrete Copy-/Generationsbindung fehlt. |
| Native P0-Abnahme                                 | Qualifikation und fehlerschließender Auswerter bleiben aktiv.                                                       | Blockiert; zusätzlich offener warmer 512-Pixel-Fall im Labor.                    |
| Gemeinsamer Produktkern und vollständige Ablösung | Zielumfang und Abhängigkeiten unverändert.                                                                          | Offen hinter P0; keine vorgezogene Ablösung von V7.                              |

Die bereits vorhandenen K1–K6-Grundlagen bleiben aktiv: gemeinsamer Dateilebenszyklus,
idempotente Fortsetzung nach Schreibfehlern, lokale D11-Freigabe, begrenzte D10-Dosis,
numerische Übersichten, Reads während asynchroner Saves und echte Desktop-/Paketchecks.
Es wurden keine Zeitgrenzen abgesenkt und keine fehlenden Ergebnisse als Erfolg gewertet.

## Quellenbestand und Readschutz

Eine bestätigte leere Welt erhält einen gewöhnlichen Ganzweltbeleg. Der Controller
hält Darstellungsquellen und den vollständigen aktuellen Werkzeugbereich mit Halo
als höchstens zwei Bedürfnisse. Belege werden darauf geschnitten, bevor bestätigte
unbenötigte Quellen einschließlich ihrer Renderer-/Worker-Kopien entfallen.
Fehlender Schlüssel ohne Beleg bleibt unbekannt. Aktive und unbestätigte Änderungen
bleiben gepinnt; bestätigte Löschmarker entfallen. Die globale bestätigte Sequenz
weist veraltete Reads vor jeder Quellen- oder Belegmutation zurück.

Der direkte Vergleich mit `2e2c38b` zeigt:

| Besuchte Quellen | Metadateneinträge vorher | Nachher | Aktive Quellbytes jeweils |
| ---------------: | -----------------------: | ------: | ------------------------: |
|              128 |                      128 |     128 |                     4 MiB |
|            1.024 |                    1.024 |     128 |                     4 MiB |
|            5.120 |                    5.120 |     128 |                     4 MiB |

Beim Wechsel in ein bestätigtes leeres Gebiet bleiben vorher 5.120 Einträge bei
null Quellbytes; danach sind beide null. Die anschließende erfolgreiche lokale
Bereitschaftsabfrage besucht vorher 5.120 Einträge, danach keinen. Das belegt
begrenzte Metadaten und eingesparte Scanarbeit, keine gemessene UI-Zeitersparnis.
Der Modellbeleg steht unter
`src-tauri/target/diagnostics/source-retention/before-after.json`.

Regressionen prüfen Rückkehr ohne voreiligen Ozean, getrennte Bedarfe ohne falsche
Abdeckung ihrer Lücke, kubischen Halo, Herauszoomen mit Freigabe feiner Stufen,
Undo nach vollständiger Verdrängung, unbestätigte Löschung, Ack, verspätete positive
und leere Reads sowie Redo/Neuladen. Eine Änderung von Zeigerort und Pinselgröße
während eines Darstellungsreads verwendet danach den aktuellen Werkzeugbedarf.
Die grobe numerische Darstellung wird gegen den vollständigen Höhensampler geprüft.

## Pinsel und korrigierte Beobachtung

Der Dispatcher startet erforderliche Restarbeit derselben angenommenen Revision
nach Workerabschluss. Er behält einen laufenden Batch, vorhandene Pixel-/Tilegrenzen
und höchstens 4 MiB für fertige plus nächste Resultate. Upload, Rendering und nächste
Dosis bleiben im RAF. Die Fairnessprüfung für übrige sichtbare Kacheln zählt auch
Fortsetzungen; eine absichtlich zurückgesetzte fehlerhafte Zählerlogik lässt die
neue Regression scheitern.

Die Farbklassifikation schreibt unveränderte RGB-Werte direkt in den RGBA-Puffer.
Im stationären 512-Pixel-Fall entfallen 230.400 kurzlebige RGB-Tupel je Schritt.
Die Diagnose trennt sämtliche Hold-/Input-/Pointerup-Pfade, alle erforderlichen
Batches und Pixel sowie Quellenvorbereitung, Sampling, Farbe und Wartezeiten.
Ungültige Workeruhren bleiben unvollständig; die davon unabhängigen Zeiten auf der
Rendereruhr bleiben vollständig in den Verteilungen.

Zusätzlich verursachte `observeStroke` selbst einen langen Pointerup-Wert:
1.959 Ereignisse wurden vor der letzten Submission übertragen. Ein vorhandener
Chromium-Trace zeigt dabei einen 77,769-ms-Renderer-Task, danach den wartenden RAF;
der MouseUp-Handler selbst dauerte 3,255 ms. Die zusammengefasste lokale
Wartebedingung überträgt das Journal erst nach Submission oder Timeout. Bei gleicher
Fixture und gleichem Produkt sank Pointerup in dieser Gegenprobe von 100,7 auf
46,8 ms. Das ist ein korrigierter Beobachter, kein Produktgeschwindigkeitsbeleg.
Rohdaten: `artifacts/atlas-rebuild/remediation512-pointerup/`.

### Vergleich mit demselben korrigierten Beobachter

Je ein Haltestrich pro Größe, Electron 44.10.2, 1.440 × 960, DPR 1, SwiftShader.
Der saubere Altproduktbuild `d8e6169` enthält gegenüber `6f38bda` ausschließlich
den korrigierten Gestenbeobachter. Pro angenommener Dosis bleiben bei beiden
Produkten exakt 16 Rastertasks, 230.400 Pixel und zwei Batches.

| Quellen | Schritte vorher → nachher | Modell→Submit-Median vorher → nachher | p95 vorher → nachher | Pointerup vorher → nachher |
| ------: | ------------------------: | ------------------------------------: | -------------------: | -------------------------: |
|      32 |                   19 → 31 |                        53,3 → 27,8 ms |       86,4 → 56,5 ms |             67,6 → 49,0 ms |
|   1.024 |                   23 → 27 |                        44,7 → 34,6 ms |       58,7 → 65,0 ms |             43,3 → 57,8 ms |
|   9.000 |                   19 → 34 |                        51,7 → 26,8 ms |       70,3 → 50,2 ms |             45,1 → 41,0 ms |

Alle drei Rundläufe bestehen Fachwerte, geschützte Feindetails, Pixel, Detailrückkehr,
Undo/Redo, Save und Prozessneustart. Die typische Rückmeldung verbessert sich in
diesen Diagnosen; eine allgemeine p95-Verbesserung ist nicht belegt. Im 1.024er-Fall
sind p95 und Pointerup schlechter. Dies sind keine vollständigen Abnahmestichproben
und keine nativen Präsentationszeiten. Der Kandidat hält nach dem groben Edit
128 KiB Dokumentquellen statt 384 KiB; Renderer und Worker jeweils dieselben 128 KiB.

Die neue feste warme 512-Pixel-Probe fällt bei unveränderten 24-ms-Eingaben durch.
Der bisherige Kandidatenlauf benötigt 45,6 ms für den Druck und 80,3 ms für eine
angenommene Bewegung; spätere Moves verfallen nach D10 während ausstehender
Rückmeldung. Nur ein exakter Liveframe liegt vor Release vor, der Endpunkt bleibt
unverändert. Undo ist korrekt. Die Bewegung benötigt 382.800 Pixel in vier Batches;
die direkte Fortsetzung arbeitet, aber Raster-/Framearbeit bleibt zu lang.
Auch das Altprodukt scheitert im identischen Warmfall an Live-Verlauf und Latenz.
Sein Endpunkt besteht in dieser Einzelprobe, weil eine spätere andere Dosis vor
Release angenommen wird. Die konkrete Endpunktauslassung des Kandidaten ist daher
nicht als sicher vorbestehend abgehakt; sie bleibt Teil des offenen Falls.

Die isolierte Nachspielung derselben Quellen, Dosen und vorherigen View-/Press-Tasks
in derselben Electron-/V8-Version benötigt für die 382.800 Bewegungspixel zunächst
9,24 ms, im Median 6,35 ms statt der 25,1 ms im Grafiklauf. Die Differenz belegt
einen erheblichen Laufzeitkontext-/Schedulinganteil, keinen allein intrinsischen
25-ms-Kernel. Eine Einpass-Addition wurde über 1.995.120 Werte bitgenau gegengeprüft:
In 20 abwechselnden A/B-Läufen verbessert sie den Median nur von 6,57 auf 5,92 ms,
während p95 von 9,23 auf 9,68 ms und das Maximum von 9,49 auf 10,33 ms steigen.
Dieser Kandidat schließt den Warmfall nicht belastbar und wurde nicht übernommen;
`height-grid.ts` bleibt unverändert.
Die detaillierten Vergleichswerte stehen unter
`artifacts/atlas-rebuild/remediation512-baseline-corrected/comparison-analysis.json`,
die Kandidatenläufe unter `remediation512-final/` und `remediation512-warm/`, die
isolierten Replays und ihr Vergleich unter `remediation512-sampling/`.

### Unmittelbarer Read nach großem Commit

Eine echte Modellgeste mit 512 Quellenkacheln und 32.705 geänderten Kontrollwerten
wurde durch den Utility-/SQLite-Pfad geschickt. Direkt danach angeforderte kalte
Reads lieferten in drei Proben den richtigen bestätigten Stand und warteten
264–302 ms; der synchrone Storecommit benötigte 250–284 ms. Der Übersichtscache blieb
bei 32 MiB. Das belegt eine verbleibende synchrone Wartezeit, keine native M10-Abnahme
und noch keinen Bedarf für eine zweite Datenbankautorität. Beleg:
`artifacts/atlas-rebuild/remediation-commit-read/result.json`; Store und Dispatcher
sind gegenüber diesem Beleg unverändert.

## Präsentationsprobe und tatsächlicher Blocker

Der vorhandene Tracerecorder verwendet CDP mit rohem JSON-Stream, damit uint64-IDs
nicht vorher gerundet werden. Die kleine Küstenprobe prüft drei unabhängige
Terrainbereiche außerhalb des bewegten Overlays. Normalfall, verworfene Zeichnung,
250-ms-Verzögerung und Erholung bestanden am sauberen Integrationsbuild. Unterdrücktes Terrain
bleibt trotz geänderter Modellwerte und weiterlaufender Overlay-Submits unverändert;
verzögertes Terrain erscheint verspätet. Kein Fall erhält einen akzeptierten
Präsentationszeitpunkt.

Die ausgeführte Chromium-Trace liefert im Screenshot Compositorquelle und
Framefolge, aber keine Capture-Nummer. Captureereignisse besitzen Nummer und
Auslöser wie `demand` oder `compositor`, jedoch nicht die passende Compositoridentität.
Auch `CopyOutput` liefert keine gemeinsame Verknüpfung. Zusätzlich unterscheidet
die Vorher-/Nachher-Signatur weder beliebige exakte Zwischenrevisionen noch deren
erste tatsächliche Präsentation. Uhrenkalibrierung und Beobachteraufwand bleiben
unqualifiziert. **Andere Hardware allein schließt diese Beweislücke nicht.**

Der Kandidat bleibt deshalb `NATIVE_PRESENTATION_MAPPING_UNPROVEN`. Fehlende oder
mehrdeutige Bilder/Reporter sowie ungültige Surface-/Display-/Layerkennungen werden
nicht ergänzt. Laborprobe und reine Vorprüfung verwenden denselben Auswerter:
`BLOCKED` endet mit Exit 2, echte Kontrollfehler mit Exit 1. Vorprüfung ohne Probe
erzeugt keine Fixtures; die ausdrücklich gewählte Laborprobe erzeugt nur ihre
kleine Küstenfixture.

Die Abschlussprobe umfasst 77 Bilder; 73 besitzen einen eindeutigen vollständigen
Reporter-Kandidaten, vier bleiben ungemappt. Beim Drop bleiben alle Terrainproben
trotz 17 Overlay-Submits unverändert. Beim Delay erscheint der erste passende
Reporter-Kandidat nach 323,044 ms. Das sind Kontrollwerte, keine akzeptierten
Präsentationslatenzen; sämtliche `presentationAt` bleiben `null`.

Der erste Abschlussbericht wies gültige negative Surface-/Display-IDs ab. Der
gepinnten Chromium-Definition entsprechend prüft der korrigierte Parser diese
Felder als `int64`, Framequelle/-folge weiterhin als `uint64`. Originalbericht,
Rohtraces und Pixelproben bleiben unverändert erhalten. Die Offline-Neuauswertung
derselben vier Traces mit dokumentierten Hashes besteht alle vier Kontrollen und
endet korrekt mit `BLOCKED / Exit 2`; sie ist kein neuer Desktoplauf.
Belege: `artifacts/atlas-rebuild/remediation-final-native/` und
`remediation-final-native-reanalyzed/`. Die reine native Vorprüfung ohne Display
endet ebenfalls mit `BLOCKED / Exit 2`, ohne Fixtures oder Programmstart:
`remediation-final-native-preflight/`.

## Verifikation und Integration

Der saubere Integrationsbuild ist `228123301d37d3b908284db3f745a53df7660b4e`
(`dirty: false`). Produktquellhash:
`2bdf6fd3bd1887212468c8c569c4b74b5115ddac397b5aeba37fae6451dc6c79`;
Lockhash: `b471b4a1da63f4226f95a28b60f3345aa03e51803f0ef1982624cd16a2d35bc2`.
Damit stimmt der endgültige Produktcode mit den drei Skalierungs- und Warmmessungen
überein. Die anschließende Parser- und Interaktionsprüfkorrektur verändert keinen
Produktcode. Ein unabhängiger Gesamtreview fand keine weitere blockierende
Inkonsistenz.

| Prüfung                                           | Ergebnis                                                                                                                            |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `npm run test:atlas-p0`                           | 271 Tests in zehn Dateien bestanden.                                                                                                |
| `npm run typecheck`, `npm run typecheck:p0-tools` | Beide bestanden, einschließlich des endgültigen Prüfcode-Diffs.                                                                     |
| `npm run build:atlas-p0`                          | Sauberer Produktbuild mit oben genannter Identität.                                                                                 |
| Echte Electron-/SQLite- und Fixturetests          | 15 Tests bestanden.                                                                                                                 |
| Desktop-Smoke am Build                            | 83 Checks bestanden: 13 Normalstart, 19 Hänger-, 51 Lifecyclechecks.                                                                |
| Interaktionsrundlauf                              | 16 Prüfungen und fünf Fehlerkontrollen bestanden; ausgewählter Funktionsumfang besteht, native Abnahme bleibt blockiert.            |
| 32 / 1.024 / 9.000 reale Quellen                  | Alle drei Fach-/Pixel-/History-/Dateirundläufe am identischen Produktquellhash bestanden.                                           |
| Tatsächliches Forge-Paket                         | 123 ASAR-Einträge geprüft, genau Linux/x64-SQLite enthalten; 2.289 Archivdateien ausgeschlossen; 13 Checks am Paketstart bestanden. |
| Native Probe / reine Vorprüfung                   | Vier Inhaltskontrollen bestanden / keine Fixtures; beide bleiben `BLOCKED / Exit 2`.                                                |
| Format und Dokumentverweise                       | Geänderte Dateien formatiert, `git diff --check` und relative Ziele der fünf Dokumente geprüft.                                     |

Der erste Interaktionsabschluss verlangte volle kanonische Höhenwerte in der
Regionalansicht, nachdem die Feinquellen korrekt freigegeben worden waren.
Die vorhandene obligatorische Rückkehr zur Nahansicht lädt diese Quellen wieder.
Die unverändert strenge Prüfung aller vier endlichen Werte liegt nun dahinter;
Dosis, Stationarität und sämtliche Submitnachweise werden weiterhin vor Navigation
geprüft. Unbekannte grobe Proben zählen nie als bestanden. Der korrigierte echte
Rundlauf bestätigt danach Werte, Pixel, Undo/Redo, geschützte Feindaten, Save,
Reopen und Prozessneustart. Beide ursprünglichen Fehlerberichte bleiben erhalten.

Abschlussbelege liegen unter `artifacts/atlas-rebuild/remediation-final-smoke/`,
`remediation-final-interactions-corrected/` und `ci-package/`.

Der Ausgangshead `6f38bda` besitzt einen vollständig erfolgreichen
[Aggregate-CI-Lauf](https://github.com/ThonkTank/Salt-Marcher/actions/runs/42534745719),
einschließlich beider Paketpfade. Das ist kein Nachweis für den neuen Kandidaten.
Der erforderliche Check bleibt `Candidate · exact-SHA aggregate`.
Der neue veröffentlichte Kandidat benötigt seinen eigenen exakten CI-Nachweis;
dessen aktuellen Zustand zeigt der PR. Lokal fehlen weiterhin Cargo und
RPM-Bauwerkzeuge (`contracts:check` endet hier mit `cargo ENOENT`); die betroffenen
Pflichtprüfungen bleiben im Repository-Gate. Die Bedienabnahme einer installierten
RPM bleibt offen.

Vor P1 sind der warme 512-Pixel-Fall, die tatsächliche Präsentationszuordnung und die
vollständige native Stichprobe auf qualifizierter Referenz zu schließen. Bis dahin
bleiben P0 und der Gesamtauftrag offen; weder ein funktionierender Teilumbau noch
ein grüner Paket-/Funktionstest ersetzt diese Kriterien.
