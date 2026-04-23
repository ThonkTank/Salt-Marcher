Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-04-23
Source of Truth: Write model, ownership boundaries, and domain invariants
for the dungeon feature.

# Dungeon Domain Model

## Context Role

Context Role: Authored World-Space Context
Context Name: Dungeon

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
- `DungeonMap` owns authored topology for the whole map. Rooms, clusters,
  corridors, doors, stairs, and transitions bind to map topology through stable
  topology refs; they do not negotiate ownership with each other during
  mutation.
- The data adapter persists those refs in an authoritative source-local
  `dungeon_topology_elements` table. That table stores identity and binding
  facts; topology behavior and mutation routing still belong to `DungeonMap`.
- `SpatialTopology` remains a legacy-shaped geometry carrier for room-cluster
  centers, polygon vertices, and explicit internal wall or door edges loaded
  from SQLite. It is not the behavioral owner of topology.
- Cluster boundary rows identify the owning dungeon tile plus one cardinal tile
  side. Derived wall and door edges are grid-vertex segments on that tile side,
  not lines between tile centers.
- `RoomCatalog` now carries authored room identity, names, floor anchors, and
  narration loaded from the legacy write model.
- `ConnectionCatalog` carries semantic connection descriptors and bindings:
  corridor identity, ordered room membership, relative waypoints, room door
  bindings, stair descriptors, corridor attachments, and transition destination
  facts. The map interprets those bindings when topology is rebuilt or mutated.
- Runtime travel surfaces now derive traversal and transition actions from
  committed authored map truth. Local door and stair movement
  share one `DungeonTraversalLink` model: two known dungeon tiles connected by
  a party-traversible link. The active character travel position is owned by
  `party` character state and is not persisted as authored dungeon truth.
- Editor operations now tell the aggregate to mutate authored map metadata,
  selected topology placement, room geometry, and room narration instead of
  rewriting a document carrier in application code.
- Editor map loading uses the map-specific editor snapshot so selection
  handles, map geometry, and relation-derived preview data are projected from
  the same authored map before any drag mutation starts.
- Editor drag feedback is presentation-local. The domain write model changes
  only when the view commits the selected editor-handle movement on release.
- Empty authored maps remain empty until the editor creates room geometry; the
  domain no longer synthesizes a seed room or demo corridor as derived state.
- Interactive editor mutations now include selected editor-handle movement,
  room rectangle paint/delete, and cluster wall or door edits. Handle movement
  resolves cluster labels, doors, corridor waypoints, and stair anchors through
  the map-owned topology index, then mutates the owning authored structure
  without adding marker-only ownership to topology elements or introducing a
  public `CLUSTER` topology kind. Room paint/delete rewrites authored cluster
  cell geometry, preserves stable identities for the primary surviving
  component, allocates deterministic local IDs for new split components, and
  rebuilds derived map state from persisted authored truth. Wall create/delete
  mutates explicit cluster boundary rows; door create/delete mutates the same
  boundary model and rebuilds room components so walls and doors remain authored
  topology facts rather than view-owned overlays. Room narration saves update
  `RoomCatalog` through the aggregate and stay authored room semantics.
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
- The map module grows around map-owned topology with explicit semantic
  bindings for spaces, rooms, connections, and features without adding
  ceremonial modules.
- The editor and travel surfaces share authored map truth but keep presentation
  state outside the domain model.

Remaining implementation gap:

- Several core types remain thinner record-style carriers than the target
  aggregate model.
- Full behaviour parity with the original `salt-marcher/` dungeon schema still
  requires corridor editing, stair editing, transition editing, direct
  token-drag movement, cross-map dungeon transition follow-through, and
  remaining non-space feature mapping.
- The current derived-state rebuild hydrates rooms from map-owned topology
  interpreted through cluster polygons and internal wall or door boundaries,
  then derives corridor cells and door relations from authored corridor
  membership, waypoints, and door bindings.
  Door boundaries and stair exits are now projected into one derived traversal
  link model. Transition destinations remain authored facts and are exposed as
  runtime travel actions because cross-map and overworld targets are not always
  two known local dungeon tiles. Character position persistence is delegated to
  the party boundary.
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
- character travel runtime state

## Canonical Aggregate

## Aggregate Model

Aggregate Root: DungeonMap

The persisted core of one dungeon map is shaped as:

```text
DungeonMap
- DungeonMapId id
- DungeonMapMetadata metadata
- SpatialTopology topology
- DungeonMapTopology topologyIndex
- SpaceCatalog spaces
- RoomCatalog rooms
- ConnectionCatalog connections
- FeatureCatalog features
- long revision
```

The aggregate is the transaction boundary and the only behavioral topology
owner for one map. Internal catalogs partition semantic bindings and authored
metadata, but they do not own mutable topology.

## Domain Module

`map/` owns the cohesive dungeon-map model. It contains the aggregate root,
supporting entities, value objects, outbound ports over authored map truth, and
deterministic derived-state helpers for the current implementation.

## Domain Partitions

### DungeonMap / DungeonMapTopology

Responsibility: canonical topology ownership and binding resolution.

Semantically, it owns:

- stable topology refs for selectable and mutable map elements
- which semantic descriptor binds to which topology ref
- map-level mutation routing for rooms, corridors, doors, stairs, transitions,
  and generated topology
- topology repair, route regeneration, and derived-state rebuild triggers

It must not delegate mutation ownership to a live room, cluster, corridor,
door, or stair object.
Persisted topology refs may be loaded from SQLite, but the persistence table is
only source-local storage for the map-owned identity model.

### SpatialTopology

Responsibility: legacy-compatible authored geometry carrier.

Semantically, it carries:

- which tiles are traversable interior
- which explicit internal wall edges exist
- authored room-cluster polygon vertices
- authored internal door boundaries
- authored door geometry as map-interpreted edge data
- wall and door edge projection from tile-side markers into grid-vertex
  boundary segments

It must not own:

- room names
- room narrative text
- map-level topology mutation policy
- corridor routing policy
- door, stair, or transition ownership
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
- per-floor room anchors
- authored room exit descriptions
- room-level authorial metadata that survives topology rebuilds

It does not own traversal projections or render geometry. Selection inspectors
may edit its narration, but the editable exit list itself is derived from
current traversal links and then saved back as authored descriptions keyed by
room cell and edge direction.

### ConnectionCatalog

Responsibility: stable semantic connection descriptors and bindings.

It owns:

- connection identity
- connection kind such as door or stair
- authored corridor room membership
- authored corridor waypoints and door bindings
- authored stair path nodes, exits, shape, direction, dimensions, and corridor
  attachment
- authored transition placement, destination, and link references
- traversability semantics and notes
- relationship semantics between connected areas
- bindings that allow the map to resolve which topology refs participate in a
  corridor, door, stair, or transition

It does not own generated corridor route cells, door topology, view traversal
state, or cross-context travel execution.

### FeatureCatalog

Responsibility: authored non-space, non-connection map features.

It owns:

- stable feature identity
- authored semantics and notes
- feature-to-space or feature-to-room attachment semantics

## Commands And Invariants

Commands entering the map model include:

- create map
- rename map
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
- `DungeonMapTopology`: map-owned topology index of stable refs and semantic
  bindings.
- `SpatialTopology`: legacy-compatible authored geometry carrier interpreted by
  the map.
- `SpaceCatalog`: stable space identity and shared space semantics.
- `RoomCatalog`: room identity and authored room-level semantics.
- `ConnectionCatalog`: stable semantic links between areas.
- `DungeonCorridor`: authored corridor membership and route binding truth.
- `DungeonStair`: authored vertical traversal connection with stable identity,
  occupied cells, exits, and corridor attachment.
- `DungeonTransition`: authored map or overworld transition with stable
  identity, optional placement, destination, and link reference.
- `DungeonTraversalLink`: derived local party-traversible connection between
  exactly two dungeon tiles. Door and stair authored inputs both become this
  model before runtime movement is exposed.
- `DungeonTravelSurface`: derived runtime description for the party's current
  dungeon location, including actions for available traversal links and
  transitions.
- `DungeonTravelAction`: transient runtime command target derived from
  traversal links or transition destinations.
- `FeatureCatalog`: authored non-space, non-connection features.
- `Derived State`: reproducible domain facts for inspector, topology, and
  travel; reusable render input is a view-layer display model.

## Domain Policies

The feature relies on explicit policies for:

- merge and split behavior
- topology repair
- route regeneration owned by the map and delegated to stateless routing
  services
- conflict resolution after edits
- identity preservation for authored objects

These policies are part of domain behavior. They are not UI tool definitions.

## References

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/domain-layer.md:1)
- [Dungeon Feature Spec](/home/aaron/Schreibtisch/projects/SaltMarcher/src/domain/dungeon/SPEC.md:1)
- [Dungeon Map Slotcontent](/home/aaron/Schreibtisch/projects/SaltMarcher/src/view/slotcontent/main/dungeonmap/dungeon-map.md:1)
