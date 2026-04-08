# Hello Feature

## Purpose

`features.hello` owns a minimal sample seam used to verify that new source files can satisfy the current owner-boundary and dead-code build checks.

## Canonical Types and APIs

- `HelloObject` — public sample owner seam — accepts `MessageInput` and returns the greeting payload produced by `task/MessageTask`.
- `task/MessageTask` — canonical sample task seam — turns one `MessageInput` into the tiny Hello-World output payload.

## Where New Code Goes

- Keep tiny greeting experiments and other check-oriented sample behavior on `HelloObject`.
- Keep request shapes in `input/` and the sample transformation in `task/`.

## Forbidden Drift

- Do not grow this feature into a general sandbox or dumping ground.
- Do not bypass `HelloObject` by wiring callers directly to `task/`.
