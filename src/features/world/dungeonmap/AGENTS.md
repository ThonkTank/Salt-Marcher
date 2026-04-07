# AGENTS.md

## Purpose

`dungeonmap` owns the dungeon editor and the matching runtime surface. Editor, runtime, loading, and persistence must all resolve the same dungeon topology.

## Owner Atlas

- `layout` — `DungeonLayout`, `DungeonMapLoadingService`, `DungeonLayoutRepository`, `DungeonMapState`
- `structure` — `Structure`, `Structure.roomTopology()`, the local `surface`, `boundary`, and `room` sub-owners plus boundary-local `door` and `wall` object sub-owners, `DungeonStructureRepository`, `DungeonWallKindRepository`
- `room` — `Room`, `RoomCluster`, `DungeonRoomApplicationService`, `DungeonRoomRepository`
- `corridor` — `Corridor`, `CorridorRouting`, `CorridorPathTrace`, `DungeonCorridorApplicationService`, `DungeonCorridorRepository`
- `stair` — `DungeonStair`, `Stair`, `StairExit`, `DungeonStairApplicationService`, `DungeonStairRepository`
- `transition` — `DungeonTransition`, `DungeonTransitionApplicationService`, `DungeonTransitionRepository`
- `runtime` — `DungeonRuntimeApplicationService`, `DungeonRuntimeActionResolver`, runtime description types, `DungeonRuntimeState`
- `editor interaction` — `EditorInteraction`, `EditorTool`, tool implementations, `EditorInteractionState`
- `render/input` — `DungeonCanvasWorkspace`, `DungeonSceneFrame`, render-state payloads, `DungeonGridSceneRenderer`
- `map catalog` — `DungeonMapCatalogService`

## Canonical Types and APIs

- `DungeonLayout` — loaded map snapshot — resolves canonical room, corridor, stair, transition, door, and traversal lookups.
- `DungeonMapLoadingService` — map selection plus authoritative load or reload — updates `DungeonMapState` and is the required post-write rebuild seam.
- `DungeonRoomApplicationService` — room and cluster mutation seam — persists room metadata changes and structure-backed room edits.
- `DungeonCorridorApplicationService` — corridor mutation seam — persists corridor creation, endpoint changes, node moves, and topology edits.
- `DungeonStairApplicationService` — stair editor workflow seam — creates, updates, moves, deletes, and loads stair editor specs.
- `DungeonTransitionApplicationService` — transition workflow seam — creates, places, deletes, and resolves transition targets.
- `DungeonRuntimeApplicationService` — runtime navigation seam — resolves runtime navigation snapshots and party movement.
- `DungeonMapCatalogService` — catalog seam — creates, renames, and deletes maps.

## Where New Code Goes

- Put new behavior on the documented owner first.
- Put shared physical topology on `structure`, not on room, corridor, runtime, or renderer helpers.
- Route level-local surface-area behavior only through `structure.surfaceAtLevel(levelZ).surface().something()`.
- Route level-local floor behavior only through `structure.surfaceAtLevel(levelZ).floor().something()`.
- Route level-local wall, door, and boundary-edge behavior only through `structure.boundaryAtLevel(levelZ).something()`.
- Treat `floor` as the only traversable/runtime/exit truth. `surface` remains explicit owned geometry for projection, editing, and hit/selection areas; it must not be used as a fallback for "walkable anyway".
- Let door- and wall-specific reads and edits terminate on the explicit `BoundaryObject`, `Door`, and `Wall` APIs returned from that boundary owner instead of rebuilding raw `EdgeShape` surgery or derived mirrors in callers.
- Keep shared structure persistence shaped like the runtime `Structure -> level -> surface(surface area + floor) + boundary` composition so save and reload do not rebuild a second flattened structure model.
- Route authoritative reloads through `DungeonMapLoadingService`.
- Keep runtime-only semantics under `runtime` and gesture meaning under `editor interaction`.

## Forbidden Drift

- Do not add a second shared physical topology owner beside `Structure`, `StructureSurface`, `StructureSurfaceArea`, `StructureFloor`, `StructureBoundary`, and `Structure.roomTopology()`.
- Do not mirror room, corridor, stair, transition, or runtime semantics into tool-local state, render models, or storage helper types.
- Do not add convenience wrapper APIs that mirror `StructureSurfaceArea`, `StructureFloor`, or `StructureBoundary` state on `Structure`, `RoomCluster`, `DungeonLayout`, renderer helpers, or other unrelated owners.
- Do not call inherited generic `EdgeShape` methods on `Door` or `Wall` outside the boundary owner subtree; if a read is truly missing, add it to the explicit object API instead.
- Do not create alternate load, repair, or compatibility paths outside `DungeonMapLoadingService` and the canonical owner workflows.
