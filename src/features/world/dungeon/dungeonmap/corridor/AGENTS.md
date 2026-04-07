# AGENTS.md

## Purpose

`corridor` owns standalone corridor aggregates, routed corridor topology, and corridor persistence beneath `dungeonmap`.

## Canonical Types and APIs

- `model/Corridor` — top-level corridor aggregate that extends `Structure` with corridor-owned nodes, segments, attachments, and path traces.
- `model/CorridorSpecification` — canonical corridor-authored payload — carries corridor-owned identity, level, nodes, and segments into create, reload, and re-resolve flows.
- `model/CorridorMutation` — fixed public corridor write vocabulary — names the supported node, door, attachment, and topology edits, including boundary-addressed corridor-door deletion, instead of exposing internal helpers.
- `model/CorridorResolutionInput` — fixed corridor-external input contract — supplies blocked cells, room-exterior door facts, corridor-boundary attachment facts, occupied connection segments, and current corridor doors.
- `model/CorridorReconcileInput` — fixed room-rewrite contract — supplies affected room ids, before-or-after door facts, translations, level shifts, and updated resolution input for rebound workflows.
- `model/CorridorRouting` — canonical corridor routing helper — projects corridor graph links into routed structure and trace output without re-homing physical topology out of `structure`.
- `model/CorridorPathTrace`, `model/CorridorNode`, `model/CorridorSegment` — corridor-local authored topology values.
- `model/Corridor.boundaryDoorSegments()` — corridor-owned read projection — reports corridor boundary openings without requiring live external map context.
- `application/DungeonCorridorApplicationService` — public corridor workflow seam for corridor creation, room-door attachment, node or door movement, and topology deletion.
- `repository/DungeonCorridorRepository` — corridor row, node, segment, and routed path persistence seam.

## Where New Code Goes

- Put corridor identity, graph topology, room attachment semantics, and corridor-local invariants on `Corridor`.
- Route public corridor create or reload flows through `Corridor.fromSpecification(...)` or `Corridor.rehydrated(...)`.
- Route public corridor edits through `corridor.mutated(...)`, `corridor.topologyUpdated(...)`, `corridor.validateReconcile(...)`, and `corridor.reconciled(...)`.
- Let `Corridor` own corridor-door deletion and boundary-opening reads; callers may select a boundary segment, but they must not translate that request into internal node deletion themselves.
- Put reusable routed-trace derivation on `CorridorRouting`, not on layout, tools, or repositories.
- Keep shared physical corridor shape on canonical `Structure` values owned by the corridor aggregate instead of rebuilding separate corridor geometry mirrors.
- Let public corridor writes converge on `DungeonCorridorApplicationService`.
- Keep corridor persistence focused on corridor-local metadata and routed traces; shared structure persistence still goes through `structure/repository`.

## Forbidden Drift

- Do not move corridor ownership back into `model/structures`, generic `model`, or editor tools.
- Do not mirror corridor routing or attachment truth onto `DungeonMap`, runtime helpers, or render payloads. `DungeonMap` may only materialize the fixed corridor input objects and orchestrate cross-owner reconcile flows.
- Do not add a second corridor mutation or persistence seam beside `Corridor`, `DungeonCorridorApplicationService`, and `DungeonCorridorRepository`.
- Do not pass raw `DungeonMap`, cluster, room, or repository context into `Corridor`; corridor-external state must enter only through `CorridorResolutionInput` or `CorridorReconcileInput`.
- Do not expose corridor-internal node or segment lookup helpers as public fallback APIs once the mutation vocabulary can express the same edit directly.
