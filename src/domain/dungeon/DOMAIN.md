Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-04-21
Source of Truth: Write model, ownership boundaries, and domain invariants
for the dungeon feature.

# Dungeon Domain Model

## Context Role

Context Role: Authored World-Space Context

- `dungeon` is the authored world-space context with one application-service
  boundary.
- `map/` is the named domain module for authored dungeon-map model internals
  and role packages.
- A `DungeonMap` is the aggregate root for one authored dungeon map.
- Editor and travel are separate presentation slices over the same dungeon
  write model.
- Render-oriented display models are view-layer concerns, not dungeon domain
  output.

## Published Language

`published/` owns public dungeon commands, queries, results, IDs, statuses, and
domain dungeon map/world facts.

Dungeon published snapshots may describe topology, areas, boundaries, cells,
and stable dungeon references. They must not describe render layers, styles,
canvas cells, display selections, or reusable view input.

## Application Boundary

`application/` owns use cases that load dungeon maps, delegate mutation to
`map/aggregate/DungeonMap`, save through domain-owned outbound ports, and
return domain facts to the root application service. The root application
service maps those facts into `published/` carriers.

Generic default service composition and in-memory storage do not belong in the
domain application package; data-layer service contributions assemble the root
application service with data adapters.

## Architecture Status

Current state:

- `map/aggregate/DungeonMap` is the aggregate root and mutation boundary for
  one authored map.
- Editor operations now tell the aggregate to mutate authored topology seeds
  instead of rewriting a document carrier in application code.
- The application layer coordinates load, mutate, save, search, and derive
  flows through domain-owned outbound ports.
- Runtime composition lives in `src/data/dungeon/DungeonServiceContribution.java`;
  the domain service no longer constructs default persistence collaborators.
- Search and write-model persistence are separate outbound contracts:
  `DungeonMapSearch` for read selection and `DungeonMapRepository` for
  authored write-model persistence and map identity allocation.

Target state:

- Topology repair, merge and split behaviour, identity preservation, and
  derived-state rebuild rules stay in the dungeon domain instead of leaking
  into view or data.
- The map module grows from the current topology seed into explicit space,
  room, connection, and feature ownership without adding ceremonial modules.
- The editor and travel surfaces share authored map truth but keep presentation
  state outside the domain model.

Remaining implementation gap:

- Several core types remain thinner record-style carriers than the target
  aggregate model.
- Full behaviour parity with the original `salt-marcher/` dungeon schema still
  requires room-cluster, corridor, stair, transition, and feature mapping.
- This feature remains a policy-owning bounded context because editor
  mutations and identity-preserving repairs are rule-bearing domain work.

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
supporting entities, value objects, outbound ports over authored map truth, and
deterministic derived-state helpers for the current implementation.

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
- global adjacency projections for storage or view concerns

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
- Domain ownership must stay explicit; geometry, semantics, and projections do
  not collapse into one undifferentiated structure.

## Consistency Model

One map mutation targets one `DungeonMap` aggregate instance and increments its
authored revision. Inspector details, route exits, and derived graphs are
deterministic facts rebuilt from the authored map state. Render display state is
translated in ViewModels. Cross-context consumers use dungeon
application-service operations and `published/` carriers instead of reaching
into `map/`.

## Ubiquitous Language

- `DungeonMap`: authored map aggregate root.
- `SpatialTopology`: canonical spatial truth.
- `SpaceCatalog`: stable space identity and shared space semantics.
- `RoomCatalog`: room identity and authored room-level semantics.
- `ConnectionCatalog`: stable semantic links between areas.
- `FeatureCatalog`: authored non-space, non-connection features.
- `Derived State`: reproducible domain facts for inspector, topology, and
  travel; reusable render input is a view-layer display model.

## Domain Policies

The feature relies on explicit policies for:

- merge and split behavior
- topology repair
- route regeneration
- conflict resolution after edits
- identity preservation for authored objects

These policies are part of domain behavior. They are not UI tool definitions.

## References

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/domain-layer.md:1)
- [Dungeon Feature Spec](/home/aaron/Schreibtisch/projects/SaltMarcher/src/domain/dungeon/SPEC.md:1)
- [Dungeon Map Slotcontent](/home/aaron/Schreibtisch/projects/SaltMarcher/src/view/slotcontent/main/dungeonmap/dungeon-map.md:1)
