# Transition Owner

## Purpose

`transition` owns dungeon-transition target resolution, prepared-placement writes, and transition-local rebound persistence beneath `dungeon`.

## Canonical Types and APIs

- `TransitionObject` — public transition root seam — accepts typed transition workflow requests and delegates each migrated request directly to the matching transition task.
- `task/CreateTransitionTask` — transition create seam — owns the current door-anchored transition-create workflow beneath the transition root seam.
- `input/CreateStairTransitionInput` — transition create request family — backs `TransitionObject.createStairTransition(...)` for stair-anchored transition creation.
- `input/CreateTransitionInput` — transition create request family — backs `TransitionObject.createTransition(...)` for door-anchored transition creation.
- `input/DeleteTransitionInput` — transition delete request family — backs `TransitionObject.deleteTransition(...)` for one persisted transition.
- `input/LoadDungeonTargetsInput` — transition target-load request family — loads selectable dungeon transition targets in transition-owned root-input form.
- `input/LoadOverworldTargetsInput` — transition target-load request family — loads selectable overworld transition targets in transition-owned root-input form.
- `input/PlacePreparedTransitionInput` — transition prepared-placement request family — backs `TransitionObject.placePreparedTransition(...)` for door-anchored prepared transitions.
- `input/PlacePreparedStairTransitionInput` — transition prepared-placement request family — backs `TransitionObject.placePreparedStairTransition(...)` for stair-anchored prepared transitions.
- `input/PersistReboundConnectionsInput` — transition rebound request family — carries the original map plus resolved rebound connections so transition-local persistence can preserve attached stair placement specs.
- `task/DeleteTransitionTask` — transition delete orchestration seam — owns the current persisted delete workflow beneath the transition root seam.
- `task/LoadDungeonTargetsTask` — transition dungeon-target load seam — projects placed dungeon transitions into transition-owned root-input form.
- `task/LoadOverworldTargetsTask` — transition target-load seam — projects overworld transition targets into transition-owned root-input form.
- `DungeonTransitionApplicationService` — legacy editor-facing shim — keeps existing callers stable while delegating transition-owned create, place, and delete writes onto `TransitionObject`.

## Where New Code Goes

- Put new public cross-owner transition entrypoints on `TransitionObject`.
- Put public transition workflow request carriers under `input/`.
- Put migrated transition workflow orchestration under `task/` with one request-matched task per root request as seams are pulled forward.
- Keep transition destination validation, paired-transition rules, and prepared-placement writes on the transition owner instead of spreading them into map, shell, or repository helpers.

## Forbidden Drift

- Do not write transition rows directly from foreign owners once the root seam exists.
- Do not move transition destination validation into shell tools or map-owned helpers.
- Do not reintroduce migrated create, delete, or target-load logic back into `TransitionObject`; keep that orchestration on the matching transition task.
