# App Shell Inspector Owner

## Purpose

`features.appshell/inspector` owns the clean shell-wide upper-right inspector and its shared history-aware details navigation.

## Canonical Types and APIs

- `InspectorObject.composeInspector(...)` — builds the shell-owned inspector details node plus the passive navigator callbacks that surfaces can publish into.
- `input/ComposeInspectorInput` — inspector composition request plus navigator/result carrier.

## Where New Code Goes

- Put shell-owned inspector history, hosted detail cards, and global details publication here.
- Keep inspector publication read-mostly; view-local forms and transient workflow UI belong in the lower-right state pane instead.

## Forbidden Drift

- Do not route clean inspector publication back through legacy `ui.shell.DetailsNavigator` or `InspectorPane`.
- Do not move feature-owned details editors or workflow forms into this owner.
