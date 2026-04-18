Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-18
Source of Truth: Shared mapcore feature ownership, exported map projection
contracts, and supporting-context rationale.

# Mapcore Domain Model

## Context Shape

Context Type: Supporting Read-Model Context

- `mapcore` is an explicit supporting read-model context.
- Its public backend boundary is
  `src/domain/mapcore/MapcoreApplicationService.java`.
- The feature exports topology-neutral map payload and selection contracts for
  map-owning features without owning authored dungeon or travel policy.

## Read-Model Boundary

- `mapcore` does not own authored write-model state of its own.
- It owns exported shared map payload shapes such as surface, layer, cell, and
  edge snapshots.
- Domain features such as `dungeon` remain responsible for authored map
  semantics and mutation policy.
- This exception is justified because the context exists to publish shared map
  projection contracts across bounded contexts, not to own authored map truth.

## Allowed Domain Shape

- `api/` owns shared read payloads and coordinate references.
- The feature may stay minimal while it only exposes shared read contracts.
- If `mapcore` begins to own authored map policy or persistence rules, it must
  be remodelled as a policy-owning bounded context.

## References

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/domain-layer.md:1)
- [Dungeon Domain Model](/home/aaron/Schreibtisch/projects/SaltMarcher/src/domain/dungeon/DOMAIN.md:1)
