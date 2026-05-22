Status: Deprecated
Owner: SaltMarcher Team
Last Reviewed: 2026-05-08
Source of Truth: Compatibility mirror for canonical documentation at `docs/dungeon/domain/domain-dungeon.md`.

# Dungeon Domain Model Compatibility Mirror

This legacy path remains build-visible during the documentation-taxonomy
migration. Canonical feature-owned documentation lives at:

- [Dungeon Domain Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/dungeon/domain/domain-dungeon.md:1)

## Context Role

Context Role: Authored World-Space Context
Context Name: Dungeon

- `dungeon` owns authored dungeon map truth
- `DungeonMap` is the aggregate root for one authored map
- authored committed snapshots, authored operation results, authored selection
  inspectors, and raw travel surfaces are projections over the same authored
  dungeon write model
- render-oriented display models and runtime editor-session policy are not
  dungeon-owned output

## Published Language

`published/` owns public dungeon commands, queries, results, IDs, statuses,
authored map facts, authored operation results, and raw travel facts.

Published dungeon carriers must not own:

- render layers
- canvas geometry
- passive-view hit payloads
- display styling

## Application Boundary

Application Service: DungeonTravelApplicationService
Application Service: DungeonEditorApplicationService
Application Service: DungeonTravelRuntimeApplicationService

`application/` coordinates authored dungeon load, mutate, save, search, and
raw travel-surface queries through the domain-owned ports. The root
application-service family maps authored dungeon truth and derived results
into `published/` carriers while editor runtime and travel runtime stay in
explicit dungeon model families. Render ownership stays in the view layer.

## Aggregate Model

Aggregate Root: DungeonMap

`DungeonMap` is the transaction boundary and behavioral owner of mutable
topology, authored geometry, semantic bindings, and room or connection facts
for one dungeon map.

## Commands And Invariants

Commands entering the model are:

- create map
- load map
- apply authored topology operation
- save map
- search maps

Core invariants:

- authored dungeon truth has one aggregate owner per map
- stable topology refs identify selectable and mutable map elements
- preview state never mutates authored truth
- runtime travel state never becomes authored dungeon persistence
- data rows and view models may transport dungeon facts, but they are not the
  owner of dungeon meaning

## Cross-Context Boundary

- `dungeon` publishes authored `DungeonSnapshot`,
  `DungeonOperationResult`, `DungeonInspectorSnapshot`, raw travel surfaces,
  and travel-action results rooted in authored dungeon truth
- `dungeon/model/editor/**` owns runtime editor-session composition that
  combines authored dungeon facts with session-local selection, tool, preview,
  overlay, projection level, and pointer interpretation
- `dungeon/model/travel/**` owns runtime session composition that combines raw
  dungeon facts with party-owned position state
- `dungeon` does not own party roster truth or persisted party travel position
- `dungeon` does not publish render-ready map-canvas primitives

## Consistency Model

Only authored write-model state and stable identities may persist.

Derived state must not become a second source of truth. This includes:

- inspector text
- adjacency lists
- travel exits
- preview state
- render overlays
- runtime party position

## Ubiquitous Language

- `DungeonMap`: authored dungeon aggregate for one map.
- `DungeonMapId`: stable authored map identity.
- `Topology Ref`: stable identity for a selectable and mutable map element.
- `Authored Geometry`: topology-backed map shape owned by the aggregate.

## References

- [Dungeon Domain Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/dungeon/domain/domain-dungeon.md:1)
