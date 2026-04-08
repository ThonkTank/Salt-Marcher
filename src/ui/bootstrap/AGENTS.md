# UI Bootstrap

## Purpose

`ui/bootstrap` owns the shared application entry lifecycle and JavaFX preloader wiring.

## Canonical Types and APIs

- `app/AppObject` — application entry owner — boots the shell, registers feature views, and starts async startup loading.
- `preloader/PreloaderObject` — JavaFX preloader owner — shows the startup card until the main app signals readiness.

## Where New Code Goes

- Keep top-level launcher wiring under `app`.
- Keep startup splash and preloader-only behavior under `preloader`.

## Forbidden Drift

- Do not move feature composition back into legacy root bootstrap files.
- Do not mix preloader-only UI behavior into the main application entry owner.
