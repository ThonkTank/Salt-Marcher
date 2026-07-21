Status: Active Target
Owner: SaltMarcher Team
Last Reviewed: 2026-07-15
Source of Truth: Persistence path and schema ownership rules for the
`encountertable` feature.

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

- The feature-owned persistence schema declaration is the canonical in-code
  schema owner.
- The schema owns:
  - `encounter_tables`
  - `encounter_table_entries`
  - `encounter_table_loot_links`

## Read Path Responsibilities

- the shared platform owns connection lifecycle; the Encounter Table SQLite
  adapter owns feature schema readiness, SQL, and row translation
- one feature-owned read port separates application orchestration from SQLite
  mechanics

## Validation And Error Behavior

Owner startup readiness validates the feature-declared target schema signature; semantic row validation remains on typed provider read/write paths and fails closed through the feature contract.

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

## Verification Notes

- Review must reject persistence types or internal collaborators crossing
  `EncounterTableApi`.
- Review must reject cross-feature SQL reads or joins into Creatures-owned
  tables.

## References

- [Encounter Table Domain Model](../domain/domain-encountertable.md) (line 1)
- [Encounter Table Feature Spec](../requirements/requirements-encountertable.md) (line 1)
- [Feature Boundary Standard](../../project/architecture/patterns/feature-boundaries.md)
