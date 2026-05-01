# Data Mapper Enforcement Bundle

This bundle co-locates the currently active SaltMarcher checks that back
`docs/project/architecture/enforcement/data-mapper-enforcement.md`.

It keeps the currently mechanical mapper proof route in one package:

- `pmd/`
  `DataMapperSourceMechanicsRule` and the dedicated single-rule PMD ruleset
- `build-harness/`
  `DataMapperEnforcementDocumentationRules`
- `bundle.properties`
  descriptor-based registration into the focused-enforcement Gradle path
- `root-host.gradle.kts`
  root-project PMD, aggregate-task, and full-build hook wiring
- `pmd-host.gradle.kts`
  included-build wiring for the `quality-rules` host
- `build-harness-host.gradle.kts`
  included-build wiring for the `build-harness` host

This bundle owns only the optional `mapper/` role itself. Generic data-layer
topology, source-model ownership, repository/query contracts, and broad
layering constraints stay in their neighboring owner bundles and documents.

Unified root entrypoint:

- `./gradlew checkDataMapperEnforcement --rerun-tasks --console=plain`
