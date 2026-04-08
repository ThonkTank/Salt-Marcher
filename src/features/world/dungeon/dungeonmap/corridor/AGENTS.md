# Corridor Owner

## Purpose

`corridor` owns standalone corridor aggregates, the persisted authored corridor input network, transient routed traces derived from that input, and corridor metadata persistence beneath `dungeonmap`.

## Canonical Types and APIs

- `CorridorObject` — public root owner seam for corridor-owned structures.
- `Corridor`, `CorridorInput`, `CorridorInputNode`, `CorridorSegment` — canonical corridor aggregate and authored input network.
- `CorridorResolutionInput` and `CorridorReconcileInput` — fixed external contracts for map-owned resolution and room-rewrite reconciliation.
- `CorridorInputEditor`, `CorridorRouting`, `CorridorPathTrace` — corridor-local edit, routing, and transient trace helpers.
- `DungeonCorridorApplicationService` — public corridor workflow seam for create, attach, move, and delete flows.
- `DungeonMapApplicationService` — map-owned companion seam for resolve, rehydrate, and preview workflows that require authoritative map facts.
- `DungeonCorridorRepository` — corridor-owned input persistence seam.

## Where New Code Goes

- Put public cross-owner corridor access on `CorridorObject` and keep corridor identity, authored input truth, room attachment semantics, and corridor-local invariants on `Corridor`.
- Route public create and reload flows through the map-owned resolve/rehydrate seams instead of constructing a corridor directly from ad-hoc map context.
- Route authored-network rewrites through `Corridor` and `CorridorInputEditor`; keep routed traces transient and derived.
- Keep corridor persistence focused on authored input metadata and referenced final structure state.

## Forbidden Drift

- Do not pass raw `DungeonMap`, cluster, room, or repository context into `Corridor`; corridor-external state enters only through the fixed resolution/reconcile inputs.
- Do not add a second corridor mutation or persistence seam beside `Corridor`, `DungeonCorridorApplicationService`, and `DungeonCorridorRepository`.
- Do not expose routed trace ids, raw routing helper records, or ad-hoc topology projections as persisted owner truth.
- Do not reintroduce member-, waypoint-, root-terminal-, or path-point persistence when the authored corridor truth is already the node-and-segment input network.
