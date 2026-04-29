# View Contribution Enforcement Bundle

This bundle co-locates all currently active SaltMarcher checks that back
`docs/project/architecture/enforcement/view-contribution-enforcement.md`.

It keeps the existing engines and checker identities unchanged while making
this directory the canonical home for contribution-owned host wiring:

- `errorprone/`
  `ViewContributionDependencyBoundary`
- `archunit/`
  `architecture.view.contribution.ViewContributionArchitectureTest`
- `pmd/`
  `ViewContributionEntrypointRule` and the dedicated single-rule PMD ruleset
- `root-host.gradle.kts`
  root-project compiler, ArchUnit, PMD, and aggregate-task wiring
- `errorprone-host.gradle.kts`
  included-build wiring for the `quality-rules-errorprone` host
- `pmd-host.gradle.kts`
  included-build wiring for the `quality-rules` host

Unified root entrypoint:

- `./gradlew checkViewContributionEnforcement --rerun-tasks --console=plain`
