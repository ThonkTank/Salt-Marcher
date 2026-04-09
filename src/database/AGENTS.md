# Database Infrastructure

## Purpose

`src/database` owns the shared low-level SQLite boundary used across features.

## Canonical Types and APIs

- `DatabaseManager.getConnection()` — canonical app-wide connection factory — returns a fresh JDBC connection with `foreign_keys=ON` and `journal_mode=WAL`.
- `DatabaseManager.setupDatabase()` — stable public startup seam — delegates startup schema creation, default seeding, and additive compatibility preparation into `database/setup`.
- `DatabaseTransactionRunner.inTransaction(...)` — canonical shared transaction helper for callers that already own a JDBC connection.
- `database/setup/SetupObject.setupDatabase(...)` — canonical shared startup owner for schema creation, seeding, and startup-safe compatibility passes.
- `database/maintenance/MaintenanceObject.inspectDatabase(...)` — canonical shared read-only inspection seam for SQLite file state and table inventory.
- `database/maintenance/MaintenanceObject.backupDatabase(...)` — canonical shared backup seam for copying the current or requested SQLite file.
- `database/maintenance/MaintenanceObject.resetDatabase(...)` — canonical shared explicit reset seam for narrow maintenance targets such as `dungeon`.

## Where New Code Goes

- Put shared connection and transaction helpers here instead of under a feature subtree.
- Put startup-safe schema/seed/compatibility logic in `database/setup` instead of growing `DatabaseManager`.
- Put shared backup, reset, and read-only inspection tooling in `database/maintenance`.
- Let repositories own their connection scope locally, then use `DatabaseTransactionRunner` for explicit transaction boundaries.

## Forbidden Drift

- Do not introduce feature-specific transaction helpers under `src/database`.
- Do not duplicate `setAutoCommit`/`commit`/`rollback` boilerplate in clean repositories when the shared transaction helper fits.
- Do not grow `DatabaseManager` back into a monolithic schema/seed implementation.
- Do not scatter shared database backup, reset, or inspection logic across scripts and feature owners when `database/maintenance` can own it.
