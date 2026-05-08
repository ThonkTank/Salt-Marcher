Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-05-08
Source of Truth: Role-local enforcement inventory and review criteria for
`Constants` in `src/domain/**`.

# Domain Constants Enforcement

## Goal

Architectural truth for `Constants` lives only in the
[Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1).
This document currently owns review criteria only. No dedicated focused
constants bundle exists yet.

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-constants-immutable-only` | Review-Owned | every constants file under `src/domain/**` | none | none | Constants own immutable shared domain values only. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-constants-no-runtime-or-state-ownership` | Review-Owned | every constants file under `src/domain/**` | none | none | Constants do not own current state, listeners, adapters, or runtime composition. |

## References

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1)
