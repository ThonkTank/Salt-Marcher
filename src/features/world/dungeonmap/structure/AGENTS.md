# AGENTS.md

This file covers `src/features/world/dungeonmap/structure/`. Use it together with the parent `dungeonmap/AGENTS.md` and the repository root `AGENTS.md`.

## Purpose

This package is the current home of the `structure` owner slice. It owns shared physical dungeon topology and the persistence that keeps that topology canonical across room and corridor owners.

## Canonical Types and APIs

- `Structure` — shared physical structure aggregate — composes `StructureSurface`, `StructureBoundary`, and attached room-topology state for each level.
- `StructureSurface` — structure-owned surface primitive — owns anchor, surface cells, floor cells, and level-local surface queries for one level.
- `StructureBoundary` — structure-owned boundary primitive — owns wall and door capability sets, boundary edge lookups, and boundary-local mutations for one level.
- `StructureRoomTopology` — room projection over one `Structure` — resolves room surfaces, anchors, adjacency, components, local room-to-room connections, and hands callers the derived room `Structure` via `structureFor(...)`.
- `Door`, `Wall`, `WallKind` — structure-owned boundary primitives — model shared physical semantics instead of room- or corridor-local copies.
- `DungeonStructureRepository` — shared structure persistence seam — persists canonical `Structure` snapshots.
- `DungeonWallKindRepository` — wall-kind catalog seam — resolves app-global wall behavior used by structure loading.

## Where New Code Goes

- Put shared physical topology, boundary identity, and shared room-projection logic here.
- Put level-local anchor, surface-cell, floor-cell, and reachability behavior on `StructureSurface`.
- Put level-local wall, door, and boundary-edge behavior on `StructureBoundary`; keep `Structure` focused on aggregate composition and surface/floor truth.
- If room-facing code needs boundary truth for one derived room, expose the derived `Structure` and let the caller continue through `boundaryAtLevel(...)`; do not add room-topology-local boundary forwarding methods.
- Keep room- or corridor-specific workflow logic in their owners; only the reused physical structure truth belongs here.
- Keep stair path geometry on the `stair` owner and corridor path traces on the `corridor` owner; `structure` only owns the realized physical topology they reference.
- Keep internal mutation and invariant protection on `Structure` and related owner types. Value carriers under this slice may stay transparent only when they are immutable transport or geometry shapes.

## Forbidden Drift

- Do not mirror shared physical topology into room, corridor, runtime, renderer, or storage helper types.
- Do not bypass `StructureSurface` by letting callers rebuild anchor, surface, floor, or clipping logic ad hoc.
- Do not bypass `StructureBoundary` by letting consumers patch wall or door state through ad-hoc writable data structures.
- Do not let `StructureRoomTopology` grow convenience methods that mirror `StructureBoundary` collections or mutations; `structureFor(...).boundaryAtLevel(...)` is the public handoff seam.
- Do not pull corridor routing traces or stair geometry back into `Structure`.
- Do not create a second persistence path for shared structure truth outside this slice.
