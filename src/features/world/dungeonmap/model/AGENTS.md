# AGENTS.md

This file covers `src/features/world/dungeonmap/model/`.
Use it together with the parent `dungeonmap/AGENTS.md` and the repository root `AGENTS.md`.

## Layering

`geometry/ -> interaction/ + objects/ -> structures/ -> DungeonLayout`

- `geometry/` owns reusable grid math plus the canonical reusable `TileShape`/`EdgeShape` carriers, the ordered `TilePath` carrier, and the generic `TileShapeKind`/`TileShapeSpec` catalog used to author reusable paths.
- `interaction/` owns model-side selection, hit, and label descriptors that other layers may consume but not reinterpret.
- `objects/` owns thin domain objects over geometry.
- `structures/` owns dungeon semantics and structure-local behavior.
- `DungeonLayout` indexes and exposes structure relationships, traversable cells, level projections, connections, stairs, transitions, and lookups. It must not become a second home for structure-specific edit semantics.

## Geometry And Surface Contract

- `CellCoord` is the canonical cell-space primitive. `GridPoint2x` and `GridSegment2x` are the canonical doubled-grid primitives. `TileShape` and `EdgeShape` are the only model-side geometry carriers built from them.
- `TileShape` owns unordered occupied cells on exactly one level. `EdgeShape` owns doubled-grid edge geometry on exactly one level. Ordered multi-level stair geometry lives on `TilePath`. Reusable generated forms are authored through `TileShapeSpec` and `TileShapeKind`, not through stair-local enums or generators.
- Do not add offset codecs, parity bridge types, or secondary tile-area wrappers at model or persistence seams.
- `Floor` extends `TileShape`; `Wall` and `Door` extend `EdgeShape`; `Stair` owns a `TilePath` plus derived occupied-cell projections.
- `StructureDescriptor.LevelDescriptor` authors cluster/corridor truth through `surfaceShape`, `boundaryShape`, `openingShape`, and an optional floor `TileShape`. Boundary-only loads may reconstruct surface cells, but `fillSeeds` are no longer part of authored geometry truth.
- `StructureObject` hydrates floors, walls, and doors from that shape truth and may expose raw cell/edge projections only as compatibility views.
- Room and cluster persistence keep canonical raw 2x coordinates for anchors and boundary/opening rows. Legacy seed rows are transitional storage only and not geometry truth.

## Interaction Seams

- `InteractiveLabelHandle`, `DungeonHitKind`, and `DungeonSelectionRef` live in `model/interaction/`.
- `DungeonSelectionRef` carries semantic ids plus canonical geometry only. Owner semantics stay on `ownerRef()`.
- Do not add shell-local owner-resolution mirrors or storage-parity variants of selection geometry.

## Structure Ownership

- `Room` owns room identity, narration, and per-level anchors only. It does not cache or expose topology.
- `RoomCluster` owns canonical cluster structure, multi-room topology, adjacency, paint/delete/boundary mutation semantics, cluster moves, and derived local connections.
- `RoomCluster` may keep a private room partition derived from cluster structure plus room metadata for lookup queries, but that partition is read-only and must not become persistence or mutation truth.
- Room-surface queries such as cells, floors, boundaries, openings, and centers must resolve through `RoomCluster` or `DungeonLayout`, not directly from `Room`.
- Room paint/delete/boundary/floor edits mutate cluster-owned `StructureDescriptor` truth plus room metadata. They do not reroute or regenerate corridors or stairs.
- `Connection` owns connectivity, entry resolution, occupied-position projection, and passive physical carrier data. `Door` is the boundary object exposed through door-shaped connections.
- Local cluster connections are room-to-room only. Exterior room openings are plain structure openings and do not get synthetic cluster endpoints.
- Level-aware exit descriptors and door catalogs stay with room/connection truth. Public exit-description queries live on `DungeonLayout`.
- `Corridor` is a first-class structure with stable identity, nodes, segments, room bindings, derived geometry, and direct graph transforms.
- Corridor room-bound endpoints keep absolute `CellCoord` room cells in memory. The graph compiles into the same `StructureDescriptor` and `StructureObject` surface model used by cluster-derived rooms, including opening segments for room-bound endpoints and persisted free boundary doors.
- Junction nodes are explicit authored state. Routing must not invent extra nodes.
- `Stair` is a first-class structure with stable identity, authored stop levels, and direct `TilePath` ownership over its ordered occupied path. Occupied cells and exits are derived views from that path.
- `DungeonTransition` owns transition identity, destination, optional bidirectional link, and an optional placed `DungeonConnection`. Unplaced transitions are valid and spatial queries must handle absent local connections.
