Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-16
Source of Truth: Local Items persistence, import compatibility, validation,
failure, and recovery behavior.

# Items Persistence And Import Contract

## Ownership And Compatibility

Items owns the `items` and `item_tags` SQLite tables. Stable source keys from
the pinned `/api/2014` API are persisted as text identifiers. Schema migration
is additive for the current format; a source-version change requires an
explicit migration decision and full re-import.

## Import Boundary

The manual `importSrdItems` task reads only the public equipment and magic-item
GET endpoints. It requires no account, cookie, token, or other secret. The
desktop runtime never invokes this task and never transmits local database
contents.

Before replacing an existing application database, the importer creates a
timestamped local backup and proves both the backup and a restored temporary
copy with SQLite `integrity_check`. Imported rows are validated before one
transaction replaces prior Items-owned rows. A fetch, parse, validation,
backup, restore-check, or SQL failure leaves the prior Items projection intact
and returns a diagnostic failure.

## Query Contract

Catalog queries accept optional filters and a bounded page. Invalid bounds
return an invalid-query result. Missing tables or zero imported rows return an
unavailable result. Storage failures return a storage-error result without
changing published prior state.

All catalog API reads complete asynchronously. SQLite work runs outside the
JavaFX application thread, and the Catalog dispatches only the resulting
immutable projection back to JavaFX.

## Attribution

Every imported row retains source version and source URL. The Inspector shows
that attribution. The project data source is the 5e-bits 5e-database/API; its
repository is MIT licensed and identifies the underlying material as Open Game
License 1.0a content.

References:

- [D&D 5e SRD API Introduction](https://5e-bits.github.io/docs/introduction)
- [5e-database](https://github.com/5e-bits/5e-database)
- [5e-database License](https://github.com/5e-bits/5e-database/blob/main/LICENSE.md)
