# Domain ApplicationService Enforcement Bundle

This bundle co-locates the currently active SaltMarcher checks that back
`docs/project/architecture/enforcement/domain-application-service-enforcement.md`.

It keeps the full root `*ApplicationService.java` proof route in one package:

- `build-harness/`
  `DomainApplicationServiceTopologyRules`,
  `DomainApplicationServiceTopologyCheckMain`,
  `DomainApplicationServiceDocumentationRules`,
  `DomainApplicationServiceEnforcementCoverageRules`, and
  `DomainApplicationServiceDocumentationEnforcementCheckMain`
- `errorprone/`
  `DomainApplicationServiceApiShape`,
  `DomainPublicBoundarySignaturePurity`
- `pmd/`
  `DomainApplicationServiceSourcePolicyRule` and the bundle-local ruleset
- `bundle.properties`
  descriptor-based registration into the focused-enforcement Gradle path

This bundle owns only the root `ApplicationService` role itself. Generic
named-module boundaries, same-context `application/*UseCase` topology,
`published/**` carrier semantics, outbound `port/` rules, and data-root
`ServiceRegistry` export shape stay in their neighboring owner bundles and
documents.

Unified root entrypoint:

- `./gradlew checkDomainApplicationServiceEnforcement --rerun-tasks --console=plain`
