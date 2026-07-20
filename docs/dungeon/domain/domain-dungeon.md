Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-19
Source of Truth: Dungeon write model, ownership boundaries, and domain
invariants.

# Dungeon Domain Model

Architecture note: Dungeon-specific domain architecture, model-family
placement, and dependency direction live in
[Dungeon Domain Architecture](../architecture/architecture-dungeon-domain.md).
This document owns domain truth only.

## Context Role

Context Role: Authored Dungeon Map Context
Context Name: Dungeon

- `dungeon` owns authored dungeon map truth plus editor-session and travel
  application state over that same authored truth
- `DungeonMap` is the aggregate root for one authored map
- authored committed snapshots, authored operation results, authored selection
  inspectors, and runtime travel session surfaces are projections over the same
  authored dungeon write model
- authored feature markers are tiny committed map annotations for object,
  encounter, and point-of-interest authoring
- render-oriented display models are not dungeon-owned output

## Published Language

The Dungeon APIs own public commands, queries, results, IDs, statuses, authored
map facts, authored operation results, and runtime travel facts.

Published dungeon carriers must not own:

- render layers
- canvas geometry
- passive-view hit payloads
- display styling

## Write Model

Only authored write-model state and stable identities may persist.

Each `RoomRegion` owns its stable room identity, cluster identity, authored
floor-cell set, name, and narration. Each `RoomCluster` owns its stable cluster
identity, name, and authored boundary set. Cluster floor, anchors, centroids,
corner handles, wall-run handles, and perimeter projections derive from member
room cells plus authored boundaries and MUST NOT become independent authored
owners.

Derived state must not become a second source of truth. This includes:

- inspector text
- adjacency lists
- travel exits
- render overlays
- runtime party position

Application-owned editor-session values/effects and travel-session state may
exist outside the authored write model when they are not persisted as dungeon
truth. Pointer interpretation, transient interaction state, and draft workflows
are application concerns, not authored domain truth.

Chunks are a spatial partition of authored facts, not a second write model.
Chunk identity, viewport membership, cache residency, request generation, and
authored bounds are derived indexing or application state. Stable entity and
topology identities remain map-wide even when an entity touches several
chunks.

## Aggregate Model

Aggregate Root: `DungeonMap`

```text
DungeonMap
- DungeonMapId id
- DungeonMapMetadata metadata
- List<RoomRegion> rooms
- List<RoomCluster> clusters
- List<Boundary> boundaries
- List<Connection> connections
- List<FeatureMarker> markers
- stable topology identity and bindings
- long revision
```

The aggregate is the transaction boundary and the behavioral owner of mutable
topology.

`DungeonMap` remains the logical aggregate root, transaction boundary, and
revision owner even when an application command hydrates only the window and
identity closure it requires. It must not become the central policy owner for floor,
wall, path, door, or transition behavior. Room clusters, corridors, stairs,
doors, and transitions compose durable core owners for those concepts inside
the aggregate boundary; those owners keep their own local and collection-wide
invariants while `DungeonMap` coordinates cross-owner consistency and
publication.

## Canonical Model Language

Each authored concept has one domain representation. `Cell`, `Edge`,
`Direction`, topology identity, room region, boundary, connection, transition,
and marker values MUST NOT have same-layer wrapper and core variants that
convert through names or copied fields. Public immutable API state and
source-local persistence records may translate at their respective boundaries,
but neither becomes a second domain owner.

Canonical authored structure uses:

- `RoomRegion` for room-owned floor cells and room semantics
- `RoomCluster` for cluster identity and cluster semantics; its floor is the
  union of member room cells
- `Boundary` for authored wall, door, or explicit open-edge truth
- `Connection` variants for corridor, stair, and transition semantics
- `FeatureMarker` for object, encounter, and point-of-interest annotations

The topology index, room anchors, cluster floor, authored bounds, traversal
links, and render handles derive from these values. They may be indexed for
query performance but are not parallel authored models.

Editor tools use product language rather than storage or operation variants:

- `ToolFamily` identifies selection, room, wall, door, corridor, stair,
  transition, or feature work
- `ToolOptions` carries family-specific shape, mode, destination, or marker
  choices
- `PointerGesture` identifies primary, secondary, or modified intent

Create, delete, and alternate behavior derive from the family plus gesture. The
domain does not own JavaFX buttons, pointer coordinates, or dropdown state.

## Command Outcomes And Patches

An authored command returns one of two outcomes:

- `Rejected` contains a stable typed reason and leaves authored truth and
  revision unchanged
- `Accepted` contains a `DungeonPatch`, its inverse, touched chunks, and result
  facts required for publication

Typed rejection reasons own domain meaning such as protected boundary,
referenced connection, blocked route, invalid stair geometry, insufficient
loaded closure, missing destination, or stale revision. User-visible text is a
presentation mapping from these reasons, not domain truth.

A patch expresses changed stable identities and authored facts; it is not a
second write model. `DungeonCompoundPatch` groups changes for more than one map
when one user command, such as a bidirectional transition link, must commit and
undo atomically.

## Stair Geometry Domain Truth

`DungeonMap` owns stair geometry as authored connection truth. A stair's
domain value is a `StairGeometrySpec` plus stable map-owned identity:

- stable stair id and topology ref
- shape, anchor cell, direction, `dimension1`, and `dimension2`
- generated path cells
- generated exits
- optional owning corridor id for cross-level corridor segments

The domain, not the view or data adapter, owns deterministic stair recompute.
When shape, direction, dimensions, anchor, or exit span changes through a full
stair edit, the aggregate must recompute the generated path and exits in the
same mutation that preserves the stair identity. Direct handle movement of one
path node is a narrower mutation and does not imply a full geometry recompute.

Stair invariants:

- supported editor-authored shapes are `STRAIGHT`, `SQUARE`, and `CIRCULAR`
- direction is a cardinal dungeon edge direction
- dimensions must already satisfy the requirements-owned min/max bounds before
  the aggregate accepts the mutation
- every readable stair has at least one path cell and at least two exits on
  distinct levels
- generated path cells are deterministic and unique for one stair
- generated exits are ordered by level role and own stable exit ids where the
  same role survives recompute
- generated exit labels are domain-owned defaults unless an explicit authored
  label exists

Cross-level corridor binding:

- a corridor that connects authored endpoints on different levels owns the
  intermediate stair segment through the stair's corridor binding
- the bound stair remains selectable as a stair feature, but its edits must
  preserve the owning corridor's endpoint levels and route continuity
- deleting a bound stair directly is rejected; deleting the owning corridor
  branch is the mutation that may remove the bound stair segment

The aggregate rejects detected invalid stair geometry atomically. Rejection
preserves the previous stair, path, exits, topology binding, selection target,
and authored revision. Editor-authored create and full-recompute routes reject
unsupported editor shapes, non-cardinal directions, out-of-range dimensions,
nonunique generated path cells, and room-interior crossings outside generated
exits when those values reach the aggregate.

## Feature Marker Domain Truth

`DungeonMap` owns authored feature markers as tiny committed annotation facts.
A feature marker has only:

- stable marker id and map-owned `FEATURE_MARKER` topology ref
- optional map id for boundary correlation
- marker kind: `OBJECT`, `ENCOUNTER`, or `POI`
- anchor cell
- label
- description

Feature markers do not own encounter rosters, creatures, inventory, scripts,
hex coordinates, transition destinations, or travel actions. They may publish
as feature facts for editor selection and authored readback. Runtime travel
surfaces still treat only stairs and transitions as travel features.

## Transition Anchor Domain Truth

`Transition` owns authored placement through one `TransitionAnchor` value:

- `NONE` means the authored transition exists without a placed entrance marker
- `CELL` means the transition is placed at one authored map cell
- `EDGE` means the transition is placed at one authored map cell plus one
  cardinal edge direction

`TransitionAnchor` is the only durable placement fact for transitions. Editor
map clicks create `CELL` anchors from cell hits and `EDGE` anchors from wall or
door boundary hits. Destination
`UNLINKED_ENTRANCE` remains separate from anchor `NONE`: the former means a
placed or unplaced entrance has no destination, while the latter means the
transition has no placed entrance marker.

For `EDGE` anchors, the anchor cell is the authored edge owner and travel
entry cell; it is not a renderable transition feature cell. Editor render and
hit-test projection derive an edge marker from the anchor edge, while cell
surfaces remain reserved for `CELL` anchors.

## Application Ports And Foreign APIs

The Dungeon application owns non-blocking catalog, window-read, identity
allocation, and unit-of-work ports for authored maps. Identity allocation
reserves bounded stable ranges for every map-wide authored identity family that
commands may create, without inserting placeholder maps, topology elements,
authored entities, or child rows. Its SQLite adapter implements those ports;
adapters never surface JDBC types or exceptions through Dungeon APIs.

Party-aware travel composition consumes `PartyApi`, supplied explicitly during
application composition, for party state and outbound travel-position changes.
Dungeon does not own party roster truth or persisted party travel position.
`DungeonEditorApi` and `DungeonTravelApi` expose the typed, revisioned editor
and travel capabilities without publishing repositories or adapters. A
feature-neutral Travel capability may consume Dungeon travel readback to select
the global compact `Reise` context, but it does not own Dungeon movement rules.

## Invariants

- authored dungeon truth has one aggregate owner per map
- transition placement has one `TransitionAnchor` owner; travel cells and
  render marker placement are derived from that value and must not become
  independent anchor facts
- stable topology refs identify selectable and mutable map elements
- authored feature markers use `FEATURE_MARKER` topology refs and do not reuse
  stair or transition identity
- preview state never mutates authored truth
- one successful user command advances the authored map revision exactly once
- per-session undo and redo apply inverse or forward patches as new commits;
  their stacks and encoded memory weights are not durable domain truth
- room geometry authority comes from room-owned floor cells and cluster-owned
  boundary segments; cluster floor, boundary-corner, and wall-run handles derive
  without creating a second authored floor or relative-row domain truth
- runtime travel state never becomes authored dungeon persistence
- data rows and view models may transport dungeon facts, but they are not the
  owner of dungeon meaning
- authored corridor anchors belong to one host corridor and may be referenced
  by other corridor segments
- a corridor owning still-referenced anchors cannot be deleted
- stair geometry recompute is aggregate-owned and must not be performed by view
  models or SQLite adapters
- bound stair segments cannot outlive the owning corridor and cannot be deleted
  independently from that owning corridor branch
- a compound command commits or rejects every involved map together
- command rejection has a typed reason and never relies only on object equality
- partial hydration never authorizes a command to infer unseen authored truth

## Cross-Context Boundary

- `dungeon` publishes `DungeonViewportSnapshot`, one `DungeonEditorState` with
  typed `DungeonEditorCommandOutcome`, `DungeonTravelState`, and stable
  travel-action results rooted in authored dungeon truth
- the Dungeon authored core owns authored truth and the structures
  that mutate it
- `DungeonEditorApi` and its application owner own editor session values,
  pointer interpretation, transient interaction, drafts, and composition over
  authored facts
- `DungeonTravelApi` and its application owner own travel-session composition that
  combines raw dungeon facts with party-owned position state
- the feature-neutral Travel capability owns only global compact-context
  selection across Dungeon and Hex readbacks
- `dungeon` does not own party roster truth or persisted party travel position
- `dungeon` does not publish render-ready cells, edges, labels, markers,
  graph nodes, or graph links for the map canvas; those are presentation-owned
  projections derived from Dungeon API state

## References

- [Dungeon Feature Docs](../README.md) (line 1)
- [Dungeon Domain Architecture](../architecture/architecture-dungeon-domain.md) (line 1)
- [Dungeon Feature Requirements](../requirements/requirements-dungeon.md) (line 1)
- [Dungeon Editor Requirements](../requirements/requirements-dungeon-editor.md) (line 1)
- [Dungeon Map Adoption Architecture](../../maps/architecture/architecture-maps-dungeon-adoption.md) (line 1)
- [Dungeon Map Surface Contract](../../maps/contract/contract-maps-dungeon-surface.md) (line 1)
- [Dungeon Persistence Contract](../contract/contract-dungeon-persistence.md) (line 1)
