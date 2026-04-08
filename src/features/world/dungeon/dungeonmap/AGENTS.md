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
- `api/ResolveCorridorRequest`, `api/RehydrateCorridorRequest` — public map-owned corridor build requests — carry only loaded-map truth plus authored corridor input or persisted structure.
- `api/PreviewAddedCorridorRequest`, `api/PreviewReplacedCorridorRequest`, `api/PreviewRemovedCorridorRequest` — public map-owned corridor preview requests — compose temporary map snapshots without exposing raw corridor-list rewrites.
- `api/PreviewAddedStairRequest`, `api/PreviewReplacedStairRequest`, `api/PreviewRemovedStairRequest` — public map-owned stair preview requests — compose temporary map snapshots for stair draft upsert or removal flows without exposing raw stair-list rewrites.
- `api/PreviewAddedTransitionRequest`, `api/PreviewReplacedTransitionRequest`, `api/PreviewRemovedTransitionRequest` — public map-owned transition preview requests — compose temporary map snapshots for door- and stair-based transition drafts without exposing raw transition-list rewrites.
- `model/ClusterMapMutationRequest`, `model/DungeonMap.withMutatedCluster(...)` — map-owned cluster preview/apply seam — composes one cluster-targeted mutation into a temporary map snapshot without exposing cluster rewrite plumbing to shell callers.
- `model/DungeonMap` — loaded map snapshot — resolves canonical room, corridor, stair, transition, door, connection, traversability, and read-projection lookups.
- `repository/DungeonMapRepository` — map id plus connection — rehydrates one authoritative `DungeonMap` from persisted owner slices; clusters load from structure plus room metadata, corridors load from structure plus corridor input metadata.
- `application/DungeonMapLoadResolver` — synchronous selection and repair policy — resolves which map should load or reload next.
- `application/DungeonMapLoadingService` — async load and post-write reload seam — updates `DungeonMapState` from authoritative reloads.
- `state/DungeonMapState` — shared map session state for active map, projection level, overlay settings, and loading flags.
- `state/DungeonLevelOverlayMode`, `state/DungeonLevelOverlaySettings` — map-owned overlay policy state consumed by shell and canvas surfaces.
- `application/DungeonMapApplicationService` — map-owned corridor resolution plus corridor/stair/transition preview seam — builds `Corridor` only from authored input plus map-owned external facts and composes preview map snapshots for corridor, stair, or transition upsert/removal flows.
- `model/DungeonMap.validateClusterRewrite(...)` — cross-owner pre-persist rewrite validation seam — checks corridor and transition consistency against the post-rewrite cluster snapshot.
- `model/DungeonMap.reconcileClusterRewrite(...)` — cross-owner post-persist reconcile seam — returns rebound corridors and transition local connections after persisted cluster rewrites.
- `model/DungeonMap.assertClusterFloorDeletionAllowed(...)` — cluster-external occupancy guard — rejects floor deletions that would orphan corridor, transition, or stair anchors while letting each owner answer its own anchor semantics.

## Where New Code Goes

- Put loaded-map lookup behavior on `DungeonMap`.
- Put exported read-only map projections in `api/` instead of nesting public carrier types inside `DungeonMap`.
- Put public map-owned corridor resolve, rehydrate, and preview requests in `api/` and run them through `DungeonMapApplicationService`.
- Put public map-owned stair preview requests in `api/` and run them through `DungeonMapApplicationService`.
- Put public map-owned transition preview requests in `api/` and run them through `DungeonMapApplicationService`.
- Put cross-owner orchestration on `DungeonMap` when a workflow must compare room, cluster, corridor, stair, or transition truth without moving those invariants into the map owner.
- Put map selection, fallback, and reload policy on `DungeonMapLoadResolver` or `DungeonMapLoadingService`, not in views or repositories.
- Put map rehydration and staged owner loading in `repository/`.
- Put active-map and overlay session state in `state/`.
- Put structure-backed map objects under `structure/`, `cluster/`, or `corridor/` inside this owner instead of restoring parallel top-level package trees.
- Put shell cluster previews on `DungeonMap.withMutatedCluster(...)` instead of rebuilding cluster rewrites in tools.
- Put cluster rewrite validation and cross-owner rebound logic on `DungeonMap`, not in cluster or transition services.
- Keep map workflows authoritative: successful writes must still end on `DungeonMapLoadingService` reloads instead of mutating shell-local mirrors.

## Forbidden Drift

- Do not move loaded map ownership back into generic `model/`, `loading/`, `state/`, or `repository/` roots.
- Do not duplicate map selection or reload policy in shell, runtime, or owner-local workflow services.
- Do not reintroduce top-level `structure`, `cluster`, or `corridor` owners beside `dungeonmap`.
- Do not turn `DungeonMap` into a second physical topology owner when `structure`, `cluster`, `corridor`, `stair`, and `transition` already own their underlying truth.
- Do not reintroduce public nested read-projection records or enums on `DungeonMap`; exported callers consume `dungeonmap/api` instead.
- Do not let corridor callers bypass the fixed corridor input contract by passing raw map state, room lookups, primitive corridor bundles, or ad-hoc door resolution directly into `Corridor`.
- Do not let repositories, tools, or corridor workflows call public corridor resolve, rehydrate, or preview-list helpers on `DungeonMap`; those map-owned seams belong on `DungeonMapApplicationService`.
- Do not let tools keep direct public stair preview upsert or removal helpers on `DungeonMap`; stair preview composition belongs on `DungeonMapApplicationService`.
- Do not let tools keep direct public transition preview upsert or removal helpers on `DungeonMap`; transition preview composition belongs on `DungeonMapApplicationService`.
- Do not let cluster rewrite workflows keep separate corridor-only and transition-only validation paths outside `DungeonMap`.
- Do not reintroduce persisted cluster centers, corridor level mirrors, or corridor path-point tables when `Structure` already persists the final topology.
