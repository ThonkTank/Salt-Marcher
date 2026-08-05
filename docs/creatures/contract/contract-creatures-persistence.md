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

- The feature-owned persistence declaration owns Creatures DDL and SQL, but no
  independent schema version or migration ledger. It contains exactly:
  - `creatures`
  - `creature_biomes`
  - `creature_subtypes`
  - `creature_actions`
- The declaration also owns the complete current column, key, relationship,
  constraint, and index signatures for those tables. Persistent tables,
  indexes, views, or triggers in the `creatures*`, `creature_*`,
  `idx_creatures_*`, or `idx_creature_*` namespaces are invalid unless they
  occur in that declaration.
- Provider-native fields are mapped into this current schema before they become
  live installation truth. A provider's wider native table is not a compatible
  Creatures store and is never adopted or repaired in place.

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

Startup validates the one whole-database development schema version. Semantic
row validation remains on typed provider read paths and fails closed through
the feature contract.

- whole-database schema readiness MUST be verified before the catalog exposes
  a successful lookup result
- a malformed current schema MUST fail without changing its schema, rows, or
  stored data
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

## Compatibility And Initialization

Compatibility obligations begin with the first released format.
Before the first released format, Creatures has one disposable current format.
Its initializer creates the current tables and indexes directly and does not
inspect predecessor columns, add missing columns, copy rows, or repair partial
tables. Unsupported isolated development databases are reinitialized by the
shared persistence lifecycle.

An unversioned partial owner namespace and a malformed recorded version `1`
fail as unavailable without ledger fabrication or mutation. A recorded owner
version above `1` fails as newer and is neither downgraded nor rewritten. Until
activation there is no compatibility reader or migration chain. After
activation, later format changes are governed by `TN-18` and `TN-19`.


## References

- [Creatures Domain Model](../domain/domain-creatures.md) (line 1)
- [Catalog Tab UI](../requirements/requirements-creatures-catalog.md) (line 1)
