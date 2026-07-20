Status: Active Target
Owner: SaltMarcher Team
Last Reviewed: 2026-07-18
Source of Truth: Encounter ownership, write model, derived runtime state, and
domain invariants.

# Encounter Domain Model

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

Generated alternatives and prepared batches remain transient until saved. The
current builder, initiative, combat, and result session state is Encounter-owned
runtime state, not persisted `EncounterPlan` truth and not view-owned mutable
state.

## Mutation Language

Encounter supports:

- generate encounter alternatives
- save the current roster as an Encounter plan
- load or list saved Encounter plans
- prepare one ordered generated-intent batch as concrete rosters
- commit one complete prepared batch as saved Encounter plans

## Invariants

- the active party is the balancing baseline for runtime generation
- encounter math uses current public Party facts rather than copied Party truth
- selected encounter tables replace creature-filter sourcing for that pass
- selected World Planner sources may narrow encounter tables and stock caps but
  do not transfer World Planner ownership
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

## References

- [Feature Requirements](../requirements/requirements-encounter.md)
- [Encounter Persistence](../contract/contract-encounter-persistence.md)
- [Encounter Saved Plans Contract](../contract/contract-encounter-saved-plans.md)
- [Generated Preparation Contract](../contract/contract-encounter-generated-import.md)
- [Architecture](../architecture/architecture-encounter.md)
- [Encounter Runtime UI](../requirements/requirements-encounter-state-tab.md)
