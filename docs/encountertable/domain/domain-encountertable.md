Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-26
Source of Truth: Encounter table feature ownership, read model, and domain
boundary rules.

# Encounter Table Domain Model

## Context Role

Context Role: Reference Catalog Context
Context Name: EncounterTable

- `encountertable` publishes authored encounter-table membership as a
  read-only reference catalog for generator candidate pools.
- It does not own creature truth or loot truth.
- It exposes encounter-table summaries and weighted candidate rows through its
  own application service.

## Published Language

`published/` owns encounter-table summaries, candidate rows, list results, and
read status vocabulary.

Published candidate rows carry creature snapshot fields needed by encounter
generation plus the selected table weight. They do not expose table-entry
mutation commands.

## Application Boundary

`EncounterTableApplicationService` is the only public backend boundary. It
offers:

- `loadSummaries(LoadEncounterTableSummariesQuery)`
- `loadGenerationCandidates(LoadEncounterTableCandidatesQuery)`

The application service converts storage failures into `STORAGE_ERROR` results
and does not leak adapter exceptions.

## Ubiquitous Language

- Encounter Table: authored grouping of weighted creature entries used as a
  generation source.
- Table Summary: user-facing table identity and linked-loot context.
- Candidate Row: read-only creature snapshot plus encounter-table weight.

## Write Model And Derived State

Write Model: External authored table rows in SQLite

The local application currently consumes existing authored rows. It does not
own runtime mutation flows for those rows.

Derived state:

- ordered table summaries for UI controls
- weighted creature candidate snapshots for the encounter generator
- linked loot-table conflict context for selected table combinations

## Invariants

- empty table selections produce no table candidates
- weights are normalized to the supported `1..10` range
- generation candidates respect the supplied XP ceiling
- selected table lookup must not additionally apply creature type, subtype, or
  biome filters

## Foreign Boundaries

The data adapter may join `creatures` for read-only candidate snapshots and may
read optional `encounter_table_loot_links` values. Domain code must not reach
into creature or loot persistence directly.

## References

- [Encounter Table Persistence](docs/encountertable/contract/contract-encountertable-persistence.md:1)
- [Encounter Table Feature Spec](docs/encountertable/requirements/requirements-encountertable.md:1)
- [Encounter Feature Spec](docs/encounter/requirements/requirements-encounter.md:1)
