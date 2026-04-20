Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-18
Source of Truth: Creatures feature ownership, supporting read-model boundary,
and domain rationale.

# Creatures Domain Model

## Context Shape

Context Type: Supporting Read-Model Context

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

## Promotion Triggers

Promote `creatures` to a policy-owning bounded context before adding any of:

- authored creature creation or editing policy
- creature validation beyond query/default normalization
- encounter balancing, ranking, or candidate-choice policy
- persisted creature lifecycle or ownership rules
- mutable catalog truth owned by this feature rather than imported lookup data

## Allowed Domain Shape

- `application/` may normalize queries, page results, and reshape catalog
  truth into exported `api/` records
- `catalog/` owns the internal catalog query port used by application use
  cases and implemented by the data adapter
- read-model helpers are allowed as long as they do not become policy owners
- if the feature begins to rank, choose, validate, or define creature policy
  beyond query normalization, it must be promoted into the richer
  policy-owning bounded-context shape

## References

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/domain-layer.md:1)
- [Creatures Persistence](/home/aaron/Schreibtisch/projects/SaltMarcher/src/data/creatures/PERSISTENCE.md:1)
- [Catalog Tab UI](/home/aaron/Schreibtisch/projects/SaltMarcher/src/view/tabs/catalog/UI.md:1)
- [Creature Details UI](/home/aaron/Schreibtisch/projects/SaltMarcher/src/view/details/creature/UI.md:1)
