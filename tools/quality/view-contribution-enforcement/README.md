# View Contribution Enforcement Bundle

This bundle co-locates the contribution-owned SaltMarcher checks and
role-specific support that back
`docs/project/architecture/enforcement/view-contribution-enforcement.md`.

It makes this directory the canonical home for contribution-owned checkers,
role-local support, host wiring, and bundle metadata:

- `errorprone/`
  `ViewContributionDependencyBoundary`,
  `ViewContributionShellApiAllowlist`,
  `ViewContributionArchitectureSupport`,
  `ViewContributionDependencySupport`
- `archunit/`
  `architecture.view.contribution.ViewContributionArchitectureTest`,
  shared `architecture.view.ViewRolePredicates`
- `pmd/`
  `ViewContributionEntrypointRule` and the dedicated single-rule PMD ruleset
- `bundle.properties`
  descriptor-based registration into the focused-enforcement Gradle path

Shared descriptor loading and shared engine host projects remain central
Gradle/tool infrastructure. Contribution-specific source detection, shell
allowlists, and dependency policy live in this bundle.

Unified root entrypoint:

- `./gradlew checkViewContributionEnforcement --rerun-tasks --console=plain`
