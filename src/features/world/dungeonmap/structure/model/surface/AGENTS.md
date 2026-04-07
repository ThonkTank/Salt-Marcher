# AGENTS.md

This file covers `src/features/world/dungeonmap/structure/model/surface/`.

## Purpose

`surface` is the local sub-owner beneath `structure` for level-local anchor, surface-cell, and floor-cell truth.

## Canonical Types and APIs

- `StructureSurface` — level-local surface owner — owns anchors, surface cells, floor cells, clipping, reachability, and surface-local mutations.
- `StructureSurface.PersistenceSnapshot` — surface-owned persistence shape — mirrors the runtime surface state used for save and reload.

## Where New Code Goes

- Put surface-local state, mutation, and persistence shape here.
- Keep callers on `Structure.surfaceAtLevel(levelZ)` and let that hand them this owner.
- Keep surface persistence shaped like the runtime owner so repositories save and reload the same concept graph with minimal conversion.

## Forbidden Drift

- Do not mirror surface state or mutations back onto `Structure`, `StructureRoomTopology`, `RoomCluster`, `DungeonLayout`, or renderer helpers.
- Do not move surface-owned primitives back into the flat `structure/model/` package.
- Do not introduce a second surface persistence DTO outside this sub-owner when `StructureSurface.PersistenceSnapshot` already describes the persisted surface state.
