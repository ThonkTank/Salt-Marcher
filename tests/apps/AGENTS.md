# Ziele
- Strukturiert End-to-End- und DOM-Tests für die Obsidian-Apps (Almanac, Library, Cartographer).
- Stellt sicher, dass jede App-spezifische Test-Suite konsistent aufgebaut und dokumentiert ist.

# Aktueller Stand
- Enthält Vitest-Suites nach App getrennt (`almanac`, `library`, `travel`, ...).
- `TEST_PLAN.md`-Dateien referenzieren die zugehörigen Testfälle und Regressionen.

# ToDo
- [P2] Weitere Smoke-Tests für neue Workmodes anlegen, sobald Implementierungen erfolgen.
- [P3] Cross-App-Regressionstests (Integration) bündeln und dokumentieren.

# Standards
- Jede Unter-Suite führt eine eigene `AGENTS.md` oder `TEST_PLAN.md`, die beim Ändern aktualisiert wird.
- Neue Tests beschreiben kurz die motivierende Regression oder User-Story im Kopfkommentar.
