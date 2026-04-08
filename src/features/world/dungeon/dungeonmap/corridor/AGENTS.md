# AGENTS.md

## Purpose

`corridor` owns standalone corridor aggregates, the persisted authored corridor input network, transient routed traces derived from that input, and corridor metadata persistence beneath `dungeonmap`.

## Canonical Types and APIs

- `model/Corridor` — top-level corridor aggregate that extends `Structure` with corridor-owned `CorridorInput` truth plus transient routed traces and connections derived from the input and final structure.
- `model/CorridorInput`, `model/CorridorInputNode`, `model/CorridorSegment` — canonical persisted corridor-authored input — describe the ordered node-and-segment network; each `CorridorSegment` owns endpoint resolution and local replanning between its two anchors.
- `model/CorridorResolutionInput` — fixed corridor-external input contract — supplies blocked cells, room-exterior door facts, and occupied connection segments needed to resolve authored corridor input.
- `model/CorridorReconcileInput` — fixed room-rewrite contract — supplies affected room ids, before-or-after door facts, translations, level shifts, and updated resolution input for rebound workflows.
- `model/CorridorRouting` — canonical segment-routing helper — provides stateless segment pathfinding and trace recovery helpers beneath `CorridorSegment`.
- `model/CorridorPathTrace` — transient routed corridor trace keyed by authored `segmentId`; composes ordered geometry only through `GridPath`.
- `model/Corridor.boundaryDoorBoundary()` — corridor-owned read projection — reports corridor boundary openings through the canonical `GridBoundary` carrier without requiring live external map context.
- `model/Corridor.touchesRoomAnchorCells(...)` — corridor-owned anchor guard — answers whether removed room-floor cells would orphan one of this corridor's room-bound anchors.
- `application/DungeonCorridorApplicationService` — public corridor workflow seam for corridor creation, room-door attachment, node or door movement, and topology deletion.
- `application/CorridorInputEditor` — canonical authored-network edit helper — applies graph edits, segment splits, and connected-component partitioning to `CorridorInput` before re-resolution.
- `repository/DungeonCorridorRepository` — corridor row, input-node, and input-segment persistence seam; final topology persists only through `structure/repository`.

## Where New Code Goes

- Put corridor identity, persisted authored input truth, room attachment semantics, and corridor-local invariants on `Corridor`.
- Route public corridor create or reload flows through `Corridor.fromInput(...)` or `Corridor.rehydrated(...)`.
- Route public corridor rewrites through `corridor.withInput(...)`, `corridor.validateReconcile(...)`, and `corridor.reconciled(...)`; graph-edit translation belongs on `CorridorInputEditor`, not on the aggregate.
- Let `Corridor` own corridor boundary-opening reads, room-anchor guard semantics, and authored input validation; callers may select a segment id or room/cell set, but they must not persist routed traces as owner truth.
- Put reusable segment-routing helpers on `CorridorRouting`, not on layout, tools, or repositories.
- Keep shared physical corridor shape on canonical `Structure` values owned by the corridor aggregate instead of rebuilding separate corridor geometry mirrors.
- Let public corridor writes converge on `DungeonCorridorApplicationService`.
- Keep corridor persistence focused on corridor-local input metadata only; routed traces stay transient and shared structure persistence still goes through `structure/repository`.

## Forbidden Drift

- Do not move corridor ownership back into `model/structures`, generic `model`, or editor tools.
- Do not mirror corridor routing or attachment truth onto `DungeonMap`, runtime helpers, or render payloads. `DungeonMap` may only materialize the fixed corridor input objects and orchestrate cross-owner reconcile flows.
- Do not add a second corridor mutation or persistence seam beside `Corridor`, `DungeonCorridorApplicationService`, and `DungeonCorridorRepository`.
- Do not pass raw `DungeonMap`, cluster, room, or repository context into `Corridor`; corridor-external state must enter only through `CorridorResolutionInput` or `CorridorReconcileInput`.
- Do not decode corridor room-anchor semantics in `DungeonMap`, cluster workflows, or shell code by iterating `corridor.nodes()` and inspecting door-bound nodes.
- Do not expose routed trace ids or ad-hoc topology projections as persisted owner truth; stable public edit refs must target authored node and segment ids from `CorridorInput`.
- Do not reintroduce member-, waypoint-, root-terminal-, or path-point persistence when the authored corridor truth is already a node-and-segment input network and the final corridor topology already lives on `Structure`.
