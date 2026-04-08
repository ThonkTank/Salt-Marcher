# AGENTS.md

## Purpose

`dungeonmap` owns the loaded dungeon-map snapshot, authoritative map load and reload workflows, map-scoped session state, and the top-level map-object owner slices beneath `dungeon`.

## Owner Atlas

- `DungeonMapObject` — public root owner seam for loaded dungeon-map snapshots and cross-owner map workflows.
- `api/` — exported map-owned read projections and request carriers used by the root map seam.
- `model/DungeonMap` — current loaded-map implementation behind the public root seam.
- `application/` and `repository/` — authoritative map selection, load, reload, and rehydration seams.
- `state/` — active-map, projection, overlay, and loading session state.
- `connections/` — shared connection semantics owner for traversable links and their endpoint vocabulary.
- `structure/` — shared physical topology owner; `Structure` is the abstract base type for structure-backed map objects.
- `cluster/` — room-cluster owner built on `Structure`.
- `corridor/` — corridor owner built on `Structure`.

## Canonical Types and APIs

- `api/CellStructure` — map cell occupant projection — distinguishes room, corridor, stair, and transition ownership for runtime and editor callers.
- `api/RoomBoundaryDescription`, `api/CorridorBoundaryDescription`, `api/ConnectionSurfaceDescription` — public map read projections for room walls, corridor attach surfaces, and connection-local entry surfaces.
- `api/DoorDescription`, `api/DoorRole` — public map read projection for placed doors and their stable role semantics.
- `connections/ConnectionsObject`, `connections/Connection`, `connections/ConnectionEndpoint` — shared connection owner seam and canonical traversal vocabulary for room-local, corridor, and transition links.
- `api/ResolveCorridorRequest`, `api/RehydrateCorridorRequest` — public map-owned corridor build requests — carry only loaded-map truth plus authored corridor input or persisted structure.
- `api/ValidateClusterRewriteRequest`, `api/ReconcileClusterRewriteRequest`, `api/AssertClusterFloorDeletionAllowedRequest` — public map-owned cluster rewrite requests — validate cross-owner effects, reconcile rebound corridors and transition anchors, and guard floor deletions against corridor, stair, and transition occupancy.
- `api/PreviewMovedClusterRequest`, `api/PreviewMovedLocalDoorRequest` — public map-owned cluster preview requests — compose temporary map snapshots for cluster translation and local-door drags without exposing raw cluster rewrites.
- `api/PreviewAddedCorridorRequest`, `api/PreviewReplacedCorridorRequest`, `api/PreviewRemovedCorridorRequest` — public map-owned corridor preview requests — compose temporary map snapshots without exposing raw corridor-list rewrites.
- `api/PreviewAddedStairRequest`, `api/PreviewReplacedStairRequest`, `api/PreviewRemovedStairRequest` — public map-owned stair preview requests — compose temporary map snapshots for stair draft upsert or removal flows without exposing raw stair-list rewrites.
- `api/PreviewAddedTransitionRequest`, `api/PreviewReplacedTransitionRequest`, `api/PreviewRemovedTransitionRequest` — public map-owned transition preview requests — compose temporary map snapshots for door- and stair-based transition drafts without exposing raw transition-list rewrites.
- `DungeonMapObject` — public loaded-map seam — resolves canonical room, corridor, stair, transition, door, connection, traversability, and read-projection lookups.
- `model/DungeonMap` — current loaded-map implementation behind `DungeonMapObject`.
- `repository/DungeonMapRepository` — map id plus connection — rehydrates one authoritative `DungeonMap` from persisted owner slices; clusters load from structure plus room metadata, corridors load from structure plus corridor input metadata.
- `repository/DungeonMapRepository.persistClusterRoomRewriteAndReload(...)` — map-owned cluster commit tail — persists room metadata through `DungeonRoomRepository` after cluster-row persistence and then rebuilds the authoritative map snapshot from persisted owners.
- `application/DungeonMapLoadResolver` — synchronous selection and repair policy — resolves which map should load or reload next.
- `application/DungeonMapLoadingService` — async load and post-write reload seam — updates `DungeonMapState` from authoritative reloads.
- `state/DungeonMapState` — shared map session state for active map, projection level, overlay settings, and loading flags.
- `state/DungeonLevelOverlayMode`, `state/DungeonLevelOverlaySettings` — map-owned overlay policy state consumed by shell and canvas surfaces.
- `application/DungeonMapApplicationService` — map-owned cluster plus corridor resolution seam — validates cluster rewrites, reconciles rebound cross-owner effects, guards floor deletions, and composes preview map snapshots for cluster, corridor, stair, or transition flows.

## Where New Code Goes

- Put public cross-owner map access on `DungeonMapObject` and keep the concrete implementation on `DungeonMap`.
- Put exported read-only map projections in `api/` instead of nesting public carrier types inside `DungeonMap`.
- Put public map-owned corridor resolve, rehydrate, and preview requests in `api/` and run them through `DungeonMapApplicationService`.
- Put public map-owned cluster rewrite validation, reconcile, guard, and preview requests in `api/` and run them through `DungeonMapApplicationService`.
- Put public map-owned stair preview requests in `api/` and run them through `DungeonMapApplicationService`.
- Put public map-owned transition preview requests in `api/` and run them through `DungeonMapApplicationService`.
- Put stable read and lookup behavior on the public `DungeonMapObject` seam; keep map-owned cross-owner cluster/corridor preview or validation workflows on `DungeonMapApplicationService`.
- Put map selection, fallback, and reload policy on `DungeonMapLoadResolver` or `DungeonMapLoadingService`, not in views or repositories.
- Put map rehydration and staged owner loading in `repository/`.
- Put active-map and overlay session state in `state/`.
- Put shared traversal semantics under `connections/`, but keep physical door and stair ownership on the owner that edits or persists those carriers.
- Put structure-backed map objects under `structure/`, `cluster/`, or `corridor/` inside this owner instead of restoring parallel top-level package trees.
- Put shell cluster translation and local-door previews on `DungeonMapApplicationService` instead of rebuilding cluster rewrites in tools.
- Put cluster rewrite validation, floor-deletion guards, and cross-owner rebound logic on `DungeonMapApplicationService`, not in cluster or transition services.
- Keep map workflows authoritative: successful writes must still end on `DungeonMapLoadingService` reloads instead of mutating shell-local mirrors.

## Forbidden Drift

- Do not move loaded map ownership back into generic `model/`, `loading/`, `state/`, or `repository/` roots.
- Do not duplicate map selection or reload policy in shell, runtime, or owner-local workflow services.
- Do not reintroduce top-level `structure`, `cluster`, or `corridor` owners beside `dungeonmap`.
- Do not turn `connections/` into a second physical carrier owner for doors or stairs.
- Do not turn `DungeonMapObject` or its `DungeonMap` implementation into a second physical topology owner when `structure`, `cluster`, `corridor`, `stair`, and `transition` already own their underlying truth.
- Do not reintroduce public nested read-projection records or enums on `DungeonMap`; exported callers consume `dungeonmap/api` instead.
- Do not let corridor callers bypass the fixed corridor input contract by passing raw map state, room lookups, primitive corridor bundles, or ad-hoc door resolution directly into `Corridor`.
- Do not let repositories, tools, or corridor workflows call public corridor resolve, rehydrate, or preview-list helpers on `DungeonMap`; those map-owned seams belong on `DungeonMapApplicationService`.
- Do not let tools or cluster workflows keep direct public cluster rewrite, floor-guard, or preview helpers on `DungeonMap`; those map-owned seams belong on `DungeonMapApplicationService`.
- Do not let tools keep direct public stair preview upsert or removal helpers on `DungeonMap`; stair preview composition belongs on `DungeonMapApplicationService`.
- Do not let tools keep direct public transition preview upsert or removal helpers on `DungeonMap`; transition preview composition belongs on `DungeonMapApplicationService`.
- Do not let cluster rewrite workflows keep separate corridor-only and transition-only validation paths outside `DungeonMapApplicationService`.
- Do not reintroduce persisted cluster centers, corridor level mirrors, or corridor path-point tables when `Structure` already persists the final topology.
