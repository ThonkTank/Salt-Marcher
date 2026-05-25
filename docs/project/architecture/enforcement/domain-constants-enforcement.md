Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-05-08
Source of Truth: Role-local enforcement inventory and focused verification
surface for `Constants` in `src/domain/**`.

# Domain Constants Enforcement

## Goal

Architectural truth for `Constants` lives only in the
[Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1).
This document owns only the role-local enforcement inventory, focused
verification surface, and current mechanical coverage for constants placement
and role shape.

Technical diagnostic route:

- `./gradlew checkDomainEnforcement --rerun-tasks --console=plain`

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Diagnostic/Mechanical Route | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-constants-direct-file-placement` | Enforced | every Java type below `src/domain/<context>/model/<family>/constants/` | domain-constants bundle build-harness `DomainConstantsTopologyRules` | `./gradlew checkDomainEnforcement` | Constants files stay as direct files under one model-family `constants/` bucket rather than growing helper or adapter subpackages. |
| `domain-constants-role-shape` | Enforced | every domain type whose simple name ends with `Constants` and every Java type below `src/domain/<context>/model/<family>/constants/` | domain-constants bundle build-harness `DomainConstantsTopologyRules` | `./gradlew checkDomainEnforcement` | Constants role files use the canonical `*Constants.java` form and may appear only in the canonical constants bucket. |
| `domain-constants-immutable-only` | Review-Owned | every constants file under `src/domain/**` | none | none | Constants stay immutable holders with final class or enum shape, static-final fields, and no instance behavior beyond unavoidable object methods. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Diagnostic/Mechanical Route | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-constants-no-runtime-or-state-ownership` | Review-Owned | every constants file under `src/domain/**` | none | none | Constants do not own current state, listeners, callbacks, adapters, or runtime composition. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Diagnostic/Mechanical Route | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-constants-constants-only-dependency-boundary` | Enforced | every constants file under `src/domain/**` | domain-constants bundle Error Prone `DomainConstantsRoleBoundary` | `./gradlew checkDomainEnforcement` | Constants reference only same-context `constants/**`, passive platform types, and their own nested types. This does not prove that each constant is semantically necessary or immutable enough beyond the class/member shape checked by the same owner. |

## References

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1)
