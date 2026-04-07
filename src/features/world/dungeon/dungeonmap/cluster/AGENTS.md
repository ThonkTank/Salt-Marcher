# AGENTS.md

## Purpose

`cluster` owns top-level room-cluster aggregates, cluster-backed rewrite workflows, and cluster persistence beneath `map`.

## Canonical Types and APIs

- `model/ClusterSpecification` — canonical cluster-authored payload for construction and rehydration.
- `model/Cluster` — top-level cluster aggregate that extends `Structure` with cluster identity, center, and room metadata membership; public writes converge on `mutated(ClusterMutation)`.
- `model/ClusterMutation` — canonical cluster-local write vocabulary for floor, wall, door, and translation edits.
- `model/ClusterRewritePlan` — explicit cluster replacement payload for paint, delete, split, and move rewrites.
- `model/ClusterStructureEditor` — internal rewrite helper that returns `ClusterRewritePlan` for cluster paint/delete/split flows over canonical structure topology.
- `application/DungeonClusterApplicationService` — public cluster workflow seam with request-record entrypoints for paint/delete, floor edits, wall and door edits, cluster moves, and default cluster bootstrap.
- `repository/DungeonClusterRepository` — cluster row and structure-reference persistence seam.

## Where New Code Goes

- Put cluster identity, center, structure-backed boundary edits, and cluster-local move semantics on `Cluster`.
- Put reusable cluster rewrite mechanics on `ClusterStructureEditor`, not on room workflows or editor tools.
- Let public cluster writes converge on `DungeonClusterApplicationService` request records and reduce them to `ClusterMutation` or `ClusterRewritePlan` before persistence.
- Keep cluster persistence focused on cluster rows and cluster-owned structure references; room metadata stays in `DungeonRoomRepository`.

## Forbidden Drift

- Do not move top-level cluster ownership back into `model/structures`, `room`, `layout`, or editor tools.
- Do not mirror cluster persistence back into `DungeonRoomRepository` now that `DungeonClusterRepository` exists.
- Do not add second cluster mutation seams beside `Cluster.mutated(...)`, `ClusterStructureEditor`, and `DungeonClusterApplicationService`.
- Do not let tools or services become the primary source of editable wall or door eligibility; those boundary rules stay cluster-owned.
