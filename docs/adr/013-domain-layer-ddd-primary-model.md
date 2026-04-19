# ADR 013: DDD-Primary Domain-Layer Model

- Status: Accepted
- Date: 2026-04-18
- Enforcement Update: ADR 014 removes the temporary mechanical tolerance for
  legacy root role buckets.

## Context

SaltMarcher's previous domain-layer model correctly adopted several DDD
concepts such as thin application services, aggregates, and repository
contracts. However, it still described the physical structure of
`src/domain/**` through technical role buckets such as `entity/`,
`valueobject/`, `service/`, `repository/`, and `query/`.

That approach created a structural contradiction:

- the policy description was object-centred and aggregate-centred
- the physical structure was role-centred and concern-centred
- the mechanical checks privileged the concern-centred topology over the DDD
  modelling guidance

The local reference set supports a clearer direction:

- Evans treats modules as part of the model and says they should tell the
  story of the system, use ubiquitous-language names, and partition cohesive
  concepts rather than technical categories
- Fowler defines the domain model as behavior plus data in one object model
- Fowler and Evans both describe the application layer as thin coordination
  over expressive domain objects
- Vernon defines aggregates as transactional consistency boundaries and argues
  for small aggregates, identity references, and eventual consistency outside
  the boundary

## Decision

SaltMarcher adopts a DDD-primary domain-layer model for `src/domain/**`.

- Each `src/domain/<feature>/` slice is first-classly treated as one bounded
  context.
- The public backend boundary below the view layer remains
  `<PascalFeatureName>ApplicationService.java`.
- `application/` remains the home for thin application-layer orchestration.
- `api/` remains the home for exported commands, queries, results, snapshots,
  and other boundary carriers.
- The canonical physical structure below the feature root is a set of named
  domain modules that follow the ubiquitous language of the owning bounded
  context.
- Entities, value objects, aggregates, domain services, domain events,
  factories, and repository contracts are colocated inside the owning named
  domain module rather than split into mandatory top-level role buckets.
- CQRS-style read models remain allowed only as a deliberate supporting
  pattern. They are not the default shape of a domain feature and do not
  justify a mandatory `query/` package under every domain root.
- The previous top-level role buckets under `src/domain/**` are migration
  debt, not a second canonical option.

## Consequences

- The domain layout now aligns more directly with Evans-style modules and
  conceptual contours.
- SaltMarcher keeps established patterns only where they are strongly
  justified:
  - Service Layer for the single public application boundary
  - DDD application layer for orchestration in `application/`
  - exported boundary carriers in `api/`
- ADR 014 subsequently removed temporary mechanical tolerance for existing root
  role buckets under `src/domain/**`.
- Mechanical topology checks must enforce the DDD target model rather than
  encode the old bucket model.

## Alternatives Considered

### Keep the previous hybrid model

Rejected because it mixed DDD semantics with a role-bucket topology that the
primary DDD references do not require and that Evans explicitly cuts against
with his treatment of modules.

### Adopt pure CQRS as the default domain shape

Rejected because the local domain contexts are not uniformly projection-only
and the references treat CQRS as optional and context-dependent rather than
the baseline tactical model.

### Remove `application/` and collapse everything into aggregates

Rejected because Fowler and Evans both keep a thin application/service layer
for use-case coordination and boundary definition.

## Related Documents

- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/overview.md:1)
- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/domain-layer.md:1)
- [Repository Structure Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/repository-structure.md:1)
- [Architecture Enforcement Harness Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/architecture-enforcement-harness.md:1)
- [ADR 014: Strict Domain-Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/014-strict-domain-layer-enforcement.md:1)
