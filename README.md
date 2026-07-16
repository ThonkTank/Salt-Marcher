# SaltMarcher

SaltMarcher is a local-first JavaFX tabletop-campaign tool for map travel,
dungeon editing, session planning, catalog data, encounters, and party state.

## Quickstart

Run the app from the repository root:

```bash
./gradlew run --console=plain
```

Install the desktop app after a green check:

```bash
./gradlew installDesktopApp --console=plain
```

## Local Data

SaltMarcher stores SQLite data below the XDG data directory. If
`XDG_DATA_HOME` is set, data lives in `$XDG_DATA_HOME/salt-marcher/`; otherwise
it lives in `~/.local/share/salt-marcher/`. The current database file is
`game.db`; the resolving rule is owned by
`src/data/persistencecore/sqlite/AbstractSqliteConnectionFactory.java`.

## Bugs And Requests

Use the GitHub issue templates for bug reports, feature requests, and UX
problems. Owner-facing templates are in German and ask for reproduction,
expected behavior, impact, screenshots or video, acceptance, and affected app
surface.

## Project Map

- `bootstrap/`: explicit application startup and composition
- `shell/`: generic shell API and host runtime
- `src/features/`: feature-runtime implementations for migrated surfaces
- `src/domain/`: domain models, use cases, published state, and ports
- `src/data/`: local persistence gateways, mappers, schemas, and SQLite support
- `src/view/`: legacy JavaFX view contributions and controls
- `docs/`: canonical project and feature documentation
- `tools/`: Gradle build logic, quality configuration, and local tools

Start with `AGENTS.md` for agent workflow rules and
`docs/project/README.md` for the canonical documentation map.
