Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-26
Source of Truth: Persistence path and schema ownership rules for the
`encountertable` feature.

# Encounter Table Persistence

This document is normative for the `encountertable` feature's persistence path.

## Root Contract

- `src/data/encountertable/EncounterTableServiceContribution.java` is the only
  root service entrypoint for the feature.
- Bootstrap discovers it generically under `src/data/<feature>/`.
- The contribution registers `EncounterTableApplicationService.class` through
  the shell-owned service registry.
- Domain ports are implementation collaborators and must not be exported as
  runtime services.

## Mandatory Schema

- `src/data/encountertable/model/EncounterTablePersistenceSchema.java` is the
  canonical in-code schema declaration for this feature.
- The schema owns:
  - `encounter_tables`
  - `encounter_table_entries`
  - `encounter_table_loot_links`

## Read Path Responsibilities

- `SqliteEncounterTableLocalGateway` owns connection lifecycle and schema
  readiness.
- `EncounterTableSqliteStore` owns SQL for table summaries and weighted
  generation candidate lookup.
- `SqliteEncounterTableCatalogAdapter` maps persistence records to the
  domain-owned `EncounterTableCatalog` port.

## Validation And Error Behavior

- schema readiness MUST be verified before encounter-table lookups return
  successful results
- malformed table rows, entry rows, or loot-link rows MUST become
  storage-failure results instead of synthesized candidate truth
- the persistence slice MUST preserve its read-only boundary and reject
  mutation-style operations in this parity step
- optional loot-link reads MAY be absent, but storage failures MUST surface
  through encounter-table-owned result statuses rather than leaking SQLite
  exceptions

## Stability Rules

- The data slice is read-only for this parity step.
- Encounter-table candidate lookup may join creature rows for snapshots, but it
  must not mutate creature data.
- Optional loot links are warning context only and do not block encounter
  generation.

## Verification Notes

- This contract is currently `Review-Owned`.
- Review must reject write-model mutation boundaries inside the
  `encountertable` persistence slice for this parity step.
- Review must reject public runtime-service exports other than
  `EncounterTableApplicationService.class`.

## References

- [Encounter Table Domain Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/encountertable/domain/domain-encountertable.md:1)
- [Encounter Table Feature Spec](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/encountertable/requirements/requirements-encountertable.md:1)
- [Data Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/data-layer.md:1)
