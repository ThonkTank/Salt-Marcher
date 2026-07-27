# SaltMarcher

SaltMarcher is a local-first JavaFX tabletop-campaign tool for map travel,
dungeon editing, session planning, catalog data, encounters, and party state.

## Quickstart

Run the app from the repository root:

```bash
./gradlew run --console=plain
```

## Local Data

SaltMarcher stores SQLite data below the XDG data directory. If
`XDG_DATA_HOME` is set, data lives in `$XDG_DATA_HOME/salt-marcher/`; otherwise
it lives in `~/.local/share/salt-marcher/`. The current database file is
`installation.sqlite`; Campaign data is stored separately under
`campaigns/<id>/campaign.sqlite`. Location and lifecycle rules are owned by the
[Persistence Lifecycle contract](docs/project/contract/persistence-lifecycle.md).

## Project Map

- `app/`: explicit application startup, composition, and lifecycle
- `shell/`: generic shell API and host runtime
- `platform/`: feature-neutral execution, persistence, diagnostics, state, and UI mechanisms
- `features/`: vertical feature APIs, domains, applications, adapters, and composition roots
- `resources/`: static resources and centralized application styling
- `docs/`: canonical project and feature documentation

Start with `docs/README.md` for the documentation map.
