# Domain Service Enforcement Bundle

This bundle co-locates the currently active SaltMarcher checks that back
`docs/project/architecture/enforcement/domain-service-enforcement.md`.

It keeps the full service-role proof route in one package:

- `errorprone/`
  `DomainServiceRoleShape`,
  `DomainServiceStatelessness`
- `build-harness/`
  `DomainServiceEnforcementDocumentationRules`
- `bundle.properties`
  descriptor-based registration into the focused-enforcement Gradle path
- `root-host.gradle.kts`
  root-project compiler, aggregate-task, and full-build hook wiring
- `errorprone-host.gradle.kts`
  included-build wiring for the `quality-rules-errorprone` host
- `build-harness-host.gradle.kts`
  included-build wiring for the `build-harness` host

This bundle owns only the tactical `service/` role itself. Generic
named-module topology, model-role communication boundaries, and broader
domain-layer invariants stay in their neighboring owner bundles and
documents.

Unified root entrypoint:

- `./gradlew checkDomainServiceEnforcement --rerun-tasks --console=plain`
