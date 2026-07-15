Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-06-26
Source of Truth: Persistence boundary, stored truth, reference rules, and
error behavior for World Planner authored state.

# World Planner Persistence Contract

## Purpose

This contract defines the persisted storage boundary for the `worldplanner`
feature.

World Planner persistence stores only World Planner-authored NPC, faction,
location, lifecycle, note, link, source-constraint, and inventory-limit truth.

## Root Contract

- `src/data/worldplanner/WorldPlannerServiceContribution.java` is the planned
  root source-adapter entrypoint.
- Bootstrap discovers it generically under `src/data/<feature>/`.
- The data contribution registers source-backed repository adapters needed by
  the World Planner domain service assembly.
- The exported domain runtime surface is planned as
  `WorldPlannerApplicationService.class` plus read-only same-context
  published models.
- Domain ports, repositories, gateways, mappers, schema classes, and source
  records remain implementation details.
- View assembly reads World Planner behavior only through
  `ShellRuntimeContext.services()`.

## Stored Truth

World Planner persistence stores:

- NPC identity, display name, creature statblock reference, lifecycle status,
  appearance notes, behavior notes, history notes, and general notes
- faction identity, display name, notes, primary encounter-table reference,
  and NPC membership
- faction statblock inventory limit rows, including whether a statblock is
  finite or unlimited
- location identity, display name, notes, linked factions, and linked
  encounter tables

World Planner persistence does not store:

- creature statblock fields
- encounter-table membership rows
- post-combat runtime state or pending loss-confirmation workflows
- saved encounter-plan rosters
- party membership or character details
- combat HP, initiative, turn order, or runtime result state
- dungeon map or hex map truth
- Session Planner records, notes, or selected session truth

## Reference Rules

- NPC statblocks are stored as stable creature IDs.
- Faction and location encounter sources are stored as stable encounter-table
  IDs.
- Later Session Planner-owned integration may store location references in
  Session Planner, not copied location data in World Planner.
- Foreign truth must be re-read through the owning public boundary when a
  World Planner projection needs display facts.
- Missing optional source constraints mean unconstrained.
- Missing statblock inventory limits mean unlimited.
- Explicit finite inventory limit `0` means none available for that statblock.

## Validation And Error Behavior

- Writes must reject malformed NPC, faction, location, creature statblock, or
  encounter-table references.
- Writes must reject duplicate membership or duplicate link rows instead of
  silently persisting ambiguous truth.
- Finite inventory limits must be non-negative.
- A faction must not persist more than one primary encounter-table reference.
- Candidate combat losses must not mutate durable NPC lifecycle or faction
  stock until user confirmation is recorded.
- Storage and schema failures must surface through World Planner-owned
  published result statuses instead of leaking SQLite exceptions to the view
  layer.
- Failed writes must leave the last stable published World Planner state
  visible.

## Compatibility And Migration

World Planner is a feature-owned persistence surface. It does not migrate
existing Session Planner, Encounter, EncounterTable, Creatures, Party, Dungeon,
or Hex tables in the current backend slice.

Later migrations may add Session Planner-owned references to World Planner
locations, but those changes belong to the Session Planner persistence
contract.

## Verification Notes

The current backend behavior harness proves:

- NPC, faction, and location persistence round trips
- finite and unlimited faction inventory semantics
- defeated NPC reactivation
- rejection of copied foreign truth
- confirmed named-NPC combat losses persist as NPC lifecycle changes through
  the World Planner command boundary

World Planner persistence still does not store Encounter runtime result state
or pending confirmation workflows.

## References

- [World Planner Domain Model](../domain/domain-world-planner.md) (line 1)
- [World Planner Architecture](../architecture/architecture-world-planner.md) (line 1)
- [Data Layer Standard](../../project/architecture/patterns/data-layer.md) (line 1)
