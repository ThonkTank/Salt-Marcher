# ADR 024: Domain And Data Concept Simplification

- Status: Accepted
- Date: 2026-04-21

## Context

ADR 023 made Hexagonal Architecture the canonical domain-layer model and moved
DDD vocabulary into tactical roles inside the application core. The standards
still carried too much model vocabulary as if every borrowed architecture term
were a first-class layer concept.

That created two problems:

- `src/domain/**` described one hexagonal core but still read like a mandatory
  DDD role matrix.
- `src/data/**` mixed Ports and Adapters, Repository, Query, Gateway, Data
  Mapper, schema, runtime registration, and shared infrastructure as if they
  were parallel layer models instead of implementation roles below the core.

Professional reference models use fewer default concepts. Hexagonal and Clean
Architecture focus on inside/outside dependency direction, application
boundaries, ports, and adapters. DDD adds tactical modelling vocabulary inside
the core. Fowler persistence patterns describe optional implementation tools
for source access and mapping rather than a universal package taxonomy.

## Decision

SaltMarcher keeps Hexagonal Architecture as the single boundary model for
domain/data interaction.

- `src/domain/**` is the application core. Its standard concepts are context,
  application boundary, use case, domain model, port, and published contract.
- DDD terms such as aggregate, entity, value, policy, factory, domain service,
  event, and specification are optional tactical roles. A context uses only the
  roles that represent real behaviour or contracts.
- Domain `port/` remains the only outbound role package. Domain `repository/`,
  `query`, `gateway`, `adapter`, `model`, and `mapper` packages remain
  forbidden.
- `src/data/**` is the outer adapter zone. Its standard concepts are
  composition adapter, port adapter, source adapter, source model, optional
  mapper, and shared infrastructure.
- Existing physical packages under `src/data/<feature>/` remain in place:
  `repository/` for write-model port adapters, `query/` for read-only port
  adapters, `gateway/` for concrete source adapters, `model/` for source-local
  records and schemas, and `mapper/` for non-trivial translation.
- `*ServiceContribution` remains physically placed under `src/data/<feature>/`
  for now, but its architectural role is runtime composition. It is not a data
  business boundary and not persistence logic.
- Fowler terms such as Repository, Data Mapper, and Gateway remain permitted
  pattern names only where they clarify real persistence, source, or mapping
  complexity.

## Consequences

- The standards now distinguish concept ownership from physical enforcement
  shape. Existing package allowlists remain operative, but they no longer imply
  every package name is a mandatory architectural concept.
- New feature work should explain which domain and data concepts are actually
  needed instead of copying every role bucket.
- The data layer remains sharply outside the domain, but its vocabulary now
  reads as adapter implementation detail rather than a competing model.
- No package migration, source move, build gate, or compatibility alias is
  introduced by this decision.
- Future work may move runtime composition roots out of `src/data/**`, but that
  requires a separate ADR and explicit implementation plan.

## Alternatives Considered

### Keep the current vocabulary and rely on reviewers

Rejected because the standards themselves were the source of the ambiguity:
reviewers had to remember which terms were canonical and which were merely
borrowed pattern names.

### Adopt DDD as the primary domain/data model again

Rejected because ADR 023 already found that DDD is useful inside the core but
does not provide the clearest inter-layer boundary for this codebase.

### Collapse data packages into one generic `adapter/` package

Rejected for this change because the current package structure is already
mechanically enforced and useful for source-level checks. This ADR clarifies
meaning without triggering a structural migration.

## Related Documents

- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/overview.md:1)
- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/domain-layer.md:1)
- [Data Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/data-layer.md:1)
- [Repository Structure Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/repository-structure.md:1)
- [System Layer Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/system-layer-architecture.md:1)
- [ADR 023: Hexagonal Domain Core](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/adr-023-hexagonal-domain-core.md:1)
