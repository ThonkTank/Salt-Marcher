Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-06-08
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
| `DGI-ROOM-001` | `Room` | Room identity and narration survive cluster edits when the room remains represented. | Current proof covers wall-run identity survival through `ProofType=RealRoute`; complete model-invariant coverage for all mutation families remains absent. | Partial |
| `DGI-ROOM-002` | Room collection or partition owner | Every floor-owned room cell is assigned to exactly one room after closed-boundary partitioning. | Existing structure/floor invariant proof remains the owning evidence; this Wave 3 slice did not add a room invariant harness row. | Partial |
| `DGI-ROOM-003` | Room name owner | Default room name is `Raum <roomId>` unless an authored custom name exists. | Current proof covers default and custom-name readback/render through the shared label-name use case; state-panel room selection remains unqualified. | Partial |
| `DGI-ROOM-004` | Room label facts | Room label placement is derived from room floor cells; longest-wall orientation remains future work. | Current proof covers deterministic rendered room-label presence from room floor cells through `ProofType=RealRoute`; longest-wall model proof remains absent. | Partial |

## References

- [Dungeon Domain Architecture](../architecture/architecture-dungeon-domain.md)
- [Dungeon Domain](../domain/domain-dungeon.md)
- [Core Model Invariants](verification-dungeon-core-model-invariants.md)
- [Dungeon Editor Room Matrix](verification-dungeon-editor-rooms.md)
- [Dungeon Editor Label Matrix](verification-dungeon-editor-labels.md)
