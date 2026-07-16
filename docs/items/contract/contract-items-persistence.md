Status: Active Target
Owner: SaltMarcher Team
Last Reviewed: 2026-07-16
Source of Truth: Local Items persistence, import compatibility, validation,
failure, and recovery behavior.

# Items Persistence And Import Contract

## Purpose And Consumers

This persistence contract owns the local Items schema, compatibility rules,
full-corpus import boundary, and read failure semantics. The Items application
service is its consumer. Catalog presentation consumes only `ItemsCatalogApi`;
it does not access SQLite or the public HTTP source.

## Ownership And Compatibility

Items owns the `items` and `item_tags` SQLite tables. Stable source keys from
the pinned `/api/2014` API are persisted as text identifiers. Schema migration
is registered under the `items` owner in the shared `SqliteDatabase`; Items
does not open a parallel connection lifecycle. A source-version change requires
an explicit migration decision and full re-import.

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
return an invalid-query result. Missing tables or zero imported rows return an
unavailable result. Storage failures return a storage-error result without
changing published prior state.

All catalog reads and explicit imports return `CompletionStage` results and
schedule blocking work through the supplied `ExecutionLane`. SQLite and HTTP
work therefore remain outside the JavaFX application thread; a future Catalog
consumer may dispatch only the resulting immutable projection back to JavaFX.

## Error And Compatibility Behavior

- Missing or zero-row imported data returns `UNAVAILABLE`.
- Invalid cost bounds return `INVALID_QUERY` without querying rows.
- Missing detail keys return `NOT_FOUND`.
- SQLite failures return `STORAGE_ERROR`; execution-lane rejection returns
  `EXECUTION_ERROR`.
- Import distinguishes source, validation, backup, storage, and execution
  failures. No failure status permits partial replacement.

The schema owner version starts at 1. Additive compatible schema changes use a
later Items-owned migration. A source-version change or incompatible shape
requires an explicit migration decision and full re-import; public API callers
must not infer persistence compatibility from table layout.

## Verification Ownership

Production-route tests own proof that queries use the shared SQLite lifecycle,
that both source indexes and their detail documents are parsed, that blocking
work is scheduled through `ExecutionLane`, and that a failed replacement rolls
back both Items-owned tables. Repository `check` remains the merge-blocking
proof owner.

## Attribution

Every imported row retains source version and source URL. The Inspector shows
that attribution. The project data source is the 5e-bits 5e-database/API; its
repository is MIT licensed and identifies the underlying material as Open Game
License 1.0a content.

References:

- [D&D 5e SRD API Introduction](https://5e-bits.github.io/docs/introduction)
- [5e-database](https://github.com/5e-bits/5e-database)
- [5e-database License](https://github.com/5e-bits/5e-database/blob/main/LICENSE.md)
