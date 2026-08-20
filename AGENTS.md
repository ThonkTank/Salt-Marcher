# SaltMarcher contributor guide

## Product truth

- `docs/project/vision.md`, `docs/**/requirements/`, confirmed acceptance
  cases, static catalog data, reference tables, and Golden-Master fixtures are
  the product source of truth.
- Java code is a behavioral reference only. It is not a target architecture,
  compatibility contract, or implementation template.
- `docs/project/architecture/electron-greenfield-migration.md` is the
  versioned migration plan and progress record; `target-architecture.md`
  defines the implementation boundaries.

## Architecture boundaries

- The renderer uses React, PixiJS, and Babylon.js only through the restricted
  preload capability bridge. It receives no Node.js, file-system, or database
  access.
- Electron main owns windows, permissions, security policy, and process
  lifecycle. Domain commands, SQLite, generators, and background work execute
  in the utility process.
- IPC contracts live in `src/shared/contracts/`, are Zod-validated at each
  boundary, and expose immutable results.
- SQL and prepared statements belong to their owning aggregate. Do not add a
  generic ORM or retain Java/JDBC abstractions.

## Canonical handoff

- Finish app-relevant changes to `src/`, `resources/`, dependencies, or
  Electron/build/packaging configuration with `pnpm handoff:app`. It runs the
  canonical checks, packages the exact checked workspace, smoke-tests the
  packaged application, backs up valuable local campaign data, and installs
  the matching `SaltMarcher Local` AppImage, then verifies that installed
  runtime. Handoff state is keyed by the immutable application SHA. Repeated
  invocations for the same SHA must validate and reuse hash-proven phases
  idempotently; `pnpm handoff:app -- --resume` remains an explicit recovery
  intent but may not replace the provenance of the invocation that created the
  SHA state.
- Pure documentation or test-only changes finish with `pnpm check`.
- Candidate promotion compares its app-build fingerprint with the current
  `origin/main` app-build fingerprint. An unchanged app-build fingerprint does
  not require a local application handoff; an app-relevant change cannot be
  promoted without its completed exact-SHA handoff state.
- `pnpm dev` is only the targeted HMR development loop; it is not a manual
  acceptance or handoff path.
- Every implementation is committed to a clean candidate branch and pushed
  there first. The exact candidate SHA must pass all required remote `Check`
  jobs before an app-relevant SHA may reach a completed canonical handoff.
  Only then may the same SHA be fast-forwarded to `origin/main`; rebuilding,
  amending, or pushing an unchecked SHA directly to `main` is not a valid
  handoff. A green implementation is not complete until the promoted SHA is
  green on `main`.
