# Domain Layer Enforcement Bundle

This bundle co-locates the currently active SaltMarcher checks that back
`docs/project/architecture/enforcement/domain-layer-enforcement.md`.

It keeps the generic domain-layer proof owner-local and bundle-local:

- `archunit/`
  `architecture.domain.layer.DomainLayerArchitectureTest`
- `build-harness/`
  `DomainLayerTopologyRules`,
  `DomainLayerTopologyCheckMain`,
  `DomainLayerEnforcementCoverageRules`, and
  `DomainLayerDocumentationEnforcementCheckMain`
- `errorprone/`
  `DomainForbiddenInfrastructureDependency`,
  `DomainModuleNoPublishedCarrierDependency`,
  `DomainSourceTopologyPerimeter`
- `bundle.properties`
  descriptor-based registration into the focused-enforcement Gradle path

This bundle owns only generic domain-layer topology and dependency boundaries.
Root `ApplicationService`, `application/*UseCase`, `published/**`, `port/`,
and tactical role-owner checks stay in their neighboring owner bundles and
documents. Undocumented legacy checks such as `domain-mapcore-removed` and the
remaining generic cycle suite stay outside this bundle.

Unified root entrypoint:

- `./gradlew checkDomainLayerEnforcement --rerun-tasks --console=plain`
