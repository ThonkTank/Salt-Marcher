Status: Deprecated
Owner: SaltMarcher Team
Last Reviewed: 2026-06-08
Source of Truth: Compatibility context contract and routing mirror for
canonical Dungeon documentation under `docs/dungeon/`.

# Dungeon Domain Context Mirror

This path remains build-visible for domain-context enforcement. It is not the
canonical long-form Dungeon documentation.

Canonical documents:

- [Dungeon Feature Docs](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/dungeon/README.md:1)
- [Dungeon Domain Architecture](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/dungeon/architecture/architecture-dungeon-domain.md:1)
- [Dungeon Domain Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/dungeon/domain/domain-dungeon.md:1)
- [Dungeon Core Model Invariants](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/dungeon/verification/verification-dungeon-core-model-invariants.md:1)
- [Dungeon Editor-Wide Invariants](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/dungeon/verification/verification-dungeon-editor-wide-invariants.md:1)

## Context Role

Context Role: Authored Dungeon Map Context
Context Name: Dungeon

- `dungeon` owns authored dungeon map truth for one authored dungeon map.
- `DungeonMap` is the aggregate root.
- Detailed model-family placement lives in the Dungeon architecture document.
- Detailed write-model ownership and invariants live in the Dungeon domain
  document.

## Published Language

`published/` owns public dungeon commands, queries, results, IDs, statuses,
authored map facts, authored operation results, editor snapshots, and travel
runtime facts.

Published dungeon carriers must not own render layers, canvas geometry,
passive-view hit payloads, display styling, SQL rows, or adapter mechanics.

## Application Boundary

Feature Runtime Boundary: DungeonEditorFeatureRuntimeRoot
Application Service: DungeonTravelRuntimeApplicationService

The feature-runtime authored operations provider coordinates editor load,
mutate, save, search, and editor-session work through the canonical Dungeon
domain and architecture owners. The travel application service coordinates
travel-runtime work. These boundaries do not define model-family placement in
this mirror.

## Aggregate Model

Aggregate Root: DungeonMap

`DungeonMap` is the transaction boundary for authored dungeon map mutations.
Canonical aggregate details live in the Dungeon domain model document.

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

- `dungeon` publishes authored snapshots, operation results, editor runtime
  snapshots, travel runtime session snapshots, and travel-action results rooted
  in authored dungeon truth.
- `dungeon` does not own party roster truth or persisted party travel position.
- `dungeon` does not publish render-ready map-canvas primitives.

## Consistency Model

Only authored write-model state and stable identities may persist as dungeon
truth. Derived editor, travel, inspector, graph, preview, render, and adapter
state must be recomputed or routed through the canonical owner documents.

## Ubiquitous Language

- `DungeonMap`: authored dungeon aggregate for one map.
- `DungeonMapId`: stable authored map identity.
- `Topology Ref`: stable identity for a selectable and mutable map element.
- `Authored Geometry`: topology-backed map shape owned by the aggregate.
- `Core Model`: authored-truth family described by Dungeon architecture.
- `Runtime Model`: transient editor and travel family described by Dungeon
  architecture.

## References

- [Dungeon Feature Docs](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/dungeon/README.md:1)
- [Dungeon Domain Architecture](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/dungeon/architecture/architecture-dungeon-domain.md:1)
- [Dungeon Domain Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/dungeon/domain/domain-dungeon.md:1)
- [Dungeon Core Model Invariants](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/dungeon/verification/verification-dungeon-core-model-invariants.md:1)
- [Dungeon Editor-Wide Invariants](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/dungeon/verification/verification-dungeon-editor-wide-invariants.md:1)
