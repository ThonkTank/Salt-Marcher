Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-17
Source of Truth: Encounter feature ownership, runtime truth model, and domain
invariants.

# Encounter Domain Model

## Feature Boundary

- `encounter` is a runtime composition feature.
- It does not own party truth or creature truth.
- It consumes foreign feature APIs only:
  - `src.domain.party.partyAPI`
  - `src.domain.creatures.creaturesAPI`

## Canonical Truth And Derived State

The encounter feature does not persist canonical authored truth in v1.

It derives:

- party-specific encounter thresholds
- encounter-ready candidate pools
- role hints for encounter composition
- ranked encounter alternatives

Generated encounters are ephemeral derived state. They may be locked or
excluded inside the runtime tab, but those controls remain local session state.

## Core Invariants

- the active party is the balancing baseline
- encounter math is computed from public party data, not duplicated persistence
- foreign feature internals remain hidden behind their API boundaries
- generator ranking must be deterministic for the same inputs
- locked creatures remain mandatory inputs until cleared by the user

## Domain Policies

- difficulty evaluation uses encounter thresholds plus monster-count
  multipliers
- candidate filtering may narrow by creature type, subtype, and biome
- role hints are heuristic derived state; they do not become persisted creature
  truth
- the feature may enrich final suggestions with creature-detail tags without
  changing creature ownership
