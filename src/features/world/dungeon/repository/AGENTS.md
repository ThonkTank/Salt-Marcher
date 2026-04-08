# Dungeon Root Repositories

## Purpose

`repository` owns the dungeon-root repositories that still persist room, stair, transition, and shared SQL support outside the map-owned repository subtree.

## Canonical Types and APIs

- `DungeonRoomRepository` — room metadata and room-to-cluster membership persistence.
- `DungeonStairRepository` and `DungeonTransitionRepository` — stair- and transition-owned metadata persistence.
- `DungeonPersistenceDirections` and `DungeonStorageSupport` — shared SQL support for dungeon repositories.

## Where New Code Goes

- Put owner-local SQL, row mapping, and schema ordering here when the owner still persists through the dungeon-root repository package.
- Put loaded-map rehydration in `dungeonmap/repository/`.
- Route shared physical structure persistence through `dungeonmap/structure/repository`.

## Forbidden Drift

- Do not move selection, fallback, load, or reload policy into repositories.
- Do not duplicate canonical room, door, stair, or transition semantics in storage helper types.
- Do not make this package the owner of the authoritative loaded-map snapshot.
