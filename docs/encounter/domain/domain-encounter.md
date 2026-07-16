Status: Active Target
Owner: SaltMarcher Team
Last Reviewed: 2026-07-15
Source of Truth: Encounter feature ownership, saved-plan write model, runtime
generation policy, and domain invariants.

# Encounter Domain Model

## Context Role

Context Role: Roster Truth Context
Context Name: Encounter

- `encounter` owns saved encounter-plan roster truth.
- It also owns runtime encounter-generation policy for creating suggested
  rosters from the active party, creature catalog, and encounter tables.
- It does not own party truth, creature truth, or encounter-table membership.
- It consumes foreign facts only through `PartyApi`, `CreaturesApi`,
  `EncounterTableApi`, and `WorldPlannerApi`.

## Published Language

`EncounterApi` owns view-facing immutable runtime state plus shared request and
chooser-display language.

- immutable, revisioned `EncounterStateSnapshot`, `ApplyEncounterStateCommand`,
  and typed command results
- immutable, revisioned `EncounterBuilderInputs`,
  `UpdateEncounterBuilderInputsCommand`, and typed update results
- `EncounterTuningPreviewResult`

It also owns shared request/read vocabulary such as difficulty bands, tuning
preview labels, one saved-plan chooser display carrier, and status enums.

`EncounterDifficultyBand.AUTO` and Auto tuning sentinels are public request
language only. The application boundary resolves them into concrete generation
values before invoking draft construction.

Saved encounter plans publish only the chooser display language reused by the
encounter builder. SessionPlanner-specific list and budget/detail facts leave
the feature through `EncounterApi`; no second reply channel or repository is a
cross-feature boundary. The chooser
surface is intentionally thin and does not mirror the internal
`EncounterPlanSummary` record. Creature details remain owned by the creatures
context and are reloaded when a saved plan is opened.

The generation and plan models MUST NOT depend on API carriers as invariant
inputs. The application boundary translates public commands and foreign API results into
encounter application values before invoking policies, factories, or plan
ports.

## Application Boundary

The application boundary coordinates foreign party, creature, encounter-table,
and world-planner inputs, translates foreign API results into encounter
application values, and delegates generation or saved-plan work. It publishes
only encounter-owned immutable, revisioned API state instead of exporting
internal session carriers.

Generation orchestration coordinates foreign APIs without owning their truth.
A separate budget read exposes party-derived encounter thresholds without
constructing a generated encounter. A saved-plan budget read exposes one plan
as party-specific planning facts for downstream planning surfaces.
The catalog tuning preview remains a read-only Encounter API result.

Saved-plan use cases own save, list, and load orchestration through one
feature-owned persistence port. The SQLite adapter persists plan and creature
rows; the domain model keeps the saved roster invariant independent of storage
shape.

## Architecture Constraints

- Encounter owns saved-plan roster truth, balancing, candidate narrowing, and
  ranking behavior.
- Application code owns orchestration and foreign-API coordination.
- Domain code owns immutable generation facts, named balancing and ranking
  policies, deterministic draft construction, and the saved-plan aggregate.
- Package and helper decomposition inside those roles is an internal choice,
  not a compatibility or architecture contract.

## Write Model And Derived State

Write Model: Saved Encounter Plans

The encounter write model persists accepted encounter rosters as saved plans.
Each saved plan owns:

- stable plan identity
- user-visible plan name
- optional generated encounter label
- ordered creature identity and quantity rows

It derives:

- party-specific encounter thresholds
- encounter-ready candidate pools
- encounter-table-constrained candidate pools
- world-location and faction constrained encounter-table pools
- finite world-faction stock caps for generated statblocks
- role hints for encounter composition
- ranked encounter alternatives
- generator diagnostics describing the resolved difficulty/tuning attempt,
  search quality, stop category, candidate-pool size, and attempt/evaluation
  counts
- party-derived budget summaries for the active runtime session
- party-derived saved-plan planning facts for downstream planner surfaces
- party-derived tuning preview labels for catalog encounter controls

Generated alternatives remain ephemeral derived state until the user saves the
current roster as an encounter plan.

Builder, initiative, combat, and result state is domain-owned runtime state.
It is persisted separately per runtime context for restart recovery and never
becomes saved encounter-plan truth or view-owned mutable state.

## Aggregate Model

Aggregate Root: EncounterPlan

`EncounterPlan` owns the saved encounter roster. It stores only encounter-plan
identity, display labels, and creature quantities. It does not embed creature
statblocks, party members, initiative, combat HP, loot resolution, or dungeon
room placement.

- `EncounterPlan` owns plan identity and roster membership.
- `EncounterPlanCreature` owns one creature-id and quantity pair.
- `EncounterPlanSummary` owns list-screen summary language.
- A feature-owned application port owns outbound saved-plan persistence.

Generation values, policies, and factories remain stateless domain modules used
to construct candidate rosters before a saved plan exists.

## Commands And Invariants

Commands entering the model are:

- generate encounter
- save current encounter plan
- list saved encounter plans
- load saved encounter plan

Core invariants:

- the active party is the balancing baseline for generation
- encounter math is computed from public party data, not duplicated persistence
- selected encounter tables replace creature filter sourcing for that
  generation pass
- selected world locations and factions may narrow encounter tables and finite
  stock caps, but they do not transfer world-planner ownership into encounter
- Auto difficulty and Auto tuning are resolved deterministically from the
  generation seed and request fingerprint before draft enumeration
- a non-empty candidate pool with no viable draft is distinguished from an
  empty candidate pool
- foreign feature internals remain hidden behind their API boundaries
- generator ranking must be deterministic for the same inputs
- a saved plan must contain at least one creature
- saved plans store creature identity and quantity, not creature truth

## Consistency Model

Encounter generation reads party, creature, and encounter-table snapshots
through their public APIs. It does not save party,
creature, or encounter-table state.

Saved encounter plans are persisted through an encounter-owned application
port. Opening a plan rebuilds the runtime roster from
the saved creature identities and current creature details; initiative, combat,
result, and generator-alternative state are cleared because they are session
runtime state.

## Ubiquitous Language

- `EncounterDifficultyBand`: requested difficulty intent.
- `EncounterDifficultyTargets`: policy thresholds for the active party.
- `EncounterDraft`: candidate generated encounter before export.
- `EncounterCandidateProfile`: creature candidate enriched for generation.
- `GeneratedEncounter`: exported generated encounter suggestion.
- `EncounterPlan`: saved encounter roster aggregate.
- `SavedEncounterPlanChoice`: published saved-plan chooser display row.
- `EncounterPlanFact`: Session Planner-facing saved-plan planning readout
  exposed by `EncounterApi`.

## Domain Policies

- difficulty evaluation uses encounter thresholds plus monster-count
  multipliers
- candidate filtering may narrow by creature type, subtype, and biome
- generator tuning may prefer smaller or larger creature counts, narrower or
  wider XP spread, and lower or higher statblock diversity
- Auto generation first tries a neutral resolved configuration, then up to a
  bounded set of seeded variants, and returns an exact match when a resolved
  target difficulty is met
- when no exact match exists but drafts are available, generation returns the
  best-ranked fallback with a fallback advisory instead of treating it as a
  creature-source failure
- role hints are heuristic derived state; they do not become persisted creature
  truth
- the feature may enrich final suggestions with creature-detail tags without
  changing creature ownership
- saved plans preserve roster composition only; combat state is never saved as
  plan truth

## References

- [Feature Spec](../requirements/requirements-encounter.md)
- [Encounter Persistence](../contract/contract-encounter-persistence.md)
- [Encounter Builder Inputs Contract](../contract/contract-encounter-builder-inputs.md)
- [Encounter Saved Plans Contract](../contract/contract-encounter-saved-plans.md)
- [Encounter State Contract](../contract/contract-encounter-state.md)
- [Runtime Session Contract](../contract/contract-encounter-runtime-sessions.md)
- [Encounter UI](../requirements/requirements-encounter-state-tab.md)
