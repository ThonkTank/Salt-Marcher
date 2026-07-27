# Persistence Lifecycle

## Purpose And Boundary

SaltMarcher uses one installation-owned SQLite database plus one physically
separate SQLite database per Campaign. Platform persistence owns physical file
safety, connection configuration, each file's feature-version ledger,
owner-scoped preparation, backup, and recovery. Feature SQLite adapters own
their stored truth, target schema signatures, semantic row validation, and
migration bodies. Installation-owned registry and reusable definitions never
share a database with Campaign-owned truth.

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

The installation store is `installation.sqlite` below:

- `$XDG_DATA_HOME/salt-marcher/` when `XDG_DATA_HOME` is non-blank;
- `${user.home}/.local/share/salt-marcher/` otherwise.

Campaign stores live below the sibling `campaigns/` directory, one reserved
SQLite file per stable Campaign identity. Desktop startup opens only the
installation store and the durably selected Campaign store. It never opens the
former mixed-store filename `game.db`.

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
2. validates the exact direct current-v1 platform ledger and its complete bound
   object inventory through an immutable read-only connection before reading any
   owner version when the source has no sidecar
3. rejects a malformed or newer platform globally without replacement, downgrade,
   WAL activation, or source transaction
4. validates every already-current or newer owner immutable read-only; an existing
   rollback-journal family is first materialized as one coherent disposable inspection,
   while a complete WAL-plus-SHM family is byte-copied without opening the source and
   materialized only from that copy; pending direct initialization prepares all owners
   on a disposable copy before source access
5. creates and restore-tests one verified pre-mutation snapshot only when at least
   one pending owner qualified successfully on that copy
6. prepares only those qualified pending owners against the source, in deterministic
   composition order and one transaction per owner
7. validates the owner's exact target DDL and complete bound object inventory,
   physical integrity, and foreign keys before each commit
8. returns immutable readiness for every owner

Owner-table dependencies, owned prefixes, and forbidden object names are matched
case-insensitively with locale-independent normalization. Because SQLite accepts
single-quoted identifiers in identifier positions, a single-quoted owner table in
stored view or trigger DDL is treated fail-closed as an owner dependency rather than
ignored as a string literal.

Readiness is:

- `READY`: the owner version and declared table, column, primary-key, required
  foreign-key, and required-index signatures match the supported target, and
  global physical and foreign-key integrity succeeded
- `MIGRATION_FAILED`: a supported migration or owner validation rolled back
- `NEWER_SCHEMA`: stored owner version is newer than this application
- `INCOMPATIBLE`: the sidecar family cannot be interpreted safely as one isolated
  source state, including WAL without SHM, SHM without WAL, mixed journal families,
  non-physical sidecars, or a family that changes while it is copied
- `CORRUPT`: physical integrity prevents safe access

`MIGRATION_FAILED` and `NEWER_SCHEMA` fail closed for that owner only. They do
not prevent unrelated ready handles from opening connections. Physical database
corruption, an incompatible sidecar family, and a newer platform version remain
global because no safe shared file access exists. Incompatibility is not evidence
of physical corruption and never authorizes recovery, quarantine, or replacement.

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
owner to its current feature version. Platform version `1` has one direct
canonical shape: `owner TEXT PRIMARY KEY` and `version INTEGER NOT NULL
CHECK(version >= 0)`, with no additional column, index, view, or trigger bound
to that ledger. A missing key/check, additional column, trigger, or otherwise
duplicate-capable ledger is a global incompatible platform shape and is not
repaired.

Each future released-format migration:

- runs once inside the coordinator-owned owner transaction
- is idempotent but never changes auto-commit, commits, or updates the ledger itself
- reads and writes only its feature's stored truth
- recognizes every supported predecessor through explicit structural validation
- aborts before destructive work when the stored signature is unknown
- copies and validates replacement rows before dropping or renaming predecessor tables

Compatibility obligations begin with the first released format.
Before the first released format, the current cut has no compatibility reader, mixed-store
conversion, or predecessor-format migration obligation. After the first released format,
`TN-18` governs update/conversion preservation and failure rollback, while
`TN-19` governs versioned export/import compatibility. Those future translators
must be explicit and qualified; they do not justify retaining an unused current
development storage topology.

The coordinator records the new owner version only after the migration action
and final target-signature validator succeed. Failure rolls back schema, rows,
and owner version for that transaction.

An already recorded version never changes meaning. Supporting another legacy
shape requires a new migration or an explicitly versioned predecessor
translator, not rewriting a released step.

## Backup And Recovery

Before first mutation of an existing healthy database, platform persistence
runs full `integrity_check` and `foreign_key_check`, creates one coherent
snapshot, verifies it, copies it to an isolated restore probe, verifies the
probe, and only then permits owner migration. A live WAL-plus-SHM family is copied
under matching before/after family tokens and materialized with SQLite snapshot
semantics only from that isolated copy; a sidecar-free quiescent main file is copied
under matching before/after identity tokens. Qualification therefore cannot activate
WAL, create SHM, checkpoint, or remove a sidecar on the source.

The local backup name embeds the compatible platform version. Migration failure
never replaces the primary with a backup and never deletes the verified backup.

If the primary is physically corrupt and its sidecar family was first classified as
safe to interpret, the lifecycle may restore the highest
verified backup whose platform version is supported. Before quarantine, it copies
each candidate in newest-first order to an isolated recovery file, validates the exact
platform manifest, prepares and validates every registered owner there, and requires
all owner readiness to be current. A malformed ledger or owner manifest therefore
leaves the complete primary family byte-for-byte authoritative and creates no
quarantine. Only a fully qualified copy permits preservation of the corrupt family
under a local quarantine name; the installed copy is validated again and the backup
is kept. Unknown newer versions are not
corruption and never trigger recovery. An orphan SHM, WAL without SHM, mixed
journal family, or changing source family fails closed byte-for-byte even when a
valid backup exists; those conditions never enter physical-corruption recovery.

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

## Errors, Privacy, And Recovery

Technical diagnostics use stable ids, owner key, operation class, readiness,
and failure class only. They do not contain paths, SQL, exception messages,
secrets, or user-authored content and are not transmitted.

Real-data migration requires a restore-tested backup and rehearsal against an
isolated copy. The operator snapshot uses SQLite's online
snapshot semantics, is stored with owner-only permissions, and is copied again for the
destructive rehearsal. The rehearsal executable requires an explicit absolute copy path
and rejects the installed application-data directory.

## References

- [Source Architecture](../architecture/source-architecture.md)
- [Application Composition](../architecture/patterns/application-composition.md)
- [Catalog Architecture](../../catalog/architecture/architecture-catalog.md)
- Feature persistence contracts under `docs/<feature>/contract/`
