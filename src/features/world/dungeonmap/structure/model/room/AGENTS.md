# AGENTS.md

This file covers `src/features/world/dungeonmap/structure/model/room/`.

## Purpose

`room` is the local sub-owner beneath `structure` for derived room projection and room-to-room topology truth.
`StructureRoomTopology` is the public aggregate seam; projection indexing, graph indexing, and structure-backed cluster rewrite helpers stay package-local beneath it.

## Canonical Types and APIs

- `StructureRoomTopology` — room aggregate seam — owns derived room structures, room lookup, adjacency, components, merge eligibility, and local room connections for one structure-backed cluster.
- `StructureRoomProjectionIndex` — internal projection sub-owner — owns room partitioning over structure cells, per-room derived structures, and point-to-room lookup truth.
- `StructureRoomGraph` — internal graph sub-owner — owns adjacency, connected components, component lookup, and local room connection derivation over the projection index.
- `StructureRoomClusterEditor` — internal rewrite helper — owns the reusable structure-backed cluster paint/delete rewrite logic used by room workflows.

## Where New Code Goes

- Put structure-local room projection, lookup, adjacency, and connection truth here.
- Keep callers on `Structure.roomTopology()` and then continue on the explicit `StructureRoomTopology` API.
- Put partitioning and derived-structure indexing on `StructureRoomProjectionIndex`.
- Put adjacency, components, and local room-connection derivation on `StructureRoomGraph`.
- Put reusable structure-backed cluster paint/delete rewrite mechanics on `StructureRoomClusterEditor` instead of duplicating them in room workflows.

## Forbidden Drift

- Do not mirror room projection or room graph truth back onto `Structure`, `RoomCluster`, `DungeonLayout`, renderers, or repositories.
- Do not add second convenience mirrors like `Structure.rooms()` or `Structure.localRoomConnections()` once `Structure.roomTopology()` exists.
- Do not mirror room lookup, room containment, or derived room-structure reads back onto `RoomCluster` or `DungeonLayout`; callers must resolve the owning structure and continue on `roomTopology()`.
- Do not re-home public room workflows from the room owner into this subtree; this package may host reusable structure-backed rewrite helpers, but application entrypoints still belong to the room owner.
