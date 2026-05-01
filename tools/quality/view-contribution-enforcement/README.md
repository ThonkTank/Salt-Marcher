# View Contribution Enforcement Bundle

This bundle co-locates all currently active SaltMarcher checks that back
`docs/project/architecture/enforcement/view-contribution-enforcement.md`.

It makes this directory the canonical home for contribution-owned checkers,
host wiring, and bundle metadata:

- `errorprone/`
  `ViewContributionDependencyBoundary`,
  `ViewContributionShellApiAllowlist`
- `archunit/`
  `architecture.view.contribution.ViewContributionArchitectureTest`
- `pmd/`
  `ViewContributionEntrypointRule` and the dedicated single-rule PMD ruleset
- `bundle.properties`
  descriptor-based registration into the focused-enforcement Gradle path
- `root-host.gradle.kts`
  root-project compiler, ArchUnit, PMD, and aggregate-task wiring
- `errorprone-host.gradle.kts`
  included-build wiring for the `quality-rules-errorprone` host
- `pmd-host.gradle.kts`
  included-build wiring for the `quality-rules` host

Unified root entrypoint:

- `./gradlew checkViewContributionEnforcement --rerun-tasks --console=plain`
