# Structure Surface Subowner

## Purpose

`surface` is the local sub-owner beneath `structure` for level-local anchor, surface-cell, and floor-cell truth.

## Canonical Types and APIs

- `StructureSurface` — level-local surface aggregate that composes surface and floor state, owns surface-local mutation orchestration, and defines the public persistence snapshot.
- `StructureSurfaceArea` — surface-area owner for anchors, surface cells, clipping, reachability, and translation.
- `StructureFloor` — floor owner constrained to one `StructureSurfaceArea`.
- `StructureSurfaceObject` — internal shared base for `StructureSurfaceArea` and `StructureFloor`.
- `StructureSurface.PersistenceSnapshot` — canonical surface persistence shape.

## Where New Code Goes

- Put surface-local state, mutation, and persistence shape here.
- Keep aggregate surface/floor edit orchestration on `StructureSurface`.
- Keep anchor and surface-cell behavior on `StructureSurfaceArea` and floor-cell behavior on `StructureFloor`.

## Forbidden Drift

- Do not mirror surface state or mutations back onto `Structure`, `StructureRoomTopology`, `Cluster`, `DungeonMap`, or renderer helpers.
- Do not expose child persistence records or child rehydration helpers outside this package; `StructureSurface.PersistenceSnapshot` is the public persistence truth for this aggregate.
