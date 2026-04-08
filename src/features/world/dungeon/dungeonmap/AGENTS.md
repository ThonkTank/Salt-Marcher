# AGENTS.md

## Purpose

`dungeonmap` owns the loaded dungeon-map snapshot, authoritative map load and reload workflows, map-scoped session state, and the top-level map-object owner slices beneath `dungeon`.

## Owner Atlas

- `api/` — exported map-owned read projections for stable callers outside `model/`.
- `model/DungeonMap` — loaded map snapshot and global lookup plus cross-owner orchestration surface over map-owned objects.
- `application/` and `repository/` — authoritative map selection, load, reload, and rehydration seams.
- `state/` — active-map, projection, overlay, and loading session state.
- `structure/` — shared physical topology owner; `Structure` is the abstract base type for structure-backed map objects.
- `cluster/` — room-cluster owner built on `Structure`.
- `corridor/` — corridor owner built on `Structure`.

## Canonical Types and APIs

- `api/CellStructure` — map cell occupant projection — distinguishes room, corridor, stair, and transition ownership for runtime and editor callers.
- `api/RoomBoundaryDescription`, `api/CorridorBoundaryDescription`, `api/ConnectionSurfaceDescription` — public map read projections for room walls, corridor attach surfaces, and connection-local entry surfaces.
- `api/DoorDescription`, `api/DoorRole` — public map read projection for placed doors and their stable role semantics.
- `model/DungeonMap` — loaded map snapshot — resolves canonical room, corridor, stair, transition, door, connection, traversability, and read-projection lookups.
- `repository/DungeonMapRepository` — map id plus connection — rehydrates one authoritative `DungeonMap` from persisted owner slices; clusters load from structure plus room metadata, corridors load from structure plus corridor input metadata.
- `application/DungeonMapLoadResolver` — synchronous selection and repair policy — resolves which map should load or reload next.
- `application/DungeonMapLoadingService` — async load and post-write reload seam — updates `DungeonMapState` from authoritative reloads.
- `state/DungeonMapState` — shared map session state for active map, projection level, overlay settings, and loading flags.
- `state/DungeonLevelOverlayMode`, `state/DungeonLevelOverlaySettings` — map-owned overlay policy state consumed by shell and canvas surfaces.
- `model/DungeonMap.corridorResolutionInput(int levelZ)` — corridor-external fact builder — materializes the fixed corridor input contract from current map state for one level.
- `model/DungeonMap.resolveCorridor(CorridorInput)`, `model/DungeonMap.rehydrateCorridor(CorridorInput, Structure)` — corridor build and reload seams — construct `Corridor` only from authored corridor input plus map-owned external input facts.
- `model/DungeonMap.validateClusterRewrite(...)` — cross-owner pre-persist rewrite validation seam — checks corridor and transition consistency against the post-rewrite cluster snapshot.
- `model/DungeonMap.reconcileClusterRewrite(...)` — cross-owner post-persist reconcile seam — returns rebound corridors and transition local connections after persisted cluster rewrites.
- `model/DungeonMap.assertClusterFloorDeletionAllowed(...)` — cluster-external occupancy guard — rejects floor deletions that would orphan corridor, transition, or stair anchors while letting each owner answer its own anchor semantics.

## Where New Code Goes

- Put loaded-map lookup behavior on `DungeonMap`.
- Put exported read-only map projections in `api/` instead of nesting public carrier types inside `DungeonMap`.
- Put cross-owner orchestration on `DungeonMap` when a workflow must compare room, cluster, corridor, stair, or transition truth without moving those invariants into the map owner.
- Put map selection, fallback, and reload policy on `DungeonMapLoadResolver` or `DungeonMapLoadingService`, not in views or repositories.
- Put map rehydration and staged owner loading in `repository/`.
- Put active-map and overlay session state in `state/`.
- Put structure-backed map objects under `structure/`, `cluster/`, or `corridor/` inside this owner instead of restoring parallel top-level package trees.
- Put cluster rewrite validation and cross-owner rebound logic on `DungeonMap`, not in cluster or transition services.
- Keep map workflows authoritative: successful writes must still end on `DungeonMapLoadingService` reloads instead of mutating shell-local mirrors.

## Forbidden Drift

- Do not move loaded map ownership back into generic `model/`, `loading/`, `state/`, or `repository/` roots.
- Do not duplicate map selection or reload policy in shell, runtime, or owner-local workflow services.
- Do not reintroduce top-level `structure`, `cluster`, or `corridor` owners beside `dungeonmap`.
- Do not turn `DungeonMap` into a second physical topology owner when `structure`, `cluster`, `corridor`, `stair`, and `transition` already own their underlying truth.
- Do not reintroduce public nested read-projection records or enums on `DungeonMap`; exported callers consume `dungeonmap/api` instead.
- Do not let corridor callers bypass the fixed corridor input contract by passing raw map state, room lookups, primitive corridor bundles, or ad-hoc door resolution directly into `Corridor`.
- Do not let cluster rewrite workflows keep separate corridor-only and transition-only validation paths outside `DungeonMap`.
- Do not reintroduce persisted cluster centers, corridor level mirrors, or corridor path-point tables when `Structure` already persists the final topology.
