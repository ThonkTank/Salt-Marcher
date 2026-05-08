Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-05-08
Source of Truth: Role-local enforcement inventory and review criteria for
internal `Model` ownership in `src/domain/**`.

# Domain Model Enforcement

## Goal

Architectural truth for `Model` lives only in the
[Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1).
This document currently owns review criteria only. No dedicated focused model
bundle exists yet.

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-model-dynamic-state-ownership` | Review-Owned | every model family under `src/domain/**` | none | none | Models own the dynamic internal work state of the context. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-model-no-outer-layer-dependencies` | Review-Owned | every model family under `src/domain/**` | none | none | Models do not depend on outer-layer types or concrete data adapters. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-model-published-derivation-ownership` | Review-Owned | every same-context published state path | none | none | Model change is the source that updates same-context `Published` state. |

## References

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1)
- [Domain Published Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-published-enforcement.md:1)
