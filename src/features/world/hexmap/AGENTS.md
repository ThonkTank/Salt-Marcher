# AGENTS.md

This file covers `src/features/world/hexmap/`. Apply the root `AGENTS.md` and `src/features/world/AGENTS.md` first. This file documents only hexmap-local rules.

## Purpose

`hexmap` owns the overworld map, the overworld editor, the shared hex renderer used by both, and the calendar behavior tied to this feature area.

## Canonical Types and APIs

- `features.world.hexmap.api` — public world-owned boundary for hexmap reads, mutations, and shell wiring.
- `HexGridPane` — shared renderer for read-only and editing workflows.
- `HexMapService` — async map loading and overworld persistence workflow seam.
- `CalendarService` — Forgotten Realms calendar parsing and day conversion seam.

### Shared Renderer

- `HexGridPane` is the shared renderer
- Hexes are flat-top with axial coordinates `(q, r)`
- `HEX_SIZE = 48px`
- Zoom range is `0.2` to `5.0`
- Pan uses middle-drag and left-drag
- `setReadOnly(true)` is the runtime/read-only mode contract for `HexMapPane`
- `setPaintMode(true)` is the editor paint contract for `MapEditorCanvas`

Do not duplicate these behaviors into separate renderer implementations unless the user explicitly asks for an architectural split.

### Persistence and Workflow Rules

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

## Forbidden Drift

- Do not fork separate runtime and editor renderers for the same hex surface behavior.
- Do not move debounced party-position persistence or transactional map resizing out of `HexMapService`.
- Do not turn shared renderer or calendar rules into generic root architecture rules; they stay hexmap-local.
