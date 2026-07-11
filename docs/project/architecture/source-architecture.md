Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-12
Source of Truth: Concise source architecture statement after the M0-M5
architecture migration cycles.

# Source Architecture Statement

## Principles

SaltMarcher source architecture is judged by behavior, dependency direction,
and maintainability outcomes, not by role-family suffixes or form doctrine.

1. **Locality.** A small behavior change touches few files, ideally one owning
   area.
2. **Short chains.** UI intent reaches the first state mutation or readback in
   at most three meaningful hops. Classes whose only job is forwarding are
   removed instead of renamed.
3. **Typed boundaries.** Enums and value types cross boundaries as themselves:
   no String round-trips, duplicate enum definitions, or stringly typed `kind`
   constants where a type exists.
4. **One representation per purpose.** State is reshaped only when a real
   consumer needs the target shape.
5. **Logic lives where its data lives.** Behavior belongs with the state and
   invariants it changes; it is not squeezed into view or feature god files.
6. **Structure is judged by outcomes.** Cycle-free packages, dependency
   direction, green behavior harnesses, implemented approved designs, and
   production handoff decide structure.

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
