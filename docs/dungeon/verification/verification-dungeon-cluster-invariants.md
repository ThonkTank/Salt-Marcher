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
| `DGI-CLUSTER-001` | `RoomCluster` | Cluster identity remains stable across move, wall-run drag, and corner drag. Merge and split identity remain covered by room-route proof, not this invariant row. | Current proof is real-route coverage from `DungeonEditorClusterLabelHandleHarness`, not `OwnerSuite=ClusterInvariantHarness` model proof. | Partial |
| `DGI-CLUSTER-002` | Cluster boundary owner | Editable cluster corners are true authored wall corners, not bounding-box corners over the occupied cells. | Current proof builds a non-rectangular cluster and proves the published edit-corner set matches real boundary vertices through `ProofType=RealRoute`. | Partial |
| `DGI-CLUSTER-003` | Cluster boundary owner | Wall-line handles are derived from contiguous straight wall runs. | Current proof covers the published F15 wall-run handle set through `ProofType=RealRoute`; model-invariant harness remains absent. | Partial |
| `DGI-CLUSTER-004` | Cluster mutation owner | Wall-run drag accepts valid geometry and rejects invalid geometry atomically. | Current proof covers valid wall-run preview/commit/no duplicate-orphan rows; invalid rejection remains unqualified. | Partial |
| `DGI-CLUSTER-005` | Cluster label facts | Default cluster name is `Cluster <clusterId>` unless an authored custom name exists. | Current proof covers default, custom replacement, trimming, reload, and rendered publication through `ProofType=RealRoute`; model-invariant harness remains absent. | Partial |

## References

- [Dungeon Domain Architecture](../architecture/architecture-dungeon-domain.md)
- [Dungeon Domain](../domain/domain-dungeon.md)
- [Core Model Invariants](verification-dungeon-core-model-invariants.md)
- [Dungeon Editor Cluster Matrix](verification-dungeon-editor-clusters.md)
