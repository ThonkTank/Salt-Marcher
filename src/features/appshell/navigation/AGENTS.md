# App Shell Navigation Owner

## Purpose

`features.appshell/navigation` owns clean shell surface registration and active-surface navigation. It turns passive shell surfaces into a navigable sidebar plus live cockpit and toolbar/state swapping.

## Canonical Types and APIs

- `NavigationObject.composeNavigation(...)` — registers shell surfaces, selects the initial active surface, and returns live toolbar/navigation/panel nodes for the shell frame.
- `input/ComposeNavigationInput` — navigation request carrier with registered surfaces, optional toolbar nodes, optional lifecycle callbacks, and the shell-owned default details/state surfaces.

## Where New Code Goes

- Keep active-surface selection, toolbar projection, and panel swapping here.
- Normalize shell-surface ids, labels, toolbar nodes, and lifecycle callbacks at the navigation owner edge before wiring the live navigation UI.
- Use the shell-owned default details surface whenever the active surface does not provide its own details node.
- Use the shell-owned default state surface whenever the active surface does not provide its own lower-right state node.

## Forbidden Drift

- Do not push frame layout concerns back into this owner.
- Do not introduce legacy `ViewId` or `AppView` abstractions here.
