# Reference Graph Domain Model

## Context role

Context Role: Read-only Reference Projection

The reference feature publishes a searchable projection over truth owned by
other contexts. It owns recognition terms, normalized reference documents,
source attribution, ambiguity, and traversal identity. It does not own SRD
rules, creature facts, or campaign world objects.

## Model

- `ReferenceTarget` is a discriminated, owner-qualified identity. SRD targets
  carry catalog, definition kind, and stable definition ID; creature-part
  targets carry a creature ID, semantic part kind, and name-derived part ID;
  campaign targets always carry Campaign ID, entity kind, and entity ID.
- `ReferenceTerm` contains one canonical name or alias, its explicit match
  policy, and all target candidates. Ambiguity is data, not a matcher error.
- `ReferenceIndex` is an immutable, revisioned set of terms used to compile a
  renderer-local matcher.
- `ReferenceDocument` is either a structured article AST (headings,
  paragraphs, lists, tables, facts, and inline reference nodes) or a canonical
  creature projection. It is not an HTML or Markdown transport.
- `ReferencePath` is the ordered ancestor target list used for nested previews
  and cycle suppression.

Kinds currently published are rule, condition, spell, item, ability, action,
creature, creature trait/action/legendary action, location, and faction. NPC is
not reserved in the executable contract before an owning NPC capability
exists.

## Ownership and consistency

One compiler consumes `5e-database` v5.10.0 at commit
`3f5593ea004c4f5a2af95603087ce4de72689d9f` after verifying the pinned archive
SHA-256. It emits both the checked-in SRD SQLite artifact and the canonical
creature catalog, plus Golden ID lists and quality reports. Biomes remain a
separate, provenance-bearing checked enrichment. Locations and factions read through
their owning campaign services. No copied mutable world truth is stored in the
reference feature.

The static index revision combines pinned catalog identity and creature catalog
hash. A separate campaign index revision combines explicit Campaign identity
and owning aggregate revisions. Campaign mutations publish a typed change
event carrying changed stable targets. The renderer keeps the last successful
campaign automaton active during refresh and invalidates only those campaign
detail entries. Failed promises are evicted. Campaign-owned details are
resolved against current truth so deletion or rename cannot be hidden by stale
cached prose.

## Invariants

- renderer matching is pure and never performs per-token IPC
- utility lookup depends on narrow owner query ports; only the read-only SRD
  catalog adapter contains reference-catalog SQL
- runtime lookup does not fetch external resources
- static folded and campaign exact indexes compile into separate Aho-Corasick
  automata; emitted matches are stable, longest-first, non-overlapping spans
- ambiguity remains explicit until the GM selects a target
- nested traversal cannot create an ancestor cycle
- persistent-card coordinates and lifetime are presentation state, not domain
  or campaign persistence
- app-wide detail history is keyed by Campaign and Scene, keeps at most 100
  target-and-breadcrumb entries, and reloads current truth on traversal
- one overlay manager owns the open branch; anchors own no Floating UI
  instance, only open cards are mounted, and ancestor targets are suppressed
