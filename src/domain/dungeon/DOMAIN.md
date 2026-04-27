Status: Deprecated
Owner: SaltMarcher Team
Last Reviewed: 2026-04-26
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
- editor and travel are separate presentations over the same dungeon write
  model
- render-oriented display models are view concerns, not dungeon-domain output

## Published Language

`published/` owns public dungeon commands, queries, results, IDs, statuses,
and dungeon map facts.

Published dungeon carriers must not own:

- render layers
- canvas geometry
- passive-view hit payloads
- display styling

## Application Boundary

`application/` coordinates load, mutate, save, and search through the
domain-owned ports. The root application service maps authored dungeon truth
and derived results into `published/` carriers without moving preview,
rendering, or runtime party state into the domain model.

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
