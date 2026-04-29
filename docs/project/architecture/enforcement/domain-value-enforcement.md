Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-29
Source of Truth: Complete architecture-enforcement catalog for tactical
`value/` role types in named domain modules.

# Domain Value Enforcement

## Goal

This document owns the complete architecture-enforcement catalog for the
tactical `value/` role itself.

It answers three questions for every domain value role:

- what the role MUST contain
- what the role MUST NOT contain
- which role-local state and communication properties the role itself MAY
  expose

This document does not own generic named-module shape rules or cross-role
domain communication boundaries that happen to apply to `value/`. Those live
in [Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1).

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-value-top-level-type-shape` | Enforced | every top-level type under `src/domain/<context>/<named-module>/value/` | Error Prone `DomainRoleShape` | `./gradlew compileJava` | Value role types are records, enums, sealed abstractions, or final classes. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-value-no-non-private-or-non-final-instance-state` | Enforced | every final class-shaped value type under `value/` | Error Prone `DomainRoleShape` | `./gradlew compileJava` | Final value classes do not declare non-private or non-final instance fields. Class-shaped values keep instance state private and final. |

### Communication Contract

No mechanically enforced communication invariant is owned by this document
alone. The currently enforced communication boundaries that also constrain
`value/` code are generic named-module or model-role rules owned by
[Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1).

## Review-Owned

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-value-semantic-immutability` | Review-Owned | every value role used in a named domain module | none | none | A structurally legal value type still behaves like a real immutable value concept rather than a disguised entity or service helper. |

## References

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1)
- [Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1)
