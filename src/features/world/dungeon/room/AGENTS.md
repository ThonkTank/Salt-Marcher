# Dungeon Room

## Purpose

`room` owns persisted room metadata writes, including authored narration for rooms and their exits.

## Canonical Types and APIs

- `RoomObject` — public room root seam — accepts typed narration write requests and owns the JDBC connection plus transaction around same-owner `state` and `repository`.
- `input/SaveNarrationInput` — room-narration save request — carries the room id, the visual description, and the nested `SaveNarrationInput.ExitNarrationInput` value used only by this request shape.
- `state/SaveNarrationState` — room-owned narration save state — normalizes the authored narration payload into the canonical room-owned save shape.
- `state/SaveNarrationExitState` — room-owned normalized exit narration value derived from the nested request-local exit payload.
- `repository/SaveNarrationRepository` — room-owned narration persistence seam — updates `dungeon_rooms.visual_description` and replaces `dungeon_room_exit_descriptions` rows from room-owned state.

## Where New Code Goes

- Put public room write requests under `input/`.
- Keep room-request-local passive helper values nested inside `SaveNarrationInput` when they belong only to that single request shape.
- Put cross-owner room write entrypoints on `RoomObject`.
- Put room-owned request normalization and protected save truth in `state/` when a room write needs a canonical internal payload.
- Put direct room-owned SQL persistence in `repository/`.
- Keep internal room metadata workflow and persistence details behind the room owner seam.

## Build Hazards

- Touching `input/SaveNarrationInput` will fail the build if it grows methods, initializer blocks, project imports outside `input`, or a second nesting level under `ExitNarrationInput`. A separate top-level pseudo-input for exit narration would also fail because it would not match a real `RoomObject` request.
- Touching `RoomObject` will fail the build if it grows extra public methods, overloads `saveNarration`, or lets the request body drift beyond guards, local bindings, allowed orchestration calls, returns, and throws.
- Touching `state/SaveNarrationState` or `state/SaveNarrationExitState` will fail the build if public APIs stop being static factory-transition seams, or if state starts importing room `repository` or foreign-owner project packages.
- Touching `repository/SaveNarrationRepository` will fail the build if it imports room `input`, exposes public instance methods, or changes its public persistence seam so it no longer accepts or returns room `state`.

## Forbidden Drift

- Do not write room narration directly from shell panes or dropdowns.
- Do not introduce a second public narration write seam beside `RoomObject`.
- Do not reintroduce direct shell-to-application narration writes that bypass `RoomObject`.
- Do not reintroduce a room-local task layer for narration when the flow already fits cleanly as `owner -> state -> repository`.
