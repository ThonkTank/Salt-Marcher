# AGENTS.md

This file covers `src/features/world/dungeonmap/`. Use it together with the root `AGENTS.md` and `src/features/world/AGENTS.md`.

## Purpose

`dungeonmap` owns the dungeon editor and the matching runtime surface. The feature must preserve one shared interpretation of dungeon topology so editor, runtime, loading, and persistence all talk about the same rooms, corridors, stairs, transitions, and doors.

## Owner Atlas

- `layout` — map loading, authoritative rebuilds, shared lookups, and cross-owner navigation queries. Current homes: `model/DungeonLayout`, `loading/`, `state/DungeonMapState`, `repository/DungeonLayoutRepository`.
- `structure` — shared physical topology for clusters and corridors, including level-local surface, boundary, and room projection under one aggregate owner. Current homes: `structure/model`, `structure/repository`.
- `room` — room metadata plus cluster-level room behavior over shared structure truth. Current homes: `model/structures/room`, `model/structures/cluster`, `application/room`, `repository/DungeonRoomRepository`.
- `corridor` — corridor routing, path traces, corridor-specific behavior, and realized corridor topology over shared structure truth. Current homes: `model/structures/corridor`, `application/corridor`, `repository/DungeonCorridorRepository`.
- `stair` — authored stair topology, stair path and exit geometry, editor drafts, and stair persistence. Current homes: `model/structures/stair`, `application/stair`, `repository/DungeonStairRepository`.
- `transition` — inter-map exits and their placement workflows. Current homes: `model/structures/transition`, `application/transition`, `repository/DungeonTransitionRepository`.
- `runtime` — party navigation, runtime action resolution, and runtime description projection. Current homes: `application/runtime`, `shell/runtime`, `state/DungeonRuntimeState`.
- `editor interaction` — editor hit resolution, tool dispatch, hover or preview intent, and selection semantics. Current homes: `shell/interaction`, `shell/editor/interaction`, parts of `state/`.
- `render/input` — canvas rendering, camera state, and raw pointer or scroll input. Current homes: `canvas/`, `shell/AbstractDungeonMapView`.
- `map catalog` — create, rename, delete, and list dungeon maps. Current homes: `catalog/`.

These owner slices are the target architecture. The package names above are current homes, not permission to invent parallel package families.

## Canonical Types and APIs

- `DungeonLayout` — loaded map snapshot — resolves canonical room, corridor, stair, transition, door, and traversal lookups.
- `DungeonMapLoadingService` — map selection plus authoritative load or reload — updates `DungeonMapState` and is the required post-write rebuild seam.
- `DungeonRoomApplicationService` — current room or cluster workflow seam — persists room-facing metadata changes and still hosts the existing shared-topology editor write paths until a dedicated structure workflow owner exists.
- `DungeonCorridorApplicationService` — corridor mutations — persists corridor creation, endpoint changes, node moves, and topology edits.
- `DungeonStairApplicationService` — stair editor workflows — creates, updates, moves, deletes, and loads stair editor specs.
- `DungeonTransitionApplicationService` — transition workflows — creates, places, deletes, and resolves transition targets.
- `DungeonRuntimeApplicationService` — runtime navigation — resolves runtime navigation snapshots and party movement.
- `DungeonMapCatalogService` — catalog commands — creates, renames, and deletes maps.
- `Structure` — canonical physical structure aggregate for clusters and corridors — composes one `StructureSurface` plus one `StructureBoundary` per level and owns attached room-topology state.
- `StructureSurface` — level-local surface owner under `Structure` — owns anchor, surface cells, floor cells, and level-local surface reachability or clipping semantics.
- `StructureBoundary` — level-local boundary owner under `Structure` — owns derived boundary edges, authored walls, doors, wall-kind lookups, and boundary rewrite semantics for one structure level.
- `StructureRoomTopology` — cluster-owned room projection over `Structure` — resolves room surfaces, anchors, adjacency, components, and local room-to-room connections.
- `CorridorPathTrace` and `CorridorRouting` — corridor-owned routing projection seam — store traced corridor paths and derive realized corridor surface against shared structure truth.

## Where New Code Goes

- Put new room behavior on the room owner first, new corridor behavior on the corridor owner first, and so on.
- Put shared physical topology and boundary semantics on the `structure` owner instead of mirroring them into room, corridor, runtime, or renderer code.
- When a caller needs anchor, surface-cell, floor-cell, or level-local reachability behavior for one level, route that through `StructureSurface` rather than rebuilding that logic on `Structure`, `RoomCluster`, or renderer helpers.
- When a caller needs door, wall, or boundary-edge behavior for one level, route that through `StructureBoundary` rather than re-expanding `Structure` into a second boundary API bucket.
- Extend `DungeonMapLoadingService` for authoritative reload behavior instead of teaching tools, views, or repositories to repair state locally.
- Put runtime-only semantics under the runtime owner, not on editor tools or render payloads.
- Put editor gesture meaning under editor interaction owners, not in renderers, repositories, or ad-hoc controllers.
- Child `AGENTS.md` files below this directory should document only local additions or exceptions for their subtree. Do not restate this owner atlas in every lower layer.
- If a change needs a new owner slice, update this file in the same change before introducing the package or entry point.

## Forbidden Drift

- Do not treat `application/`, `repository/`, `shell/`, `canvas/`, or `catalog/` as the primary architecture story. They are current homes inside the owner atlas above.
- Do not add a second shared physical topology owner beside `Structure`, `StructureSurface`, `StructureBoundary`, and `StructureRoomTopology`.
- Do not duplicate room, corridor, stair, transition, or runtime semantics in tool-local state, render models, or storage helper types.
- Do not create a new service, helper, support, or wrapper class before checking whether one of the documented owners already exposes the needed seam.
- Do not document a future owner or workflow seam as canonical before it exists in code.
- Do not create alternate load, repair, or compatibility paths outside `DungeonMapLoadingService` and the canonical owner workflows.
