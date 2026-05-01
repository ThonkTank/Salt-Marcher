# Data Layer Enforcement Bundle

This bundle co-locates the currently active SaltMarcher checks that back
`docs/project/architecture/enforcement/data-layer-enforcement.md`.

It keeps the generic `src/data/**` layer proof owner-pure and bundle-local:

- `archunit/`
  `DataLayerArchitectureTest`
- `build-harness/`
  `DataLayerTopologyRules`,
  `DataLayerTopologyCheckMain`,
  `DataLayerEnforcementCoverageRules`, and
  `DataLayerDocumentationEnforcementCheckMain`
- `errorprone/`
  `ServiceRegistryRegistrationPlacementChecker`
- `bundle.properties`
  descriptor-based registration into the focused-enforcement Gradle path
- `root-host.gradle.kts`
  root-project compiler, ArchUnit, aggregate-task, and focused-entry wiring
- `errorprone-host.gradle.kts`
  included-build wiring for the `quality-rules-errorprone` host
- `build-harness-host.gradle.kts`
  included-build wiring for the `build-harness` host

This bundle owns only the generic data-layer topology and cross-feature
dependency boundaries in `src/data/**`. ServiceContribution export shape,
repository/query contracts, gateway/model/mapper specifics, and
`persistencecore/` semantics stay in their neighboring owner bundles and
documents.

Unified root entrypoint:

- `./gradlew checkDataLayerEnforcement --rerun-tasks --console=plain`
