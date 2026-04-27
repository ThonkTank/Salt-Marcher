Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-26
Source of Truth: Routing index for per-surface architecture enforcement
coverage.

# Architecture Enforcement Coverage Standard

## Goal

This standard records where each architecture surface documents its mechanical
coverage, which gate owns each blocker, and which documented rules remain
review-owned.

The shared owner model, execution model, diagnostic contract, lifecycle, and
review-only boundary remain defined in the
[Architecture Enforcement Harness Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/architecture-enforcement-harness.md:1).

## Coverage Documents

- [View Enforcement Coverage](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/architecture-enforcement-coverage-view.md:1)
  owns cockpit view-layer, passive view, Binder, slotcontent, dependency, and
  target-state migration coverage.
- [Domain Enforcement Coverage](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/architecture-enforcement-coverage-domain.md:1)
  owns Domain Layer Standard coverage, including domain context documents,
  public application boundaries, published carriers, named modules, tactical
  role-package allowlists, and domain dependency direction. This routing index
  does not carry the domain-layer rule matrix itself; any concrete claim about
  how [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/domain-layer.md:1)
  rules are enforced must be made in the domain-specific coverage document.
- [Data And System Enforcement Coverage](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/architecture-enforcement-coverage-data-system.md:1)
  owns data-layer composition adapters, port adapters, source adapters, source
  models, persistencecore, system layer, and bootstrap boundary coverage. This
  routing index does not carry the data-layer rule matrix itself. Line-specific
  citations for data-layer enforcement decisions must target that document, not
  this routing index.
- [Shell And Repository Enforcement Coverage](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/architecture-enforcement-coverage-shell-repository.md:1)
  owns shell API/host, discovery, resource, styling, repository topology, and
  documentation-shape coverage.

## Interpretation

`Enforced` means a local quality gate blocks violations without relying on
fixture selftests or meta-test layers. `Review-owned` means the rule requires
human architecture judgment or would need a weak source-text heuristic that is
not useful enough to treat as proof.

Source-pattern gates may still be enforced when they block a narrow, stable
smell. They must be documented as source-pattern checks, not as semantic proof.

An enforcement row is only valid when its owning gate can produce a current,
non-empty signal for the surface it claims to check. Dependency-direction or
cycle rules that inspect no target classes are a broken gate, not successful
coverage.

## Verification Notes

This routing index is itself `Review-Owned`. It proves coverage only by naming
the owning surface document and by using the shared interpretation vocabulary in
this file together with the detailed rule matrices in the linked per-surface
documents. Concrete blocker claims must be made in the owning coverage document,
not inferred from this index alone.

## References

- [Architecture Enforcement Harness Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/architecture-enforcement-harness.md:1)
- [View Enforcement Coverage](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/architecture-enforcement-coverage-view.md:1)
- [Domain Enforcement Coverage](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/architecture-enforcement-coverage-domain.md:1)
- [Data And System Enforcement Coverage](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/architecture-enforcement-coverage-data-system.md:1)
- [Shell And Repository Enforcement Coverage](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/architecture-enforcement-coverage-shell-repository.md:1)
