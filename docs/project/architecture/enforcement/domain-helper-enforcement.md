Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-05-08
Source of Truth: Role-local enforcement inventory and focused verification
surface for `Helper` work steps in `src/domain/**`.

# Domain Helper Enforcement

## Goal

Architectural truth for `Helper` lives only in the
[Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1).
This document owns only the role-local enforcement inventory, focused
verification surface, and current mechanical coverage for helper placement and
role shape.

Technical diagnostic route:

- `./gradlew checkDomainEnforcement --rerun-tasks --console=plain`

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Diagnostic/Mechanical Route | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-helper-direct-file-placement` | Enforced | every Java type below `src/domain/<context>/model/<family>/helper/` | domain-helper bundle build-harness `DomainHelperTopologyRules` | `./gradlew checkDomainEnforcement` | Helper files stay as direct files under one model-family `helper/` bucket rather than growing secondary technical subpackages. |
| `domain-helper-role-shape` | Enforced | every domain type whose simple name ends with `Helper` and every Java type below `src/domain/<context>/model/<family>/helper/` | domain-helper bundle build-harness `DomainHelperTopologyRules` | `./gradlew checkDomainEnforcement` | Helper role files use the canonical `*Helper.java` form and may appear only in the canonical helper bucket. |
| `domain-helper-explicit-work-step` | Review-Owned | every helper under `src/domain/**` | none | none | Helper code stays on explicit deterministic work-step inputs instead of absorbing repository, port, use-case, published, or root-boundary concerns. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Diagnostic/Mechanical Route | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-helper-no-current-context-access` | Review-Owned | every helper under `src/domain/**` | none | none | Helpers do not inspect repositories, ports, use cases, published state, or any other foreign-role concern to recover missing context. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Diagnostic/Mechanical Route | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-helper-constants-only-downward-dependency` | Enforced | every helper under `src/domain/**` | domain-helper bundle Error Prone `DomainHelperRoleBoundary` | `./gradlew checkDomainEnforcement` | Helpers reference only same-context `model/**`, same-context `constants/**`, passive platform types, and their own nested types. This does not prove that the helper is a necessary or semantically thin work step. |

## References

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1)
- [Domain UseCase Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-use-case-enforcement.md:1)
