# Transition Owner

## Purpose

`transition` owns dungeon-transition target resolution, prepared-placement writes, and transition-local rebound persistence beneath `dungeon`.

## Canonical Types and APIs

- `TransitionObject` — public transition root seam — accepts typed transition workflow requests and currently forwards each root request through the same-stem transition task.
- `task/CreateTransitionTask` — transition create request-shape seam — handles the root-input handoff for door-anchored transition creation.
- `input/CreateStairTransitionInput` — transition create request family — backs `TransitionObject.createStairTransition(...)` for stair-anchored transition creation.
- `input/CreateTransitionInput` — transition create request family — backs `TransitionObject.createTransition(...)` for door-anchored transition creation.
- `input/DeleteTransitionInput` — transition delete request family — backs `TransitionObject.deleteTransition(...)` for one persisted transition.
- `input/LoadDungeonTargetsInput` — transition target-load request family — loads selectable dungeon transition targets in transition-owned root-input form.
- `input/LoadOverworldTargetsInput` — transition target-load request family — loads selectable overworld transition targets in transition-owned root-input form.
- `input/PlacePreparedTransitionInput` — transition prepared-placement request family — backs `TransitionObject.placePreparedTransition(...)` for door-anchored prepared transitions.
- `input/PlacePreparedStairTransitionInput` — transition prepared-placement request family — backs `TransitionObject.placePreparedStairTransition(...)` for stair-anchored prepared transitions.
- `input/PersistReboundConnectionsInput` — transition rebound request family — carries the original map plus resolved rebound connections so transition-local persistence can preserve attached stair placement specs.
- `task/DeleteTransitionTask` — transition delete request-shape seam — handles root-input handoff for persisted transition deletion.
- `task/LoadDungeonTargetsTask` — transition dungeon-target request-shape seam — projects placed dungeon transitions into transition-owned root-input form.
- `task/LoadOverworldTargetsTask` — transition target-load request-shape seam — projects overworld transition targets into transition-owned root-input form.

## Where New Code Goes

- Put new public cross-owner transition entrypoints on `TransitionObject`.
- Put public transition workflow request carriers under `input/`.
- Use `task/` only for request-shaped input/result translation that matches a `TransitionObject` request.
- Keep transition destination validation, paired-transition rules, and prepared-placement writes on the transition owner instead of spreading them into map, shell, or repository helpers.

## Forbidden Drift

- Do not write transition rows directly from foreign owners once the root seam exists.
- Do not move transition destination validation into shell tools or map-owned helpers.
- Do not reintroduce request-shape translation into `TransitionObject`, and do not turn transition tasks into general workflow coordinators.
