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

## Boundary Rules

- the contract is workflow-oriented, not a mirror of the internal encounter
  session carrier
- late update results must not overwrite a newer published revision
- a pool-filter update MUST preserve tuning and a tuning update MUST preserve
  pool filters
- all visible pool filters constrain candidate loading; selected Encounter
  tables are intersected with the filtered creature pool
- choices within one source dimension form a union; explicitly selected table,
  faction, and location dimensions intersect by creature ID
- a location contributes direct tables and the primary tables of linked
  factions; direct location-table membership is unlimited while faction
  inventory may cap quantities
- finite caps intersect by taking the smallest cap; any unlimited contribution
  makes a unioned dimension unlimited
- no effective table activates a visible catalog fallback, while an effective
  but empty/filtered/capped pool returns no solution
- summed weights rank unioned choices; intersections retain the lowest weight,
  and deterministic seed selection uses weights only between otherwise
  comparable balancing options
- it does not expose saved plans, roster cards, initiative rows, combat
  runtime, or result state
- it does not expose foreign creature, party, or encounter-table internals
- Auto difficulty and Auto tuning stay public request language only

## References

- [Encounter Domain Model](../domain/domain-encounter.md) (line 1)
- [Encounter UI](../requirements/requirements-encounter-state-tab.md) (line 1)
