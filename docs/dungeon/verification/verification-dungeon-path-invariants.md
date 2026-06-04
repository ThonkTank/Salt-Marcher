Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-06-04
Source of Truth: Target invariant catalog for Dungeon Path ownership proof.

# Dungeon Path Invariants

## Purpose

This catalog defines target model-invariant proof obligations for authored
Dungeon path ownership. It allows shared passive path primitives, but it does
not define one global path manager for all dungeon movement.

Path proof supplements Dungeon Editor and Dungeon Travel real-route proof. A
row is `Qualified` only when a named harness row proves the stated invariant;
until then it is a target obligation for the migration agent.

`Required Proof` names the eventual focused Path family harness or OwnerSuite
row. This catalog does not create a new public gate; until such a gate is
explicitly added, proof may publish through the current aggregated dungeon
model, editor, or travel harness surface.

## Review Frame

This catalog is a target-model change derived from the Dungeon domain target
state and this catalog's candidate source-obligation rows. Reviewers must
evaluate whether the Path owners are coherent, traceable, and safely
migratable. Do not block a row merely because current code keeps route behavior
under corridor, stair, runtime, or `worldspace` structure.

## Proof Vocabulary

Required proof rows for this catalog must publish
`OwnerSuite=PathInvariantHarness`, `ProofType=ModelInvariant`, and the
invariant id. If the first implementation routes proof through the existing
aggregated dungeon harness surface, those fields still identify the Path family
proof owner.

## Path Invariant Catalog

`Candidate Source Obligation` entries derive from the Dungeon domain target
state and current proof index. They are migration obligations, not independent
domain truth. `Partial mechanics proof` means an existing row proves related
mechanics, while the target family owner remains unqualified.

| Invariant ID | Target Owner | Candidate Source Obligation | Invariant | Required Proof | Current Status | Deferred/Out Of Scope |
| --- | --- | --- | --- | --- | --- | --- |
| `DGI-PATH-001` | Shared passive path primitives | Common dungeon path shape should not be duplicated. | Shared path primitives own cell/edge sequence normalization, ordering, and passive path inspection only; they do not own corridor, stair, wall, or travel policy. | Harness proves primitive normalization and absence of owner-specific policy methods. | Target | Owner-specific path decisions. |
| `DGI-PATH-002` | `CorridorPathMap` or equivalent corridor-local path owner | A corridor composes one path owner. | Corridor route cells, route validation, route split planning, waypoint insertion, and route no-op detection are owned by the corridor path owner. | Harness proves a door-to-door route, blocked route rejection, split route anchor planning, and unchanged route no-op through the path owner. | Target | Stable topology identity. |
| `DGI-PATH-003` | Stair path owner | Stair generated paths are authored path behavior. | Stair path cells, generated exits, dimension-derived path shape, and readable path invariants are owned by the stair path owner or stair structure through shared path primitives. | Harness proves generated path uniqueness, exit placement, and invalid room-interior crossing rejection. | Partial mechanics proof by current `DGI-STR-006`; target path owner unqualified. | State-panel real-route proof. |
| `DGI-PATH-004` | Boundary or wall path owner | Boundary drawing/deletion paths are authored wall-path behavior. | Boundary pathfinding uses wall/floor facts and shared primitives, while wall-specific commit/delete policy stays with the wall owner. | Harness proves create-path and delete-path derivation without runtime-only ownership of authored path policy. | Target | UI pointer route mechanics. |
| `DGI-PATH-005` | Runtime travel projection over core path/graph facts | Runtime may project path facts but must not own authored path truth. | Travel traversal planning consumes core path/graph/transition facts and owns only transient travel session or projection state. | Harness or travel proof shows traversal actions can be recomputed from core-authored facts without persisting runtime path truth. | Target | Full travel UI behavior. |

## References

- [Dungeon Domain](../domain/domain-dungeon.md)
- [Core Model Invariants](verification-dungeon-core-model-invariants.md)
- [Dungeon Travel Requirements](../requirements/requirements-dungeon-travel.md)
