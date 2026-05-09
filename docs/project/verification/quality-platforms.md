Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-05-07
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
duplicate-code detection, cyclomatic-complexity analysis, OO metrics,
repository-wide resource/artifact/packaging validation, GitHub Actions,
branch-protection expectations, SonarCloud, and CodeScene.

Broader architecture debt is intentionally split across several owners rather
than one smell scoreboard. PMD retains generic source-smell families such as
`LawOfDemeter`, `GodClass`, `CouplingBetweenObjects`, `TooManyMethods`,
`TooManyFields`, and `UselessOverridingMethod`; generic ArchUnit suites retain
cycle and broad dependency-direction blockers; `checkNoDeadCode` retains
whole-program production reachability; CKJM retains hotspot and regression
reporting; and the focused layering bundles retain role-aware relay and sprawl
graph diagnostics that generic smell tools cannot classify by SaltMarcher role
semantics.

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
- [Verification Core Architecture](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/verification-core.md:1)
  owns the detailed local gate inventory, aggregate entrypoints, and parallel
  local worktree policy
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

## Architecture Harness Relationship

This standard describes how quality platforms are operated. The architecture
enforcement documents define which engine owns which class of architecture
rule.

Operationally, architecture checks enter local quality through:

- `compileJava`
  runs Error Prone architecture checks, including compiler-precise
  `ContributionModel`/`ContentModel`, `IntentHandler`, Binder, passive-View
  dependency rules, shell API use, `AppShell`
  lifecycle-hook ownership, passive panel restrictions, the broad
  styling-layer programmatic-style-value ban, passive-`View` direct-render
  styling placement, the focused Domain Layer infrastructure-dependency and
  named-module-to-`published/**` dependency rules, the focused `Domain
  ApplicationService` API-shape, role-boundary, and signature-purity rules, the focused
  Data Model source-shape/signature-boundary rules, the focused
  `Domain Published` carrier-shape, ownership-boundary, and signature-purity rules, the focused
  `Domain Port` role-shape/boundary rules, the focused `Domain Factory`
  role-shape/statelessness rules, the focused `Domain Value` role-shape/state
  rule, the focused `Domain Service` role-shape/statelessness rules, the
  focused `Domain Policy` role-shape/statelessness rules, the focused Domain
  Event role-shape rule, the focused Domain Specification role-shape rule, and
  legacy view-package bans
- `checkViewEnforcement`
  runs the canonical View surface by aggregating the closed-world View Layer
  topology proof plus the passive `View`, `ViewInputEvent`, `Contribution`,
  `Binder`, `ContributionModel`, `ContentModel`, and `IntentHandler` bundles
- `checkDomainEnforcement`
  runs the canonical Domain surface by aggregating the Domain Context, Layer,
  UseCase, ApplicationService, Published, Port, Model, Helper, Constants, and
  Repository bundles
- `checkDataEnforcement`
  runs the canonical Data surface by aggregating the Data Layer, Model,
  Gateway, Mapper, Persistencecore, Query, Repository, and
  ServiceContribution bundles
- `checkShellEnforcement`
  runs the canonical Shell surface by aggregating the `ShellRuntimeContext`,
  `AppShell`, and Shell Layer bundles
- `checkBootstrapEnforcement`
  runs the canonical Bootstrap surface by aggregating the `AppBootstrap` and
  Bootstrap Layer bundles
- `checkStylingEnforcement`
  runs the canonical Styling surface by aggregating the styling-layer and
  passive-`View` direct-render styling bundles
- `checkLayeringEnforcement`
  runs the canonical Layering surface through the blocker-owned Layering
  Architecture bundle
- `architectureTest`
  runs the remaining generic ArchUnit dependency and cycle checks outside the
  focused `AppBootstrap`, Domain Layer, `Shell Layer`, `View Layer`, and the
  other focused enforcement bundles that still keep dedicated ArchUnit suites
- `checkDocumentationEnforcement`
  runs the focused Markdown-backed architecture and enforcement-documentation
  bundle through the dedicated documentation-enforcement build-harness path,
  including active bundle-local Markdown rules such as `Domain Context`, and
  stays intentionally outside `checkArchitecture`, `check`, and `build`
- `checkLayeringArchitectureEnforcement`
  runs the focused `Layering Architecture` enforcement bundle through the
  dedicated build-harness topology, passive-carrier mirror, and
  documentation-coverage checks for repository-wide layer roots and
  included-build taxonomy
- `checkArchitecture`
  aggregates the focused Domain Layer, Domain ApplicationService,
  Data ServiceContribution, styling-layer, `Shell Layer`,
  `Layering Architecture`, Domain UseCase, Data Model, Data Repository,
  Data Query, Data Mapper, Data Persistencecore,
  `Domain Port`, `Domain Repository`, `Domain Model`, `Domain Helper`,
  `Domain Constants`,
  focused `View`, `ViewInputEvent`, `View Contribution`, `View Binder`,
  `View ContributionModel`, `View ContentModel`, `View IntentHandler`,
  and `View Layer` bundles, ArchUnit, compile-blocking Error Prone rules, and
  the non-documentation build-harness path
- `check`
  runs the architecture harness plus adjacent non-architecture quality gates.
  Its architecture-focused coverage comes from the explicit
  `checkDomainLayerEnforcement`,
  `checkDomainApplicationServiceEnforcement`,
  `checkDataServiceContributionEnforcement`,
  `checkDomainPortEnforcement`,
  `checkDomainRepositoryEnforcement`,
  `checkDomainModelEnforcement`,
  `checkDomainHelperEnforcement`,
  `checkDomainConstantsEnforcement`,
  `checkDataModelEnforcement`,
  `checkDataGatewayEnforcement`,
  `checkDataRepositoryEnforcement`,
  `checkDataQueryEnforcement`,
  `checkDataMapperEnforcement`,
  `checkDataPersistencecoreEnforcement`,
  `checkStylingLayerEnforcement`,
  `checkBootstrapAppBootstrapEnforcement`,
  `checkShellLayerEnforcement`,
  `checkLayeringArchitectureEnforcement`,
  `checkDomainUseCaseEnforcement`,
  `checkViewEnforcement`,
  `checkViewInputEventEnforcement`,
  `checkViewContributionEnforcement`,
  `checkViewBinderEnforcement`,
  `checkViewContributionModelEnforcement`,
  `checkViewContentModelEnforcement`,
  `checkViewIntentHandlerEnforcement`,
  `checkViewLayerEnforcement`
  dependencies. The dedicated
  `checkDocumentationEnforcement` path is intentionally excluded.

Default local proof routing by change type lives in
`docs/project/verification/quality-platforms-local-gates.md` and `AGENTS.md`:
production-code changes use
`tools/gradle/run-staged-verification.sh production-handoff`,
documentation-only changes use
`./gradlew checkDocumentationEnforcement --console=plain`, and check-only
changes use the corresponding focused package or bundle entrypoints. The
existence of a broader aggregate does not make it the default proof route for
documentation-only or check-only work.

Public verification-surface ownership is architecture-owned by
[Verification Core Architecture](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/verification-core.md:1):
runtime wrappers forward canonical surface names, the verification core owns the
public Gradle lifecycle tasks, focused bundles own `check*Enforcement`, and
private rule engines remain behind those surfaces.

Wrapper-based local entrypoints keep their public names, but parallel local
safety now comes from the worktree workflow described in
`docs/project/verification/quality-platforms-local-gates.md`: one linked git
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
- [Verification Core Architecture](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/verification-core.md:1)
- [Quality Platforms CI And Branch Protection](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/verification/quality-platforms-ci-and-branch-protection.md:1)
- [PMD Java Design Rules Reference](/home/aaron/Schreibtisch/projects/references/quality-platforms/pmd-java-design-rules.md:1)
- [PMD CPD Reference](/home/aaron/Schreibtisch/projects/references/quality-platforms/pmd-cpd.md:1)
- [Lizard README Reference](/home/aaron/Schreibtisch/projects/references/quality-platforms/lizard-readme.md:1)
- [SpotBugs Gradle Plugin Reference](/home/aaron/Schreibtisch/projects/references/quality-platforms/spotbugs-gradle-plugin.md:1)
- [CKJM Metrics Reference](/home/aaron/Schreibtisch/projects/references/quality-platforms/ckjm-metrics.md:1)
- [CK Metric Reference Values](/home/aaron/Schreibtisch/projects/references/quality-platforms/ck-metric-reference-values.md:1)
