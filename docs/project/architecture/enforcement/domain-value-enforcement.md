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
- which direct communication boundaries the role itself MAY cross

This document does not own generic named-module topology, generic named-module
forbidden-content rules, generic named-module communication boundaries, generic
model-role communication boundaries, generic public type shape rules that do
not add a value-specific constraint, or domain-layer-wide outer-layer
independence. Those live in
[Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1).

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
alone today. Value code is still constrained by the generic named-module and
model-role communication boundaries owned by
[Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1);
this document does not duplicate those named-module or model-role rows here.

## Review-Owned

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-value-semantic-immutability` | Review-Owned | every value role used in a named domain module | none | none | A structurally legal value type still represents immutable value semantics rather than a disguised entity, service helper, or mutable state owner. |

## References

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1)
- [Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1)
