# App Shell Async Owner

## Purpose

`features.appshell/async` owns the clean shell-wide background-task submission and failure-reporting seam.

## Canonical Types and APIs

- `AsyncObject.composeAsync(...)` — builds the clean async callback bundle used by launchers and features.
- `input/ComposeAsyncInput` — async composition request plus nested background-submission and failure-reporting carriers.

## Where New Code Goes

- Put clean background-task submission and app-wide failure logging here.
- Let launchers and clean features consume this seam through passive callbacks instead of rebuilding `Task`/`Thread` boilerplate locally.

## Forbidden Drift

- Do not route new clean background work back through legacy `ui.async.UiAsyncExecutor`, `UiAsyncTasks`, or `UiErrorReporter`.
- Do not add feature-specific task orchestration or UI mutation logic here.
