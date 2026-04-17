Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-17
Source of Truth: Persistence path and schema ownership rules for the `creatures`
feature.

# Creatures Persistence

This document is normative for the `creatures` feature's persistence path.

## Root Contract

- `src/data/creatures/CreaturesPersistenceContribution.java` is the only root
  persistence entrypoint for the feature.
- Bootstrap discovers it generically under `src/data/<feature>/`.
- The contribution registers the creature catalog repository through
  `shell.host.PersistenceRegistry`.
- View code reads that capability only through the feature API and shell-owned
  persistence access surfaces.

## Mandatory Schema

- `src/data/creatures/model/CreaturesPersistenceSchema.java` is the canonical
  in-code schema declaration for the feature.
- The schema currently owns:
  - `creatures`
  - `creature_biomes`
  - `creature_subtypes`
  - `creature_actions`
- `CreaturesSchemaMigrator` and `CreaturesSchemaTableManager` derive base-table
  creation, additive column checks, and index creation from that schema
  declaration.

## Read Path Responsibilities

- `SqliteCreatureCatalogLocalDataSource` owns connection lifecycle and schema
  readiness only.
- Query construction and row-mapping responsibilities are split across
  package-private SQLite stores under `src/data/creatures/datasource/local/`.
- Shared SQL filter-clause and parameter-binding helpers stay local to that
  package and must not become feature APIs.

## Stability Rules

- Adding another persistence-exporting feature must not require routine edits
  outside `src/`.
- The creatures repository remains registered passively; no feature-specific
  bootstrap wiring is allowed.
- Creature persistence helpers may be refactored internally as long as
  `CreatureCatalogRepository` remains the only domain-owned contract exported
  from the data slice.
