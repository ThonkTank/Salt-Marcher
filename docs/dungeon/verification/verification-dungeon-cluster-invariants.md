Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-06-08
Source of Truth: Target invariant catalog for Dungeon Cluster ownership proof.

# Dungeon Cluster Invariants

## Purpose

This catalog defines target model-invariant proof obligations for authored
Dungeon cluster ownership. It supplements editor real-route proof and does not
close `DE-*` rows by itself.

Required proof rows publish `OwnerSuite=ClusterInvariantHarness`,
`ProofType=ModelInvariant`, and the invariant id.

## Cluster Invariant Catalog

| Invariant ID | Target Owner | Invariant | Required Proof | Current Status |
| --- | --- | --- | --- | --- |
| `DGI-CLUSTER-001` | `DungeonMap` and `DungeonRoomCluster` | Cluster identity remains stable across move, wall-run drag, and corner movement. | `OwnerSuite=ClusterInvariantHarness`, `ProofType=ModelInvariant` proves cluster identity preservation through named production owner/API mutations. | Qualified |
| `DGI-CLUSTER-002` | `DungeonRoomCluster` | Editable cluster corners are true authored wall corners, not bounding-box corners over the occupied cells. | `OwnerSuite=ClusterInvariantHarness`, `ProofType=ModelInvariant` builds a non-rectangular cluster and proves authored boundary vertices expose true corners. | Qualified |
| `DGI-CLUSTER-003` | `RoomClusterWallMap` | Wall-line handles are derived from contiguous straight wall runs. | `OwnerSuite=ClusterInvariantHarness`, `ProofType=ModelInvariant` derives wall-line handles from contiguous straight wall-run facts. | Qualified |
| `DGI-CLUSTER-004` | `DungeonMap` boundary-stretch mutation | Wall-run drag accepts valid geometry and rejects invalid geometry atomically. | `OwnerSuite=ClusterInvariantHarness`, `ProofType=ModelInvariant` proves valid wall-run movement and atomic invalid-movement rejection. | Qualified |
| `DGI-CLUSTER-005` | `DungeonRoomCluster` and `DungeonMap` label facts | Default cluster name is `Cluster <clusterId>` unless an authored custom name exists. | `OwnerSuite=ClusterInvariantHarness`, `ProofType=ModelInvariant` proves default and authored custom cluster-name facts. | Qualified |

## References

- [Dungeon Domain Architecture](../architecture/architecture-dungeon-domain.md)
- [Dungeon Domain](../domain/domain-dungeon.md)
- [Core Model Invariants](verification-dungeon-core-model-invariants.md)
- [Dungeon Editor Cluster Matrix](verification-dungeon-editor-clusters.md)
