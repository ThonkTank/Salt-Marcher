# View Contribution Enforcement Bundle

This bundle co-locates the contribution-owned SaltMarcher checks and
role-specific support that back
`docs/project/architecture/enforcement/view-contribution-enforcement.md`.

It makes this directory the canonical home for contribution-owned checkers,
role-local support, host wiring, and bundle metadata:

- `errorprone/`
  `ViewContributionDependencyBoundary`,
  `ViewContributionShellApiAllowlist`,
  `ViewContributionArchitectureSupport`
- `archunit/`
  `architecture.view.contribution.ViewContributionArchitectureTest`,
  shared `architecture.view.ViewRolePredicates`
- `pmd/`
  `ViewContributionEntrypointRule` and the dedicated single-rule PMD ruleset
- `bundle.properties`
  descriptor-based registration into the focused-enforcement Gradle path

Shared descriptor loading and shared engine host projects remain central
Gradle/tool infrastructure. Contribution-specific shell allowlists live in
this bundle; the closed-world view source classification and dependency policy
now come from the shared Error Prone view core.

Unified root entrypoint:

- `./gradlew checkViewContributionEnforcement --rerun-tasks --console=plain`
