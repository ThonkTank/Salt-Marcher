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
cycle and broad dependency-direction blockers; `checkNoPublicDeadCode` retains
whole-program public reachability; CKJM retains hotspot and regression
reporting; and the focused layering bundles retain role-aware relay and sprawl
graph diagnostics that generic smell tools cannot classify by SaltMarcher role
semantics.

For unused-code hygiene, the active mechanical scope is split by proof route:
`compileJava` owns `UnusedLabel`, `UnusedMethod`, `UnusedNestedClass`, and
`UnusedVariable` for local declarations, PMD retains `UnusedAssignment` beside
the broader smell policy, and `checkNoPublicDeadCode` owns whole-program
reachability for public top-level concrete types and public methods. The
combined mechanical surface therefore covers removable local declarations,
local variables, labels, assignment-smell detection, and structural
whole-program dead-code reachability for public concrete APIs. Public abstract
or interface declarations that remain intentionally exposed without an in-repo
call path stay review-owned until a stronger explicit scope decision is made.

Unused-code false positives are handled by narrow, explicit structural roots
or narrow local escape hatches instead of weakening the blocking gates.
Generated code is excluded through the shared Error Prone configuration, and
any future framework- or reflection-driven exception must stay local,
documented, and attributable rather than becoming a blanket disablement of the
unused checks.

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
  `ContributionModel`/`ContentModel`, `IntentHandler`, `PublishedEvent`,
  Binder, passive-View dependency rules, shell API use, `AppShell`
  lifecycle-hook ownership, passive panel restrictions, the broad
  styling-layer programmatic-style-value ban, passive-`View` direct-render
  styling placement, the focused Domain Layer infrastructure-dependency and
  named-module-to-`published/**` dependency rules, the focused `Domain
  ApplicationService` API-shape and signature-purity rules, the focused
  Data Model source-shape/signature-boundary rules, the focused
  `Domain Published` carrier-shape and signature-purity rules, the focused
  `Domain Port` role-shape/boundary rules, the focused `Domain Factory`
  role-shape/statelessness rules, the focused `Domain Value` role-shape/state
  rule, the focused `Domain Service` role-shape/statelessness rules, the
  focused `Domain Policy` role-shape/statelessness rules, the focused Domain
  Event role-shape rule, the focused Domain Specification role-shape rule, and
  legacy view-package bans
- `checkDomainLayerEnforcement`
  runs the focused Domain Layer bundle by aggregating the dedicated
  compiler-integrated infrastructure-dependency and named-module-to-published
  dependency checks, the dedicated Domain Layer ArchUnit suite, the dedicated
  build-harness topology check, and the dedicated bundle-local
  enforcement-documentation coverage check through one direct root entrypoint
- `checkDomainApplicationServiceEnforcement`
  runs the focused Domain ApplicationService bundle by aggregating the
  dedicated compiler-integrated API-shape and public-boundary-signature
  checks, the dedicated root-topology check, the dedicated root source-pattern
  PMD rule, and the dedicated bundle-local enforcement-documentation coverage
  check through one direct root entrypoint
- `checkDataServiceContributionEnforcement`
  runs the focused Data ServiceContribution bundle by aggregating the
  dedicated compiler-integrated construction-purity, shell-seam, and direct
  `register(...)` export-shape checks, the dedicated root PMD role-shape and
  source-mechanics rules, and the dedicated bundle-local
  enforcement-documentation coverage check through one direct root entrypoint
- `checkDomainFactoryEnforcement`
  runs the focused `Domain Factory` enforcement bundle by aggregating the
  dedicated compiler-integrated `factory/` role-shape/statelessness checks
  and the bundle-local documentation-coverage rule through one direct root
  entrypoint
- `checkDomainPortEnforcement`
  runs the focused Domain Port bundle by aggregating the dedicated
  compiler-integrated `port/` role-shape and boundary checks plus the
  bundle-local documentation-coverage rule through one direct root entrypoint
- `checkDomainContextEnforcement`
  runs the focused Domain Context bundle by aggregating the dedicated
  `DOMAIN.md` contract, context-map, and bundle-local coverage checks through
  one direct root entrypoint
- `checkDomainPublishedEnforcement`
  runs the focused Domain Published bundle by aggregating the dedicated
  compiler-integrated `published/**` carrier-shape/signature-purity checks,
  the dedicated Published topology check, and the bundle-local
  documentation-coverage rule through one direct root entrypoint
- `checkDomainPortEnforcement`
  runs the focused Domain Port bundle by aggregating the dedicated
  compiler-integrated `port/` role-shape and boundary checks plus the
  bundle-local documentation-coverage rule through one direct root entrypoint
- `checkDomainValueEnforcement`
  runs the focused `Domain Value` enforcement bundle by aggregating the
  dedicated compiler-integrated `DomainValueShape` check and the bundle-local
  documentation-coverage rule through one direct root entrypoint
- `checkDomainServiceEnforcement`
  runs the focused `Domain Service` enforcement bundle by aggregating the
  dedicated compiler-integrated `service/` role-shape/statelessness checks and
  the bundle-local documentation-coverage rule through one direct root
  entrypoint
- `checkDomainPolicyEnforcement`
  runs the focused `Domain Policy` enforcement bundle by aggregating the
  dedicated compiler-integrated `policy/` role-shape/statelessness checks and
  the bundle-local documentation-coverage rule through one direct root
  entrypoint
- `checkDomainEventEnforcement`
  runs the focused Domain Event bundle by aggregating the dedicated
  compiler-integrated `event/` role-shape check and the bundle-local
  documentation-coverage rule through one direct root entrypoint
- `checkDomainSpecificationEnforcement`
  runs the focused Domain Specification bundle by aggregating the dedicated
  compiler-integrated `specification/` role-shape check through one direct
  root entrypoint
- `checkStylingLayerEnforcement`
  runs the focused styling-layer bundle by aggregating centralized stylesheet
  ownership, centralized stylesheet placement, style-class selector
  resolution, the dedicated `setStyle(...)` PMD rule, and the
  compiler-integrated `ViewProgrammaticStyling` check through one direct root
  entrypoint
- `checkStylingViewEnforcement`
  runs the focused passive-`View` direct-render styling bundle by aggregating
  the dedicated compiler-integrated placement check through one direct root
  entrypoint
- `checkShellAppShellEnforcement`
  runs the focused `AppShell` bundle by aggregating the dedicated
  compiler-integrated shell lifecycle-hook ownership check through one direct
  root entrypoint
- `checkBootstrapAppBootstrapEnforcement`
  runs the focused `AppBootstrap` bundle by aggregating the dedicated
  bootstrap-to-`AppShell` host-composition ArchUnit check through one direct
  root entrypoint
- `checkShellRuntimeContextEnforcement`
  runs the focused `ShellRuntimeContext` bundle by aggregating the dedicated
  PMD gateway-shape rule through one direct root entrypoint
- `checkShellLayerEnforcement`
  runs the focused `Shell Layer` bundle by aggregating the dedicated shell
  ArchUnit boundary/privacy suite and the dedicated shell-layer build-harness
  topology check through one direct root entrypoint
- `checkDomainUseCaseEnforcement`
  runs the focused Domain UseCase bundle by aggregating the dedicated
  compiler-integrated same-context `published/**` dependency check, the
  dedicated UseCase PMD helper-prefix rule, the dedicated UseCase
  build-harness topology check, and the dedicated bundle-local
  enforcement-documentation coverage check through one direct root entrypoint
- `checkDataModelEnforcement`
  runs the focused Data Model bundle by aggregating the dedicated
  compiler-integrated source-shape/signature-boundary check, the dedicated
  Data Model PMD schema-DDL-placement rule, the dedicated Data Model ArchUnit
  suite, the dedicated build-harness topology check, and the dedicated
  bundle-local enforcement-documentation coverage check through one direct
  root entrypoint
- `checkDataGatewayEnforcement`
  runs the focused Data Gateway bundle by aggregating the dedicated
  compiler-integrated public-signature-boundary check, the dedicated Data
  Gateway ArchUnit suite, and the dedicated bundle-local
  enforcement-documentation coverage check through one direct root entrypoint
- `checkDataRepositoryEnforcement`
  runs the focused Data Repository bundle by aggregating the dedicated
  compiler-integrated write-port contract, public-signature-boundary, and
  gateway-collaborator checks, the dedicated repository-only PMD
  source-mechanics rule, and the dedicated bundle-local
  enforcement-documentation coverage check through one direct root entrypoint
- `checkDataQueryEnforcement`
  runs the focused Data Query bundle by aggregating the dedicated
  compiler-integrated read-port contract, public-signature-boundary,
  gateway-collaborator, and mutation-boundary checks, the dedicated
  query-only PMD source-mechanics and read-only-source-shape rules, and the
  dedicated bundle-local enforcement-documentation coverage check through one
  direct root entrypoint
- `checkDataMapperEnforcement`
  runs the focused Data Mapper bundle by aggregating the dedicated mapper-only
  PMD source-mechanics rule and the dedicated bundle-local
  enforcement-documentation coverage check through one direct root entrypoint
- `architectureTest`
  runs the remaining generic ArchUnit dependency and cycle checks outside the
  focused `AppBootstrap`, Domain Layer, `Shell Layer`, passive-`View`,
  `Contribution`,
  `Binder`, `ContributionModel`, `ContentModel`, `PublishedEvent`,
  `IntentHandler`, and `View Layer` bundle suites
- `checkViewEnforcement`
  runs the focused passive `View` enforcement bundle by aggregating the
  current compiler-integrated passive-`View` checks, the dedicated passive
  `View` ArchUnit suite from the bundle-owned ArchUnit source set, the
  dedicated passive-`View` jQAssistant bundle, and the dedicated FXML resource
  boundary check through one direct root entrypoint
- `checkViewContributionEnforcement`
  runs the focused `Contribution` enforcement bundle by aggregating the
  dedicated compiler-integrated dependency check, the dedicated ArchUnit
  suite, and the dedicated PMD entrypoint-shape rule through one direct root
  entrypoint
- `checkViewContributionModelEnforcement`
  runs the focused `ContributionModel` enforcement bundle by aggregating the
  dedicated compiler-integrated checks, the dedicated ArchUnit suite, the
  dedicated jQAssistant bundle, and the dedicated build-harness topology check
  through one direct root entrypoint
- `checkViewContentModelEnforcement`
  runs the focused `ContentModel` enforcement bundle by aggregating the
  dedicated compiler-integrated checks, the dedicated ArchUnit suite, the
  dedicated jQAssistant bundle, and the dedicated build-harness topology check
  through one direct root entrypoint
- `checkViewBinderEnforcement`
  runs the focused `Binder` enforcement bundle by aggregating the dedicated
  compiler-integrated checks, the dedicated ArchUnit suite, and the dedicated
  Binder jQAssistant bundle through one direct root entrypoint
- `checkViewInspectorEntryEnforcement`
  runs the focused `InspectorEntry` enforcement bundle by aggregating the
  current compiler-integrated InspectorEntry checks, the dedicated
  InspectorEntry jQAssistant bundle, and the dedicated build-harness topology
  check through one direct root entrypoint
- `checkViewArchitecture`
  runs explicit jQAssistant view-topology analysis for active roots,
  contribution-side structure, and the remaining reusable slotcontent
  topology outside the dedicated `Binder`, `ContentModel`, and
  `InspectorEntry` bundles
- `checkViewLayerEnforcement`
  runs the focused `View Layer` enforcement bundle by aggregating the
  dedicated slotcontent `ContentModel` ArchUnit proof and the dedicated
  build-harness topology check through one direct root entrypoint
- `checkViewInputEventEnforcement`
  runs the focused `ViewInputEvent` enforcement bundle by aggregating the
  current compiler-integrated checks, the dedicated ArchUnit suite, and the
  dedicated build-harness topology check through one direct root entrypoint
- `checkViewPublishedEventEnforcement`
  runs the focused `PublishedEvent` enforcement bundle by aggregating the
  current compiler-integrated checks and the dedicated ArchUnit suite through
  one direct root entrypoint
- `checkViewIntentHandlerEnforcement`
  runs the focused `IntentHandler` enforcement bundle by aggregating the
  current compiler-integrated checks, the dedicated ArchUnit suite, and the
  dedicated build-harness topology check through one direct root entrypoint
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
- `checkLayeringIndirectionEnforcement`
  runs the focused `Layering Indirection` enforcement bundle through the
  dedicated jQAssistant substantive relay-wrapper and relay-chain blockers and
  now enters `checkArchitecture`, `check`, `build`, and staged
  `production-handoff` transitively
- `checkLayeringIndirectionRelayCandidates`
  runs the report-only thin relay-stack diagnostic surface of the focused
  `Layering Indirection` bundle and stays intentionally outside
  `checkArchitecture`, `check`, and `build`
- `checkLayeringSprawlCandidates`
  runs the report-only `Layering Sprawl` bundle through the dedicated
  jQAssistant role-hub, cross-feature, and public-boundary breadth
  diagnostics and stays intentionally outside `checkArchitecture`, `check`,
  and `build`
- `checkViewRefactorCandidates`
  runs the report-only View Layer refactor-direction diagnostics and now
  enters `checkViewArchitecture`, staged `view-topology`, `check`, `build`,
  and staged `production-handoff` transitively without changing blocker
  semantics
- `checkDataQueryPublishedCarrierCandidates`
  runs the report-only Data Query foreign published carrier thinning scan and
  stays intentionally outside `checkArchitecture`, `check`, `build`, and
  staged `production-handoff`
- `checkArchitecture`
  aggregates the focused Domain Layer, Domain ApplicationService,
  Data ServiceContribution,
  styling-layer, `Shell Layer`, `Layering Architecture`, Domain UseCase,
  Data Model, Data Repository, Data Query, Data Mapper, Data Persistencecore,
  `Domain Port`, `Domain Factory`, `Domain Service`, Domain Event,
  `Contribution`, `Binder`, `ContributionModel`, `ContentModel`,
  `ViewInputEvent`, `PublishedEvent`, `IntentHandler`, and
  `ShellRuntimeContext` bundles, ArchUnit, PMD architecture rules, and the
  non-documentation build-harness path
- `check`
  runs the architecture harness plus adjacent non-architecture quality gates.
  Its architecture-focused coverage comes from the explicit
  `checkDomainLayerEnforcement`,
  `checkDomainApplicationServiceEnforcement`,
  `checkDataServiceContributionEnforcement`,
  `checkDomainPortEnforcement`,
  `checkDomainFactoryEnforcement`,
  `checkDomainServiceEnforcement`,
  `checkDomainEventEnforcement`,
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
  `checkLayeringIndirectionEnforcement`,
  `checkDomainUseCaseEnforcement`,
  `checkViewEnforcement`, `checkViewContributionEnforcement`,
  `checkViewBinderEnforcement`,
  `checkViewContributionModelEnforcement`,
  `checkViewContentModelEnforcement`,
  `checkViewInspectorEntryEnforcement`, `checkViewLayerEnforcement`,
  `checkViewInputEventEnforcement`,
  `checkShellRuntimeContextEnforcement`, and `checkViewArchitecture`
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
