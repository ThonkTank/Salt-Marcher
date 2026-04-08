# Dungeon Editor

## Purpose

`editor` owns dungeon-editor subsurface composition, including the lower-right state pane and the editor interaction assembly consumed by the editor view.

## Canonical Types and APIs

- `EditorObject` — public editor-owned composition seam — accepts shared editor collaborators and returns the composed dungeon editor view.
- `statepane/StatePaneObject` — editor-owned lower-right pane surface — renders room narration editing for the current selection and saves through `room/RoomObject`.
- `interaction/InteractionObject` — editor-interaction composition seam — returns the composed `EditorInteraction` used by the editor view.

## Where New Code Goes

- Put editor-only composition here before pushing wiring back up to feature-level composition.
- Put lower-right selection-scoped pane UI under `statepane/`.
- Keep gesture/tool assembly behind `interaction/InteractionObject`.

## Forbidden Drift

- Do not reintroduce room narration UI under `shell/editor/state`.
- Do not reintroduce selection-tool wiring under `bootstrap`.
