# AGENTS.md

## Purpose

`cluster` owns top-level room-cluster aggregates, cluster-backed rewrite workflows, and cluster persistence beneath `map`.

## Canonical Types and APIs

- `model/ClusterDefinitionRequest` — canonical cluster-owned construction and rehydration request.
- `model/Cluster` — top-level cluster aggregate that extends `Structure` with cluster identity and room metadata membership; `center()` is derived runtime state from the final structure and public writes converge on `mutated(ClusterMutationRequest)`.
- `model/ClusterMutationRequest` — canonical cluster-local write vocabulary for floor, wall, door, and translation edits.
- `model/ClusterPaintRequest`, `model/Cluster.rewritePaint(...)` — public cluster-owned paint rewrite seam — expands one paint area plus overlapping clusters into a cluster rewrite payload.
- `model/ClusterDeleteRequest`, `model/Cluster.rewriteDelete(...)` — public cluster-owned delete rewrite seam — expands one delete area into zero or more replacement clusters.
- `model/ClusterRewriteRequest` — explicit cluster replacement payload for paint, delete, split, and move rewrites.
- `application/DungeonClusterApplicationService.ClusterSurfaceRewriteRequest`, `rewriteSurface(...)` — public cluster workflow seam for paint/delete surface rewrites.
- `application/DungeonClusterApplicationService.ClusterFloorEditRequest`, `editFloor(...)` — public cluster workflow seam for traversable floor add/remove edits.
- `application/DungeonClusterApplicationService.ClusterBoundaryEditRequest`, `editBoundary(...)` — public cluster workflow seam for wall, interior-door, and exterior-door create/delete edits.
- `application/DungeonClusterApplicationService.ClusterMoveRequest`, `moveCluster(...)` — public cluster workflow seam for persisted cluster translation.
- `application/DungeonClusterApplicationService.ClusterDoorMoveRequest`, `moveDoor(...)` — public cluster workflow seam for persisted local-door moves.
- `application/DungeonClusterApplicationService.ClusterBootstrapRequest`, `bootstrapDefaultCluster(...)` — public cluster workflow seam for first-room bootstrap in a new map transaction.
- `application/DungeonMapApplicationService` — map-owned companion seam for cluster workflows — validates rewrites against corridor and transition truth, guards cross-owner floor deletions, and composes cluster preview snapshots for editor drags.
- `repository/DungeonClusterRepository.persistRewrite(...)` — canonical cluster persistence seam — realizes one `ClusterRewriteRequest` into persisted cluster rows and referenced structure state while room metadata stays in the room owner.
- `repository/DungeonClusterRepository` — cluster rehydration seam — loads persisted cluster rows plus referenced structures for map assembly.

## Where New Code Goes

- Put cluster identity, center, structure-backed boundary edits, and cluster-local move semantics on `Cluster`.
- Put public paint/delete rewrite entrypoints on `Cluster` via `rewritePaint(...)` and `rewriteDelete(...)`.
- Keep `ClusterStructureEditor` package-private inside `cluster/model` as an implementation detail behind those aggregate seams.
- Let public cluster writes converge on the six `DungeonClusterApplicationService` workflow request families and reduce them to `ClusterRewriteRequest` before persistence; bootstrap uses the same rewrite payload as every other persisted cluster change.
- Route map-scoped rewrite validation, rebound reconciliation, floor-deletion guards, and editor preview composition through `DungeonMapApplicationService` instead of calling cross-owner helpers on `DungeonMap` directly.
- Keep cluster persistence focused on cluster rows and cluster-owned structure references; derive cluster center from the final structure on every construction path and keep room metadata in `DungeonRoomRepository`.

## Forbidden Drift

- Do not move top-level cluster ownership back into `model/structures`, `room`, `layout`, or editor tools.
- Do not mirror cluster persistence back into `DungeonRoomRepository` now that `DungeonClusterRepository` exists.
- Do not let callers outside `cluster/model` depend on `ClusterStructureEditor`; paint/delete rewrites must enter through `Cluster`.
- Do not add second cluster mutation seams beside `Cluster.mutated(...)`, `Cluster.rewritePaint(...)`, `Cluster.rewriteDelete(...)`, and the six public `DungeonClusterApplicationService` workflow families.
- Do not add parallel repository write paths like ad-hoc create/save/move helpers; persisted cluster writes go only through `DungeonClusterRepository.persistRewrite(...)`.
- Do not reintroduce public `Cluster.translated(...)`; translation stays cluster-owned only through `mutated(new ClusterMutationRequest.Translation(...))`.
- Do not let tools or services become the primary source of editable wall or door eligibility; those boundary rules stay cluster-owned.
- Do not let cluster workflows or tools call public cluster preview or cross-owner rewrite helpers on `DungeonMap`; those map-owned seams belong on `DungeonMapApplicationService`.
- Do not persist cluster-local topology mirrors such as center coordinates once the final structure already determines them.
