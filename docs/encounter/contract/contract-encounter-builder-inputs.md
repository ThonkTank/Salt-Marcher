# Encounter Builder Inputs Contract

Status: Active Godot contract
Owner: Encounter
Last Reviewed: 2026-07-28
Source of Truth: This document

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
environment, alignment, Encounter Table, faction, and location pool filters
separately from Encounter difficulty, amount, XP-distribution,
statblock-diversity, seed, and alternative-count tuning. Catalog taxonomy
updates preserve source selections, source updates preserve taxonomy, and
Encounter tuning updates preserve the complete pool-filter value.

## Boundary Rules

- the contract is workflow-oriented, not a mirror of the internal encounter
  session carrier
- late update results must not overwrite a newer published revision
- a pool-filter update MUST preserve tuning and a tuning update MUST preserve
  pool filters
- name, challenge rating, size, and alignment always constrain the resulting
  candidate pool
- without a grouped source, type, subtype, and biome constrain the complete
  Creature catalog
- within one source dimension, selected table or faction identities form a
  union; a location contributes its own tables plus linked-faction primary
  tables
- direct table and World-derived table dimensions intersect; once a table
  source is active, its membership replaces type, subtype, and biome filtering
  for that generation run
- source fields persist only stable IDs; table membership, weights, Loot links,
  and World stock limits remain ephemeral provider read results
- it does not expose saved plans, roster cards, initiative rows, combat
  runtime, or result state
- it does not expose foreign creature, party, or encounter-table internals
- Auto difficulty and Auto tuning stay public request language only

## References

- [Encounter Domain Model](../domain/domain-encounter.md) (line 1)
- [Encounter UI](../requirements/requirements-encounter-state-tab.md) (line 1)
