# Domain Specification Enforcement Bundle

This bundle co-locates the currently active SaltMarcher checks that back
`docs/project/architecture/enforcement/domain-specification-enforcement.md`.

It keeps the proof surface strict and role-local:

- `errorprone/`
  `DomainSpecificationRoleShape`
- `bundle.properties`
  descriptor-based registration into the focused-enforcement Gradle path
- `root-host.gradle.kts`
  root-project compiler wiring and aggregate-task entrypoint
- `errorprone-host.gradle.kts`
  included-build wiring for the `quality-rules-errorprone` host

This bundle currently proves only the role-shape rule for tactical
`specification/` types. The remaining "non-ceremonial role use" semantics stay
review-owned in the owning enforcement document.

Unified root entrypoint:

- `./gradlew checkDomainSpecificationEnforcement --rerun-tasks --console=plain`
