# Clean Editor Owner

## Purpose

`dungeonclean/editor` owns the current parallel clean workspace surface.

## Canonical Types and APIs

- `EditorObject.composeEditor(...)` — clean editor composition seam.
- `EditorObject.views(...)` — clean editor view export seam.
- `input/ComposeEditorInput` — clean editor composition input and status callback carrier.
- `input/ViewsInput` — clean editor view carrier.

## Where New Code Goes

- Keep clean workspace UI composition here instead of reusing legacy dungeon editor owners.
- Accept already-final callbacks and passive carriers from `dungeonclean` root instead of importing sibling clean owners directly.

## Forbidden Drift

- Do not import `dungeonclean/cluster` directly from this owner.
- Do not let editor UI write to the database except through callbacks provided by the clean root seam.
