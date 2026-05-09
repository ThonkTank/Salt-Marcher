Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-05-08
Source of Truth: Role-local enforcement inventory and focused verification
surface for domain-owned `Repository` collaboration in `src/domain/**`.

# Domain Repository Enforcement

## Goal

Architectural truth for `Repository` lives only in the
[Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1).
This document owns only the role-local enforcement inventory, focused
verification surface, and current mechanical coverage for the target outbound
repository role.

Unified focused bundle entrypoint:

- `./gradlew checkDomainRepositoryEnforcement --rerun-tasks --console=plain`

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-repository-direct-file-placement` | Enforced | every Java type below `src/domain/<context>/model/<family>/repository/` | domain-repository bundle build-harness `DomainRepositoryTopologyRules` | `./gradlew checkDomainRepositoryEnforcement` | Repository files stay as direct files under one model-family `repository/` bucket rather than being hidden in helper or adapter subpackages. |
| `domain-repository-role-shape` | Enforced | every domain type whose simple name ends with `Repository` and every Java type below `src/domain/<context>/model/<family>/repository/` | domain-repository bundle build-harness `DomainRepositoryTopologyRules` | `./gradlew checkDomainRepositoryEnforcement` | Repository role files use the canonical `*Repository.java` form and may appear only in the canonical outbound bucket. |
| `domain-repository-outbound-trigger-ownership` | Review-Owned | every repository under `src/domain/**` | none | none | Repositories own outbound triggering of foreign domain work without collapsing into helpers, listeners, ports, or passive carriers. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-repository-no-src-data-type-leaks` | Review-Owned | every repository under `src/domain/**` | none | none | Repositories do not expose `src.data/**` types or foreign published carriers through signatures or broader role concerns. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-repository-foreign-applicationservice-routing-only` | Review-Owned | every foreign-domain collaboration initiated from a repository | none | none | Repositories trigger foreign work only through allowed foreign family `ApplicationService` boundaries and receive continued foreign state through published listeners rather than foreign internals. |

## References

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1)
- [Data Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/data-layer.md:1)
- [Domain Port Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-port-enforcement.md:1)
