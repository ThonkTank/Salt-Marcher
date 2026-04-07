# AGENTS.md

## Purpose

`dungeon` owns the dungeon editor and the matching runtime surface. Editor, runtime, map loading, and persistence must all resolve the same dungeon topology.

## Owner Atlas

- `geometry` — `GridObject`, `GridPoint`, `GridSegment`, `GridArea`, `GridBoundary`, `GridPath`, `CardinalDirection`
- `dungoenmap` — `DungeonMap`, `DungeonMapLoadResolver`, `DungeonMapLoadingService`, `DungeonMapRepository`, `DungeonMapState`, and the nested map-object owners `dungoenmap/structure`, `dungoenmap/cluster`, and `dungoenmap/corridor`
- `dungoenmap/structure` — `Structure`, derived `Structure.roomTopology()`, the local `surface`, `boundary`, and `room` sub-owners plus boundary-local `door` and `wall` object sub-owners, `DungeonStructureRepository`, `DungeonWallKindRepository`
- `room` — `Room`, `DungeonRoomApplicationService`, `DungeonRoomRepository`
- `dungoenmap/cluster` — `Cluster`, `DungeonClusterApplicationService`, `DungeonClusterRepository`
- `dungoenmap/corridor` — `Corridor`, `CorridorRouting`, `CorridorPathTrace`, `DungeonCorridorApplicationService`, `DungeonCorridorRepository`
- `stair` — `DungeonStair`, `Stair`, `StairExit`, `StairPathPatternSpec`, `StairPathGenerator`, `DungeonStairApplicationService`, `DungeonStairRepository`
- `transition` — `DungeonTransition`, `DungeonTransitionApplicationService`, `DungeonTransitionRepository`
- `runtime` — `DungeonRuntimeApplicationService`, `DungeonRuntimeActionResolver`, runtime description types, `DungeonRuntimeState`
- `editor interaction` — `EditorInteraction`, `EditorTool`, tool implementations, `EditorInteractionState`
- `render/input` — `DungeonCanvasWorkspace`, `DungeonSceneFrame`, render-state payloads, `DungeonGridSceneRenderer`
- `map catalog` — `DungeonMapCatalogService`

## Canonical Types and APIs

- `GridObject` and the `geometry` slice — canonical dungeon grid algebra — every topology owner must express shared spatial truth through `GridPoint`, `GridSegment`, `GridArea`, `GridBoundary`, or `GridPath`, movement through `GridTranslation`, and occupancy through `cellFootprint(): GridArea`.
- `map` slice — authoritative loaded map snapshot plus load/reload and map-state seams — other owners rebuild through this slice after writes.
- `DungeonClusterApplicationService` — cluster mutation seam — persists top-level cluster edits, cluster-backed room rewrites, and cluster bootstrap flows.
- `DungeonRoomApplicationService` — room metadata seam — persists room-local narration and other room-owned metadata writes.
- `DungeonCorridorApplicationService` — corridor mutation seam — persists corridor creation, endpoint changes, node moves, and topology edits.
- `DungeonStairApplicationService` — stair editor workflow seam — creates, updates, moves, deletes, and loads stair editor specs.
- `DungeonTransitionApplicationService` — transition workflow seam — creates, places, deletes, and resolves transition targets.
- `DungeonRuntimeApplicationService` — runtime navigation seam — resolves runtime navigation snapshots and party movement.
- `DungeonMapCatalogService` — catalog seam — creates, renames, and deletes maps.

## Where New Code Goes

- Put new behavior on the documented owner first.
- Put shared physical topology on `dungoenmap/structure`, not on room, corridor, runtime, or renderer helpers.
- Route level-local surface-area behavior only through `structure.surfaceAtLevel(levelZ).surface().something()`.
- Route level-local floor behavior only through `structure.surfaceAtLevel(levelZ).floor().something()`.
- Route level-local wall, door, and boundary-edge behavior only through `structure.boundaryAtLevel(levelZ).something()`.
- Route public structure-backed topology creation through `Structure.fromSpecification(...)`.
- Route public structure-backed topology mutation through `structure.mutated(...)`.
- Keep public movement on `translated(GridTranslation)` and keep drag/drop deltas, stair moves, and corridor reconciliation on `GridTranslation` instead of `GridPoint` stand-ins.
- Keep public occupied-cell reads on `cellFootprint()`; if a caller truly needs raw cells, it should unwrap `.cells()` at the leaf instead of adding a second owner-level occupancy API.
- Treat `floor` as the only traversable/runtime/exit truth. `surface` remains explicit owned geometry for projection, editing, and hit/selection areas; it must not be used as a fallback for "walkable anyway".
- Let door- and wall-specific reads and edits terminate on the explicit `BoundaryObject`, `Door`, and `Wall` APIs returned from that boundary owner instead of rebuilding raw `GridBoundary` surgery or derived mirrors in callers.
- Keep shared structure persistence shaped like the runtime `Structure -> level -> surface(surface area + floor) + boundary` composition so save and reload do not rebuild a second flattened structure model.
- Route authoritative reloads through `map/application/DungeonMapLoadingService`.
- Keep runtime-only semantics under `runtime` and gesture meaning under `editor interaction`.
- Keep loaded-map ownership, selection policy, and map-scoped overlay state under `dungoenmap`, and keep structure-backed map objects under `dungoenmap/structure`, `dungoenmap/cluster`, and `dungoenmap/corridor` instead of reviving top-level owners.

## Forbidden Drift

- Do not add a second shared physical topology owner beside `Structure`, `StructureSurface`, `StructureSurfaceArea`, `StructureFloor`, `StructureBoundary`, and `Structure.roomTopology()`.
- Do not add a second shared dungeon geometry vocabulary beside the `geometry` slice and its `GridObject` family.
- Do not let stair, room, cluster, boundary, runtime, or shell code reintroduce `occupiedPositions()`/`movedBy(...)`-style public aliases once `cellFootprint()` and `translated(GridTranslation)` exist.
- Do not mirror room, corridor, stair, transition, or runtime semantics into tool-local state, render models, or storage helper types.
- Do not add convenience wrapper APIs that mirror `StructureSurfaceArea`, `StructureFloor`, or `StructureBoundary` state on `Structure`, `Cluster`, `DungeonMap`, renderer helpers, or other unrelated owners.
- Do not add second public structure creation or mutation workflows beside `Structure.fromSpecification(...)` and `structure.mutated(...)`.
- Do not call inherited generic `GridBoundary` methods on `Door` or `Wall` outside the boundary owner subtree; if a read is truly missing, add it to the explicit object API instead.
- Do not create alternate load, repair, or compatibility paths outside `DungeonMapLoadingService` and the canonical owner workflows.
- Do not move map snapshot, load/reload, or map session state ownership back into legacy `model/`, `loading/`, `state/`, or `repository/` roots.
