# Database Setup Owner

## Purpose

`database/setup` owns startup-safe schema creation, default seeding, and additive compatibility work for the shared SQLite database.

## Canonical Types and APIs

- `SetupObject.setupDatabase(...)` — canonical startup DB preparation seam.
- `input/SetupDatabaseInput` — startup request carrier for feature-derived setup facts.
- `state/SetupDatabaseState.setupDatabase(...)` — normalized startup setup state.
- `repository/SetupDatabaseRepository.setupDatabase(...)` — executes idempotent schema creation, default seeding, and additive startup compatibility passes.

## Where New Code Goes

- Put startup-safe `CREATE TABLE IF NOT EXISTS`, `INSERT OR IGNORE`, and additive compatibility logic here.
- Pass feature-derived startup constants into this owner through `SetupDatabaseInput` instead of importing feature services or model constants into the owner or repository.

## Forbidden Drift

- Do not move reset, backup, or ad-hoc maintenance tooling into this owner.
- Do not add direct feature-package imports to this owner or its repository when the same fact can be carried through `SetupDatabaseInput`.
