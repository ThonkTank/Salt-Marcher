Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-15
Source of Truth: SaltMarcher's required proof surface and verification principles.

# Quality Platforms

## Public Tasks

- `./gradlew check` is the sole required local and CI proof.
- `./gradlew test` runs the complete JUnit suite.
- `./gradlew uiTest` diagnoses headless JavaFX behavior failures.
- `./gradlew architectureTest` diagnoses architecture failures.

The diagnostic tasks never replace `check`. Ordinary test coverage belongs in
the single test source set and requires no build registry entry.

## Principles

- Behavior tests prove accepted observable outcomes through production routes.
- JUnit owns scenario discovery, selection, and scenario-level XML results.
- Monocle owns headless JavaFX execution.
- ArchUnit owns production dependency and cycle rules across all production
  roots.
- Gradle owns task inputs and incremental execution.
- A static analyzer remains only when it catches a useful defect class not
  already covered by the compiler, tests, ArchUnit, or another retained tool.
- Verification code does not test its own fixtures, registries, task topology,
  or implementation form as a substitute for product behavior.

Branch protection requires exactly the `check` context. External analyzer and
AI-review services are not part of verification.

## Qualification

The final replacement is qualified by two consecutive warm
`./gradlew check --rerun-tasks` runs of at most twelve minutes each, one warm
no-change `./gradlew check` of at most thirty seconds, headless execution, and
readback of branch protection.

## References

- [Verification Core Architecture](../architecture/verification-core.md)
