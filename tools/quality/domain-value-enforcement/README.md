# Domain Value Enforcement Bundle

This bundle co-locates all currently active SaltMarcher checks that back
`docs/project/architecture/enforcement/domain-value-enforcement.md`.

It makes this directory the canonical home for the value-role checker, the
value-owned documentation coverage rule, and the focused bundle metadata:

- `errorprone/`
  `DomainValueShape`
- `build-harness/`
  `DomainValueEnforcementDocumentationRules`
- `bundle.properties`
  descriptor-based registration into the focused-enforcement Gradle path
- `root-host.gradle.kts`
  root-project compiler and aggregate-task wiring
- `errorprone-host.gradle.kts`
  included-build wiring for the `quality-rules-errorprone` host
- `build-harness-host.gradle.kts`
  included-build wiring for the `build-harness` host

Unified root entrypoint:

- `./gradlew checkDomainValueEnforcement --rerun-tasks --console=plain`
