# Session Generation Requirements

## Goal And Scope

Given normalized party levels and character-ledger references, an
adventure-day fraction, optional encounter count, and seed, Session Generation
MUST produce one structured
result containing encounter intents, rewards, packing, warnings, and audits.
After the result is saved and reopened, its structured meaning MUST be
equivalent to the result first presented for the same generation.

The Utility implementation owns `encounter-v5` encounter generation and
`reward-v3` reward generation as one internal orchestration capability. It is
not a general Renderer operation. Historical `reward-v2` persisted runs remain
readable, while commands and new runs require `reward-v3`.
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
seed. It also pins every participating character's current XP, projected XP,
ledger revision, effective non-magic value, and magic counts. Dead members are
preserved as source provenance but do not contribute XP. Its immutable result
contains at most one normal Encounter-channel treasure and
no encounter intents, quest reward, environment reward, or overstock. It uses
the independent reward-engine version and the same current XP policy as combat
resolution. A party with no positive gold or magic deficit produces a
successful empty reward rather than a placeholder item.

## User-Observable Result

Through Session Planner, a successful generation contributes:

- ordered encounter targets and typed role/CR composition intents
- generated reward channels and encounter anchors
- concrete generated item lines with a canonical item reference, quantity, and
  packing; the immutable run-owned definition carries value, magic, rarity,
  curse, and component facts
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

Exact candidate stability is not a compatibility promise; the immutable saved
result and its catalog/config provenance are the replay authority. Reward
budgeting is cumulative. For every participating character, Utility adds
projected per-character reward XP to current XP, interpolates the editable gold
progression through the level-20 cap, and integrates the editable rarity rates
across crossed XP bands. It subtracts effective cumulative ledger grants,
clamps every deficit at zero, and generates only the missing gold and rarity
counts. Received, sold, and given-away grants all count; a superseded row does
not count while its linked correction does. Ledger entries reference the
owning Treasure item, so value, magic, and rarity are not copied into a second
reward model.

Invalid input produces no result. Catalog, generation, and saving failures are
distinguishable and expose no partial result. Issues, warnings, and audits use
stable codes plus structured parameters; localized prose is renderer-owned.

## Adopted Rule-Parity Profile

The target retains the executed rule groups in sections 3 through 15 of the
preserved owner-provided reference as the `saltmarcher-v1` behavior profile.
This is stage and invariant parity, not exact random-candidate parity.

The engine MUST preserve:

- request normalization, session XP, gold pools, magic targets, treasure count,
  and non-magic slot calculation
- exact-sum encounter target allocation, role bands, patterns, effective
  monster count, ranking, seeded choice, difficulty labels, and bossiness
- normal and overstock budgets, channel caps, theme and magic distribution,
  descending slots, dynamic line budgets, loot roles, candidate tolerances,
  bulk behavior, coins, adorned/useful/flavor items, magic, enspelling, curses,
  and packing
- positive modulo, explicit ordering, typed
  fallbacks, hard audits, and budget tolerances

SaltMarcher owns catalog content. The engine may use simplified entropy and
different active catalog rows. Exact selected candidates, items, containers,
monetary totals, formatted text, spreadsheet row identities, and per-cell seed
multipliers are outside compatibility.

Session Generation retains its exact-sum target allocator and passes each
allocated XP target to the shared composition selector. It returns abstract
statblock requirements rather than concrete creature identities, and the
encounter statblock count equals the sum of positive per-block slots. Preset
ownership, Config V5, enumeration, hard constraints, ranking, diagnostics, and
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
- the semantic origin includes the effective Config-V4 Loot rules and ledger
  snapshot; a changed ledger creates a new calculation
- reward details remain available as structured fields rather than only as
  formatted text

## Acceptance Criteria

- every successful result is recoverable from its saved immutable run, catalog
  content hash, and effective generator-config hash
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
