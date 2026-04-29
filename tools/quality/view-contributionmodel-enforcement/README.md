# ViewContributionModel Enforcement Bundle

This bundle co-locates all currently active SaltMarcher checks that back
`docs/project/architecture/enforcement/view-contribution-model-enforcement.md`.

It keeps the existing engines and rule intent unchanged while making this
directory the canonical home for the ContributionModel host wiring:

- `errorprone/`
  `ViewContributionModelDependencyBoundary`,
  `ViewContributionModelFlatSurface`
- `archunit/`
  `architecture.view.contributionmodel.ViewContributionModelArchitectureTest`
- `build-harness/`
  `ViewContributionModelTopologyRules`
- `jqassistant/`
  `saltmarcher:view-contributionmodel-enforcement`
- `root-host.gradle.kts`
  root-project compiler, ArchUnit, jQAssistant, build-path, and aggregate-task
  wiring
- `errorprone-host.gradle.kts`
  included-build wiring for the `quality-rules-errorprone` host
- `build-harness-host.gradle.kts`
  included-build wiring for the `build-harness` host

Unified root entrypoint:

- `./gradlew checkViewContributionModelEnforcement --rerun-tasks --console=plain`
