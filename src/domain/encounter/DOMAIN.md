Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-20
Source of Truth: Encounter feature ownership, runtime truth model, and domain
invariants.

# Encounter Domain Model

## Context Role

Context Role: Generation Policy Context

- `encounter` is a runtime composition feature.
- It does not own party truth or creature truth.
- It consumes foreign application services only:
  - `src.domain.party.PartyApplicationService`
  - `src.domain.creatures.CreaturesApplicationService`

## Published Language

`published/` owns public generation requests, difficulty bands, locks, budget
summaries, generated encounter results, encounter creature entries, and
generation status vocabulary.

The generation model must not depend on any `src.domain.*.published.*`
carriers as invariant inputs. The application boundary translates public
requests and foreign published results into generation values before invoking
policies and factories.

## Application Boundary

`application/` coordinates foreign party and creature application services,
loads public inputs, delegates generation work, and maps generated results.
`EncounterGenerationUseCase` remains orchestration and foreign-service
coordination only.

## Architecture Status

Current state:

- `encounter` is a policy-owning bounded context. It owns balancing,
  candidate narrowing, locking rules, and ranking behavior for generated
  encounters.
- `application/` now owns orchestration and foreign-service coordination,
  while the `generation/` domain module owns stateless balancing, targeting,
  ranking, and role/tag heuristics for encounter generation.

Target state:

- orchestration remains in `application/`
- stable encounter generation collaborators live under explicit
  `generation/value/` role placement and continue to move toward separate
  policy or factory roles when a rule set becomes independently nameable

## Write Model And Derived State

Write Model: None

The encounter feature does not persist authored write-model state in v1.

It derives:

- party-specific encounter thresholds
- encounter-ready candidate pools
- role hints for encounter composition
- ranked encounter alternatives

Generated encounters are ephemeral derived state. They may be locked or
excluded inside the state tab, but those controls remain local presentation
or session state unless a future aggregate is introduced.

## Aggregate Model

Write Model: None

The v1 encounter context has no persisted aggregate root. Its policy boundary
is the `generation/` module.

- `generation/value/` owns the ephemeral generation model: drafts, entries,
  metrics, candidate profiles, composition values, XP profiles, deterministic
  ranking helpers, and draft creation collaborators.
- Promote a type from `generation/value/` into `generation/policy/`,
  `generation/factory/`, or `generation/service/` only when it becomes a
  separately reusable domain concept instead of an internal generation-model
  collaborator.

## Ephemeral Policy Rationale

Encounter generation owns rule-bearing runtime decisions, but v1 does not need
an authored encounter write model because generated encounters are suggestions
inside the active runtime session. If locks, exclusions, encounter plans, or
accepted encounters become persisted authored truth, this context must introduce
a real aggregate root before those mutations are stored.

## Commands And Invariants

Commands entering the policy model are:

- generate encounter
- apply locked creature inputs
- exclude runtime candidates
- rank generated alternatives

Core invariants:

- the active party is the balancing baseline
- encounter math is computed from public party data, not duplicated persistence
- foreign feature internals remain hidden behind their API boundaries
- generator ranking must be deterministic for the same inputs
- locked creatures remain mandatory inputs until cleared by the user

## Consistency Model

Encounter generation reads party and creature context snapshots through public
application-service boundaries. It does not save party or creature state, and it
does not persist generated encounter state in v1. Runtime locks and exclusions
are session-local controls over the next generation command.

## Ubiquitous Language

- `EncounterDifficultyBand`: requested difficulty intent.
- `EncounterDifficultyTargets`: budget thresholds for the active party.
- `EncounterDraft`: candidate generated encounter before export.
- `EncounterCandidateProfile`: creature candidate enriched for generation.
- `EncounterLock`: runtime mandatory creature input.
- `GeneratedEncounter`: exported generated encounter suggestion.

## Domain Policies

- difficulty evaluation uses encounter thresholds plus monster-count
  multipliers
- candidate filtering may narrow by creature type, subtype, and biome
- role hints are heuristic derived state; they do not become persisted creature
  truth
- the feature may enrich final suggestions with creature-detail tags without
  changing creature ownership

## References

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/domain-layer.md:1)
- [Feature Spec](/home/aaron/Schreibtisch/projects/SaltMarcher/src/domain/encounter/SPEC.md:1)
- [Encounter UI](/home/aaron/Schreibtisch/projects/SaltMarcher/src/view/statetabs/encounter/UI.md:1)
