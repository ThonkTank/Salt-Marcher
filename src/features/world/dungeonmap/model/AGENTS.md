# AGENTS.md

This file covers `src/features/world/dungeonmap/model/`.
Use it together with the parent `dungeonmap/AGENTS.md` and the repository root `AGENTS.md`.

## Layering

`geometry/ -> interaction/ + objects/ -> structures/ -> DungeonLayout`

- `geometry/` owns reusable grid math plus all canonical geometry algebra and base shape contracts.
- `interaction/` owns model-side selection, hit, and label descriptors that other layers may consume but not reinterpret.
- `objects/` owns semantic gameplay objects as thin extensions of geometry shapes.
- `structures/` owns high-level dungeon semantics and structure-topology behavior over `StructureObject`.
- `DungeonLayout` indexes and exposes structure relationships, traversable cells, level projections, connections, stairs, transitions, and lookups. It must not become a second home for structure-specific edit semantics.

## Target Geometry Architecture (`model/geometry`)

`model/geometry` is the only place where geometry algebra is defined.
Any math over tiles, boundaries, path routing primitives, connected edges, shape union/diff/intersection, or coordinate transforms belongs here.
Other model packages and upper layers may consume these types but must not mirror their math.

### Allowed ownership in `geometry/`

- `grid/` (or equivalent namespace) owns the coordinate system primitives (`CellCoord`, `GridPoint2x`, `GridSegment2x`, and related grid helpers).
- `Shape` is the base geometry contract for reusable dungeon shapes.
- `TileShape`, `EdgeShape`, and `TilePath` are the canonical reusable shape families:
  - `TileShape`: arbitrary polygonal tile surface on the grid.
  - `EdgeShape`: arbitrary connected edge network; individual edges do **not** need to form closed loops.
  - `TilePath`: ordered tile-following path for stair/corridor planning.
- `TileShapeKind` / `TileShapeSpec` stay generic geometry authoring specs and must not become stair- or corridor-specific enums.

### Forbidden in `geometry/`

- No gameplay semantics (`Door` traversability rules, room ownership, cluster membership, etc.).
- No persistence ordering or JDBC concerns.
- No editor tool/session state.

## Object Semantics Architecture (`model/objects`)

`model/objects` owns gameplay object semantics.
It answers object-level meaning and validation, while delegating geometry algebra to `geometry/`.

### Allowed ownership in `objects/`

- `Floor`, `Wall`, `Door`, `Stair` are the canonical base gameplay objects.
- Every base object extends exactly one canonical geometry family:
  - `Floor` extends `TileShape`.
  - `Wall` and `Door` extend `EdgeShape`.
  - passive object-side `Stair` extends `TilePath`.
- Each object may own only object semantics: allowed/forbidden forms, placement constraints, stateful gameplay flags, and object-specific behavior.
- `StructureObject` is the only object aggregate owner. It combines walls, doors, floors, and stairs into one coherent topology and owns object-aggregate capabilities (room closure checks, selected-room-by-click queries, boundary/opening derivation, reachability, component splits).

### Forbidden in `objects/`

- No parallel geometry algebra that duplicates `geometry/`.
- No duplicate topology owners outside `StructureObject`.
- No repository/application-specific workflow orchestration.

## Structure Topology Architecture (`model/structures`)

`model/structures` owns the highest-level topology owners and composes `StructureObject` instead of bypassing it.

### Allowed ownership in `structures/`

- `RoomCluster` and `Corridor` are the central structure owners.
- Both extend/compose one canonical `StructureObject` and add only structure-level topology responsibilities:
  - `RoomCluster`: room lifecycle topology (merge, split, grouping, room-anchor semantics).
  - `Corridor`: route-planning topology that ultimately determines concrete corridor form.
- `Room` remains identity/narration/anchor metadata only.
- `DungeonLayout` remains the read/query index over current structure owners.

### Forbidden in `structures/`

- No second object aggregate beside `StructureObject`.
- No second geometry math seam beside `geometry/`.
- No structure-local copies of wall/door/floor/stair algebra.

## Cross-layer usage rules

- If another directory (including `application/`, `repository/`, `canvas/`, `shell/`) needs geometry calculations, it must use `geometry` shape APIs directly or create/extend geometry shape instances there.
- Higher layers must query object/structure semantics from model owners; do not rebuild those semantics in tools, renderers, or repositories.
- All write flows that alter room/corridor/stair physical form must route through model-owned mutation/factory seams so behavior remains canonical.

## Interaction Seams

- `InteractiveLabelHandle`, `DungeonHitKind`, and `DungeonSelectionRef` live in `model/interaction/`.
- `DungeonSelectionRef` carries semantic ids plus canonical geometry only. Owner semantics stay on `ownerRef()`.
- Do not add shell-local owner-resolution mirrors or storage-parity variants of selection geometry.

## Structure Ownership Details

- `Room` owns room identity, narration, and per-level anchors only. It does not cache or expose topology.
- `RoomCluster` owns cluster metadata plus room/door workflow semantics over `StructureObject`-owned topology queries.
- Room-surface queries such as cells, floors, boundaries, openings, and centers must resolve through `RoomCluster` or `DungeonLayout`, not directly from `Room`.
- Room paint/delete/boundary/floor edits mutate cluster-owned `StructureObject` level truth plus room metadata. They do not reroute or regenerate corridors or stairs.
- `Connection` owns connectivity, entry resolution, occupied-position projection, and passive physical carrier data.
- `Corridor` is a first-class structure with stable identity, nodes, segments, room bindings, and direct graph transforms.
- Corridor room-bound endpoints keep absolute `CellCoord` room cells in memory. Routed traces and physical topology projections resolve through the same `StructureObject` model used by clusters.
- Junction nodes are explicit authored state. Routing must not invent extra nodes.
- `DungeonStair` is the first-class persisted stair owner with stable identity and one canonical `StructureObject`. The passive object-side `Stair` inside that structure carries the ordered `TilePath`, authored stop levels, and derived exits.
- `DungeonTransition` owns transition identity, destination, optional bidirectional link, and an optional placed `DungeonConnection`. Unplaced transitions are valid and spatial queries must handle absent local connections.
