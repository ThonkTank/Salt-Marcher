# Bootstrap Layer Enforcement Bundle

This bundle co-locates the currently active SaltMarcher checks that back
`docs/project/architecture/enforcement/bootstrap-enforcement.md`.

It keeps the bootstrap-layer proof surface bundle-local:

- `build-harness/`
  `BootstrapLayerTopologyRules` and `BootstrapLayerTopologyCheckMain`
- `archunit/`
  `architecture.bootstrap.layer.BootstrapLayerArchitectureTest`
- `bundle.properties`
  descriptor-based registration into the focused-enforcement Gradle path
- `root-host.gradle.kts`
  root-project ArchUnit, aggregate-task, and focused-entry wiring
- `build-harness-host.gradle.kts`
  included-build wiring for the `build-harness` host

This bundle proves only bootstrap-layer discovery-root scope, bootstrap-consumed
generic registration contracts, startup default-landing checks, and bootstrap's
independence from feature implementation code. `AppBootstrap` role behavior,
shell-host privacy, and neighboring view/data owner rules stay outside this
bundle.

Unified root entrypoint:

- `./gradlew checkBootstrapLayerEnforcement --rerun-tasks --console=plain`
