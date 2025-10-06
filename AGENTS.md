# Ziele
- Bündelt das komplette Obsidian-Plugin inklusive Frontend-Code, Tests, Build-Konfiguration und begleitender Dokumentation.
- Stellt den Referenzstand für die Verzeichnisstruktur bereit, an dem sich Unterordner und andere Repos orientieren können.

# Aktueller Stand
- `src/` enthält sämtliche Apps, Core-Module und UI-Schichten; jede maßgebliche Ebene besitzt eine eigene `AGENTS.md`.
- `tests/` spiegelt die App-Aufteilung für Vitest-Suites, `test-failure-analysis.md` dokumentiert behobene Regressionen.
- `BUILD.md` beschreibt die npm-Skripte (`build`, `test`, `sync:todos`) sowie die erwarteten Bundles.
- Manifest- und Paket-Metadaten (`manifest.json`, `package.json`) sind manuell synchron zu halten.

# ToDo
- keine offenen ToDos.

# Standards
- Neue Verzeichnisse erhalten sofort eine `AGENTS.md` mit Zielen, Stand, ToDos und Standards.
- Änderungen an Bundler-, Test- oder Release-Setup dokumentieren wir zeitgleich in `BUILD.md` und verlinkten AGENTS-/README-Dateien.
- Versionen und Beschreibungstexte in `manifest.json`, `package.json` sowie README müssen bei Releases konsistent sein.
- Nach Struktur- oder Dokumentationsanpassungen `npm run sync:todos` im Repo-Stamm ausführen, damit `TODO.md` aktuell bleibt.
