Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-26
Source of Truth: Creatures reference catalog ownership, published lookup
language, and domain rationale.

# Creatures Domain Model

## Context Role

Context Role: Reference Catalog Context
Context Name: Creatures

- `creatures` is a reference catalog context over imported creature truth.
- Its public backend boundary is
  `src/domain/creatures/CreaturesApplicationService.java`.
- The feature intentionally exposes catalog search, filtering, detail lookup,
  and encounter-candidate lookup without owning encounter generation policy or
  creature lifecycle truth.

## Published Language

`published/` owns public catalog queries, result pages, lookup statuses, filter
options, creature details, action details, catalog rows, and encounter-candidate
reference profiles.

Published catalog carriers describe imported creature facts and lookup results.
They do not encode encounter ranking, choice, balancing, or composition policy.

## Application Boundary

`application/` owns query normalization, paging coordination, detail lookup,
filter option loading, and domain lookup-port coordination. The root
application service maps imported catalog truth into `published/` carriers.

It does not own encounter ranking, candidate scoring, or creature lifecycle
policy.

## Catalog Model

`catalog/` owns the domain role packages for imported creature reference
catalog access. Read-only catalog lookup ports belong under `catalog/port/`.
They express domain-facing lookup needs, not data adapter placement or storage
shape.

## Write Model And Derived State

Write Model: None

`creatures` does not own authored creature mutation flows in SaltMarcher. The
feature consumes imported creature reference truth and republishes it through
its own published lookup language.

Derived state:

- filtered catalog result pages
- normalized filter option sets
- published creature detail projections
- encounter-candidate reference profiles for downstream generator policy

## Invariants

- creature catalog lookups remain read-only within SaltMarcher
- published creature detail and encounter-candidate carriers reflect imported
  creature truth rather than encounter-balancing policy
- missing or broken source data becomes lookup failure state, not synthesized
  creature facts
- query normalization may narrow invalid ranges or defaults, but it must not
  invent authored creature truth

## Consistency Model

The creatures context is a reference-catalog context with imported upstream
truth. A lookup result is internally consistent within one query or detail
request, but the feature does not own cross-request authored mutation
consistency because it has no local write model.

## Promotion Triggers

Reclassify `creatures` before adding any of:

- authored creature creation or editing policy
- creature validation beyond query/default normalization
- encounter balancing, ranking, or candidate-choice policy
- persisted creature lifecycle or ownership rules
- mutable catalog truth owned by this feature rather than imported lookup data

## Ubiquitous Language

- `Creature Catalog`: imported creature reference data.
- `Creature Detail`: published reference profile for one creature.
- `Catalog Query`: public lookup request over imported reference truth.
- `Encounter Candidate`: reference creature profile consumed by encounter
  generation.

## References

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/domain-layer.md:1)
- [Creatures Persistence](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/creatures/contract/contract-creatures-persistence.md:1)
- [Catalog Tab UI](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/creatures/requirements/requirements-creatures-catalog.md:1)
- [Creature Details UI](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/creatures/requirements/requirements-creatures-details.md:1)
