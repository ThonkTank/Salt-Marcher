Status: Accepted
Owner: SaltMarcher Team
Last Reviewed: 2026-04-20
Source of Truth: Decision to reset the domain layer to role-explicit
contexts, `published/` boundary carriers, tactical role packages, and no
domain-owned map render context.

# ADR 021: Domain Layer Role Reset

## Context

ADR 013 moved SaltMarcher away from root technical role buckets and toward
DDD-named domain modules. ADR 014 made that target mechanically strict.

The model still left two problems:

- `api/` read like a callable integration surface even though it was intended
  to hold carriers only.
- Broad domain modules could still mix aggregates, values, policies,
  repositories, derived projections, and render contracts without a mechanically
  checkable role shape.

The `mapcore` context exposed the largest mismatch. It lived under
`src/domain/**`, but it owned shared map render projections instead of
fachliche truth, topology, invariants, or policy.

## Decision

SaltMarcher resets the domain-layer target model.

- Domain `api/` packages are replaced by `published/` packages. No source
  compatibility aliases are kept.
- `published/` contains only the context's published language: commands,
  queries, results, IDs, statuses, snapshots, and other boundary carriers.
- Each real domain context keeps one root
  `<PascalContext>ApplicationService.java` inbound boundary.
- `application/` contains use-case orchestration classes named `*UseCase`.
- Every fachlich named domain module contains explicit role subpackages:
  `aggregate`, `entity`, `value`, `policy`, `repository`, `factory`,
  `service`, `event`, and `specification`.
- Named domain modules must not depend on same-context `published/` carriers.
  Translation happens at the root/application boundary.
- `mapcore` is removed from `src/domain/**`. Shared render input moves to the
  view layer. Dungeon publishes fachliche map/world facts through
  `dungeon/published`.

Domain documentation now declares `Context Role:` instead of the previous
policy/supporting `Context Type:` marker.

## Consequences

- ADR 013 and ADR 014 are superseded by this ADR for active domain structure.
- Mechanical checks must target `published/`, role packages, role-shape rules,
  context-role declarations, and the absence of `src/domain/mapcore`.
- ViewModels own translation from domain facts into display models.
- Passive Views stay domain-free and render ViewModel-owned presentation state.
- Existing code that still uses domain `api/`, same-context published carriers
  inside modules, generic operations buckets, or `mapcore` is migration debt,
  not a supported alternate model.

## Alternatives Considered

### Keep `api/` as the carrier package

Rejected because the name kept suggesting a callable integration API and made
carrier-only discipline harder to communicate.

### Keep broad domain modules without role subpackages

Rejected because the reset specifically needs mechanically checkable tactical
roles while still preserving fachlich named module ownership.

### Preserve `mapcore` as a supporting read-model context

Rejected because render projections are presentation concerns. A domain context
must own fachliche truth, policy, topology, invariants, or published language.

## References

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/domain-layer.md:1)
- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/overview.md:1)
- [Repository Structure Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/repository-structure.md:1)
- [ADR 013: DDD-Primary Domain-Layer Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/013-domain-layer-ddd-primary-model.md:1)
- [ADR 014: Strict Domain-Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/014-strict-domain-layer-enforcement.md:1)
