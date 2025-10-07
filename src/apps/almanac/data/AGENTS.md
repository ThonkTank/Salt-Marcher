# Ziele
- Stellt leichtgewichtige, in-memory basierte Repositories/Gateways für Almanac-Daten bereit.
- Ermöglicht UI-/State-Machine-Prototyping ohne Persistenzabhängigkeiten.

# Aktueller Stand
- `InMemoryCalendarRepository`, `InMemoryEventRepository` und `InMemoryPhenomenonRepository` liefern Demo-Daten und Test-Doubles für den Mode-State-Machine Layer.
- `VaultCalendarRepository`, `VaultEventRepository` und `VaultAlmanacRepository` persistieren produktive Daten in `SaltMarcher/Almanac/*.json` (verwaltet durch `JsonStore`).
- `InMemoryStateGateway` verwaltet aktiven Kalender, Zeitfortschritte sowie Event- und Phänomen-Snapshots.
- `JsonStore` kapselt Vault-Zugriffe, Migrationen und Batch-Updates für die genannten JSON-Dateien.

# ToDo
- [P1] Dateibasierte Persistenzschicht ergänzen (JsonStore-Integration, Migrationen).
- [P2] Cache-Invalidierung/Batch-Ladevorgänge für Events & Phänomene implementieren.
- [P3] Telemetrie-Hooks und Fehlerkanäle (io_error) an Gateway anbinden.

# Standards
- Repositories bleiben austauschbar; Interfaces dokumentiert in `mode/API_CONTRACTS.md`.
- Seed-/Clear-Helfer ausschließlich für Tests und Demo-Controller verwenden.
- Keine direkten UI-/Obsidian-Abhängigkeiten in Datenlayer-Dateien.
- Vault-Stores verwenden ausschließlich Pfade unter `SaltMarcher/Almanac/` und halten Schema-Versionen in den JSON-Dateien aktuell.
