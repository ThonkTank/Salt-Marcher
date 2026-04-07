# AGENTS.md

## Purpose

`corridor` owns standalone corridor aggregates, routed corridor topology, and corridor persistence beneath `dungeonmap`.

## Canonical Types and APIs

- `model/Corridor` — top-level corridor aggregate over canonical `Structure` truth plus corridor-owned nodes, segments, attachments, and path traces.
- `model/CorridorRouting` — canonical corridor routing helper — projects corridor graph links into routed structure and trace output without re-homing physical topology out of `structure`.
- `model/CorridorPathTrace`, `model/CorridorNode`, `model/CorridorSegment` — corridor-local authored topology values.
- `application/DungeonCorridorApplicationService` — public corridor workflow seam for corridor creation, room-door attachment, node or door movement, and topology deletion.
- `repository/DungeonCorridorRepository` — corridor row, node, segment, and routed path persistence seam.

## Where New Code Goes

- Put corridor identity, graph topology, room attachment semantics, and corridor-local invariants on `Corridor`.
- Put reusable routed-trace derivation on `CorridorRouting`, not on layout, tools, or repositories.
- Keep shared physical corridor shape on canonical `Structure` values owned by the corridor aggregate instead of rebuilding separate corridor geometry mirrors.
- Let public corridor writes converge on `DungeonCorridorApplicationService`.
- Keep corridor persistence focused on corridor-local metadata and routed traces; shared structure persistence still goes through `structure/repository`.

## Forbidden Drift

- Do not move corridor ownership back into `model/structures`, generic `model`, or editor tools.
- Do not mirror corridor routing or attachment truth onto `DungeonLayout`, runtime helpers, or render payloads.
- Do not add a second corridor mutation or persistence seam beside `Corridor`, `DungeonCorridorApplicationService`, and `DungeonCorridorRepository`.
