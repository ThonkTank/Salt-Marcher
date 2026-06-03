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

- `dungeon` owns authored dungeon map truth; canonical target-family placement
  is defined by `docs/dungeon/domain/domain-dungeon.md`
- `DungeonMap` is the aggregate root for one authored map
- authored committed snapshots, authored operation results, authored selection
  inspectors, and runtime travel session surfaces are projections over the same
  authored dungeon write model
- render-oriented display models and runtime editor-session policy are not
  dungeon-owned output

## Published Language

`published/` owns public dungeon commands, queries, results, IDs, statuses,
authored map facts, authored operation results, and runtime travel facts.

Published dungeon carriers must not own:

- render layers
- canvas geometry
- passive-view hit payloads
- display styling

## Application Boundary

Application Service: DungeonEditorMapApplicationService
Application Service: DungeonEditorProjectionApplicationService
Application Service: DungeonEditorPointerApplicationService
Application Service: DungeonEditorNarrationApplicationService
Application Service: DungeonEditorStairApplicationService
Application Service: DungeonEditorTransitionApplicationService
Application Service: DungeonTravelRuntimeApplicationService

`application/` coordinates authored dungeon load, mutate, save, search, and
runtime travel-session publication through domain-owned repositories and
searches. Travel runtime reads party travel state through the dungeon-owned
`TravelPartyStateRepository` and writes party travel position through the
dungeon-owned `TravelPartyPositionRepository`; party roster truth and persisted
party travel position remain party-owned. The root application-service family
maps authored dungeon truth and derived results into `published/` carriers
while editor runtime and travel runtime remain same-context dungeon runtime
state as defined by the canonical dungeon domain document. Render ownership
stays in the view layer.

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
  `DungeonOperationResult`, `DungeonInspectorSnapshot`, runtime travel session
  surfaces, and travel-action results rooted in authored dungeon truth
- dungeon runtime travel consumes party-owned travel-position facts only through
  dungeon-owned external boundaries over party published state, currently
  `TravelPartyStateRepository` and `TravelPartyPositionRepository`
- canonical dungeon documentation owns target model-family placement for
  authored truth, editor runtime composition, and travel runtime composition
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
- `Core Model`: canonical authored-truth family defined by the dungeon domain
  document.
- `Runtime Model`: canonical transient editor and travel family defined by the
  dungeon domain document.

## References

- [Dungeon Domain Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/dungeon/domain/domain-dungeon.md:1)
