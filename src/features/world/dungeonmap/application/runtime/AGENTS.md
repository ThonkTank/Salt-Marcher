# AGENTS.md

This file covers `src/features/world/dungeonmap/application/runtime/`.
Use it together with the parent `dungeonmap/AGENTS.md` and the repository root `AGENTS.md`.

## Ownership

- `DungeonRuntimeApplicationService` owns runtime navigation workflows, tile-only campaign-state persistence, and repair of persisted runtime state.
- `DungeonRuntimeLocation` owns the shared parsed runtime location used by runtime assembly. Resolve the active structure once, then fan out from that context instead of reparsing layout ownership at each UI sink.
- `DungeonRuntimeActionResolver` owns executable runtime action assembly. It consumes the shared parsed runtime location plus the resolved `DungeonRuntimeExit` list only, without turning `description/` into a workflow owner or reading description copy back into actions.
- `description/` owns runtime description projections only. These types write inspector and overlay description payloads from direct owners and must not become new canonical truth.

## Description Projections

- `DungeonRuntimeDescriptionResolver` is the single public seam that writes one description object for the current location from the shared parsed runtime location.
- Package-private builders in `description/` may format room, corridor, stair, and transition descriptions, but they must read room narration from `Room`, exit descriptors from `DungeonLayout`, and connection semantics from `Connection`.
- `DungeonRuntimeDescription` and `DungeonRuntimeExit` are shared runtime projection payloads. They are not alternate model objects and they must stay free of write logic.
- `DungeonRuntimeDescription` keys inspector identity with the typed owner `DungeonSelectionRef` instead of a runtime-local string ref wrapper.
- `DungeonRuntimeAction` stays in `application/runtime/` because it is executable runtime workflow data, not a description-only concern.
- Runtime exits are the single descriptive truth for numbered doorways. Door actions must derive from those exits instead of re-reading layout door semantics at each UI sink.
