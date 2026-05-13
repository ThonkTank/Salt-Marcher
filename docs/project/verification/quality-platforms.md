Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-05-13
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
intent, and it does not replace the matching owner documents under
`docs/project/architecture/enforcement/` as the source of truth for
architecture rule ownership, rule status, or rule-shape classification.

## Scope

This standard covers quality-platform operation for active application code and
build-owned repository surfaces: compiler hygiene, PMD non-architecture smells,
duplicate-code detection, OpenRewrite dry-run near-miss checks,
cyclomatic-complexity analysis, OO metrics,
repository-wide resource/artifact/packaging validation, GitHub Actions,
branch-protection expectations, SonarCloud, and CodeScene.

Broader architecture debt is intentionally split across several owners rather
than one smell scoreboard. PMD retains generic source-smell families such as
`LawOfDemeter`, `GodClass`, `CouplingBetweenObjects`, `TooManyMethods`,
`TooManyFields`, and `UselessOverridingMethod`; generic ArchUnit suites retain
cycle and broad dependency-direction blockers; `checkNoDeadCode` retains
whole-program production reachability; CKJM retains hotspot and regression
reporting; and jQAssistant backs the focused graph diagnostics for role-aware
relay, reuse direction, and sprawl rules that generic smell tools cannot
classify by SaltMarcher role semantics.

For unused-code hygiene, the active mechanical scope is split by proof route:
`compileJava` owns `UnusedLabel`, `UnusedMethod`, `UnusedNestedClass`, and
`UnusedVariable` for local declarations, PMD retains `UnusedAssignment` beside
the broader smell policy, and `checkNoDeadCode` owns whole-program
reachability for compiled production declarations: files, top-level types,
secondary top-level types, nested and named local types, constructors,
methods, and fields. The combined mechanical surface therefore covers
removable local declarations, local variables, labels,
assignment-smell detection, and structural whole-program dead-code
reachability for compiled production declarations, including public,
abstract, and interface declarations.

Unused-code false positives are handled by narrow, explicit structural roots
or narrow local keep roots instead of weakening the blocking gates. Generated
code is excluded through the shared Error Prone configuration, while
whole-program reachability derives its live roots mechanically from the
configured JavaFX launcher and preloader classes, exact concrete shell
contribution roots matching `ShellViewDiscovery`, exact concrete data service
contribution roots matching `ServiceContributionDiscovery`, merged FXML
controller resources, `META-INF/services` providers, and the explicit fallback
rules under `tools/quality/config/deadcode/keep-rules.pro`. Any future
framework- or reflection-driven exception must stay local, documented, and
attributable through explicit keep rules rather than becoming a blanket
disablement of the unused checks.

Architecture enforcement enters local quality through the same Gradle
aggregates, but the owner model now lives in the matching layer and role
documents under `docs/project/architecture/enforcement/`.

## Gate Status Vocabulary

Every quality platform named here belongs to exactly one operating status:
`Blocking Local Gate` for local Gradle tasks that write diagnostics and fail
the overall invocation on violations, `Blocking Distribution Gate` for Gradle
tasks that fail packaging or installation flows but are not part of the central
`check` aggregate, `Required CI Gate` for GitHub Actions jobs intended for
branch protection, `Required CI Report` for GitHub Actions jobs that must run
to publish maintained reporting artifacts without becoming branch-protection
blockers by default, `Informational Report` for artifacts without
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
  owns the detailed local gate inventory
- [Quality Platforms Local Entrypoints](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/verification/quality-platforms-local-entrypoints.md:1)
  owns aggregate entrypoints, staged handoff routing, and parallel local
  worktree policy
- [Verification Core Architecture](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/verification-core.md:1)
  owns the Gradle-side verification-core architecture behind those surfaces
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
- keep CKJM hotspot regression reporting non-blocking unless an explicit future
  decision promotes it with stronger evidence than generic hotspot metrics
- use manual testing for workflow behavior, desktop interaction, UI judgment,
  and product acceptance
- `./gradlew test` is not a general-purpose home for behavior-regression suites
- require the repo-wide adversarial review route at the end of every
  repo-tracked implementation pass, after the diff exists and regardless of
  WIP or verification status; this is a workflow obligation, not a new
  compile/build/check gate

## Continuous Refactoring Relationship

Continuous refactoring is a workflow obligation, not an additional gate.
Agents use the repo-owned
[Continuous Refactoring Skill](/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/continuous-refactoring/SKILL.md:1)
for production-code, check/enforcement, and dependency work so existing
quality evidence is considered inside the normal development pass.

The proof strength remains owned by the existing gates named in this standard.
PMD, CPD, Lizard, SpotBugs, compiler hygiene, and dead-code reachability keep
their current blocking status; CKJM remains an informational report. The
continuous-refactoring workflow only requires agents to inspect and report
touched-scope findings, perform small behavior-preserving local cleanup, and
split larger refactors or dependency upgrades into separate reviewable passes.
It also follows the repo-wide adversarial review route at the end of each
repo-tracked implementation pass, after the diff exists and before final
handoff or any commit/publication decision. That review runs even when
verification is red or the pass remains WIP. The review protocol is owned by
`tools/quality/skills/adversarial-review/SKILL.md`, not by this quality-platform
standard.

This follows the external workflow references mirrored under
`/home/aaron/Schreibtisch/projects/references/continuous-refactoring/`:
clean-as-you-code new-code scope, small-change review practice,
pull-request-scoped quality feedback, Dependabot pull requests, dry-run-first
mechanical refactoring, and Codex small validated refactoring passes.

## Architecture Harness Relationship

This standard describes how quality platforms are operated. The architecture
enforcement documents define which engine owns which class of architecture
rule.

Operationally, architecture checks enter local quality through a small public
surface set:

- `compileJava`
  runs compiler-integrated Error Prone architecture checks.
- `checkViewEnforcement`
  runs the canonical View enforcement surface.
- `checkDomainEnforcement`
  runs the canonical Domain enforcement surface.
- `checkDataEnforcement`
  runs the canonical Data enforcement surface.
- `checkShellEnforcement`
  runs the canonical Shell enforcement surface.
- `checkBootstrapEnforcement`
  runs the canonical Bootstrap enforcement surface.
- `checkStylingEnforcement`
  runs the canonical Styling enforcement surface.
- `checkLayeringEnforcement`
  runs the canonical Layering enforcement surface.
- `checkArchitecture`
  runs the small public architecture aggregate over the canonical layer
  surfaces plus the internal generic architecture owners.
- `checkDocumentationEnforcement`
  runs the dedicated Markdown-backed architecture and enforcement-document
  coverage path and stays intentionally outside `check` and `build`.
- `production-handoff`
  runs the canonical broad production-code handoff route.

The public API stops there. Role-specific or bundle-specific enforcement tasks
are no longer part of the public verification contract. They may still exist as
technical implementation tasks behind those layer surfaces, but they are not
documented public entrypoints and must not be used as the canonical routing
surface in owner docs. Internal `verify*Bundle` selector tasks are allowed as
typed harness seams, and internal build-harness topology tasks may still keep
technical `check*` names such as `checkViewLayerEnforcement`, but they remain
explicitly non-public. `production-handoff` is the only public broad
implementation-handoff aggregate above `checkArchitecture` and the
documentation surface.

`production-handoff` is the public aggregate for production-code verification.
It combines:

- assemble and `test`
- the quality-hygiene blocker path through PMD, OpenRewrite dry-run
  near-miss checks, SpotBugs, CPD, Lizard, compiled-artifact hygiene, and
  whole-program dead-code reachability
- the public `checkArchitecture` aggregate

`check` remains the central local build-health aggregate. Its architecture
coverage comes through the public `checkArchitecture` aggregate.
`checkDocumentationEnforcement` remains intentionally separate so
documentation-only work has a smaller proof route.

Default local proof routing by change type lives in
`docs/project/verification/quality-platforms-local-entrypoints.md` and
`AGENTS.md`: production-code changes use
`tools/gradle/run-staged-verification.sh production-handoff`,
documentation-only changes use
`./gradlew checkDocumentationEnforcement --console=plain`, and check-only
changes use the corresponding focused package or layer-surface entrypoints. The
existence of a broader aggregate does not make it the default proof route for
documentation-only or check-only work.

Public verification-surface ownership is architecture-owned by
[Verification Core Architecture](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/verification-core.md:1):
runtime wrappers forward the canonical public entrypoints, the verification
core owns the public Gradle lifecycle tasks, and private bundles or rule
engines stay behind those surfaces.

Wrapper-based local entrypoints keep their public names, but parallel local
safety now comes from the worktree workflow described in
`docs/project/verification/quality-platforms-local-entrypoints.md`: one linked git
worktree plus one branch per agent, verification inside that worktree, and
merge-back only after the required local surface is green.

Architecture rule status must not be reclassified here. If a layer standard and
its matching enforcement document disagree about whether a rule is mechanically
enforced, the enforcement document is the canonical classification.

## References

- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/overview.md:1)
- [Layering Architecture Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/layering-architecture-enforcement.md:1)
- [Documentation Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/documentation.md:1)
- [Styling Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/styling.md:1)
- [Quality Platforms Local Gates](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/verification/quality-platforms-local-gates.md:1)
- [Quality Platforms Local Entrypoints](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/verification/quality-platforms-local-entrypoints.md:1)
- [Verification Core Architecture](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/verification-core.md:1)
- [Quality Platforms CI And Branch Protection](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/verification/quality-platforms-ci-and-branch-protection.md:1)
- [PMD Java Design Rules Reference](/home/aaron/Schreibtisch/projects/references/quality-platforms/pmd-java-design-rules.md:1)
- [PMD CPD Reference](/home/aaron/Schreibtisch/projects/references/quality-platforms/pmd-cpd.md:1)
- [Lizard README Reference](/home/aaron/Schreibtisch/projects/references/quality-platforms/lizard-readme.md:1)
- [SpotBugs Gradle Plugin Reference](/home/aaron/Schreibtisch/projects/references/quality-platforms/spotbugs-gradle-plugin.md:1)
- [CKJM Metrics Reference](/home/aaron/Schreibtisch/projects/references/quality-platforms/ckjm-metrics.md:1)
- [CK Metric Reference Values](/home/aaron/Schreibtisch/projects/references/quality-platforms/ck-metric-reference-values.md:1)
- [Clean as You Code](/home/aaron/Schreibtisch/projects/references/continuous-refactoring/sonar-clean-as-you-code.md:1)
- [Small CLs](/home/aaron/Schreibtisch/projects/references/continuous-refactoring/google-small-cls.md:1)
- [The Standard of Code Review](/home/aaron/Schreibtisch/projects/references/continuous-refactoring/google-code-review-standard.md:1)
- [GitLab Code Quality](/home/aaron/Schreibtisch/projects/references/continuous-refactoring/gitlab-code-quality.md:1)
- [GitHub Pull Request Code Scanning Alerts](/home/aaron/Schreibtisch/projects/references/continuous-refactoring/github-code-scanning-pr-alerts.md:1)
- [Dependabot Version Updates](/home/aaron/Schreibtisch/projects/references/continuous-refactoring/github-dependabot-version-updates.md:1)
- [Dependabot Options Reference](/home/aaron/Schreibtisch/projects/references/continuous-refactoring/github-dependabot-options.md:1)
- [OpenRewrite Gradle Plugin Configuration](/home/aaron/Schreibtisch/projects/references/continuous-refactoring/openrewrite-gradle-plugin-configuration.md:1)
- [OpenAI Codex Refactor Your Codebase](/home/aaron/Schreibtisch/projects/references/continuous-refactoring/openai-codex-refactor-your-codebase.md:1)
- [OpenAI Codex Worktrees](/home/aaron/Schreibtisch/projects/references/continuous-refactoring/openai-codex-worktrees.md:1)
- [Adversarial Review Skill](/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/adversarial-review/SKILL.md:1)
