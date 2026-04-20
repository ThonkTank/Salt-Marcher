Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-20
Source of Truth: Routing index for per-surface architecture enforcement
coverage.

# Architecture Enforcement Coverage Standard

## Goal

This standard records where each architecture surface documents its mechanical
coverage, which gate owns each blocker, and which documented rules remain
review-owned.

The shared owner model, execution model, diagnostic contract, lifecycle, and
review-only boundary remain defined in the
[Architecture Enforcement Harness Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/architecture-enforcement-harness.md:1).

## Coverage Documents

- [View Enforcement Coverage](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/architecture-enforcement-coverage-view.md:1)
  owns cockpit MVVM, passive view, binder, slotcontent, and view dependency
  coverage.
- [Domain Enforcement Coverage](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/architecture-enforcement-coverage-domain.md:1)
  owns Domain Layer Standard coverage, including domain context documents,
  public application boundaries, published carriers, named modules, role
  packages, and domain dependency direction.
- [Data And System Enforcement Coverage](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/architecture-enforcement-coverage-data-system.md:1)
  owns data-layer, persistencecore, gateway, repository/query adapter, system
  layer, and bootstrap boundary coverage.
- [Shell And Repository Enforcement Coverage](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/architecture-enforcement-coverage-shell-repository.md:1)
  owns shell API/host, discovery, resource, styling, repository topology, and
  documentation-shape coverage.

## Interpretation

`Enforced` means a local quality gate blocks violations without relying on
fixture selftests or meta-test layers. `Review-owned` means the rule requires
human architecture judgment or would need a weak source-text heuristic that is
not useful enough to treat as proof.

Source-pattern gates may still be enforced when they block a narrow, stable
smell. They must be documented as source-pattern checks, not as semantic proof.
