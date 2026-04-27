Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-26
Source of Truth: User-facing behavior and acceptance criteria for encounter
table catalog use.

# Encounter Table Feature Spec

## Goal

Expose authored encounter tables as a read-only candidate source for runtime
encounter generation.

## Non-Goals

- editing encounter tables
- creating encounter-table entries
- assigning loot tables
- resolving or rolling loot

## Expected Capabilities

- load all encounter table summaries for Catalog controls
- expose each table's optional linked loot-table ID
- load generation candidates for selected table IDs with an XP ceiling
- carry each candidate's table weight into encounter ranking
- return an empty candidate list for empty table selections

## User-Visible Behavior

- selecting no encounter tables means the generator uses the normal monster
  catalog source and current creature filters
- selecting one or more encounter tables means generation uses only creatures
  present in those selected tables
- type, subtype, and biome filters do not additionally constrain selected
  encounter-table generation
- multiple selected tables with different linked loot-table IDs show a
  non-blocking `Loot-Konflikt` warning

## Acceptance Criteria

- encounter-table data is exposed only through
  `EncounterTableApplicationService`
- encounter-table generation lookup remains read-only
- table selection does not create or persist encounter state
- missing or broken encounter-table storage produces a storage-error result

## References

- [Encounter Table Domain Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/encountertable/domain/domain-encountertable.md:1)
- [Encounter Table Persistence](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/encountertable/contract/contract-encountertable-persistence.md:1)
- [Encounter Feature Spec](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/encounter/requirements/requirements-encounter.md:1)
