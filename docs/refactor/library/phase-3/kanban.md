# Phase 3 Kanban Export

## Ready for Phase 4
- [x] LIB-TD-0001 – Vertragstest-Harness (keine Abhängigkeiten)
    - Einstiegspunkt `tests/contracts/library-harness.ts` mit `createLibraryHarness` für Legacy/v2-Portumschaltung.
    - Fixture-Struktur unter `tests/contracts/library-fixtures/{creatures,items,equipment,terrains,regions}` konsolidieren.
    - Vertrags- und Regressionstests (`tests/contracts/library-contracts.test.ts`) für Renderer-, Storage-, Serializer- und Event-Ports pflegen.
    - `npm run test:contracts` in `npm run ci:tests` integrieren, `BUILD.md` aktualisieren und DoR-Artefakte ablegen.
- [x] LIB-TD-0002 – Golden-Files für Roundtrips (wartete auf LIB-TD-0001)
    - `tests/golden/library/<domain>` mit Manifesten (`.manifest.json`) und Markdown-Goldens für Creatures, Items, Equipment und Spells befüllt.
    - Update-Skript `npm run golden:update` erzeugt deterministische Artefakte via Harness (`tests/contracts/update-library-golden.ts`).
    - Vertrags-Test `tests/contracts/library-golden.test.ts` prüft Serializer- und Storage-Roundtrips gegen die Golden-Daten (≥3 Samples je Domäne).
- [x] LIB-TD-0003 – Application-Service-Port (wartete auf LIB-TD-0001)
    - `src/apps/library/core/library-mode-service-port.ts` definiert Session-orientierte Interfaces, Domain-DTOs sowie Composition-Pläne für alle Library-Modi.
    - Feature-Flag-Helfer (`library.service.enabled`, `library.service.legacyFallback`) erlauben Renderer-seitige Kill-Switches inklusive Legacy-Fallback-Steuerung.
    - Vitest-Contract (`tests/library/library-mode-service-port.test.ts`) prüft Descriptor- und Composition-Abdeckung sowie die deterministische Kill-Switch-Auswertung.

## Backlog (wartet auf vorgelagerte ToDos)
- [ ] LIB-TD-0004 – StoragePort-Kapselung (wartet auf LIB-TD-0003 & LIB-TD-0001)
- [ ] LIB-TD-0005 – Renderer-Kernel (wartet auf LIB-TD-0003 & LIB-TD-0001)
- [ ] LIB-TD-0006 – Renderer-Migration (wartet auf LIB-TD-0005, LIB-TD-0003, LIB-TD-0004)
- [ ] LIB-TD-0007 – Event-Bus-Port (wartet auf LIB-TD-0005 & LIB-TD-0003)
- [ ] LIB-TD-0008 – Modal-Lifecycle (wartet auf LIB-TD-0007 & LIB-TD-0006)
- [ ] LIB-TD-0009 – Serializer-Template (wartet auf LIB-TD-0001 & LIB-TD-0004)
- [ ] LIB-TD-0010 – Serializer-Portierung (wartet auf LIB-TD-0009, LIB-TD-0004, LIB-TD-0003)
- [ ] LIB-TD-0011 – Validation-DSL (wartet auf LIB-TD-0009 & LIB-TD-0001)
- [ ] LIB-TD-0012 – Preset-Import-Härtung (wartet auf LIB-TD-0004 & LIB-TD-0009)
- [ ] LIB-TD-0013 – Query-Pipeline (wartet auf LIB-TD-0005 & LIB-TD-0003)
- [ ] LIB-TD-0014 – Store-Straffung (wartet auf LIB-TD-0007 & LIB-TD-0005)
- [ ] LIB-TD-0015 – Logging/Watcher-Cleanup (wartet auf LIB-TD-0007 & LIB-TD-0014)
- [ ] LIB-TD-0016 – Feature-Flags & Telemetrie (wartet auf LIB-TD-0005, LIB-TD-0009, LIB-TD-0007)
