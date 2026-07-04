Status: Deprecated
Owner: SaltMarcher Team
Last Reviewed: 2026-05-08
Source of Truth: Compatibility mirror for canonical documentation at `docs/creatures/domain/domain-creatures.md`.

# Creatures Domain Model Compatibility Mirror

This legacy path remains build-visible during the documentation-taxonomy
migration. Canonical feature-owned documentation lives at:

- [Creatures Domain Model](docs/creatures/domain/domain-creatures.md:1)

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

`published/` owns public catalog queries, result pages, lookup statuses,
filter options, creature details, action details, catalog rows, and
encounter-candidate reference profiles.

Published catalog carriers describe imported creature facts and lookup
results. They do not encode encounter ranking, choice, balancing, or
composition policy.

## Application Boundary

Application Service: CreaturesApplicationService

`application/` owns query normalization, paging coordination, detail lookup,
filter option loading, and domain lookup-port coordination. The root
application service maps imported catalog truth into `published/` carriers.

It does not own encounter ranking, candidate scoring, or creature lifecycle
policy.

## Ubiquitous Language

- `Creature Catalog`: imported creature reference data.
- `Creature Detail`: published reference profile for one creature.
- `Catalog Query`: public lookup request over imported reference truth.
- `Encounter Candidate`: reference creature profile consumed by encounter
  generation.

## References

- [Creatures Domain Model](docs/creatures/domain/domain-creatures.md:1)
