# Dungeon Room

## Purpose

`room` owns persisted room metadata writes, including authored narration for rooms and their exits.

## Canonical Types and APIs

- `RoomObject` — public room root seam — accepts typed narration write requests and orchestrates the room-owned save through same-owner `state` and `repository`.
- `input/SaveNarrationInput` — room-narration save request — carries the JDBC connection, the room id, the visual description, and a request-local nested exit narration value type.
- `state/SaveNarrationState` — room-owned narration save state — normalizes the authored narration payload into the canonical room-owned save shape.
- `repository/SaveNarrationRepository` — room-owned narration persistence seam — updates `dungeon_rooms.visual_description` and replaces `dungeon_room_exit_descriptions` rows from room-owned state.

## Where New Code Goes

- Put public room write requests under `input/`.
- Put cross-owner room write entrypoints on `RoomObject`.
- Put room-owned request normalization and protected save truth in `state/` when a room write needs a canonical internal payload.
- Put direct room-owned SQL persistence in `repository/`.
- Keep internal room metadata workflow and persistence details behind the room owner seam.

## Forbidden Drift

- Do not write room narration directly from shell panes or dropdowns.
- Do not introduce a second public narration write seam beside `RoomObject`.
- Do not reintroduce direct shell-to-application narration writes that bypass `RoomObject`.
- Do not reintroduce a room-local task layer for narration when the flow already fits cleanly as `owner -> state -> repository`.
