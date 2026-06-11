Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-06-08
Source of Truth: Target invariant catalog for Dungeon Room ownership proof.

# Dungeon Room Invariants

## Purpose

This catalog defines target model-invariant proof obligations for authored room
identity, room naming, room-cell assignment, and model-owned room label source
facts. It supplements editor real-route proof and does not close `DE-*` rows by
itself. View-owned label rotation, hit geometry, and inline-editor presentation
are qualified by the editor label matrix.

Required proof rows publish `OwnerSuite=RoomInvariantHarness`,
`ProofType=ModelInvariant`, and the invariant id.

## Room Invariant Catalog

| Invariant ID | Target Owner | Invariant | Required Proof | Current Status |
| --- | --- | --- | --- | --- |
| `DGI-ROOM-001` | `DungeonRoom` | Room identity and narration survive aggregate cluster edits when the room remains represented. | `OwnerSuite=RoomInvariantHarness`, `ProofType=ModelInvariant` proves room identity and narration survival through named production owner/API edits. | Qualified |
| `DGI-ROOM-002` | `RoomClusterRoomPartition` | Every floor-owned room cell is assigned to exactly one room after closed-boundary partitioning. | `OwnerSuite=RoomInvariantHarness`, `ProofType=ModelInvariant` proves one-room cell assignment without duplicate ownership. | Qualified |
| `DGI-ROOM-003` | `DungeonRoom` and `DungeonMap` label facts | Default room name is `Raum <roomId>` unless an authored custom name exists. | `OwnerSuite=RoomInvariantHarness`, `ProofType=ModelInvariant` proves default and authored custom room-name facts. | Qualified |
| `DGI-ROOM-004` | `RoomClusterRoomPartition` and `Room` anchor facts | Room label source facts are derived from partition-owned room floor cells and sorted room anchors. | `OwnerSuite=RoomInvariantHarness`, `ProofType=ModelInvariant` proves room-label source facts derive from room floor cells without claiming view-owned orientation. | Qualified |

## References

- [Dungeon Domain Architecture](../architecture/architecture-dungeon-domain.md)
- [Dungeon Domain](../domain/domain-dungeon.md)
- [Core Model Invariants](verification-dungeon-core-model-invariants.md)
- [Dungeon Editor Room Matrix](verification-dungeon-editor-rooms.md)
- [Dungeon Editor Label Matrix](verification-dungeon-editor-labels.md)
