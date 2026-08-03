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
- `scene_group` and `scene_group_entry`: ordered, named Scene-owned groups of
  Creature catalog foreign IDs and positive quantities; Creature facts remain
  Creatures-owned
- `scene_participant_state`: Scene-owned per-scene defeated state and quick
  notes for an assigned PC, NPC, or mob, keyed by participant kind and the
  corresponding foreign ID; it does not own that participant's source facts

Party details, World Planner details, disposition, creature statblocks,
generator drafts and suggestions, and Encounter workflow state MUST NOT be
stored in Scene tables.

## Validation And Errors

Owner startup readiness validates the feature-declared target schema signature; semantic row validation remains on typed provider read/write paths and fails closed through the feature contract.

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

Before the first released format,
`scene` supports exactly the complete current schema at owner version 1. One
guarded initializer creates all six Scene tables in a fresh owner namespace.
There is no additive v1-v3 build-up, predecessor repair, backfill, or workspace
translation.

The exact owner inventory covers every table, index, view, and trigger named
with `scene_` or `idx_scene_`. An unversioned partial namespace, a recorded
version-1 shape that differs from the exact current DDL, an adjacent retired
Scene object, or a newer owner version MUST fail without mutating stored rows,
schema objects, or ledger state. Initialization failure MUST NOT fabricate a
ledger entry. Unsupported development databases are reinitialized rather than
migrated before the first released format.

Missing World Planner records remain visible as unresolved stable references
until the GM removes or replaces them; inactive Party members are removed
during refresh. These are current reference semantics, not schema-compatibility
bridges. Foreign feature IDs remain logical values without cross-owner foreign
keys or repair.
