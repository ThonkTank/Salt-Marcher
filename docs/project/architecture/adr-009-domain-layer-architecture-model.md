# ADR 009: Domain-Layer Architecture Model

- Status: Superseded by ADR 013
- Date: 2026-04-18
- Superseded On: 2026-04-18

## Superseded By

- [ADR 013: DDD-Primary Domain-Layer Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/adr-013-domain-layer-ddd-primary-model.md:1)

## Note

ADR 009 established a stricter domain-layer vocabulary than the legacy
`*API.java` and `usecase/` model, but it still froze the physical structure of
`src/domain/**` into technical role buckets such as `entity/`, `service/`, and
`query/`.

That topology is no longer the canonical target. SaltMarcher now treats each
`src/domain/<feature>/` slice primarily as one DDD bounded context with a thin
application layer and named domain modules that follow the ubiquitous
language.

ADR 009 remains part of the repository history only to explain that migration
step. All new domain-architecture decisions must follow ADR 013 and the
current domain-layer standard.
