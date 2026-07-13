Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-12
Source of Truth: Required GitHub check contexts for autonomous SaltMarcher merge protection.

# 0002 Required Checks

## Problem

The previous required-check policy treated third-party analysis jobs as merge
blockers, then split behavior proof between `production-handoff` and a
bespoke `behavior-gate` selector. After the harness modernization converted
behavior harnesses to cacheable JUnit `Test` tasks, that split would keep two
selection systems alive.

## Alternatives

- Keep SonarCloud and CodeScene required. Rejected because external-service
  uptime would block autonomous merges.
- Keep `production-handoff` plus `behavior-gate`. Rejected because
  `behavior-gate` depends on the deleted harness map and duplicates Gradle's
  content-addressed task model.
- Require only `production-handoff`. Rejected because CI must now prove the
  actual `check` graph that owns the converted harness tasks.
- Require deterministic gates plus judge review.

## Decision

The required GitHub check contexts for `main` are the job context names reported
by the Checks API:

- `check`
- `warden-freeze`
- `judge-review`

GitHub's UI displays these as `quality-platforms / <job>`. Branch protection
must use the job context names above; requiring the UI labels leaves required
checks in an `expected` state and blocks merge even when the Actions jobs
passed.

`sonarcloud`, `codescene`, and `ckjm-report` remain informational jobs.

Trusted-ref execution for `warden-freeze` and `judge-review` is owned by
[ADR 0003](docs/project/decisions/0003-honest-instruments-base-gates.md:1).

## Workflow Permission Budget

Workflow permissions stay least-privilege for their behavior:

- `quality-platforms.yml`: `contents: read`, `pull-requests: read`.
- `promote-stable.yml`: `contents: write`, `issues: write`,
  `pull-requests: read`, `actions: read`; required to create stable tags or
  releases, update the status issue, inspect PR metadata, and read workflow
  state.
- `owner-acceptance.yml`: `contents: read`, `issues: write`,
  `pull-requests: write`; required to apply acceptance labels and create
  follow-up issues for rejected acceptance.

Any future permission widening is a frozen gate-surface change and must be
handled as `risk:R3c`.

## Rationale

The required set must be deterministic enough for day-to-day autonomy and
strong enough to prevent behavior regressions, gate erosion, and self-review.
`check` is the authoritative CI behavior proof: Gradle's declared inputs
select what physically re-runs, and GitHub Actions owns the cache writes that
can later be read by local machines as feedback. CI deliberately overrides
incremental selection for build, CI, hook, and gate-wiring changes by running
`check --rerun-tasks`; ordinary source-area PRs remain content-addressed.
Third-party analysis remains useful evidence but not a required gate.

## Risks

Branch protection is repository configuration. The decision is qualified only
after `tools/quality/scripts/branch_protection_readback.py` observes the live
required checks.

## Validation

Run the readback script and require `Qualified`. PRs touching frozen surfaces
must carry `risk:R3c`, and `warden-freeze` enforces that classification.

## Rollback

Restore the previous required-check list in branch protection and revert this
ADR and workflow changes.

## Supersedes

The required-check list in the 2026-05-19 branch-protection document.
