Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-19
Source of Truth: Quality-platform operating model, non-architecture quality gate inventory, task entrypoints, local usage, GitHub Actions integration, and branch-protection expectations.

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
[Architecture Enforcement Harness Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/architecture-enforcement-harness.md:1).

## Gate Status Vocabulary

Every quality platform named here belongs to exactly one operating status:
`Blocking Local Gate` for failing local Gradle tasks, `Required CI Gate` for
GitHub Actions jobs intended for branch protection, `Informational Report` for
artifacts without project-specific blocking thresholds, or `Review-Owned` for
binding guidance that needs human judgment.

External services may be both `Required CI Gate` and `Review-Owned` for
different parts of their output. CodeScene quality-gate failures block CI,
while non-blocking warnings still require human judgment.

## Local Gate Inventory

### Compiler Hygiene

`./gradlew compileJava` is a `Blocking Local Gate`.

It owns Java compilation and compiler-integrated hygiene checks on production
source roots `bootstrap/`, `shell/`, and `src/`.

The build enables `Error Prone`, `NullAway`, and project-local Error Prone
checks during `compileJava`. Architecture-specific Error Prone checks are
classified by the architecture harness. Non-architecture compiler hygiene
checks currently promoted to errors are:

- `EqualsNull`
- `NullAway`
- `ReferenceEquality`
- `StringCaseLocaleUsage`
- `StringSplitter`

`compileJava` does not run the jQAssistant MVVM blocker. Graph-shaped MVVM
analysis enters local quality through `checkViewArchitecture`, which is wired
directly into the central `check` aggregate. This keeps focused compilation
verification independent from graph analysis while ensuring `build` still runs
the full architecture harness through `check`.

### Complexity, Duplication, And Metrics

| Platform | Status | Entrypoint | Current policy |
| --- | --- | --- | --- |
| PMD non-architecture smells | `Blocking Local Gate` | `./gradlew pmdMain` | Runs `tools/quality/config/pmd/complexity-ruleset.xml` as a source-only check on production Java sources. |
| SpotBugs plus FindSecBugs | `Blocking Local Gate` | `./gradlew spotbugsMain` | Runs bytecode bug and security-smell analysis with SpotBugs effort `MAX` and confidence `MEDIUM`. |
| CPD | `Blocking Local Gate` | `./gradlew cpdMain` | Runs PMD CPD for Java with `minimumTokens = 80`; writes `build/reports/cpd/main.txt`. |
| Lizard | `Blocking Local Gate` | `./gradlew lizardMain` | Runs pinned `lizard==1.21.3` for Java with max cyclomatic complexity `15`; writes `build/reports/lizard/main.txt`. |
| CKJM ext | `Blocking Local Gate` | `./gradlew ckjmMain` | Runs on compiled production classes, writes `build/reports/ckjm/main.txt` and `build/reports/ckjm/summary.md`, and fails when OO metric thresholds are exceeded. |

PMD non-architecture currently enforces explicit metric thresholds:

- Cognitive complexity: `15`
- Method cyclomatic complexity: `10`
- Class cyclomatic complexity: `80`
- NPath complexity: `200`
- Coupling between objects: `20`
- Deep nested `if` depth: `3`
- Method NCSS count: `30`
- Excessive parameter list minimum: `6`

The same PMD ruleset enables PMD's default thresholds and rule defaults for the
explicitly listed Java quickstart rules plus stricter source-smell rules for
exception handling, resource handling, unnecessary suppressions, magic
literals, low-branch switches, mutable static state, public members on
non-public types, null sentinels, and local naming/style hygiene. The rule file
must list individual rules explicitly rather than importing whole PMD
categories.

`pmdMain` finalizes with a strict PMD CLI pass that fails on both violations
and PMD analysis errors. Full `check` and `build` invocations depend on both
PMD passes directly so a failure in either pass does not hide diagnostics from
the other. This prevents parser or type-resolution failures from being treated
as a clean quality pass. `pmdTest` is disabled; PMD non-architecture smell
policy applies to production source roots, not architecture test sources.

SpotBugs uses the official Gradle plugin with `findsecbugs-plugin` enabled,
effort `MAX`, and confidence `MEDIUM`. `spotbugsTest` is disabled because
behavior-coupled automated tests are not part of the project strategy.

CKJM blocks on these thresholds:

- Weighted methods per class (`WMC`): `50`
- Depth of inheritance tree (`DIT`): `5`
- Number of children (`NOC`): `3`
- Coupling between objects (`CBO`): `14`
- Response for class (`RFC`): `50`
- Lack of cohesion in methods (`LCOM`): `50`
- Afferent couplings (`Ca`): `14`
- Number of public methods (`NPM`): `30`

Focused PMD, SpotBugs, CPD, Lizard, and CKJM entrypoints must stay independent
of the jQAssistant MVVM blocker; they may be run together for quality
investigation without pulling in the view-architecture graph analysis.

Checkstyle metrics and Semgrep are deferred unless current tooling cannot
express a concrete rule.

`./gradlew pmdArchitectureMain` is intentionally separate. It belongs to the
architecture harness and runs source-level architecture policy rules.

### Repository And Resource Policy

Typed Gradle verification tasks in `tools/gradle/build-logic/` own
repository-wide resource, artifact, and packaging policies that are not
language-level architecture rules.

| Entrypoint | Status | Current policy |
| --- | --- | --- |
| `./gradlew checkCentralizedStylesheets` | `Blocking Local Gate` | Stylesheet files with supported stylesheet extensions must live directly under top-level `resources/`. |
| `./gradlew checkDefinedStyleClassSelectors` | `Blocking Local Gate` | Style classes authored from Java through `getStyleClass()` calls must resolve to selectors in centralized `resources/*.css` files. |
| `./gradlew checkNoCompiledArtifactsInSource` | `Blocking Local Gate` | `.class` files must not exist under active source roots. |
| `./gradlew checkDesktopPackagingInputs` | `Blocking Local Gate` | Desktop main/preloader class sources, icon paths, stylesheet path, launcher name, and `StartupWMClass` must be present and valid. |

The styling rules behind the stylesheet and selector gates are defined in the
[Styling Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/styling.md:1).

## Aggregates And Entry Points

`./gradlew check --console=plain` is the local full quality blocker and the
single central aggregate for repository-owned Gradle checks.

It includes:

- Java compiler hygiene through `compileJava`
- default PMD quality checks through `pmdMain`
- architecture-harness checks through `architectureTest`,
  `pmdArchitectureMain`, `:build-harness:check`, and `checkViewArchitecture`
- repository and resource policy checks
- bytecode bug and security-smell analysis through `spotbugsMain`
- duplicate-code detection through `cpdMain`
- cyclomatic-complexity detection through `lizardMain`
- CKJM metric thresholding through `ckjmMain`

`./gradlew build --console=plain` remains the implementation-handoff build
required by `AGENTS.md`. It reaches the same full check set through Gradle's
standard `build -> check` lifecycle; SaltMarcher-specific checks must be wired
to `check`, not duplicated on `build`. A completed implementation pass is
incomplete until that build has been rerun or a concrete blocker has been
reported.

Focused investigation entrypoints are `compileJava`, `pmdMain`,
`spotbugsMain`, `pmdArchitectureMain`, `cpdMain`, `lizardMain`, `ckjmMain`,
`checkCentralizedStylesheets`, `checkDefinedStyleClassSelectors`,
`checkNoCompiledArtifactsInSource`, `checkDesktopPackagingInputs`, and
`jqassistantEffectiveRules`, each run through `./gradlew <task>
--console=plain`.

Architecture-focused entrypoints:

- `./gradlew checkArchitecture --console=plain`
  Aggregates `architectureTest`, `pmdArchitectureMain`, and
  `:build-harness:check`.
- `./gradlew checkViewArchitecture --console=plain`
  Runs the explicit jQAssistant MVVM topology analysis.

The Gradle convention implementation must keep these public entrypoints stable
while organizing internal wiring by policy area: invocation behavior, compiler
gates, graph analysis, quality reports, repository/resource policy, and the
central aggregate. This keeps local command usage stable while making the build
logic easier to extend.

### Parallel Local Invocation Isolation

Local Gradle gates support concurrent agent runs by isolating mutable
project-local Gradle output when an isolation id is available.

`CODEX_THREAD_ID` is the default isolation id for Codex-managed invocations.
Other local agents that run Gradle gates concurrently must set a unique
`SALTMARCHER_GRADLE_ISOLATION_ID`.

Isolated invocations keep the normal entrypoints, including
`./gradlew build --console=plain`, but write build outputs under
`build/isolated-gradle/<isolation-id>/` and project-cache state under
`.gradle/isolated-gradle/<isolation-id>/`. The shared Gradle user home remains
unchanged so dependency caches stay reusable.

CI is not isolated by default because CI jobs do not provide these local agent
isolation environment variables. Required GitHub Actions report paths therefore
remain the conventional `build/` paths.

For invocations that request any local quality or architecture gate named in
this section, the convention plugin enables Gradle continue-on-failure behavior
automatically. A run still fails when any blocking check fails, but independent
checks that are not blocked by failed dependencies must continue and report
their failures together.

This does not make bytecode-dependent gates source-only. `spotbugsMain`,
`ckjmMain`, and `checkViewArchitecture` still require current compiled classes;
if `compileJava` fails, those checks may be skipped because their prerequisite
failed rather than because another independent check failed.

Local blocking Gradle gates must produce diagnostics from the current
invocation. `compileJava`, PMD, SpotBugs, ArchUnit-backed test entrypoints,
jQAssistant, CPD, Lizard, CKJM, build-harness architecture checks, and
Gradle-owned resource policy checks must not report success by being skipped as
`UP-TO-DATE` or restored from the build cache. Tool installation, dependency
resolution, packaging, and generated-resource preparation tasks may remain
incremental because they are not the gate result itself.

## Verification Policy

SaltMarcher uses structural and build gates for automated confidence, and
manual testing for behavior verification.

- Do not add JUnit or similar automated tests for feature behavior, internal
  orchestration, UI helpers, or other change-coupled logic whose assertions
  must be migrated alongside normal behavior changes.
- Do not add fixture-based selftests or meta-test suites inside verification
  harnesses such as `build-harness`; express repository policies directly in
  the owning gate instead.
- Do not expand the compile/build/check pipeline with new automated gates
  unless the user explicitly requests that expansion.
- Treat only the CKJM thresholds named here as mechanical blockers.
- Use manual testing for workflow behavior, desktop interaction, UI judgment,
  and product acceptance.
- `./gradlew test` is not a general-purpose home for behavior-regression
  suites.

## Architecture Harness Relationship

This standard describes how quality platforms are operated. The harness
standard defines which engine owns which class of architecture rule.

Operationally, architecture checks enter local quality through:

- `compileJava`
  Runs Error Prone architecture checks, including positive root
  `createScreen(...)` delegation into the owning view `assembly/`.
- `architectureTest`
  Runs ArchUnit dependency and cycle checks, including view-component cycle
  freedom.
- `checkViewArchitecture`
  Runs explicit jQAssistant MVVM topology analysis.
- `checkArchitecture`
  Aggregates ArchUnit, PMD architecture rules, and the build-harness.
- `check`
  Runs the architecture harness plus adjacent non-architecture quality gates.
  Its jQAssistant coverage comes from the explicit `checkViewArchitecture`
  dependency.

Architecture rule status must not be reclassified here. If a layer standard and
the harness standard disagree about whether a rule is mechanically enforced,
the harness standard is the canonical classification.

## GitHub Actions

The workflow lives in
[.github/workflows/quality-platforms.yml](/home/aaron/Schreibtisch/projects/SaltMarcher/.github/workflows/quality-platforms.yml:1)
and defines four jobs.

| Job | Status | Current policy |
| --- | --- | --- |
| `quality-platforms / local-quality` | `Required CI Gate` | Runs `./gradlew check --console=plain`; this is the CI mirror of the local full blocker. |
| `quality-platforms / ckjm-report` | `Blocking Local Gate` | Runs `./gradlew ckjmMain --console=plain` and uploads `build/reports/ckjm/`; CKJM threshold failures fail the job. |
| `quality-platforms / sonarcloud` | `Required CI Gate` | Runs Gradle `sonar` with `sonar.qualitygate.wait=true`. |
| `quality-platforms / codescene` | `Required CI Gate` | Runs `python3 tools/quality/scripts/codescene_delta.py`; fails on returned CodeScene `quality-gates`. |

### SonarCloud

Repository secret:

- `SONAR_TOKEN`

Repository variables:

- `SONAR_ORGANIZATION`
- `SONAR_PROJECT_KEY`

Recommended service-side setup: bind the project to this repository; use
`main` as the New Code baseline; create a SaltMarcher new-code quality gate;
fail on new issues, duplicated lines density above `3%`, and security hotspots
reviewed below `100%`; keep coverage non-blocking unless it becomes a
maintained target; keep GitHub binding active for PR context.

### CodeScene

The helper script triggers CodeScene delta analysis, waits for a result, writes
`build/reports/codescene/delta-analysis.json` and
`build/reports/codescene/delta-analysis.md`, and fails when returned
`quality-gates` are truthy.

Repository secret:

- `CODESCENE_API_TOKEN`

Repository variables:

- `CODESCENE_BASE_URL`
- `CODESCENE_PROJECT_ID`

Optional variables:

- `CODESCENE_REPOSITORY`
- `CODESCENE_DELTA_ENDPOINT`
- `CODESCENE_BASIC_USER`
- `CODESCENE_OFFLINE_MODE=true`
- `CODESCENE_TIMEOUT_SECONDS`
- `CODESCENE_POLL_SECONDS`

Recommended service-side setup: bind the project to this repository with
`main` as reference branch; enable Delta Analysis for pull requests and pushes
to `main`; hard-gate hotspot goal violations, code health decline, and new-code
health below `8.0`; treat absent expected change patterns as warnings.

## Branch Protection

SaltMarcher should use `branch -> pull request -> auto-merge` for changes into
`main`.

Configure `main` as follows after service secrets and project bindings are in
place:

- Require a pull request before merging.
- Disable direct pushes to `main`.
- Enable auto-merge.
- Keep required reviews optional unless the team later decides otherwise.
- Require `quality-platforms / local-quality`.
- Require `quality-platforms / sonarcloud`.
- Require `quality-platforms / codescene`.
- Require `quality-platforms / ckjm-report`.

## Review Governance

The quality platforms do not replace human review.

- Documentation ownership, source-of-truth conflicts, and same-change
  documentation updates remain review responsibilities.
- GitHub branch protection, required checks, secrets, variables, and service
  project bindings remain repository configuration, not Gradle behavior.
- Whether a PMD, CPD, Lizard, SonarCloud, or CodeScene finding is a symptom of
  a larger design problem remains review-owned even when the immediate gate is
  mechanically enforced.
- Maintainability concerns without stable mechanical shape remain review-owned
  until this standard names a platform, a blocking task or CI job, and the
  threshold or service policy that makes them mechanical.

## References

- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/overview.md:1)
- [Architecture Enforcement Harness Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/architecture-enforcement-harness.md:1)
- [Documentation Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/documentation.md:1)
- [Styling Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/styling.md:1)
- [ADR 016: Architecture Enforcement Operating Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/016-architecture-enforcement-operating-model.md:1)
