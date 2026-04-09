# Clean Editor Owner

## Purpose

`dungeonclean/editor` owns the current parallel clean workspace surface.

## Canonical Types and APIs

- `EditorObject.composeWorkspace(...)` — clean editor composition seam — returns passive shell panel content for the current workspace.
- `input/ComposeWorkspaceInput` — clean editor composition input, status callback, and workspace surface carrier.

## Where New Code Goes

- Keep clean workspace UI composition here instead of reusing legacy dungeon editor owners.
- Accept already-final callbacks and passive carriers from `dungeonclean` root instead of importing sibling clean owners directly.

## Forbidden Drift

- Do not import `dungeonclean/cluster` directly from this owner.
- Do not let editor UI write to the database except through callbacks provided by the clean root seam.
- Do not rebuild a local `AppView`-style abstraction here; export passive panel nodes instead.
