# AGENTS.md

This file defines hex map and overworld-specific operating constraints for agents working under `src/features/world/hexmap/`. Apply the root `AGENTS.md` first, then this file for feature-local architecture and behavior.

## Scope

This file covers the overworld hex map, map editor, shared hex rendering, and the calendar behavior that is specific to this feature area. Do not promote these details into the root `AGENTS.md`; they are local feature rules.

## Public Boundary

| Public API | Internal | Allowed consumers |
| --- | --- | --- |
| `features.world.hexmap.api` | `model`, `repository`, `service`, `ui` | `features.world.api` |

## Feature Architecture

The feature shares one hex renderer across read-only runtime and editing workflows. Preserve that shared rendering model instead of forking parallel canvases for small behavior differences.

### Shared Renderer

- `HexGridPane` is the shared renderer
- Hexes are flat-top with axial coordinates `(q, r)`
- `HEX_SIZE = 48px`
- Zoom range is `0.2` to `5.0`
- Pan uses middle-drag and left-drag
- `setReadOnly(true)` is the runtime/read-only mode contract for `HexMapPane`
- `setPaintMode(true)` is the editor paint contract for `MapEditorCanvas`

Do not duplicate these behaviors into separate renderer implementations unless the user explicitly asks for an architectural split.

### Service Rules

- `HexMapService` owns async map loading
- `updatePartyTileAsync` persists party tile movement with a 300ms debounce
- `updateMap()` performs name/radius changes transactionally and is responsible for map growth or shrink

Changes to save timing or persistence flow must preserve debounced writes and transactional map resizing unless the user explicitly wants different semantics.

### Paint Workflow

- `MapEditorView` uses a paint-and-flush workflow
- `dirtyTiles` accumulates changes during one paint stroke
- `flushDirtyTiles()` persists the batch in one transaction on the `sm-save-terrain` thread
- The canvas updates optimistically before persistence completes

Do not degrade this into per-tile writes during drag unless the user explicitly accepts the performance and consistency tradeoff.

### Shared Type Placement

- `TerrainType` lives in `src/ui/components/` because it is shared by `HexGridPane` and `TilePropertiesPane`
- Do not create feature-local duplicate terrain enums or label maps

### Calendar Rule

- Forgotten Realms calendar semantics are `12 x 30` days plus `5` intercalary days
- `CalendarService.ParsedCalendar.from(config)` is parsed once and then reused for repeated `fromEpochDay()` calls

Preserve the cached parsed-calendar flow; repeated reparsing in hot paths is a regression, not a harmless refactor.
