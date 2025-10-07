# Ziele
- Stellt leichtgewichtige, in-memory basierte Repositories/Gateways für Almanac-Daten bereit.
- Ermöglicht UI-/State-Machine-Prototyping ohne Persistenzabhängigkeiten.

# Aktueller Stand
- `InMemoryCalendarRepository`, `InMemoryEventRepository` und `InMemoryPhenomenonRepository` liefern Demo-Daten.
- `InMemoryStateGateway` verwaltet aktiven Kalender, Zeitfortschritte sowie Event- und Phänomen-Snapshots.

# ToDo
- [P1] Dateibasierte Persistenzschicht ergänzen (JsonStore-Integration, Migrationen).
- [P2] Cache-Invalidierung/Batch-Ladevorgänge für Events & Phänomene implementieren.
- [P3] Telemetrie-Hooks und Fehlerkanäle (io_error) an Gateway anbinden.

# Standards
- Repositories bleiben austauschbar; Interfaces dokumentiert in `mode/API_CONTRACTS.md`.
- Seed-/Clear-Helfer ausschließlich für Tests und Demo-Controller verwenden.
- Keine direkten UI-/Obsidian-Abhängigkeiten in Datenlayer-Dateien.
