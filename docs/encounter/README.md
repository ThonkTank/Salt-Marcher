Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-16
Source of Truth: Entry point and document map for the encounter feature.

# Encounter Feature README

## Purpose

The encounter feature owns runtime encounter generation for the currently
active party and saved encounter-plan roster truth. It composes party state and
creature catalog data into rule-oriented encounter suggestions, then persists
only the user-accepted roster when the user saves a plan.

## Documentation Set

- [Feature Spec](requirements/requirements-encounter.md)
- [Domain Model](domain/domain-encounter.md)
- [Persistence](contract/contract-encounter-persistence.md)
- [Saved Plans Contract](contract/contract-encounter-saved-plans.md)
- [Plan Budget Contract](contract/contract-encounter-plan-budget.md)
- [Builder Inputs Contract](contract/contract-encounter-builder-inputs.md)
- [Encounter State Contract](contract/contract-encounter-state.md)
- [Generated Import Contract](contract/contract-encounter-generated-import.md)
- [Encounter Table Feature README](../encountertable/README.md)
- [Encounter UI](requirements/requirements-encounter-state-tab.md)

## Scope

In scope:

- deriving encounter budgets from the active party
- reading saved encounter plans as party-specific budget summaries for planner
  surfaces
- filtering the creature catalog into encounter-ready candidates
- generating and ranking multiple encounter alternatives
- adding catalog creature rows into a manual runtime roster
- saving and opening encounter-plan rosters
- atomically importing generated-origin encounter specifications as saved plans

Out of scope:

- persisting initiative, combat, result, or loot state as encounter-plan truth
- dungeon room placement or biome ownership
- bootstrap or shell policy
- generated reward, packing, audit, or session-scene ownership
