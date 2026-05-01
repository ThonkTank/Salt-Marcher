# Data ServiceContribution Enforcement Bundle

This bundle co-locates the currently active SaltMarcher checks that back
`docs/project/architecture/enforcement/data-service-contribution-enforcement.md`.

It keeps the `src/data/<feature>/<Feature>ServiceContribution.java` proof route
owner-pure and bundle-local:

- `errorprone/`
  `DataServiceContributionConstructionPurity`,
  `DataServiceContributionShellApiAllowlist`, and
  `DataServiceContributionRegisterExportShape`
- `pmd/`
  `DataServiceContributionEntrypointRule`,
  `DataServiceContributionSourceMechanicsRule`, and the dedicated bundle-local
  ruleset
- `build-harness/`
  `DataServiceContributionEnforcementCoverageRules` and
  `DataServiceContributionDocumentationEnforcementCheckMain`
- `bundle.properties`
  descriptor-based registration into the focused-enforcement Gradle path
- `root-host.gradle.kts`
  root-project compiler, PMD, aggregate-task, and focused-entry wiring
- `errorprone-host.gradle.kts`
  included-build wiring for the `quality-rules-errorprone` host
- `pmd-host.gradle.kts`
  included-build wiring for the `quality-rules` PMD host
- `build-harness-host.gradle.kts`
  included-build wiring for the `build-harness` host

This bundle owns only the data `*ServiceContribution` role itself: discovery
entrypoint shape, stateless public surface, source-mechanics bans,
constructor-wiring purity, shell seam subset, and direct `register(...)`
export shape. Data feature-root placement, broad layer topology, non-root
shell bans, repository/query/gateway/model/mapper rules, and layer-wide
`ServiceRegistry` placement stay in neighboring owner bundles and documents.

Unified root entrypoint:

- `./gradlew checkDataServiceContributionEnforcement --rerun-tasks --console=plain`
