# Data Persistencecore Enforcement Bundle

This bundle co-locates the currently active SaltMarcher checks that back
`docs/project/architecture/enforcement/data-persistencecore-enforcement.md`.

It keeps the shared `src/data/persistencecore/**` proof route owner-pure and
bundle-local:

- `archunit/`
  `DataPersistencecoreArchitectureTest`
- `build-harness/`
  `DataPersistencecoreEnforcementCoverageRules` and
  `DataPersistencecoreDocumentationEnforcementCheckMain`
- `tools/gradle/build-logic/src/main/kotlin/saltmarcher/buildlogic/enforcement/StandardEnforcementBundles.kt`
  typed bundle registry entry for the bundle's public task names and host wiring

This bundle owns only the mechanical invariants of the shared
`persistencecore/` surface itself: persistencecore-to-feature data
independence, persistencecore-to-domain independence, and the exact
documentation coverage for the owner document. Generic data-layer topology,
feature bucket layout, data cycles, shell boundaries, and feature-local
adapter contracts stay in their neighboring owner bundles and documents.

Unified root entrypoint:

- `./gradlew checkDataPersistencecoreEnforcement --rerun-tasks --console=plain`
