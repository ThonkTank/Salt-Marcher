# AGENTS.md

This file covers `src/features/world/dungeonmap/shell/editor/interaction/`. Use it together with `shell/AGENTS.md`, the parent `dungeonmap/AGENTS.md`, and the repository root `AGENTS.md`.

## Purpose

This package owns editor gesture interpretation. The editor should have one pipeline for hit resolution and one owner per tool for gesture meaning.

## Current Durable Structure

- `EditorInteraction` runs the shared pipeline: collect hits, ask the active tool for ordered capabilities, resolve the first match, store hover intent, then dispatch press/drag/release.
- `EditorTool.interactionCapabilities(...)` is the canonical declaration of what a tool reacts to.
- `CellWindowDragSession` is the shared rectangular drag helper for paint-style tools.
- `RoomNarrationPane` owns narration editing UI for the current room selection.

## Rules

- Tool implementations own gesture meaning and tool-private drafts.
- Shared editor state is only for cross-tool coordination: selection, explicit hover intent, and previews.
- Selection identity is semantic. Compare typed `DungeonSelectionRef` values instead of reconstructing owners from generic ids.

## Forbidden Drift

- Do not fork second tool-specific copies of stair, narration, or selection state.
- Do not duplicate click/hover resolution outside the ordered capability list.
- Do not lift room, floor, corridor, or transition semantics into generic helpers when they belong to a concrete tool.
