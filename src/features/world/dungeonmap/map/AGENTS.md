# AGENTS.md

## Purpose

`map` owns the loaded dungeon-map snapshot, authoritative map load and reload workflows, and map-scoped session state beneath `dungeonmap`.

## Canonical Types and APIs

- `model/DungeonLayout` — loaded map snapshot — resolves canonical room, corridor, stair, transition, door, connection, and traversability lookups.
- `repository/DungeonLayoutRepository` — map id plus connection — rehydrates one authoritative `DungeonLayout` from persisted owner slices.
- `application/DungeonMapLoadResolver` — synchronous selection and repair policy — resolves which map should load or reload next.
- `application/DungeonMapLoadingService` — async load and post-write reload seam — updates `DungeonMapState` from authoritative reloads.
- `state/DungeonMapState` — shared map session state for active map, projection level, overlay settings, and loading flags.
- `state/DungeonLevelOverlayMode`, `state/DungeonLevelOverlaySettings` — map-owned overlay policy state consumed by shell and canvas surfaces.

## Where New Code Goes

- Put loaded-map lookup behavior on `DungeonLayout`.
- Put map selection, fallback, and reload policy on `DungeonMapLoadResolver` or `DungeonMapLoadingService`, not in views or repositories.
- Put map rehydration and staged owner loading in `repository/`.
- Put active-map and overlay session state in `state/`.
- Keep map workflows authoritative: successful writes must still end on `DungeonMapLoadingService` reloads instead of mutating shell-local mirrors.

## Forbidden Drift

- Do not move loaded map ownership back into generic `model/`, `loading/`, `state/`, or `repository/` roots.
- Do not duplicate map selection or reload policy in shell, runtime, or owner-local workflow services.
- Do not turn `DungeonLayout` into a second physical topology owner when `structure`, `cluster`, `corridor`, `stair`, and `transition` already own their underlying truth.
