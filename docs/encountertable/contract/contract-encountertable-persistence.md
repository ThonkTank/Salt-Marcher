# Encounter Table Persistence

This document is normative for the `encountertable` feature's persistence path.

## Adapter Boundary

- The encounter-table SQLite adapter satisfies feature-owned application ports
  and remains private to the encounter-table composition entry point.
- The application composition supplies `EncounterTableApi` explicitly; no
  registry, discovery convention, port implementation, or adapter type is a
  public boundary.
- SQL rows and adapter failures MUST NOT cross `EncounterTableApi`.

## Mandatory Schema

- The feature-owned persistence declaration owns this aggregate's DDL and SQL,
  but it does not define a separate schema version or migration ledger.
- The schema owns:
  - `encounter_table`
  - `encounter_table_entry`
  - `encounter_table_loot_link`
  - `encounter_table_metadata`

Creature and loot-table identifiers are logical references. The Encounter
Table schema MUST use foreign keys only between its own tables; it MUST NOT bind
startup, deletion, or repair to a Creatures- or Loot-owned table.

## Read Path Responsibilities

- the shared platform owns connection lifecycle and whole-database development
  schema readiness; the Encounter Table adapter owns its SQL and row translation
- one feature-owned read port separates application orchestration from SQLite
  mechanics

## Write And Delete Responsibilities

- table snapshots carry an optimistic revision; stale mutations fail without
  changing rows
- entries use stable creature logical references, unique table membership,
  ordered positions, and weights from `1..10`
- deleting a table removes its entries and loot link, removes World Planner
  location links, and clears matching faction primary references atomically

## Validation And Error Behavior

Startup validates the one whole-database development schema version; semantic
row validation remains on typed provider read/write paths and fails closed
through the feature contract.

- schema readiness MUST be verified before encounter-table lookups return
  successful results
- malformed table rows, entry rows, or loot-link rows MUST become
  storage-failure results instead of synthesized candidate truth
- optional loot-link reads MAY be absent, but storage failures MUST surface
  through encounter-table-owned result statuses rather than leaking SQLite
  exceptions

## Stability Rules

- Target Encounter Table persistence returns only table-owned membership, creature
  IDs, weights, summaries, and optional loot-link IDs. It MUST NOT read or join
  Creatures-owned rows.
- The application layer resolves creature facts through `CreaturesApi` and
  combines them with table-owned weights for candidate results.
- Optional loot links are warning context only and do not block encounter
  generation.

## Compatibility And Migration

Compatibility obligations begin with the first released format.
Before the first released format, Encounter Table supports only the current
whole-database development schema. Its initializer creates the complete target
directly; there is no feature version, feature ledger, predecessor import,
partial repair, copy/drop conversion, or backfill. Unsupported isolated
development databases are reinitialized by the shared persistence lifecycle.


## References

- [Encounter Table Domain Model](../domain/domain-encountertable.md) (line 1)

- [Encounter Table Feature Spec](../requirements/requirements-encountertable.md) (line 1)
