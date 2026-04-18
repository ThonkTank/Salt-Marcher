Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-18
Source of Truth: Encounter feature ownership, runtime truth model, and domain
invariants.

# Encounter Domain Model

## Feature Boundary

- `encounter` is a runtime composition feature.
- It does not own party truth or creature truth.
- It consumes foreign application services only:
  - `src.domain.party.PartyApplicationService`
  - `src.domain.creatures.CreaturesApplicationService`

## Architecture Status

Current state:

- `encounter` is a policy-owning bounded context. It owns balancing,
  candidate narrowing, locking rules, and ranking behavior for generated
  encounters.
- `application/` now owns orchestration and foreign-service coordination,
  while stateless balancing, targeting, ranking, and role/tag heuristics still
  live in dedicated encounter model code that remains migration debt toward
  named domain modules.

Target state:

- orchestration remains in `application/`
- stable encounter policies continue to move toward richer domain objects and
  explicit domain services instead of procedural helper concentration

## Write Model And Derived State

The encounter feature does not persist authored write-model state in v1.

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

## References

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/domain-layer.md:1)
- [Feature Spec](/home/aaron/Schreibtisch/projects/SaltMarcher/src/domain/encounter/SPEC.md:1)
- [Encounter UI](/home/aaron/Schreibtisch/projects/SaltMarcher/src/view/encounter/UI.md:1)
