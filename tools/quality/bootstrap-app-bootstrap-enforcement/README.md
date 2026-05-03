# Bootstrap AppBootstrap Enforcement Bundle

This bundle co-locates the currently active SaltMarcher checks that back
`docs/project/architecture/enforcement/bootstrap-app-bootstrap-enforcement.md`.

It keeps the proof surface strict and role-local:

- `archunit/`
  `architecture.bootstrap.appbootstrap.AppBootstrapArchitectureTest`
- `bundle.properties`
  descriptor-based registration into the focused-enforcement Gradle path

This bundle proves only the `AppBootstrap`-local shell-host composition
boundary. Generic bootstrap discovery-root and startup-metadata proofs stay in
the bootstrap-layer path instead of widening this role bundle.

Unified root entrypoint:

- `./gradlew checkBootstrapAppBootstrapEnforcement --rerun-tasks --console=plain`
