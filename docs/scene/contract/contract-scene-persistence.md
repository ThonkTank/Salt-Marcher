Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-16
Source of Truth: Runtime-scene SQLite storage and recovery semantics.

# Runtime Scene Persistence Contract

## Purpose, Owners, And Consumers

The Scene SQLite adapter persists only Scene-owned workspace truth. Consumers
use `SceneApi` and `SceneModel`; SQL records do not cross the feature. Party,
World Planner, Session Planner, and Encounter retain ownership of their own
payloads and lifecycle.

## Stored Truth

- `scene_workspace`: workspace revision, next scene ID, Standardszene ID,
  focused scene ID, synchronization marker, and status text
- `scene_running_scene`: stable scene ID, title, notes, optional planner
  provenance values, optional initial Encounter plan ID, optional World Planner
  location ID, and order
- `scene_party_member`: ordered Party character foreign IDs
- `scene_npc`: ordered World Planner NPC foreign IDs

Party details, World Planner details, disposition, creature statblocks, and
Encounter workflow state MUST NOT be stored in Scene tables.

## Validation And Errors

Scene IDs and all present foreign references MUST be positive. The database
enforces one row per scene assignment plus global uniqueness of both PC and NPC
assignment. Location IDs are not unique because multiple scenes may reference
the same location. The only foreign keys target Scene-owned scene rows; foreign
feature IDs MUST NOT receive cross-owner foreign keys.

Writes replace one complete workspace in a transaction. Failed writes retain
the last committed workspace and complete the command with `STORAGE_ERROR`.
Failed Encounter synchronization is not a Scene storage failure: the committed
workspace remains available with `encounter_synchronized=0` and is retried by
initialization or refresh.

## Consistency And Boundary Semantics

Each logical Scene mutation increments the workspace revision. Scene persists
the new revision as unsynchronized before invoking Encounter. An `APPLIED`
result, or a `STALE_IGNORED` result whose accepted revision covers the sent
revision, may mark that same current revision synchronized. A late completion
MUST NOT overwrite a newer Scene revision.

## Compatibility And Migration

The `scene` migration owner starts at version 1 in the shared
`SqliteDatabase`. There is no legacy Scene schema import. Future migrations
MUST remain additive or explicitly translate the complete workspace before
raising the owner version. Missing World Planner records remain visible as
unresolved stable references until the GM removes or replaces them; inactive
Party members are removed during refresh.

## Verification And References

Transactional round trips, relational ownership, stable foreign IDs, and the
absence of cross-owner foreign keys are executable acceptance targets of
`check`.

- [Scene Domain](../domain/domain-scene.md)
- [Scene Architecture](../architecture/architecture-scene.md)
- [`SqliteDatabase`](../../../platform/persistence/SqliteDatabase.java)
