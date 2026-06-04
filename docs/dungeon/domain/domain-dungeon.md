Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-06-04
Source of Truth: Dungeon write model, ownership boundaries, and domain
invariants.

# Dungeon Domain Model

## Context Role

Context Role: Authored World-Space Context
Context Name: Dungeon

- `dungeon` owns authored dungeon map truth in the `core` model family plus
  transient editor and travel runtime state in the `runtime` model family over
  that same authored truth
- `DungeonMap` is the aggregate root for one authored map
- authored committed snapshots, authored operation results, authored selection
  inspectors, and runtime travel session surfaces are projections over the same
  authored dungeon write model
- render-oriented display models are not dungeon-owned output

## Published Language

`published/` owns public dungeon commands, queries, results, IDs, statuses,
authored map facts, authored operation results, and runtime travel facts.

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
- the current implementation still uses `dungeon/model/worldspace/**` for
  much authored model work and editor-runtime migration debt, while the active
  travel session/runtime flow has moved under `dungeon/model/runtime/**`
- search and write-model persistence are separate outbound contracts

Target state:

- `worldspace` is no longer the target model family
- authored dungeon truth lives under `dungeon/model/core/**`
- editor and travel runtime state live under `dungeon/model/runtime/**`
- authored floor, wall, path, door, and transition behavior lives in
  self-managed core owners inside the `DungeonMap` aggregate boundary instead
  of being temporary projections from broad structure or runtime managers
- topology repair, split or merge behavior, identity preservation, and derived
  rebuild rules remain in the dungeon domain and move to the deepest owning
  core object instead of staying in broad operation or helper classes
- editor and travel runtime consume core dungeon truth while keeping authored
  persistence in `DungeonMap` only
- map-owned topology remains the behavioral owner instead of leaking into view,
  data, runtime session, or projection layers

## Write Model

Only authored write-model state and stable identities may persist.

Derived state must not become a second source of truth. This includes:

- inspector text
- adjacency lists
- travel exits
- render overlays
- runtime party position

Application-owned editor and travel session state may exist outside the
authored write model when it is not persisted as dungeon truth. That state is
owned by the explicit dungeon `runtime` model family, not by separate domain
contexts and not by the authored `core` model.

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

`DungeonMap` remains the aggregate root, transaction boundary, revision owner,
and persistence frame. It must not become the central policy owner for floor,
wall, path, door, or transition behavior. Room clusters, corridors, stairs,
doors, and transitions compose durable core owners for those concepts inside
the aggregate boundary; those owners keep their own local and collection-wide
invariants while `DungeonMap` coordinates cross-owner consistency and
publication.

## Core And Runtime Model Families

Initial Target Family: `core`

`core` owns authored dungeon truth. Create these semantic model subpackages
only as productive migration paths need them:

- `model/core/geometry` for pure immutable geometry, topology values,
  and spatial rules
- `model/core/component` for smallest authored parts with local
  invariants, local mutation, and binding or deletion rules
- `model/core/structure` for composed authored structures and
  cross-component behavior
- `model/core/graph` for read-only relationship queries and derivations
  between authored structures; no mutations
- `model/core/projection` for render-neutral derived read facts only

Initial Target Family: `runtime`

`runtime` owns transient editor and travel state over core truth. Create these
semantic model subpackages only as productive migration paths need them:

- `model/runtime/editor/session` for editor session state such as tool,
  view mode, overlay, drafts, and preview state
- `model/runtime/editor/interaction` for transient on-map interaction
  objects such as selection targets, handles, labels, hit targets, and drag
  intents
- `model/runtime/travel/session` for travel-session state over core truth and
  party-owned position facts
- `model/runtime/travel/projection` for derived travel read facts

`runtime` must never own authored dungeon truth. `projection` must remain
read-only and derived; it must not become persisted truth, render-owned truth,
or a second source of authored dungeon meaning.

## Remaining Worldspace Migration Allocation

`model/worldspace/**` is current-state migration debt, not a target family.
Remaining classes under that package must be migrated by ownership, not by
mechanical renaming. A migration slice is valid only when it moves one of these
real ownership boundaries and keeps authored mutation ownership singular.

Target allocation for the remaining `model/worldspace/**` surface:

- aggregate shell: `DungeonMap`, `DungeonMapAuthoring`, `DungeonState`,
  `DungeonMapIdentity`, `DungeonMapMetadata`, and map revision or feedback
  values move to `model/core/structure` only where they express authored
  aggregate state or aggregate transaction feedback. `DungeonMap` remains the
  aggregate root and transaction boundary, but authored behavior that belongs
  to Room, Cluster, Corridor, Stair, or Transition structures must be delegated
  to those core structures.
- pure spatial values: cell, edge, direction, ordering, route, traversal, and
  boundary-key values converge into `model/core/geometry`. Existing
  `model/core/geometry` types are the target vocabulary; duplicate worldspace
  geometry carriers should be replaced or adapted only until their callers move.
- local authored components: corridor anchors, anchor refs, door bindings,
  waypoints, stair exits, and comparable smallest invariant-owning parts move
  to `model/core/component` when they own local authored identity or local
  mutation rules.
- room and cluster structures: rooms, clusters, cluster boundaries, room
  boundary partitioning, room rectangle mutation, room-cell assignment,
  narration identity, and room/cluster rebuild behavior move to
  `model/core/structure/room`. Runtime label placement or transient drag state
  stays in `model/runtime/editor/**`.
- corridor structures: corridors, corridor bindings, endpoint resolution,
  route split or validation, corridor merge/delete, corridor target delete,
  anchor pruning, door target delete, and corridor connection normalization
  move to `model/core/structure/corridor`.
- stair structures: stairs, stair shape or geometry values, generated path and
  exit rules, room-interior validation, corridor-bound stair behavior, and
  stair delete policy move to `model/core/structure/stair`.
- transition structures: transitions, transition destinations, labels,
  transition catalogs, link replacement, reverse-link cleanup, and transition
  delete policy move to `model/core/structure/transition`.
- graph and topology queries: topology refs, topology element kinds,
  relation-graph facts, traversal links, traversal sources, and map topology
  relationship queries move to `model/core/graph` only when they are read-only
  relationship facts. A graph type must not become the owner of authored
  mutation.
- authored read projections: area, boundary, feature, corridor, room,
  derived-state, selection, and snapshot facts move to `model/core/projection`
  only when they are render-neutral derived read facts over authored core truth.
  Projections may describe authored structures but must not persist or mutate
  them.
- authored catalogs and primitive placeholders: feature, room, space, and
  connection catalogs move only when they become concrete read-only
  `model/core/projection` or `model/core/graph` queries over authored core
  structures. Empty placeholders or generic primitive markers such as
  `DungeonPrimitive` must be deleted instead of receiving a target package.
- editor runtime: editor tool workflow state, pointer interpretation,
  selection targets, drag sessions, boundary drafts, transient effects,
  handles-as-editor-targets, preview state, overlay state, projection level,
  map selector state, and workspace surface values belong under
  `model/runtime/editor/session` or `model/runtime/editor/interaction`.
  `DungeonEditorWorkspaceValues` is currently session-owned runtime composition
  until a productive split creates at least two target types and a real
  responsibility gain.
- travel runtime: active travel session state, travel action facts, travel
  position facts, transition targets, traversal action catalogs, and travel
  surface facts belong under `model/runtime/travel/session` or
  `model/runtime/travel/projection`. Runtime travel may load authored core
  facts, but it must not persist dungeon structure or own authored transitions,
  rooms, corridors, or stairs.
- repositories and publication sinks: `DungeonMapRepository` remains the
  authored map repository contract until persistence mapping moves to core
  carriers. Same-context published-state sinks remain repository role files and
  accept typed core/runtime snapshots rather than raw worldspace objects.
- use cases: editor and travel use cases must end as orchestration only. They
  may load or save through repositories, open the aggregate transaction, call
  the owning core structure or runtime state object, publish typed results, and
  report status or errors. They must not remain the long-term owner of room,
  corridor, stair, transition, topology repair, or derived rebuild policy.

Transition adapters are allowed only when a slice still crosses old and target
types. Each adapter must have a deletion condition: it disappears when all
productive callers on one side use the target core/runtime owner directly.
Do not introduce new `*Logic`, `*Service`, `*Manager`, interface, or base-class
names to preserve the old shape; move behavior to the owning core structure,
component, runtime state, repository, or use case instead.

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
- legacy or imported stored shapes may be loaded for compatibility, but new
  editor-authored stair creation must use one of the supported shapes above
- direction is a cardinal dungeon edge direction
- dimensions must already satisfy the requirements-owned min/max bounds before
  the aggregate accepts the mutation
- every readable stair has at least one path cell and at least two exits on
  distinct levels
- generated path cells are deterministic and unique for one stair
- generated exits are ordered by level role and own stable exit ids where the
  same role survives recompute
- generated exit labels are domain-owned defaults unless a future state-panel
  label edit creates explicit authored labels

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
exits when those values reach the aggregate. The current real View route
constrains selected-stair shape and direction to supported values and proves
rejection of invalid dimensions and room-interior crossings without mutating
authored truth.

## Domain-Owned External Boundaries

- `DungeonMapRepository`
- `DungeonMapSearch`
- `TravelPartyStateRepository` for synchronous party travel-state reads
- `TravelPartyPositionRepository` for outbound party travel-position writes

Application services coordinate load, mutate, save, search, and runtime travel
session publication through these repositories and searches.
Party-aware runtime travel-session composition belongs to the
`dungeon/model/runtime/**` family. It reads party travel state through the
dungeon-owned `TravelPartyStateRepository` and writes party travel position through
the dungeon-owned `TravelPartyPositionRepository`; dungeon still does not own
party roster truth or persisted party travel position.

Active root boundaries:

- `DungeonEditorMapApplicationService`
- `DungeonEditorProjectionApplicationService`
- `DungeonEditorPointerApplicationService`
- `DungeonEditorNarrationApplicationService`
- `DungeonEditorStairApplicationService`
- `DungeonEditorTransitionApplicationService`
- `DungeonTravelRuntimeApplicationService`

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
- stair geometry recompute is aggregate-owned and must not be performed by view
  models or SQLite adapters
- bound stair segments cannot outlive the owning corridor and cannot be deleted
  independently from that owning corridor branch

## Cross-Context Boundary

- `dungeon` publishes authored `DungeonSnapshot`,
  `DungeonOperationResult`, `DungeonInspectorSnapshot`, editor runtime
  snapshots, travel runtime session snapshots, and travel-action results rooted
  in authored dungeon truth
- `dungeon/model/core/**` owns authored dungeon truth and the structures
  that mutate it
- `dungeon/model/runtime/**` owns runtime editor-session composition that
  combines authored dungeon facts with session-local selection, tool, preview,
  overlay, projection level, and pointer interpretation
- `dungeon/model/runtime/**` owns runtime travel-session composition that
  combines raw dungeon facts with party-owned position state
- `dungeon` does not own party roster truth or persisted party travel position
- `dungeon` does not publish render-ready cells, edges, labels, markers,
  graph nodes, or graph links for the map canvas; those are view-owned
  ContentModel projections

## References

- [Dungeon Feature Requirements](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/dungeon/requirements/requirements-dungeon.md:1)
- [Dungeon Map Adoption Architecture](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/maps/architecture/architecture-maps-dungeon-adoption.md:1)
- [Dungeon Map Surface Contract](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/maps/contract/contract-maps-dungeon-surface.md:1)
- [Dungeon Persistence Contract](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/dungeon/contract/contract-dungeon-persistence.md:1)
