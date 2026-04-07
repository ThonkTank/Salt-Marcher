# AGENTS.md

This file covers `src/features/world/dungeonmap/model/`.

## Purpose

`model` owns dungeon layout, geometry, interaction refs, and aggregate-specific dungeon semantics.

## Canonical Types and APIs

- `DungeonLayout` — loaded map snapshot — resolves cross-owner lookups, traversal, and canonical door or structure queries.
- `RoomCluster` — cluster aggregate over canonical `structure` truth.
- `Corridor` — corridor aggregate over canonical `structure` truth and corridor-owned routing data.
- `DungeonStair` — stair aggregate over stair path geometry and exit validation.

## Where New Code Goes

- Put new dungeon semantics on the lowest stable model owner that enforces the invariant.
- Put shared geometry behavior in `geometry/` only when it is owner-neutral and canonical.
- Let `RoomCluster` and `Corridor` consume `StructureSurface` and `StructureBoundary` through `Structure`.
- Keep immutable geometry and similar value types transparent; put invariant-protecting mutation on the actual owner type.

## Forbidden Drift

- Do not add a second geometry seam beside `geometry/`.
- Do not recreate shared physical topology logic here when the `structure` slice already owns it.
- Do not move canonical semantic decisions into repositories, renderers, tools, or workflow coordinators.
- Do not cache structure-local mirrors of room, corridor, stair, or transition truth in this slice.
