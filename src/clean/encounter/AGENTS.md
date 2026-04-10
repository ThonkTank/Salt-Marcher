# Clean Encounter

## Purpose

`src/clean/encounter` owns the runtime encounter state shown in the shell-owned Scene pane. It is no longer a top-level sidebar surface.

## Canonical Types and APIs

- `EncounterObject.composeEncounter(ComposeEncounterInput)` — encounter runtime request — returns the shell hook connector plus the command seam used by catalog content to add creatures into the active encounter state.

## Where New Code Goes

- Keep encounter roster/tracker state in this owner and surface it through the shell scene registry.
- Add future generate, save, and combat workflow here instead of rebuilding encounter state in catalog or shell owners.

## Forbidden Drift

- Do not turn encounter back into a top-level feature tab.
- Do not make creature catalog owners persist encounter state locally.
