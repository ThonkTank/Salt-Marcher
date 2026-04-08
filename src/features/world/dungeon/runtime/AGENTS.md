# Dungeon Runtime

## Purpose

`runtime` owns dungeon runtime workflows such as runtime-state repair and runtime navigation entrypoints.

## Canonical Types and APIs

- `RuntimeObject` — public runtime root seam — accepts typed runtime workflow requests and delegates each request directly to the matching runtime task.
- `input/LoadNavigationInput` — runtime-navigation request family — loads the persisted or fallback navigation snapshot for one dungeon map into root-input form.
- `input/NavigateInput` — runtime action request family — executes one resolved runtime action target through the canonical runtime navigation workflow and returns the persisted snapshot in root-input form.
- `input/NavigateToCellInput` — runtime navigation request family — moves runtime navigation to a requested traversable cell and returns the persisted snapshot in root-input form.
- `input/RepairNavigationInput` — runtime-navigation repair request — carries the JDBC connection used to repair persisted runtime position after catalog mutations.
- `input/ResolveNavigationInput` — runtime navigation-resolve request family — resolves a preferred runtime start point through the canonical runtime fallback policy into root-input form.
- `input/ResolveRepairNavigationInput` — runtime repair-navigation request family — resolves the repaired runtime fallback snapshot into root-input form.
- `task/*Task` — runtime orchestration layer — owns runtime workflow execution, map loading, and snapshot/input translation behind one request-matched task per public root request.

## Where New Code Goes

- Put public cross-owner runtime entrypoints on `RuntimeObject`.
- Put public runtime workflow request carriers under `input/`.
- Put runtime workflow orchestration under `task/` with one `<Request>Task` per public root request.
- Keep broader navigation and description internals behind the runtime owner seam.

## Forbidden Drift

- Do not expose shell-local runtime UI state as public runtime API.
- Do not reintroduce workflow helpers or cross-owner wiring back into `RuntimeObject`; that belongs in the matching runtime task.
