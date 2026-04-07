# AGENTS.md

This file covers `src/features/world/dungeonmap/structure/`. Use it together with the parent `dungeonmap/AGENTS.md` and the repository root `AGENTS.md`.

## Purpose

This package is the current home of the `structure` owner slice. It owns shared physical dungeon topology and the persistence that keeps that topology canonical across room and corridor owners.

## Owner Atlas

- `Structure` — single owner of the concrete topology aggregate shared by room clusters and corridors.
- `StructureRoomTopology` — structure-owned room projection over persisted room metadata and reachable surface.
- `DungeonStructureRepository` — canonical persistence seam for concrete structure snapshots.
- `DungeonWallKindRepository` — wall-kind catalog seam consumed by structure persistence and loading.

## Canonical Types and APIs

- `Structure` — shared physical structure aggregate — owns surface, floor, wall, door, and attached room-topology state.
- `StructureRoomTopology` — room projection over one `Structure` — resolves room surfaces, anchors, adjacency, components, and local room-to-room connections.
- `Door`, `Wall`, `Floor`, `WallKind` — structure-owned boundary and surface primitives — model shared physical semantics instead of room- or corridor-local copies.
- `DungeonStructureRepository` — shared structure persistence seam — persists canonical `Structure` snapshots.
- `DungeonWallKindRepository` — wall-kind catalog seam — resolves app-global wall behavior used by structure loading.

## Where New Code Goes

- Put shared physical topology, boundary identity, and shared room-projection logic here.
- Keep room- or corridor-specific workflow logic in their owners; only the reused physical structure truth belongs here.
- Keep stair path geometry on the `stair` owner and corridor path traces on the `corridor` owner; `structure` only owns the realized physical topology they reference.
- Keep internal mutation and invariant protection on `Structure` and related owner types. Value carriers under this slice may stay transparent only when they are immutable transport or geometry shapes.

## Forbidden Drift

- Do not mirror shared physical topology into room, corridor, runtime, renderer, or storage helper types.
- Do not bypass `Structure` by letting consumers patch wall, door, or floor state through ad-hoc writable data structures.
- Do not pull corridor routing traces or stair geometry back into `Structure`.
- Do not create a second persistence path for shared structure truth outside this slice.
