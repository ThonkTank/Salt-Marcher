# Dungeon Room

## Purpose

`room` owns persisted room metadata writes, including authored narration for rooms and their exits.

## Canonical Types and APIs

- `RoomObject` — public room root seam — accepts typed narration write requests and delegates them directly to the matching room task.
- `input/SaveNarrationInput` — room-narration save request — carries the room id, the visual description, and nested authored exit texts.
- `task/SaveNarrationTask` — room narration orchestration seam — owns the current room workflow delegation and the input-to-domain narration mapping.

## Where New Code Goes

- Put public room write requests under `input/`.
- Put cross-owner room write entrypoints on `RoomObject`.
- Put room workflow orchestration under `task/` when a root request needs owner-local mapping before it reaches legacy internals.
- Keep internal room metadata workflow and persistence details behind the room owner seam.

## Forbidden Drift

- Do not write room narration directly from shell panes or dropdowns.
- Do not introduce a second public narration write seam beside `RoomObject`.
- Do not reintroduce direct legacy-service calls or narration-mapping helpers back into `RoomObject`.
