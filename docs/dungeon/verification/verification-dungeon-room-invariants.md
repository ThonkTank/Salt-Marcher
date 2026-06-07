Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-06-07
Source of Truth: Target invariant catalog for Dungeon Room ownership proof.

# Dungeon Room Invariants

## Purpose

This catalog defines target model-invariant proof obligations for authored room
identity, room naming, room-cell assignment, and room label facts. It
supplements editor real-route proof and does not close `DE-*` rows by itself.

Required proof rows publish `OwnerSuite=RoomInvariantHarness`,
`ProofType=ModelInvariant`, and the invariant id.

## Room Invariant Catalog

| Invariant ID | Target Owner | Invariant | Required Proof | Current Status |
| --- | --- | --- | --- | --- |
| `DGI-ROOM-001` | `Room` | Room identity and narration survive cluster edits when the room remains represented. | Harness proves move, wall-run drag, corner drag, and repartition survival cases. | Candidate |
| `DGI-ROOM-002` | Room collection or partition owner | Every floor-owned room cell is assigned to exactly one room after closed-boundary partitioning. | Harness proves no duplicate and no missing room-cell assignments after split and merge. | Candidate |
| `DGI-ROOM-003` | Room name owner | Default room name is `Raum <roomId>` unless an authored custom name exists. | Harness proves default, custom-name replacement, trimming, and reload-safe publication facts. | Candidate |
| `DGI-ROOM-004` | Room label facts | Room label placement is derived from room floor cells and the longest available wall run. | Harness proves deterministic placement for rectangular and non-rectangular room shapes. | Candidate |

## References

- [Dungeon Domain Architecture](../architecture/architecture-dungeon-domain.md)
- [Dungeon Domain](../domain/domain-dungeon.md)
- [Core Model Invariants](verification-dungeon-core-model-invariants.md)
- [Dungeon Editor Room Matrix](verification-dungeon-editor-rooms.md)
- [Dungeon Editor Label Matrix](verification-dungeon-editor-labels.md)
