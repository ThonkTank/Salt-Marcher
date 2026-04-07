# AGENTS.md

This file covers `src/features/world/dungeonmap/structure/model/surface/`.

## Purpose

`surface` is the local sub-owner beneath `structure` for level-local anchor, surface-cell, and floor-cell truth.
`StructureSurface` is the aggregate owner for that level-local truth; `StructureSurfaceArea` and `StructureFloor` are its local sub-owners.

## Canonical Types and APIs

- `StructureSurface` — level-local surface aggregate — owns the composed surface and floor state for one level and the surface-local persistence snapshot.
- `StructureSurfaceObject` — internal shared base — owns tile-shape-backed behavior common to `StructureSurfaceArea` and `StructureFloor`; this is not a public consumer seam.
- `StructureSurfaceArea` — surface-area owner — owns anchors, surface cells, clipping, reachability, and surface translation.
- `StructureFloor` — floor owner — owns floor-cell truth constrained to one `StructureSurfaceArea`.
- `StructureSurface.PersistenceSnapshot` — surface-owned aggregate persistence shape — composes `StructureSurfaceArea.PersistenceSnapshot` and `StructureFloor.PersistenceSnapshot`.

## Where New Code Goes

- Put surface-local state, mutation, and persistence shape here.
- Keep callers on `Structure.surfaceAtLevel(levelZ)` and then continue on `.surface()` or `.floor()`.
- Put anchor and surface-cell behavior on `StructureSurfaceArea`.
- Put floor-cell behavior on `StructureFloor`.
- Keep shared tile-shape-backed behavior on the internal `StructureSurfaceObject` instead of duplicating it across both child owners.
- Keep surface persistence shaped like the runtime owner so repositories save and reload the same concept graph with minimal conversion.

## Forbidden Drift

- Do not mirror surface state or mutations back onto `Structure`, `StructureRoomTopology`, `RoomCluster`, `DungeonLayout`, or renderer helpers.
- Do not move surface-owned primitives back into the flat `structure/model/` package.
- Do not keep `StructureSurfaceArea`- or `StructureFloor`-specific mutation logic on `StructureSurface` when the sub-owner can carry it directly.
- Do not keep convenience mirrors like `StructureSurface.cellCoords()` or `StructureSurface.floorCells()` once `StructureSurfaceArea` and `StructureFloor` already expose that truth.
- Do not introduce a second surface persistence DTO outside this sub-owner when `StructureSurface.PersistenceSnapshot` already describes the persisted surface state.
