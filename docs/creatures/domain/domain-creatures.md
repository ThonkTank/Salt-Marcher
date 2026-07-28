# Creatures Domain Model

Status: Active Godot domain
Owner: Creatures
Last Reviewed: 2026-07-28
Source of Truth: This document

## Context Role

Context Role: Imported Reference Catalog Context

Context Name: Creatures

Creatures owns the complete, replaceable local projection of the pinned public
2014-SRD creature corpus. It does not own encounter ranking, balancing,
rosters, runtime combat state, NPC lifecycle, or authored creature mutation.

## Published Language

`CreatureCatalog` publishes semantic catalog queries, typed lookup states,
complete filter options, bounded result pages, exact-read statblocks, and
complete unpaged current-facts snapshots. `CreatureImportService` publishes
the explicit full-corpus maintenance result and its typed status.

## Application Boundary

The application boundary normalizes queries and coordinates public source
loading, complete batch validation, immutable generation preparation, and
whole-catalog replacement. Catalog browsing and exact detail reads run outside
the Godot scene-tree thread. The public source and operator importer are never
composed into the desktop UI.

Consumers receive creature facts, not persistence paths or source payloads.
Encounter, Scene, World Planner, and Session Generation may apply their own
policy only after the immutable Creature result crosses this boundary.

## Write Model And Derived State

The only write model is one validated full-corpus import batch. One creature is
identified by its stable Open5e key and contains classification, CR/XP, combat
facts, abilities, movement, senses, languages, defenses, traits, actions,
environments, and source attribution.

Derived state consists of distinct filter-option sets, filtered and ordered
result pages, exact selected details, and complete current-facts snapshots.
Derived results never mutate imported truth.

## Invariants

- stable source keys and Shared-Definition identities are unique within the
  pinned source document;
- catalog truth is read-only between complete imports;
- one import publishes either the complete replacement corpus or no
  replacement;
- every page and source-document license record is fetched and validated before
  generation preparation;
- only Open5e V2 document `srd-2014` enters this owner; other Open5e game systems
  and documents are not mechanically mixed into the 2014 rules corpus;
- absent source facts remain absent; no display text becomes invented domain
  truth;
- downstream encounter, NPC, Scene, and runtime state remains owned by its own
  feature.

## Consistency Boundary

One import batch is the consistency boundary. Readers observe either the prior
complete Shared-Definition generation or the replacement complete generation.
The generation carries bounded Creature filter/sort projections; the full
statblock stays in an exact-read immutable object. A query, detail lookup, or
facts snapshot is internally consistent for its selected generation. A later
request may observe a newer completed import.

## References

- [Creatures Persistence And Import](../contract/contract-creatures-persistence.md)
- [Catalog Tab UI](../requirements/requirements-creatures-catalog.md)
- [Creature Details UI](../requirements/requirements-creatures-details.md)
