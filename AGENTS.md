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
  Electron/build/packaging configuration with `pnpm handoff:app`. It validates
  the complete required-job set and exact-SHA CI-built Local artifact, verifies
  its receipt, app inputs, toolchain identity, manifest and bytes, smoke-tests
  that downloaded AppImage on the handoff host, backs up valuable local
  campaign data, installs the matching `SaltMarcher Local` AppImage, and
  verifies that installed runtime. Handoff state is keyed by the immutable
  application SHA. Repeated
  invocations for the same SHA must validate and reuse hash-proven phases
  idempotently; `pnpm handoff:app -- --resume` remains an explicit recovery
  intent but may not replace the provenance of the invocation that created the
  SHA state.
- Pure documentation or test-only changes finish with the independently verified
  selected `Check` workflow for their exact SHA. Use appropriate focused local
  checks while editing. The full `pnpm check` includes Electron and E2E work;
  respect the host's isolation policy when running it.
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

## CI risk selection

- Candidate preflight resolves the current remote Main commit and verifies linear
  history before expensive partitions start. Selection uses immutable Git objects,
  unchanged policy from that Main commit, raw diff and app-build fingerprints.
- Portable checks, Linux build and the exact-SHA Local artifact remain mandatory.
  Explicit documentation/portable-test changes may omit unrelated native,
  qualification and UI partitions; renderer changes retain every Linux/UI check.
  Unknown or structural changes and changed/missing policy require full checks.
- `scripts/delivery/required-jobs.v6.json` defines the complete job universe.
  Aggregate, candidate qualification and handoff independently recompute the
  original run-scoped selection receipt before accepting any skipped partition.
  Selection is part of the immutable workflow evidence. Missing selected jobs,
  failed jobs, foreign bases and altered receipts cannot qualify a candidate.
- Public release admission requires full exact-SHA Check evidence. Dispatch the
  Check workflow explicitly for that SHA when development CI selected a subset;
  a manual Check dispatch always runs the complete set. This does not replace
  artifact qualification, canonical handoff, Main attestation or human approval.
