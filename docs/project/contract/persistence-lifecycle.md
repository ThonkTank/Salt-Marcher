# Development Persistence Contract

## Boundary

Release 0.2.0 establishes the persistent Electron real-use baseline. Installation
schema 39 and Campaign schema 34 are versioned independently from the application.
Every later public release must retain a tested, complete forward migration path
from every earlier public release. Packaged data is never implicitly reset.
Development-only reset behavior remains confined to the isolated development-data root.

`installation.sqlite` contains installation-wide registry and settings truth;
each Campaign has the separate `campaigns/<id>/campaign.sqlite` store. The utility
process is the sole application owner of SQLite connections and recovery work.

The renderer receives validated, immutable results through the preload bridge;
it never receives a database path, connection, or SQL capability. Electron
main owns process lifecycle and permissions, but does not execute domain SQL.

## Current Development Format

Development builds may recreate their fixed development-data directory under the
explicit reset policy. Local and Release data are preserved. Unsupported schemas,
missing forward paths, corruption and access errors never trigger a reset.

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

The Release profile is isolated at `$XDG_DATA_HOME/salt-marcher/profile/campaign-data`
(with the standard Linux data-home fallback). All campaign stores, recoverable trash,
installation settings and user files participate in one maintenance operation.

The utility process snapshots locked sources without changing their bytes, uses
SQLite Online Backup on that snapshot, migrates a separate working tree, validates
integrity, foreign keys and campaign/party/scene readback, then promotes the tree.
The application activation journal binds the old and new executable deployments.
The data journal records intent before moves and completion only after target startup.
Before completion recovery restores the prior pair; after completion later user work
must never be rolled back automatically. Backups are permanent and restoration first
backs up current data. The renderer receives validated status and backup IDs only.

## References

- [Electron Target Architecture](../architecture/target-architecture.md)
- [Campaign Registry Persistence Contract](../../campaign/contract/contract-campaign-registry-persistence.md)
