# Dungeon Room

## Purpose

`room` owns persisted room metadata writes, including authored narration for rooms and their exits.

## Canonical Types and APIs

- `RoomObject` — public room root seam — accepts typed narration write requests and delegates them to the current room workflow.
- `input/SaveNarrationInput` — room-narration save request — carries the room id, the visual description, and nested authored exit texts.

## Where New Code Goes

- Put public room write requests under `input/`.
- Put cross-owner room write entrypoints on `RoomObject`.
- Keep internal room metadata workflow and persistence details behind the room owner seam.

## Forbidden Drift

- Do not write room narration directly from shell panes or dropdowns.
- Do not introduce a second public narration write seam beside `RoomObject`.
