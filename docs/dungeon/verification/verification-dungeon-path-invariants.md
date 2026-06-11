Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-06-07
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
under corridor, stair, runtime, or aggregate structure.

## Proof Vocabulary

Required proof rows for this catalog must publish
`OwnerSuite=PathInvariantHarness`, `ProofType=ModelInvariant`, and the
invariant id. If the first implementation routes proof through the existing
aggregated dungeon harness surface, those fields still identify the Path family
proof owner. The runtime projection row may instead publish
`OwnerSuite=RuntimeProjectionInvariantHarness` because it proves that runtime
travel projection consumes authored Path facts without owning Path truth.

## Path Invariant Catalog

`Candidate Source Obligation` entries derive from the Dungeon domain target
state and current proof index. They are migration obligations, not independent
domain truth. All active rows below are either qualified by the named
OwnerSuite or explicitly marked as cross-catalog references.

| Invariant ID | Target Owner | Candidate Source Obligation | Invariant | Required Proof | Current Status | Deferred/Out Of Scope |
| --- | --- | --- | --- | --- | --- | --- |
| `DGI-PATH-001` | Shared passive path primitives | Common dungeon path shape should not be duplicated. | Shared path primitives own cell/edge sequence normalization, ordering, and passive path inspection only; they do not own corridor, stair, wall, or travel policy. | Harness proves primitive normalization, missing-endpoint behavior, and passive route copy behavior. | Qualified by `OwnerSuite=PathInvariantHarness`. | Owner-specific path decisions. |
| `DGI-PATH-002` | `CorridorRoute` and `CorridorRoutePlan` | A corridor composes one path owner. | Corridor route cells, route validation, route split planning, waypoint insertion, and route no-op detection are owned by corridor-local route owners. | Harness proves endpoint route derivation, blocked route rejection, split route anchor planning, and unchanged route no-op through the path owner. | Qualified by `OwnerSuite=PathInvariantHarness`. | Stable topology identity. |
| `DGI-PATH-003` | Stair path owner | Stair generated paths are authored path behavior. | Stair path cells, generated exits, dimension-derived path shape, and readable path invariants are owned by stair structure through shared path primitives. | Harness proves generated path cells, exit placement, readability, occupancy, and room-interior crossing rejection. | Qualified by `OwnerSuite=PathInvariantHarness`. | State-panel real-route proof. |
| `DGI-PATH-004` | Boundary or wall path owner | Boundary drawing/deletion paths are authored wall-path behavior. | Boundary pathfinding uses wall/floor facts and shared primitives, while wall-specific commit/delete policy stays with the wall owner. | Harness proves wall-owned connector-path derivation from floor and wall facts without runtime-only ownership of authored path policy. | Qualified by `OwnerSuite=PathInvariantHarness`. | UI pointer route mechanics. |
| `DGI-PATH-005` | Runtime travel projection over core path/graph facts | Runtime may project path facts but must not own authored path truth. | Travel traversal planning consumes core path/graph/transition facts and owns only transient travel session or projection state. | Harness proves traversal actions can be recomputed from core-authored area and boundary facts without persisting runtime path truth. | Qualified by `OwnerSuite=RuntimeProjectionInvariantHarness`. | Full travel UI behavior. |
| `DGI-PATH-006` | Production wall-draft path owner | Wall-create drafts can include intermediate points before final commit. | Deterministic segment accumulation is a target path/draft-owner obligation; local list mechanics alone do not qualify owner proof. | Harness exercises the production draft/path owner API for start, intermediate point, completion candidate, and cancel/no-op facts. | Qualified by `OwnerSuite=PathInvariantHarness`. | Wall owner owns final wall/open mutation. |
| `DGI-PATH-007` | Cross-reference to wall owner (`DGI-WALL-008`) | Wall-delete targets expand to contiguous straight runs. | Wall-run delete expansion is wall-owner behavior, not a Path OwnerSuite invariant. | No Path OwnerSuite proof row; qualified wall-owner proof lives in `DGI-WALL-008`. | Cross-reference only; not qualified in this catalog. | Exterior protection remains Wall/Cluster policy. |

## References

- [Dungeon Domain Architecture](../architecture/architecture-dungeon-domain.md)
- [Dungeon Domain](../domain/domain-dungeon.md)
- [Core Model Invariants](verification-dungeon-core-model-invariants.md)
- [Dungeon Travel Requirements](../requirements/requirements-dungeon-travel.md)
