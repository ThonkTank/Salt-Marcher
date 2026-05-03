# Shell Layer Enforcement Bundle

This bundle co-locates the currently active SaltMarcher checks that back
`docs/project/architecture/enforcement/shell-layer-enforcement.md`.

It keeps the proof surface strict and owner-local:

- `build-harness/`
  `ShellLayerTopologyRules` and `ShellLayerTopologyCheckMain`
- `archunit/`
  `architecture.shell.layer.ShellLayerArchitectureTest`
- `bundle.properties`
  descriptor-based registration into the focused-enforcement Gradle path

This bundle proves only shell-layer topology, shell API surface membership,
and shell-layer dependency/privacy boundaries for shell-owned code and
non-bootstrap consumers. The `AppBootstrap` host-composition exception proof,
bootstrap discovery, and data-root discovery stay outside this bundle.

Unified root entrypoint:

- `./gradlew checkShellLayerEnforcement --rerun-tasks --console=plain`
