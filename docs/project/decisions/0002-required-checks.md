Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-05
Source of Truth: Required GitHub check contexts for autonomous SaltMarcher merge protection.

# 0002 Required Checks

## Problem

The previous required-check policy treated third-party analysis jobs as merge
blockers and did not require behavior harness selection or gate-surface
protection. That is brittle for autonomous delivery.

## Alternatives

- Keep SonarCloud and CodeScene required. Rejected because external-service
  uptime would block autonomous merges.
- Require only production-handoff. Rejected because behavior harnesses and
  gate weakening would remain outside required CI.
- Require deterministic gates plus judge review.

## Decision

The required GitHub check contexts for `main` are:

- `quality-platforms / production-handoff`
- `quality-platforms / warden-freeze`
- `quality-platforms / behavior-gate`
- `quality-platforms / judge-review`

`sonarcloud`, `codescene`, and `ckjm-report` remain informational jobs.

## Rationale

The required set must be deterministic enough for day-to-day autonomy and
strong enough to prevent behavior regressions, gate erosion, and self-review.
Third-party analysis remains useful evidence but not a required gate.

## Risks

Branch protection is repository configuration. The decision is qualified only
after `tools/quality/scripts/branch_protection_readback.py` observes the live
required checks.

## Validation

Run the readback script and require `Qualified`. PRs touching frozen surfaces
must be blocked by `warden-freeze` without `gate-change-approved`.

## Rollback

Restore the previous required-check list in branch protection and revert this
ADR and workflow changes.

## Supersedes

The required-check list in the 2026-05-19 branch-protection document.
