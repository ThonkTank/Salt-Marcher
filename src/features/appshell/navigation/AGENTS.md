# App Shell Navigation Owner

## Purpose

`features.appshell/navigation` owns clean shell surface registration and active-surface navigation. It turns passive shell surfaces into a navigable sidebar plus live cockpit panel swapping.

## Canonical Types and APIs

- `NavigationObject.composeNavigation(...)` — registers shell surfaces, selects the initial active surface, and returns live toolbar/navigation/panel nodes for the shell frame.
- `input/ComposeNavigationInput` — navigation request carrier with registered surfaces and optional lifecycle callbacks.

## Where New Code Goes

- Keep active-surface selection and panel swapping here.
- Normalize shell-surface ids, labels, and lifecycle callbacks at the navigation owner edge before handing them to the shared UI navigation assembly.

## Forbidden Drift

- Do not push frame layout concerns back into this owner.
- Do not introduce legacy `ViewId` or `AppView` abstractions here.
