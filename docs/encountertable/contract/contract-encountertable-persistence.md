# Encounter Table Persistence Contract

Status: Active target contract
Owner: Encounter Table
Last Reviewed: 2026-07-28
Source of Truth: This document

## Owner Boundary

Encounter Table owns one Campaign partition named `encountertables`. The
partition uses format `saltmarcher.encounter-tables.v1` and contains complete
records keyed by stable table identity. No SQLite table, JDBC type, Java model,
Catalog state, or Godot UI node is part of this boundary.

Each active record contains:

- stable `record_id` and kind `encounter_table`;
- name and optional description;
- optional logical Loot Table identity;
- an ordered array of unique `{creature_id, weight}` memberships;
- creation and update timestamps.

Recoverably deleted records move into the same owner partition's `trash` map.
Each entry preserves the complete record, deletion timestamp, and the exact
faction-primary or place-membership links removed from current World Planner
truth. Active and deleted maps cannot contain the same stable identity.

Creature and Loot identifiers are logical foreign references. The partition
does not copy either provider's facts.

## Commit And Read Semantics

- create and edit prepare a complete validated owner payload off-thread;
- the active Campaign's admitted serial writer publishes the new immutable
  partition and Campaign manifest together;
- stale Campaign generations fail without acknowledging a change;
- Catalog summary queries sort before bounded slicing;
- detail reads validate the selected complete owner partition and exact table;
- candidate reads validate selected tables, then resolve the unique Creature
  closure from the registry-selected Shared-Definition generation;
- pure generation-source reads validate selected tables and return only stable
  membership IDs, effective weights, linked Loot IDs, and conflict state;
- publication re-confirms active Campaign and Shared-Definition generations;
- cancellation and replacement publish no stale candidate result.

## Validation And Failure

Malformed formats, records, identities, timestamps, descriptions, duplicate
memberships, and weights outside `1..10` fail closed. Missing or damaged
referenced Creature definitions fail the candidate evaluation instead of
fabricating partial truth. A supporting failure does not prevent unrelated
Campaign partitions from opening.

## Lifecycle And Portability

The complete partition participates in immutable Campaign generations,
backups, compaction, export, import, and recovery through the shared file-store
contract. Recoverable deletion updates Encounter Table truth and removes every
current faction-primary and place-membership reference in the same Campaign
commit. Restore preserves the table identity and reattaches a recorded link
only when its World Planner source still exists and the relationship remains
safe: a faction's primary slot must still be empty, while a surviving place may
regain the missing set member. Conflicting or deleted endpoints remain
untouched.

Compatibility obligations begin with the first released file format. Before
that activation point, version `v1` is disposable and has no SQLite import,
dual-write bridge, partial repair, or predecessor conversion.

## References

- [Encounter Table Domain](../domain/domain-encountertable.md)
- [Persistence Lifecycle](../../project/contract/persistence-lifecycle.md)
- [Source Architecture](../../project/architecture/source-architecture.md)
