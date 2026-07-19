Status: Active Target
Owner: SaltMarcher Team
Last Reviewed: 2026-07-19
Source of Truth: Shared SQLite location, owner-scoped readiness, connection,
migration, integrity, backup, and recovery semantics.

# Persistence Lifecycle

## Purpose And Boundary

SaltMarcher uses one local SQLite database. Platform persistence owns physical
file safety, connection configuration, the feature-version ledger, owner-scoped
preparation, backup, and recovery. Feature SQLite adapters own their stored
truth, target schema signatures, semantic row validation, and migration bodies.

`app` composes immutable `FeatureStoreDefinition` values before it constructs
feature services. Preparation returns one `FeatureStoreReadiness` per owner.
Ready features receive only their `FeatureStoreHandle`; they never receive the
global registry or another owner's plan. An explicit reference-data maintenance
route may additionally receive its owner's separate `FeatureStoreMaintenance`
capability. That single capability creates the verified recovery point and opens the
subsequent write connection from the same database lifecycle. It is never composed into
normal desktop startup. Ordinary handles do not expose backup operations.

API, domain, application, JavaFX, Catalog, and shell code do not access JDBC,
database files, or migration types.

## Location And Connection

The database remains `game.db` below:

- `$XDG_DATA_HOME/salt-marcher/` when `XDG_DATA_HOME` is non-blank;
- `${user.home}/.local/share/salt-marcher/` otherwise.

Every writable connection enables and verifies WAL mode, enables foreign keys,
uses a 5000 ms busy timeout, and uses SQLite `NORMAL` synchronous mode.
Connections are operation-scoped and closed by the owning adapter.

Opening a handle connection validates only platform compatibility and that
handle's prepared owner. It MUST NOT iterate, validate, or migrate other
registered owners. Opening an unprepared handle fails without creating or
mutating the database.

## Definitions, Preparation, And Readiness

`FeatureStoreDefinition` contains one stable lowercase owner key, target
version, contiguous monotonic migration steps beginning at `1`, and a final
owner validator. Definitions are immutable after composition. Registering or
discovering a migration as a side effect of opening a connection is forbidden.

Before feature services start, the coordinator:

1. loads the driver and verifies the primary database or initializes an empty one
2. reads platform and owner versions without mutation
3. rejects a newer platform globally without replacement or downgrade
4. creates and restore-tests one verified pre-migration snapshot when any
   supported owner has pending work
5. prepares owners in deterministic composition order, one transaction per owner
6. validates the owner's declared target schema signature, full physical integrity,
   and foreign keys before each commit
7. returns immutable readiness for every owner

Readiness is:

- `READY`: the owner version and declared table, column, primary-key, required
  foreign-key, and required-index signatures match the supported target, and
  global physical and foreign-key integrity succeeded
- `MIGRATION_FAILED`: a supported migration or owner validation rolled back
- `NEWER_SCHEMA`: stored owner version is newer than this application
- `CORRUPT`: physical integrity prevents safe access

`MIGRATION_FAILED` and `NEWER_SCHEMA` fail closed for that owner only. They do
not prevent unrelated ready handles from opening connections. Physical database
corruption and a newer platform version remain global because no safe shared
file access exists.

A table declaration is exact by default. A read-only provider MAY instead
declare a required column projection when additional provider-owned columns are
compatible and must remain untouched. That opt-in still fails on every missing
required column and on mismatched declared keys or indexes; it does not weaken
exact declarations for application-owned schemas.

No feature may enqueue a persistence operation before its readiness is known.
An unavailable feature exposes its existing typed storage or availability
result and performs no write.

Startup readiness does not scan the feature corpus for semantic row validity.
Providers validate semantic rows on their normal typed read/write routes and
fail closed through their feature-owned error contract.

## Migration Contract

`PRAGMA user_version` owns the platform format. `sm_schema_versions` maps one
owner to its current feature version.

Each migration:

- runs once inside the coordinator-owned owner transaction
- is idempotent but never changes auto-commit, commits, or updates the ledger itself
- reads and writes only its feature's stored truth
- recognizes every supported predecessor through explicit structural validation
- aborts before destructive work when the stored signature is unknown
- copies and validates replacement rows before dropping or renaming predecessor tables

One narrow legacy-compatibility case is permitted: renaming an owner table may
let SQLite retarget inbound foreign keys from documented, code-ownerless legacy
tables to an immutable archive of that table. Before any mutation, the migration
MUST inventory every inbound foreign key plus every view and trigger definition
that a rename could rewrite, match the complete legacy table signatures and
complete foreign-key sets, and reject every unknown, additional, or
registered-owner reference. The transaction MUST retain
all referenced rows and payloads, keep global foreign-key integrity, and leave the
archives outside current provider APIs. This exception does not permit writing a
registered feature owner's schema or interpreting its domain truth.

The coordinator records the new owner version only after the migration action
and final target-signature validator succeed. Failure rolls back schema, rows,
and owner version for that transaction.

An already recorded version never changes meaning. Supporting another legacy
shape requires a new migration or an explicitly versioned predecessor
translator, not rewriting a released step.

## Backup And Recovery

Before first mutation of an existing healthy database, platform persistence
runs full `integrity_check` and `foreign_key_check`, creates a WAL-consistent
snapshot with `VACUUM INTO`, verifies it, copies it to an isolated restore
probe, verifies the probe, and only then permits owner migration.

The local backup name embeds the compatible platform version. Migration failure
never replaces the primary with a backup and never deletes the verified backup.

If the primary is physically corrupt, the lifecycle may restore the highest
verified backup whose platform version is supported. It first preserves the
complete corrupt database family under a local quarantine name, verifies the
restored primary, and keeps the backup. Unknown newer versions are not
corruption and never trigger recovery.

An explicit feature maintenance operation that replaces reference data requests
a feature-named maintenance backup through its separately injected maintenance
capability immediately before its transaction. The same capability supplies the later
owner connection, so composition cannot back up one physical database and mutate another.
It exposes only an opaque receipt; it cannot reveal the physical path or another owner's
definition. Startup does not receive maintenance authority and does not perform external
imports or paid/network work.

## Execution And Shutdown

The persistence lifecycle does not impose one global application execution
queue. Independent reads may use a bounded I/O executor. A feature that requires
ordered mutations owns a serial mutation lane or transaction boundary for that
truth.

Shutdown first prevents new application work, then drains feature executors,
then closes the persistence lifecycle. A closed or unready handle rejects work
with a typed local failure and never opens JDBC.

## Errors, Privacy, And Proof

Technical diagnostics use stable ids, owner key, operation class, readiness,
and failure class only. They do not contain paths, SQL, exception messages,
secrets, or user-authored content and are not transmitted.

Automated proof uses isolated synthetic databases and covers:

- each supported predecessor schema and repeated reopen
- an unrelated owner with a newer version while a ready owner remains usable
- owner migration and validation rollback with byte-equivalent owned rows
- a target-version owner with a missing or wrong table signature becoming
  `MIGRATION_FAILED` while an unrelated valid owner remains usable
- startup that cannot execute feature storage work before readiness
- verified backup, restore probe, physical corruption recovery, quarantine, and
  no-compatible-backup fail-closed behavior

Automated proof never opens, copies, migrates, corrupts, or restores real local
user data. Real-data migration requires an owner-approved restore-tested backup
and rehearsal against an isolated copy. The operator snapshot uses SQLite's online
snapshot semantics, is stored with owner-only permissions, and is copied again for the
destructive rehearsal. The rehearsal executable requires an explicit absolute copy path
and rejects the installed application-data directory.

## References

- [Source Architecture](../architecture/source-architecture.md)
- [Application Composition](../architecture/patterns/application-composition.md)
- [Catalog Architecture](../../catalog/architecture/architecture-catalog.md)
- [Resource Policy](../policies/resource-policy.md)
- Feature persistence contracts under `docs/<feature>/contract/`
