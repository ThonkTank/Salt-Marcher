# Creatures Persistence And Import Contract

Status: Active Godot contract
Owner: Creatures
Last Reviewed: 2026-07-28
Source of Truth: This document

## Purpose And Consumers

This contract owns Creature compatibility, the full-corpus import boundary,
and read failure semantics. Catalog consumes `CreatureCatalog`; it receives no
paths and does not access HTTP. The separate operator command composes
`CreatureImportService` with `Open5eSrd2014CreatureSource`.

## Storage Ownership And Compatibility

Creatures is an installation-wide immutable Shared-Definition provider. The
active registry selects exactly one checksummed Shared-Definition generation.
Creature objects contain the full normalized statblock and attribution. Their
generation references contain only the checksummed fields needed for bounded
filtering and sorting: stable source key, name, size, type, subtype, alignment,
CR, XP, and environments.

The projection is repeated inside the immutable object and covered by the
object and generation checksums. Exact detail reads reject a projection/object
mismatch. A damaged Creature object does not block metadata browsing or an
independent provider; selecting it or requesting a complete facts snapshot
fails closed.

Before the first released format, Creatures supports no SQLite conversion,
predecessor reader, or fallback. A selected Creature without the current
projection or semantic content is `INCOMPATIBLE` and replaceable development
data must be imported again. Later released format changes require an explicit
compatibility decision under the project persistence lifecycle.

## Import Boundary

`godot/tools/import_creatures.gd` performs GET-only reads against Open5e V2. It
requires no account, cookie, token, or secret. The desktop runtime and Creature
UI never compose the source and never transmit local data.

The source adapter fetches the exact document record
`/v2/documents/srd-2014/` and every page of
`/v2/creatures/?document__key__in=srd-2014`. It pins the API version and source
document explicitly. The API page count must remain constant during a fetch;
every `next` link must remain on the expected HTTPS host and endpoint; and the
final result count must match exactly.

Batch validation rejects an empty or partial corpus, a non-SRD document,
missing license or source link, unsafe or duplicate stable identity, duplicate
source key, invalid classification/CR/XP/combat facts, malformed hit dice,
ability, movement, environment, defense, trait, or action data, or a record
whose nested document is not `srd-2014`.

Only a complete normalized batch can prepare a generation. Preparation removes
the previously selected Creature kind and adds the replacement while preserving
every independent Shared-Definition kind. It does not alter the registry
pointer. One generation-checked registry commit selects the replacement. Any
source, parse, validation, preparation, or stale-publication failure leaves the
prior complete generation selected. A failed publication discards its
unselected generation.

## Query, Detail, And Facts Contract

Catalog queries accept name text, CR minimum/maximum, and multi-value size,
type, subtype, environment, and alignment filters plus a bounded page. They sort
stably by name, identity, CR, type, or XP before slicing. Filter options come
from the complete selected projection, not only the filtered page.

Invalid bounds, value shapes, or CR ranges return `INVALID_QUERY`. Zero Creature
definitions return `UNAVAILABLE`. Invalid current projections return
`INCOMPATIBLE`. Generation failures return `STORAGE_ERROR`. Catalog browsing
opens no Creature object files.

Detail lookup exact-reads one immutable statblock outside the scene-tree thread
and returns classification, core combat facts, six abilities, saving throws,
skills, movement, senses, languages, defenses, traits, actions, environments,
and source attribution. Missing identity returns `NOT_FOUND`; incompatible
content and damaged bytes remain distinguishable. A registry-generation change
makes an in-flight detail read stale instead of publishing mixed-generation
truth.

The unpaged facts snapshot exact-reads and validates every current Creature in
stable definition-ID order for downstream policy. It has no UI page limit and
observes cancellation between objects.

## Permanent Constraints

- no Creatures-owned SQLite database, table, migration, JDBC adapter, or Java
  API in the target state;
- no D&D Beyond session crawler, authenticated scraper, or reuse of the legacy
  private corpus;
- no network request from Catalog browsing or the desktop Creature UI;
- no creature create, edit, or delete command;
- no partial import, cross-rules-system merge, or synthesized missing fact;
- no scene-tree filesystem work for browsing, details, or facts snapshots;
- no replacement pointer publication before the document and complete corpus
  pass validation.

## Attribution

Every imported creature retains Open5e key, exact V2 detail URL, source document
`srd-2014`, source permalink, and the document's reported license names. The
Inspector shows the pinned version, licenses, and exact detail URL.

References:

- [Open5e API overview](https://open5e.com/api-docs)
- [Open5e V2 Creature endpoint](https://api.open5e.com/v2/creatures/)
- [Open5e 2014 SRD document](https://api.open5e.com/v2/documents/srd-2014/)
- [Open5e project and licensing principles](https://github.com/open5e)
