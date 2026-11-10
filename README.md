# SaltMarcher · Atlas V7

Lokaler 2D-Weltatlas vom Raum bis zur Welt mit Straßen, Gelände, Gewässern,
Regionen, Parzellen und Hausinnenräumen. **Atlas V7 bleibt der reguläre Einstieg:**
React/Canvas, Rust/SQLite und Tauri. Im normalen Browser erscheint ein
Desktop-Hinweis. Der gesondert gestartete **Atlas-P0-Versuch** verwendet
Electron/Pixi und bietet bislang einen begrenzten Höheneditor.

| Dokument                                                | Maßgeblicher Inhalt                                             |
| ------------------------------------------------------- | --------------------------------------------------------------- |
| Dieses README                                           | Einrichtung, Befehle und Ausführung der Prüfungen               |
| [Architektur](docs/architecture.md)                     | Besitzer, Datenfluss, Transaktions- und Cachegrenzen            |
| [Produktvertrag](docs/product-contract.md)              | Aktuelles beobachtbares Verhalten, Dateiformat und Grenzen      |
| [Status](docs/implementation/status.md)                 | Geprüfter Stand, Ergebnisse, offene Fehler und nächste Übergabe |
| [Neubauplan](docs/implementation/atlas-rebuild-plan.md) | Zielumfang F01–F19/D01–D11, offene Pakete und Abnahmekriterien  |

Die vier Dokumente zum aktuellen Produkt werden aktualisiert, nicht als Chronik
fortgeschrieben. Der Neubauplan beschreibt zusätzlich den beauftragten Zielzustand.
R1 im Neubauplan hat den ersten additiven Pinselkandidaten an einem begrenzten
Wiederbesuchsfall widerlegt. R2 integriert den ausgewählten C1: einmalige
räumliche Mindestwirkung mit Anrechnung auf kumulierte Zeitwirkung, Reservierung
vor Annahme und begrenzte Fortsetzung bis zum vollständigen Aktionsabschluss.
Undo und Dateiaktionen warten auf diesen gemeinsamen Abschluss. Die unabhängige
Inhaltsreferenz und die festen Leistungsziele bleiben erhalten.
R3 begrenzt Quellenübernahme, Vorbereitung und GPU-Pakete; numerische
Ausnahmefälle laufen über die gemeinsame Jobzulassung im Worker. R4 ergänzt
die feste gemeinsame Richtungsprüfung. **R5 ergänzt den begrenzten P3.1-Fall
Wald und Lichtung:** maskierte Landschaft, gemeinsame History und Dateirundlauf.
Der [Status](docs/implementation/status.md) nennt die tatsächlichen Nachweise
und die weiterhin offenen R4-/Hardwarebelege. Der nächste Fachbaustein nach
P3.1 ist der einfache Hausheader aus P3.2; P4–P9 setzen die vollständige
P0-Abnahme und den bestandenen gemeinsamen P3-Fall voraus.
Detailbelege liegen ignoriert unter `src-tauri/target/diagnostics/`,
`src-tauri/target/cleanup/` oder `artifacts/atlas-rebuild/`.

## Einrichtung

CI und V7-Referenzmessungen verwenden Node.js 22.19.0 aus `.node-version` und
Rust 1.99.1 samt rustfmt/Clippy aus `rust-toolchain.toml`. Node entsprechend
auswählen; rustup liest die Toolchaindatei im Repository. Unter Fedora:

```bash
sudo dnf install -y gcc-c++ make webkit2gtk4.1-devel openssl-devel libappindicator-gtk3-devel librsvg2-devel libxdo-devel
rustup show active-toolchain
npm ci
npx playwright install chromium # einmalig; optional --with-deps
npm run desktop
```

Neue V7-Dokumente beginnen als Ozean; „Höhen → Land“ legt Land an.
Werkzeuge, Gesten und Dateiabläufe stehen im [Produktvertrag](docs/product-contract.md).

## Entwicklung und automatisierte Prüfung

| Befehl                       | Zweck                                                                        |
| ---------------------------- | ---------------------------------------------------------------------------- |
| `npm run desktop`            | Regulären V7-/Tauri-Desktop starten.                                         |
| `npm run check`              | Verträge, TypeScript-Typen sowie TypeScript- und Rusttests prüfen.           |
| `npm run check:all`          | Zusätzlich Clippy, Format, Webbuild, Browsertests und P0-Integration prüfen. |
| `npm run package -- --ci`    | Konfiguriertes V7-/Tauri-Release mit RPM bauen.                              |
| `npm run format`             | Prettier und rustfmt anwenden.                                               |
| `npm run contracts:generate` | Transportverträge nach Rust-Typänderungen neu erzeugen.                      |

Einzelprüfungen: `npm run contracts:check`, `npm run typecheck`, `npm test`,
`npm run test:rust`, `npm run check:rust`, `npm run format:check`,
`npm run build:web` und `npm run test:e2e -- terrain-live.spec.ts`.
`src/atlas/generated/` wird ausschließlich aus Rust erzeugt.

Cargo verwendet `--locked`, JavaScript-Abhängigkeiten `npm ci`.
`.cargo/config.toml` begrenzt Builds und Rusttests auf zwei Jobs/Testthreads;
Vitest verwendet zwei, Playwright einen Worker. `check:all` läuft sequenziell.
Nicht mehrere Gesamtprüfungen gleichzeitig starten; unter Linux kann
`nice -n 10 npm run check:all` der Desktopbedienung Vorrang geben.

Der Entwicklungsserver verwendet Port 1420. Produkttests starten einen eigenen
Vite-Server auf `127.0.0.1:1421`; ein belegter Port führt zum Abbruch.
Testworker verwenden `src-tauri/target/`, unabhängig von `CARGO_TARGET_DIR`.
Browserbelege liegen unter `src-tauri/target/diagnostics/playwright-<run>/`.
GitHub Actions prüft den exakten PR-Head beziehungsweise Main-Commit im Check
`Candidate · exact-SHA aggregate`. Welche Prüfungen und Artefakte am aktuellen
Kandidaten tatsächlich bestanden haben, steht im [Status](docs/implementation/status.md).

## Optionaler Atlas-P0-Versuch

P0 startet einen eigenen Electron-44-Desktop mit PixiJS-8-Darstellung und SQLite
im Utility-Prozess. Numerische Höhenquellen werden auf der GPU zusammengesetzt.
Gleichstufige Striche und Undo verwenden eine feste numerische Basis mit dem
damaligen Stufenbeitrag. Nur der aktuelle Beitrag dieser Stufe wird neu projiziert;
beibehaltene Farbkacheln dienen der Kamera- und Cursorzeichnung.
Eine nicht blockierende GPU-Rückmeldung begrenzt ausstehende Zeichenarbeit. Der
[P0-Produktvertrag](docs/product-contract.md#optionaler-atlas-p0-versuch)
beschreibt Funktionen und Grenzen; die
[Architektur](docs/architecture.md#optionaler-atlas-p0-versuch) die Zuständigkeiten.

Node.js bleibt durch `.node-version` vorgegeben; Forge benötigt mindestens
22.13.0. Nach `npm ci` prüft `build:atlas-p0` eine echte SQLite-Datenbanköffnung
in der gepinnten Electron-Laufzeit und führt bei unpassender ABI
`@electron/rebuild` aus. Dafür können C++-Buildwerkzeuge und Python nötig sein.

| Befehl                                                                                       | Zweck                                                                                                                                     |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run build:atlas-p0`                                                                     | P0-Typen prüfen, Renderer/Desktop bauen und SQLite-ABI vorbereiten.                                                                       |
| `npm run desktop:atlas-p0`                                                                   | P0 bauen und im eigenen Electron-Fenster starten.                                                                                         |
| `npm run test:atlas-p0`                                                                      | Modell-, Raster-, Renderer-, Auswerter- und native Vorprüfungstests ausführen.                                                            |
| `npm run typecheck:p0-tools`                                                                 | Ausführbaren Auswerter anhand seiner eigenen JSDoc-Verträge prüfen.                                                                       |
| `npm run test:atlas-p0:smoke`                                                                | Gebauten Electron-Start mit echter Prozess-/SQLite-Anbindung prüfen; `--only normal`, `stall` oder `lifecycle` begrenzt den Umfang.       |
| `npm run check:atlas-p0`                                                                     | Tool-Typen, Build, Store-/Fixturetests, echten Electron-Smoke und GPU-Pixelreferenz einschließlich Kontextwiederherstellung prüfen.       |
| `npm run p0:lab`                                                                             | Den zuvor gebauten Stand als kurze softwaregerenderte Architekturprobe prüfen.                                                            |
| `npm run p0:native`                                                                          | Native Vorprüfung ausführen und nur bei erfüllten Voraussetzungen Szenarien sammeln.                                                      |
| `npm run p0:direction -- --reference pfad/profil.json`                                       | Feste R4-Hardwarematrix mit gemeinsamem Inhalts-, Zeit- und Ressourcenurteil anfordern. Fehlende Voraussetzungen blockieren vor Fixtures. |
| `npm run p0:lab -- --full`                                                                   | Vollständige P0-Stichprobe im Labor sammeln.                                                                                              |
| `npm run p0:native -- --full --reference pfad/profil.json`                                   | Native Vollsammlung anfordern; fehlende Präsentationsanbindung blockiert vor Fixtures.                                                    |
| `npm run p0:evaluate -- pfad/zum/report.json`                                                | Einen Bericht gegen die festen Anforderungen auswerten.                                                                                   |
| `node scripts/atlas-p0-gpu-check.mjs --out src-tauri/target/diagnostics/atlas-gpu-reference` | Den gebauten Editor gegen die CPU-Höhenreferenz prüfen: echte Pixel, 22 Stufen, Übersichten, Weltgrenzen und numerische Ausnahmefälle.    |
| `npm run package:atlas-p0`                                                                   | Mit Forge ein startbares Anwendungsverzeichnis erzeugen.                                                                                  |
| `npm run make:atlas-p0`                                                                      | RPM-/ZIP-Artefakte erzeugen; RPM benötigt die Paketbauwerkzeuge.                                                                          |
| `npm run check:atlas-p0:package`                                                             | Paket bauen, ASAR-Inhalt prüfen und den ausgelieferten Einstieg mit Dateirundlauf starten.                                                |

Die Runner schreiben nach jedem Szenario Ergebnisse unter
`artifacts/atlas-rebuild/runs/`; der Laufindex erhält fehlgeschlagene und noch
nicht ausgeführte Fälle. Weitere Optionen nach `--`:

- `--executable /absoluter/pfad/zur/anwendung`: einen Forge-Paketstand verwenden.
- `--trace`: eine begrenzte Chromium-Aufzeichnung zusätzlich sammeln.
- `--only interactions`, `--only scaling` oder `--full --only collection`:
  gezielte, ausdrücklich unvollständige Diagnosen.
- `--full --only collection --case M06-height-busy --runs 1`: einen benannten
  Collectionfall in einer Gruppe untersuchen.

Kurze Probe und vollständige Sammlung verwenden dieselben Eingaben und
Inhaltsprüfer. Die Auswahl verkleinert nicht den Abnahmeumfang. Pflichtfälle,
Stichproben, Fehlerkontrollen und Zeitgrenzen stehen einmal im
[Prüfvertrag](docs/implementation/atlas-rebuild-plan.md#6-prüf--und-performancevertrag).
Aktuelle Runnerberichte verwenden Schema 6. `p0:evaluate` akzeptiert nur dieses
Schema; historische Rohbelege bleiben unverändert und benötigen ihren zugehörigen
Auswerterstand. Schema 6 trennt Erfassung, C1-Annahme/Reservierung,
Materialisierung, Versiegelung, vollständigen Aktionsabschluss und Darstellung.
Ordinalbereiche prüfen jede Reservierungsübernahme genau einmal; vollständige
Render-Receipts belegen nur ihren eingefrorenen Einfluss. Historische Messgrößen
werden nicht als neue Abschluss-, Upload- oder Drawzeiten umgedeutet.

`--only interactions` umfasst auch einen mehrere Sekunden gezogenen
512-Pixel-Pinsel, getrennte Live-Pixelproben, einen geknickten Strich, Halten,
langsame/schnelle Züge, einen echten UI-Hänger und aufeinanderfolgende feine/grobe
Gesten. Der unveränderte
kurze 512-Pixel-Fall bleibt über `--only collection --case M03-height-max --runs 1`
anwählbar. Die GPU-Referenzprüfung verwendet denselben gebauten Editor und echte
Projektdateien. Sie prüft auch 64 aufeinanderfolgende Änderungen einschließlich
Undo/Redo, feine Autoren unter groben Übersichten und Kontextwiederherstellung.
Ihre Pixelbilder und gespeicherten Autorenwerte belegen Inhalt, keine
Präsentationslatenz.

Der normale Smoke enthält außerdem P3.1: grober Wald, feine Lichtung, erneute
grobe Änderung, Undo/Redo und sichtbarer Escape-Abbruch, echte Dateisicherung,
Neu/Open und ein frischer Prozess ohne Diagnosemodus. Landschaftspixel und
unabhängig gelesene Autorenwerte werden gemeinsam geprüft; die Höhenquellen
und feinen Ausnahmen müssen unverändert bleiben. `--only landscape` führt
diesen bestehenden Fall gezielt aus.

Ein Headless-Funktionslauf belegt keine native Leistung; Submission und RAF sind
keine Präsentationszeitpunkte. Fehlende Messanbindung und Umgebungsqualifizierung
bleiben ausdrücklich offen. Ein Paketstart ersetzt keine RPM-Installation.

### R4-Richtungsprüfung

`p0:direction` verwendet den bestehenden Runner mit `--native --direction`.
Die feste Auswahl in `R4_REQUIREMENTS` umfasst zwölf Fälle in zwei frischen
Prozessgruppen: kleine und große Pinsel, Autorenstufen 0/4/9/21, leere und
mehrskalige Quellen, den Skalenwechsel um 0,01 sowie dieselbe lokale Bearbeitung
bei 32/1.024/9.000 Quellen. Der erste lokal freigegebene Klick nach Navigation, normale vollständig bereite
Wege, Stufenwechsel, Undo und tatsächlich laufendes Save sind enthalten. Kurze Fälle verlangen je 30 Gesten; Kurve und
Halten dauern mindestens zehn Sekunden. Die R4-Auswahl lässt sich nicht durch
`--only`, `--case` oder `--runs` verkleinern.

Tatsächliche Autorenänderungen werden gegen die unabhängige C1-Referenz geprüft,
einschließlich räumlicher Regionen und vollständiger Sekunden. Eingabeverlust,
zu geringe Wirkung oder ein gemessener Budgetfehler bleiben Fehler, auch wenn
weitere Hardwarebelege fehlen. Nicht ausgeführte Fälle bleiben im Laufindex.
Nach einem entscheidenden Fehler stoppt die Richtungsprobe; spätere große
Fixtures werden erst bei Bedarf erzeugt.

`npm run p0:lab -- --direction` verwendet dieselbe Auswahl mit Softwaregrafik
zur Diagnose. Es kann R4 nicht freigeben. R4 benötigt echte Hardware und
qualifizierte Zeitintervalle tatsächlich geänderter Geländebilder; der aktuelle
Beobachtungsweg kann diesen sichtbaren Takt noch nicht nachweisen. Diese Grenze
ist von R5s zusätzlicher Zuordnung jeder Eingabe zur Präsentation getrennt.
Der Auswerter liefert den formalen Messbefund, einschließlich `allowNextPhase`.
Die ausdrücklich freigegebene begrenzte Fortsetzung mit R5 steht getrennt davon
in der [Arbeitsentscheidung](docs/implementation/status.md#arbeitsentscheidung).
Der Status nennt außerdem die ausgeführten Prüfungen und offenen Belege.

### Begrenzte Grafikdiagnose

Nach einem sauberen Build vergleicht derselbe Driver einen echten 512-Pixel-Strich
auf einfachem und auf lokal mit 22 Höhenstufen belegtem Terrain. Eine dritte
Kontrolle bewegt den Zeiger über bereits komponierte Kacheln ohne Bearbeitung.
Sie trennt die allgemeine Bildausgabe von der laufenden Höhenrekonstruktion:

```bash
node scripts/atlas-p0-graphics-probe.mjs --hardware --runs 3 --gpu-timers --out src-tauri/target/diagnostics/graphics-hardware
```

`--lab` verwendet ausdrücklich Softwaregrafik. Jeder Fall startet in einem
frischen Prozess; der vorhandene lange Strich behält 101 Positionen mit
24-ms-Abständen. Die Diagnose erhält alle Fallfehler, Quellen-/Buildidentität,
Kompositionsarbeit und Swap-Spannen. Kanonisch rekonstruierte Samples, lokale
Delta-Samples, horizontale Zwischenarbeit, Basisaufnahmen, Farbarbeit und Kopien
des numerischen Ausgangsstands werden getrennt gezählt. Tatsächliche GPU-Zeit wird auf die gemeldeten geänderten Samples
bezogen; die Anzahl der GL-Aufrufe ist kein Ersatz für Pixelarbeit.
Optionale asynchrone GPU-Zeitabfragen werden
nur bei vorhandener Erweiterung ausgewertet; fehlende oder ungültige Ergebnisse
bleiben offen. Trace und Zeitabfragen können die Laufzeit beeinflussen.

Auch auf Hardware ist dieser Vergleich keine native Abnahme und beweist keinen
ersten sichtbaren Terrainframe. Die statische Kontrolle ist keine Pinselprüfung.
Die formale Präsentationszuordnung und die festen P0-Grenzen bleiben erforderlich.

### Native Referenz und Vorprüfung

```bash
npm run p0:native -- --preflight --reference pfad/profil.json
npm run p0:native -- --probe-native --out artifacts/atlas-rebuild/native-probe
npm run p0:lab -- --probe-native --out artifacts/atlas-rebuild/lab-presentation-probe
```

`--preflight` prüft Voraussetzungen und erzeugt keine Fixtures. `--probe-native`
verwendet die kleine gespeicherte Küstenfixture für kurze echte Pinseleingaben:
Normalfall, unterdrückte Terrainzeichnung bei bewegtem Overlay, verzögerte
Terrainzeichnung und anschließende Erholung. Drei unabhängige Terrainbereiche
werden in den Tracebildern geprüft; ihre Framekennungen werden mit den Reportern
des tatsächlichen Atlas-Renderers verglichen.
Beide sind von `--full` und Szenarioauswahl getrennt. Für einen vorhandenen
Paketstand kann `--executable` ergänzt werden. Ohne natives Display wird vor
Buildzugriff, Programmstart und Fixtureerzeugung ein Blockerbericht geschrieben.
Nur die ausdrücklich gewählte Kombination `--lab --probe-native` führt denselben
kleinen Messversuch mit Software-Rendering aus. Sie qualifiziert keine native
Referenz und bleibt auch bei bestandenen Inhaltskontrollen `BLOCKED`.

Auf einem nativen Display entsteht `reference-observed.json` mit leerer `id`.
Eine bewusst ausgewählte Referenz erhält eine eindeutige ID und wird über
`--reference` erneut gegen die Beobachtungen geprüft: CPU/GPU, Plattform,
Architektur, OS, RAM, Display und Frequenz sowie 1440×960/DPR 1 müssen stimmen;
Hardwarebeschleunigung, sichtbares Fenster und Fokus müssen beobachtet sein.
Die Vorlagen-Datei selbst nominiert noch keine Referenz.

Eine passende Referenz beweist keine Präsentation. Die Probe kann Bildkennungen
mit erfolgreichen Compositor-Reportern verbinden. Die vollständige Zuordnung
einer exakten Atlas-Generation zur ersten tatsächlichen Präsentation fehlt
weiterhin: Copy-/Refresh-Aufnahme und Screenshot besitzen in der gepinnten Trace
keine gemeinsame nachweisbare Identität; die getestete Vorher-/Nachher-Signatur
unterscheidet zudem nicht jede Zwischenrevision. Deshalb stoppen native
Sammlungen vor ihren Fixtures mit **BLOCKED / Exit 2**; Captures, RAF und
Trace-Nachbarschaft werden nicht als Ersatz akzeptiert.
Technische Vorprüfungsfehler bleiben **FAIL / Exit 1**. `native-preflight.json`,
`report.json` und `run-index.json` halten diese Grenze fest; nicht ausgeführte
Szenarien werden nicht als gemessene Fehler oder bestandene Abnahme ausgegeben.

## V7-Performanceprüfungen

`npm run test:lod` prüft Budgets, Auflösungswechsel und Cachelebensdauer;
`npm run test:lod:e2e` prüft Navigation und Invalidierung mit echtem Kern.
Deterministische Arbeits-/Speicherbudgets gehören in CI, maschinenabhängige
Zeitziele in die Referenzabnahme.

### Gelände vergleichen

```bash
npm run perf:terrain:capture -- src-tauri/target/cleanup/terrain-before
npm run perf:terrain -- src-tauri/target/cleanup/terrain-before
npm run perf:terrain
```

`capture` sichert Release-Artefakte samt Quell-/Binärhashes vor einer Änderung.
Der Vergleich verwendet feste Autorenfixtures, Seeds und Weltpfade für neun
Fälle: zwei Pinselgrößen/Pfadlängen auf leerer oder bebauter Küste sowie eine
Übersicht mit 120.000 Kontrollwerten. Er prüft Node-/Rustversionen und
Fingerprints; eine vorhandene Sicherung wird nicht überschrieben.

Rohmessungen, Umgebung und `comparison.json` liegen unter
`src-tauri/target/cleanup/atlas-simplify/terrain-<run>/`. Reihenfolge ist Baseline
vor Kandidat; der Betriebssystemcache wird nicht geleert, 16 ms Eingabepause ist
eine Mindestpause. Auf derselben Referenzmaschine gelten für interaktive Fälle
p95 ≤16,7 ms Zeichenzeit und ≤50 ms bis zur sichtbaren Bestätigung. Mehrere
vergleichbare Läufe sind erforderlich. Browser/JSONL ersetzt keine native
Tauri-IPC-Abnahme; die Messgrenzen stehen in der Architektur.

Für einen direkten Lauf zuerst `npm run perf:build` und den ignorierten Rust-Test
`terrain_performance_fixtures` ausführen, danach
`npm run perf:measure -- terrain.spec.ts`. `ATLAS_TERRAIN_FIXTURES` wählt die
Fixtures; Vorgabe ist `src-tauri/target/diagnostics/terrain-performance`.
Der kleine Weltkartenfall benötigt keine Fixtures:
`npm run perf:measure -- world-brush.spec.ts --repeat-each=3` nach `perf:build`.

### Große Stadt-/Weltfixtures

```bash
cargo test --locked --manifest-path src-tauri/Cargo.toml --lib city_scale_benchmark -- --ignored --nocapture
cargo test --locked --manifest-path src-tauri/Cargo.toml --lib world_scale_benchmark -- --ignored --nocapture
npm run perf:build
npm run perf:measure -- release.spec.ts
ATLAS_CITY_BENCHMARK=1 npm run perf:measure -- city-navigation.spec.ts
```

Fixtures entstehen aus dem aktuellen Format unter
`src-tauri/target/diagnostics/city/` beziehungsweise `world/`.
`ATLAS_PERF_FIXTURE` wählt `city-100000`, `city-250000` oder `world-10000`.
Der Release-Lauf prüft Öffnen, erste Ansicht, Einpassen, Verschieben und alle
14 Ansichten bei 1440×960 CSS-Pixeln, DPR 1 und Port 1422. Ergebnisse liegen unter
`src-tauri/target/cleanup/atlas-simplify/performance-<run>/`;
`ATLAS_PERF_OUTPUT` wählt einen anderen Pfad. `ATLAS_MEASURE_WORKER=1` ergänzt
Workerzeit einschließlich Queue zu Roundtrip und Transportbytes.

## Native Bedienabnahme

Nach Interaktions- oder Dateiänderungen die frisch gebaute Desktopanwendung
bedienen. Relevante Fälle aus dem Produktvertrag auswählen: Dateiannahme/-abbruch,
Navigation, Gesten/Entwürfe, History, Kontextwechsel und Wiederöffnen.
Bei Dialogänderungen auch Fokus, Tab/Umschalt+Tab und Escape bei 900×620 prüfen.

Plattform, Skalierung, Kandidatenidentität und Ergebnisse im Diagnoseverzeichnis
festhalten. Dateivergleiche verwenden SQLite-Integrität und Autorentabellen in
Primärschlüsselreihenfolge. Anschließend den [Status](docs/implementation/status.md)
durch den geprüften Stand und verbleibende Abnahmen ersetzen. Erfolgreiche
Teilprüfungen belegen weder Gesamtgrün noch native Leistungsfreigabe.
