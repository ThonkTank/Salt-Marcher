# Cluster Owner

## Purpose

`cluster` owns top-level room-cluster aggregates, cluster-backed rewrite workflows, and cluster persistence beneath `dungeonmap`.

## Canonical Types and APIs

- `ClusterObject` — public root owner seam for cluster-owned structures.
- `Cluster`, `ClusterDefinitionRequest`, `ClusterMutationRequest`, `ClusterRewriteRequest` — canonical cluster-owned aggregate and write vocabulary.
- `Cluster.rewritePaint(...)` and `Cluster.rewriteDelete(...)` — aggregate-owned rewrite entrypoints for paint and delete flows.
- `DungeonClusterApplicationService` — public cluster workflow seam for surface, floor, boundary, move, door-move, and bootstrap operations.
- `DungeonMapApplicationService` — map-owned companion seam for cross-owner validation, reconciliation, floor-delete guards, and preview composition.
- `DungeonClusterRepository` — canonical cluster persistence seam for rewrite persistence and rehydration.

## Where New Code Goes

- Put public cross-owner cluster access on `ClusterObject` and keep cluster identity, structure-backed edits, and cluster-local invariants on `Cluster`.
- Let persisted cluster writes converge on `DungeonClusterApplicationService` and reduce to `ClusterRewriteRequest` before persistence.
- Route map-scoped validation, rebound reconciliation, floor-delete guards, and editor previews through `DungeonMapApplicationService`.
- Keep cluster persistence focused on cluster rows and cluster-owned structure references; keep room metadata in the room owner.

## Forbidden Drift

- Do not let callers outside `cluster/model` depend on `ClusterStructureEditor`; paint/delete rewrites enter through `Cluster`.
- Do not add second cluster mutation or persistence seams beside `Cluster`, `DungeonClusterApplicationService`, and `DungeonClusterRepository`.
- Do not let tools or services become the primary source of editable wall or door eligibility; those rules stay cluster-owned.
- Do not persist derivable mirrors such as cluster centers when the final structure already determines them.
