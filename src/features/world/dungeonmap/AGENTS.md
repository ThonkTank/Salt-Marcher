# AGENTS.md

This file covers `src/features/world/dungeonmap/`. Use it together with the root `AGENTS.md` and `src/features/world/AGENTS.md`.

## Purpose

`dungeonmap` owns the dungeon editor and the matching runtime surface. The feature must preserve one shared interpretation of dungeon topology so editor, runtime, loading, and persistence all talk about the same rooms, corridors, stairs, transitions, and doors.

## Current Durable Structure

- `bootstrap/` wires the feature. `DungeonMapModule` is the only composition root.
- `loading/` chooses which map to load and coordinates async reload-after-write behavior.
- `state/` owns shared session and workflow state. Preview state is not persisted truth.
- `shell/` owns views, hit probing, editor/runtime interaction, and inspector publication.
- `canvas/` owns rendering and raw input only. Domain meaning stays outside the renderer.
- `model/` owns canonical geometry, interaction refs, structures, and layout queries.
- `application/` owns editor/runtime workflows over model and repository seams.
- `repository/` owns direct storage reads and writes against the current schema.
- `catalog/` owns dungeon map create/rename/delete and catalog summaries.

## Cross-cutting Rules

- `CellCoord`, `GridPoint2x`, and `GridSegment2x` are the canonical dungeon geometry seams. Do not add alternate storage or renderer parity models.
- `DungeonLayout` is the immutable lookup over direct structure owners. Do not turn it into a second mutation owner.
- `Room` is metadata only. Physical room surfaces and boundaries are derived from the owning `RoomCluster`.
- Corridors, stairs, and transitions are first-class persisted structures. Their physical form must flow through canonical model owners instead of feature-local mirrors.
- Boundary topology stays on `StructureObject.LevelStructure`; authored wall identity and wall-kind semantics ride on top of that topology instead of replacing it with renderer- or tool-local mirrors.
- Authored `Wall` objects are typed boundary polylines owned by the structure aggregate. `WallKind` definitions are app-global catalog data; uncovered boundary segments still resolve to the built-in solid kind.
- Physical doors are canonical shared objects. Other structures may refer to doors by id, but must not copy door geometry or state into parallel owners.
- Interaction-layer `DoorRef` values stay as pure door ids. Owner semantics for a door must be derived from the live `DungeonLayout`, not mirrored into selection payloads.
- Editor and runtime must resolve surfaces and interaction subjects from the same model owners. Do not add runtime-only or editor-only topology mirrors.
- Writes persist in one transaction and then reload through `DungeonMapLoadingService`. Reload is the authoritative rebuild, not a repair step for partial state.
- The feature targets the current dungeon schema only. Broken or stale rows should fail fast during load instead of being normalized silently.

## Forbidden Drift

- Do not move tool-private draft state into shared state containers without a real cross-tool need.
- Do not split room, stair, transition, or runtime workflows across parallel application owners.
- Do not document per-method control flow, wiring inventories, or table-by-table row layouts here when the code already states them clearly.
- Update this file only when the feature goal, durable ownership boundaries, or forbidden patterns change.
