# Clean Editor Owner

## Purpose

`dungeonclean/editor` owns the current parallel clean workspace surface.

## Canonical Types and APIs

- `EditorObject.composeWorkspace(...)` — clean editor composition seam — returns a registered clean shell surface for the current workspace, including toolbar projection, inspector publication, and scene-registration hooks.
- `input/ComposeWorkspaceInput` — clean editor composition input, status callback, inspector publication callbacks, scene-registration callbacks, toolbar projection, and workspace surface carrier.

## Where New Code Goes

- Keep clean workspace UI composition here instead of reusing legacy dungeon editor owners.
- Accept already-final callbacks and passive carriers from `dungeonclean` root instead of importing sibling clean owners directly.
- Publish read-mostly inspector cards through the provided callbacks instead of owning a local details panel.
- Register persistent lower-right scene tabs through the provided callbacks instead of assuming the workspace owns the shell state pane.

## Forbidden Drift

- Do not import `dungeonclean/cluster` directly from this owner.
- Do not let editor UI write to the database except through callbacks provided by the clean root seam.
- Do not rebuild a local `AppView`-style abstraction here; export passive panel nodes instead.
