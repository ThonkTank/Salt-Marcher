Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-07
Source of Truth: July 2026 Dependabot maintenance incidents and decisions.

# July 2026 Dependabot Maintenance Journal

## 2026-07-06 dependabot-gradle-toolchain-scope - Keep analysis engines stable

Problem: Dependabot PR `#355` grouped Gradle Wrapper, sqlite, ArchUnit,
Sonar, PMD, and SpotBugs updates; CI and local `production-handoff` failed on
new PMD and SpotBugs findings against pre-existing production code.
Target state: land the wrapper and non-blocking dependency updates while PMD
and SpotBugs remain on the last green versions until their new findings can be
handled as explicit quality-debt or cleanup slices.
Alternatives: fix all 15 PMD findings and SpotBugs nullness findings inside
the dependency PR, or weaken/suppress the gates. Both exceed the bounded
dependency-maintenance slice; suppressing or weakening gates is forbidden.
Scope boundary: change only the PMD/SpotBugs versions and keep all other
Dependabot updates in the PR.
Done when: `production-handoff` passes locally and PR `#355` keeps `risk:R3c`
with required CI green.

## 2026-07-07 dependabot-judge-secret-source - Document Dependabot judge setup

Problem: Dependabot GitHub Actions PRs `#363` and `#364` reached required CI
with `risk:R3c`, but `judge-review` failed before model review because the run
used `Secret source: Dependabot` and both judge credential environment values
were empty.
Evidence: `gh run view 28828657628 --job 85497479574 --log` and
`gh run view 28828659589 --job 85497485303 --log` both ended with
`judge-review: missing ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN`.
Decision: document the Dependabot-scoped secret requirement instead of
weakening the required judge gate, changing event trust, or treating skipped
review as mergeable.
