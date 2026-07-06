Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-06
Source of Truth: Invocation contract for external continuous autonomous SaltMarcher operation.

# Continuous Autonomous Operation

## Scope

The repository owns the reproducible local runner script, task prompt, and
user-systemd unit under `tools/local/`. A runner instance may operate
continuously only through branches and pull requests after reading `AGENTS.md`
and this file. It must never push directly to `main` or merge its own pull
requests.

## Selection Order

1. P0/P1 regressions from owner issues.
2. `owner-feedback` issues by priority label.
3. Rejected acceptance fixes or reverts.
4. Harness gaps from `docs/project/verification/harness-gaps.md`.
5. `PROJECT_HEALTH_DEBT` entries with evidence.
6. The next governed migration slice.
7. Self-directed reversible improvements with a concrete Problem, Evidence,
   and Expected benefit.

If no listed work is immediately available, the runner performs a bounded
scout for architecture, pipeline, performance, cleanup, debt/register,
TODO/FIXME, legacy-marker, CI, and telemetry signals. The scout must produce a
small reversible improvement PR or an inventory/diagnosis PR with concrete
evidence and a next repair or polish target.

## Cost-Only Stop

The runner keeps working unless the configured provider, account, or local
machine makes work technically unavailable. Merge, R1, migration, red-check,
P0/P1, owner-feedback, dirty-checkout, and updater-window states are work
inputs, not stop conditions.

- P0/P1 regression work interrupts lower-priority work and becomes the next
  repair target.
- Rolling merge, R1, migration, and judge counts are telemetry and
  backpressure signals only. They may reduce slice size or increase the pause
  between sessions, but they must not prohibit new R0/R1/R2/R3a/R3b/R3c work.
- Red or unclear required checks must never be merged. They become the next
  repair target on the same PR or a narrow repair PR.
- R2 work may land as a provisional recommendation with a German release note
  and acceptance checklist. Owner acceptance gates stable promotion, not the
  autonomous PR.
- R3a work may proceed after a restore-tested backup and copy dry run are
  proven in the PR.
- R3b work may proceed when it fits `docs/project/policies/resource-policy.md`.
  Outside-policy work creates a policy/no-action PR instead of waiting in chat.

Every autonomous improvement PR states Problem, Evidence, and Expected benefit
in one line each. Every autonomous run emits the configured telemetry and final
status report for the external runner.

The continuous-operation contract has no normal "nothing to do" result. A run
either advances an existing green PR, repairs a red or unclear PR, opens a
small scout/repair/polish PR, records a completed queue item as `queue_done`,
or backs off for a real provider, account, cost, or local technical
unavailability. Prefer reversible, evidence-backed repair or improvement work
over asking the owner for technical direction when no higher-priority work is
pending.

## Updater Exclusivity

Treat `saltmarcher-update.service`, `tools/local/saltmarcher-update.sh`, and
stable-promotion updater verification as exclusive local checkout windows. Do
not start git-mutating work, Gradle proof, PR creation, or merge-watch activity
in the same checkout while one of those paths is active. Wait for the window to
close and continue automatically; do not treat it as an owner blocker.

## Budget

Do not skip or bypass `judge-review` for R1+ work. If the configured
provider/account limit or API availability blocks judge execution, back off and
retry later without bypassing the gate.

## Migration Slice Rule

A legacy area may move to `src/features/**` only after its behavior is covered
by a harness. The harness must pass unchanged before and after the move. One
slice covers one feature area and stays near 400 changed lines or less.

Migration order: hexmap, catalog, sessionplanner, worldplanner,
dungeontravel/travel, encounter statetab, party, creatures, encountertable.
