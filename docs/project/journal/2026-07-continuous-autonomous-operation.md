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
