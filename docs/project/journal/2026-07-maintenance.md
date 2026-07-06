Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-07
Source of Truth: July 2026 maintenance and dependency journal entries.
Entry Document: [July 2026 Journal](2026-07.md)

# July 2026 Maintenance Journal

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
