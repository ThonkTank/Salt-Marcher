# ADR 010: Data-Layer Architecture Model

- Status: Accepted
- Date: 2026-04-18

## Context

SaltMarcher already separates active code into `view`, `domain`, and `data`,
and the repository structure documents the allowed `src/data/**` buckets.
However, the data layer still lacked a binding behavioural standard comparable
to the MVVM and domain-layer standards.

That gap leaves several important decisions too implicit:

- which data bucket is the public adapter boundary of a feature
- how concrete source adapters differ from repository implementations
- where schema truth, records, and mapping responsibilities belong
- how much business logic is allowed to accumulate in persistence code

The current codebase already points in a consistent direction. Party and
creatures use thin `ServiceContribution` roots, domain-owned contracts,
SQLite source adapters, source-local models, and dedicated mappers.
At the time this ADR was accepted, some transitional implementations still
lived outside the long-term target shape and were not to be treated as
precedent. ADR 021 later moved the dungeon placeholder storage behind data-layer
repository adapters.

## Decision

SaltMarcher adopts a dedicated data-layer architecture standard for
`src/data/**`.

- The data layer is the single authored home for persistence and
  external-system adaptation below the domain.
- Domain-owned repository contracts and read-model ports remain in `src/domain/**`;
  `src/data/**` implements them.
- `repository/` owns write-model persistence adapters.
- `query/` owns exported read-only query adapters.
- `gateway/` owns concrete source mechanics and stays internal to the owning
  data feature.
- `model/` owns schema declarations and source-local carrier types.
- `mapper/` owns translation between source-local shapes and domain or public
  boundary types.
- `persistencecore/` remains shared generic persistence infrastructure, not a
  public feature boundary.
- `*ServiceContribution` is the only public registration root for a data
  feature and stays thin.

The detailed rules live in the data-layer standard, not in this ADR.

## Consequences

- SaltMarcher now has one system-wide source of truth for data-layer role
  boundaries, comparable in sharpness to the view and domain standards.
- Existing feature `PERSISTENCE.md` documents can focus on feature-specific
  persistence ownership while inheriting the system-wide adapter model from the
  new standard.
- Existing data implementations that blur repository, query, gateway, and
  mapping
  responsibilities are migration debt rather than precedent.
- No new top-level bucket, feature-root naming rule, or compile/build gate is
  introduced by this decision.
- Stronger data-layer semantics remain review-owned until a dedicated
  mechanical owner is added.

## Alternatives Considered

### Keep data-layer guidance implicit across repository structure, shell discovery, and feature `PERSISTENCE.md` files

Rejected because it leaves the most important data-role boundaries open to
interpretation and provides no single binding source for reviewers.

### Standardize only today’s SQLite persistence details

Rejected because SaltMarcher needs a general `src/data/**` model that also
covers future remote or non-SQL adapters without rewriting the architecture
vocabulary again.

### Adopt an Active Record style and move persistence mechanics into domain objects

Rejected because it would collapse the domain and data responsibilities that
SaltMarcher is explicitly separating.

## Related Documents

- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/overview.md:1)
- [Repository Structure Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/repository-structure.md:1)
- [Shell Discovery And Bootstrap Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/shell-and-discovery.md:1)
- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/domain-layer.md:1)
- [Data Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/data-layer.md:1)
- [Quality Platforms Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/quality-platforms.md:1)
