# AGENTS.md

This file covers `src/features/world/dungeonmap/structure/model/boundary/`.

## Purpose

`boundary` is the local sub-owner beneath `structure` for level-local wall, door, and boundary-edge truth.
`StructureBoundary` is the aggregate owner for that level-local truth; `door/` and `wall/` are its local single-object sub-owners.

## Canonical Types and APIs

- `BoundaryObject` — internal shared base for `Door` and `Wall` — owns duplicated anchor, boundary-segment, touching-cell, clipping, and component helpers through its explicit object API.
- `StructureBoundary` — level-local boundary aggregate — owns boundary edges, aggregate door-opening reads such as `doorBoundaryEdges()`, segment-to-object lookups such as `doorAtBoundarySegment(...)` and `wallAtBoundarySegment(...)`, cross-object boundary rules, door edit dispatch such as `withCreatedDoorSegments(...)`, `withDeletedDoorSegments(...)`, and `withMovedDoor(...)`, and the boundary persistence snapshot.
- `door/Door`, `door/DoorRef` — single-door owner plus stable reference — own door-local clipping, segment removal, anchor repair, and persisted segment access.
- `wall/Wall`, `wall/WallKind` — single-wall owner plus shared wall-kind definition — own wall-local clipping, split-on-delete behavior, anchor repair, and persisted segment access.
- `StructureBoundary.PersistenceSnapshot` — boundary-owned persistence shape — mirrors the runtime boundary state used for save and reload.

## Where New Code Goes

- Put boundary-local state, mutation, and persistence shape here.
- Keep callers on `Structure.boundaryAtLevel(levelZ)` and let that hand them this owner.
- Put duplicated door/wall object mechanics on `BoundaryObject` before copying them between `Door` and `Wall`.
- Keep aggregate door create/delete/move dispatch on `StructureBoundary` so `Structure` does not rebuild boundary object rewrites itself.
- Put door-specific rewrite, clipping, and anchor normalization on `door/Door`.
- Put wall-specific rewrite, clipping, split, and anchor normalization on `wall/Wall`.
- Keep boundary persistence shaped like the runtime owner so repositories save and reload the same concept graph with minimal conversion.

## Forbidden Drift

- Do not mirror boundary state or mutations back onto `Structure`, `StructureRoomTopology`, `RoomCluster`, `DungeonLayout`, or renderer helpers.
- Do not move door- or wall-owned primitives back into the flat `structure/model/` package.
- Do not expose `BoundaryObject` as a new public working surface for callers; it is an internal implementation seam only.
- Do not rebuild door or wall edits from raw `GridBoundary` surgery in `StructureBoundary`, `RoomCluster`, `Corridor`, repositories, or shell helpers when `Door` and `Wall` already expose the needed API.
- Do not introduce a second boundary persistence DTO outside this sub-owner when `StructureBoundary.PersistenceSnapshot` already describes the persisted boundary state.
