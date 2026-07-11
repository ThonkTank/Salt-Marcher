Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-07
Source of Truth: Detailed CI job policy, external service setup, branch
protection expectations, and review governance for SaltMarcher quality
platforms.

# Quality Platforms CI And Branch Protection

## Purpose

This subordinate standard defines the CI-facing and repository-configuration
operating model beneath the umbrella
[Quality Platforms Standard](docs/project/verification/quality-platforms.md:1).

## GitHub Actions

The workflow lives in
[.github/workflows/quality-platforms.yml](.github/workflows/quality-platforms.yml:1)
and defines seven jobs.

| Job | Status | Current policy |
| --- | --- | --- |
| `production-handoff` | `Required CI Gate` | Runs `tools/gradle/run-staged-verification.sh production-handoff`; this is the single public CI handoff surface for assemble, blocking quality hygiene, and internal architecture/build-harness structure checks. |
| `warden-freeze` | `Required CI Gate` | Restores the base-ref warden script, then enforces R3c classification for frozen-surface changes and the narrow risk-label plausibility checks. |
| `behavior-gate` | `Required CI Gate` | Restores the base-ref harness selector, selects behavior harnesses from `tools/quality/config/harness-map.json`, and runs them under `xvfb-run`; succeeds with a notice when no mapped surface changed. |
| `judge-review` | `Required CI Gate` | Restores the base-ref judge script, runs immediately for R0, fails closed for R1+ without the judge secret, and accepts only a PASS verdict or owner-only `judge-override`. |
| `ckjm-report` | `Informational CI Report` | Runs `tools/gradle/run-observable-gradle.sh ckjmMain` and uploads the CKJM report from `build/reports/ckjm/`. |
| `sonarcloud` | `Informational CI Report` | Runs Gradle `sonar` with `sonar.qualitygate.wait=true`; skipped for Dependabot or when SonarCloud configuration is incomplete. |
| `codescene` | `Informational CI Report` | Runs `python3 tools/quality/scripts/codescene_delta.py`; skipped for Dependabot or when CodeScene configuration is incomplete. |

GitHub's UI displays these jobs as `quality-platforms / <job>`. Branch
protection must require the job context names in the table, because those are
the contexts reported by the Checks API and accepted by the merge gate.

Documentation-only governance changes use the local owner-named proof route
from `AGENTS.md`. Removed documentation gates are not required local or CI
entrypoints.

CI jobs run in fresh GitHub-hosted checkouts, so they do not need repo-local
same-worktree isolation cleanup. The concurrency concern in CI is stale runs on
the same ref, not mutable Gradle state inside one filesystem tree. The
workflow therefore uses workflow concurrency and `merge_group` coverage instead
of cleanup steps for synthetic isolated run roots.

The required measurement scripts run from the PR base ref as defined by
[ADR 0003](docs/project/decisions/0003-honest-instruments-base-gates.md:1).
`behavior-gate` restores only the selector script before harness selection; the
selected harnesses still execute the PR checkout.

### SonarCloud

Repository secret:

- `SONAR_TOKEN`

Repository variables:

- `SONAR_ORGANIZATION`
- `SONAR_PROJECT_KEY`

The job performs a configuration preflight before checkout and Gradle setup. If
`SONAR_TOKEN`, `SONAR_ORGANIZATION`, or `SONAR_PROJECT_KEY` is absent, the
informational report is skipped with a green GitHub job and an explicit log
message instead of running Gradle with empty Sonar properties.

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

The job performs a configuration preflight before checkout. If
`CODESCENE_API_TOKEN` is absent, or neither `CODESCENE_DELTA_ENDPOINT` nor the
`CODESCENE_BASE_URL` plus `CODESCENE_PROJECT_ID` pair is present, the
informational report is skipped with a green GitHub job and an explicit log
message instead of invoking the service helper with empty configuration.

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
- Require `production-handoff`.
- Require `warden-freeze`.
- Require `behavior-gate`.
- Require `judge-review`.
- Keep `ckjm-report`, `sonarcloud`, and `codescene` visible; do not treat them
  as merge blockers unless a later ADR promotes them.

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
  `production-handoff`, `warden-freeze`, `behavior-gate`, and `judge-review`

Readback status uses this vocabulary:

- `Qualified`: the API readback succeeded and shows `main` requires exactly the
  intended blocking checks through classic branch protection, active rulesets,
  or both. A classic branch-protection `404` is acceptable only when the
  paginated active-rules and branch-rulesets readback proves the intended
  required checks through active rulesets.
- `Not Qualified`: readback was not run, authentication failed, required rules
  pagination was not exhausted, all applicable required-check endpoints were
  unavailable, or the required-check set differs.
- `Stricter Drift`: live GitHub also requires a report-only check. Do not
  claim conformity unless this document intentionally makes that check a merge
  blocker.

### Owner Setup Path

In GitHub, open Settings -> Rules -> Rulesets or Branches -> Branch protection
rules for `main`. Require pull requests, disable force pushes and deletion,
and require exactly the four required job contexts above. If the UI shows
`quality-platforms / <job>`, verify through the API readback that the stored
contexts are the job names. Then run
`tools/quality/scripts/branch_protection_readback.py`; only a `Qualified`
result proves the live setting.

Do not claim "CI blocks merge" or "branch protection is configured" from this
document alone. Without a fresh API readback, state only that SaltMarcher
intends the listed GitHub checks to be required.

### Dependabot Judge Secrets

Dependabot pull requests run with GitHub's Dependabot secret source, not the
normal Actions secret source. Because `judge-review` is a required gate for
R1+ and R3c work, GitHub Actions dependency PRs need a Dependabot-scoped
`ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` with the same resource-policy
approval as the normal repository secret. Without that account setup,
`judge-review` must fail closed with `missing ANTHROPIC_API_KEY or
CLAUDE_CODE_OAUTH_TOKEN`.

Do not weaken `judge-review`, move the workflow to `pull_request_target`, or
mark Dependabot R3c PRs as mergeable to work around absent Dependabot secrets.
Record the affected PR as blocked on owner/account setup or use an owner-set
`judge-override` only under the owner-only override rule.

## Review Governance

The quality platforms do not replace review judgment.

- completed repo-tracked change passes follow the SaltMarcher adversarial
  review route through the repo-owned adversarial review skills
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

- [Quality Platforms Standard](docs/project/verification/quality-platforms.md:1)
- [.github/workflows/quality-platforms.yml](.github/workflows/quality-platforms.yml:1)
- [Required Checks ADR](docs/project/decisions/0002-required-checks.md:1)
- [GitHub Protected Branches REST Reference](references/quality-platforms/github-rest-branch-protection.md:1)
- [GitHub Repository Rules REST Reference](references/quality-platforms/github-rest-repository-rules.md:1)
- [Code Quality Lens](tools/quality/skills/lens-code-quality/SKILL.md:1)
