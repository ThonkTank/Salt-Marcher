# Corridor Owner

## Purpose

`corridor` owns standalone corridor aggregates, the persisted authored corridor input network, transient routed traces derived from that input, and corridor metadata persistence beneath `dungeonmap`.

## Canonical Types and APIs

- `CorridorObject` — public root owner seam for corridor-owned structures.
- `state/PersistReboundCorridorsState` — passive corridor-owned rebound staging state — carries the authored input network and persisted ids needed for a future canonical rebound persistence boundary.
- `repository/PersistReboundCorridorsRepository` — canonical corridor-owned rebound metadata persistence boundary — persists only corridor rows plus input-network metadata from `PersistReboundCorridorsState`, leaving structure persistence outside the slice.
- `Corridor`, `CorridorInput`, `CorridorInputNode`, `CorridorSegment` — canonical corridor aggregate and authored input network.
- `CorridorResolutionInput` and `CorridorReconcileInput` — fixed external contracts for map-owned resolution and room-rewrite reconciliation.
- `CorridorInputEditor`, `CorridorRouting`, `CorridorPathTrace` — corridor-local edit, routing, and transient trace helpers.
- `DungeonCorridorApplicationService` — legacy internal corridor workflow collaborator used by current create, attach, move, and delete flows. Keep it behind corridor-owned seams; do not treat `application/` as placement precedent for new touched code.
- `DungeonMapApplicationService` — legacy map-owned companion collaborator for resolve, rehydrate, and preview workflows that require authoritative map facts.
- `DungeonCorridorRepository` — corridor-owned input persistence seam.

## Where New Code Goes

- Put public cross-owner corridor access on `CorridorObject` and keep corridor identity, authored input truth, room attachment semantics, and corridor-local invariants on `Corridor`.
- Route public create and reload flows through the map-owned resolve/rehydrate seams instead of constructing a corridor directly from ad-hoc map context.
- Route authored-network rewrites through `Corridor` and `CorridorInputEditor`; keep routed traces transient and derived.
- Stage future rebound-tail persistence on `PersistReboundCorridorsState` instead of adding more room-rewrite fallout directly to legacy map-owned rebound paths.
- Keep the successor rebound repository metadata-only until structure persistence has its own clean handoff; do not smuggle structure writes back through the new corridor rebound boundary.
- Keep corridor persistence focused on authored input metadata and referenced final structure state.
- When touching existing corridor application collaborators, keep them behind corridor- or map-owned seams and avoid extending `application/` as a new owner-layer destination.

## Forbidden Drift

- Do not pass raw `DungeonMap`, cluster, room, or repository context into `Corridor`; corridor-external state enters only through the fixed resolution/reconcile inputs.
- Do not add a second corridor mutation or persistence seam beside `Corridor` and `DungeonCorridorRepository`, and do not promote legacy application collaborators into new public placement precedent.
- Do not expose routed trace ids, raw routing helper records, or ad-hoc topology projections as persisted owner truth.
- Do not reintroduce member-, waypoint-, root-terminal-, or path-point persistence when the authored corridor truth is already the node-and-segment input network.
