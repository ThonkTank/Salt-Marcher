Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-21
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

## Stability Rules

- The data slice is read-only for this parity step.
- Encounter-table candidate lookup may join creature rows for snapshots, but it
  must not mutate creature data.
- Optional loot links are warning context only and do not block encounter
  generation.
