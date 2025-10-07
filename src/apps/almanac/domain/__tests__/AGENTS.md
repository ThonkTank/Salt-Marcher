# Ziele
- Bündelt Domain-spezifische Vitest-Suites für Kalenderarithmetik, Wiederholregeln und Phänomenberechnung.
- Dient als schnelle Regressionsebene bei Änderungen an Schemas, Zeitlogik oder neuen Phänomen-Kategorien.

# Aktueller Stand
- Tests für `calendar-timestamp`, `time-arithmetic`, `repeat-rule` und `phenomenon-engine` decken Standard- und Grenzfälle ab.

# ToDo
- [P1] Ergänze Tests für negative Zeitfortschritte und Chunk-basierte Verarbeitung.
- [P2] Füge Snapshot-/Property-Tests für komplexe Wiederholregeln hinzu.

# Standards
- Struktur folgt dem Arrange/Act/Assert-Muster aus `tests/AGENTS.md`.
- Bei neuen Domain-Modulen stets passende Tests ergänzen; keine stillschweigenden Lücken lassen.
