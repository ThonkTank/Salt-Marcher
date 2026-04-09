# Database Maintenance

## Purpose

`database/maintenance` owns explicit shared database tooling that is outside the normal startup path.

## Canonical Types and APIs

- `MaintenanceObject.inspectDatabase(InspectDatabaseInput)` - read-only database inspection - returns path, existence, discovered tables, and optional row counts.
- `MaintenanceObject.backupDatabase(BackupDatabaseInput)` - shared database backup seam - copies the current or requested SQLite file to an explicit backup path.
- `MaintenanceObject.resetDatabase(ResetDatabaseInput)` - explicit maintenance reset seam - currently supports only the `dungeon` reset target.

## Where New Code Goes

- Put shared backup, reset, and inspection tooling here instead of scattering it across scripts or feature owners.
- Keep maintenance requests explicit and narrow; add new reset targets only when they are durable shared maintenance capabilities.

## Forbidden Drift

- Do not move startup schema, seeding, or additive compatibility work out of `database/setup`.
- Do not turn maintenance requests into free-form SQL execution or arbitrary table-dropping APIs.
