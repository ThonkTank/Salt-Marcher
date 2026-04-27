Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-26
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

## Non-Goals

- saving initiative, combat HP, defeated state, XP-result state, or loot-result
  state as part of an encounter plan
- room-aware dungeon population
- feature-specific bootstrap wiring

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

## Expected Capabilities

- show active-party thresholds for easy, medium, hard, and deadly encounters
- show daily-budget context from the party feature
- generate multiple ranked alternatives instead of one opaque result
- expose a runtime budget load path so the state UI can show thresholds before
  generation
- support multi-select creature filters with visible active-filter chips
- support generator tuning for creature amount, XP-spread balance, and
  statblock diversity
- support Auto difficulty and Auto tuning for amount, XP-spread balance, and
  statblock diversity; Auto values are sent as sentinel request values and are
  resolved by the generator for each generation pass
- return compact generation diagnostics with resolved difficulty, resolved
  tuning, solution quality, search stop category, candidate-pool size,
  attempt count, and candidate-evaluation count
- return best fallback encounter options with an advisory when no exact target
  difficulty can be generated from the available candidates
- support encounter-table selection as an alternate generator source
- show a non-blocking `Loot-Konflikt` warning when selected encounter tables
  reference multiple linked loot-table IDs
- expose creature composition, role hints, and generator highlights
- allow catalog creature rows to be added directly to the current encounter
  roster as runtime derived state
- save the current roster as a persistent encounter plan
- list saved encounter plans from the encounter title row
- open a saved encounter plan into Creation mode and clear initiative, combat,
  result, and generated-alternative runtime state

## Acceptance Criteria

- the encounter feature depends only on public party, creature, and
  encounter-table APIs for generation
- saved encounter plans persist only creature identity, quantity, display name,
  and generated label; creature statblocks remain creature-owned
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
- opening a saved plan replaces the builder roster and returns the state tab to
  Creation mode

## References

- [Encounter Runtime State UI](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/encounter/requirements/requirements-encounter-state-tab.md:1)
- [Encounter Domain Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/encounter/domain/domain-encounter.md:1)
- [Encounter Persistence Contract](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/encounter/contract/contract-encounter-persistence.md:1)
- [Encounter Table Feature Spec](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/encountertable/requirements/requirements-encountertable.md:1)
