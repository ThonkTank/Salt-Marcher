Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-18
Source of Truth: Quality-platform operating model, task entrypoints, local
usage, GitHub Actions integration, and branch-protection expectations.

# Quality Platforms Standard

SaltMarcher uses additional quality-platform integrations on top of the
existing compiler, CPD, and repository policy checks:

- `ArchUnit` runs through `./gradlew architectureTest` and enforces package-
  level dependency boundaries between `bootstrap`, `shell`, `src.view`,
  `src.domain`, and `src.data`, plus cross-feature application-service-only
  access below the view layer outside dedicated view-architecture ownership,
  and cycle freedom across domain, view, data, and shell slices.
- `jQAssistant` runs through `./gradlew checkViewArchitecture` and is also
  invoked automatically from `./gradlew compileJava` so canonical MVVM
  topology failures already break the compile entrypoint.
- `Error Prone` runs through `./gradlew compileJava` and owns compiler-precise
  MVVM checks such as root-delegation bans, `View`/`assembly` dependency
  bans, `ViewModel` framework bans, root `ShellRuntimeContext.services()`
  bans, shell API allowlist checks on view roots, `assembly/`, and data
  `*ServiceContribution` roots, state-placement bans, reflection-bypass bans,
  `api/` dependency bans, `api/` signature-leak checks, public domain
  boundary signature purity against outer-layer and foreign private domain
  leaks, data-gateway return-type bans on domain exposure, and repository/query
  public-signature bans on leaking internal data implementation types.
- `PMD architecture` runs through `./gradlew pmdArchitectureMain` and enforces
  Java source conventions for feature entrypoints, thin stateless root
  surfaces, and forbidden framework or wiring patterns.
- `build-harness` runs through `./gradlew :build-harness:check` and enforces
  repository topology, package-path alignment, and non-view-architecture
  presence rules on active code surfaces directly, without fixture-based
  selftests.
- `CKJM ext` runs through `./gradlew ckjmMain` and produces OO-metric reports
  under `build/reports/ckjm/`.
- `Lizard` runs through `./gradlew lizardMain` and is part of the blocking
  local `check` pipeline.
- `SonarCloud` runs in GitHub Actions through the Gradle `sonar` task and is
  intended to be a required PR check.
- `CodeScene` runs in GitHub Actions through
  `tools/quality/scripts/codescene_delta.py`
  and is intended to be a required PR check.

The task wiring for local quality lives in the included build
`tools/gradle/build-logic/` through the `saltmarcher.quality-conventions`
plugin. The root build keeps application and packaging behavior, while the
convention plugin owns check aggregation, Error Prone configuration, and typed
Gradle task implementations for repository-policy and metric gates.
SaltMarcher view-architecture rules live in
`tools/quality/jqassistant/rules/` and are configured by
`tools/quality/jqassistant/config.yml`.

The binding MVVM model is defined in
[Model-View-ViewModel Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/view-mvvm.md:1).
The binding system-wide layer and dependency model is defined in
[System Layer Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/system-layer-architecture.md:1).
The binding shell workbench model is defined in
[Passive Workbench Shell Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/shell-workbench.md:1),
and discovery/bootstrap mechanics are defined in
[Shell Discovery And Bootstrap Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/shell-and-discovery.md:1).
The binding DDD-primary domain-layer model is defined in
[Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/domain-layer.md:1).
The binding data-layer adapter model is defined in
[Data Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/data-layer.md:1).
The canonical rule-shape split, owner model, and status vocabulary for
build-blocking architecture rules live in the
[Architecture Enforcement Harness Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/architecture-enforcement-harness.md:1).

## Verification Policy

SaltMarcher does not use behavior-coupled automated tests as a safety strategy.

- Do not add JUnit or similar automated tests for feature behavior, internal
  orchestration, UI helpers, or other change-coupled logic whose assertions
  must be migrated alongside normal behavior changes.
- Do not add fixture-based selftests or meta-test suites inside verification
  harnesses such as `build-harness`; express those policies directly in the
  owning gate instead.
- Use the existing structural and build gates for automated confidence:
  compiler checks, `checkViewArchitecture`, `architectureTest`,
  `pmdArchitectureMain`,
  `:build-harness:check`, and the quality platforms named in this document.
- Use manual testing for behavior verification and workflow validation.
- Do not expand the compile/build/check pipeline with new automated gates unless
  the user explicitly requests that expansion.
- `./gradlew test` is not a general-purpose home for behavior-regression
  suites.

## Operating Model

SaltMarcher should use `branch -> pull request -> auto-merge` for changes into
`main`.

- Direct pushes to `main` should be disabled.
- Required reviews are optional in this setup; the primary merge blockers are
  quality checks.
- Auto-merge should be enabled so that a green PR can land without a manual
  merge click.
- `quality-platforms / local-quality`, `quality-platforms / sonarcloud`, and
  `quality-platforms / codescene` are the intended blocking checks for that
  flow.

## Local Usage

- `./gradlew compileJava --console=plain`
  This runs compiler-precise view and data architecture checks and then the
  blocking MVVM jQAssistant analyze step after a successful Java compile.
- `./gradlew checkViewArchitecture --console=plain`
- `./gradlew architectureTest --console=plain`
- `./gradlew pmdArchitectureMain --console=plain`
- `./gradlew :build-harness:check --console=plain`
- `./gradlew checkArchitecture --console=plain`
- `./gradlew checkCentralizedStylesheets --console=plain`
- `./gradlew checkDefinedStyleClassSelectors --console=plain`
- `./gradlew checkNoCompiledArtifactsInSource --console=plain`
- `./gradlew checkDesktopPackagingInputs --console=plain`
- `./gradlew jqassistantEffectiveRules --console=plain`
- `./gradlew cpdMain --console=plain`
- `./gradlew ckjmMain --console=plain`
- `./gradlew lizardMain --console=plain`
- `./gradlew check --console=plain`

`check` is the blocking local aggregate. It includes compiler checks,
`checkViewArchitecture`, `checkArchitecture`, repository-policy checks,
`cpdMain`,
`lizardMain`, and `ckjmMain`.

## Architecture Harness Relationship

This document describes how the quality platforms are operated. The harness
standard above defines which engine owns which class of architecture rule.

Operationally, the architecture harness enters local quality through these
tasks:

- `compileJava`
  - runs `Error Prone`, including blocking compiler-precise view and data
    architecture rules plus the blocking programmatic visual-styling ban
  - finalizes with the blocking canonical `jQAssistant` MVVM analysis after a
    successful Java compile
- `checkViewArchitecture`
  - runs the explicit canonical MVVM topology analysis
- `checkArchitecture`
  - aggregates `architectureTest`, `pmdArchitectureMain`, and
    `:build-harness:check`
- `checkCentralizedStylesheets`
  - runs the blocking centralized stylesheet placement verifier
- `checkDefinedStyleClassSelectors`
  - runs the blocking Java-to-central-selector resolution verifier
- `checkNoCompiledArtifactsInSource`
  - runs the blocking compiled-artifact source-root verifier
- `checkDesktopPackagingInputs`
  - runs the blocking desktop packaging input verifier
- `check`
  - runs the architecture harness plus adjacent blocking quality gates

## Adjacent Blocking Quality Platforms

Not every blocking quality task is the primary owner of an architecture rule.

- `build-logic` convention tasks own repository-wide build and resource policy
  checks such as centralized stylesheet placement, compiled-artifact bans under
  active source roots, and desktop packaging input validation.
- `checkCentralizedStylesheets`, `checkDefinedStyleClassSelectors`,
  `checkNoCompiledArtifactsInSource`, and `checkDesktopPackagingInputs` are
  blocking typed Gradle verifiers, but they are not aggregated under
  `checkArchitecture`.
- `CPD`, `Lizard`, and `CKJM ext` are blocking local quality platforms, but
  they are not the canonical owner of SaltMarcher layer-model rules.
- `SonarCloud` and `CodeScene` are CI-quality platforms intended as required PR
  checks, but they are not the primary local owner of architectural boundary
  contracts.

## Review Governance

- Documentation ownership, source-of-truth conflicts, and same-change
  documentation updates remain review responsibilities.
- GitHub branch protection, required checks, and auto-merge remain repository
  configuration, not Gradle behavior.
- The stronger system-layer rules do not all have the same status. Use the
  harness standard as the canonical classification:
  - already enforced: top-level inward dependency direction, view access to
    backend boundaries only through public `*ApplicationService` roots and
    public `api/`, root-only shell bridging in view, root-only shell
    registration in data, the `shell.api` / `shell.host` split including the
    bootstrap-only access rule for `shell.host.AppShell`, public domain
    boundary signatures staying free of outer-layer types and foreign private
    domain types, and the structurally expressible subset of boundary-carrier
    purity
  - current candidate: same-feature internal carrier purity on domain-owned
    public backend boundaries, with the preferred future owner being
    `Error Prone` on `compileJava`
  - still review-owned: seam minimization to the smallest intentional public
    boundary, semantically needless pass-through wrappers, and coordination
    duplication or shell-passivity drift that is not reducible to stable
    structure
- Review-only architectural rules stay review-owned until the harness standard
  names a primary mechanical owner and a blocking task for them explicitly.

## GitHub Actions

The workflow lives in [.github/workflows/quality-platforms.yml](/home/aaron/Schreibtisch/projects/SaltMarcher/.github/workflows/quality-platforms.yml:1)
and defines four jobs:

- `local-quality`: runs `./gradlew check`
- `ckjm-report`: runs `./gradlew ckjmMain` and uploads reports
- `sonarcloud`: runs Gradle-backed SonarCloud analysis and waits for the quality
  gate
- `codescene`: triggers a CodeScene delta analysis and uploads the result
  documents

Configure the following repository secrets and variables before enabling branch
protection and auto-merge:

### SonarCloud

Repository secret:

- `SONAR_TOKEN`

Repository variables:

- `SONAR_ORGANIZATION`
- `SONAR_PROJECT_KEY`

Recommended service-side setup:

- Bind the SonarCloud project to this GitHub repository.
- Use `main` as the reference branch / New Code baseline.
- Create a dedicated quality gate for SaltMarcher new code.
- Fail on:
  - new issues
  - duplicated lines density on new code above `3%`
  - security hotspots reviewed below `100%`
- Do not make coverage a blocking condition yet unless test coverage becomes a
  maintained target.
- Ensure the GitHub repository binding is active so the workflow's
  `GITHUB_TOKEN` can be used for PR context.

Recommended required check:

- `quality-platforms / sonarcloud`

### CodeScene

Repository secret:

- `CODESCENE_API_TOKEN`

Repository variables:

- `CODESCENE_BASE_URL`
- `CODESCENE_PROJECT_ID`

Optional variables:

- `CODESCENE_REPOSITORY`
  Use this when the repository name in CodeScene differs from the GitHub repo
  slug tail.
- `CODESCENE_DELTA_ENDPOINT`
  Override the default inferred endpoint if your CodeScene instance exposes a
  custom delta-analysis URL.
- `CODESCENE_BASIC_USER`
  Set this when your CodeScene instance expects HTTP Basic auth instead of
  Bearer auth for delta-analysis calls.
- `CODESCENE_OFFLINE_MODE=true`
  Append `offline-mode=offline` to the delta-analysis request when your instance
  runs in offline mode.

Recommended service-side setup:

- Bind the CodeScene project to this repository and use `main` as the reference
  branch.
- Enable Delta Analysis for pull requests and pushes to `main`.
- Configure hard gates for:
  - hotspot goals violations
  - code health decline
  - low code health in new code below `8.0`
- Treat absence of expected change pattern as a warning, not a merge blocker.

Recommended required check:

- `quality-platforms / codescene`

The helper script writes raw and human-readable outputs to
`build/reports/codescene/`.

## Branch Protection

After the secrets and service-side project bindings are in place, configure
`main` as follows:

- Require a pull request before merging.
- Disable direct pushes to `main`.
- Enable auto-merge.
- Keep required reviews optional unless the team later decides otherwise.
- `quality-platforms / local-quality`
- `quality-platforms / sonarcloud`
- `quality-platforms / codescene`

`ckjm-report` should remain informational until the team defines project-specific
thresholds for CKJM metrics like `RFC`, `CBO`, `LCOM`, and `WMC`.
