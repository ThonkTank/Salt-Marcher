# SaltMarcher

SaltMarcher is a local-first tabletop-campaign desktop tool for preparing,
running, and following up on a GM's own table.

SaltMarcher is being rebuilt as a native Godot 4 project. The Godot runtime is
the only target architecture. The JavaFX/SQLite tree remains temporarily as
migration input and is removed capability by capability; it is not a second
supported product line.

## Quickstart

Run the Godot application from the repository root:

```bash
godot --path .
```

Run the current headless foundation tests:

```bash
godot --headless --path . --script res://godot/tests/run_all.gd
```

Install the currently committed Godot development build for local desktop
testing (the installer refuses a dirty worktree):

```bash
godot/tools/install_desktop_app.sh
```

This development install contains only the Godot project and icon and launches
through the locally installed Godot 4 executable. Self-contained Linux,
Windows, and macOS exports remain a product qualification gate.

On restricted machines, point Godot's XDG data, cache, and config directories
at writable locations before running it.

## Local Data

The Godot application stores installation state below
`user://salt-marcher/`. Campaign identity and activation are already stored as
immutable, checksummed JSON generations. Campaign truth uses immutable
owner-partition generations and can round-trip through a streaming,
checksummed `.saltmarcher` bundle under a new import identity. Reusable
definitions live installation-wide in immutable generations; Campaigns store
stable references, complete export closes over required definitions, and
conflicting imports remain staged until an explicit keep, replace, retain-both,
or discard decision. The Campaign desk exposes that complete transfer path as
a non-blocking worker with visible file/definition progress and cancellation;
its conflict ledger names affected Campaigns and shows every consequence before
publication. The current
backend also schedules restore-tested recovery points in the background,
supports retained-original restore and recoverable trash, and provides
explicitly confirmed permanent deletion. Backup retention and storage-pressure
handling now preserve a 2 GiB floor and at least three verified points. Normal
maintenance keeps all points for one hour, then one per hour, day, and week
through 26 weeks, with a configurable hard point cap. Revoked-writer
compaction removes only old commits and partition objects whose exact bytes are
already covered by a current restore-tested point; damaged evidence defers the
operation. Asset/chunk compaction, automatic active-Campaign orchestration, and
the cross-platform total-volume probe remain migration work.
Recovery points share unchanged Campaign bytes through content-addressed blobs;
portable `.saltmarcher` bundles remain the transfer format. No Godot code opens
SQLite or JDBC.
The complete target persistence and recovery semantics are owned by the
[Persistence Lifecycle](docs/project/contract/persistence-lifecycle.md).

Pre-completion Java SQLite data is disposable under the confirmed product
baseline and is deliberately not imported into the Godot format.

## Project Map

- `project.godot`: Godot project entry point
- `godot/src/app/`: application composition and lifecycle
- `godot/src/ui/`: reusable and shell presentation
- `godot/src/platform/`: feature-neutral Godot mechanisms
- `godot/src/capabilities/`: product capabilities as they are migrated
- `godot/tests/`: headless Godot verification
- `docs/`: canonical product, architecture, contract, and migration truth
- `app/`, `shell/`, `platform/`, `features/`: temporary Java migration source

Start with [docs/README.md](docs/README.md) for the documentation map and the
[Godot cutover roadmap](docs/project/delivery/roadmap-godot-cutover.md) for the
live migration state.
