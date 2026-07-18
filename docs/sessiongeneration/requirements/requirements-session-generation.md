Status: Active Target
Owner: Session Generation Feature
Last Reviewed: 2026-07-18
Source of Truth: Observable generation results, rule parity, and acceptance.

# Session Generation Requirements

## Goal And Scope

Given normalized party levels, an adventure-day fraction, optional encounter
count, and seed, Session Generation MUST produce one deterministic structured
result containing encounter intents, rewards, packing, warnings, and audits.
After the result is saved and reopened, its structured meaning MUST be
equivalent to the result first presented for the same generation.

Session Planner is the primary consumer. Encounter converts generated encounter
intents into concrete rosters. Session Generation does not own UI, authored
sessions, Party members, creature facts, or saved Encounter plans.

## User-Observable Result

Through Session Planner, a successful generation contributes:

- ordered encounter targets and typed role/CR composition intents
- generated reward channels and encounter anchors
- concrete generated item lines with quantity, value, magic, curse, and packing
  facts when applicable
- display summaries, warnings, and audit outcome
- stable run and treasure identities used by the prepared session

Generated loot is structured result data. Formatted text is an optional derived
rendering and MUST NOT be the only reward output. Engine and catalog versions
are audit metadata, not user-selectable ruleset controls.

## Inputs And Validation

Party levels are unique and from 1 through 20. Counts are non-negative and sum
to a positive party size. The adventure-day fraction is an exact non-negative
decimal. An explicit encounter count is from 1 through 10; omission activates
deterministic automatic calculation. The seed is explicit.

Invalid input produces no result. Catalog, generation, and saving failures are
distinguishable and expose no partial result.

## Adopted Rule-Parity Profile

The target retains the executed rule groups in sections 3 through 15 of the
preserved owner-provided reference as the `saltmarcher-v1` behavior profile.
This is stage and invariant parity, not spreadsheet-row or exact-item parity.

The engine MUST preserve:

- request normalization, session XP, gold pools, magic targets, treasure count,
  and non-magic slot calculation
- exact-sum encounter target allocation, role bands, patterns, effective
  monster count, ranking, seeded choice, difficulty labels, and bossiness
- normal and overstock budgets, channel caps, theme and magic distribution,
  descending slots, dynamic line budgets, loot roles, candidate tolerances,
  bulk behavior, coins, adorned/useful/flavor items, magic, enspelling, curses,
  packing, and formatting
- positive modulo, explicit stable ordering, deterministic selection, typed
  fallbacks, hard audits, and budget tolerances

SaltMarcher owns catalog content. The engine may use stable keyed entropy and
different active catalog rows. Exact selected candidates, items, containers,
monetary totals, formatted text, spreadsheet row identities, and per-cell seed
multipliers are outside compatibility.

## Golden Acceptance Boundary

For two level-3 players, two level-4 players, adventure-day fraction `0.6`,
explicit encounter count `3`, and seed `179974`, the required Golden output is:

```text
encounterTargets = [680, 1000, 1800]
```

No exact encounter candidate, creature roster, loot item, packing choice, or
formatted-text snapshot is Golden compatibility.

## Result Completeness And Stability

- generation completes asynchronously without blocking the visible planner
- success exposes one complete structured result; consumers never observe an
  intermediate encounter-only or reward-only result
- failed hard audits prevent success; non-blocking fallbacks remain visible as
  typed warnings
- saved and reopened results retain the same encounters, rewards, packing,
  warnings, audits, seed, and recorded engine/catalog meaning
- repeating an already completed request does not create visible duplicates
- reward details remain available as structured fields rather than only as
  formatted text

## Acceptance Criteria

- equal normalized input, engine version, and catalog content hash produce
  equal structured results
- encounter targets sum exactly to session XP
- every applicable result retains seed, versions, content hash, structured
  encounters, rewards, packing, warnings, and audits
- concrete item lines survive save and reopen as typed fields with equivalent
  meaning
- failed generation or saving exposes no partial generated result
- the Golden input produces exactly `[680, 1000, 1800]`

## Sources

- Readable owner-provided reference:
  `/home/aaron/Schreibtisch/projects/references/saltmarcher/session-generation/encounter-loot-generation-design.md`
- Preserved original:
  `/home/aaron/Schreibtisch/projects/references/.tools/markdown/saltmarcher-encounter-loot-generation-design-2026-07-16.md`
- Original locator: `local-owner-provided document`, snapshot 2026-07-16
- [Session Planner Requirements](../../sessionplanner/requirements/requirements-session-planner.md)
- [Encounter Requirements](../../encounter/requirements/requirements-encounter.md)
