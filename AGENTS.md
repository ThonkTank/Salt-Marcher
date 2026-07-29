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

## Canonical check

Run `pnpm check` before handing off a change. It runs formatting, linting,
type checking, unit/integration tests, and the Electron smoke test.
