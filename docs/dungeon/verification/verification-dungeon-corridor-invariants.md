Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-06-08
Source of Truth: Target invariant catalog for Dungeon Corridor ownership proof.

# Dungeon Corridor Invariants

## Purpose

This catalog defines target model-invariant proof obligations for authored
corridor drafting, endpoint materialization, route ownership, and deletion
policy. It supplements editor real-route proof and does not close `DE-*` rows
by itself.

Qualified owner-suite proof rows publish
`OwnerSuite=CorridorInvariantHarness`, `ProofType=ModelInvariant`, and the
invariant id. Explicitly Partial rows that cite editor real-route coverage
without separate corridor owner/API model proof may publish
`ProofType=CrossCatalogReference`; those rows do not satisfy the Qualified
model-invariant obligation.

## Corridor Invariant Catalog

| Invariant ID | Target Owner | Invariant | Required Proof | Current Status |
| --- | --- | --- | --- | --- |
| `DGI-CORRIDOR-001` | Corridor draft or interaction state | Pending corridor endpoints are preview/session state and do not create authored endpoint rows before full commit. | `DE-COR-012` real-route proof covers explicit door, generic room, and generic corridor starts without authored side effects; no separate production corridor draft owner/API model proof exists yet. | Partial |
| `DGI-CORRIDOR-002` | Corridor endpoint owner | Generic room and corridor hits resolve to concrete authored endpoints only at successful commit. | `CorridorInvariantHarness` proves concrete door and anchor endpoint owner APIs plus generic-corridor anchor materialization/reuse/rejection mechanics; `DE-COR-013` supplies full real-route commit, SQLite, topology, snapshot, reload, and render proof for generic room/corridor hits. | Qualified |
| `DGI-CORRIDOR-003` | Corridor route owner | Corridor route cells and split points are deterministic for the committed endpoint pair. | `CorridorInvariantHarness` proves straight, turned, blocked, and crossing-anchor waypoint/ref route owner mechanics. | Qualified |
| `DGI-CORRIDOR-004` | Corridor deletion owner | Deleting a point or door branch preserves unaffected branches and rejects invalid replacement routes without partial mutation. | `CorridorInvariantHarness` proves point delete, endpoint branch delete, protected whole-corridor delete, and detached-anchor pruning mechanics; invalid replacement-route rejection remains real-route only and is not yet full owner/API proof. | Partial |

## References

- [Dungeon Domain Architecture](../architecture/architecture-dungeon-domain.md)
- [Dungeon Domain](../domain/domain-dungeon.md)
- [Core Model Invariants](verification-dungeon-core-model-invariants.md)
- [Dungeon Editor Corridor Matrix](verification-dungeon-editor-corridors.md)
