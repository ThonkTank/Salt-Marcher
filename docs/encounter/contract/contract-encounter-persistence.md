# Encounter Persistence Contract

Status: Active Godot migration contract
Owner: Encounter
Last Reviewed: 2026-07-28
Source of Truth: This document

## Purpose And Boundary

This contract owns saved Encounter-plan and Encounter runtime persistence.
Current production truth is one immutable, checksummed `encounter` owner
partition inside the active Campaign file store. SQLite, JDBC, Java
repositories, and cross-feature tables are legacy migration evidence and are
not part of the target or current Godot route.

The current partition format is `saltmarcher.encounter.v2`. Before the
first released Godot format, incompatible development data is disposable and
fails closed rather than receiving an implicit converter.

## Stored Truth

The partition contains:

- `records`: active saved Encounter plans by stable plan identity;
- `trash`: recoverable saved Encounter plans by the same stable identity plus
  deletion time;
- `runtime`: a versioned context collection with its focused context and source
  revision.

Every plan stores exactly:

- stable `record_id` and `encounter_plan` kind;
- trimmed display name and optional generated label;
- an ordered non-empty roster;
- optional immutable generated-origin metadata;
- creation and update timestamps.

Every roster line stores one unique Creature identity, one positive integer
quantity, and one non-empty last-known Creature name. It does not store a
statblock. JSON whole numbers may deserialize as numeric values, but validation
accepts only finite mathematical integers and publishes integer domain values.

Generated origin, when present, contains only batch/run identities, engine
meaning, fingerprints, cardinality, order, and Encounter number. The current
Godot route writes this canonical shape only through the complete generated
batch command.

Runtime format `saltmarcher.encounter-runtime.v2` stores a focused context ID,
Scene source revision, and independent contexts. Each context stores its own
revision, mode, status, opened-plan reference, materialized roster facts with
stable slot identity and enemy/ally kind, initiative rows, individual
combatants, active turn, round, and result. A result stores participating Party
identities and award acknowledgement, but not copied Party profiles.

## Explicitly Excluded Saved-Plan Truth

Saved-plan persistence rejects or omits:

- Creature statblocks, XP, or other Shared-Definition content;
- Party members, thresholds, or copied Party state;
- generated alternatives and active generator filters;
- initiative, combat HP, turn order, masks, or defeated/result state inside a
  saved plan;
- rewards, loot resolution, packing, Session Planner scenes, or audits.

Those values remain derived, runtime-owned, or foreign-owner truth. Runtime HP,
initiative, turn order, and result state are intentionally durable
runtime-owned truth in the separate `runtime` collection. Masks remain unmet
target work.

## Mutation And Publication

Manual create/update first resolves the complete unique Creature ID set through
the selected Shared-Definition generation on a worker. Missing, damaged, or
non-Creature definitions reject the whole command. Only then may the Encounter
owner construct a complete new payload and submit it through the admitted
Campaign serial writer.

The writer binds each operation to the active Campaign activation generation
and expected Campaign generation. A changed Campaign, changed selected
definition generation, stale writer, validation failure, or storage failure
publishes no partial roster and no new Campaign generation.

Trash moves the complete plan from `records` to `trash` atomically. Restore
moves the same identity back, refuses an active identity conflict, and retains
the entire roster even when a referenced Creature has since disappeared. The
last-known name makes that broken reference visible and repairable.

Generated commit validates the complete prepared batch before changing a copy
of the owner payload. It creates ordinary plans with deterministic stable IDs
and canonical origins, then publishes the one resulting partition. Exact
completed retries read back the existing ordered mapping without a Campaign
write. A partial, reordered, changed, already-trashed, or colliding batch fails
closed and exposes neither a partial payload nor a partial mapping.

Opening a saved plan resolves the complete roster against one selected
Shared-Definition generation before replacing the manual runtime context.
Every subsequent initiative, combat, or result mutation replaces the complete
validated Encounter partition through the admitted serial Campaign writer. XP
award prepares both the Encounter acknowledgement and Party XP mutation and
publishes both owner partitions in one Campaign generation.

Scene synchronization resolves every mob and combat-relevant
NPC reference against the current Shared-Definition generation, builds the
complete context set, and publishes it with the new Scene partition in one
Campaign generation. Surviving slots reconcile compatible initiative and
combatant state. Missing Scene contexts are removed, while the manual context
is preserved. A stale or invalid synchronization writes neither partition.

## Read And Failure Semantics

- Catalog reads validate the complete owner payload, sort deterministically by
  name or identity before bounded page slicing, and can explicitly select
  active or trash records.
- Detail reads use one active plus one latest pending request, resolve current
  labels from one Shared-Definition generation read, expose missing IDs, and
  confirm registry and definition generations before publication.
- One damaged Encounter partition fails only Encounter reads; it does not
  become Catalog-owned fallback truth and must not prevent independent owners
  from opening.
- Teardown and supersession release worker and pending-request state.

## Generated Batch Boundary

One generated batch validates every concrete roster and origin before one
all-or-nothing partition publication. Identical completed retries denote the
same saved plans; partial, reordered, relabeled, or changed retries fail closed.
The route neither dual-writes nor creates a second generated-plan store.

## References

- [Encounter Domain](../domain/domain-encounter.md)
- [Encounter Requirements](../requirements/requirements-encounter.md)
- [Saved Plans](contract-encounter-saved-plans.md)
- [Generated Preparation](contract-encounter-generated-import.md)
- [Persistence Lifecycle](../../project/contract/persistence-lifecycle.md)
