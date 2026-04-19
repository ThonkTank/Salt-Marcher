Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-04-18
Source of Truth: Write model, ownership boundaries, and domain invariants
for the dungeon feature.

# Dungeon Domain Model

## Feature Boundary

Context Type: Policy-Owning Bounded Context

- `dungeon` is one feature slice with one application-service boundary.
- `map/` is the named domain module for authored dungeon-map model internals.
- A `DungeonMap` is the aggregate root for one authored dungeon map.
- Editor and travel are separate presentation slices over the same dungeon
  write model.
- Render-oriented map snapshots are read models, not the owner of dungeon
  business truth.

## Architecture Status

Target state:

- `DungeonMap` is the aggregate root and mutation boundary for one authored
  map.
- topology repair, merge and split behaviour, identity preservation, and
  derived-state rebuild rules stay in the dungeon domain instead of leaking
  into view or data.

Current implementation gap:

- the current code still leans on `DungeonDocument` plus `application/` pipelines
  for much of the active mutation flow
- the placeholder runtime still uses domain-local in-memory default collaborators
  instead of a dedicated outer adapter composition
- several core types remain thinner record-style carriers than the target
  aggregate model
- this feature is a policy-owning bounded context because editor mutations and
  identity-preserving repairs are rule-bearing domain work

## Write Model And Derived State

Only authored write-model state and stable identities may persist.

Derived state must not become a second source of truth. This includes:

- inspector text
- room descriptions derived from topology
- adjacency lists
- travel exits
- render overlays
- editor runtime state
- travel runtime state

## Canonical Aggregate

## Aggregate Model

Aggregate Root: DungeonMap

The persisted core of one dungeon map is shaped as:

```text
DungeonMap
- DungeonMapId id
- DungeonMapMetadata metadata
- SpatialTopology topology
- SpaceCatalog spaces
- RoomCatalog rooms
- ConnectionCatalog connections
- FeatureCatalog features
- long revision
```

The aggregate is the transaction boundary for one map. Internal ownership still
remains partitioned.

## Domain Module

`map/` owns the cohesive dungeon-map model. It contains the aggregate root,
supporting entities, value objects, repository contracts over authored map
truth, and deterministic derived-state helpers for the current implementation.

## Domain Partitions

### SpatialTopology

Responsibility: canonical spatial truth.

Semantically, it owns:

- which tiles are traversable interior
- which explicit internal wall edges exist
- corridor node and segment ownership
- authored door geometry
- stair planning input
- owner-tagged generated topology for corridor and stair structures

It must not own:

- room names
- room narrative text
- inspector text
- global adjacency read models

### SpaceCatalog

Responsibility: stable space identity and shared authored semantics.

It owns:

- which `SpaceId` values exist
- shared metadata per space
- whether a space is cluster-backed or corridor-backed
- segment-level semantics common across space kinds

### RoomCatalog

Responsibility: stable room identity and authored room-level semantics.

It owns:

- room identity
- room names and authored descriptions
- room-level authorial metadata that survives topology rebuilds

It does not own traversal projections or render geometry.

### ConnectionCatalog

Responsibility: stable semantic connections between spaces or rooms.

It owns:

- connection identity
- connection kind such as door or stair
- traversability semantics and notes
- relationship semantics between connected areas

It does not own the canonical door edge geometry or generated stair geometry.

### FeatureCatalog

Responsibility: authored non-space, non-connection map features.

It owns:

- stable feature identity
- authored semantics and notes
- feature-to-space or feature-to-room attachment semantics

## Commands And Invariants

Commands entering the map model include:

- create map
- delete map
- apply editor operation
- rebuild derived state from authored truth

Core invariants:

- One dungeon map has one canonical aggregate root.
- Travel and editor do not fork persisted map truth.
- Persist only authored truth and stable identity.
- Generated topology must be reproducible from the write model.
- Domain ownership must stay explicit; geometry, semantics, and read models do
  not collapse into one undifferentiated structure.

## Consistency Model

One map mutation targets one `DungeonMap` aggregate instance and increments its
authored revision. Render snapshots, inspector details, route exits, and derived
graphs are deterministic read models rebuilt from the authored map state.
Cross-context consumers use dungeon application-service operations and `api/`
carriers instead of reaching into `map/`.

## Ubiquitous Language

- `DungeonMap`: authored map aggregate root.
- `SpatialTopology`: canonical spatial truth.
- `SpaceCatalog`: stable space identity and shared space semantics.
- `RoomCatalog`: room identity and authored room-level semantics.
- `ConnectionCatalog`: stable semantic links between areas.
- `FeatureCatalog`: authored non-space, non-connection features.
- `Derived State`: reproducible projections for rendering, inspector, and
  travel.

## Domain Policies

The feature relies on explicit policies for:

- merge and split behavior
- topology repair
- route regeneration
- conflict resolution after edits
- identity preservation for authored objects

These policies are part of domain behavior. They are not UI tool definitions.

## References

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/domain-layer.md:1)
- [Dungeon Feature Spec](/home/aaron/Schreibtisch/projects/SaltMarcher/src/domain/dungeon/SPEC.md:1)
- [Dungeon Editor UI](/home/aaron/Schreibtisch/projects/SaltMarcher/src/view/dungeoneditor/UI.md:1)
- [Dungeon Travel UI](/home/aaron/Schreibtisch/projects/SaltMarcher/src/view/dungeontravel/UI.md:1)
