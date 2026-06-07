Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-06-07
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
| `DGI-CLUSTER-001` | `RoomCluster` | Cluster identity remains stable across move, wall-run drag, corner drag, room merge, and room split operations. | Harness proves identity preservation and changed geometry result for each mutation family. | Candidate |
| `DGI-CLUSTER-002` | Cluster boundary owner | Editable cluster corners are true authored wall corners, not bounding-box corners over the occupied cells. | Harness builds a non-rectangular cluster and proves the published edit-corner set matches real boundary vertices. | Candidate |
| `DGI-CLUSTER-003` | Cluster boundary owner | Wall-line handles are derived from every contiguous straight interior and exterior wall run. | Harness proves midpoint derivation for interior and exterior wall runs. | Candidate |
| `DGI-CLUSTER-004` | Cluster mutation owner | Wall-run drag moves the whole contiguous run one-to-one with the requested delta and rejects invalid geometry atomically. | Harness proves valid move, no-op, and invalid rejection without partial state. | Candidate |
| `DGI-CLUSTER-005` | Cluster label facts | Default cluster name is `Cluster <clusterId>` unless an authored custom name exists. | Harness proves default, custom-name replacement, trimming, and reload-safe publication facts. | Candidate |

## References

- [Dungeon Domain Architecture](../architecture/architecture-dungeon-domain.md)
- [Dungeon Domain](../domain/domain-dungeon.md)
- [Core Model Invariants](verification-dungeon-core-model-invariants.md)
- [Dungeon Editor Cluster Matrix](verification-dungeon-editor-clusters.md)
