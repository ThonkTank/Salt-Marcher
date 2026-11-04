# SaltMarcher · Atlas V7

Lokaler 2D-Stadteditor mit Kurvenstraßen, Gelände, Parzellen und Hausinnenräumen.
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
`npm run test:e2e`, `npm run build`. Die Typprüfung umfasst Produktcode,
Tests und Toolkonfigurationen. `check:all` führt alle Prüfungen nacheinander aus.

Ressourcenlimits: `.cargo/config.toml` begrenzt Cargo-/Tauri-Builds und Rusttests
standardmäßig auf zwei Jobs beziehungsweise Testthreads; Vitest verwendet zwei,
Playwright einen Worker. Nicht mehrere vollständige Prüfläufe gleichzeitig
starten. Unter Linux kann `nice -n 10 npm run check:all` der Desktopbedienung
Vorrang geben. Cargo-Flags beziehungsweise `RUST_TEST_THREADS` überschreiben die
Vorgaben bei Bedarf.

Browsertests verwenden den echten Rust-Worker; Ergebnisse liegen unter
`src-tauri/target/diagnostics/playwright-<run>/`. Nach Rust-Transportänderungen
`npm run contracts:generate` ausführen. `contracts:check` prüft ohne
Quelländerung; `src/atlas/generated/` nie manuell ändern.

## Bedienung

Links stehen die Werkzeuge, rechts Einstellungen und Aktionen zum aktuellen
Kontext. Die Karte zeigt kurze Bedienhinweise. Fachregeln, Gesten, Tastatur,
Planung und Dateiabläufe sind im [Produktvertrag](docs/product-contract.md)
beschrieben.

## Stadtmaßstab prüfen

Große Testdateien und Messungen bleiben im ignorierten Diagnoseverzeichnis:

```bash
cargo test --manifest-path src-tauri/Cargo.toml --lib city_scale_benchmark -- --ignored --nocapture
ATLAS_CITY_BENCHMARK=1 npm run test:e2e -- city-performance.spec.ts --workers=1
```

Der erste Befehl erzeugt reproduzierbare Städte mit 100.000 und 250.000 Häusern,
Straßen und Wasser unter `src-tauri/target/diagnostics/city/`.
Der zweite misst Öffnung, erste Übersicht und Navigation bei 1440 × 960.
Diese zeitintensiven Prüfungen laufen nicht in der normalen Gesamtsuite.
`ATLAS_CITY_DIR` überschreibt das Fixtureverzeichnis; für gemeinsame Läufe einen
absoluten Pfad verwenden (Cargo und Browser haben unterschiedliche Arbeitsverzeichnisse).

## Native Abnahme

Nach Interaktions- oder Dateiänderungen das frisch gebaute Desktopprogramm prüfen:

1. Haus zeichnen; Speichern abbrechen, speichern, öffnen und unter anderem Namen speichern.
2. Raum umbenennen und bewegen; Undo/Redo, Geschoss- und Kontextwechsel prüfen.
3. Gesten mit Escape und Fokusverlust abbrechen, danach weiterarbeiten.
4. Straße mit automatisch platzierten Häusern zeichnen; Parzelle ziehen, auslassen,
   wieder einschalten und per Rechtsklick ohne Vorschauwarten übernehmen.
   Auch Gelände und nachträgliche Bebauung über Button, Enter und Rechtsklick
   abschließen. Enter/Escape in Feldern und die Aktionsleiste bei ausgewählter
   Entwurfsparzelle prüfen. Beide Enden verlängern; Haus-/Parzellengesten und abgelehnte
   Änderungen korrigieren.
5. In der Stadtübersicht Straßen mit und ohne Bebauung zeichnen, Rauheit ändern
   und abbrechen/übernehmen; Auswahl, Punktbewegung, Einfügen/Löschen und beide
   Verlängerungsenden prüfen. Während eines Entwurfs hinein-/herauszoomen.
   „Verlauf aufrauen“, Undo/Redo und Dateirundlauf prüfen; vorhandene Kurven
   und gebundene Innenräume müssen erhalten bleiben.
6. Bei 900 × 620 Lösch-/Unsaved-Dialog mit Tab, Umschalt+Tab und Escape bedienen; Fokus kehrt zurück.
7. Schließen abbrechen, danach mit „Speichern und fortfahren“ abschließen und Datei erneut prüfen.

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
