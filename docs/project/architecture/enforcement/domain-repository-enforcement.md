Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-05-08
Source of Truth: Role-local enforcement inventory and review criteria for
domain-owned `Repository` collaboration in `src/domain/**`.

# Domain Repository Enforcement

## Goal

Architectural truth for `Repository` lives only in the
[Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1).
This document currently owns review criteria only. No dedicated focused
repository bundle exists yet.

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-repository-outbound-trigger-ownership` | Review-Owned | every repository under `src/domain/**` | none | none | Repositories own outbound triggering of foreign domain work or layered data access. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-repository-no-src-data-type-leaks` | Review-Owned | every repository under `src/domain/**` | none | none | Repositories do not expose `src.data/**` types or foreign published carriers through their signatures. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-repository-foreign-applicationservice-routing-only` | Review-Owned | every foreign-domain collaboration initiated from a repository | none | none | Repositories trigger foreign work only through allowed foreign family `ApplicationService` boundaries and receive continued foreign state through published listeners rather than foreign internals. |

## References

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1)
- [Data Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/data-layer.md:1)
- [Domain Port Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-port-enforcement.md:1)
