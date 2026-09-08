# Development Persistence Contract

## Boundary

The planned first public Electron real-use release is 0.3.0. The existing
0.2.0-named fixture is an internal baseline, not proof of a published Electron
release. Installation schema 39 and Campaign schema 34 are versioned independently
from the application. Release acceptance remains pending under the
[maintenance roadmap](../architecture/release-maintenance-roadmap.md).
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

## Source compatibility for the planned public baseline

Format compatibility and source consistency are separate admission checks. Both
must pass before activation. Existing migration edges are retained; a path alone
is not evidence of preserved user content. Installation 39 / Campaign 34 is the
frozen internal baseline. Older role-version combinations need a complete path
and representative semantic fixtures before being advertised as supported.
Unknown old versions remain unqualified, not silently reset or deleted.

Future Development, Local and Release profile folders must cooperate with the same
canonical-path lock for direct import. Existing Local profiles use runtime.lock,
but complete cross-channel/alias qualification remains open. Pre-baseline
Development and legacy Electron folders have no established exclusive import
contract. They require a complete, consistent, validated backup/export from a
qualified producer; no historical producer version is currently qualified.
The diagnostic JSON from scripts/export-development-data.ts explicitly declares
supportedMigrationContract:false and is not such an export. Java import is excluded.

Backups produced by the current profile transaction have inventory/hash validation;
public acceptance additionally requires the complete-content and concurrency cases
in the [acceptance matrix](../architecture/release-maintenance-acceptance-matrix.md).
A newer schema or incomplete migration path must be rejected before replacement.
Restoration preserves the current profile first and migrates only a working copy.
No implicit database downgrade, profile reset or backup pruning is permitted.

## Maintenance ownership transition

The current implementation has separate Release data and activation journals plus
Local installer recovery. This is an implementation gap, not the target contract.
Phase 2 replaces their recovery authority with one installation maintenance journal
and coordinator. Main/headless runtime owns locking, process lifecycle and executable
activation; Utility owns snapshots, migrations and semantic readback. Aggregate
owners retain SQL. Handoff receipts remain provenance evidence only. Existing
journals must finish under validated legacy recovery before new maintenance starts.
