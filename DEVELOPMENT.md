# Development

## Prerequisites

- Linux
- JDK 21
- Bash, Git, and the checked-in Gradle wrapper
- ImageMagick for packaging checks

## Verification

Run from the repository root:

```bash
./gradlew check
./gradlew test
./gradlew uiTest
./gradlew architectureTest
./gradlew installDesktopApp
```

Only `check` is required. The other verification tasks are diagnostics.
JavaFX tests use headless Monocle and do not require Xvfb.

## Project Shape

- `bootstrap/`: explicit application startup and composition
- `shell/`: generic shell API and host runtime
- `src/features/**`: feature runtime
- `src/view/**`: JavaFX views
- `src/domain/**`: domain behavior, state, and ports
- `src/data/**`: local persistence and SQLite adapters
- `tools/gradle/**`: build and verification wiring

Local data resolves to `$XDG_DATA_HOME/salt-marcher/` or
`~/.local/share/salt-marcher/`.
