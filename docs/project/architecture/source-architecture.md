Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-12
Source of Truth: Concise source architecture statement after the M0-M5
architecture migration cycles.

# Source Architecture Statement

## Principles

SaltMarcher source architecture is judged by behavior, dependency direction,
and maintainability outcomes, not by role-family suffixes or form doctrine.

1. **Locality.** A small behavior change should touch the owning feature or
   shell surface, with few supporting files.
2. **Short chains.** User intent reaches the first state mutation or readback
   in as few meaningful class boundaries as the behavior allows.
3. **Typed boundaries.** Finite product state crosses boundaries as enums,
   records, ids, or value types, not as String round-trips, unless a retained
   public seam already requires the String.
4. **One representation per purpose.** A second state shape exists only when a
   real consumer needs that shape.
5. **Logic lives where its data lives.** Behavior belongs with the state and
   invariants it changes; views bind and publish UI intent, and adapters handle
   concrete source mechanics.
6. **Outcome checks decide structure.** Package cycles, layer direction,
   behavior harnesses, production handoff, and review evidence are binding.

## Code Pointers

- Startup stays generic in `bootstrap/AppBootstrap.java` and
  `bootstrap/ShellViewDiscovery.java`; routine feature work does not add
  handwritten bootstrap wiring.
- The shell stays a passive host through `shell/api/ShellBinding.java` and
  `shell/host/AppShell.java`; feature code talks to shell contracts, not shell
  internals.
- Migrated view contributions compose their own UI routes, for example
  `src/view/leftbartabs/catalog/CatalogContribution.java` with
  `src/view/leftbartabs/catalog/CatalogViewModel.java`.
- Domain services own behavior routes and publication, for example
  `src/domain/encounter/EncounterApplicationService.java` and
  `src/domain/dungeon/DungeonEditorRuntimeApplicationService.java`.
- Render-heavy UI state stays behind dedicated model/view seams such as
  `src/view/slotcontent/main/dungeonmap/DungeonMapContentModel.java`.
- `src/data/**` is the outbound adapter zone for SQLite, files, imports, and
  other concrete sources; it adapts to public feature or domain boundaries.

## Boundaries

`bootstrap/**` may discover and register generic shell/service contributions.
`shell/**` hosts UI surfaces and exposes stable shell contracts. `src/view/**`
and `src/features/**` own presentation/runtime routes named by the current
code. `src/domain/**` owns behavior and published application state. `src/data/**`
owns source mechanics and translation to public boundaries.

Public seams consumed by multiple areas stay byte-compatible until every
consumer is migrated or an owner document explicitly changes the seam with
proof. Behavior truth remains in requirements, contracts, domain docs,
verification docs, behavior harnesses, and the running application.

## References

- [Architecture Overview](overview.md)
- [Layering Architecture Standard](patterns/layering-architecture.md)
- [Bootstrap Standard](patterns/bootstrap.md)
- [Shell Layer Standard](patterns/shell-layer.md)
- [Data Layer Standard](patterns/data-layer.md)
- [Migration Ledger](migration-ledger.md)
