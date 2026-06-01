Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-05-28
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
  inspectors, and raw travel surfaces are projections over the same authored
  dungeon write model
- render-oriented display models are not dungeon-owned output

## Published Language

`published/` owns public dungeon commands, queries, results, IDs, statuses,
authored map facts, authored operation results, and raw travel facts.

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
  authored model work, editor runtime, and travel runtime
- search and write-model persistence are separate outbound contracts

Target state:

- `worldspace` is no longer the target model family
- authored dungeon truth lives under `dungeon/model/core/model/**`
- editor and travel runtime state live under `dungeon/model/runtime/model/**`
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

## Core And Runtime Model Families

Initial Target Family: `core`

`core` owns authored dungeon truth. Create these model-role subpackages only
as productive migration paths need them:

- `model/core/model/geometry` for pure immutable geometry, topology values,
  and spatial rules
- `model/core/model/component` for smallest authored parts with local
  invariants, local mutation, and binding or deletion rules
- `model/core/model/structure` for composed authored structures and
  cross-component behavior
- `model/core/model/graph` for read-only relationship queries and derivations
  between authored structures; no mutations
- `model/core/model/projection` for render-neutral derived read facts only

Initial Target Family: `runtime`

`runtime` owns transient editor and travel state over core truth. Create these
model-role subpackages only as productive migration paths need them:

- `model/runtime/model/editor/session` for editor session state such as tool,
  view mode, overlay, drafts, and preview state
- `model/runtime/model/editor/interaction` for transient on-map interaction
  objects such as selection targets, handles, labels, hit targets, and drag
  intents
- `model/runtime/model/travel/session` for travel-session state over core truth and
  party-owned position facts
- `model/runtime/model/travel/projection` for derived travel read facts

`runtime` must never own authored dungeon truth. `projection` must remain
read-only and derived; it must not become persisted truth, render-owned truth,
or a second source of authored dungeon meaning.

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

## Domain-Owned Ports

- `DungeonMapRepository`
- `DungeonMapSearch`
- party travel-position published-state port

Application services coordinate load, mutate, save, search, and raw travel
surface queries through these ports. Party-aware runtime travel-session
composition belongs to the `dungeon/model/runtime/model/**` family and consumes
party published travel-position facts through dungeon-owned ports; dungeon still
does not own party roster truth or persisted party travel position.

Active root boundaries:

- `DungeonTravelApplicationService`
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
  `DungeonOperationResult`, `DungeonInspectorSnapshot`, raw travel surfaces,
  editor runtime snapshots, travel runtime snapshots, and travel-action
  results rooted in authored dungeon truth
- `dungeon/model/core/model/**` owns authored dungeon truth and the structures
  that mutate it
- `dungeon/model/runtime/model/**` owns runtime editor-session composition that
  combines authored dungeon facts with session-local selection, tool, preview,
  overlay, projection level, and pointer interpretation
- `dungeon/model/runtime/model/**` owns runtime travel-session composition that
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
