Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-06-04
Source of Truth: Target invariant catalog for Dungeon Transition ownership proof.

# Dungeon Transition Invariants

## Purpose

This catalog defines target model-invariant proof obligations for authored
Dungeon transition ownership. A transition may use a bounded collection owner
when an invariant spans multiple transitions; generic connection managers are
not target owners.

Transition proof supplements Dungeon Editor and Dungeon Travel real-route
proof. A row is `Qualified` only when a named harness row proves the stated
invariant; until then it is a target obligation for the migration agent.

`Required Proof` names the eventual focused Transition family harness or
OwnerSuite row. This catalog does not create a new public gate; until such a
gate is explicitly added, proof may publish through the current aggregated
dungeon model, editor, or travel harness surface.

## Review Frame

This catalog is a target-model change derived from the Dungeon domain target
state and this catalog's candidate source-obligation rows. Reviewers must
evaluate whether the Transition owner is coherent, traceable, and safely
migratable. Do not block a row merely because current code keeps transition
behavior under `ConnectionCatalog`, `core/structure/transition`, or
`worldspace` structure.

## Proof Vocabulary

Required proof rows for this catalog must publish
`OwnerSuite=TransitionInvariantHarness`, `ProofType=ModelInvariant`, and the
invariant id. If the first implementation routes proof through the existing
aggregated dungeon harness surface, those fields still identify the Transition
family proof owner.

## Transition Invariant Catalog

`Candidate Source Obligation` entries derive from the Dungeon domain target
state and current proof index. They are migration obligations, not independent
domain truth. `Partial mechanics proof` means an existing row proves related
mechanics, while the target family owner remains unqualified. Transition uses
the `DGI-TRANSITION-*` id prefix to match the spelled family-name convention.

| Invariant ID | Target Owner | Candidate Source Obligation | Invariant | Required Proof | Current Status | Deferred/Out Of Scope |
| --- | --- | --- | --- | --- | --- | --- |
| `DGI-TRANSITION-001` | `Transition` | Transition is an authored component with stable local facts. | A transition owns id, map id, anchor cell, description, destination, and optional local link state with normalized defaults. | Harness proves null/invalid normalization, placed-state, description update, and destination replacement. | Qualified by `OwnerSuite=TransitionInvariantHarness`. | Persistence row mapping. |
| `DGI-TRANSITION-002` | Bounded transition collection | Link behavior can span multiple transitions. | Link replacement, reverse-link creation, and reverse-link cleanup are owned by a transition collection scoped to the authored map set being mutated. | Harness proves one-way and bidirectional link replacement plus cleanup of stale reverse links. | Qualified by `OwnerSuite=TransitionInvariantHarness`. | Cross-map repository transaction shape and transition-reference delete checks. |
| `DGI-TRANSITION-003` | Transition owner with `DungeonMap` topology coordination | Transition identity remains map-stable. | Transition operations preserve topology identity where the transition survives and release it only when deletion succeeds. | Harness proves create, description update, link update, protected reject, and delete identity behavior. | Target | Topology graph migration. |
| `DGI-TRANSITION-004` | Transition collection | Protected delete is transition-owned policy. | A transition cannot be deleted while it owns a link or is referenced by another transition destination/link. | Harness proves selected linked, reverse linked, and destination-reference delete rejection. | Qualified by `OwnerSuite=TransitionInvariantHarness`. | Real View route remains `DE-TRN-*`. |
| `DGI-TRANSITION-005` | Runtime travel projection over transition facts | Runtime may project transitions but must not own authored transition truth. | Travel transition targets are derived from core transition facts and stored only as runtime projection/session state. | Harness or travel proof shows travel actions recompute from authored transition facts without persisting runtime transition truth. | Target | Full travel UI behavior. |

## References

- [Dungeon Domain](../domain/domain-dungeon.md)
- [Core Model Invariants](verification-dungeon-core-model-invariants.md)
- [Dungeon Editor Stairs And Transitions Matrix](verification-dungeon-editor-stairs-transitions.md)
