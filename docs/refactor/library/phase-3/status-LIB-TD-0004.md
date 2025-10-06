# LIB-TD-0004 – Umsetzung & Nachweis

## Plan
- Storage-Port-Contract mit Domain-Descriptoren, Telemetrie-Events sowie Fehler- und Backup-Katalog spezifizieren.
- Legacy-Hilfsfunktionen (Vault-Pipelines, Terrain-/Regions-Stores, Preset-Importer) einer Mapping-Tabelle zuordnen und Lücken reporten.
- Vitest-Spezifikation für Descriptor-Abdeckung, Mapping-Vollständigkeit und Fehlererzeugung ergänzen.

## Umsetzung
- `src/apps/library/core/library-storage-port.ts` definiert Domain-IDs (inkl. Preset-Cluster), Read/Write/Marker-Schnittstellen, Dry-Run- und Backup-Pläne sowie Feature-Flags.
- Fehlerkatalog (`createLibraryStorageError`) kapselt Operation, Domain, Ursache; Telemetrie-Events decken Reads, Writes, Marker und Fehler ab.
- Legacy-Mapping dokumentiert sämtliche bestehenden Helper pro Domain und liefert Gap-Analyse via `describeLegacyStorageGaps`.

## Tests
- `npm run test -- --run tests/library/library-storage-port.test.ts`

## Dokumentation
- Kanban-Eintrag zu LIB-TD-0004 nach „Ready for Phase 4“ verschoben und Ergebnisdetails ergänzt.
- Backlog-Open-Question als geklärt markiert; Planning Brief aktualisiert (Marker-Handling entschieden).
