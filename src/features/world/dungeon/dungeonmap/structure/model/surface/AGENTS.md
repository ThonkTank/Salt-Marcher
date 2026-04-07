# AGENTS.md

This file covers `src/features/world/dungeon/dungeonmap/structure/model/surface/`.

## Purpose

`surface` is the local sub-owner beneath `structure` for level-local anchor, surface-cell, and floor-cell truth.
`StructureSurface` is the aggregate owner for that level-local truth; `StructureSurfaceArea` and `StructureFloor` are its local sub-owners.

## Canonical Types and APIs

- `StructureSurface` — level-local surface aggregate — owns the composed surface and floor state for one level and the surface-local persistence snapshot.
- `StructureSurface.editedSurfaceCells(...)` / `StructureSurface.editedFloorCells(...)` — aggregate-owned edit seams — own `GridArea`-backed cell mutation and floor clipping; anchor choice must delegate to `StructureSurfaceArea`, not reimplement a second anchor policy.
- `StructureSurfaceObject` — internal shared base — owns tile-shape-backed behavior common to `StructureSurfaceArea` and `StructureFloor`; this is not a public consumer seam.
- `StructureSurfaceArea` — surface-area owner — owns anchors, surface cells, clipping, reachability, and surface translation.
- `StructureFloor` — floor owner — owns floor-cell truth constrained to one `StructureSurfaceArea`.
- `StructureSurface.PersistenceSnapshot` — surface-owned aggregate persistence shape — the only public surface persistence seam; repositories load and save anchor, surface, and floor rows through this aggregate snapshot instead of constructing child snapshots directly.

## Where New Code Goes

- Put surface-local state, mutation, and persistence shape here.
- Keep callers on `Structure.surfaceAtLevel(levelZ)` and then continue on `.surface()` or `.floor()`.
- Keep surface/floor cell edit orchestration on `StructureSurface` instead of rebuilding raw set mutation in `Structure`.
- Put anchor and surface-cell behavior on `StructureSurfaceArea`.
- Keep anchor normalization and preferred-anchor fallback on `StructureSurfaceArea`; `StructureSurface` should orchestrate, not invent a parallel anchor policy.
- Put floor-cell behavior on `StructureFloor`.
- Use `GridArea` and `GridBoundary` as the public collection carriers for clipping, reachability, and edit inputs instead of raw `Collection<GridPoint>` or `Collection<GridSegment>`.
- Keep shared tile-shape-backed behavior on the internal `StructureSurfaceObject` instead of duplicating it across both child owners.
- Keep surface persistence shaped like the runtime owner so repositories save and reload the same concept graph with minimal conversion.
- Keep child factories, clipping, translation, and child persistence helpers package-local to `surface/`; external callers may read or mutate only through the explicit public `StructureSurface`, `StructureSurfaceArea`, and `StructureFloor` APIs.

## Forbidden Drift

- Do not mirror surface state or mutations back onto `Structure`, `StructureRoomTopology`, `Cluster`, `DungeonMap`, or renderer helpers.
- Do not move surface-owned primitives back into the flat `structure/model/` package.
- Do not keep `StructureSurfaceArea`- or `StructureFloor`-specific mutation logic on `StructureSurface` when the sub-owner can carry it directly.
- Do not keep convenience mirrors like `StructureSurface.cells()` or `StructureSurface.floorCells()` once `StructureSurfaceArea` and `StructureFloor` already expose that truth.
- Do not expose child persistence records or child rehydration helpers outside this package; `StructureSurface.PersistenceSnapshot` is the only public persistence truth for the surface aggregate.
