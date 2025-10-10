# Ziele
- Stellt leichtgewichtige, in-memory basierte Repositories/Gateways für Almanac-Daten bereit.
- Ermöglicht UI-/State-Machine-Prototyping ohne Persistenzabhängigkeiten.

# Aktueller Stand
- `repositories.ts` bündelt Contracts sowie die In-Memory- und Vault-Implementierungen über einen gemeinsamen Datenstore.
- `InMemoryCalendarRepository`, `InMemoryEventRepository` und `InMemoryPhenomenonRepository` teilen sich denselben Speicher und dienen als Test-Doubles.
- `VaultCalendarRepository`, `VaultEventRepository` und `VaultAlmanacRepository` nutzen einen einheitlichen `SaltMarcher/Almanac/data.json`-Store (verwaltet durch `JsonStore`).
- `InMemoryStateGateway` verwaltet aktiven Kalender, Zeitfortschritte sowie Event- und Phänomen-Snapshots.
- `JsonStore` kapselt Vault-Zugriffe, Migrationen und Batch-Updates für den kombinierten Almanac-Datensatz.

# ToDo
- [P1] Dateibasierte Persistenzschicht ergänzen (JsonStore-Integration, Migrationen).
- [P2] Cache-Invalidierung/Batch-Ladevorgänge für Events & Phänomene implementieren.
- [P3] Telemetrie-Hooks und Fehlerkanäle (io_error) an Gateway anbinden.

# Standards
- Repositories bleiben austauschbar; Interfaces dokumentiert in `mode/API_CONTRACTS.md`.
- Seed-/Clear-Helfer ausschließlich für Tests und Demo-Controller verwenden.
- Keine direkten UI-/Obsidian-Abhängigkeiten in Datenlayer-Dateien.
- Vault-Stores verwenden ausschließlich Pfade unter `SaltMarcher/Almanac/` und halten Schema-Versionen in den JSON-Dateien aktuell.
