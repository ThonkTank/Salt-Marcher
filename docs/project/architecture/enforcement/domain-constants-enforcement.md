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

Unified focused bundle entrypoint:

- `./gradlew checkDomainConstantsEnforcement --rerun-tasks --console=plain`

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-constants-direct-file-placement` | Enforced | every Java type below `src/domain/<context>/model/<family>/constants/` | domain-constants bundle build-harness `DomainConstantsTopologyRules` | `./gradlew checkDomainConstantsEnforcement` | Constants files stay as direct files under one model-family `constants/` bucket rather than growing helper or adapter subpackages. |
| `domain-constants-role-shape` | Enforced | every domain type whose simple name ends with `Constants` and every Java type below `src/domain/<context>/model/<family>/constants/` | domain-constants bundle build-harness `DomainConstantsTopologyRules` | `./gradlew checkDomainConstantsEnforcement` | Constants role files use the canonical `*Constants.java` form and may appear only in the canonical constants bucket. |
| `domain-constants-immutable-only` | Review-Owned | every constants file under `src/domain/**` | none | none | Constants own immutable shared domain values only. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-constants-no-runtime-or-state-ownership` | Review-Owned | every constants file under `src/domain/**` | none | none | Constants do not own current state, listeners, adapters, or runtime composition. |

## References

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1)
