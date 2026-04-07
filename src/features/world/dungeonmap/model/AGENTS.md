# AGENTS.md

This file covers `src/features/world/dungeonmap/model/`. Use it together with the parent `dungeonmap/AGENTS.md` and the repository root `AGENTS.md`.

## Purpose

This package is the current home of canonical dungeon truth. Shared dungeonmap ownership already lives in the parent file; this file only documents model-local additions.

## Canonical Types and APIs

- `DungeonLayout` — loaded map snapshot — resolves cross-owner lookups, traversal, and canonical door or structure queries.
- `StructureObject` — physical structure aggregate — owns surface, floor, wall, door, and stair topology plus attached room metadata projection.
- `StructureRoomTopology` — room projection index — resolves room surfaces, anchors, adjacency, components, and local connections for one cluster structure.
- `RoomCluster` — cluster aggregate — owns cluster-level room behavior over canonical structure truth.
- `Corridor` — corridor aggregate — owns corridor routing, segments, nodes, and realized corridor topology.

## Where New Code Goes

- Put new dungeon semantics on the lowest stable model owner that actually enforces the invariant.
- Put new shared geometry behavior in `geometry/` only when it is owner-neutral and genuinely canonical.
- Put room-projection logic on `StructureRoomTopology` or `RoomCluster`, not on repositories, views, or workflow helpers.

## Forbidden Drift

- Do not add a second geometry seam beside `geometry/`.
- Do not add a second topology aggregate beside `StructureObject`.
- Do not move canonical semantic decisions into repositories, renderers, tools, or workflow coordinators.
- Do not cache structure-local mirrors of room, corridor, stair, or transition truth when the canonical owner already exists here.
