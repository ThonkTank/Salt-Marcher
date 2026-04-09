# Clean Cluster Owner

## Purpose

`dungeonclean/cluster` owns clean persisted cluster rewrite fallout inside the parallel dungeon rebuild.

## Canonical Types and APIs

- `ClusterObject.persistClusterRewriteTail(...)` — clean cluster-owned rewrite-tail seam.
- `ClusterObject.loadClusterRewriteTailStatus(...)` — clean cluster-owned room-table status read seam.
- `input/PersistClusterRewriteTailInput` — clean cluster-owned rewrite-tail request carrier.
- `input/LoadClusterRewriteTailStatusInput` — clean cluster-owned room-table status request and result carrier.
- `state/LoadClusterRewriteTailStatusState` — normalized room-table status snapshot.
- `repository/LoadClusterRewriteTailStatusRepository` — clean cluster-owned room-table status repository.
- `state/PersistClusterRewriteTailState` — normalized final room rewrite state.
- `repository/PersistClusterRewriteTailRepository` — transaction-owning room rewrite persistence boundary, using the shared `database/DatabaseTransactionRunner`.

## Where New Code Goes

- Keep clean rewrite fallout logic here instead of touching legacy `dungeonmap/cluster/application`.
- Translate clean rewrite facts into nested clean input carriers at the edge, then persist or load only through clean state/repository seams.
- Use `database/DatabaseManager` for fresh connections and `database/DatabaseTransactionRunner` for explicit write transactions instead of local transaction boilerplate.

## Forbidden Drift

- Do not depend on legacy cluster application services from this subtree.
- Do not leak raw JDBC or direct table writes outside the clean cluster repository.
