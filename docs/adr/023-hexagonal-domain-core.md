Status: Accepted
Owner: SaltMarcher Team
Last Reviewed: 2026-04-20
Source of Truth: Decision to make Hexagonal Architecture the canonical domain
layer model, with DDD vocabulary limited to tactical roles inside the core.

# ADR 023: Hexagonal Domain Core

## Context

ADR 021 fixed several domain-layer problems by replacing `api/` with
carrier-only `published/`, requiring explicit role packages, and removing the
render-oriented `mapcore` context.

The remaining model was still too mixed. It used DDD as the primary
architecture label, kept `repository/` as a domain role package, discussed
read models in domain placement terms, and left developers to infer which
parts were boundary rules versus data-layer implementation concerns.

That made the domain layer sound like it owned too much infrastructure. It
also weakened the boundary between the application core and outbound adapters.

## Decision

SaltMarcher adopts Hexagonal Architecture as the canonical domain-layer model.

- `src/domain/**` is the application core.
- Each context keeps one root `<PascalContext>ApplicationService.java` inbound
  callable boundary.
- `published/` contains exported boundary carriers only.
- `application/` contains direct `*UseCase.java` orchestration files.
- Named domain modules contain tactical role packages, but DDD is vocabulary
  inside the core, not the system boundary model.
- `port/` is the only outbound domain role package.
- Domain `repository/` and `readmodel/` role packages are removed.
- Write-model persistence needs are expressed as outbound ports that may be
  named `*Repository`, placed under `port/`.
- Read-only lookup, search, and projection needs are expressed as outbound
  ports such as `*Lookup`, `*QueryPort`, `*ReadPort`, or `*ProjectionPort`,
  also placed under `port/`.
- Data-layer `repository/` and `query/` packages implement those domain-owned
  ports as adapters.
- Named domain modules must not depend on any `src.domain.*.published.*`
  carriers, same context or foreign.

## Consequences

- ADR 021 remains useful history, but this ADR supersedes it for active domain
  topology and boundary vocabulary.
- The domain-layer standard describes only the core and its ports. Data adapter
  placement belongs to the data-layer standard.
- The repository-structure standard now lists `port/`, not `repository/`, as
  the domain outbound role package.
- Architecture checks enforce `port/` role placement, direct
  `application/*UseCase.java` naming, and a broader ban on published-carrier
  dependencies from named domain modules.
- Existing domain concepts that previously lived in `repository/` migrate to
  `port/`.

## Alternatives Considered

### Keep DDD as the primary architecture model

Rejected because it kept mixing tactical modeling vocabulary with boundary and
adapter decisions. DDD remains useful for aggregates, entities, values,
policies, factories, domain services, events, and specifications, but it is
not the clearest model for inter-layer communication in this codebase.

### Add separate domain `repository/` and `readmodel/` role packages

Rejected because that duplicates data-layer vocabulary inside the core. The
domain should state outbound needs through ports; the data layer decides
whether an implementation is a write repository adapter or a read query
adapter.

### Put outbound contracts in `application/`

Rejected because `application/` is use-case orchestration. Ports are part of
the core model's dependency inversion boundary and belong with the named
domain module that owns the language of the need.

## References

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/domain-layer.md:1)
- [Data Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/data-layer.md:1)
- [Repository Structure Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/repository-structure.md:1)
- [System Layer Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/system-layer-architecture.md:1)
- [ADR 021: Domain Layer Role Reset](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/021-domain-layer-role-reset.md:1)
