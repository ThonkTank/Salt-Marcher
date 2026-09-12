# Persistence and Profile Maintenance Contract

## Boundary

The planned first public Electron real-use release is 0.3.0. The existing
0.2.0-named fixture is an internal baseline, not proof of a published Electron
release. The current data formats are Installation 43 and Campaign 43; their
versions are independent from the application version. Release acceptance remains pending under the
[maintenance roadmap](../architecture/release-maintenance-roadmap.md).
Every later public release must retain a tested, complete forward migration path
from every earlier public release. Packaged data is never implicitly reset.
Development data remains isolated, and normal startup preserves incompatible profiles.

`installation.sqlite` contains installation-wide registry and settings truth;
each Campaign has the separate `campaigns/<id>/campaign.sqlite` store. The utility
process is the sole application owner of SQLite connections and recovery work.

The renderer receives validated, immutable results through the preload bridge;
it never receives a database path, connection, or SQL capability. Electron
main owns process lifecycle and permissions, but does not execute domain SQL.

## Campaign lifecycle

Development, Local and Release startup preserve existing data. Creating an empty
profile requires an explicit user action. Unsupported schemas,
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

The complete Release profile is isolated at `$XDG_DATA_HOME/salt-marcher/profile`,
with campaign data in its `campaign-data` subdirectory. If XDG_DATA_HOME is unset,
the root is `~/.local/share/salt-marcher`. All campaign stores, recoverable trash,
installation settings, profile preferences, user files and empty directories
participate in one maintenance operation. Browser cache/storage lives outside
the portable profile. Development and Local retain separate roots.

The utility process snapshots locked sources without changing their bytes, uses
SQLite Online Backup on that snapshot, migrates a separate working tree, validates
integrity, foreign keys and campaign/party/scene readback, and returns the prepared tree to the shared maintenance coordinator.
Its single journal binds data and executable deployments, records intent before
moves, and records completion only after target startup.
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

Linux Development, Local and Release use one canonical external profile lock;
Local and Release also retain the older runtime.lock for compatibility. A shared
lock alone does not qualify an arbitrary old producer for direct import.

Direct folder import admits only the `profile` directory of an installed source
whose completed maintenance journal, current deployment link, unchanged AppImage,
validated launcher and embedded `canonical-profile-v1` complete-profile protocol
agree. The protocol also requires browser storage outside the portable profile.
Source launch and runtime leases remain held during admission, complete export
and final provenance verification. Aliased source/target paths are canonicalized;
overlapping profiles and running sources are rejected. Admission never repairs
the source. The actual installed Local import, native chooser, source-lock
rejection and retry have retained full-content evidence in the
[acceptance matrix](../architecture/release-maintenance-acceptance-matrix.md#native-whole-profile-import-qualified-2026-09-10).

The UI also accepts manifest-bearing backups. Format 2 inventories the complete
profile, including files and empty directories. Historical format 1 covers only
campaign data and is labelled “Ältere Kampagnendatensicherung”; it cannot recover
profile preferences or files it never contained. Both formats replace the complete
profile; additional current files survive in the mandatory protective backup,
not in the restored profile. Import does not merge profiles.
Inventory and hashes are checked, and migration uses a separate working copy.
Sources without the qualified installed protocol require a consistent, validated
backup from their source application. Arbitrary raw Development or legacy profile
folders are not supported by direct import. The diagnostic JSON from
scripts/export-development-data.ts declares supportedMigrationContract:false and
is not such a backup. Java import is excluded.

Backups produced by the current profile transaction have inventory/hash validation;
public acceptance additionally requires the complete-content and concurrency cases
in the [acceptance matrix](../architecture/release-maintenance-acceptance-matrix.md).
A newer schema or incomplete migration path must be rejected before replacement.
Restoration preserves the current profile first and migrates only a working copy.
No implicit database downgrade, profile reset or backup pruning is permitted.

## Maintenance ownership

Local and Release use the shared maintenance coordinator and journal. Main/headless
runtime owns locking, process lifecycle and executable activation; Utility owns
snapshots, migrations and semantic readback. Aggregate owners retain SQL. Handoff
receipts remain provenance evidence only. Existing journals are admitted through
validated legacy adapters before new maintenance starts. Complete-profile transport
and recovery without a working campaign database have automated acceptance evidence.
The [execution log](../../roadmap-execution.md) records their exact artifacts and
separates that evidence from the still-pending final live acceptance and publication.
For user actions, see [Linux operation](../../releases/linux-operation.md).
