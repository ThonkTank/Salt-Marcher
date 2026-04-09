# App Shell Feature

## Purpose

`features.appshell` owns the clean application shell that packaged launchers compose around feature surfaces. It replaces direct clean dependencies on legacy `ui.shell` without requiring legacy shell edits.

## Canonical Types and APIs

- `AppshellObject.composeShell(...)` — public app-shell root seam — composes the active clean shell frame around already-final panel content.
- `input/ComposeShellInput` — clean shell request carrier — provides the title, nav label, and four cockpit panel nodes.
- `frame/FrameObject` — shell-frame owner seam — builds the cockpit layout structure and initial divider positions.

## Where New Code Goes

- Put clean shell composition here instead of wiring new launchers directly to `ui.shell`.
- Keep feature surfaces passive when they cross into the shell: title, nav label, and panel nodes only.

## Forbidden Drift

- Do not import or wrap legacy `ui.shell.AppShell` from this subtree.
- Do not move view registry, navigation history, inspector history, or scene tabs into this slice yet; those belong to later shell slices.
