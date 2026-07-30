# Items Persistence And Import Contract

## Purpose And Consumers

This persistence contract owns the local Items schema, compatibility rules,
full-corpus import boundary, and read failure semantics. The Items application
service is its consumer. Catalog presentation consumes only `ItemsCatalogApi`;
it does not access SQLite or the public HTTP source.

## Ownership And Compatibility

Items owns the unambiguous current tables `items_catalog_entries` and
`items_catalog_tags`. Stable source keys from the pinned `/api/2014` API are
persisted as text identifiers. One direct schema initializer is registered as
owner version `1` under `items` and consumed through one prepared
`FeatureStoreHandle`; Items
does not open a parallel connection lifecycle. Desktop composition constructs only the
catalog-read adapter and application service. The separately composed operator import
constructs its own HTTP source, import application service, and write adapter from one
owner-bound `FeatureStoreMaintenance` capability. That capability supplies both the
whole-database backup and the later Items write connection; ordinary provider reads cannot
request either maintenance operation.

Owner version `1` has one structural signature: exact entry and tag columns,
`source_key` and `(item_source_key, tag)` primary keys, one cascading tag
foreign key, and the five named query indexes. The entry columns are exactly
the fields written by a validated current provider import: identity, display
and classification facts, cost and weight, combat and description facts, and
source version and URL. No migration identity or predecessor provenance is
stored. Owner readiness checks the exact owner object inventory plus every
declared column type, nullability, default, primary key, `CHECK`, foreign key,
unique constraint, table flag, and named index before the handle becomes
`READY`; platform
startup also checks global integrity and foreign keys. Semantic rows remain an
Items provider read/write concern and fail closed through typed Items results
rather than a startup corpus scan.

## Development Compatibility Boundary

Compatibility obligations begin with the first released format.
Before the first released format, Items supports no predecessor conversion, compatibility
bridge, or schema fallback. The version `1` initializer creates the current
tables and indexes directly only when no current or retired Items development
table exists. Existing older, mixed, or incomplete development shapes return
typed `INCOMPATIBLE` without copying, dropping, renaming, or otherwise mutating
those tables and without affecting another provider's readiness. Such
disposable development databases must be reinitialized and populated through a
complete current provider import.

After activation, a schema or pinned-source-version change requires a new
explicit compatibility decision under the project persistence lifecycle. Where
that decision keeps imported reference data replaceable, the replacement still
requires a complete validated re-import rather than synthesized source facts.

## Import Boundary

The explicit `ItemsImportApi` capability reads only the public equipment and
magic-item GET endpoints. It requires no account, cookie, token, or other
secret. The desktop runtime and Items UI never invoke this capability and
never transmit local database contents. An operator must invoke import as a
separate maintenance action.

Both indexes and every referenced detail are fetched and parsed before a domain
batch validates completeness, unique keys, and pinned-source attribution.
Only then does the importer initialize the Items schema and ask the shared
SQLite lifecycle for a timestamped maintenance backup. The platform proves
both the backup and a restored temporary copy with SQLite `integrity_check`.
One later transaction replaces both prior Items-owned tables. A fetch, parse,
validation, backup, restore-check, or SQL failure leaves the prior Items
projection intact and returns a typed failure status.

Required batch validation rejects an empty corpus, a missing equipment or
magic-item feed, blank stable key, name, or category, duplicate stable keys,
and source version or URL attribution outside the pinned source. Optional
upstream fields remain absent rather than being synthesized.

## Query Contract

Catalog queries accept optional filters and a bounded page. Invalid bounds
return an invalid-query result. Zero imported rows return an unavailable
result. An unsupported schema returns an incompatible result. Storage failures
return a storage-error result without changing published prior state.

All catalog reads and explicit imports return `CompletionStage` results and
schedule blocking work through the supplied `ExecutionLane`. SQLite and HTTP
work therefore remain outside the interactive rendering path; a future Catalog
consumer may dispatch only the resulting immutable projection to its view.

## Error And Compatibility Behavior

- Missing or zero-row imported data returns `UNAVAILABLE`.
- An unsupported or newer Items schema returns `INCOMPATIBLE` without mutation.
- A recorded Items owner version above the current direct version is rejected during read-only
  store qualification; the application reports `INCOMPATIBLE` while the owner rows, schema,
  platform ledger, and complete SQLite file family remain unchanged.
- Invalid cost bounds return `INVALID_QUERY` without querying rows.
- Missing detail keys return `NOT_FOUND`.
- SQLite failures return `STORAGE_ERROR`; execution-lane rejection returns
  `EXECUTION_ERROR`.
- Import distinguishes source, validation, backup, storage, and execution
  failures. No failure status permits partial replacement.

The current schema owner target is version `1`, created by its single direct
initializer. Before the first released format, the initializer may be revised with the
current target and never translates an earlier development shape. After the
first released format, later compatible changes use a new Items-owned migration. Public
API callers never infer compatibility from table layout.


## Attribution

Every imported row retains source version and source URL. The Inspector shows
that attribution. The project data source is the 5e-bits 5e-database/API; its
repository is MIT licensed and identifies the underlying material as Open Game
License 1.0a content.

References:

- [D&D 5e SRD API Introduction](https://5e-bits.github.io/docs/introduction)
- [5e-database](https://github.com/5e-bits/5e-database)
- [5e-database License](https://github.com/5e-bits/5e-database/blob/main/LICENSE.md)
