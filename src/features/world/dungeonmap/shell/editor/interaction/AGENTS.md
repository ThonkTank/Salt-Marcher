# AGENTS.md

This file covers `src/features/world/dungeonmap/shell/editor/interaction/`. Use it together with `shell/AGENTS.md`, the parent `dungeonmap/AGENTS.md`, and the repository root `AGENTS.md`.

## Purpose

This file only records editor-interaction-local seams beneath `dungeonmap/`. Shared owner placement already lives in the parent files.

## Canonical Types and APIs

- `EditorInteraction` — hit snapshot plus active tool — resolves hover intent and dispatches press, drag, and release.
- `EditorTool.interactionCapabilities(...)` — tool context — declares the ordered interaction capabilities a tool reacts to.
- `EditorInteractionState` — shared cross-tool interaction state — stores explicit hover intent, previews, and selection coordination.
- `CellWindowDragSession` — rectangular drag helper — shared drag seam for paint-style tools.

## Where New Code Goes

- Put new gesture meaning on the responsible tool first.
- Put shared editor interaction policy here only when it is genuinely cross-tool.
- Keep shared state narrow: selection, explicit hover intent, and previews that multiple tools need.

## Forbidden Drift

- Do not fork second tool-specific copies of stair, narration, or selection state.
- Do not duplicate click or hover resolution outside the ordered capability list.
- Do not lift room, floor, corridor, or transition semantics into generic helpers when they belong to a concrete tool.
