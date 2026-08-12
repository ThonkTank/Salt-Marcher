# Session Generation Requirements

## Goal And Scope

Given normalized party levels, an adventure-day fraction, optional encounter
count, and seed, Session Generation MUST produce one deterministic structured
result containing encounter intents, rewards, packing, warnings, and audits.
After the result is saved and reopened, its structured meaning MUST be
equivalent to the result first presented for the same generation.

The Utility implementation owns complete `saltmarcher-v5` generation as an
internal orchestration capability. It is not a general Renderer operation.
Complete runs are immutable and campaign-local. They include typed loot and
packing and are persisted before presentation. Concrete creature identity
remains an Encounter concern.

Session Planner is the sole full-day UI consumer. Encounter converts generated
encounter intents into concrete rosters. Group management may request a
separate loot-only proposal for one prospective or persisted live-scene group
draft. Session Generation
does not own UI, authored sessions, Party members, creature facts, or saved
Encounter plans.

A group reward request MUST pin the scene revision, prospective or persisted
group identity, nullable group revision, complete normalized living/dead
roster, assigned party revision and level counts, current campaign-rules
revision, configured XP basis, base XP, adjusted XP, effective reward XP, and
seed. Dead members are preserved as source provenance but do not contribute XP.
Its immutable result contains exactly one normal Encounter-channel treasure and
no encounter intents, quest reward, environment reward, or overstock. It uses
the independent reward-engine version and the same current XP policy as combat
resolution.

## User-Observable Result

Through Session Planner, a successful generation contributes:

- ordered encounter targets and typed role/CR composition intents
- generated reward channels and encounter anchors
- concrete generated item lines with quantity, value, magic, curse, and packing
  facts when applicable
- renderer-derived display summaries, typed warnings, and audit outcome
- stable run and treasure identities used by the prepared session

Generated loot is structured result data. Formatted text is an optional derived
rendering and MUST NOT be the only reward output. Engine and catalog versions,
effective generator-preset identity and revision, and the generator-config hash
are audit metadata. A preset is a user-selectable composition policy, not a
catalog-version selector.

## Inputs And Validation

Party levels are unique and from 1 through 20. Counts are non-negative and sum
to a positive party size. The adventure-day fraction is an exact non-negative
decimal. An explicit encounter count is from 1 through 10; omission activates
deterministic automatic calculation. The seed is explicit.

Invalid input produces no result. Catalog, generation, and saving failures are
distinguishable and expose no partial result. Issues, warnings, and audits use
stable codes plus structured parameters; localized prose is renderer-owned.

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
  and packing
- positive modulo, explicit stable ordering, deterministic selection, typed
  fallbacks, hard audits, and budget tolerances

SaltMarcher owns catalog content. The engine may use stable keyed entropy and
different active catalog rows. Exact selected candidates, items, containers,
monetary totals, formatted text, spreadsheet row identities, and per-cell seed
multipliers are outside compatibility.

Session Generation retains its exact-sum target allocator and passes each
allocated XP target to the shared composition selector. It returns abstract
statblock requirements rather than concrete creature identities, and the
encounter statblock count equals the sum of positive per-block slots. Preset
ownership, Config V3, enumeration, hard constraints, ranking, diagnostics, and
Scene parity are defined by the
[Encounter Generation Requirements](../../encounter/requirements/requirements-encounter-generation.md).

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
- repeating the same semantic origin returns the existing run and does not
  create visible duplicates
- reward details remain available as structured fields rather than only as
  formatted text

## Acceptance Criteria

- equal normalized input, engine version, catalog content hash, and effective
  generator-config hash produce equal structured results
- encounter targets sum exactly to session XP
- every applicable result retains seed, versions, content hash, structured
  encounters, rewards, packing, warnings, and audits
- concrete item lines survive save and reopen as typed fields with equivalent
  meaning
- failed generation or saving exposes no partial generated result
- the Golden input produces exactly `[680, 1000, 1800]`

## Sources

- [Encounter Generation Requirements](../../encounter/requirements/requirements-encounter-generation.md)
- [Session Planner Requirements](../../sessionplanner/requirements/requirements-session-planner.md)
- [Encounter Requirements](../../encounter/requirements/requirements-encounter.md)
