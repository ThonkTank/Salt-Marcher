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

Canonical Domain blocker surface:

- `./gradlew checkDomainEnforcement --rerun-tasks --console=plain`

Historical compatibility alias:

- `./gradlew checkDomainRepositoryEnforcement --rerun-tasks --console=plain`

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-repository-direct-file-placement` | Enforced | every Java type below `src/domain/<context>/model/<family>/repository/` | domain-repository bundle build-harness `DomainRepositoryTopologyRules` | `./gradlew checkDomainRepositoryEnforcement` | Repository files stay as direct files under one model-family `repository/` bucket rather than being hidden in helper or adapter subpackages. |
| `domain-repository-role-shape` | Enforced | every domain type whose simple name ends with `Repository` and every Java type below `src/domain/<context>/model/<family>/repository/` | domain-repository bundle build-harness `DomainRepositoryTopologyRules` | `./gradlew checkDomainRepositoryEnforcement` | Repository role files use the canonical `*Repository.java` form and may appear only in the canonical outbound bucket. |
| `domain-repository-outbound-trigger-ownership` | Review-Owned | every repository under `src/domain/**` | none | none | A legal repository still owns outbound triggering of foreign domain work or layered data access instead of collapsing into a helper, listener, or passive carrier bucket. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-repository-no-src-data-type-leaks` | Enforced Elsewhere | every repository under `src/domain/**` | domain-layer bundle ArchUnit `domainRepositoriesMustStayOffPublishedAndDataSignatures`; domain-layer bundle Error Prone `DomainForbiddenInfrastructureDependency` | `./gradlew compileJava`, `./gradlew checkArchitecture`, `./gradlew checkDomainEnforcement`, and `./gradlew checkDomainRepositoryEnforcement` | Repositories do not depend on `src.data/**` or any `published/**` carrier family as a collaboration or signature seam. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-repository-foreign-applicationservice-routing-only` | Enforced Elsewhere | every foreign-domain collaboration initiated from a repository | domain-layer bundle ArchUnit `domainRepositoriesMustStayOffPublishedAndDataSignatures` | `./gradlew checkArchitecture`, `./gradlew checkDomainEnforcement`, and `./gradlew checkDomainRepositoryEnforcement` | Repositories trigger foreign work only through foreign root `*ApplicationService` boundaries while same-context collaborators stay inside application/model roles. |

## References

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1)
- [Data Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/data-layer.md:1)
- [Domain Port Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-port-enforcement.md:1)
