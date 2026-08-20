# Development Persistence Contract

## Boundary

Until the first real-use format release, SaltMarcher has a disposable
development-data format. `installation.sqlite` contains installation-wide
registry and settings truth; each Campaign has the separate
`campaigns/<id>/campaign.sqlite` store. The utility process is the sole owner
of SQLite connections, SQL, schema initialization, and recovery work.

The renderer receives validated, immutable results through the preload bridge;
it never receives a database path, connection, or SQL capability. Electron
main owns process lifecycle and permissions, but does not execute domain SQL.

## Current Development Format

The current development format may be recreated when its greenfield schema
changes. It has no legacy Java-data reader, generic persistence coordinator,
feature-store ledger, owner readiness phase, compatibility adapter, or
conversion promise. SQLite and prepared statements stay with the aggregate
that owns their truth.

At startup, a whole-database version mismatch causes the application to remove
only its fixed `development-data` directory and build the current schema from
scratch. This is the intentionally minimal no-legacy behavior: incompatible
rows are discarded automatically, while unrelated sibling paths and failures
other than a version mismatch are left untouched and reported normally.

Campaign creation is an explicit exception to a single-file transaction:

```text
installation registry row: creating
        -> staged campaign SQLite store
        -> ready registry row + active pointer
```

Only `ready` Campaigns are observable or activatable. Startup reconciles a
leftover `creating` row deterministically: a valid staged/final store is
finished, while any incomplete or invalid store and its registry row are
removed. The result is never a visible half-Campaign.

Campaign replacement and Campaign import use one persisted publish lifecycle:

```text
staged -> validated -> swapped -> reopened -> registered -> verified -> finalized
```

`CampaignLifecycleCoordinator` is the sole owner of the invariant spanning the
campaign filesystem, active connection, installation registry, import
registration, and domain readback. Those resources expose narrow ports; import
adds its registration and aggregate verification but does not run a second
publish or recovery saga. Before the atomic registry commit, recovery restores
the last validated Campaign. At or after that commit, recovery accepts the new
Campaign only after store and registry readback. Replacement storage is cleaned
only after both checks, so a failed restart never discards the only recoverable
validated image. The persisted directory receipt is migrated in place from its
previous schema; the installation and Campaign database formats are unchanged.

## Release Boundary

The format is frozen only at the first accepted real-use release. Any later
format migration, backup, recovery, import/export, or compatibility guarantee
must be specified and qualified in the vertical slice that introduces it.

## References

- [Electron Target Architecture](../architecture/target-architecture.md)
- [Campaign Registry Persistence Contract](../../campaign/contract/contract-campaign-registry-persistence.md)
