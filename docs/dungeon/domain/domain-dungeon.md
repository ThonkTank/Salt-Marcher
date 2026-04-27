Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-04-24
Source of Truth: Dungeon write model, ownership boundaries, and domain
invariants.

# Dungeon Domain Model

## Context Role

Context Role: Authored World-Space Context
Context Name: Dungeon

- `dungeon` owns authored dungeon map truth
- `DungeonMap` is the aggregate root for one authored map
- editor and travel are separate presentations over the same dungeon write
  model
- render-oriented display models are view concerns, not dungeon-domain output

## Published Language

`published/` owns public dungeon commands, queries, results, IDs, statuses, and
dungeon map facts.

Published dungeon carriers must not own:

- render layers
- canvas geometry
- passive-view hit payloads
- display styling

## Current Architecture Status

Current state:

- `DungeonMap` is the aggregate root and mutation boundary for one authored map
- stable topology refs are map-owned and reused by rooms, corridors, doors,
  stairs, and transitions
- authored room narration persists through the dungeon write model
- editor preview and apply share the same operation vocabulary
- runtime travel derives from committed authored truth plus party-owned runtime
  state
- search and write-model persistence are separate outbound contracts

Target state:

- topology repair, split or merge behavior, identity preservation, and derived
  rebuild rules remain in the dungeon domain
- editor and travel share authored map truth but keep presentation state
  outside the domain model
- map-owned topology remains the behavioral owner instead of leaking into view
  or data layers

## Write Model

Only authored write-model state and stable identities may persist.

Derived state must not become a second source of truth. This includes:

- inspector text
- adjacency lists
- travel exits
- preview state
- render overlays
- runtime party position

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

Application services coordinate load, mutate, save, and search through these
ports. Runtime composition belongs to outer layers.

## Invariants

- authored dungeon truth has one aggregate owner per map
- stable topology refs identify selectable and mutable map elements
- preview state never mutates authored truth
- runtime travel state never becomes authored dungeon persistence
- data rows and view models may transport dungeon facts, but they are not the
  owner of dungeon meaning

## References

- [Dungeon Feature Requirements](./requirements-dungeon.md)
- [Dungeon Map Adoption Architecture](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/maps/architecture/architecture-maps-dungeon-adoption.md:1)
- [Dungeon Map Surface Contract](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/maps/contract/contract-maps-dungeon-surface.md:1)
- [Dungeon Persistence Contract](./contract-dungeon-persistence.md)
