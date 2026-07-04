Status: Deprecated
Owner: SaltMarcher Team
Last Reviewed: 2026-06-26
Source of Truth: Compatibility mirror for canonical documentation at `docs/worldplanner/domain/domain-world-planner.md`.

# World Planner Domain Model Compatibility Mirror

This legacy path remains build-visible during the documentation-taxonomy
migration. Canonical feature-owned documentation lives at:

- [World Planner Domain Model](docs/worldplanner/domain/domain-world-planner.md:1)

## Context Role

Context Role: Roster Truth Context
Context Name: WorldPlanner

- `worldplanner` owns authored NPC, faction, and campaign-planning location
  truth.
- Its public backend boundary is
  `src/domain/worldplanner/WorldPlannerApplicationService.java`.
- The feature stores creature statblock and encounter-table references by
  stable id only, and keeps creature, encounter-table, encounter runtime,
  Session Planner, party, dungeon, and hex truth in their owning contexts.

## Published Language

`published/` owns public World Planner command carriers, read-only snapshots,
NPC summaries, faction summaries, location summaries, inventory-limit
summaries, and read-status vocabulary.

Published carriers expose stable planning IDs and authored notes. They do not
copy creature statblock fields, encounter-table membership, combat runtime
state, Session Planner records, party truth, dungeon maps, or hex maps.

## Application Boundary

Application Service: WorldPlannerApplicationService

The root application service accepts focused same-context command carriers,
routes mutations to focused World Planner use cases, and publishes readback
through `WorldPlannerSnapshotModel`.

It does not own persistence mechanics, creature lookup truth, encounter
generation policy, combat runtime state, or Session Planner scene records.

## Aggregate Model

Aggregate Root: WorldPlannerState

`WorldPlannerState` owns the authored World Planner snapshot for NPCs,
factions, and locations. `WorldNpc`, `WorldFaction`, and `WorldLocation`
hold the context-owned records inside that snapshot.

## Commands And Invariants

Commands entering the model are create NPC, update NPC notes, set NPC
lifecycle status, create faction, add faction NPC, set faction inventory
limit, create location, add location faction, and add location encounter table.

Core invariants:

- NPCs store creature statblock references, not copied creature truth.
- Factions store one primary encounter-table reference and unique NPC
  memberships.
- Locations store unique faction and encounter-table links.
- Missing inventory limits mean unlimited; explicit finite limits cap stock.
- Defeated NPCs are durable World Planner lifecycle state, not combat runtime
  state.

## Consistency Model

World Planner mutations load the current `WorldPlannerState`, apply one
focused use case, persist through the World Planner repository, and publish a
typed `WorldPlannerSnapshot`.

Persistence stores only World Planner-authored state and stable foreign IDs.
Foreign creature, encounter-table, encounter runtime, Session Planner, party,
dungeon, and hex truth remains outside this context.

## Ubiquitous Language

- `WorldNpc`: authored NPC planning record with creature statblock reference,
  notes, and internal lifecycle state.
- `WorldFaction`: authored faction planning record with NPC membership,
  primary encounter-table reference, and optional inventory limits.
- `WorldLocation`: authored campaign-planning location with linked factions
  and encounter tables.
- NPC lifecycle readback: published summaries expose active/defeated lifecycle
  state as `WorldNpcLifecycleStatus`; the model keeps its own
  `WorldNpcLifecycleState`.

## References

- [World Planner Domain Model](docs/worldplanner/domain/domain-world-planner.md:1)
