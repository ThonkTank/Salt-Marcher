Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-05
Source of Truth: Trusted-ref execution model for frozen measurement instruments.

# 0003 Honest Instruments Base Gates

## Problem

The required gate jobs checked out PR head and ran their gate scripts from that
same PR. A PR could therefore edit the script that judged the PR: weaken the
warden matcher, accept any judge verdict, or shrink behavior-harness selection.

## Alternatives

- Use `pull_request_target` for all gates. Rejected for `behavior-gate`
  because that job executes PR code through behavior harnesses.
- Keep `pull_request` and restore only measurement scripts from the base ref.
  Chosen because it preserves normal PR isolation while making the instruments
  evaluate a diff with trusted code.

## Decision

`quality-platforms.yml` keeps `pull_request`, `merge_group`, and `push`.
For pull-request and merge-queue events, the measuring scripts are restored
from `origin/<base>` before they run:

- `warden-freeze` runs the base `tools/quality/scripts/warden_freeze.py`
  against the PR's file list and proposed freeze configuration.
- `judge-review` runs the base `tools/agents/judge_review.py` against the PR
  title, body, labels, and diff.
- `behavior-gate` runs the base
  `tools/quality/scripts/select_harnesses.py` to select harnesses, then runs
  the selected harnesses against the PR checkout.

The PR's code is never executed under `pull_request_target`.

## Rationale

The owner wants broad autonomy over reversible work and honest measurement for
the few signals that say whether autonomy still works. Running measurement
scripts from the base ref prevents a PR from grading itself while still letting
ordinary PR code be built, tested, reviewed, and reverted.

The behavior split is deliberate: selector logic is an instrument, but behavior
harness execution must exercise the proposed PR code.

R3c is a transparency and routing label, not an owner key turn. During this
implementation the owner explicitly rejected the symbolic key-turn label as
security ceremony and asked to remove it. The honest instrument protection is
base-ref execution plus required checks, not symbolic human approval.

## Risks

This PR's own workflow run still uses the previous base scripts until the PR is
merged. The required proof is therefore follow-up review-test PRs after merge:
warden targeted bypass, judge always-PASS, and harness-map shrink must go red.

Claude Code CLI does not expose a temperature flag in the installed help. The
judge now prefers the Anthropic Messages API when `ANTHROPIC_API_KEY` is
present because that path sets `temperature: 0`; OAuth CLI remains accepted
when the subscription route is the available judge credential.

## Validation

Local validation must include Python compilation, warden self-test,
`checkHarnessMapConsistency`, documentation enforcement, and
`production-handoff`. Live validation is the three red review-test PRs after
merge, recorded in the July journal.

## Rollback

Revert the workflow and gate-script changes, then remove this ADR. Do not leave
the system in that state longer than necessary because PR-head gate execution
restores the self-grading weakness.

## Supersedes

The PR-head execution assumption in ADR 0002 and the quality-platform CI
document.
