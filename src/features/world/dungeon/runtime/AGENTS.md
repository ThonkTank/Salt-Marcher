# Dungeon Runtime

## Purpose

`runtime` owns dungeon runtime workflows such as runtime-state repair and, in later passes, runtime navigation entrypoints.

## Canonical Types and APIs

- `RuntimeObject` — public runtime root seam — accepts typed runtime workflow requests and delegates them to the current runtime workflow owner.
- `input/RepairNavigationInput` — runtime-navigation repair request — carries the JDBC connection used to repair persisted runtime position after catalog mutations.
- `input/ResolveRepairNavigationInput` — runtime repair-navigation request family — resolves the repaired runtime fallback snapshot into root-input form.

## Where New Code Goes

- Put public cross-owner runtime entrypoints on `RuntimeObject`.
- Put public runtime workflow request carriers under `input/`.
- Keep broader navigation and description internals behind the runtime owner seam until their local migration is pulled forward.

## Forbidden Drift

- Do not call runtime repair directly through legacy `application/runtime` from foreign owners once the root seam exists.
- Do not expose shell-local runtime UI state as public runtime API.
