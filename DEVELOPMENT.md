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

- `app/`: explicit application startup, composition, and lifecycle
- `shell/`: generic shell API and host runtime
- `platform/`: feature-neutral execution, persistence, diagnostics, state, and UI mechanisms
- `features/**`: vertical feature APIs, domains, applications, adapters, and composition roots
- `resources/`: static resources and centralized application styling
- `tools/gradle/**`: build and verification wiring

Local data resolves to `$XDG_DATA_HOME/salt-marcher/` or
`~/.local/share/salt-marcher/`.
