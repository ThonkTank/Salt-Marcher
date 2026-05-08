Status: Deprecated
Owner: SaltMarcher Team
Last Reviewed: 2026-04-26
Source of Truth: Compatibility mirror for canonical documentation at `docs/encounter/domain/domain-encounter.md`.

# Encounter Domain Model Compatibility Mirror

This legacy path remains build-visible during the documentation-taxonomy
migration. Canonical feature-owned documentation lives at:

- [Encounter Domain Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/encounter/domain/domain-encounter.md:1)

## Context Role

Context Role: Roster Truth Context
Context Name: Encounter

- `encounter` owns saved encounter-plan roster truth.
- It also owns runtime encounter-generation policy for creating suggested
  rosters from the active party, creature catalog, and encounter tables.
- It does not own party truth, creature truth, or encounter-table membership.

## Published Language

`published/` owns public generation and budget-load commands, difficulty
bands, generator tuning, budget summaries, generated encounter results,
encounter creature entries, saved encounter-plan commands and queries, thin
chooser display language, and status vocabulary.

Saved encounter plans publish only thin chooser display language. The
SessionPlanner list/detail work forms leave encounter through the foreign
`SessionEncounterFactsLookup` service seam instead of encounter-owned
published read models. Creature details remain owned by the creatures context
and are reloaded when a saved plan is opened.

## Application Boundary

`application/` coordinates foreign party, creature, and encounter-table
application services, loads public inputs, translates foreign `published/`
results into encounter application values, and delegates generation or
saved-plan work while only the session-state read models stay
encounter-published.

## Aggregate Model

Aggregate Root: EncounterPlan

`EncounterPlan` owns the saved encounter roster. It stores encounter-plan
identity, display labels, and creature quantities without embedding creature
truth, party truth, or combat runtime state.

## Commands And Invariants

Commands entering the model are:

- generate encounter
- save current encounter plan
- list saved encounter plans
- load saved encounter plan

Core invariants:

- the active party is the balancing baseline for generation
- encounter math is computed from public party data, not duplicated
  persistence
- a saved plan must contain at least one creature
- saved plans store creature identity and quantity, not creature truth
- foreign feature internals remain hidden behind their API boundaries

## Consistency Model

Encounter generation reads party, creature, and encounter-table snapshots
through public application-service boundaries. It does not save party,
creature, or encounter-table state.

Saved encounter plans are persisted through the encounter-owned
`EncounterPlanRepository` port. Opening a plan rebuilds the runtime roster
from the saved creature identities and current creature details; initiative,
combat, result, and generator-alternative state are cleared because they are
session runtime state.

## Ubiquitous Language

- `EncounterDifficultyBand`: requested difficulty intent.
- `EncounterDraft`: candidate generated encounter before export.
- `GeneratedEncounter`: exported generated encounter suggestion.
- `EncounterPlan`: saved encounter roster aggregate.
- `SavedEncounterPlanChoice`: published saved-plan chooser display row.

## References

- [Encounter Domain Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/encounter/domain/domain-encounter.md:1)
