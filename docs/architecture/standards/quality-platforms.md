Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-17
Source of Truth: Quality-platform operating model, local usage, GitHub Actions
integration, and branch-protection expectations.

# Quality Platforms Standard

SaltMarcher uses four additional quality-platform integrations on top of the
existing local PMD, Lizard, CPD, and architecture harness checks:

- `ArchUnit` runs as part of `./gradlew test` and enforces package-level cycle
  freedom in `src.domain`, `src.view`, `src.data`, and `shell`.
- `CKJM ext` runs through `./gradlew ckjmMain` and produces OO-metric reports
  under `build/reports/ckjm/`.
- `SonarCloud` runs in GitHub Actions through the Gradle `sonar` task and is
  intended to be a required PR check.
- `CodeScene` runs in GitHub Actions through `tools/quality/codescene_delta.py`
  and is intended to be a required PR check.

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

- `./gradlew test --console=plain`
- `./gradlew ckjmMain --console=plain`
- `./gradlew check --console=plain`

`ckjmMain` is intentionally report-only in v1. It should inform refactoring
priorities, not block the build until the project has metric-specific
calibration.

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
