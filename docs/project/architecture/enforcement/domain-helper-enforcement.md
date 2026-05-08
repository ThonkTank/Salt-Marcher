Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-05-08
Source of Truth: Role-local enforcement inventory and review criteria for
`Helper` work steps in `src/domain/**`.

# Domain Helper Enforcement

## Goal

Architectural truth for `Helper` lives only in the
[Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1).
This document currently owns review criteria only. No dedicated focused helper
bundle exists yet.

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-helper-explicit-work-step` | Review-Owned | every helper under `src/domain/**` | none | none | Each helper represents one explicit deterministic work step such as calculation, validation, derivation, or construction. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-helper-no-current-context-access` | Review-Owned | every helper under `src/domain/**` | none | none | Helpers do not inspect current model state, subscribe to published state, invoke repositories, or react to ports. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-helper-constants-only-downward-dependency` | Review-Owned | every helper under `src/domain/**` | none | none | Helpers depend only on `Constants` and local pure support types in the downward direction. |

## References

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1)
- [Domain UseCase Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-use-case-enforcement.md:1)
