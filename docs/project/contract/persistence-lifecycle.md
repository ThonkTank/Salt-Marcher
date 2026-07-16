Status: Active Target
Owner: SaltMarcher Team
Last Reviewed: 2026-07-16
Source of Truth: Shared SQLite location, connection, migration execution,
integrity, backup, and recovery contract.

# Persistence Lifecycle

## Purpose And Boundary

SaltMarcher uses one local SQLite database. This contract owns only the shared
database lifecycle consumed by feature SQLite adapters. Feature persistence
contracts remain the owners of stored truth, schemas, row validation, and
migration bodies.

`app` owns one `platform.persistence` lifecycle instance and closes it after
the execution lane has drained. SQLite adapters receive feature-scoped
connection sources from that instance. API, domain, application, JavaFX, and
shell code MUST NOT access JDBC or database files.

## Compatible Location And Connection

The database file remains `game.db` below:

- `$XDG_DATA_HOME/salt-marcher/` when `XDG_DATA_HOME` is non-blank;
- `${user.home}/.local/share/salt-marcher/` otherwise.

Every writable connection MUST enable and verify WAL journal mode, enable
foreign keys, use a 5000 ms busy timeout, and use SQLite `NORMAL` synchronous
mode. Connections are operation-scoped and closed by the consuming adapter;
the shared lifecycle retains no open JDBC connection.

## Version And Migration Contract

`PRAGMA user_version` owns the platform lifecycle schema version. Version `1`
introduces the feature migration ledger `sm_schema_versions`. A database with a
newer platform or feature version MUST fail closed without replacement or
downgrade.

Each feature registers one stable lowercase owner key and a contiguous
monotonic migration sequence beginning at `1`. Registration order in app
composition is execution order. All registered pending migrations run once in
one SQLite transaction before the requested feature operation receives its
connection. A migration MUST be idempotent, MUST NOT commit or change
auto-commit itself, and MUST update only schema and stored truth owned by its
feature. A failure rolls back schema, data, platform version, and feature
version together.

The compatibility floor is an existing pre-ledger database at platform and
feature version `0`. The initial feature readiness migrations are recorded as
each feature's version `1` migration. Later schema changes add a new ordered
step; they MUST NOT rewrite the meaning of an already recorded version.

## Integrity, Backup, And Recovery

Before the lifecycle first mutates an existing healthy database, the platform
MUST run full `integrity_check` and `foreign_key_check`, then create a
WAL-consistent SQLite snapshot with `VACUUM INTO`. The local backup name embeds
the compatible platform version as `game.db.backup-vN.sqlite`. A replacement
backup is accepted only after the same integrity checks succeed.

If the primary is physically corrupt, the lifecycle MAY restore the highest
verified backup whose platform version is not newer than the application. It
MUST first preserve the corrupt primary and its active WAL/SHM or rollback-
journal sidecars under a local quarantine name, MUST verify the recovered
primary, and MUST leave the backup intact. If no verified compatible backup
exists, recovery fails closed and the complete database family remains byte-
for-byte untouched. An unknown newer version is not corruption and MUST never
trigger recovery.

After pending migrations, integrity and foreign-key checks MUST pass before
commit. Logical feature-row validation and feature-specific error statuses
remain owned by the feature contracts.

## Errors, Privacy, And Proof

Lifecycle failures surface as storage failure through existing feature-owned
result vocabularies. Technical diagnostics use stable IDs plus failure classes
only; paths, SQL, exception messages, secrets, and authored content MUST NOT be
recorded or transmitted.

Automated proof MUST use isolated temporary databases. Recovery qualification
requires a verified snapshot, physical corruption of the isolated primary,
successful restore with semantic row readback, quarantine preservation, and a
no-backup case that proves fail-closed byte preservation. Automated proof MUST
NOT open, copy, migrate, corrupt, or restore real local user data.

## References

- [Source Architecture](../architecture/source-architecture.md)
- [Application Composition](../architecture/patterns/application-composition.md)
- [Resource Policy](../policies/resource-policy.md)
- Feature persistence contracts under `docs/<feature>/contract/`
