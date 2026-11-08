# SaltMarcher · Atlas V7

Lokaler 2D-Weltatlas vom Raum bis zur Welt mit Straßen, Gelände, Gewässern,
Regionen, Parzellen und Hausinnenräumen. React zeichnet auf Canvas, Rust verwaltet
SQLite, Tauri stellt die Desktopanwendung bereit. Im normalen Browser erscheint
ein Desktop-Hinweis.

Atlas V7 bleibt die Standardanwendung. Daneben ist ein ausdrücklich optionaler
[Atlas-P0-Höhenversuch](#optionaler-atlas-p0-versuch) mit Electron und PixiJS
implementiert, der die Tragfähigkeit der geplanten Architektur untersucht.

| Dokument                                   | Maßgeblicher Inhalt                                            |
| ------------------------------------------ | -------------------------------------------------------------- |
| Dieses README                              | Einrichtung, Befehle und Abnahmeablauf                         |
| [Architektur](docs/architecture.md)        | Besitzer, Datenfluss, Transaktions- und Cachegrenzen           |
| [Produktvertrag](docs/product-contract.md) | Beobachtbares Verhalten, Dateiformat und Grenzen               |
| [Status](docs/implementation/status.md)    | Zuletzt belegter Prüfstand, offene Fehler und nächste Übergabe |

Diese vier Dokumente werden ersetzt und aktualisiert, nicht als Arbeitschronik
fortgeschrieben. Messreihen, Sicherungen und Detailprotokolle gehören unter die
ignorierten Pfade `src-tauri/target/cleanup/`, `src-tauri/target/diagnostics/`
oder für P0 unter `artifacts/atlas-rebuild/`.

Der angeforderte [ausführbare Atlas-Neubau- und Aufräumplan](docs/implementation/atlas-rebuild-plan.md)
enthält den vollständigen Zielumfang F01–F19 mit D01–D11,
Architekturentscheidungen, Arbeitspaketen und Abschlusskriterien. Ein Verweis
darauf mit „erledige das“ beauftragt seine vollständige Ausführung P0–P9.
Der Aufräumplan wurde zur Umsetzung beauftragt; nach dem Review vom 8. November
ist die nächste Fortsetzung zunächst **geplant**. D11 präzisiert: Erst sichtbares,
lokal bereites Gelände bearbeiten, den Wartezustand anzeigen und verkürzen.
Eine gemeinsame Freigabe, lokale Rasterpriorität und Reads während Save sind
die nächsten Pakete; diese Änderungen sind noch nicht implementiert.
Im bisherigen P0-Kern sind ein gemeinsamer Prüfablauf, ein begrenzter Patch-/Renderweg
und numerische Übersichten über feine Quellen bereits umgesetzt.
Der vollständige Ausbau folgt dem P0-Gate; die tatsächlichen Produktnachweise
und verbliebenen Fehler entscheiden über diesen Übergang.
Der [Status](docs/implementation/status.md) hält die vorhandenen Teilnachweise
und die weiterhin offene native Abnahme fest.
Der P0-Pinsel verwendet die vereinbarte zeitabhängige Wirkung: Halten wirkt
weiter, langsamere Züge wirken stärker. Kleine Dosen folgen dem sichtbaren
Fortschritt; bei Verzögerungen wird keine zusätzliche Wirkung für später
angesammelt.
Die V7-Abschnitte beschreiben die bestehende Standardanwendung, die gesonderten
P0-Abschnitte den implementierten Höhenversuch und seine Prüfgrenzen.

## Einrichtung

CI und Referenzmessungen verwenden Node.js 22.19.0 aus `.node-version` und
Rust 1.99.1 samt rustfmt/Clippy aus `rust-toolchain.toml`. Node muss entsprechend
installiert/ausgewählt sein; rustup liest die Toolchaindatei im Repository.
Benötigt werden außerdem npm und Tauri-Systembibliotheken. Unter Fedora:

```bash
sudo dnf install -y gcc-c++ make webkit2gtk4.1-devel openssl-devel libappindicator-gtk3-devel librsvg2-devel libxdo-devel
rustup show active-toolchain
npm ci
npx playwright install chromium # einmalig; optional --with-deps
npm run desktop
```

Neue Dokumente beginnen als Ozean; „Höhen → Land“ legt Land an.
„Höhen → Bergkette / Hügel / Schlucht“ ergänzt Relief mit Größenvorlagen und
einstellbarer Breite sowie Höhe/Tiefe in Metern. Hohe Gipfel erscheinen schneeweiß,
steile Hänge steinig. „Boden → Farbebene“ färbt Boden und Fels unabhängig.
„Landschaft“ malt Wald, Buschland, Wiese und Felsgebiet auf allen Außenmaßstäben;
Zieldichte und lokales Entfernen bearbeiten den Bestand, die Darstellung folgt dem Zoom.
Werkzeuge, Gesten, Ansichtsauswahl und Dateiabläufe beschreibt der Produktvertrag.

## Optionaler Atlas-P0-Versuch

Der Versuch startet einen eigenen Electron-44-Desktop mit PixiJS-8-Darstellung,
lokalem TypeScript-Höhenmodell und SQLite in einem Utility-Prozess. Er umfasst
Navigation, Anheben/Absenken, Undo/Redo sowie echte Projektdateien. Die
[Architektur](docs/architecture.md#optionaler-atlas-p0-versuch) beschreibt die
Besitzer, der [Produktvertrag](docs/product-contract.md#optionaler-atlas-p0-versuch)
den begrenzten Funktionsumfang. `npm run desktop` und `npm run package` bleiben
die V7-/Tauri-Befehle.

Vorgegeben bleibt Node.js 22.19.0 aus `.node-version`; Forge benötigt mindestens
22.13.0. Die P0-Arbeitssitzung verwendet Node.js 24.22.1. Nach `npm ci` bereitet
`build:atlas-p0` auch die native SQLite-Bibliothek für die gepinnte Electron-ABI
vor: Es prüft eine echte Datenbanköffnung und führt bei Bedarf `@electron/rebuild`
aus. Dafür werden gegebenenfalls ein C++-Buildwerkzeug und Python benötigt.

| Befehl                                        | Zweck                                                                                                        |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `npm run build:atlas-p0`                      | P0-Typprüfung, Renderer-/Desktopbuild und SQLite-ABI-Vorbereitung.                                           |
| `npm run desktop:atlas-p0`                    | P0 bauen und im eigenen Electron-Fenster starten.                                                            |
| `npm run test:atlas-p0`                       | Modell-, Raster-, Renderer- und Auswertertests unter `src/editor/`.                                          |
| `npm run check:atlas-p0`                      | P0 bauen sowie SQLite-Store- und Skalierungsfixturetests in Electrons Node-Laufzeit ausführen.               |
| `npm run p0:lab`                              | Den zuvor gebauten Stand im softwaregerenderten Headless-Labor funktional und auf Skalierungsgrenzen prüfen. |
| `npm run p0:native`                           | Dieselben Prüfungen auf einem vorhandenen nativen Display ausführen.                                         |
| `npm run p0:lab -- --full`                    | Zusätzlich die vollständige P0-Stichprobe in drei unabhängigen Gruppen sammeln.                              |
| `npm run p0:native -- --full`                 | Die vollständige Sammlung auf einem vorhandenen nativen Display ausführen.                                   |
| `npm run p0:evaluate -- pfad/zum/report.json` | Einen Bericht gegen die festen P0-Nachweisanforderungen auswerten.                                           |
| `npm run package:atlas-p0`                    | Mit Electron Forge ein startbares Anwendungsverzeichnis erzeugen.                                            |
| `npm run make:atlas-p0`                       | Mit Electron Forge RPM-/ZIP-Artefakte erzeugen; RPM benötigt die Systemwerkzeuge zum Paketbau.               |

Die Runner schreiben Berichte und Inhaltsbelege unter
`artifacts/atlas-rebuild/runs/`. Zusätzliche Optionen werden mit `--` an `p0:lab`
oder `p0:native` weitergereicht. `--executable /absoluter/pfad/zur/anwendung`
prüft einen Forge-Paketstand. `--trace` aktiviert zusätzlich eine begrenzte
Chromium-Aufzeichnung. Der normale Produktstart sammelt kein Diagnosejournal;
die Runner schalten es ausdrücklich ein. Die native Umgebungsprüfung erfolgt
vor der Fixtureerzeugung. Ein Paketstart ersetzt keine RPM-Installation.
Der konkrete Prüfstand steht
ausschließlich im Statusdokument.

Ohne `--full` läuft eine kurze Architekturprobe mit einem Versuch je Fall.
Sie verwendet denselben Gesten- und Inhaltsprüfer wie die vollständige Sammlung.
Ergebnis und Auswertung werden nach jedem Szenario gesichert; der Laufindex
behält fehlgeschlagene und noch nicht ausgeführte Fälle. Rohereignisse stehen
einmal pro Prozess, statt in jedem Versuch erneut eingebettet zu werden.
`--full` beauftragt drei unabhängige Gruppen mit jeweils 100 echten bewegten
Strichen je warmem Fall (kleiner und großer Pinsel, grob über fein sowie unter
Hintergrundarbeit und Speichern) und 34 kalten Ortswechseln mit anschließender
Bearbeitung je kaltem Fall. Die beiden kalten Fälle laufen ohne und mit
Hintergrundlast. Die Navigationsfälle mit und ohne Raster laufen je Gruppe
jeweils mindestens 30 Sekunden.
Fehlgeschlagene oder abgebrochene Versuche bleiben im Bericht; fehlende
Stichproben werden nicht durch andere Fälle ersetzt. Kalte Daten bedeuten einen
zuvor nicht geladenen Ausschnitt nach normalem Projektöffnen, keinen geleerten
Betriebssystem-Dateicache.

Für gezielte Diagnosen stehen `--only interactions`, `--only scaling` und
`--full --only collection` zur Verfügung. Diese Auswahl ist ausdrücklich
unvollständig: Die Gesamtauswertung verlangt weiterhin alle Pflichtfälle und
kann deshalb aus einer Teilprüfung kein Gesamt-`PASS` ableiten.
Die Sammlung lässt sich dabei mit `--case M06-height-busy --runs 1` auf einen
benannten Fall und eine Gruppe begrenzen; die Abnahmeanforderungen bleiben
unverändert bei allen Fällen und drei unabhängigen Gruppen.

Die Skalierungsfälle verwenden echte gespeicherte Höhenprojekte mit 32, 1024
und 9000 Quellkacheln im selben groben Ausschnitt. Ihre dekodierten Quelldaten
umfassen 1, 32 beziehungsweise 281,25 MiB; der größte Fall überschreitet damit
das Quellbudget von 256 MiB. Die Busy-Datei enthält 9008 echte Quellkacheln
einschließlich einer zweiten Küste für kalte Ortswechsel. Die Tests prüfen
kanonische Höhen, sichtbare Änderungen, erhaltene Feindaten und Dateirundläufe;
die Skalierungsfälle erfassen außerdem den aktiven Quellspeicher und die
Store-Reads während grober Navigation und Bearbeitung. Grobe Ansichten lesen
maßstabsgerechte numerische Übersichten und nur erforderliche grobe Autoren.
Exakte Detailreads behalten ihre Grenze von 512 gelieferten Autorenkacheln.
Die Auswahl begrenzt Raum und Quellenstufe bereits im RTree. Übersichtspflege,
Zwischenstufen der Navigation und kalte Detailreads bleiben Teil des Nachweises;
dieser P0-Kernversuch ist noch nicht die vollständige Umsetzung von P3.

Die Fehlerkontrollen gehören verpflichtend zum vollständigen Funktionslauf:
`ignore-zoom` muss am sichtbaren Zoom scheitern, `pointerup-render` an der
laufenden Darstellung vor dem Loslassen. Jeweils muss derselbe Check ohne
Störung wieder bestehen. Die bestehenden Kontrollen `delay-render`,
`drop-render` und ihre Erholung bleiben erhalten. `--negative-controls` ist
dafür nicht mehr erforderlich. Fehlen verpflichtende Inhalte, Kontrollen oder
der Nachweis der Überlappung von Bearbeitung, Hintergrundarbeit und Speichern,
verhindert dies das funktionale `PASS` und führt zu Exit 1.

Ein erfolgreicher Funktionstest im softwaregerenderten Headless-Labor ist keine
native Performancefreigabe. Die P0a-Rust-Baseline fehlt; im Labor ist
`displayHz: 0`. Atlas-Generation und tatsächliche Compositor-Präsentation sind
noch nicht eindeutig verbunden, und ein qualifizierter nativer Nachweis steht
weiter aus. Auch eine vollständige Sammlung mit `--full` lässt das native Gate
deshalb `BLOCKED`. Submission- und RAF-Zeiten ersetzen den Präsentationsnachweis
nicht. Der vollständige Ausbau P1–P9 wartet auf das P0-Gate.

## Entwicklung und automatisierte Abnahme

```bash
npm run check           # Verträge, Typen, TypeScript- und Rusttests
npm run check:all       # zusätzlich Clippy, Format, Webbuild, Browsertests und check:atlas-p0
npm run package -- --ci # konfiguriertes natives Release-/RPM-Paket
npm run format          # Prettier und rustfmt
```

Einzelprüfungen: `npm run typecheck`, `npm test`, `npm run test:rust`,
`npm run check:rust`, `npm run format:check`, `npm run build:web` und
`npm run test:e2e -- terrain-live.spec.ts`. Nach Änderungen an Rust-Transporttypen
`npm run contracts:generate` ausführen; `contracts:check` prüft ohne Quelländerung.
`src/atlas/generated/` wird ausschließlich aus Rust erzeugt.

Cargo-Prüfungen verwenden `--locked`, JavaScript-Abhängigkeiten `npm ci`.
`.cargo/config.toml` begrenzt Builds und Rusttests auf zwei Jobs/Testthreads;
Vitest verwendet zwei, Playwright einen Worker. `check:all` führt Prüfungen
sequenziell aus. Nicht mehrere Gesamtprüfungen gleichzeitig starten; unter Linux
kann `nice -n 10 npm run check:all` der Desktopbedienung Vorrang geben.

Der Entwicklungsserver verwendet Port 1420. Produkttests starten ihren eigenen
Vite-Server auf `127.0.0.1:1421`; ein belegter Port führt zum Abbruch.
Testworker-Build und -Start verwenden `src-tauri/target/`, unabhängig von
`CARGO_TARGET_DIR`. Browserbelege liegen unter
`src-tauri/target/diagnostics/playwright-<run>/`. Testanbindung und
Zeichenbestätigungen stehen in der [Architektur](docs/architecture.md#entwicklung-und-prüfungen).

GitHub Actions prüft den exakten PR-Head beziehungsweise den gepushten Main-Commit.
Der erforderliche Check führt `check:all` und den konfigurierten RPM-Build aus.
Browserdiagnosen und vorhandene Checklogs werden sieben Tage aufbewahrt.
Native Bedienabnahme und Referenzlatenzen sind getrennte Prüfschritte.

## Performanceabnahme

`npm run test:lod` prüft Kachelbudgets, Auflösungswechsel und Cachelebensdauer;
`npm run test:lod:e2e` prüft Ansichten, Navigation und Invalidierung mit echtem
Kern. Diese Teilmengen gehören zur Gesamtsuite. Deterministische Arbeits- und
Speicherbudgets gelten in CI; maschinenabhängige Zeitziele in der Referenzabnahme.

### Gelände vergleichen

Der Release-Treiber verwendet neun feste Fälle: zwei Pinselgrößen und Pfadlängen
auf leerer/bebauter Küste sowie eine Übersicht mit 120.000 Kontrollwerten.
Autorenfixtures, Seed und Weltpfade sind festgelegt. Er misst Workerzeit,
Transportvolumen, Bestätigung, Zeichnen und sichtbare Bestätigung.

```bash
# Vor dem Umbau: Release-Artefakte samt Quell-/Binärhashes sichern
npm run perf:terrain:capture -- src-tauri/target/cleanup/terrain-before
# Nach dem Umbau: dieselben Fälle und Fixtures gegen beide Builds messen
npm run perf:terrain -- src-tauri/target/cleanup/terrain-before
# Nur den aktuellen Stand messen
npm run perf:terrain
```

Der Treiber prüft die exakten Node-/Rustversionen, baut mit Lockfile und erzeugt
Fixtures vor der Messung. Er überschreibt keine Sicherung und verwirft veränderte
Fingerprints oder unvergleichbare Fälle. Rohmessungen, Umgebungsdaten und
`comparison.json` liegen unter `src-tauri/target/cleanup/atlas-simplify/terrain-<run>/`.
Reihenfolge ist Baseline vor Kandidat; der Betriebssystemcache wird nicht geleert.
Die Pause von 16 ms ist eine Mindestpause, keine garantierte Eingaberate.

Auf derselben Referenzmaschine gelten für die interaktiven Geländefälle
p95 ≤16,7 ms Zeichenzeit und ≤50 ms bis zur sichtbaren Bestätigung. Der Bericht
bewertet diese Ziele, ohne sie als CI-Zeitlimits zu erzwingen. Mehrere vergleichbare
Läufe sind erforderlich; bei Zielverfehlung bleibt die Performanceabnahme offen.
Der Browser-/JSONL-Pfad ersetzt keine native Tauri-IPC-Abnahme. Aufbau und
Messgrenzen beschreibt die Architektur, den erreichten Stand das Statusdokument.

Für einen direkten Playwrightlauf zuerst `npm run perf:build` und den ignorierten
Rust-Test `terrain_performance_fixtures` ausführen. Danach:
`npm run perf:measure -- terrain.spec.ts`. `ATLAS_TERRAIN_FIXTURES` wählt das
Fixtureverzeichnis; Vorgabe ist `src-tauri/target/diagnostics/terrain-performance`.

Der kleine Weltkartenfall benötigt keine Fixtures: nach `npm run perf:build`
`npm run perf:measure -- world-brush.spec.ts --repeat-each=3` ausführen.

### Große Stadt-/Weltfixtures

Diese opt-in Fixtures werden aus dem aktuellen Dateiformat neu erzeugt und liegen
unter `src-tauri/target/diagnostics/city/` beziehungsweise `world/`:

```bash
cargo test --locked --manifest-path src-tauri/Cargo.toml --lib city_scale_benchmark -- --ignored --nocapture
cargo test --locked --manifest-path src-tauri/Cargo.toml --lib world_scale_benchmark -- --ignored --nocapture
npm run perf:build
npm run perf:measure -- release.spec.ts
# Optionaler Stadt-Navigationstest mit seinen eigenen Zeitgrenzen
ATLAS_CITY_BENCHMARK=1 npm run perf:measure -- city-navigation.spec.ts
```

`ATLAS_PERF_FIXTURE` begrenzt den Release-Lauf auf `city-100000`, `city-250000`
oder `world-10000`. Er misst erstes Öffnen in einem neuen Worker, erneutes Öffnen
im selben Worker, erste Ansicht, Einpassen, Verschieben und alle 14 Ansichten.
Chromium läuft bei 1440 × 960 CSS-Pixeln und DPR 1 auf Port 1422.
Ergebnisse liegen unter `src-tauri/target/cleanup/atlas-simplify/performance-<run>/`;
`ATLAS_PERF_OUTPUT` wählt einen anderen Ausgabepfad. JSONL enthält Roundtrip und
Transportbytes; `ATLAS_MEASURE_WORKER=1` ergänzt Workerzeit einschließlich Queue.

## Native Abnahme und Übergabe

Nach Interaktions- oder Dateiänderungen das frisch gebaute Desktopprogramm prüfen.
Die folgenden Szenarien ergänzen die automatischen Tests; erwartetes Verhalten
und Grenzen werden ausschließlich im Produktvertrag gepflegt.

| Bereich                | Manuell durchspielen                                                                                                                           |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Dateien                | Neu, Öffnen, Speichern, Speichern unter und Schließen; jeweils Annahme und Abbruch mit ungespeicherten Änderungen.                             |
| Häuser und Innenräume  | Zeichnen, Umbenennen, Bewegen, Geschoss-/Kontextwechsel, Undo/Redo, Abbruch und anschließendes Weiterarbeiten.                                 |
| Straßen und Parzellen  | Entwurf, automatische Bebauung, Varianten, Nodes, Verlängerung, Rauheit, Geländefolge; Übernahme per Button/Enter/Rechtsklick nach Navigation. |
| Höhen und Gewässer     | Alle Modi, kleine/große Pinsel, Detail/Übersicht, sichtbare Zwischenstände, Abbruch, History, Ufer, Inseln, Flusskontakt und Datei-Rundlauf.   |
| Bodenfarben            | Spitzen, Halten, Deckkraft, Farbfluss, Pipette, Radierer, Kachelnähte, Abbruch, History und Wiederöffnen.                                      |
| Regionen               | Malen/Radieren, Nachbarn, Beziehungen, Kategorien/Ränge, Namen, Stile, Beschriftungsgrenzen und Datei-Rundlauf.                                |
| Flüsse                 | Nodes, gemeinsame Knoten, Breite, Verlängerung, Richtung und Profile; verspätete Vorschauen, Navigation, Übernahme, Abbruch und History.       |
| Navigation und Dialoge | Welt bis Grundstück, erhaltene lokale Details; bei 900 × 620 Dialogfokus, Tab/Umschalt+Tab, Escape und Fehlerkorrektur.                        |

Plattform, Skalierung und Ergebnisse im ignorierten Diagnoseverzeichnis festhalten.
Dateivergleiche verwenden SQLite-Integrität und Autorentabellen in Primärschlüsselreihenfolge.
Anschließend den kurzen Status durch den gemeinsam geprüften Stand, verbleibende
Abnahmen und nächste Übergabe ersetzen. Einzelne erfolgreiche Teilprüfungen
belegen weder Gesamtgrün noch CI-Freigabe.
