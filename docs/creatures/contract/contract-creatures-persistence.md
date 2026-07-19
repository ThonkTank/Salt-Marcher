Status: Active Target
Owner: SaltMarcher Team
Last Reviewed: 2026-07-19
Source of Truth: Persistence path and schema ownership rules for the `creatures`
feature.

# Creatures Persistence

This document is normative for the `creatures` feature's persistence path.

## Adapter Boundary

- The creatures SQLite adapter satisfies feature-owned application ports and
  remains private to the creatures composition entry point.
- The application composition supplies the creatures API explicitly; no
  registry, discovery convention, or adapter type is a public boundary.
- SQL rows, mappers, gateways, and schema helpers MUST NOT cross the feature
  API.

## Mandatory Schema

- The feature-owned persistence schema declaration is the canonical in-code
  schema owner.
- The schema currently owns:
  - `creatures`
  - `creature_biomes`
  - `creature_subtypes`
  - `creature_actions`
- feature-owned migration steps derive base-table creation, additive column
  checks, and index creation from that schema declaration

## Read Path Responsibilities

- the shared platform owns connection lifecycle; the Creatures SQLite adapter
  owns feature schema readiness
- Query construction and row mapping remain private SQLite-adapter concerns.
- Shared SQL filter-clause and parameter-binding helpers stay local to that
  package and must not become public feature boundaries.
- A direct facts query resolves the complete requested XP-value or creature-ID
  union in one set-based adapter operation. It has no UI page size or hidden
  result limit and returns stable creature-ID order.

## Validation And Error Behavior

Owner startup readiness validates the feature-declared target schema signature; semantic row validation remains on typed provider read/write paths and fails closed through the feature contract.

- feature-local schema readiness MUST be verified before the catalog exposes a
  successful lookup result
- malformed or incomplete source rows MUST be rejected or mapped to a clear
  storage-failure result instead of silently fabricating creature truth
- storage and schema failures MUST surface through Creatures API result status
  vocabulary rather than leaking SQLite exceptions to consumers
- filter normalization with domain meaning belongs to the creatures domain
  boundary; the persistence slice validates only source-shape and storage
  readiness concerns

## Stability Rules

- The creatures query adapter is injected through the feature composition
  entry point.
- Creature persistence helpers may be refactored internally while one
  feature-owned read port remains the application-to-SQLite boundary.

## Verification Notes

- This contract is currently `Review-Owned`.
- Review must reject source-local table rows or SQLite helper types crossing
  into the feature API.

## References

- [Creatures Domain Model](../domain/domain-creatures.md) (line 1)
- [Catalog Tab UI](../requirements/requirements-creatures-catalog.md) (line 1)
- [Feature Boundary Standard](../../project/architecture/patterns/feature-boundaries.md)
