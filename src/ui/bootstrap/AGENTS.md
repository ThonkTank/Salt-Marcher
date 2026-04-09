# UI Bootstrap

## Purpose

`ui/bootstrap` owns the shared application entry lifecycle and JavaFX preloader wiring.

## Canonical Types and APIs

- `app/AppObject` — legacy application entry owner — preserves the old shell bootstrap flow but is no longer the default packaged launcher.
- `preloader/PreloaderObject` — JavaFX preloader owner — shows the startup card until the main app signals readiness.

## Where New Code Goes

- Keep preloader-only behavior under `preloader`.
- Do not add new default launcher wiring here when the launcher must avoid owner heuristics; use `launchers/` instead.

## Forbidden Drift

- Do not move feature composition back into legacy root bootstrap files.
- Do not mix preloader-only UI behavior into the main application entry owner.
