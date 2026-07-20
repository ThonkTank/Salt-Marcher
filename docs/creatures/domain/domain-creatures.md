Status: Active Target
Owner: SaltMarcher Team
Last Reviewed: 2026-07-19
Source of Truth: Creatures reference catalog ownership, public lookup
language, and domain rationale.

# Creatures Domain Model

## Context Role

Context Role: Reference Catalog Context
Context Name: Creatures

- `creatures` is a reference catalog context over imported creature truth.
- Its public boundary is `CreaturesApi`.
- The feature intentionally exposes catalog search, filtering, detail lookup,
  encounter-candidate lookup, and direct one-shot facts snapshots without
  owning encounter generation policy or creature lifecycle truth.

## Published Language

`CreaturesApi` owns public catalog queries, result pages, lookup statuses,
filter options, creature details, action details, catalog rows,
encounter-candidate reference profiles, and direct facts snapshots selected by
an XP-value union or creature-ID union.

A direct facts query is one complete, unpaged read. It returns every matching
creature in stable creature-ID order and never inherits UI paging or catalog
result limits. Consumers may apply their own ranking policy only after this
immutable query result crosses the API boundary.

Creatures API carriers describe imported creature facts and lookup results.
They do not encode encounter ranking, choice, balancing, or composition policy.

## Application Boundary

The application boundary owns query normalization, paging coordination, detail
lookup, filter option loading, and domain lookup-port coordination. It maps
imported catalog truth into API carriers.

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
feature consumes imported creature reference truth and exposes it through its
own API language.

Derived state:

- filtered catalog result pages
- normalized filter option sets
- creature detail projections
- encounter-candidate reference profiles and one-shot facts snapshots for
  downstream generator policy

## Invariants

- creature catalog lookups remain read-only within SaltMarcher
- API creature detail and encounter-candidate carriers reflect imported
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
- `Creature Detail`: public reference profile for one creature.
- `Catalog Query`: public lookup request over imported reference truth.
- `Encounter Candidate`: reference creature profile consumed by encounter
  generation.

## References

- [Creatures Persistence](../contract/contract-creatures-persistence.md)
- [Catalog Tab UI](../requirements/requirements-creatures-catalog.md)
- [Creature Details UI](../requirements/requirements-creatures-details.md)
