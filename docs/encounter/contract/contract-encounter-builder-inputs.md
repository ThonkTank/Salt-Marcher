# Encounter Builder Inputs Contract

## Purpose

This contract defines the builder-input surface shared by Catalog-owned pool
filters and Encounter-owned generation tuning.

## Read Surface

- `EncounterApi` publishes immutable, revisioned builder input state
- `EncounterBuilderInputs` publishes `EncounterPoolFilters` and
  `EncounterTuningSettings` as separate immutable values
- pool filters include name, challenge-rating range, size, type, subtype,
  biome, alignment, encounter tables, World Planner factions, and location

## Write Surface

- Catalog submits `UpdateEncounterPoolFiltersCommand`
- Encounter state submits `UpdateEncounterTuningCommand`
- the application merges either partial update with the current focused
  runtime context before persistence and publication
- `UpdateEncounterBuilderInputsCommand` is the application-internal atomic
  replacement primitive used to persist one already merged complete snapshot;
  workflow consumers submit the partial commands above

Current production persists the visible Catalog name, HG, size, type, subtype,
environment, and alignment pool filters separately from Encounter difficulty,
amount, XP-distribution, statblock-diversity, seed, and alternative-count
tuning. Non-empty Encounter-table, faction, or location source selections are
validated but generation rejects them visibly until the native grouped-source
composition is delivered.

## Boundary Rules

- the contract is workflow-oriented, not a mirror of the internal encounter
  session carrier
- late update results must not overwrite a newer published revision
- a pool-filter update MUST preserve tuning and a tuning update MUST preserve
  pool filters
- all visible pool filters constrain candidate loading; selected Encounter
  tables are intersected with the filtered creature pool
- it does not expose saved plans, roster cards, initiative rows, combat
  runtime, or result state
- it does not expose foreign creature, party, or encounter-table internals
- Auto difficulty and Auto tuning stay public request language only

## References

- [Encounter Domain Model](../domain/domain-encounter.md) (line 1)
- [Encounter UI](../requirements/requirements-encounter-state-tab.md) (line 1)
