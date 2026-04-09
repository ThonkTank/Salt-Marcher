# App Shell Feature

## Purpose

`features.appshell` owns the clean application shell that packaged launchers compose around feature surfaces. It replaces direct clean dependencies on legacy `ui.shell` without requiring legacy shell edits.

## Canonical Types and APIs

- `AppshellObject.composeShell(...)` — public app-shell root seam — composes the active clean shell frame around already-final panel content.
- `input/ComposeShellInput` — clean shell request carrier — provides the registered clean shell surfaces, the initial active surface, and the shell-owned default details surface.
- `frame/FrameObject` — shell-frame owner seam — builds the cockpit layout structure and initial divider positions.
- `navigation/NavigationObject` — shell navigation owner seam — registers shell surfaces, owns the active surface, and swaps cockpit content on navigation.
- `inspector/InspectorObject` — shell inspector owner seam — builds the shared upper-right inspector plus passive publication callbacks.

## Where New Code Goes

- Put clean shell composition here instead of wiring new launchers directly to `ui.shell`.
- Keep feature surfaces passive when they cross into the shell: stable ids, labels, panel nodes, optional toolbar nodes, and optional lifecycle callbacks only.
- Keep the shell-owned inspector global to the shell and let features publish read-mostly cards into it through passive callbacks.

## Forbidden Drift

- Do not import or wrap legacy `ui.shell.AppShell` from this subtree.
- Do not import or wrap legacy `ui.shell.DetailsNavigator` or `InspectorPane` from this subtree.
- Do not move scene tabs or lower-right workflow state into this slice; those belong to later shell slices.
