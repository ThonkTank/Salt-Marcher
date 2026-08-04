# Reference Graph Domain Model

## Context role

Context Role: Read-only Reference Projection

The reference feature publishes a searchable projection over truth owned by
other contexts. It owns recognition terms, normalized reference documents,
source attribution, ambiguity, and traversal identity. It does not own SRD
rules, creature facts, or campaign world objects.

## Model

- `ReferenceTarget` is a stable pair of kind and owner-qualified ID.
- `ReferenceTerm` contains the visible term, normalized match policy, aliases,
  target candidates, and optional contextual metadata.
- `ReferenceIndex` is an immutable, revisioned set of terms used to compile a
  renderer-local matcher.
- `ReferenceDocument` is a normalized title, summary, facts, sections, source,
  and optional canonical creature projection.
- `ReferencePath` is the ordered ancestor target list used for nested previews
  and cycle suppression.

Kinds currently published are rule, condition, spell, item, ability, action,
creature, location, and faction. NPC is reserved in the contract for the
campaign-knowledge slice that will own NPC truth.

## Ownership and consistency

The checked-in SRD artifact is deterministic imported truth with a manifest,
source hash, upstream version, and CC-BY attribution. Creatures are resolved
from the canonical creature catalog. Locations and factions are read through
their owning campaign services. No copied mutable world truth is stored in the
reference feature.

An index revision combines the static artifact hash, creature catalog hash,
campaign identity, and owning aggregate revisions. Static and creature details
may be cached by target. Campaign-owned details are resolved against current
truth so deletion or rename cannot be hidden by stale cached prose.

## Invariants

- renderer matching is pure and never performs per-token IPC
- utility lookup composes owning services and contains no generic SQL access
- runtime lookup does not fetch external resources
- emitted matches are stable, longest-first, non-overlapping spans
- ambiguity remains explicit until the GM selects a target
- nested traversal cannot create an ancestor cycle
- persistent-card coordinates and lifetime are presentation state, not domain
  or campaign persistence
