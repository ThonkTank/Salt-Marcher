Status: Active Target
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
- It exposes encounter-table summaries and weighted candidate rows through
  `EncounterTableApi`.

## Published Language

`EncounterTableApi` owns encounter-table summaries, candidate rows, list
results, and read status vocabulary.

Published candidate rows carry creature snapshot fields needed by encounter
generation plus the selected table weight. They do not expose table-entry
mutation commands.

## Application Boundary

`EncounterTableApi` is the only public feature boundary. It offers typed
operations equivalent to:

- `loadSummaries(LoadEncounterTableSummariesQuery)`
- `loadGenerationCandidates(LoadEncounterTableCandidatesQuery)`

The application layer converts storage failures into `STORAGE_ERROR` results
and does not leak adapter exceptions through the API.

## Ubiquitous Language

- Encounter Table: authored grouping of weighted creature entries used as a
  generation source.
- Table Summary: user-facing table identity and linked-loot context.
- Candidate Row: read-only creature snapshot plus encounter-table weight.

## Write Model And Derived State

Write Model: Encounter Table-owned authored membership rows in SQLite

`EncounterTableApi` exposes no mutation workflow unless observable product
requirements add one; storage ownership does not imply a public write API.

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

Target Encounter Table persistence owns membership IDs, weights, summaries, and
optional loot-link IDs only. The application layer resolves creature facts
through `CreaturesApi` and combines them with table-owned weights. No Encounter
Table target code may read or join Creatures-owned persistence, and no domain
code reaches into creature or loot persistence directly.

## References

- [Encounter Table Persistence](../contract/contract-encountertable-persistence.md)
- [Encounter Table Feature Spec](../requirements/requirements-encountertable.md)
- [Encounter Feature Spec](../../encounter/requirements/requirements-encounter.md)
