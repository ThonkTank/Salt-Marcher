Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-26
Source of Truth: Persistence path and schema ownership rules for the `creatures`
feature.

# Creatures Persistence

This document is normative for the `creatures` feature's persistence path.

## Root Contract

- `src/data/creatures/CreaturesServiceContribution.java` is the only root
  service entrypoint for the feature.
- Bootstrap discovers it generically under `src/data/<feature>/`.
- The contribution registers `CreaturesApplicationService.class` through the
  shell-owned service registry, `shell.api.ServiceRegistry`. Domain ports are
  implementation collaborators and must not be exported as runtime services.
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

## Validation And Error Behavior

- feature-local schema readiness MUST be verified before the catalog exposes a
  successful lookup result
- malformed or incomplete source rows MUST be rejected or mapped to a clear
  storage-failure result instead of silently fabricating creature truth
- storage and schema failures MUST surface through the creatures published
  result status vocabulary rather than leaking SQLite or gateway exceptions to
  the view layer
- filter normalization with domain meaning belongs to the creatures domain
  boundary; the persistence slice validates only source-shape and storage
  readiness concerns

## Stability Rules

- Adding another persistence-exporting feature must not require routine edits
  outside `src/`.
- The creatures query adapter is injected into `CreaturesApplicationService`;
  no feature-specific bootstrap wiring is allowed.
- Creature persistence helpers may be refactored internally as long as
  `CreatureCatalogLookup` remains the only domain-owned read-only port used by
  the data slice.

## Verification Notes

- This contract is currently `Review-Owned`.
- Review must reject public runtime-service exports other than
  `CreaturesApplicationService.class`.
- Review must reject source-local table rows or SQLite helper types crossing
  into domain or view-facing boundaries.

## References

- [Creatures Domain Model](../domain/domain-creatures.md) (line 1)
- [Catalog Tab UI](../requirements/requirements-creatures-catalog.md) (line 1)
- [Data Layer Standard](../../project/architecture/patterns/data-layer.md) (line 1)
