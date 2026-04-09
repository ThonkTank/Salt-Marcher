# Database Infrastructure

## Purpose

`src/database` owns the shared low-level SQLite boundary used across features.

## Canonical Types and APIs

- `DatabaseManager.getConnection()` — canonical app-wide connection factory — returns a fresh JDBC connection with `foreign_keys=ON` and `journal_mode=WAL`.
- `DatabaseManager.setupDatabase()` — canonical startup schema/seed seam — creates tables idempotently and applies startup-safe seeding.
- `DatabaseTransactionRunner.inTransaction(...)` — canonical shared transaction helper for callers that already own a JDBC connection.

## Where New Code Goes

- Put shared connection and transaction helpers here instead of under a feature subtree.
- Let repositories own their connection scope locally, then use `DatabaseTransactionRunner` for explicit transaction boundaries.

## Forbidden Drift

- Do not introduce feature-specific transaction helpers under `src/database`.
- Do not duplicate `setAutoCommit`/`commit`/`rollback` boilerplate in clean repositories when the shared transaction helper fits.
