Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-06-07
Source of Truth: Target invariant catalog for Dungeon Corridor ownership proof.

# Dungeon Corridor Invariants

## Purpose

This catalog defines target model-invariant proof obligations for authored
corridor drafting, endpoint materialization, route ownership, and deletion
policy. It supplements editor real-route proof and does not close `DE-*` rows
by itself.

Required proof rows publish `OwnerSuite=CorridorInvariantHarness`,
`ProofType=ModelInvariant`, and the invariant id.

## Corridor Invariant Catalog

| Invariant ID | Target Owner | Invariant | Required Proof | Current Status |
| --- | --- | --- | --- | --- |
| `DGI-CORRIDOR-001` | Corridor draft or interaction state | Pending corridor endpoints are preview/session state and do not create authored endpoint rows before full commit. | Harness proves first endpoint selection has no authored door, anchor, corridor, route, or topology side effects. | Candidate |
| `DGI-CORRIDOR-002` | Corridor endpoint owner | Generic room and corridor hits resolve to concrete authored endpoints only at successful commit. | Harness proves atomic door or anchor materialization with commit and no materialization on rejection. | Candidate |
| `DGI-CORRIDOR-003` | Corridor route owner | Corridor route cells and split points are deterministic for the committed endpoint pair. | Harness proves straight, turned, crossing, and blocked route outcomes. | Candidate |
| `DGI-CORRIDOR-004` | Corridor deletion owner | Deleting a point or door branch preserves unaffected branches and rejects invalid replacement routes without partial mutation. | Harness proves point delete, endpoint branch delete, protected whole-corridor delete, and invalid reroute rejection. | Candidate |

## References

- [Dungeon Domain Architecture](../architecture/architecture-dungeon-domain.md)
- [Dungeon Domain](../domain/domain-dungeon.md)
- [Core Model Invariants](verification-dungeon-core-model-invariants.md)
- [Dungeon Editor Corridor Matrix](verification-dungeon-editor-corridors.md)
