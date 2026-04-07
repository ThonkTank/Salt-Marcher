# AGENTS.md

## Purpose

`corridor` owns standalone corridor aggregates, persisted authored corridor drafts, routed corridor topology, and corridor metadata persistence beneath `dungeonmap`.

## Canonical Types and APIs

- `model/Corridor` — top-level corridor aggregate that extends `Structure` with corridor-owned draft truth plus transient nodes, segments, and path traces derived from the draft and final structure.
- `model/CorridorDraft`, `model/CorridorMember`, `model/CorridorWaypoint`, `model/CorridorTerminal` — canonical persisted corridor-authored input — carry corridor-owned identity, branch membership, shape control points, and endpoint truth into create, reload, and re-resolve flows.
- `model/CorridorMutation` — fixed public corridor write vocabulary — names only corridor edits whose output is a new `Corridor`.
- `model/CorridorResolutionInput` — fixed corridor-external input contract — supplies blocked cells, room-exterior door facts, corridor-boundary attachment facts, occupied connection segments, and current corridor doors.
- `model/CorridorReconcileInput` — fixed room-rewrite contract — supplies affected room ids, before-or-after door facts, translations, level shifts, and updated resolution input for rebound workflows.
- `model/CorridorRouting` — canonical corridor routing helper — projects transient corridor graph links into routed structure and trace output and rehydrates transient traces back from persisted structure plus derived graph metadata without re-homing physical topology out of `structure`.
- `model/CorridorPathTrace`, `model/CorridorNode`, `model/CorridorSegment` — transient corridor graph values derived from the persisted draft; `CorridorPathTrace` is the canonical translated trace carrier and composes ordered geometry only through `GridPath`.
- `model/Corridor.boundaryDoorBoundary()` — corridor-owned read projection — reports corridor boundary openings through the canonical `GridBoundary` carrier without requiring live external map context.
- `model/Corridor.touchesRoomAnchorCells(...)` — corridor-owned anchor guard — answers whether removed room-floor cells would orphan one of this corridor's room-bound anchors.
- `application/DungeonCorridorApplicationService` — public corridor workflow seam for corridor creation, room-door attachment, waypoint or door movement, and topology deletion.
- `application/CorridorDraftPlanner` — canonical topology-delete planner — cuts transient graph state back into one or more persisted corridor drafts and resolution requests.
- `repository/DungeonCorridorRepository` — corridor row, member, and waypoint persistence seam; final topology persists only through `structure/repository`.

## Where New Code Goes

- Put corridor identity, persisted draft truth, room attachment semantics, and corridor-local invariants on `Corridor`.
- Route public corridor create or reload flows through `Corridor.fromDraft(...)` or `Corridor.rehydrated(...)`.
- Route public corridor edits through `corridor.mutated(...)`, `corridor.validateReconcile(...)`, and `corridor.reconciled(...)`; topology delete planning belongs on `CorridorDraftPlanner`, not on the aggregate.
- Let `Corridor` own corridor boundary-opening reads, room-anchor guard semantics, and authored draft mutation; callers may select a boundary segment or room/cell set, but they must not persist graph nodes or segments as owner truth.
- Put reusable routed-trace derivation on `CorridorRouting`, not on layout, tools, or repositories.
- Keep shared physical corridor shape on canonical `Structure` values owned by the corridor aggregate instead of rebuilding separate corridor geometry mirrors.
- Let public corridor writes converge on `DungeonCorridorApplicationService`.
- Keep corridor persistence focused on corridor-local draft metadata only; routed traces, nodes, and segments stay transient and shared structure persistence still goes through `structure/repository`.

## Forbidden Drift

- Do not move corridor ownership back into `model/structures`, generic `model`, or editor tools.
- Do not mirror corridor routing or attachment truth onto `DungeonMap`, runtime helpers, or render payloads. `DungeonMap` may only materialize the fixed corridor input objects and orchestrate cross-owner reconcile flows.
- Do not add a second corridor mutation or persistence seam beside `Corridor`, `DungeonCorridorApplicationService`, and `DungeonCorridorRepository`.
- Do not pass raw `DungeonMap`, cluster, room, or repository context into `Corridor`; corridor-external state must enter only through `CorridorResolutionInput` or `CorridorReconcileInput`.
- Do not decode corridor room-anchor semantics in `DungeonMap`, cluster workflows, or shell code by iterating `corridor.nodes()` and inspecting door-bound nodes.
- Do not expose corridor-internal graph ids as persisted owner truth; stable public edit refs must target authored members or waypoints.
- Do not reintroduce persisted corridor path points, graph nodes, graph segments, or duplicate level columns when the final corridor topology already lives on `Structure`.
