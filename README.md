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

On restricted machines, point Godot's XDG data, cache, and config directories
at writable locations before running it.

## Local Data

The Godot application stores installation state below
`user://salt-marcher/`. Campaign identity and activation are already stored as
immutable, checksummed JSON generations. Campaign truth uses immutable
owner-partition generations and can round-trip through a streaming,
checksummed `.saltmarcher` bundle under a new import identity. The current
backend also schedules restore-tested recovery points in the background,
supports retained-original restore and recoverable trash, and provides
explicitly confirmed permanent deletion. Backup retention and storage-pressure
handling are still migration work. No Godot code opens SQLite or JDBC.
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
