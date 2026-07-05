# Development

## Prerequisites

- Linux
- JDK 21
- Bash, Python 3, Git, and Gradle through the checked-in wrapper
- `xvfb-run` for CI-style JavaFX behavior harnesses
- ImageMagick, required by the packaging conventions check; CI installs it,
  install it locally through the system package manager.

## Canonical Proof Commands

Run verification from the repository root.

```bash
tools/gradle/run-staged-verification.sh production-handoff
tools/gradle/run-staged-verification.sh focused-handoff --path <pkg> [--area <area>]
./gradlew checkDocumentationEnforcement --console=plain
tools/gradle/run-staged-verification.sh desktop-install
tools/gradle/run-observable-gradle.sh <task>
```

Use `desktop-install` only after a green production handoff. Use
`run-observable-gradle.sh` for long runs instead of looping many separate
Gradle calls.

## Troubleshooting

- Java version: verify `java -version` reports JDK 21.
- JavaFX startup: on headless machines run harnesses through `xvfb-run -a`.
- Gradle daemon/cache: prefer one combined observable run when locks appear.
- SQLite data dir: data resolves to `$XDG_DATA_HOME/salt-marcher/` or
  `~/.local/share/salt-marcher/`.
- Stylesheets/icons: check centralized stylesheet ownership before adding local
  node styling or bundled assets.
- CI versus local: CI runs fresh checkouts; local proof must be run from the
  repository root and reported literally.

## Architecture Map For Agents

- `bootstrap/` owns app bootstrap and contribution discovery.
- `shell/` owns the generic shell API and host runtime.
- `src/features/**` is the target home for migrated feature runtime.
- `src/view/**` is legacy JavaFX contribution code still used by the shell.
- `src/domain/**` owns domain decisions, use cases, published state, and ports.
- `src/data/**` owns local persistence and SQLite gateways.
- `tools/gradle/**` owns build and verification wiring.

Contribution discovery uses fixed roots, top-level classes with the
`*Contribution` suffix, and public no-argument constructors. The owner is
`bootstrap/ShellViewDiscovery.java`.

`main` is the next integration channel. The stable installation follows the
latest `v*` tag only.
