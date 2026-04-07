# AGENTS.md

This file covers `src/features/world/dungeonmap/repository/`. Use it together with the parent `dungeonmap/AGENTS.md` and the repository root `AGENTS.md`.

## Purpose

`repository/` owns direct dungeon persistence. Repositories read and write the current schema; they do not own fallback policy, workflow repair, or alternate model truth.

## Current Durable Structure

- `DungeonLayoutRepository` is the authoritative rehydration seam for one concrete persisted map.
- `DungeonStructureRepository` owns the persisted `StructureObject` tables shared by clusters and corridors.
- `DungeonRoomRepository`, `DungeonCorridorRepository`, `DungeonStairRepository`, and `DungeonTransitionRepository` own direct structure persistence.
- `DungeonWallKindRepository` owns the app-global wall-kind catalog used to resolve wall behavior on load.
- `DungeonStorageSupport` owns current dungeon DDL only.

## Rules

- Repository methods stay storage-focused and stateless; application services own workflow sequencing and retries.
- Room clusters and corridors persist only owner metadata plus `structure_object_id`; physical surface, wall, floor, and door rows belong to `DungeonStructureRepository`.
- Corridor endpoint persistence is door-reference based. Room-bound corridor nodes persist `door_id` and must validate that the referenced exterior room door still matches the node.
- Corridor path points remain corridor-owned routing data. They may rebuild runtime handles, but they must not become a second persisted wall/boundary truth.
- Transition door placement persists the referenced canonical door, not copied door geometry.
- Stair repositories persist authored path truth plus editor reopen metadata; stair generation policy stays in application code.
- Repositories may own SQL for owner-local routing rows, but they must not keep a second copied physical boundary truth beside the canonical `StructureObject` snapshot.

## Forbidden Drift

- Do not add runtime compatibility normalization for stale rows.
- Do not move selection, fallback, or reload policy into repositories.
- Do not duplicate canonical room, door, or stair semantics in storage helper types.
