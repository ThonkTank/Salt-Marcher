# AGENTS.md

This file covers `src/features/world/dungeonmap/structure/`.

## Purpose

`structure` owns shared physical dungeon topology and the persistence that keeps that topology canonical across room and corridor owners.

## Canonical Types and APIs

- `Structure` — shared physical structure aggregate — composes `StructureSurface`, `StructureBoundary`, and attached room-topology state for each level; it does not mirror level-local surface or boundary state back onto the aggregate API.
- `StructureSurface` — level-local surface owner for anchor, surface cells, floor cells, and surface queries; this is the only public surface-truth seam.
- `StructureBoundary` — level-local boundary owner for wall and door capability sets, boundary edges, and boundary-local mutations.
- `StructureRoomTopology` — room projection over one `Structure` — resolves room surfaces, anchors, adjacency, components, and room-to-room connections.
- `DungeonStructureRepository` — shared structure persistence seam.
- `DungeonWallKindRepository` — wall-kind catalog seam used by structure loading.

## Where New Code Goes

- Put shared physical topology, boundary identity, and shared room-projection logic here.
- Put level-local surface behavior on `StructureSurface` and keep callers on `structure.surfaceAtLevel(levelZ)`.
- Put level-local wall, door, and boundary-edge behavior on `StructureBoundary` and keep callers on `structure.boundaryAtLevel(levelZ)`.
- Keep room- or corridor-specific workflow logic in their owners; only reused physical structure truth belongs here.
- Keep internal mutation and invariant protection on `Structure`, `StructureSurface`, and `StructureBoundary`.

## Forbidden Drift

- Do not mirror shared physical topology into room, corridor, runtime, renderer, or storage helper types.
- Do not bypass `StructureSurface` by rebuilding anchor, surface, floor, or clipping logic ad hoc, and do not re-export those capabilities from `Structure`, `LevelStructure`, or `StructureBoundary`.
- Do not bypass `StructureBoundary` by patching wall or door state through ad-hoc writable data structures.
- Do not pull corridor routing traces or stair geometry back into `Structure`.
- Do not create a second persistence path for shared structure truth outside this slice.
