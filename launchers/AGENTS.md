# Launchers

## Purpose

`launchers` owns build-integrated application entry sources that are intentionally kept outside `src/` so launcher composition can evolve without tripping feature-owner heuristics.

## Canonical Types and APIs

- `launchers/dungeonclean/src/launcher/dungeonclean/DungeoncleanLauncher.java` — default packaged app launcher — boots the clean dungeon application through the standard Gradle `run`/`installDist`/`installDesktopApp` lifecycle.
- `launchers/dungeonclean/src/launcher/dungeonclean/startup/StartupObject.java` — launcher-local startup lifecycle seam — owns pre-start database setup, failure handling, and the app-ready preloader handshake.

## Where New Code Goes

- Put externally compiled launcher sources here when they need to participate in Gradle packaging but must not become feature-owner source files.
- Keep launcher code focused on startup lifecycle, stage construction, and high-level composition only.

## Forbidden Drift

- Do not put feature logic or persistence workflows here.
- Do not mirror owner slices under `launchers`; compose existing public seams instead.
