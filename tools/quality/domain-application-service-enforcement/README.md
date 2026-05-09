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
`published/**` carrier semantics, repository outbound seams, and data-root
`ServiceRegistry` export shape stay in their neighboring owner bundles and
documents. The root surface is command-only and inbound-only; same-context
readback does not cross the role.

Unified root entrypoint:

- `./gradlew checkDomainApplicationServiceEnforcement --rerun-tasks --console=plain`
