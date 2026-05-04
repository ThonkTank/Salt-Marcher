Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-05-03
Source of Truth: Dungeon write model, ownership boundaries, and domain
invariants.

# Dungeon Domain Model

## Context Role

Context Role: Authored World-Space Context
Context Name: Dungeon

- `dungeon` owns authored dungeon map truth
- `DungeonMap` is the aggregate root for one authored map
- authored committed snapshots, authored operation results, authored selection
  inspectors, and raw travel surfaces are projections over the same authored
  dungeon write model
- runtime editor-session policy and render-oriented display models are not
  dungeon-owned output

## Published Language

`published/` owns public dungeon commands, queries, results, IDs, statuses,
authored map facts, authored operation results, and raw travel facts.

Published dungeon carriers must not own:

- render layers
- canvas geometry
- passive-view hit payloads
- display styling

## Current Architecture Status

Current state:

- `DungeonMap` is the aggregate root and mutation boundary for one authored map
- stable topology refs are map-owned and reused by rooms, corridors, doors,
  corridor anchors, stairs, and transitions
- authored room narration persists through the dungeon write model
- editor preview and apply share the same operation vocabulary
- corridor bindings own explicit endpoint truth:
  doors pin room-side endpoints by stable topology ref and corridor anchors pin
  corridor-side endpoints by stable topology ref
- generic corridor-tool clicks are resolved into authored doors or authored
  corridor anchors before the aggregate commits a corridor mutation
- runtime editor-session composition now lives in the separate
  `dungeoneditor` context
- runtime travel derives from committed authored truth plus party-owned runtime
  state through the separate `travel` context
- search and write-model persistence are separate outbound contracts

Target state:

- topology repair, split or merge behavior, identity preservation, and derived
  rebuild rules remain in the dungeon domain
- editor and authored travel share dungeon truth while keeping authored
  persistence in `DungeonMap` only
- map-owned topology remains the behavioral owner instead of leaking into view
  or data layers

## Write Model

Only authored write-model state and stable identities may persist.

Derived state must not become a second source of truth. This includes:

- inspector text
- adjacency lists
- travel exits
- render overlays
- runtime party position

Application-owned session state may exist outside the authored write model when
it is not persisted as dungeon truth, but that state is owned by a separate
generation-policy context such as `dungeoneditor` or `travel`, not by
`dungeon`.

## Aggregate Model

Aggregate Root: `DungeonMap`

```text
DungeonMap
- DungeonMapId id
- DungeonMapMetadata metadata
- topology-backed authored geometry
- stable topology identity and binding catalogs
- authored room semantics
- authored connection semantics
- authored feature semantics
- long revision
```

The aggregate is the transaction boundary and the behavioral owner of mutable
topology.

## Domain-Owned Ports

- `DungeonMapRepository`
- `DungeonMapSearch`

Application services coordinate load, mutate, save, search, and raw travel
surface queries through these ports. Party-aware runtime travel-session
composition belongs to the separate `travel` context, not to `dungeon`.

## Invariants

- authored dungeon truth has one aggregate owner per map
- stable topology refs identify selectable and mutable map elements
- preview state never mutates authored truth
- runtime travel state never becomes authored dungeon persistence
- data rows and view models may transport dungeon facts, but they are not the
  owner of dungeon meaning
- authored corridor anchors belong to one host corridor and may be referenced
  by other corridor segments
- a corridor owning still-referenced anchors cannot be deleted

## Cross-Context Boundary

- `dungeon` publishes authored `DungeonSnapshot`,
  `DungeonOperationResult`, `DungeonInspectorSnapshot`, raw travel surfaces,
  and travel-action results rooted in authored dungeon truth
- `dungeoneditor` owns runtime editor-session composition that combines
  authored dungeon facts with session-local selection, tool, preview, overlay,
  and projection state
- `travel` owns runtime session composition that combines those raw dungeon
  facts with party-owned position state
- `dungeon` does not own editor selection, tool, overlay, projection, preview,
  or pointer-interpretation session state
- `dungeon` does not own overlay settings, projection level, refresh cycle, or
  overworld fallback state for the interactive travel workspace

## References

- [Dungeon Feature Requirements](./requirements-dungeon.md)
- [Dungeon Map Adoption Architecture](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/maps/architecture/architecture-maps-dungeon-adoption.md:1)
- [Dungeon Map Surface Contract](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/maps/contract/contract-maps-dungeon-surface.md:1)
- [Dungeon Persistence Contract](./contract-dungeon-persistence.md)
