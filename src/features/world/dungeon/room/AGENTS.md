# Dungeon Room

## Purpose

`room` owns persisted room metadata writes, including authored narration for rooms and their exits.

## Canonical Types and APIs

- `RoomObject` — public room root seam — accepts typed narration write requests and currently forwards `saveNarration(...)` through `SaveNarrationTask`.
- `input/SaveNarrationInput` — room-narration save request — carries the room id, the visual description, and nested authored exit texts.
- `task/SaveNarrationTask` — room request-shape seam — handles root-input translation for room-owned narration writes as a static linear input-to-input pipeline.

## Where New Code Goes

- Put public room write requests under `input/`.
- Put cross-owner room write entrypoints on `RoomObject`.
- Use `task/` only when a room root request needs request-shaped input/result translation.
- Keep internal room metadata workflow and persistence details behind the room owner seam.

## Forbidden Drift

- Do not write room narration directly from shell panes or dropdowns.
- Do not introduce a second public narration write seam beside `RoomObject`.
- Do not reintroduce request-shape translation into `RoomObject`, and do not turn room tasks into general workflow/service seams.
