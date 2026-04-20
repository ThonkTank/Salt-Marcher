Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-20
Source of Truth: Persistence path and schema ownership rules for the `creatures`
feature.

# Creatures Persistence

This document is normative for the `creatures` feature's persistence path.

## Root Contract

- `src/data/creatures/CreaturesServiceContribution.java` is the only root
  service entrypoint for the feature.
- Bootstrap discovers it generically under `src/data/<feature>/`.
- The contribution registers the creature catalog read-only domain port through
  the shell-owned service registry, `shell.api.ServiceRegistry`.
- View assembly code reads that capability only through the shell-owned
  service lookup surface. The current Java lookup method is
  `ShellRuntimeContext.services()`.

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

- `SqliteCreatureCatalogLocalGateway` owns connection lifecycle and schema
  readiness only.
- Query construction and row-mapping responsibilities are split across
  package-private SQLite stores under `src/data/creatures/gateway/local/`.
- Shared SQL filter-clause and parameter-binding helpers stay local to that
  package and must not become public feature boundaries.

## Stability Rules

- Adding another persistence-exporting feature must not require routine edits
  outside `src/`.
- The creatures query adapter remains registered passively; no feature-specific
  bootstrap wiring is allowed.
- Creature persistence helpers may be refactored internally as long as
  `CreatureCatalogLookup` remains the only domain-owned read-only port
  exported from the data slice.
