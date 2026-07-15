Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-12
Source of Truth: Trusted-ref execution model for frozen measurement instruments.

# 0003 Honest Instruments Base Gates

## Problem

The required gate jobs checked out PR head and ran their gate scripts from that
same PR. A PR could therefore edit the script that judged the PR: weaken the
warden matcher or accept any judge verdict.

## Alternatives

- Use `pull_request_target` for all gates. Rejected because required checks
  still build and review PR code, and the repository keeps normal
  `pull_request` isolation.
- Keep `pull_request` and restore only measurement scripts from the base ref.
  Chosen because it preserves normal PR isolation while making the instruments
  evaluate a diff with trusted code.

## Decision

`quality-platforms.yml` keeps `pull_request`, `merge_group`, `push`, and the
nightly `schedule`.
For pull-request and merge-queue events, the measuring scripts are restored
from `origin/<base>` before they run:

- `warden-freeze` runs the base `tools/quality/scripts/warden_freeze.py`
  against the PR's file list and proposed freeze configuration.
- `judge-review` runs the base `tools/agents/judge_review.py` against the PR
  title, body, labels, and diff.
The PR's code is never executed under `pull_request_target`.

## Rationale

The owner wants broad autonomy over reversible work and honest measurement for
the few signals that say whether autonomy still works. Running measurement
scripts from the base ref prevents a PR from grading itself while still letting
ordinary PR code be built, tested, reviewed, and reverted.

Behavior harness execution is now owned by the required `check` job and
Gradle's content-addressed inputs, so there is no base-ref selector script to
restore.

R3c is a transparency and routing label, not an owner key turn. During this
implementation the owner explicitly rejected the symbolic key-turn label as
security ceremony and asked to remove it. The honest instrument protection is
base-ref execution plus required checks, not symbolic human approval.

## Risks

This PR's own workflow run still uses the previous base scripts until the PR is
merged. The required proof is therefore follow-up review-test PRs after merge
for warden targeted bypass and judge always-PASS, plus the harness
modernization T4 CI/cache rehearsals.

Claude Code CLI does not expose a temperature flag in the installed help. The
judge now prefers the Anthropic Messages API when `ANTHROPIC_API_KEY` is
present because that path sets `temperature: 0`; OAuth CLI remains accepted
when the subscription route is the available judge credential.

The OAuth route must run through the Claude Code CLI, which is why
`judge_review.py` depends on that binary being installed in CI. Local Claude
Code authentication is OAuth-based, not API-key-based, and the OAuth refresh
endpoint rotates refresh tokens, so CI uses a long-lived `claude setup-token`
token rather than the short-lived session access token. That long-lived token
is **not** accepted as a direct `/v1/messages` bearer token -- dropping the CLI
dependency in favour of a plain HTTP call against the OAuth credential does not
work. `ANTHROPIC_AUTH_TOKEN` is only a temporary secret alias mapped into
`CLAUDE_CODE_OAUTH_TOKEN` until the canonical secret name is available.

## Validation

Local validation must include Python compilation, warden self-test, `check`,
and the roadmap-owned T4 deletion/readback checks. Live validation is the two
red review-test PRs after merge plus the T4 CI/cache readbacks, recorded in
the July journal.

## Rollback

Revert the workflow and gate-script changes, then remove this ADR. Do not leave
the system in that state longer than necessary because PR-head gate execution
restores the self-grading weakness.

## Supersedes

The PR-head execution assumption in ADR 0002 and the quality-platform CI
document.
