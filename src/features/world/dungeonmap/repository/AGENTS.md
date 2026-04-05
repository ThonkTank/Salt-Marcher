# AGENTS.md

This file covers `src/features/world/dungeonmap/repository/`.
Use it together with the parent `dungeonmap/AGENTS.md` and the repository root `AGENTS.md`.

## Ownership

- `DungeonLayoutRepository` is the authoritative layout rehydration seam. It assembles one concrete persisted map per call and delegates structure reads to focused repositories.
- `DungeonRoomRepository`, `DungeonCorridorRepository`, `DungeonStairRepository`, and `DungeonTransitionRepository` own direct reads and writes for their structures.
- `DungeonStorageSupport` owns current dungeon schema DDL only. `DatabaseManager.setupDatabase()` creates it once at startup; feature reads and writes do not run compatibility normalization.

## Write Semantics

- `DungeonRoomRepository` owns concrete write ordering for replacing original clusters with final cluster owners, plus moved-cluster persistence.
- Room rewrite workflows must validate and rebind affected room-bound corridor endpoints from stable `roomCell` plus exterior boundary before commit. The same rule applies to room-bound transition doors and stair anchors. Split/merge flows must not leave persisted corridor or transition bindings pointing at stale `roomId`s.
- `DungeonCorridorRepository` owns corridor row writes, synthetic-to-persistent id assignment, node/segment replacement order, direct persistence of absolute room-bound endpoint cells, and persisted free corridor boundary doors. It validates room-bound endpoint cells against the current cluster-owned room surfaces exposed by `DungeonLayout`.
- `DungeonStairRepository` owns stair row writes, ordered path-node persistence, authored stop-level persistence, and editor reopen metadata. Stair generation policy stays out of the repository.
- `DungeonTransitionRepository` owns dungeon-side transition lookups and writes, including placed-target queries, transition-local `DungeonConnection` carrier persistence, and dungeon-map existence checks. Overworld target discovery stays at the `WorldReadApi` boundary.

## Storage Model

- Clusters persist membership ownership plus derived center/level metadata and canonical per-level cluster descriptor rows.
- Rooms persist the room row plus per-level anchor rows only.
- Corridors persist stable identity plus node/segment tables and free boundary-door rows.
- Stairs persist stable identity plus ordered path nodes, authored stop levels, and reopen metadata.
- Transitions persist a nullable placed-connection discriminator plus door-carrier fields or stair geometry/reopen rows alongside the destination discriminator.
- Current code targets only the current schema. Broken or stale rows should fail fast during load instead of being normalized silently.
