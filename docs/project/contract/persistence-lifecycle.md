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

## Release Boundary

The format is frozen only at the first accepted real-use release. Any later
format migration, backup, recovery, import/export, or compatibility guarantee
must be specified and qualified in the vertical slice that introduces it.

## References

- [Electron Target Architecture](../architecture/target-architecture.md)
- [Campaign Registry Persistence Contract](../../campaign/contract/contract-campaign-registry-persistence.md)
