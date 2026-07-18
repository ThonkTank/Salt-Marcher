Status: Active Target
Owner: SaltMarcher Team
Last Reviewed: 2026-07-18
Source of Truth: User-facing behavior and acceptance criteria for the
encounter feature.

# Encounter Feature Spec

## Goal

Provide a runtime encounter builder that:

- uses the active party as the balancing baseline
- generates several encounter alternatives for one requested or automatically
  resolved difficulty band
- explains why an alternative fits the target
- lets catalog creature rows build a manual encounter roster
- saves and opens created encounter rosters as persistent encounter plans
- can use selected encounter tables as curated generator sources
- resolves one ordered group of Session Generation intents into concrete
  creature rosters and makes the complete group available as saved plans

## Non-Goals

- saving initiative, combat HP, defeated state, XP-result state, or loot-result
  state as part of an encounter plan
- room-aware dungeon population
- owning Session Generation runs, generated rewards, or Session Planner scenes

## Primary User Flow

1. The user opens the encounter state tab when the active left-bar tab is not
   claiming the state pane.
2. The state tab reads the active party and current creature filter options.
3. The user selects Auto or an explicit difficulty and optional type, subtype,
   biome filters, tuning controls, or encounter tables.
4. The user generates encounter alternatives or manually adds catalog
   creatures.
5. The user switches among generated alternatives with previous/next controls.
6. The user saves the current roster as an encounter plan, or opens a saved
   plan into the builder.
7. The user starts initiative and combat from the current builder roster.

Generated preparation is a separate Session Planner-driven flow:

1. Session Planner requests a complete ordered group of generated encounters.
2. Encounter resolves every requested encounter into a concrete roster while
   preserving request order.
3. Success makes the complete group available as saved plans; failure leaves
   the previously visible saved-plan set unchanged.

## Expected Capabilities

- show active-party thresholds for easy, medium, hard, and deadly encounters
- show daily-budget context from the party feature
- generate multiple ranked alternatives instead of one opaque result
- support multi-select creature filters with visible active-filter chips
- support generator tuning for creature amount, XP-spread balance, and
  statblock diversity
- support Auto difficulty and Auto tuning for amount, XP-spread balance, and
  statblock diversity, with the resolved choices visible in diagnostics
- return compact generation diagnostics with resolved difficulty, resolved
  tuning, solution quality, search stop category, candidate-pool size,
  attempt count, and candidate-evaluation count
- return best fallback encounter options with an advisory when no exact target
  difficulty can be generated from the available candidates
- support encounter-table selection as an alternate generator source
- support World Planner faction and location source IDs as generator
  constraints, including table-source intersection and finite stock caps
- show a non-blocking `Loot-Konflikt` warning when selected encounter tables
  reference multiple linked loot-table IDs
- expose creature composition, role hints, and generator highlights
- allow catalog creature rows to be added directly to the current encounter
  roster as runtime derived state
- save the current roster as a persistent encounter plan
- list saved encounter plans from the encounter title row
- open a saved encounter plan into Creation mode and clear initiative, combat,
  result, and generated-alternative runtime state
- return concrete creature identities, quantities, display names, total count,
  adjusted XP, and difficulty in every prepared roster summary
- list and open generated rosters through the same saved-plan interaction as
  manually saved rosters

## Acceptance Criteria

- saved encounter plans reopen with the same creature identities, quantities,
  display names, and generated label while showing current creature detail
- generated alternatives remain derived runtime output until explicitly saved
- a party with no active members yields a clear empty-state message
- generator output includes adjusted XP and a difficulty-band label
- Auto generation exposes the resolved difficulty and tuning through result
  diagnostics without changing the generated encounter roster ownership model
- a non-empty candidate pool that cannot produce a composition yields
  `NO_SOLUTION`; an empty candidate pool remains `NO_CREATURES`
- previous and next actions switch generated alternatives in place
- selecting encounter tables limits generated candidates to those tables and
  ignores type, subtype, and biome filters for that generation run
- selecting World Planner factions or a World Planner location constrains
  generation to the source tables available through those sources and prevents
  generated statblock counts from exceeding finite faction stock caps
- opening a saved plan replaces the builder roster and returns the state tab to
  Creation mode
- generated preparation publishes every concrete roster in request order or
  publishes none of them
- invalid, unresolvable, or failed generated preparation leaves the previously
  visible saved-plan set unchanged
- retrying an identical completed preparation creates no visible duplicate
  plans

## References

- [Encounter Runtime State UI](requirements-encounter-state-tab.md) (line 1)
- [Encounter Domain Model](../domain/domain-encounter.md) (line 1)
- [Encounter Persistence Contract](../contract/contract-encounter-persistence.md) (line 1)
- [Encounter Table Feature Spec](../../encountertable/requirements/requirements-encountertable.md) (line 1)
- [Generated Preparation Contract](../contract/contract-encounter-generated-import.md)
- [Architecture](../architecture/architecture-encounter.md)
