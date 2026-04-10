# Dungeon Map Owner

## Purpose

`dungeonmap` owns the loaded dungeon-map snapshot, authoritative load/reload workflows, map-scoped session state, and the top-level structure-backed map-object owners beneath `dungeon`.

## Owner Atlas

- `DungeonMapObject` — public root seam for loaded-map reads and map-owned workflows.
- `input/` — public map-owned workflow request carriers for `DungeonMapObject`.
- `repository/` and `state/` — canonical map-owner storage and runtime truth for loaded-map state.
- Legacy `application/`, `api/`, and `model/` packages remain in the tree as internal collaborators and value homes. Reuse them only when touching existing flows; they do not define placement precedent for new owner-layer work.
- `connections/`, `structure/`, `cluster/`, `corridor/` — map-owned child owners for traversal semantics and structure-backed map objects.

## Canonical Types and APIs

- `DungeonMapObject` — public loaded-map seam for room, corridor, stair, transition, door, connection, traversability, initial load, explicit map selection, and reload-after-write.
- `input/EnsureLoadedInput`, `input/SelectMapInput`, and `input/SubmitMutationInput` — canonical map-owned load/reload request family consumed by shell and editor surfaces.
- `input/SetActiveProjectionLevelInput`, `input/SetReachableProjectionLevelInput`, and the `SetLevelOverlay*Input` requests — canonical map-owned session-state transitions for projection and overlay controls.
- `state/PersistClusterRewriteRoomsState` — canonical passive map-owned room-rewrite persistence state — carries only final room rows, anchors, and exit narration rows for one persisted cluster rewrite commit.
- `repository/PersistClusterRewriteRoomsRepository` — canonical map-owned room-rewrite persistence boundary — owns the JDBC transaction for rewriting room tables from `PersistClusterRewriteRoomsState`.
- `input/PersistClusterRewriteReboundsInput` — map-owned rebound-tail request family — carries the authoritative pre-write map plus the persisted cluster ids for the canonical room-reload and cross-owner rebound tail.
- `DungeonMapApplicationService` — legacy internal workflow collaborator currently used by `DungeonMapObject` for cluster-rewrite reconciliation. Keep it behind the owner seam; do not treat `application/` as the destination for new touched architecture work.
- `DungeonMapLoadResolver` and `DungeonMapLoadingService` — legacy internal load/reload collaborators now consumed through `DungeonMapObject`. Keep them behind the owner seam; do not wire shell or editor surfaces to `application/` directly.
- `DungeonMapRepository` — authoritative map rehydration seam over persisted owner slices.
- `DungeonMapState` plus overlay policy state — shared map session state consumed by shell and canvas.

## Where New Code Goes

- Put public cross-owner map access on `DungeonMapObject`.
- Put root-owner workflow request carriers in `input/`.
- Put authoritative rehydration in `repository/` and active-map plus overlay truth in `state/`.
- Route shell/editor initial-load, select-map, and reload-after-write flows through `DungeonMapObject` instead of importing `DungeonMapLoadingService` from `application/`.
- Route shell/editor/runtime projection-level and overlay mutations through `DungeonMapObject` instead of mutating `DungeonMapState` directly from views or controls.
- Put new cluster-rewrite room persistence on `PersistClusterRewriteRoomsState` plus `PersistClusterRewriteRoomsRepository` instead of extending the legacy combined rebound flow.
- If a map-owned request needs request-shaped input translation, add a matching `task/` seam rather than extending legacy `application/` packages.
- When touching existing preview, validation, reconcile, or resolve flows that still depend on `DungeonMapApplicationService`, keep that dependency behind `DungeonMapObject` and migrate toward canonical owner layers at the nearest safe seam.
- Keep shared traversal semantics under `connections/`, and keep structure-backed map objects under `structure/`, `cluster/`, and `corridor/`.
- Keep successful writes authoritative: map-facing workflows end on reloads instead of mutating shell-local mirrors.

## Forbidden Drift

- Loaded map ownership stays here. Other directories do not own the canonical map snapshot, load state, or reload policy.
- Do not wire shell or editor surfaces directly to `DungeonMapLoadingService`; keep `application/` as internal support behind `DungeonMapObject`.
- Do not let shell controls or canvas level-scroll fall back to direct `DungeonMapState` mutations when a map-owned transition exists on `DungeonMapObject`.
- Do not turn `connections/` into a second physical carrier owner for doors or stairs.
- Do not turn `DungeonMapObject` or `DungeonMap` into a second physical topology owner when `structure`, `cluster`, `corridor`, `stair`, and `transition` already own their underlying truth.
- Do not add new room-rewrite persistence work to `PersistClusterRewriteReboundsInput` or `DungeonMapApplicationService`; move that work into the clean `state`/`repository` room-rewrite slice.
- Do not let repositories, tools, or owner-local workflows keep direct preview, resolve, or reconcile helpers on `DungeonMap` when those seams belong on `DungeonMapApplicationService`.
- Do not reintroduce persisted mirrors such as cluster centers, corridor level mirrors, or corridor path-point tables when `Structure` already persists the final topology.
