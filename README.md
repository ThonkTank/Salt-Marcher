# SaltMarcher · Atlas V7

Lokaler 2D-Weltatlas vom Raum bis zur Welt mit Straßen, Gelände, Gewässern,
Regionen, Parzellen und Hausinnenräumen. React zeichnet auf Canvas, Rust verwaltet
SQLite, Tauri stellt die Desktopanwendung bereit. Im normalen Browser erscheint
ein Desktop-Hinweis.

| Dokument                                   | Maßgeblicher Inhalt                                            |
| ------------------------------------------ | -------------------------------------------------------------- |
| Dieses README                              | Einrichtung, Befehle und Abnahmeablauf                         |
| [Architektur](docs/architecture.md)        | Besitzer, Datenfluss, Transaktions- und Cachegrenzen           |
| [Produktvertrag](docs/product-contract.md) | Beobachtbares Verhalten, Dateiformat und Grenzen               |
| [Status](docs/implementation/status.md)    | Zuletzt belegter Prüfstand, offene Fehler und nächste Übergabe |

Diese vier Dokumente werden ersetzt und aktualisiert, nicht als Arbeitschronik
fortgeschrieben. Messreihen, Sicherungen und Detailprotokolle gehören unter die
ignorierten Pfade `src-tauri/target/cleanup/` oder `src-tauri/target/diagnostics/`.

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

## Entwicklung und automatisierte Abnahme

```bash
npm run check           # Verträge, Typen, TypeScript- und Rusttests
npm run check:all       # zusätzlich Clippy, Format, Webbuild und Browsertests
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
