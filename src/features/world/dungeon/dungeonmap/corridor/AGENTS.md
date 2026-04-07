# AGENTS.md

## Purpose

`corridor` owns standalone corridor aggregates, routed corridor topology, and corridor metadata persistence beneath `dungeonmap`.

## Canonical Types and APIs

- `model/Corridor` — top-level corridor aggregate that extends `Structure` with corridor-owned nodes, segments, attachments, and transient path traces derived from final structure plus graph metadata.
- `model/CorridorSpecification` — canonical corridor-authored payload — carries corridor-owned identity, level, nodes, and segments into create, reload, and re-resolve flows.
- `model/CorridorMutation` — fixed public corridor write vocabulary — names only corridor edits whose output is a new `Corridor`.
- `model/CorridorTopologyMutation` — fixed public corridor topology-delete vocabulary — names only deletes whose output is `CorridorTopologyUpdate`.
- `model/CorridorResolutionInput` — fixed corridor-external input contract — supplies blocked cells, room-exterior door facts, corridor-boundary attachment facts, occupied connection segments, and current corridor doors.
- `model/CorridorReconcileInput` — fixed room-rewrite contract — supplies affected room ids, before-or-after door facts, translations, level shifts, and updated resolution input for rebound workflows.
- `model/CorridorRouting` — canonical corridor routing helper — projects corridor graph links into routed structure and trace output and rehydrates transient traces back from persisted structure plus graph metadata without re-homing physical topology out of `structure`.
- `model/CorridorPathTrace`, `model/CorridorNode`, `model/CorridorSegment` — corridor-local authored topology values; `CorridorPathTrace` is the canonical translated trace carrier and composes ordered geometry only through `GridPath`.
- `model/Corridor.boundaryDoorBoundary()` — corridor-owned read projection — reports corridor boundary openings through the canonical `GridBoundary` carrier without requiring live external map context.
- `model/Corridor.touchesRoomAnchorCells(...)` — corridor-owned anchor guard — answers whether removed room-floor cells would orphan one of this corridor's room-bound anchors.
- `application/DungeonCorridorApplicationService` — public corridor workflow seam for corridor creation, room-door attachment, node or door movement, and topology deletion.
- `repository/DungeonCorridorRepository` — corridor row, node, and segment persistence seam; final topology persists only through `structure/repository`.

## Where New Code Goes

- Put corridor identity, graph topology, room attachment semantics, and corridor-local invariants on `Corridor`.
- Route public corridor create or reload flows through `Corridor.fromSpecification(...)` or `Corridor.rehydrated(...)`.
- Route public corridor edits through `corridor.mutated(...)`, `corridor.topologyUpdated(...)`, `corridor.validateReconcile(...)`, and `corridor.reconciled(...)`.
- Let `Corridor` own corridor-door deletion, boundary-opening reads, and room-anchor guard semantics; callers may select a boundary segment or room/cell set, but they must not translate that request into internal node deletion or node inspection themselves.
- Put reusable routed-trace derivation on `CorridorRouting`, not on layout, tools, or repositories.
- Keep shared physical corridor shape on canonical `Structure` values owned by the corridor aggregate instead of rebuilding separate corridor geometry mirrors.
- Let public corridor writes converge on `DungeonCorridorApplicationService`.
- Keep corridor persistence focused on corridor-local metadata only; routed traces stay transient and shared structure persistence still goes through `structure/repository`.

## Forbidden Drift

- Do not move corridor ownership back into `model/structures`, generic `model`, or editor tools.
- Do not mirror corridor routing or attachment truth onto `DungeonMap`, runtime helpers, or render payloads. `DungeonMap` may only materialize the fixed corridor input objects and orchestrate cross-owner reconcile flows.
- Do not add a second corridor mutation or persistence seam beside `Corridor`, `DungeonCorridorApplicationService`, and `DungeonCorridorRepository`.
- Do not pass raw `DungeonMap`, cluster, room, or repository context into `Corridor`; corridor-external state must enter only through `CorridorResolutionInput` or `CorridorReconcileInput`.
- Do not decode corridor room-anchor semantics in `DungeonMap`, cluster workflows, or shell code by iterating `corridor.nodes()` and inspecting door-bound nodes.
- Do not expose corridor-internal node or segment lookup helpers as public fallback APIs once the mutation vocabulary can express the same edit directly.
- Do not reintroduce persisted corridor path points or duplicate level columns when the final corridor topology already lives on `Structure`.
