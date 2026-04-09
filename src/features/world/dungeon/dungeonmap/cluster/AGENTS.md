# Cluster Owner

## Purpose

`cluster` owns top-level room-cluster aggregates, cluster-backed rewrite workflows, and cluster persistence beneath `dungeonmap`.

## Canonical Types and APIs

- `ClusterObject` — public root owner seam for cluster-owned structures.
- `ClusterObject.persistClusterRewriteTail(...)` — canonical cluster-owned rewrite tail seam for moving persisted rewrite fallout out of legacy `cluster/application` call paths.
- `input/PersistClusterRewriteTailInput` — cluster-owned final tail handoff — carries the persisted-cluster ids plus the authoritative original map and rewrite request needed to finish cluster rewrite fallout.
- `Cluster`, `ClusterDefinitionRequest`, `ClusterMutationRequest`, `ClusterRewriteRequest` — canonical cluster-owned aggregate and write vocabulary.
- `Cluster.rewritePaint(...)` and `Cluster.rewriteDelete(...)` — aggregate-owned rewrite entrypoints for paint and delete flows.
- Cluster topology edits commit physical `Structure` first; room metadata is a cluster-internal automatic follow-up derived from the rewritten structure instead of a tool-owned source of truth.
- `DungeonClusterApplicationService` — legacy internal cluster workflow collaborator used by current surface, floor, boundary, move, door-move, and bootstrap flows. Keep it behind cluster-owned seams; do not treat `application/` as placement precedent for new touched code.
- `DungeonMapApplicationService` — legacy map-owned companion collaborator for cross-owner validation, reconciliation, floor-delete guards, and preview composition.
- `DungeonClusterRepository` — canonical cluster persistence seam for rewrite persistence and rehydration.

## Where New Code Goes

- Put public cross-owner cluster access on `ClusterObject` and keep cluster identity, structure-backed edits, and cluster-local invariants on `Cluster`.
- Let persisted cluster writes converge on `ClusterRewriteRequest` before persistence, and keep any touched legacy `DungeonClusterApplicationService` flow behind cluster-owned seams.
- New public rewrite-tail entrypoints belong on `ClusterObject`, not under `cluster/application`.
- Model the public rewrite tail in cluster-owned input terms; do not keep a permanent wrapper around map-owned tail requests.
- Let cluster rewrites remanage room metadata after topology changes; tools submit topology intent and do not hand-author room creation as a separate truth source.
- Route map-scoped validation, rebound reconciliation, floor-delete guards, and editor previews through the existing map-owned collaborator paths when touching them, but do not treat `application/` packages as the destination for new owner-layer work.
- Keep cluster persistence focused on cluster rows and cluster-owned structure references; keep room metadata in the room owner.

## Forbidden Drift

- Do not let callers outside `cluster/model` depend on `ClusterStructureEditor`; paint/delete rewrites enter through `Cluster`.
- Do not add second cluster mutation or persistence seams beside `Cluster` and `DungeonClusterRepository`, and do not promote legacy application collaborators into new public placement precedent.
- Do not let tools or services become the primary source of editable wall or door eligibility; those rules stay cluster-owned.
- Do not persist derivable mirrors such as cluster centers when the final structure already determines them.
