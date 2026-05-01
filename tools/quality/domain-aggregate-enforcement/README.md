# Domain Aggregate Enforcement Bundle

This bundle co-locates all currently active SaltMarcher checks that back
`docs/project/architecture/enforcement/domain-aggregate-enforcement.md`.

It keeps the proof surface strict and role-local:

- `errorprone/`
  `DomainAggregateRoleShape`
- `build-harness/`
  `DomainAggregateEnforcementDocumentationRules`
- `bundle.properties`
  descriptor-based registration into the focused-enforcement Gradle path
- `root-host.gradle.kts`
  root-project compiler and aggregate-task wiring
- `errorprone-host.gradle.kts`
  included-build wiring for the `quality-rules-errorprone` host
- `build-harness-host.gradle.kts`
  included-build wiring for the `build-harness` host

This bundle currently proves only the role-shape rule for tactical
`aggregate/` types. The remaining consistency-boundary semantics stay
review-owned in the owning enforcement document.

Unified root entrypoint:

- `./gradlew checkDomainAggregateEnforcement --rerun-tasks --console=plain`
