# AGENTS.md

This file covers `src/features/world/dungeonmap/structure/`.

## Purpose

`structure` owns shared physical dungeon topology and the persistence that keeps that topology canonical across room and corridor owners.

## Canonical Types and APIs

- `Structure` — shared physical structure aggregate — composes the local `surface` and `boundary` sub-owners plus attached room-topology state for each level; it does not mirror level-local child-owner state back onto the aggregate API.
- `StructureSurface` — level-local surface aggregate seam; callers enter through `Structure.surfaceAtLevel(levelZ)` and then continue on `surface()` or `floor()`.
- `surface/StructureSurfaceArea`, `surface/StructureFloor` — local surface sub-owners for area and floor truth.
- `StructureBoundary` — level-local boundary aggregate for wall and door capability sets, boundary edges, cross-object boundary rules, and boundary persistence snapshots.
- `boundary/door/Door`, `boundary/door/DoorRef` — single-door sub-owner plus stable reference.
- `boundary/wall/Wall`, `boundary/wall/WallKind` — single-wall sub-owner plus shared wall-kind definition.
- `StructureRoomTopology` — room projection over one `Structure` — resolves room surfaces, anchors, adjacency, components, and room-to-room connections.
- `DungeonStructureRepository` — shared structure persistence seam that mirrors the runtime split into `Structure.LevelStructure`, `StructureSurface`, and `StructureBoundary`.
- `DungeonWallKindRepository` — wall-kind catalog seam used by structure loading.

## Where New Code Goes

- Put shared physical topology, boundary identity, and shared room-projection logic here.
- Put level-local surface behavior on the local `model/surface/` sub-owner and keep callers on `structure.surfaceAtLevel(levelZ).surface()` or `.floor()`.
- Put object-local surface-area and floor behavior on the `model/surface/` subtree instead of expanding `StructureSurface`.
- Put level-local wall, door, and boundary-edge behavior on the local `model/boundary/` sub-owner and keep callers on `structure.boundaryAtLevel(levelZ)`.
- Put object-local door behavior on `model/boundary/door/` and object-local wall behavior on `model/boundary/wall/`.
- Put level-local boundary persistence data on `StructureBoundary.PersistenceSnapshot`, let `StructureSurface.PersistenceSnapshot` compose the `StructureSurfaceArea` and `StructureFloor` snapshots, and let `Structure.LevelStructure.PersistenceSnapshot` compose those owner snapshots.
- Keep room- or corridor-specific workflow logic in their owners; only reused physical structure truth belongs here.
- Keep internal mutation and invariant protection on `Structure`, `StructureSurface`, `StructureSurfaceArea`, `StructureFloor`, and `StructureBoundary`.

## Forbidden Drift

- Do not mirror shared physical topology into room, corridor, runtime, renderer, or storage helper types.
- Do not bypass `StructureSurfaceArea` or `StructureFloor` by rebuilding anchor, surface, floor, or clipping logic ad hoc, and do not re-export those capabilities from `Structure`, `LevelStructure`, or `StructureBoundary`.
- Do not bypass `StructureBoundary` by patching wall or door state through ad-hoc writable data structures.
- Do not keep door- or wall-specific rewrite logic on `StructureBoundary` when one `Door` or `Wall` can own it directly.
- Do not flatten surface and boundary persistence back into a second structure-only snapshot shape when the runtime owners already provide the canonical composition.
- Do not pull corridor routing traces or stair geometry back into `Structure`.
- Do not create a second persistence path for shared structure truth outside this slice.
