Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-06
Source of Truth: Invocation contract for external continuous autonomous SaltMarcher operation.

# Continuous Autonomous Operation

## Scope

The repository does not contain an autonomous runner. An external runner may
operate continuously only through branches and pull requests after reading
`AGENTS.md` and this file. It must never push directly to `main` or merge its
own pull requests.

## Selection Order

1. P0/P1 regressions from owner issues.
2. `owner-feedback` issues by priority label.
3. Rejected acceptance fixes or reverts.
4. Harness gaps from `docs/project/verification/harness-gaps.md`.
5. `PROJECT_HEALTH_DEBT` entries with evidence.
6. The next governed migration slice.
7. Self-directed reversible improvements with a concrete Problem, Evidence,
   and Expected benefit.

No qualifying work found is a valid result only after checking the full order
above. Self-directed work may include refactors, debt paydown, test additions,
or documentation improvements under the normal gates.

## Rolling Quotas

Quotas use rolling windows, not calendar nights.

- P0/P1 regression work is quota-exempt and interrupts lower-priority work.
- Maximum 3 autonomous merges per rolling 24-hour window.
- Maximum 1 R1 architecture slice per rolling 24-hour window.
- Maximum 1 migration slice per rolling 7-day window.
- Stop migration work while any P0/P1 owner issue is open.

Every autonomous improvement PR states Problem, Evidence, and Expected benefit
in one line each. Every autonomous run emits the configured telemetry and final
status report for the external runner.

The quota bounds volume. Prefer reversible, evidence-backed improvements over
asking the owner for technical direction when no higher-priority work is
pending.

## Updater Exclusivity

Treat `saltmarcher-update.service`, `tools/local/saltmarcher-update.sh`, and
stable-promotion updater verification as exclusive local checkout windows. Do
not start or continue autonomous git-mutating work, Gradle proof, PR creation,
or merge-watch activity in the same checkout while one of those paths is active.

## Budget

Do not skip or bypass `judge-review` for R1+ work. If the configured
provider/account limit or API availability blocks judge execution, fail closed
and report the blocker.

## Migration Slice Rule

A legacy area may move to `src/features/**` only after its behavior is covered
by a harness. The harness must pass unchanged before and after the move. One
slice covers one feature area and stays near 400 changed lines or less.

Migration order: hexmap, catalog, sessionplanner, worldplanner,
dungeontravel/travel, encounter statetab, party, creatures, encountertable.
