# Encounter Domain Model

Status: Active target domain with saved-plan, generated-batch, and manual runtime Godot implementation
Owner: Encounter
Last Reviewed: 2026-07-28
Source of Truth: This document

## Context Role And Ownership

Context Name: `Encounter`

Context Role: Roster Truth Context

Encounter owns saved encounter-plan roster truth and encounter-generation
policy. Party membership, creature facts, encounter-table membership, World
Planner facts, Session Generation rewards, and Session Planner scenes remain
foreign truth.

## Published Language

`EncounterApi` publishes Encounter-owned immutable language for:

- `EncounterPlanId`, `EncounterPlan`, saved-plan summaries, and planning facts
- difficulty bands, thresholds, tuning choices, candidate diagnostics, and
  generated alternatives
- revisioned builder, initiative, combat, and result runtime state
- ordered generated intents, prepared concrete roster summaries, generated
  batch outcomes, and Encounter-number-to-plan mappings

Public commands and foreign API results are translated before they enter
Encounter policies or the write model. API carriers, repositories, persistence
rows, and foreign internal models are not Encounter domain truth.

## Write Model

`EncounterPlan` is the Encounter write model and aggregate root. It owns:

- stable plan identity
- user-visible plan name and optional generated encounter label
- ordered `EncounterPlanCreature` values containing creature identity,
  quantity, and last-known display name
- optional immutable generated origin identifying the preparation, generation
  run, engine meaning, Encounter number, and normalized roster

An `EncounterPlan` contains at least one creature. It does not embed creature
statblocks, party members, initiative, combat HP, generated rewards, packing,
audits, session scenes, or dungeon placement.

Generated preparation carriers translate a complete proposed batch into
ordinary `EncounterPlan` aggregates. They are not a second write model.

## Derived And Runtime State

Encounter derives:

- active-party difficulty thresholds and daily-budget context
- candidate pools constrained by filters, encounter tables, World Planner
  sources, and finite stock caps
- role hints, ranked alternatives, fallback advice, and generation diagnostics
- party-specific planning facts for saved plans
- prepared concrete generated-roster batches

Generated alternatives remain durable runtime-only truth until cleared or
replaced; prepared batches remain transient until committed. Neither is saved
plan truth until an explicit save/commit. The current builder, initiative,
combat, and result session state is
Encounter-owned runtime state, not persisted `EncounterPlan` truth and not
view-owned mutable state. One versioned collection persists the independent
manual context and every Scene-keyed context separately from saved plans.
Opening a plan or synchronizing a Scene materializes current Creature combat
facts; compatible combatants preserve their running state across composition
reconciliation.

## Mutation Language

Encounter supports:

- generate encounter alternatives
- update Catalog pool filters without changing Encounter tuning, and update
  Encounter tuning without changing Catalog pool filters
- select a generated alternative or clear only its history while retaining the
  current roster
- save the current roster as an Encounter plan
- load or list saved Encounter plans
- prepare one ordered generated-intent batch as concrete rosters
- commit one complete prepared batch as saved Encounter plans
- open a saved plan into the manual runtime context
- add a current Creature to the manual builder roster or as one live combat
  reinforcement without changing saved-plan truth
- adjust a manual builder slot by one, remove a complete slot, and restore the
  most recently removed slot at its prior position
- open, edit, and confirm initiative
- mutate individual enemy HP and initiative, advance turns, and end combat
- award one result through an atomic Encounter-plus-Party publication
- synchronize the complete set of Scene-keyed contexts from one Scene revision
- focus, open, and resume one context without mutating parallel contexts

## Invariants

- the active party is the balancing baseline for runtime generation
- encounter math uses current public Party facts rather than copied Party truth
- selected encounter tables replace creature-filter sourcing for that pass
- table and faction selections form unions within their own dimensions, while
  direct Encounter Tables and World-derived tables intersect
- selected World Planner sources may narrow encounter tables and stock caps but
  do not transfer World Planner ownership
- a location contributes its own tables and linked factions' primary tables;
  finite caps apply to generated quantities and omitted caps remain unlimited
- multiple linked Loot Table IDs are warning context, not a generation failure
- Auto difficulty and tuning resolve deterministically from the generation
  seed and request meaning before alternatives are enumerated
- a non-empty candidate pool with no viable roster is distinct from an empty
  candidate pool
- ranking is deterministic for the same inputs
- saved plans contain at least one concrete creature identity with positive
  quantity and never own creature statblocks
- generated origin is unique for one engine meaning, preparation identity, and
  Encounter number
- every generated intent resolves to one concrete non-empty roster before any
  plan from the batch becomes durable
- the complete generated batch is all-or-nothing and an identical completed
  retry denotes the same saved plans
- generated origin never transfers reward, packing, audit, or session-scene
  ownership into Encounter
- context identity is stable, roster slots are stable within a source, and
  reconciliation never merges independent running scenes
- a builder addition clears the copied saved-plan identity; a live
  reinforcement preserves the creation roster and current active turn
- every manual roster edit clears the copied saved-plan identity; only the most
  recent removal is undoable, and the next roster mutation clears that history
- Scene-keyed contexts and initiative, combat, or result modes reject manual
  roster edits
- enemy XP excludes allied NPC roster members

## Domain Policies

- difficulty evaluation uses party thresholds and monster-count multipliers
- candidate filtering may narrow by creature type, subtype, biome, selected
  tables, World Planner sources, and finite stock
- tuning may prefer different creature counts, XP spread, and statblock
  diversity
- Auto generation tries a neutral configuration and then a bounded seeded set
  of alternatives
- when no exact difficulty match exists but valid rosters do, the best-ranked
  fallback is returned with an advisory
- role hints are heuristic derived state and never persisted creature truth
- saved plans preserve roster composition only; combat state is never plan
  truth

## Consistency Boundary

One `EncounterPlan` is the manual-save consistency boundary. One generated
batch is a larger all-or-nothing consistency boundary containing multiple
ordinary Encounter plans with immutable generated origins. Opening a plan
rebuilds runtime state from current creature detail and clears prior initiative,
combat, result, and generated-alternative runtime state.

Scene synchronization is a second consistency boundary only at the Campaign
publication level: one Scene revision and the complete replacement context set
publish atomically. Encounter still owns every context's workflow state and
reconciles rather than copying it into Scene.

## References

- [Feature Requirements](../requirements/requirements-encounter.md)
- [Encounter Persistence](../contract/contract-encounter-persistence.md)
- [Encounter Saved Plans Contract](../contract/contract-encounter-saved-plans.md)
- [Generated Preparation Contract](../contract/contract-encounter-generated-import.md)
- [Architecture](../architecture/architecture-encounter.md)
- [Encounter Runtime UI](../requirements/requirements-encounter-state-tab.md)
