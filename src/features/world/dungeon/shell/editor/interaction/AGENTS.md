# AGENTS.md

This file covers `src/features/world/dungeon/shell/editor/interaction/`.

## Purpose

`shell/editor/interaction` owns editor gesture interpretation, tool dispatch, hover intent, and shared cross-tool interaction state.

## Canonical Types and APIs

- `EditorInteraction` — hit snapshot plus active tool — resolves hover intent and dispatches press, drag, and release.
- `EditorTool.interactionCapabilities(...)` — ordered declaration of what a tool reacts to.
- `EditorInteractionState` — shared cross-tool interaction state for hover intent, previews, and selection coordination.
- `CellWindowDragSession` — shared drag helper for paint-style tools — exposes preview occupancy through canonical `cellFootprint(): GridArea`.

## Where New Code Goes

- Put new gesture meaning on the responsible tool first.
- Put shared editor interaction policy here only when it is genuinely cross-tool.
- Keep shared state narrow: selection, explicit hover intent, and previews needed by multiple tools.
- Keep preview payloads carrier-based: `EditorPreview.PaintPreview` carries `GridArea`, `EditorPreview.BoundaryPreview` carries `GridSegmentPath`, and renderers unwrap raw cells or segments only at the leaf.

## Forbidden Drift

- Do not fork second tool-specific copies of stair, narration, or selection state.
- Do not duplicate click or hover resolution outside the ordered capability list.
- Do not lift room, floor, corridor, or transition semantics into generic helpers when they belong to a concrete tool.
- Do not publish raw preview cell or segment sets from shared interaction state when `GridArea` or `GridSegmentPath` already expresses the draft canonically.
