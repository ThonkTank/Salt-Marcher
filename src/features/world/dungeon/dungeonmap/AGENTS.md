# Dungeon Map Owner

## Purpose

`dungeonmap` owns the loaded dungeon-map snapshot, authoritative load/reload workflows, map-scoped session state, and the top-level structure-backed map-object owners beneath `dungeon`.

## Owner Atlas

- `DungeonMapObject` — public root seam for loaded-map reads and map-owned workflows.
- `input/` — public map-owned workflow request carriers for `DungeonMapObject`.
- `application/` and `repository/` — map selection, load/reload orchestration, and rehydration.
- `state/` — active map, projection level, overlay settings, and loading flags.
- `connections/`, `structure/`, `cluster/`, `corridor/` — map-owned child owners for traversal semantics and structure-backed map objects.

## Canonical Types and APIs

- `DungeonMapObject` — public loaded-map seam for room, corridor, stair, transition, door, connection, traversability, and read-projection lookups.
- `input/PersistClusterRewriteReboundsInput` — map-owned rebound-tail request family — carries the authoritative pre-write map plus the persisted cluster ids for the canonical room-reload and cross-owner rebound tail.
- `DungeonMapApplicationService` — map-owned cross-owner workflow seam for cluster/corridor/stair/transition preview composition plus cluster rewrite validation and reconciliation.
- `DungeonMapLoadResolver` and `DungeonMapLoadingService` — canonical selection, load, reload, and post-write refresh seams.
- `DungeonMapRepository` — authoritative map rehydration seam over persisted owner slices.
- `DungeonMapState` plus overlay policy state — shared map session state consumed by shell and canvas.

## Where New Code Goes

- Put public cross-owner map access on `DungeonMapObject`.
- Put root-owner workflow request carriers in `input/`.
- Put preview, validation, reconcile, and resolve orchestration on `DungeonMapApplicationService`, not on tools or on the `DungeonMap` implementation itself.
- Put selection, fallback, and reload policy in `application/`; put authoritative rehydration in `repository/`; put active-map and overlay state in `state/`.
- Keep shared traversal semantics under `connections/`, and keep structure-backed map objects under `structure/`, `cluster/`, and `corridor/`.
- Keep successful writes authoritative: map-facing workflows end on reloads instead of mutating shell-local mirrors.

## Forbidden Drift

- Loaded map ownership stays here. Other directories do not own the canonical map snapshot, load state, or reload policy.
- Do not turn `connections/` into a second physical carrier owner for doors or stairs.
- Do not turn `DungeonMapObject` or `DungeonMap` into a second physical topology owner when `structure`, `cluster`, `corridor`, `stair`, and `transition` already own their underlying truth.
- Do not let repositories, tools, or owner-local workflows keep direct preview, resolve, or reconcile helpers on `DungeonMap` when those seams belong on `DungeonMapApplicationService`.
- Do not reintroduce persisted mirrors such as cluster centers, corridor level mirrors, or corridor path-point tables when `Structure` already persists the final topology.
