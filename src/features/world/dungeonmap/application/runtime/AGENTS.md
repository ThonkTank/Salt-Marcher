# AGENTS.md

This file covers `src/features/world/dungeonmap/application/runtime/`.
Use it together with the parent `dungeonmap/AGENTS.md` and the repository root `AGENTS.md`.

## Ownership

- `DungeonRuntimeApplicationService` owns runtime navigation workflows, tile-only campaign-state persistence, and repair of persisted runtime state.
- `description/` owns runtime description projections only. These types assemble inspector/travel/overlay payloads from direct owners and must not become new canonical truth.

## Description Projections

- `DungeonRuntimeDescriptionResolver` is the single public seam that resolves runtime context into one description object for the current location.
- Package-private builders in `description/` may format room, corridor, stair, and transition descriptions, but they must read room narration from `Room`, exit descriptors from `DungeonLayout`, and connection semantics from `Connection`.
- `DungeonRuntimeDescription`, `DungeonRuntimeDescriptionRef`, and `DungeonRuntimeExit` are shared runtime projection payloads. They are not alternate model objects and they must stay free of write logic.
- `DungeonRuntimeAction` stays in `application/runtime/` because it is executable runtime workflow data, not a description-only concern.
