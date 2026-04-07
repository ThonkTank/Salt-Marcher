# AGENTS.md

## Purpose

`dungeonmap` owns the loaded dungeon-map snapshot, authoritative map load and reload workflows, map-scoped session state, and the top-level map-object owner slices beneath `dungeon`.

## Owner Atlas

- `model/DungeonMap` — loaded map snapshot and global lookup plus cross-owner orchestration surface over map-owned objects.
- `application/` and `repository/` — authoritative map selection, load, reload, and rehydration seams.
- `state/` — active-map, projection, overlay, and loading session state.
- `structure/` — shared physical topology owner; `Structure` is the abstract base type for structure-backed map objects.
- `cluster/` — room-cluster owner built on `Structure`.
- `corridor/` — corridor owner built on `Structure`.

## Canonical Types and APIs

- `model/DungeonMap` — loaded map snapshot — resolves canonical room, corridor, stair, transition, door, connection, and traversability lookups.
- `model/CorridorResolutionContextRequest` — typed map-owned corridor-context request — the only public input for `DungeonMap.corridorResolutionInput(...)`.
- `model/CorridorResolutionRequest`, `model/CorridorRehydrationRequest` — typed map-owned corridor materialization requests — carry authored corridor state into `DungeonMap.resolveCorridor(...)` and `DungeonMap.rehydrateCorridor(...)`.
- `repository/DungeonMapRepository` — map id plus connection — rehydrates one authoritative `DungeonMap` from persisted owner slices.
- `application/DungeonMapLoadResolver` — synchronous selection and repair policy — resolves which map should load or reload next.
- `application/DungeonMapLoadingService` — async load and post-write reload seam — updates `DungeonMapState` from authoritative reloads.
- `state/DungeonMapState` — shared map session state for active map, projection level, overlay settings, and loading flags.
- `state/DungeonLevelOverlayMode`, `state/DungeonLevelOverlaySettings` — map-owned overlay policy state consumed by shell and canvas surfaces.
- `model/DungeonMap.corridorResolutionInput(...)` — corridor-external fact builder — materializes the fixed corridor input contract from current map state from exactly one typed context request.
- `model/DungeonMap.resolveCorridor(...)`, `model/DungeonMap.rehydrateCorridor(...)` — typed corridor build and reload seam — constructs `Corridor` only from fixed corridor requests plus map-owned external input facts.
- `model/DungeonMap.validateClusterRewrite(...)` — cross-owner pre-persist rewrite validation seam — checks corridor and transition consistency against the post-rewrite cluster snapshot.
- `model/DungeonMap.reconcileClusterRewrite(...)` — cross-owner post-persist reconcile seam — returns rebound corridors and transition local connections after persisted cluster rewrites.
- `model/DungeonMap.assertClusterFloorDeletionAllowed(...)` — cluster-external occupancy guard — rejects floor deletions that would orphan corridor, transition, or stair anchors while letting each owner answer its own anchor semantics.

## Where New Code Goes

- Put loaded-map lookup behavior on `DungeonMap`.
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
- Do not let corridor callers bypass the fixed corridor input contract by passing raw map state, room lookups, primitive corridor bundles, or ad-hoc door resolution directly into `Corridor`.
- Do not add a second public `corridorResolutionInput(...)` entry shape beside `CorridorResolutionContextRequest`.
- Do not let cluster rewrite workflows keep separate corridor-only and transition-only validation paths outside `DungeonMap`.
