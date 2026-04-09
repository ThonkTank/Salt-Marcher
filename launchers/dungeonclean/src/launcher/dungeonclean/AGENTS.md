# Dungeonclean Launcher

## Purpose

`launcher.dungeonclean` owns the packaged clean application entry and its launcher-local startup composition. It stays outside `src/` so startup and packaging composition can evolve without touching feature-owner sources.

## Canonical Types and APIs

- `DungeoncleanLauncher` — JavaFX entry class for the packaged clean app — delegates startup lifecycle and owns the final main-stage composition handoff.
- `startup/StartupObject` — launcher-local startup lifecycle owner — runs pre-start database setup, coordinates failure handling, and triggers the app-ready handshake after the main stage is shown.

## Where New Code Goes

- Keep JavaFX `Application` entry wiring on `DungeoncleanLauncher`.
- Keep startup task orchestration, failure handling, and preloader signaling under `startup`.
- Let launcher-local code compose public feature seams; do not rebuild feature workflows here.

## Forbidden Drift

- Do not move startup lifecycle back into `DungeoncleanLauncher`.
- Do not let launcher-local startup code depend on feature-specific catalog or editor logic beyond the final main-stage handoff.
