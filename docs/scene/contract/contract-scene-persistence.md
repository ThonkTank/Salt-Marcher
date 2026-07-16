Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-16
Source of Truth: Runtime-scene SQLite storage and recovery semantics.

# Runtime Scene Persistence Contract

## Purpose And Ownership

The Scene SQLite adapter persists only Scene-owned workspace truth. Consumers
use the Scene application boundary; SQL records do not cross the feature.

## Stored Truth

- workspace revision, next scene ID, Standardszene ID, focused scene ID, status
- scene ID, title, notes, optional planner provenance, optional linked plan ID,
  optional World Planner location ID, and order
- ordered Party character IDs and ordered World Planner NPC IDs

Party details, World Planner details, disposition, creature statblocks, and
Encounter workflow state MUST NOT be stored in Scene tables.

## Validation And Errors

Scene IDs and all present foreign references must be positive. The database
enforces one row per scene/PC and global uniqueness of PC assignment. Writes
replace one complete workspace in a transaction. Failed writes retain the last
committed workspace and return `STORAGE_ERROR`.

## Compatibility

The schema is additive and begins at the first runtime-scene version. There is
no previous Scene data migration. Missing foreign records remain visible as
unresolved references until the GM removes or replaces them.
