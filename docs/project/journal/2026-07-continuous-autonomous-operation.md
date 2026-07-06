Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-06
Source of Truth: L-tier design note for the continuous autonomous operation contract.

# Continuous Autonomous Operation Design Note

## 2026-07-06 continuous-autonomous-operation - Convert night shift to 24/7 contract

Problem: the autonomous operation contract still described nightly quotas even
though the external runner can operate continuously.
Target state: `docs/project/architecture/night-shift.md` remains the selection
source of truth, but its title, scope, quotas, updater exclusion, telemetry,
and reporting language describe 24/7 operation.
Alternatives considered: adding a new contract file was rejected because it
would split work selection truth; editing external runner files was rejected
because the queue limits this slice to repository documentation.
Scope boundary: documentation and instruction routing only; no production
code, CI gates, branch protection, runner state, or migration behavior.
Done when: documentation enforcement passes, the PR carries `risk:R1`, and the
queue sentinel is written only after the PR is merged.

## 2026-07-06 cost-only-stop-autodev - Make repair the default loop action

Problem: the live runner still turned quota, red-check, risk-protocol, and
operator uncertainty into `no_work` or blocker churn even though the desired
operating model is continuous autonomous repair.
Target state: only provider/account cost limits or local technical
unavailability create backoff. Red gates, P0/P1, R2/R3a/R3b protocol needs,
dirty checkouts, updater windows, missing harnesses, and failed reviews become
the next repair or scout target.
Alternatives considered: raising merge/R1 limits was rejected because it only
delays the next artificial stop; keeping owner questions for R2/R3b was
rejected because provisional next/main work and policy/no-action PRs preserve
reversibility without stopping the loop.
Scope boundary: update autonomous-operation docs, AGENTS risk interpretation,
the installed runner prompt, and the installed runner policy; do not weaken
required checks or make red/skipped PRs mergeable.
Done when: docs enforcement passes, runner syntax/dry-run pass, independent
review finds no cost-only-stop blocker, and live service resumes with quotas as
telemetry rather than start bans.
