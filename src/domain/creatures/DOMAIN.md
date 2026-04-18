Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-18
Source of Truth: Creatures feature ownership, supporting read-model boundary,
and domain rationale.

# Creatures Domain Model

## Context Shape

- `creatures` is an explicit supporting read-model context.
- Its public backend boundary is
  `src/domain/creatures/CreaturesApplicationService.java`.
- The feature intentionally exposes catalog search, filtering, detail lookup,
  and encounter-candidate lookup without owning encounter policy of its own.

## Read-Model Boundary

- creature catalog data is loaded from the feature's persistence-backed query
  adapter path
- the feature owns exported query shapes and result shapes
- the feature does not own encounter balancing, ranking, locking, or other
  downstream runtime policies
- this exception is justified because the feature exists to export stable
  lookup and projection surfaces over foreign creature truth, not to own the
  write-model policy of encounter generation

## Allowed Domain Shape

- `application/` may normalize queries, page results, and reshape catalog
  truth into exported `api/` records
- read-model helpers are allowed as long as they do not become policy owners
- if the feature begins to rank, choose, validate, or define creature policy
  beyond query normalization, it must be promoted into the richer
  policy-owning bounded-context shape

## References

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/domain-layer.md:1)
- [Creatures Persistence](/home/aaron/Schreibtisch/projects/SaltMarcher/src/data/creatures/PERSISTENCE.md:1)
- [Creatures UI](/home/aaron/Schreibtisch/projects/SaltMarcher/src/view/creatures/UI.md:1)
