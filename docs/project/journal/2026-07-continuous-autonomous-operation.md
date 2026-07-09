Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-06
Source of Truth: L-tier design note for the continuous autonomous operation contract.
Entry Document: [July 2026 Journal](2026-07.md)

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

## 2026-07-07 retire-no-work-dauerbetrieb - Make idle states become work

Problem: the continuous runner still allowed `no_work` as a normal result,
which could turn an empty immediate queue into sleep instead of polish,
refactor, repair, or inventory work.
Target state: normal sessions must choose existing green PRs, red/unclear PR
repair, bounded scout work, or a small inventory/diagnosis PR; already-finished
queue items use `queue_done`, dry runs use `dry_run_ok`, and cost/provider
limits remain the only real backoff.
Alternatives: keep `no_work` as a rare valid result, or only strengthen wording.
Both leave the same sleep-shaped escape hatch in telemetry and wrapper logic.
Scope boundary: change only the Dauerbetrieb contract, repo-owned runner
artifacts, installed runner prompt/wrapper, and this journal note; do not
change session pause defaults or cost-only-stop rules.
Instruction volume payment: `night-shift.md` replaces the old `no_work` escape
paragraph and selection fallback, while the prompt replaces the matching rules
instead of adding another layer of exceptions.
Done when: documentation enforcement passes, the runner syntax and dry-run
contract pass, old `no_work` results normalize to a repair target, and
independent review finds no remaining normal `no_work` path.

## 2026-07-09 retire-autodev-main - Remove active autonomous runner surfaces

Problem: `main` still exposed an installable autonomous runner, active
work-selection contract, process-optimizer skill, and retained runner evidence
after the owner asked to retire Autodev rather than continue evolving it.
Target state: no active in-repo Autodev runner, prompt, service unit, skill,
metrics script, work-selection contract, or canonical project-doc index entry
remains. Local tooling is limited to updater/status commands, and historical
journal entries remain history rather than active instructions.
Alternatives: keep deprecated tombstones for the old runner, or merge the old
`codex/retire-no-work` branch. Both would keep active-looking Autodev surfaces
or reintroduce runner expansion work before deleting it.
Scope boundary: remove active Autodev surfaces and references only, including
the active autonomy-boundary wording that still implied a Dauerbetrieb loop; do
not delete journal history or unrelated updater tooling.
Done when: active Autodev references outside journal history are absent,
documentation enforcement passes, and the production handoff route is green.
