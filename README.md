# SaltMarcher · Atlas V7

Lokaler 2D-Weltatlas vom Raum bis zur Welt mit Kurvenstraßen, Flussnetzen, Gewässerpinsel, Gelände, Parzellen und Hausinnenräumen.
React zeichnet auf Canvas, Rust verwaltet das Dokument in SQLite, Tauri stellt
die Desktopanwendung bereit. Im normalen Browser erscheint ein Desktop-Hinweis.

## Start und Entwicklung

Benötigt werden Node.js 22 ab 22.12 (alternativ 24 oder ≥26), npm, Rust stable
und Tauri-Systembibliotheken. Fedora:

```bash
sudo dnf install -y gcc-c++ make webkit2gtk4.1-devel openssl-devel libappindicator-gtk3-devel librsvg2-devel libxdo-devel
npm ci
npm run desktop
```

```bash
rustup component add rustfmt clippy
npx playwright install chromium # einmalig; optional --with-deps
npm run check                  # Transportverträge, Typen, TypeScript- und Rusttests
npm run check:all              # zusätzlich Clippy, Format, Webbuild und Browsertests
npm run format                 # Prettier und rustfmt
npm run package -- --ci        # natives Release-Paket
```

Einzeln: `npm run typecheck`, `npm test`, `npm run test:rust`,
`npm run test:e2e`, `npm run build`. Einzelne Browserdateien lassen sich mit
`npm run test:e2e -- terrain.spec.ts` auswählen. Cargo-Prüfungen und Testworker
verwenden das vorhandene Lockfile (`--locked`). Die Typprüfung umfasst
Produktcode, Tests und Toolkonfigurationen; `check:all` prüft sequenziell.

Browsertests starten einen eigenen Vite-Server auf `127.0.0.1:1421`;
ein belegter Port führt zum Abbruch. Der Entwicklungsserver bleibt auf Port 1420.
Build und Start des Testworkers verwenden ausdrücklich `src-tauri/target/`,
auch bei abweichendem `CARGO_TARGET_DIR` in der Umgebung.

Ressourcenlimits: `.cargo/config.toml` begrenzt Cargo-/Tauri-Builds und Rusttests
standardmäßig auf zwei Jobs beziehungsweise Testthreads; Vitest verwendet zwei,
Playwright einen Worker. Nicht mehrere vollständige Prüfläufe gleichzeitig
starten. Unter Linux kann `nice -n 10 npm run check:all` der Desktopbedienung
Vorrang geben. Cargo-Flags beziehungsweise `RUST_TEST_THREADS` überschreiben die
Vorgaben bei Bedarf.

Vertrags- und Browsertests verwenden den echten Rust-Kern; die Testanbindung
steht in der [Architektur](docs/architecture.md#entwicklung-und-prüfungen).
Browserergebnisse liegen unter
`src-tauri/target/diagnostics/playwright-<run>/`. Nach Rust-Transportänderungen
`npm run contracts:generate` ausführen. `contracts:check` prüft ohne
Quelländerung; `src/atlas/generated/` nie manuell ändern.

## Bedienung

Links stehen die Werkzeuge, rechts Einstellungen und Aktionen zum aktuellen
Kontext. Die Karte zeigt kurze Bedienhinweise. Fachregeln, Gesten, Tastatur,
Planung und Dateiabläufe sind im [Produktvertrag](docs/product-contract.md)
beschrieben.

Neue Dokumente beginnen als Ozean. „Höhen → Land“ legt Landflächen an;
die Ansichtsauswahl navigiert vom Grundstück bis zur Welt. Ortschaften werden
über die gleichnamige Kategorie in „Regionen“ angelegt, nicht als eigene Objekte.
Dateiformat 18 ersetzt die bisherigen Entwicklungsdateien ohne Migration.

## LOD und Performance prüfen

`npm run test:lod` prüft Kachelbudgets, Auflösungswechsel, Cachewiederverwendung
und veraltete Antworten. `npm run test:lod:e2e` prüft alle 14 Ansichten in beiden
Zoomrichtungen sowie Navigation, Bearbeitung und Invalidierung mit echtem Kern.
Beide Teilmengen sind auch in der Gesamtsuite enthalten. Algorithmische Budgets
werden ohne rechnerabhängige Zeitgrenzen geprüft; die folgenden großen Fixtures
ergänzen die Messung von Öffnung, Übersicht und Framezeiten.

Die großen Fixtures, Release-Builds und Messungen werden getrennt erzeugt und
laufen nicht in der normalen Testsuite. Die vorhandenen Format-18-Fixtures können
wiederverwendet werden; nur bei fehlenden oder inkompatiblen Dateien neu erzeugen:

```bash
# Fixture-Erzeugung (langsam; überschreibt die jeweiligen Diagnosefixtures)
cargo test --locked --manifest-path src-tauri/Cargo.toml --lib city_scale_benchmark -- --ignored --nocapture
cargo test --locked --manifest-path src-tauri/Cargo.toml --lib world_scale_benchmark -- --ignored --nocapture

# Produktionstransformation des Browser-Harness und optimierter Rust-Testworker
npm run perf:build
# Alle drei Fixtures; optional ATLAS_PERF_FIXTURE=city-100000, city-250000 oder world-10000
npm run perf:measure
```

Der Browserlauf öffnet jede Datei zunächst in einem neuen Worker und danach erneut
im selben Worker („warm“); der Betriebssystem-Dateicache wird nicht geleert. Er
misst Öffnung, erste Ansicht, Einpassen, Frameintervalle beim Verschieben und
alle 14 Ansichten mit gefülltem Dokument. JSONL protokolliert zusätzlich jede
Transportanforderung mit Roundtrip-Zeit und serialisierter Anfrage-/Antwortgröße.
Die Werte umfassen Testbridge und Warteschlange, nicht nur Rust-Rechenzeit. Die
Messung verwendet Chromium bei 1440 × 960 CSS-Pixeln und DPR 1 und setzt die
Fixtures unter `src-tauri/target/diagnostics/city/` und `world/` voraus. Ergebnisse
liegen unter `src-tauri/target/cleanup/atlas-simplify/performance-<run>/`;
`ATLAS_PERF_OUTPUT` setzt ein anderes Ausgabeverzeichnis. Die Messung prüft
Navigation und protokolliert Zeiten, setzt aber keine rechnerabhängigen Zeitlimits.
Browsermessungen ersetzen keine native Performanceabnahme.

## Native Abnahme

Nach Interaktions- oder Dateiänderungen das frisch gebaute Desktopprogramm
prüfen. Erwartetes Verhalten und Grenzen stehen im
[Produktvertrag](docs/product-contract.md); diese Liste ergänzt die automatischen
Prüfungen um native Eingaben, Fenster und Dateidialoge:

1. Haus zeichnen; Speichern abbrechen, speichern, öffnen und unter anderem Namen
   speichern. Schließen zunächst abbrechen, dann mit „Speichern und fortfahren“
   abschließen und die Datei wieder öffnen.
2. Räume umbenennen und bewegen; Geschoss-/Kontextwechsel, Undo/Redo sowie
   Gestenabbruch durch Escape und Fokusverlust prüfen. Danach weiterarbeiten.
3. Straßen mit und ohne Bebauung in Detail und Übersicht zeichnen. Entwurfsparzellen
   anpassen, auslassen und wieder einschalten; über Button, Enter und Rechtsklick
   auch bei laufender Vorschau übernehmen. Feldeingaben lokal bestätigen/abbrechen.
   Auswahl, Nodes, beide Verlängerungsenden, Rauheit und „Gelände folgen“ prüfen;
   während des Entwurfs navigieren. Bestehende Kurven und Innenräume erhalten.
4. Höhen in allen Modi sowie Gewässer mit kleinen und großen Pinseln in Detail
   und Übersicht malen. Mehrere sichtbare Zwischenstände vor Pointerup und genau
   einen Undo-Schritt prüfen; Latenzen protokollieren. Verspätete Antworten nach
   Abbruch dürfen nicht erscheinen. Gewässerkontakt, Ufer, Flussmündungen und
   dauerhaft trockengelegte Inseln prüfen.
5. Boden mit allen Spitzen, Halten, Deckkraft, Farbfluss, Pipette und Radierer
   prüfen; Kachelnähte und Übersicht kontrollieren. Escape, Blur und Werkzeugwechsel
   müssen abbrechen. Undo/Redo und Speichern/Wiederöffnen prüfen.
6. Regionen malen/radieren; Nachbarübertragung, unabhängige Ränge und
   N:N-Zugehörigkeit prüfen. Kategorien/Ränge umsortieren/löschen, Namen und
   Zoomfenster ändern. Bildschirmgrößen der Pinsel, History und Dateirundlauf prüfen.
7. Flüsse zeichnen, Nodes verschieben/einfügen/löschen, beide Enden verlängern,
   Richtung und Profil ändern. Nach Navigation über Enter, Rechtsklick und
   Doppelklick übernehmen; Escape, Blur und Werkzeugwechsel einschließlich später
   Vorschauantworten prüfen. Gelände-/Gewässerkontakt, History und Dateirundlauf prüfen.
8. Von Welt bis Grundstück zoomen, Land/Meer malen und lokal verfeinern;
   lokale Details nach grober Änderung, Ortssymbole aus Regionen und
   Speichern/Wiederöffnen prüfen.
9. Bei 900 × 620 Lösch- und Unsaved-Dialog mit Tab, Umschalt+Tab und Escape
   bedienen; Fokus muss zurückkehren. Abgelehnte Änderungen korrigieren können.

Plattform, Skalierung und Ergebnisse im ignorierten Diagnoseverzeichnis festhalten.
Dateivergleiche verwenden SQLite-Integrität und die Autorentabellen in
Primärschlüsselreihenfolge. Browserprüfungen ersetzen diese native Abnahme nicht.

## Dokumentation

[Architektur](docs/architecture.md) erklärt Zuständigkeiten,
[Produktvertrag](docs/product-contract.md) Verhalten und Format,
[Status](docs/implementation/status.md) den zuletzt geprüften Stand und offene Arbeit.
Mit diesem README sind dies die vier maßgeblichen Dokumente. Arbeitspläne und
Detailbelege gehören unter `src-tauri/target/cleanup/` oder
`src-tauri/target/diagnostics/<run>/`.
