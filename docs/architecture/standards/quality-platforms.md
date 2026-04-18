Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-18
Source of Truth: Quality-platform operating model, local usage, GitHub Actions
integration, and branch-protection expectations.

# Quality Platforms Standard

SaltMarcher uses additional quality-platform integrations on top of the
existing compiler, CPD, and repository policy checks:

- `ArchUnit` runs through `./gradlew architectureTest` and enforces package-
  level dependency boundaries between `bootstrap`, `shell`, `src.view`,
  `src.domain`, and `src.data`, plus cross-feature API-only access below the
  view layer outside MVCI ownership.
- `jQAssistant` runs through `./gradlew checkMvci` and is the single owner for
  mechanical MVCI dependency, cross-component view reuse, and view-topology
  contracts.
- `PMD architecture` runs through `./gradlew pmdArchitectureMain` and enforces
  Java source conventions for feature entrypoints, slot usage, and forbidden
  framework or wiring patterns.
- `build-harness` runs through `./gradlew :build-harness:check` and enforces
  repository topology, package-path alignment, and persistence- or
  documentation-correlated non-MVCI presence rules.
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
SaltMarcher MVCI rules live in `tools/quality/jqassistant/rules/` and are
configured by `tools/quality/jqassistant/config.yml`.

The binding passive-view MVCI model is defined in
[View MVCI Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/view-mvci.md:1).
Not every part of that model is already encoded mechanically. This document
must therefore distinguish between current gate coverage and review-owned
future coverage.

## Verification Policy

SaltMarcher does not use behavior-coupled automated tests as a safety strategy.

- Do not add JUnit or similar automated tests for feature behavior, internal
  orchestration, UI helpers, or other change-coupled logic whose assertions
  must be migrated alongside normal behavior changes.
- Use the existing structural and build gates for automated confidence:
  compiler checks, `checkMvci`, `architectureTest`, `pmdArchitectureMain`,
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
- `./gradlew checkMvci --console=plain`
- `./gradlew architectureTest --console=plain`
- `./gradlew pmdArchitectureMain --console=plain`
- `./gradlew :build-harness:check --console=plain`
- `./gradlew checkArchitecture --console=plain`
- `./gradlew jqassistantEffectiveRules --console=plain`
- `./gradlew cpdMain --console=plain`
- `./gradlew ckjmMain --console=plain`
- `./gradlew lizardMain --console=plain`
- `./gradlew check --console=plain`

`check` is the blocking local aggregate. It includes compiler checks,
`checkMvci`, `checkArchitecture`, repository-policy checks, `cpdMain`,
`lizardMain`, and `ckjmMain`.

## Boundary Ownership

- `ArchUnit` covers bytecode-visible dependency direction:
  - `bootstrap` stays outside feature code
  - `shell` stays outside feature code
  - `domain` stays independent from `view`, `shell`, `bootstrap`, and `data`
  - `data` adapters stay out of presentation and shell code
- `PMD architecture` covers Java source policies:
  - root-entrypoint naming and `public final` / public no-arg requirements
  - required entrypoint methods such as `registrationSpec()`,
    `createScreen(...)`, and `register(...)`
  - shell contribution spec selection and slot-matrix validation
  - view bans on legacy shell wiring types
  - domain bans on UI and infrastructure framework tokens
  - inline JavaFX styling bans such as `setStyle(...)`
  - bans on legacy runtime-service persistence wiring
- `jQAssistant` currently covers MVCI and view-topology ownership:
  - controller, view, model, and interactor bucket boundaries
  - interactor bans on scene-graph and non-API domain dependencies
  - cross-component private-bucket bans and `*shared` reuse rules
  - allowed `src/view/<component>/` buckets
  - placement of `*RuntimeSession`, `*ScreenAssembly`, and `*ShellAdapter`
  - exactly-one view root entrypoint and bucket/package consistency
- `jQAssistant` is also the designated future owner for the remaining passive-
  view MVCI rules that are source of truth today but not yet fully mechanized:
  - root-entrypoint dependency restriction to `shell.*` plus own `assembly/`
  - plain-state ban on `javafx.*` in `Model/`
  - controller ban on `Model/` types
  - `api/` as the only public cross-component view boundary
  - public-signature bans on leaking private bucket types through `api/`
  - full scene-graph confinement to `View/` and `assembly/`
- `build-harness` covers repository topology and documentation-correlated
  non-MVCI presence rules:
  - repository layout and package-path alignment
  - `src/domain/<feature>/<feature>API.java` presence for domain features
  - missing persistence root entrypoints in `src/data/<feature>/`
  - exactly one persistence schema per persistence-exporting feature
- `build-logic` convention tasks cover repository-wide policy and metric rules
  that are easier to express as Gradle-owned verification:
  - centralized stylesheet placement under top-level `resources/`
  - compiled artifact bans under active source roots
  - desktop packaging metadata and resource presence
  - CPD duplicate detection
  - Lizard complexity verification
  - CKJM metrics reporting and blocking thresholds

## Review-Only Governance

Not every documented architecture rule is a compile-time invariant.

- Documentation ownership, source-of-truth conflicts, and same-change doc
  updates remain review responsibilities.
- GitHub branch protection, required checks, and auto-merge remain repository
  configuration, not Gradle behavior.
- Positive runtime access rules such as preferring
  `ShellRuntimeContext.persistence()` and `ShellRuntimeContext.inspector()`
  remain review rules until a dedicated check owns them.
- The stronger passive-view rules named in the view MVCI standard remain
  review-owned until `checkMvci` is expanded to cover them explicitly.
- When a rule becomes mechanically checkable, this document should name the
  owning gate explicitly instead of implying blanket enforcement.

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
