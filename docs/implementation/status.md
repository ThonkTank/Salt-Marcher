# Aktueller Stand

Atlas V7, Dateiformat 13, Generierungsrezept 3. Stand: 4. November 2026.
Straßenrauheit, Übersichtsbearbeitung, Landschaftsassets und Höhenbearbeitung
sind implementiert. Die Bereinigung erhält diese Funktionen und vorhandene
Arbeitsänderungen.

[README](../../README.md): Einrichtung und Abnahme;
[Architektur](../architecture.md): Zuständigkeiten;
[Produktvertrag](../product-contract.md): Verhalten, Format und Grenzen.

## Bereinigt

- Werkzeugwerte und Aktionen kommen direkt aus `useEditorTools`; die zusätzliche
  Prop-Übersetzung entfällt. Namen/Symbole stehen gemeinsam in `ToolOptions`.
- Zwölf Auswahlfelder teilen `SelectField`; Fachaktionen und Validierung bleiben
  bei ihren Besitzern. Neun reine Rust-Weiterleitungsfunktionen entfallen.
- `.cargo/config.toml` hält gemeinsame Ressourcenlimits für direkte Cargo-, npm-
  und Tauri-Aufrufe. Vitest und Playwright behalten ihre Workerlimits.
  Der Vertragsgenerator formatiert direkt im Speicher ohne zusätzlichen Prozess.
- Architektur ist nach Besitzern gegliedert, der Produktvertrag nach Bedienung,
  Planung und Nebenläufigkeit. Es bleiben genau vier maßgebliche Dokumente.

## Prüfstand

`npm run check:all` bestanden: Transportabgleich (91 Dateien), Typprüfung,
186 TypeScript-Tests, 224 Rusttests (192 Unit-, 16 Dokument-, elf Parzellen-,
fünf Testservertests), Clippy, Formatprüfung, Webbuild und 163 Browsertests.
Zwei Rusttests und zwei Browser-Großstadtbenchmarks sind regulär ignoriert;
der Rust-Transportexport wird separat ausgeführt. Der abschließend vereinfachte
Vertragsgenerator wurde nochmals gegen alle 91 Dateien geprüft.

Native Abnahme wurde für diese Bereinigung nicht wiederholt. Die letzte
Linux/WebKitGTK-Abnahme bei DPR 1 deckt Höhenpinsel, Escape, Undo/Redo,
Hausplattform sowie Speichern/Wiederöffnen einschließlich SQLite-Prüfung ab.
Native Landschafts-, Mehr-DPR- und vollständige Großstadtabnahme bleiben offen.

## Offene Grenzen und nächste Abnahme

Die Stadtansicht bleibt ein Prototyp. Offen: Öffnungszeit, Fit-/Übersichtsabfragen,
Beschriftungen gegenüber Bedienhinweisen und die 250.000er-Browserabnahme.
Die bisherige 100.000er-Messung erreichte etwa 16,8 ms beim Verschieben im 95. Perzentil, aber nicht eine Sekunde bis zur ersten Übersicht. Große Städte
mit Höhenrelief wurden nicht gesondert vermessen. Landschaft bietet weiterhin
keine eigenen Assetimporte, Einzelassetbearbeitung oder Pinselradierer.

Nächster Schritt: gemeinsame native Nutzung von Landschaft und Höhen bei mehreren
Pixeldichten sowie Geländeperformance auf großen Stadtbeständen prüfen.

Belege der Bereinigung: `src-tauri/target/cleanup/simplify-2026-11-04/`;
Browserberichte: `src-tauri/target/diagnostics/playwright-<run>/`.
Vorherige native/Messbelege: `src-tauri/target/diagnostics/heights-2026-11-04/`,
`scenery-2026-11-04/` und `city-2026-11-04/` unter demselben Diagnoseverzeichnis.
