Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-21
Source of Truth: Encounter feature ownership, runtime truth model, and domain
invariants.

# Encounter Domain Model

## Context Role

Context Role: Generation Policy Context
Context Name: Encounter

- `encounter` is a runtime composition feature.
- It does not own party truth or creature truth.
- It consumes foreign application services only:
  - `src.domain.party.PartyApplicationService`
  - `src.domain.creatures.CreaturesApplicationService`
  - `src.domain.encountertable.EncounterTableApplicationService`

## Published Language

`published/` owns public generation and budget-load commands, difficulty
bands, generator tuning, locks, budget summaries, generated encounter results,
encounter creature entries, and generation status vocabulary.
`EncounterDifficultyBand.AUTO` and Auto tuning sentinels are public request
language only. The application boundary resolves them into concrete generation
values before invoking draft construction.

The generation model must not depend on any `src.domain.*.published.*`
carriers as invariant inputs. The application boundary translates public
commands and foreign published results into generation values before invoking
policies and factories.

## Application Boundary

`application/` coordinates foreign party, creature, and encounter-table
application services, loads public inputs, translates foreign `published/`
results into encounter application values, and delegates generation work. The
root application service maps generated results into encounter `published/`
carriers.
`EncounterGenerationUseCase` remains orchestration and foreign-service
coordination only.
`LoadEncounterBudgetUseCase` exposes party-derived encounter thresholds without
constructing a generated encounter.
`LoadEncounterTuningPreviewQuery` exposes read-only slider preview labels for
the catalog controls. It derives party-specific difficulty XP ranges and
static tuning label text, but does not create or mutate encounter state.

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
- immutable generation facts stay in `generation/value/`
- named balancing, targeting, ranking, role, and tag rules live in
  `generation/policy/`
- deterministic draft construction lives in `generation/factory/`

## Write Model And Derived State

Write Model: None

The encounter feature does not persist authored write-model state in v1.

It derives:

- party-specific encounter thresholds
- encounter-ready candidate pools
- encounter-table-constrained candidate pools
- role hints for encounter composition
- ranked encounter alternatives
- generator diagnostics describing the resolved difficulty/tuning attempt,
  search quality, stop category, candidate-pool size, and attempt/evaluation
  counts
- party-derived budget summaries for the active runtime session
- party-derived tuning preview labels for catalog encounter controls

Generated encounters are ephemeral derived state. They may be locked or
excluded inside the state tab, but those controls remain local presentation
or session state unless a future aggregate is introduced.

## Aggregate Model

Write Model: None

The v1 encounter context has no persisted aggregate root. Its policy boundary
is the `generation/` module.

- `generation/value/` owns immutable generation facts: drafts, entries,
  metrics, candidate profiles, composition values, difficulty intent, tuning
  intent, and XP profiles.
- `generation/policy/` owns stateless rule sets for difficulty math, XP
  targets, generator tuning targets, candidate narrowing, draft
  ranking/scoring, role classification, and tag derivation.
- `generation/factory/` owns deterministic creation of candidate profiles and
  encounter drafts from already translated generation facts.

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
- selected encounter tables replace creature filter sourcing for that
  generation pass
- Auto difficulty and Auto tuning are resolved deterministically from the
  generation seed and request fingerprint before draft enumeration
- a non-empty candidate pool with no viable draft is distinguished from an
  empty candidate pool
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
- `EncounterDifficultyTargets`: policy thresholds for the active party.
- `EncounterDraft`: candidate generated encounter before export.
- `EncounterCandidateProfile`: creature candidate enriched for generation.
- `EncounterLock`: runtime mandatory creature input.
- `GeneratedEncounter`: exported generated encounter suggestion.

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

## References

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/domain-layer.md:1)
- [Feature Spec](/home/aaron/Schreibtisch/projects/SaltMarcher/src/domain/encounter/SPEC.md:1)
- [Encounter UI](/home/aaron/Schreibtisch/projects/SaltMarcher/src/view/statetabs/encounter/UI.md:1)
