# ADR 007: Shared View API Boundary

- Status: Accepted
- Date: 2026-04-18

## Context

SaltMarcher's current view reuse is still too ad hoc. Components already reuse
presentation helpers from other components, but they often do so by importing
private `ViewModel/`, `View/`, or legacy implementation buckets directly. That
creates hidden coupling, duplicates wrapper types in consumers, and makes it
unclear which part of a component is intentionally public.

At the same time, a blanket ban on all cross-component view reuse would force
duplicated UI logic and duplicated presentation contracts.

## Decision

SaltMarcher introduces `src/view/<component>/api/**` as the only public
view-to-view boundary.

- A component may expose `api/` only when it intentionally supports reuse by
  other view components.
- Consuming components may depend only on that foreign `api/` package.
- Foreign `ViewModel/`, `View/`, and `assembly/` packages remain private.
- Public `api/` signatures must not leak private bucket types.
- The implementing types behind `api/` remain owned by the exporting component.

The detailed packaging and dependency rules live in the MVVM standard.

## Consequences

- Repository structure now permits optional `api/` buckets below
  `src/view/<component>/`.
- Existing `*shared` components may continue to exist, but their public
  boundary is `api/`, not direct imports into private buckets or a missing root
  entrypoint.
- Future view-architecture checks must model `api/` as the only allowed
  cross-component boundary.

## Alternatives Considered

### Keep `*shared` naming as the only reuse contract

Rejected because naming alone does not create an explicit technical boundary.

### Allow direct imports into foreign private view buckets

Rejected because it collapses component ownership and makes reuse accidental
rather than intentional.

### Forbid all cross-component view reuse

Rejected because it would increase duplication and push teams toward copied
DTOs and copied UI helpers.

## Related Documents

- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/overview.md:1)
- [Repository Structure Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/repository-structure.md:1)
- [Model-View-ViewModel Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/view-mvvm.md:1)
- [ADR 005: MVVM And Assembly Boundary In The View Layer](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/005-view-mvvm-and-assembly-boundary.md:1)
