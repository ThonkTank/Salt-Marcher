Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-30
Source of Truth: Detailed CI job policy, external service setup, branch
protection expectations, and review governance for SaltMarcher quality
platforms.

# Quality Platforms CI And Branch Protection

## Purpose

This subordinate standard defines the CI-facing and repository-configuration
operating model beneath the umbrella
[Quality Platforms Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/verification/quality-platforms.md:1).

## GitHub Actions

The workflow lives in
[.github/workflows/quality-platforms.yml](/home/aaron/Schreibtisch/projects/SaltMarcher/.github/workflows/quality-platforms.yml:1)
and defines four jobs.

| Job | Status | Current policy |
| --- | --- | --- |
| `quality-platforms / local-quality` | `Required CI Gate` | Runs `./gradlew check --console=plain`; this is the required CI aggregate for repository-owned blocking Gradle checks. Local documentation-only and check-only default proof routes stay narrower than this CI job. |
| `quality-platforms / ckjm-report` | `Required CI Report` | Runs `./gradlew ckjmMain --console=plain`, uploads the wrapper-isolated CKJM report path `build/isolated-gradle/**/reports/ckjm/` plus the conventional fallback `build/reports/ckjm/`, then removes the per-invocation isolation roots in a final cleanup step. CKJM hotspot regressions stay report-only and surface in the uploaded summary. |
| `quality-platforms / sonarcloud` | `Required CI Gate` | Runs Gradle `sonar` with `sonar.qualitygate.wait=true`. |
| `quality-platforms / codescene` | `Required CI Gate` | Runs `python3 tools/quality/scripts/codescene_delta.py`; fails on returned CodeScene `quality-gates`. |

The focused local gate
`./gradlew checkDocumentationEnforcement --console=plain` remains intentionally
outside the required GitHub Actions job set. It is the local default proof
route for documentation-only governance changes without reclassifying them as
CI full-build work.

Wrapper-based CI Gradle jobs use the same invocation-isolated runtime as local
wrapper runs. Any uploaded Gradle-produced artifacts must therefore read from
the wrapper-isolated `build/isolated-gradle/**/reports/...` path, or list that
path before a conventional `build/reports/...` fallback when the workflow
needs compatibility with non-wrapper or pre-isolation producers.

CI cleanup must run only after the job's last Gradle artifact consumer. The
workflow therefore performs wrapper-isolation cleanup in final `if: always()`
steps after uploads and other Gradle-result consumers complete.

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
- Keep `quality-platforms / ckjm-report` visible for uploaded metrics; do not
  treat CKJM hotspot regressions as merge blockers unless a later ADR promotes
  them back to blocking status.

## Review Governance

The quality platforms do not replace human review.

- documentation ownership, source-of-truth conflicts, and same-change
  documentation updates remain review responsibilities
- `AGENTS.md` defines the default local verification scope mechanically by
  change type; review and authoring still own mixed or ambiguous cases near
  the boundary between production-code, check-only, and documentation-only
  work
- GitHub branch protection, required checks, secrets, variables, and service
  project bindings remain repository configuration, not Gradle behavior
- whether a PMD, CPD, Lizard, SonarCloud, or CodeScene finding is a symptom of
  a larger design problem remains review-owned even when the immediate gate is
  mechanically enforced
- maintainability concerns without stable mechanical shape remain review-owned
  until the umbrella standard names a platform, a blocking task or CI job, and
  the threshold or service policy that makes them mechanical

## References

- [Quality Platforms Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/verification/quality-platforms.md:1)
- [.github/workflows/quality-platforms.yml](/home/aaron/Schreibtisch/projects/SaltMarcher/.github/workflows/quality-platforms.yml:1)
