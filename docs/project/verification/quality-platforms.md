Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-26
Source of Truth: Quality-platform operating model, status vocabulary,
verification policy, and architecture-harness relationship for SaltMarcher
quality gates.

# Quality Platforms Standard

## Goal

SaltMarcher uses one documented operating model for local and CI quality gates
that are not primarily architecture-rule ownership.

This standard defines local quality gates, pull-request blockers, ownership for
non-architecture quality concerns, current thresholds and service policies, and
quality concerns that remain review-owned.

It does not replace the architecture standards as the source of architectural
intent, and it does not replace `architecture-enforcement-harness.md` as the
source of truth for architecture rule ownership, rule status, or rule-shape
classification.

## Scope

This standard covers quality-platform operation for active application code and
build-owned repository surfaces: compiler hygiene, PMD non-architecture smells,
duplicate-code detection, cyclomatic-complexity analysis, OO metrics,
repository-wide resource/artifact/packaging validation, GitHub Actions,
branch-protection expectations, SonarCloud, and CodeScene.

The architecture harness enters local quality through the same Gradle
aggregates, but its owner model lives in the
[Architecture Enforcement Harness Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/architecture-enforcement-harness.md:1).

## Gate Status Vocabulary

Every quality platform named here belongs to exactly one operating status:
`Blocking Local Gate` for local Gradle tasks that write diagnostics and fail
the overall invocation on violations, `Blocking Distribution Gate` for Gradle
tasks that fail packaging or installation flows but are not part of the central
`check` aggregate, `Required CI Gate` for GitHub Actions jobs intended for
branch protection, `Informational Report` for artifacts without
project-specific blocking thresholds, or `Review-Owned` for binding guidance
that needs human judgment.

External services may be both `Required CI Gate` and `Review-Owned` for
different parts of their output. CodeScene quality-gate failures block CI,
while non-blocking warnings still require human judgment. A blocking local gate
may continue after another independent gate fails so the suite can produce a
complete report, but a violating gate must not produce a successful `check` or
`build` handoff.

## Detailed Operating Subdocuments

- [Quality Platforms Local Gates](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/verification/quality-platforms-local-gates.md:1)
  owns the detailed local gate inventory, aggregate entrypoints, and parallel
  local invocation isolation policy
- [Quality Platforms CI And Branch Protection](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/verification/quality-platforms-ci-and-branch-protection.md:1)
  owns the detailed GitHub Actions, service-setup, branch-protection, and
  review-governance policy

## Verification Policy

SaltMarcher uses structural and build gates for automated confidence, and
manual testing for behavior verification.

- do not add JUnit or similar automated tests for feature behavior, internal
  orchestration, UI helpers, or other change-coupled logic whose assertions
  must be migrated alongside normal behavior changes
- do not add fixture-based selftests or meta-test suites inside verification
  harnesses such as `build-harness`; express repository policies directly in
  the owning gate instead
- do not expand the compile/build/check pipeline with new automated gates
  unless the user explicitly requests that expansion
- treat only the CKJM hotspot regression policy named in the local-gates
  subordinate standard as the mechanical CKJM blocker
- use manual testing for workflow behavior, desktop interaction, UI judgment,
  and product acceptance
- `./gradlew test` is not a general-purpose home for behavior-regression suites

## Architecture Harness Relationship

This standard describes how quality platforms are operated. The harness
standard defines which engine owns which class of architecture rule.

Operationally, architecture checks enter local quality through:

- `compileJava`
  runs Error Prone architecture checks, including compiler-precise MVVM
  dependency rules for active roots, Binders, ViewModels, passive views, shell
  API use, passive panel restrictions, and legacy view-package bans
- `architectureTest`
  runs ArchUnit dependency and cycle checks, including target view package,
  dependency, and cycle freedom rules
- `checkViewArchitecture`
  runs explicit jQAssistant view-topology analysis for active roots, Binders,
  co-located ViewModels, passive views, and reusable slotcontent, plus the
  view FXML resource boundary check
- `checkArchitecture`
  aggregates ArchUnit, PMD architecture rules, and the build-harness
- `check`
  runs the architecture harness plus adjacent non-architecture quality gates.
  Its jQAssistant coverage comes from the explicit `checkViewArchitecture`
  dependency

Architecture rule status must not be reclassified here. If a layer standard and
the harness standard disagree about whether a rule is mechanically enforced,
the harness standard is the canonical classification.

## References

- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/overview.md:1)
- [Architecture Enforcement Harness Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/architecture-enforcement-harness.md:1)
- [Documentation Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/documentation.md:1)
- [Styling Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/styling.md:1)
- [Quality Platforms Local Gates](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/verification/quality-platforms-local-gates.md:1)
- [Quality Platforms CI And Branch Protection](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/verification/quality-platforms-ci-and-branch-protection.md:1)
- [PMD Java Design Rules Reference](/home/aaron/Schreibtisch/projects/references/quality-platforms/pmd-java-design-rules.md:1)
- [PMD CPD Reference](/home/aaron/Schreibtisch/projects/references/quality-platforms/pmd-cpd.md:1)
- [Lizard README Reference](/home/aaron/Schreibtisch/projects/references/quality-platforms/lizard-readme.md:1)
- [SpotBugs Gradle Plugin Reference](/home/aaron/Schreibtisch/projects/references/quality-platforms/spotbugs-gradle-plugin.md:1)
- [CKJM Metrics Reference](/home/aaron/Schreibtisch/projects/references/quality-platforms/ckjm-metrics.md:1)
- [CK Metric Reference Values](/home/aaron/Schreibtisch/projects/references/quality-platforms/ck-metric-reference-values.md:1)
- [ADR 016: Architecture Enforcement Operating Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/adr-016-architecture-enforcement-operating-model.md:1)
