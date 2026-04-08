# Structure Room Subowner

## Purpose

`room` is the local sub-owner beneath `structure` for derived room projection and room-to-room topology truth.

## Canonical Types and APIs

- `StructureRoomTopology` — public room aggregate seam for derived room structures, lookup, adjacency, components, merge eligibility, and local room connections for one structure-backed cluster.
- `StructureRoomProjectionIndex` — internal projection sub-owner for room partitioning, per-room derived structures, and point-to-room lookup truth.
- `StructureRoomGraph` — internal graph sub-owner for adjacency, connected components, component lookup, and local room-connection derivation.
- `ClusterStructureEditor` — internal reusable structure-backed cluster paint/delete rewrite helper.

## Where New Code Goes

- Put structure-local room projection, lookup, adjacency, and connection truth here.
- Put partitioning on `StructureRoomProjectionIndex` and graph derivation on `StructureRoomGraph`.
- Keep reusable cluster paint/delete rewrite mechanics package-local here instead of duplicating them in room workflows.

## Forbidden Drift

- Do not mirror room projection or room graph truth back onto `Structure`, `Cluster`, `DungeonMap`, renderers, or repositories.
- Do not add public room workflow entrypoints here when those entrypoints belong to the room owner.
