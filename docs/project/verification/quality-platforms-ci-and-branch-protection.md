Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-05-19
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
| `quality-platforms / production-handoff` | `Required CI Gate` | Runs `tools/gradle/run-staged-verification.sh production-handoff`; this is the single public CI handoff surface for assemble, blocking quality hygiene, and internal architecture/build-harness structure checks. |
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

SaltMarcher should use a pull request with required checks before changes enter
`main`. Local linked worktrees or per-agent branches are optional operator
choices, not repository governance requirements.

Configure `main` as follows after service secrets and project bindings are in
place:

- Require a pull request before merging.
- Disable direct pushes to `main`.
- Enable auto-merge.
- Prefer merge queue once the repository plan supports it; if merge queue is
  enabled, require the same quality-platform jobs on `merge_group` that are
  required on `pull_request`.
- Keep human GitHub approval reviews optional unless the team later decides
  otherwise.
- Require `quality-platforms / production-handoff`.
- Require `quality-platforms / sonarcloud`.
- Require `quality-platforms / codescene`.
- Keep `quality-platforms / ckjm-report` visible for uploaded metrics; do not
  treat CKJM hotspot regressions as merge blockers unless a later ADR promotes
  them back to blocking status.

### Branch Protection Readback

The branch-protection bullets above are `Intended Policy`. They are not proof
that GitHub currently blocks merges. Live required-check conformity is
`Qualified` only after a read-only GitHub API readback proves the protected
branch, active rulesets, or both require the documented blocking checks for the
stated repository, branch, actor, and timestamp. Pull-request requirements,
direct-push restrictions, auto-merge, and merge-queue setup must be recorded as
observed repository configuration before they are claimed, but they are not
qualified by the required-check comparison alone.

Use the official GitHub REST surfaces for readback:

```bash
gh api repos/ThonkTank/Salt-Marcher/branches/main/protection
gh api --paginate 'repos/ThonkTank/Salt-Marcher/rules/branches/main?per_page=100'
gh api --paginate 'repos/ThonkTank/Salt-Marcher/rulesets?targets=branch&per_page=100'
```

The readback must record:

- repository, branch, timestamp, and authenticated actor, or the exact
  authentication failure
- queried endpoints, whether each returned successfully, and whether every
  paginated rules response was exhausted
- classic branch-protection required status checks from
  `required_status_checks.contexts` and `required_status_checks.checks`
- active branch rules from `rules/branches/main`, including required status
  checks when present
- branch-targeted repository rulesets, including `enforcement`, ref-name
  conditions, bypass actors visible to the authenticated actor, and
  required-status-check rules
- comparison result against the intended required blockers:
  `quality-platforms / production-handoff`,
  `quality-platforms / sonarcloud`, and `quality-platforms / codescene`

Readback status uses this vocabulary:

- `Qualified`: the API readback succeeded and shows `main` requires exactly the
  intended blocking checks through classic branch protection, active rulesets,
  or both. A classic branch-protection `404` is acceptable only when the
  paginated active-rules and branch-rulesets readback proves the intended
  required checks through active rulesets.
- `Not Qualified`: readback was not run, authentication failed, required rules
  pagination was not exhausted, all applicable required-check endpoints were
  unavailable, or the required-check set differs.
- `Stricter Drift`: live GitHub also requires
  `quality-platforms / ckjm-report` or another report-only check. Do not claim
  conformity unless this document is intentionally changed to make that check a
  merge blocker.

Do not claim "CI blocks merge" or "branch protection is configured" from this
document alone. Without a fresh API readback, state only that SaltMarcher
intends the listed GitHub checks to be required.

## Review Governance

The quality platforms do not replace review judgment.

- completed repo-tracked change passes follow the SaltMarcher adversarial
  review route through the global adversarial review skills
- documentation ownership, source-of-truth conflicts, and same-change
  documentation updates remain review responsibilities
- `AGENTS.md` defines the default local verification scope mechanically by
  change type; review and authoring still own mixed or ambiguous cases near
  the boundary between production-code, check-only, and documentation-only
  work
- GitHub branch protection, required checks, secrets, variables, and service
  project bindings remain repository configuration, not Gradle behavior
- local parallel implementation safety is owned by caller coordination of
  write sets and shared-file edit ordering, not by Gradle mutating one shared
  checkout into per-run snapshots
- whether a PMD, CPD, Lizard, SonarCloud, or CodeScene finding is a symptom of
  a larger design problem remains review-owned even when the immediate gate is
  mechanically enforced
- maintainability concerns without stable mechanical shape remain review-owned
  until the umbrella standard names a platform, a blocking task or CI job, and
  the threshold or service policy that makes them mechanical

## References

- [Quality Platforms Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/verification/quality-platforms.md:1)
- [.github/workflows/quality-platforms.yml](/home/aaron/Schreibtisch/projects/SaltMarcher/.github/workflows/quality-platforms.yml:1)
- [GitHub Protected Branches REST Reference](/home/aaron/Schreibtisch/projects/references/quality-platforms/github-rest-branch-protection.md:1)
- [GitHub Repository Rules REST Reference](/home/aaron/Schreibtisch/projects/references/quality-platforms/github-rest-repository-rules.md:1)
- [Global Adversarial Review Caller Skill](/home/aaron/.codex/skills/local/adversarial-review/SKILL.md:1)
- [Global Adversarial Review Agent Skill](/home/aaron/.codex/skills/local/adversarial-review-agent/SKILL.md:1)
