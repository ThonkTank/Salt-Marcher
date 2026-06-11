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
invariant id. Editor real-route rows may supplement those owner rows, but
real-route coverage alone does not satisfy a model-invariant obligation.

## Corridor Invariant Catalog

| Invariant ID | Target Owner | Invariant | Required Proof | Current Status |
| --- | --- | --- | --- | --- |
| `DGI-CORRIDOR-001` | Corridor draft or interaction state | Pending corridor endpoints are preview/session state and do not create authored endpoint rows before full commit. | `CorridorInvariantHarness` proves the production corridor draft/session owner stores first-click target state without create preview, apply preview, or authored endpoint materialization; `DE-COR-012` supplies real-route coverage for explicit door, generic room, and generic corridor starts. | Qualified |
| `DGI-CORRIDOR-002` | Corridor endpoint owner | Generic room and corridor hits resolve to concrete authored endpoints only at successful commit. | `CorridorInvariantHarness` proves concrete door and anchor endpoint owner APIs plus generic-corridor anchor materialization/reuse/rejection mechanics; `DE-COR-013` supplies full real-route commit, SQLite, topology, snapshot, reload, and render proof for generic room/corridor hits. | Qualified |
| `DGI-CORRIDOR-003` | Corridor route owner | Corridor route cells and split points are deterministic for the committed endpoint pair. | `CorridorInvariantHarness` proves straight, turned, blocked, and crossing-anchor waypoint/ref route owner mechanics. | Qualified |
| `DGI-CORRIDOR-004` | Corridor deletion owner | Deleting a point or door branch preserves unaffected branches and rejects invalid replacement routes without partial mutation. | `CorridorInvariantHarness` proves point delete, endpoint branch delete, protected whole-corridor delete, detached-anchor pruning mechanics, and invalid replacement-route rejection before mutation through the corridor deletion owner. | Qualified |

## References

- [Dungeon Domain Architecture](../architecture/architecture-dungeon-domain.md)
- [Dungeon Domain](../domain/domain-dungeon.md)
- [Core Model Invariants](verification-dungeon-core-model-invariants.md)
- [Dungeon Editor Corridor Matrix](verification-dungeon-editor-corridors.md)
