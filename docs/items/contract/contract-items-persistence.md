# Items Persistence And Import Contract

Status: Active Godot contract
Owner: Items
Last Reviewed: 2026-07-28
Source of Truth: This document

## Purpose And Consumers

This contract owns the local Items compatibility rules, full-corpus import
boundary, and read failure semantics. Catalog consumes only `ItemCatalog`; it
does not receive paths or access the public HTTP source. The separate operator
command composes `ItemImportService` with `Dnd5e2014ItemSource`.

## Storage Ownership And Compatibility

Items is an installation-wide immutable Shared-Definition provider. The active
registry selects exactly one checksummed Shared-Definition generation. Item
objects contain full semantic detail and source attribution. Their generation
references contain only the checksummed filter/sort projection required for
bounded browsing: stable source key, category, subcategory, magic status,
rarity, attunement status, and optional cost.

The projection is repeated inside the immutable object and is covered by both
the object identity checksum and generation checksum. An exact detail read
rejects any mismatch between object and projection. A damaged Item object does
not block metadata browsing or an independent Creature provider; selecting the
damaged Item returns a storage failure.

Before the first released format, Items supports no predecessor conversion or
fallback. A selected Item definition without the current projection or current
semantic detail is `INCOMPATIBLE`. Replaceable development data must be
re-imported as a complete corpus. A later released format change requires an
explicit compatibility decision under the project persistence lifecycle.

## Import Boundary

The explicit `godot/tools/import_items.gd` command reads only public GET
endpoints below the pinned `/api/2014` root. It requires no account, cookie,
token, or other secret. The desktop runtime and Items UI never compose this
source and never transmit local data.

The command fetches both complete indexes:

- `/api/2014/equipment`
- `/api/2014/magic-items`

Every referenced detail must be fetched before storage preparation begins.
Index counts and feed-local paths must match exactly. Batch validation then
rejects an empty feed, missing or extra detail, blank or unsafe stable index,
name, or category, duplicate stable identity or source key, an unexpected
detail URL, invalid cost or weight, malformed description/property data, or
attribution outside the pinned source.

Only a complete normalized batch can prepare a generation. Preparation removes
the previously selected Item kind and adds the entire replacement while
preserving every independent Shared-Definition kind. It does not alter the
registry pointer. One later generation-checked registry commit selects the
replacement. A source, parse, validation, preparation, or stale-publication
failure leaves the prior complete Items generation selected. A failed
publication discards its unselected generation.

## Query And Detail Contract

Catalog queries accept optional name, category, subcategory, rarity, magic,
attunement, minimum-cost, and maximum-cost filters plus a bounded page. They
sort stably by name, category, rarity, or cost before slicing. Missing costs
remain absent and sort after known costs. Filter-option values come from the
complete selected projection, not merely the filtered page.

Invalid bounds or cost ranges return `INVALID_QUERY`. Zero Item definitions
return `UNAVAILABLE`. A definition with an absent or invalid current projection
returns `INCOMPATIBLE`. Generation read failures return `STORAGE_ERROR`.
Catalog browsing opens no Item object files.

Detail lookup exact-reads one immutable object outside the scene-tree thread.
It returns complete description, properties, cost, weight, rarity,
attunement, damage or armor facts when present, and pinned source attribution.
Missing identity returns `NOT_FOUND`; incompatible content and damaged bytes
remain distinguishable. A registry-generation change makes an in-flight detail
read stale rather than publishing mixed-generation truth.

## Permanent Constraints

- no Items-owned SQLite database, table, migration, JDBC adapter, or Java API;
- no network request from Catalog browsing or the desktop Items UI;
- no create, edit, delete, loot, assignment, inventory, or crafting command;
- no partial import, incremental public-source merge, or synthesized absent
  source fact;
- no scene-tree filesystem work for browsing or detail reads;
- no replacement pointer publication before both feeds and every detail pass
  validation.

## Attribution

Every imported row retains source version `2014 SRD` and its exact public
detail URL. The Inspector shows both. The project data source is the 5e-bits
5e-database/API; its repository is MIT licensed and identifies the underlying
material as Open Game License 1.0a content.

References:

- [D&D 5e SRD API Introduction](https://5e-bits.github.io/docs/introduction)
- [2014 API resource root](https://5e-bits.github.io/docs/api)
- [Equipment index contract](https://5e-bits.github.io/docs/api/get-list-of-all-available-resources-for-an-endpoint)
- [Equipment detail contract](https://5e-bits.github.io/docs/api/get-an-equipment-item-by-index)
- [Magic-item detail contract](https://5e-bits.github.io/docs/api/get-a-magic-item-by-index)
- [5e-database](https://github.com/5e-bits/5e-database)
- [5e-database License](https://github.com/5e-bits/5e-database/blob/main/LICENSE.md)
