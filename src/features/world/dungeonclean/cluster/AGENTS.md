# Clean Cluster Owner

## Purpose

`dungeonclean/cluster` owns clean persisted cluster rewrite fallout inside the parallel dungeon rebuild.

## Canonical Types and APIs

- `ClusterObject.persistClusterRewriteTail(...)` — clean cluster-owned rewrite-tail seam.
- `input/PersistClusterRewriteTailInput` — clean cluster-owned rewrite-tail request carrier.
- `state/PersistClusterRewriteTailState` — normalized final room rewrite state.
- `repository/PersistClusterRewriteTailRepository` — transaction-owning room rewrite persistence boundary.

## Where New Code Goes

- Keep clean rewrite fallout logic here instead of touching legacy `dungeonmap/cluster/application`.
- Translate legacy rewrite facts into nested clean input carriers at the edge, then persist only through clean state/repository seams.

## Forbidden Drift

- Do not depend on legacy cluster application services from this subtree.
- Do not leak raw JDBC or direct table writes outside the clean cluster repository.
