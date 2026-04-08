# Structure Boundary Subowner

## Purpose

`boundary` is the local sub-owner beneath `structure` for level-local wall, door, and boundary-edge truth.

## Canonical Types and APIs

- `StructureBoundary` — level-local boundary aggregate for canonical boundary reads, ordered wall-path reads, wall/door edits, segment-to-object lookup, translation, and persistence.
- `BoundaryObject` — internal shared base for `Door` and `Wall`.
- `Door`, `DoorRef`, `Wall`, `WallKind` — local single-object owners and stable references shared by the boundary aggregate.
- `StructureBoundary.PersistenceSnapshot` — canonical boundary persistence shape.

## Where New Code Goes

- Put boundary-local state, mutation, and persistence shape here.
- Keep duplicated door/wall object mechanics on `BoundaryObject`.
- Keep object-specific rewrite behavior on `Door` and `Wall`; keep aggregate dispatch on `StructureBoundary`.

## Forbidden Drift

- Do not mirror boundary state or mutations back onto `Structure`, `StructureRoomTopology`, `Cluster`, `DungeonMap`, or renderer helpers.
- Do not expose `BoundaryObject` as a public working surface for callers.
- Do not introduce a second boundary persistence DTO outside this sub-owner.
