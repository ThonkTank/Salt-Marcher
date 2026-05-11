Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-05-11
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
| `quality-platforms / production-handoff` | `Required CI Gate` | Runs `tools/gradle/run-staged-verification.sh production-handoff`; this is the single public CI handoff surface for assemble, `test`, quality hygiene, and the public `checkArchitecture` aggregate. |
| `quality-platforms / ckjm-report` | `Required CI Report` | Runs `tools/gradle/run-observable-gradle.sh ckjmMain` and uploads the CKJM report from `build/reports/ckjm/`. CKJM hotspot regressions stay report-only and surface in the uploaded summary. |
| `quality-platforms / sonarcloud` | `Required CI Gate` | Runs Gradle `sonar` with `sonar.qualitygate.wait=true`. |
| `quality-platforms / codescene` | `Required CI Gate` | Runs `python3 tools/quality/scripts/codescene_delta.py`; fails on returned CodeScene `quality-gates`. |

The focused local gate
`./gradlew checkDocumentationEnforcement --console=plain` remains intentionally
outside the required GitHub Actions job set. It is the local default proof
route for documentation-only governance changes without reclassifying them as
CI full-build work.

CI jobs run in fresh GitHub-hosted checkouts, so they do not need repo-local
same-worktree isolation cleanup. The concurrency concern in CI is stale runs on
the same ref, not mutable Gradle state inside one filesystem tree. The
workflow therefore uses workflow concurrency and `merge_group` coverage instead
of cleanup steps for synthetic isolated run roots.

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
`main` as reference branch; enable Delta Analysis for pull requests,
`merge_group`, and pushes to `main`; hard-gate hotspot goal violations, code
health decline, and new-code health below `8.0`; treat absent expected change
patterns as warnings.

## Branch Protection

SaltMarcher should use `linked worktree -> topic branch -> pull request ->
required checks -> auto-merge or merge queue` for changes into `main`.

Configure `main` as follows after service secrets and project bindings are in
place:

- Require a pull request before merging.
- Disable direct pushes to `main`.
- Enable auto-merge.
- Prefer merge queue once the repository plan supports it; if merge queue is
  enabled, require the same quality-platform jobs on `merge_group` that are
  required on `pull_request`.
- Keep human GitHub approval reviews optional unless the team later decides
  otherwise; SaltMarcher's mandatory review is the local adversarial subagent
  review before commit or handoff through the repo-owned `adversarial-review`
  skill.
- Require `quality-platforms / production-handoff`.
- Require `quality-platforms / sonarcloud`.
- Require `quality-platforms / codescene`.
- Keep `quality-platforms / ckjm-report` visible for uploaded metrics; do not
  treat CKJM hotspot regressions as merge blockers unless a later ADR promotes
  them back to blocking status.

## Review Governance

The quality platforms do not replace review judgment.

- completed repo-tracked change passes require a separate adversarial review
  subagent using `tools/quality/skills/adversarial-review/SKILL.md` before
  commit or handoff; specialist review skills may support that review, but they
  do not replace the repo-owned review protocol
- review findings are classified as `Must Fix Before Commit`,
  `Should Fix In This Pass`, `Separate Slice`, or
  `False Positive / Review-Owned`; unresolved `Must Fix Before Commit`
  findings keep the pass WIP
- documentation ownership, source-of-truth conflicts, and same-change
  documentation updates remain review responsibilities
- `AGENTS.md` defines the default local verification scope mechanically by
  change type; review and authoring still own mixed or ambiguous cases near
  the boundary between production-code, check-only, and documentation-only
  work
- GitHub branch protection, required checks, secrets, variables, and service
  project bindings remain repository configuration, not Gradle behavior
- local parallel implementation safety is owned by linked worktrees and branch
  workflow, not by Gradle mutating one shared checkout into per-run snapshots
- whether a PMD, CPD, Lizard, SonarCloud, or CodeScene finding is a symptom of
  a larger design problem remains review-owned even when the immediate gate is
  mechanically enforced
- maintainability concerns without stable mechanical shape remain review-owned
  until the umbrella standard names a platform, a blocking task or CI job, and
  the threshold or service policy that makes them mechanical

## References

- [Quality Platforms Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/verification/quality-platforms.md:1)
- [.github/workflows/quality-platforms.yml](/home/aaron/Schreibtisch/projects/SaltMarcher/.github/workflows/quality-platforms.yml:1)
- [Adversarial Review Skill](/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/adversarial-review/SKILL.md:1)
