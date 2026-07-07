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

The runner runtime also lives under the SaltMarcher checkout:
`.codex/autodev/runner/` owns the working clone, queue, queue archive,
telemetry, logs, reports, lock files, pause sentinels, and daily/monthly run
sentinels. Do not operate the continuous runner from `~/.local/bin`,
`~/.local/share/saltmarcher-autodev`, or
`~/.local/state/saltmarcher/autodev`; those paths must stay absent after
installation.

## Selection Order

1. P0/P1 regressions from owner issues.
2. `owner-feedback` issues by priority label.
3. Rejected acceptance fixes or reverts.
4. `explorer-finding` issues by priority label.
5. Harness gaps from `docs/project/verification/harness-gaps.md`.
6. `PROJECT_HEALTH_DEBT` entries with evidence.
7. The next governed migration slice.
8. Self-directed reversible improvements with a concrete Problem, Evidence,
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
- A red PR with three identical required-check signatures is quarantined, not
  treated as a stop condition. The runner labels it `quarantined:stuck`, turns
  it back into draft, reports
  `Quarantaene: PR #N nach 3 gleichen Fehlversuchen geparkt`, writes one
  journal line, and continues with the next candidate. The PR becomes selectable
  again after seven days or when the failure signature changes; the runner then
  removes the label and marks it ready before retrying.
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

Blocked quality-trend gates are ordinary repair targets on the same PR. They
do not stop the loop; the runner repairs the regression or reclassifies the PR
only when the task label was wrong.

## Work Mix

Merged PRs are classified by changed paths over the rolling 14-day window.
Product roots are `src/`, `test/`, `shell/`, `bootstrap/`, and `resources/`.
A PR with any changed file under a product root is `product`; all other
non-bot PRs are `meta`. Bot-authored PRs, identified by an author login ending
in `[bot]`, are excluded from both numerator and denominator.
Explorer-finding repairs count as product work.

When there are at least 10 non-bot merges and `meta_merge_ratio_14d` is above
35%, meta-only work is inadmissible for selection except P0/P1 regressions,
red-required-check repairs on open PRs, explicitly owner-filed issues, and
RUNNER-DRIFT repairs. Migration slices count as product. Self-directed meta
improvements are inadmissible while over cap; `no_work` becomes a valid result
if only meta candidates remain after the full ladder check.

## Runner Manifest

The runner checks `tools/local/runner-manifest.json` at every session start
against the repo-local runner files, active repo-local systemd unit, and legacy
Home path absence. Drift emits
`RUNNER-DRIFT: N Datei(en) weichen vom Manifest ab`, opens or refreshes one
`runner-drift` issue with path and hashes only, and remains a P1-equivalent
repair target while the loop continues.

Outside enforced Work Mix backpressure, the continuous-operation contract has
no normal "nothing to do" result. A run either advances an existing green PR,
repairs a red or unclear PR, opens a small scout/repair/polish PR, records a
completed queue item as `queue_done`, or backs off for a real provider,
account, cost, or local technical unavailability. Prefer reversible,
evidence-backed repair or improvement work over asking the owner for technical
direction when no higher-priority work is pending.

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
