# Domain Factory Enforcement Bundle

This bundle co-locates the currently active SaltMarcher checks that back
`docs/project/architecture/enforcement/domain-factory-enforcement.md`.

It keeps the full factory-role proof route in one package:

- `errorprone/`
  `DomainFactoryRoleShape`,
  `DomainFactoryStatelessness`
- `pmd/`
  a bundle-local ruleset that configures the shared
  `CeremonialIndirectionRule` for the `factory/` blocker surface
- `build-harness/`
  `DomainFactoryEnforcementDocumentationRules`
- `bundle.properties`
  descriptor-based registration into the focused-enforcement Gradle path

This bundle owns only the tactical `factory/` role itself. Generic
named-module topology, model-role communication boundaries, and broader
domain-layer invariants stay in their neighboring owner bundles and
documents.

Unified root entrypoint:

- `./gradlew checkDomainFactoryEnforcement --rerun-tasks --console=plain`
