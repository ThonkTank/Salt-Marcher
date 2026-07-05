Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-05
Source of Truth: Invocation contract for external autonomous SaltMarcher work selection.

# Night Shift

## Scope

The repository does not contain an autonomous runner. An external runner may
operate only through branches and pull requests after reading `AGENTS.md` and
this file. It must never push directly to `main`.

## Selection Order

1. P0/P1 regressions from owner issues.
2. `owner-feedback` issues by priority label.
3. Rejected acceptance fixes or reverts.
4. Harness gaps from `docs/project/verification/harness-gaps.md`.
5. `PROJECT_HEALTH_DEBT` entries with evidence.
6. The next governed migration slice.

No qualifying work found is a valid result: update the status issue and stop.

## Quotas

- Maximum 3 merges per night.
- Maximum 1 R1 architecture slice per night.
- Maximum 1 migration slice per week.
- Stop migration work while any P0/P1 owner issue is open.

Every autonomous improvement PR states Problem, Evidence, and Expected benefit
in one line each.

## Budget

Respect `JUDGE_MAX_CALLS_PER_DAY`. If the budget is exceeded, defer R1+ work
to the next night instead of skipping `judge-review`.

## Migration Slice Rule

A legacy area may move to `src/features/**` only after its behavior is covered
by a harness. The harness must pass unchanged before and after the move. One
slice covers one feature area and stays near 400 changed lines or less.

Migration order: hexmap, catalog, sessionplanner, worldplanner,
dungeontravel/travel, encounter statetab, party, creatures, encountertable.
