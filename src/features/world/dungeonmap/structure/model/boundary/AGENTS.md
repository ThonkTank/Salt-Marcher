# AGENTS.md

This file covers `src/features/world/dungeonmap/structure/model/boundary/`.

## Purpose

`boundary` is the local sub-owner beneath `structure` for level-local wall, door, and boundary-edge truth.

## Canonical Types and APIs

- `StructureBoundary` — level-local boundary owner — owns boundary edges, doors, authored walls, wall-kind lookups, and boundary-local mutations.
- `Door`, `DoorRef` — boundary-owned door primitives and stable references.
- `Wall`, `WallKind` — boundary-owned wall primitives and shared wall behavior definitions.
- `StructureBoundary.PersistenceSnapshot` — boundary-owned persistence shape — mirrors the runtime boundary state used for save and reload.

## Where New Code Goes

- Put boundary-local state, mutation, and persistence shape here.
- Keep callers on `Structure.boundaryAtLevel(levelZ)` and let that hand them this owner.
- Keep boundary persistence shaped like the runtime owner so repositories save and reload the same concept graph with minimal conversion.

## Forbidden Drift

- Do not mirror boundary state or mutations back onto `Structure`, `StructureRoomTopology`, `RoomCluster`, `DungeonLayout`, or renderer helpers.
- Do not move boundary-owned primitives back into the flat `structure/model/` package.
- Do not introduce a second boundary persistence DTO outside this sub-owner when `StructureBoundary.PersistenceSnapshot` already describes the persisted boundary state.
