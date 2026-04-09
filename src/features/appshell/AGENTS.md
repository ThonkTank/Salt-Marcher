# App Shell Feature

## Purpose

`features.appshell` owns the clean application shell that packaged launchers compose around feature surfaces. It replaces direct clean dependencies on legacy `ui.shell` without requiring legacy shell edits.

## Canonical Types and APIs

- `AppshellObject.composeShell(...)` — public app-shell root seam — composes the active clean shell frame around already-final panel content.
- `input/ComposeShellInput` — clean shell request carrier — provides the registered clean shell surfaces plus the initial active surface, including optional toolbar projection.
- `frame/FrameObject` — shell-frame owner seam — builds the cockpit layout structure and initial divider positions.
- `navigation/NavigationObject` — shell navigation owner seam — registers shell surfaces, owns the active surface, and swaps cockpit content on navigation.

## Where New Code Goes

- Put clean shell composition here instead of wiring new launchers directly to `ui.shell`.
- Keep feature surfaces passive when they cross into the shell: stable ids, labels, panel nodes, optional toolbar nodes, and optional lifecycle callbacks only.

## Forbidden Drift

- Do not import or wrap legacy `ui.shell.AppShell` from this subtree.
- Do not move view registry, navigation history, inspector history, or scene tabs into this slice yet; those belong to later shell slices.
