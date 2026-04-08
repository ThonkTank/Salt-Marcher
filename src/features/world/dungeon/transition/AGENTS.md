# Transition Owner

## Purpose

`transition` owns dungeon-transition target resolution, prepared-placement writes, and transition-local rebound persistence beneath `dungeon`.

## Canonical Types and APIs

- `TransitionObject` — public transition root seam — accepts typed transition workflow requests and delegates them to the current transition workflow owner.
- `input/DeleteTransitionInput` — transition delete request family — backs `TransitionObject.deleteTransition(...)` for one persisted transition.
- `input/LoadDungeonTargetsInput` — transition target-load request family — loads selectable dungeon transition targets in transition-owned root-input form.
- `input/LoadOverworldTargetsInput` — transition target-load request family — loads selectable overworld transition targets in transition-owned root-input form.
- `input/PersistReboundConnectionsInput` — transition rebound request family — carries the original map plus resolved rebound connections so transition-local persistence can preserve attached stair placement specs.
- `DungeonTransitionApplicationService` — legacy transition workflow seam for target lookup plus create, place, and delete flows while the root-owner migration continues.

## Where New Code Goes

- Put new public cross-owner transition entrypoints on `TransitionObject`.
- Put public transition workflow request carriers under `input/`.
- Keep transition destination validation, paired-transition rules, and prepared-placement writes on the transition owner instead of spreading them into map, shell, or repository helpers.

## Forbidden Drift

- Do not write transition rows directly from foreign owners once the root seam exists.
- Do not move transition destination validation into shell tools or map-owned helpers.
