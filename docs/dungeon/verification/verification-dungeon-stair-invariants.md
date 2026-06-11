Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-06-07
Source of Truth: Target invariant catalog for Dungeon Stair ownership proof.

# Dungeon Stair Invariants

## Purpose

This catalog defines target model-invariant proof obligations for authored
stair creation, geometry recompute, path/exits, binding, and rejection policy.
It supplements editor real-route proof and does not close `DE-*` rows by
itself.

Required proof rows publish `OwnerSuite=StairInvariantHarness`,
`ProofType=ModelInvariant`, and the invariant id.

## Stair Invariant Catalog

| Invariant ID | Target Owner | Invariant | Required Proof | Current Status |
| --- | --- | --- | --- | --- |
| `DGI-STAIR-001` | Stair structure | Supported editor shapes create deterministic path cells and generated exits from one `StairGeometrySpec`. | Harness proves straight, square, and circular supported shape construction. | Qualified by current structure/path proof; split OwnerSuite pending. |
| `DGI-STAIR-002` | Stair structure | Full geometry recompute preserves stair id and topology ref while replacing path/exits atomically. | Harness proves shape, direction, dimension, and exit-span recompute cases. | Qualified by current structure/path proof; split OwnerSuite pending. |
| `DGI-STAIR-003` | Stair validation owner | Invalid shape, direction, dimensions, duplicate path cells, and room-interior crossings reject without partial mutation. | Harness proves prior stair, path, exits, selection, and preview remain unchanged. | Qualified by current structure/path proof; split OwnerSuite pending. |
| `DGI-STAIR-004` | Stair binding owner | Corridor-bound stairs cannot be deleted independently and must preserve owning corridor continuity. | `StairInvariantHarness` proves protected direct delete through `StairCollection`/`DungeonMap` and valid corridor-owned removal through the corridor owner path. | Qualified |

## References

- [Dungeon Domain Architecture](../architecture/architecture-dungeon-domain.md)
- [Dungeon Domain](../domain/domain-dungeon.md)
- [Core Model Invariants](verification-dungeon-core-model-invariants.md)
- [Dungeon Editor Stair Matrix](verification-dungeon-editor-stairs.md)
