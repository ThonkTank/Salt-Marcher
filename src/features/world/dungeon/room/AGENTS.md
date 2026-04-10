# Dungeon Room

## Purpose

`room` owns persisted room metadata writes, including rewrite-time room rows, authored narration for rooms, and their exits.

## Canonical Types and APIs

- `RoomObject` — public room root seam — accepts typed narration write requests and delegates room-owned normalization and persistence.
- `RoomObject.persistMetadata(...)` — canonical room-metadata write seam — accepts rewrite-time room rows plus removed room ids and delegates room-owned normalization and persistence.
- `input/PersistMetadataInput` — room-metadata persistence request — carries the authoritative map id, rewritten clusters/rooms, and removed room ids for one room-owned metadata commit.
- `state/PersistMetadataState` — room-owned metadata persistence state — normalizes rewritten room rows, anchors, and exit narration into the canonical room-owned save shape.
- `repository/PersistMetadataRepository` — room-owned metadata persistence seam — owns room row upserts, room-level anchors, exit narration replacement, and removed-room deletes from room-owned state.
- `input/SaveNarrationInput` — room-narration save request — carries the room id, the visual description, and the nested `SaveNarrationInput.ExitNarrationInput` value used only by this request shape.
- `state/SaveNarrationState` — room-owned narration save state — normalizes the authored narration payload into the canonical room-owned save shape.
- `state/SaveNarrationExitState` — room-owned normalized exit narration value derived from the nested request-local exit payload.
- `repository/SaveNarrationRepository` — room-owned narration persistence seam — owns the JDBC connection plus transaction and updates `dungeon_rooms.visual_description` and `dungeon_room_exit_descriptions` from room-owned state.

## Where New Code Goes

- Put public room write requests under `input/`.
- Put batch room metadata rewrites, removed-room deletes, level-anchor writes, and exit narration writes on `RoomObject.persistMetadata(...)`.
- Keep room-request-local passive helper values nested inside `SaveNarrationInput` when they belong only to that single request shape.
- Put cross-owner room write entrypoints on `RoomObject`.
- Put room-owned request normalization and protected save truth in `state/` when a room write needs a canonical internal payload.
- Put direct room-owned SQL persistence, JDBC lifecycle, and transaction scope in `repository/`.
- Keep room request delegation thin on `RoomObject`; repository owns the persistence flow once state is normalized.

## Build Hazards

- Touching `input/SaveNarrationInput` will fail the build if it grows methods, initializer blocks, project imports outside `input`, or a second nesting level under `ExitNarrationInput`. A separate top-level pseudo-input for exit narration would also fail because it would not match a real `RoomObject` request.
- Touching `RoomObject` will fail the build if it grows extra public methods, overloads `saveNarration`, or lets the request body drift beyond pass-through bindings, simple routing, canonical same-owner delegation, private terminal consumption, returns, and throws.
- Touching `state/SaveNarrationState` or `state/SaveNarrationExitState` will fail the build if public APIs stop being static factory-transition seams, or if state starts importing room `repository` or foreign-owner project packages.
- Touching `repository/SaveNarrationRepository` will fail the build if it imports room `input`, exposes public instance methods, or changes its public persistence seam so it no longer exposes room `state` while owning the JDBC persistence boundary.

## Forbidden Drift

- Do not write room narration directly from shell panes or dropdowns.
- Do not keep rewrite-time room row upserts, removed-room deletes, or exit narration replacement as map-owned SQL when the `room` owner already exposes `persistMetadata(...)`.
- Do not introduce a second public narration write seam beside `RoomObject`.
- Do not reintroduce direct shell-to-application narration writes that bypass `RoomObject`.
- Do not reintroduce a room-local task layer for narration when the flow already fits cleanly as `owner -> state -> repository`.
