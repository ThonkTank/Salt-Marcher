Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-06-08
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

- `dungeon` owns authored dungeon map truth in the `core` model family plus
  neutral editor session/application seams and travel runtime state in the
  `runtime` model family over that same authored truth; migrated Dungeon Editor
  interaction/session workflows are feature-runtime-owned
- `DungeonMap` is the aggregate root for one authored map
- authored committed snapshots, authored operation results, authored selection
  inspectors, and runtime travel session surfaces are projections over the same
  authored dungeon write model
- authored feature markers are tiny committed map annotations for object,
  encounter, and point-of-interest authoring
- render-oriented display models are not dungeon-owned output

## Published Language

`published/` owns public dungeon commands, queries, results, IDs, statuses,
authored map facts, authored operation results, and runtime travel facts.

Published dungeon carriers must not own:

- render layers
- canvas geometry
- passive-view hit payloads
- display styling

## Write Model

Only authored write-model state and stable identities may persist.

Target authored room geometry is owned as cluster-local floor and boundary truth
inside the `DungeonMap` aggregate. Current persistence and domain readback use
cluster-owned floor cells and wall or boundary facts as durable authored truth
for room geometry. Published corner and midpoint handles already derive from
boundary facts through the wall facade. Room cell membership, room anchors, room
labels, and cluster centroids continue migrating toward derivation from authored
floor and boundary truth rather than from an independent room-cell source.
Retired cluster-vertex persistence is not target authoritative room geometry
and must not participate in current schema read/write or cleanup paths or be
expanded into a second write-model owner.

Derived state must not become a second source of truth. This includes:

- inspector text
- adjacency lists
- travel exits
- render overlays
- runtime party position

Application-owned neutral editor session values/effects and travel session
state may exist outside the authored write model when they are not persisted as
dungeon truth. Those domain runtime seams are not authored `core` state.
Migrated Dungeon Editor pointer interpretation, transient interaction state, and
draft workflows are feature-runtime-owned.

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
- older or imported stored shapes may be loaded for compatibility, but new
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

## Feature Marker Domain Truth

`DungeonMap` owns authored feature markers as tiny committed annotation facts.
A feature marker has only:

- stable marker id and map-owned `FEATURE_MARKER` topology ref
- optional map id for future projection or persistence mapping
- marker kind: `OBJECT`, `ENCOUNTER`, or `POI`
- anchor cell
- label
- description

Feature markers do not own encounter rosters, creatures, inventory, scripts,
hex coordinates, transition destinations, or travel actions. They may publish
as feature facts for editor selection and authored readback. Runtime travel
surfaces still treat only stairs and transitions as travel features.

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

- `DungeonEditorFeatureRuntimeRoot` owns the feature-runtime authored editor
  operations provider for map catalog, projection, pointer, narration, label,
  stair, and transition writes over authored dungeon truth
- `DungeonTravelRuntimeApplicationService`

## Invariants

- authored dungeon truth has one aggregate owner per map
- stable topology refs identify selectable and mutable map elements
- authored feature markers use `FEATURE_MARKER` topology refs and do not reuse
  stair or transition identity
- preview state never mutates authored truth
- target room geometry authority comes from reusable floor-cell and
  boundary-segment component ownership; boundary-corner and wall-run handle
  derivation now also routes through that component boundary surface, while
  cluster-local relative boundary rows still transport persistence-facing
  direction and storage compatibility during the remaining migration
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
- `dungeon/model/runtime/**` owns neutral editor session values and session
  application seams over authored dungeon facts; migrated Dungeon Editor
  pointer interpretation, transient interaction objects, draft workflows, and
  runtime composition are owned by `src/features/dungeon/runtime/**`
- `dungeon/model/runtime/**` owns runtime travel-session composition that
  combines raw dungeon facts with party-owned position state
- `dungeon` does not own party roster truth or persisted party travel position
- `dungeon` does not publish render-ready cells, edges, labels, markers,
  graph nodes, or graph links for the map canvas; those are view-owned
  ContentModel projections

## References

- [Dungeon Feature Docs](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/dungeon/README.md:1)
- [Dungeon Domain Architecture](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/dungeon/architecture/architecture-dungeon-domain.md:1)
- [Dungeon Feature Requirements](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/dungeon/requirements/requirements-dungeon.md:1)
- [Dungeon Editor Requirements](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/dungeon/requirements/requirements-dungeon-editor.md:1)
- [Dungeon Map Adoption Architecture](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/maps/architecture/architecture-maps-dungeon-adoption.md:1)
- [Dungeon Map Surface Contract](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/maps/contract/contract-maps-dungeon-surface.md:1)
- [Dungeon Persistence Contract](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/dungeon/contract/contract-dungeon-persistence.md:1)
- [Dungeon Core Model Invariants](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/dungeon/verification/verification-dungeon-core-model-invariants.md:1)
- [Dungeon Editor-Wide Invariants](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/dungeon/verification/verification-dungeon-editor-wide-invariants.md:1)
