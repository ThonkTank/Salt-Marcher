Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-20
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

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/domain-layer.md:1)
- [Creatures Persistence](/home/aaron/Schreibtisch/projects/SaltMarcher/src/data/creatures/PERSISTENCE.md:1)
- [Catalog Tab UI](/home/aaron/Schreibtisch/projects/SaltMarcher/src/view/leftbartabs/catalog/UI.md:1)
- [Creature Details UI](/home/aaron/Schreibtisch/projects/SaltMarcher/src/view/slotcontent/details/creature/UI.md:1)
