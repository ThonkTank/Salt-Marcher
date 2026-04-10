# Launchers

## Purpose

`launchers` owns retained non-default application entry sources that stay outside `src/` so legacy launcher composition can evolve without tripping feature-owner heuristics.

## Canonical Types and APIs

- `launchers/dungeonclean/src/launcher/dungeonclean/DungeoncleanLauncher.java` — retained legacy clean launcher — preserves the previous dungeonclean-only packaged entry for reference while the default lifecycle now starts from `src/clean`.
- `launchers/dungeonclean/src/launcher/dungeonclean/startup/StartupObject.java` — launcher-local startup lifecycle seam for the retained legacy launcher.

## Where New Code Goes

- Put only retained or sidecar launcher sources here when they must stay outside `src/`.
- Keep launcher code focused on startup lifecycle, stage construction, and high-level composition only.

## Forbidden Drift

- Do not treat `launchers/` as the default packaged application entry once `src/clean` owns `build`/`run`/`installDesktopApp`.
- Do not put feature logic or persistence workflows here.
- Do not mirror owner slices under `launchers`; compose existing public seams instead.
