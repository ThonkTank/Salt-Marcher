# Data Mapper Enforcement Bundle

This bundle co-locates the currently active SaltMarcher checks that back
`docs/project/architecture/enforcement/data-mapper-enforcement.md`.

It keeps the currently mechanical mapper proof route in one package:

- `pmd/`
  `DataMapperSourceMechanicsRule` and the dedicated single-rule PMD ruleset
- `build-harness/`
  `DataMapperEnforcementDocumentationRules`
- `tools/gradle/build-logic/src/main/kotlin/saltmarcher/buildlogic/enforcement/StandardEnforcementBundles.kt`
  typed bundle registry entry for the bundle's public task names and host wiring

This bundle owns only the optional `mapper/` role itself. Generic data-layer
topology, source-model ownership, repository/query contracts, and broad
layering constraints stay in their neighboring owner bundles and documents.

Unified root entrypoint:

- `./gradlew checkDataMapperEnforcement --rerun-tasks --console=plain`
