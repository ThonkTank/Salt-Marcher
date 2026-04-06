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
- `Floor` extends `TileShape`; `Wall` and `Door` extend `EdgeShape`; passive object-side `Stair` extends `TilePath`. Those typed objects add semantics, while topology math lives on the shared shape bases.
- `StructureObject.LevelStructure` authors cluster/corridor truth through `surfaceShape`, `boundaryShape`, `openingShape`, and an optional floor `TileShape`. Surface cells are explicit authored topology; boundary rows do not rehydrate the surface.
- `StructureObject` is the topology orchestrator over shape-backed `Floor`, `Wall`, `Door`, and optional passive `Stair` projections. It may expose raw cell/edge projections only as compatibility views, and it is the only allowed bridge from `objects/` into `structures/`.
- Room and cluster persistence keep canonical raw 2x coordinates for anchors, explicit cluster surface cells, floor cells, and boundary/opening rows.

## Interaction Seams

- `InteractiveLabelHandle`, `DungeonHitKind`, and `DungeonSelectionRef` live in `model/interaction/`.
- `DungeonSelectionRef` carries semantic ids plus canonical geometry only. Owner semantics stay on `ownerRef()`.
- Do not add shell-local owner-resolution mirrors or storage-parity variants of selection geometry.

## Structure Ownership

- `Room` owns room identity, narration, and per-level anchors only. It does not cache or expose topology.
- `RoomCluster` owns canonical cluster structure, multi-room topology, adjacency, paint/delete/boundary mutation semantics, cluster moves, and derived local connections.
- `RoomCluster` may keep a private room partition derived from cluster structure plus room metadata for lookup queries, but that partition stores only derived room-cell ownership and reconstructs room `StructureObject`s on demand. It is read-only and must not become persistence or mutation truth.
- Room-surface queries such as cells, floors, boundaries, openings, and centers must resolve through `RoomCluster` or `DungeonLayout`, not directly from `Room`.
- Room paint/delete/boundary/floor edits mutate cluster-owned `StructureObject` level truth plus room metadata. They do not reroute or regenerate corridors or stairs.
- `Connection` owns connectivity, entry resolution, occupied-position projection, and passive physical carrier data. Door-shaped connections expose boundary segments plus traversability state; stair-shaped connections expose one `StructureObject` carrier plus anchor/editor metadata.
- Local cluster connections are room-to-room only. Exterior room openings are plain structure openings and do not get synthetic cluster endpoints.
- Level-aware exit descriptors and door catalogs stay with room/connection truth. Public exit-description queries live on `DungeonLayout`.
- `Corridor` is a first-class structure with stable identity, nodes, segments, room bindings, derived geometry, and direct graph transforms.
- Corridor room-bound endpoints keep absolute `CellCoord` room cells in memory. The graph compiles into the same `StructureObject.LevelStructure` and `StructureObject` surface model used by cluster-derived rooms, including opening segments for room-bound endpoints and persisted free boundary doors.
- Junction nodes are explicit authored state. Routing must not invent extra nodes.
- `DungeonStair` is the first-class persisted stair owner with stable identity and one canonical `StructureObject`. The passive object-side `Stair` inside that structure carries the ordered `TilePath`, authored stop levels, and derived exits.
- `DungeonTransition` owns transition identity, destination, optional bidirectional link, and an optional placed `DungeonConnection`. Unplaced transitions are valid and spatial queries must handle absent local connections.
