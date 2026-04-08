# Editor State Pane

## Purpose

`statepane` owns the lower-right editor pane surfaces for selection-scoped editor workflows.

## Canonical Types and APIs

- `StatePaneObject` — public pane surface — hosts room narration editing for the current room or cluster selection.

## Where New Code Goes

- Put selection-scoped editor forms here.
- Save authored room narration through `room/RoomObject`, not through legacy application services.

## Forbidden Drift

- Do not move this pane back into `shell/editor/state`.
- Do not add a second room-write path beside `room/RoomObject`.
