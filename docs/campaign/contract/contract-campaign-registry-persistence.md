# Campaign Registry Persistence Contract

Status: Active migration contract
Owner: Campaign
Last Reviewed: 2026-07-27
Source of Truth: This document

## Purpose And Boundary

The Campaign feature owns the installation-wide registry of stable Campaign
identities and names, the single durable active-Campaign pointer, and the
active installation-wide Shared-Definition generation. Campaign-authored truth
remains in the physically separate root for that Campaign. Consumers receive
Campaign capabilities rather than file paths or persistence handles.

The target and current Godot route is immutable, checksummed JSON below
`user://salt-marcher/`. SQLite, JDBC, and the legacy Java registry are migration
input only and are not alternative runtime routes.

## Stored Truth

Each registry generation contains:

- its own monotonic generation and safe parent generation;
- zero or one active Campaign identity;
- the complete sorted set of registered Campaign identities, names, and
  creation timestamps;
- exactly one Shared-Definition generation, where generation zero denotes the
  empty collection.

Duplicate Campaign display names are valid. Stable Campaign identities are
unique. Every registered Campaign must have a readable identity manifest. The
active Campaign must be a member of the same registry generation.

A Campaign generation stores only stable Shared-Definition identities. Reusable
Creature, Item, rule, and similar content is owned installation-wide by the
Shared-Definition store rather than copied into Campaign partitions. Completed
historical facts remain Campaign-owned semantic snapshots and are not
recalculated when a current definition changes.

## Publication And Atomic Visibility

Registry documents use the immutable generation protocol defined by the
project persistence contract. A mutation writes a fresh checksummed generation,
publishes it through rename, and confirms it by readback. Expected-generation
checks reject stale commands before publication.

Campaign creation stages and validates the complete Campaign root before live
promotion. Registry failure moves it back out of the live root and removes the
staging operation. Import prepares the independent Campaign root and any new
Shared-Definition generation first; one registry generation then makes both
the Campaign membership and selected definition generation visible together.
Definitions or Campaign roots not selected by a registry generation are not
installation truth.

## Shared Definitions And Import Decisions

A Shared Definition has a stable lowercase portable identity, a typed kind, a
display name, and a semantic content document. Immutable objects are addressed
by the checksum of the complete definition. A checksummed generation index
selects one object for every current identity.

A complete Campaign export contains exactly every definition referenced by the
exported Campaign generation. Import validates that closure before proposing a
mutation. A missing identity joins the installation collection. An identical
identity and definition is reused.

When the imported definition differs from the current object under the same
identity, import persists a marked staged operation and reports the affected
existing Campaigns plus the consequences of all three choices:

- `keep_existing`: the imported Campaign follows the existing definition;
- `use_imported`: current and future reads in all referencing Campaigns follow
  the imported definition;
- `retain_both`: the imported definition receives a new identity and only the
  imported Campaign references it.

No choice is inferred. Restart preserves the staged conflict. An incomplete,
invalid, stale, rejected, or explicitly discarded decision changes neither the
registry nor the active Shared-Definition generation. Every choice preserves
completed historical facts.

## Compatibility And Failure Behavior

Compatibility obligations begin with the first-real-user/data format freeze.
Until then, the current Godot format is disposable and no Java SQLite conversion
is provided. After activation, changes follow project `TN-18` and `TN-19` and
must add qualified conversion and preceding-release readback rather than alter
an existing format's meaning.

Registry and definition failures return owned result statuses, never filesystem
implementation details. A damaged newest generation falls back only to the
newest uniquely safe prior generation and discloses recovery. A missing or
damaged referenced definition prevents a complete export or atomic import; it
is never silently substituted.

## References

- [Persistence Lifecycle](../../project/contract/persistence-lifecycle.md)
- [Source Architecture](../../project/architecture/source-architecture.md)
- [Program Capability Requirements](../../project/requirements/requirements-program-capabilities.md)
