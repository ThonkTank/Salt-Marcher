Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-06-18
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
duplicate-code detection, first-party near-miss hygiene checks,
cyclomatic-complexity analysis, OO metrics,
repository-wide resource/artifact/packaging validation, GitHub Actions,
branch-protection expectations, SonarCloud, and CodeScene.

Broader architecture debt is intentionally split across several owners rather
than one smell scoreboard. PMD retains generic source-smell families such as
`LawOfDemeter`, `GodClass`, `CouplingBetweenObjects`, `TooManyMethods`,
`TooManyFields`, `UselessOverridingMethod`, and `UnnecessaryConstructor`;
SpotBugs retains bytecode bug and security-smell discovery; generic ArchUnit
suites retain cycle and broad dependency-direction blockers; `checkNoDeadCode`
retains whole-program production reachability; CKJM retains hotspot and
regression reporting; and jQAssistant backs the focused graph blockers and
diagnostics for role-aware relay, reuse direction, and sprawl rules that generic
smell tools cannot classify by SaltMarcher role semantics.

For unused-code hygiene, the active mechanical scope is split by route:
focused Error Prone verification compiles behind the production-code handoff
surface and owns local declaration checks such as `UnusedLabel`, `UnusedMethod`,
`UnusedNestedClass`, and `UnusedVariable`; PMD retains `UnusedAssignment`
beside the broader smell policy, and `checkNoDeadCode` owns whole-program
reachability for compiled production declarations: files, top-level types,
secondary top-level types, nested and named local types, constructors,
methods, and fields. The combined mechanical surface therefore covers
removable local declarations, local variables, labels,
assignment-smell detection, and structural whole-program dead-code
reachability for compiled production declarations, including public,
abstract, and interface declarations.

Unused-code false positives are handled by narrow, explicit structural roots
or narrow local keep roots instead of weakening the blocking gates. Generated
code is excluded through the focused Error Prone verification configuration,
while whole-program reachability derives its live roots mechanically from the
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
  owns aggregate entrypoints, staged handoff routing, and local concurrent-work
  coordination policy
- [Verification Core Architecture](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/verification-core.md:1)
  owns the Gradle-side verification-core architecture behind those surfaces
- [Quality Platforms CI And Branch Protection](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/verification/quality-platforms-ci-and-branch-protection.md:1)
  owns the detailed GitHub Actions, service-setup, branch-protection, and
  review-governance policy

## Verification Policy

SaltMarcher uses structural and build gates for automated confidence,
production-path behavior harnesses for behavior proof, and manual testing for
desktop interaction or UI judgment that cannot be mechanically qualified.

- behavior changes, user-reported misbehavior, new features, and new
  behavior-bearing concepts must extend the owning behavior harness or create a
  focused concept harness before implementation handoff
- if behavior exists but no credible harness owner can prove it, the pass
  reports `Harness Gap` instead of treating manual inspection as equivalent
  proof
- behavior harnesses must exercise real production routes where possible:
  owning UI route or view input adapter, migrated feature-runtime operation
  owner where applicable, domain owner APIs for authored mutation, persistence,
  publication, and render-frame or content-model readback; direct owner-API
  proof is allowed only for model invariants or as a marked route gap
- harness assertions must not manually reimplement the desired production
  behavior against stubs that self-confirm; they inspect production state,
  persisted data, published models, rendered facts, or named owner APIs
- do not add JUnit or similar automated tests for feature behavior, internal
  orchestration, UI helpers, or other change-coupled logic whose assertions
  belong in production-path behavior harnesses
- do not add fixture-based selftests or meta-test suites inside verification
  harnesses such as `build-harness`; express repository policies directly in
  the owning gate instead
- do not expand the central compile/build/check pipeline with new automated
  gates unless the user explicitly requests that expansion; adding behavior
  harness cases, suite ids, focused JavaExec harnesses, or declared harness
  dependencies for requested behavior is normal implementation work
- keep CKJM hotspot regression reporting non-blocking unless an explicit future
  decision promotes it with stronger evidence than generic hotspot metrics
- use manual testing for desktop interaction, UI judgment, and product
  acceptance after the relevant behavior harness proof is selected or the
  `Harness Gap` is reported
- `./gradlew test` is not a general-purpose home for behavior-regression suites
- require the repo-wide adversarial review route for repo-tracked
  implementation passes; this is a workflow obligation, not a new
  compile/build/check gate
- treat successful proof as necessary but not as a code-health verdict; code
  health and baseline admission are review-owned by
  `docs/project/architecture/project-health.md`

## Behavior Harness Composition

Behavior harnesses are feature or concept proof surfaces, not generic build
gates. Each harness must be independently runnable for its owning concept and
must declare the prerequisite behavior it depends on when narrower proof would
otherwise miss knock-on regressions.

The preferred composition model is the existing Dungeon Editor suite registry:
atomic suite ids declare dependencies, alias suites aggregate only, and focused
Gradle tasks select suite ids plus their transitive dependencies. A feature
family may start with a single focused JavaExec harness when that is
proportional. Once several concepts depend on one another, that family should
move to a registry-shaped harness rather than accumulating unrelated standalone
tasks or hidden ordering assumptions.

A focused behavior harness is a valid investigation and feature proof command.
It does not become a new public production handoff route unless the quality
platform owner explicitly promotes it. Production-code handoff still follows
the public entrypoint rules below.

## Continuous Refactoring Relationship

Continuous refactoring is a workflow obligation, not an additional gate.
Project-health scanning is likewise a review and handoff obligation unless a
later owner promotes it into a named gate. The scan proves literal
marker/register sync for the selected scope and surfaces repeated pass-log
families; it does not prove feature behavior or replace staged verification.
Agents use the repo-owned
[Continuous Refactoring Skill](/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/continuous-refactoring/SKILL.md:1)
for production-code, check/enforcement, and dependency work so existing
quality evidence is considered inside the normal development pass.

The proof strength remains owned by the existing gates named in this standard.
PMD, CPD, Lizard, SpotBugs, compiler hygiene, and dead-code reachability keep
their current blocking status; CKJM remains an informational report.
Continuous-refactoring remains owned by its repo-owned skill, and
adversarial-review is owned by the global adversarial review skills. Neither
workflow is owned by this quality-platform standard.

This follows the external workflow references mirrored under
`/home/aaron/Schreibtisch/projects/references/continuous-refactoring/`:
clean-as-you-code new-code scope, small-change review practice,
pull-request-scoped quality feedback, Dependabot pull requests, dry-run-first
mechanical refactoring, and Codex small validated refactoring passes.

## Custom Checker Admission And Retirement

Standard tools are the default home for new quality and architecture rules.
Before adding or extending a first-party checker, the owning change must record
why an existing engine is not sufficient for the rule:

- PMD owns generic Java source-smell and metrics families.
- SpotBugs and FindSecBugs own bytecode bug and security-smell discovery.
- ArchUnit owns simple dependency, module, boundary, and cycle rules that can
  be expressed from compiled classes.
- jQAssistant owns compiled graph diagnostics for relay stacks, reuse direction,
  breadth, and sprawl where the rule needs graph traversal.
- Error Prone owns compiler-local symbol, method-call, signature, and AST rules.
- build-harness owns source-tree topology, documentation inventories, Markdown
  coverage, and repository file/resource policy.

A new custom checker must name its owner document, the standard tool considered
first, the exact gap that forced custom code, the engine owner chosen, the public
proof route that exposes the result, the false-positive boundary, and the
condition under which the checker should be retired or replaced. Existing custom
checkers that become equivalent to a standard-tool rule are candidates for
retirement rather than permanent exceptions. This governance rule does not add a
new gate by itself; it constrains future checker changes and the review of
current custom-rule debt.

## Architecture Harness Relationship

This standard describes how quality platforms are operated. The architecture
enforcement documents define which engine owns which class of architecture
rule.

Operationally, architecture checks enter local quality through public proof
routes and technical diagnostics. Public proof routes are limited to:

- `checkDocumentationEnforcement`
  runs the dedicated Markdown-backed architecture and enforcement-document
  coverage path through root documentation rules plus coalesced per-surface
  documentation tasks, and stays intentionally outside `check` and `build`.
- `production-handoff`
  runs the canonical production-code route, including all current
  non-documentation harness checks for production source, compiled production
  classes, production topology, layer boundaries, role placement, and generic
  architecture behavior.
- `focused-handoff`
  runs a scoped public local route only for the reported non-empty package or
  resource paths, selected area, and engine surfaces that actually ran.

The public API stops there. Role-specific, bundle-specific, layer-surface, or
architecture-test tasks are no longer part of the public verification contract.
Internal `verify*Bundle` selector tasks and technical layer-surface tasks are
allowed as typed harness seams and focused diagnostics, but they are not public
proof entrypoints and must not be used as the canonical routing surface in
owner docs. Build-harness role metadata is coalesced behind the production-code
surface before execution: broad `production-handoff` runs active topology rules
once, while technical layer surfaces keep focused topology diagnostics.
Compile-backed Error Prone metadata follows the same operating split:
`production-handoff` uses broader physical source-family compile slices, while
focused enforcement diagnostics may keep finer bundle-derived slices.
Documentation metadata is coalesced behind the public
`checkDocumentationEnforcement` surface rather than published as role-local
proof tasks. Build-harness bundle metadata must not require historic role-local
`check*` names unless a separate explicit utility gate owns that name.
`production-handoff` is the only public broad
implementation-handoff aggregate; the documentation surface stays separate.
`focused-handoff` is `Mechanically Enforced` only for the reported non-empty
package or resource scope and the engine surfaces that actually ran with
focused inputs. It does not prove global production readiness and does not
replace `production-handoff` where broad production-code handoff is required.

`production-handoff` is the public aggregate for production-code verification.
It combines:

- assemble
- all non-documentation production-code harness checks
- the quality-hygiene blocker path through `pmdStrictMain`, first-party
  near-miss hygiene checks, SpotBugs, CPD, Lizard, compiled-artifact hygiene,
  and whole-program dead-code reachability

CKJM hotspot and regression reporting remains an informational report surface
through direct `ckjmMain` runs and CI artifact upload. It is not part of the
blocking production-code handoff aggregate.

`check` remains the central local build-health aggregate. Its architecture
coverage comes by depending on `production-handoff`; it must not reconstruct a
second production-code check graph. `production-handoff` consumes the typed
verification lifecycle catalog for shared root-owned hygiene and reporting
owners.
PMD XML production remains owned by `pmdMain`; the blocking text-first PMD
handoff owner is `pmdStrictMain`, declared explicitly in the lifecycle catalog
instead of attached as a hidden finalizer.
`checkDocumentationEnforcement` remains intentionally separate so
documentation-only work has a smaller public proof route.

Default local proof routing by change type lives in
`docs/project/verification/quality-platforms-local-entrypoints.md` and
`AGENTS.md`: production-code changes use
`tools/gradle/run-staged-verification.sh production-handoff`,
documentation-only changes use
`./gradlew checkDocumentationEnforcement --console=plain`, and
non-documentation check/enforcement changes use the same production-handoff
route when they affect shared production-code routing or lifecycle behavior.
Focused routes are allowed for targeted package/resource work after non-empty
input validation, but handoff claims must report the selected scope and the
engine-specific surfaces that actually ran.

Public verification-surface ownership is architecture-owned by
[Verification Core Architecture](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/verification-core.md:1):
runtime wrappers forward the canonical public entrypoints, the verification
core owns the public Gradle lifecycle tasks, and private bundles or rule
engines stay behind those surfaces.

Wrapper-based local entrypoints keep their public names, but local concurrency
safety is a caller-owned coordination concern described in
`docs/project/verification/quality-platforms-local-entrypoints.md`: agents that
share one checkout need disjoint write sets, serialized shared-file edits, and
literal verification results for the changed surface.

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
- [OpenAI Codex Refactor Your Codebase](/home/aaron/Schreibtisch/projects/references/continuous-refactoring/openai-codex-refactor-your-codebase.md:1)
- [OpenAI Codex Worktrees](/home/aaron/Schreibtisch/projects/references/continuous-refactoring/openai-codex-worktrees.md:1)
- [Global Adversarial Review Caller Skill](/home/aaron/.codex/skills/local/coord-adversarial-review/SKILL.md:1)
- [Global Adversarial Review Agent Skill](/home/aaron/.codex/skills/local/lens-adversarial-review-agent/SKILL.md:1)
