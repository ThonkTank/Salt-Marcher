Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-29
Source of Truth: Role-local enforcement inventory and focused verification
surface for tactical `value/` role types in named domain modules.

# Domain Value Enforcement

## Goal

Architectural truth for the tactical `value/` role lives only in the
[Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1).
This document owns only the role-local enforcement inventory, focused
verification surface, and current mechanical drift for that role.

It answers three questions for every domain value role:

- what the role MUST contain
- what the role MUST NOT contain
- which direct communication boundaries the role itself MAY cross

This document does not own generic named-module topology, generic named-module
forbidden-content rules, generic named-module communication boundaries, generic
model-role communication boundaries, generic public type shape rules that do
not add a value-specific constraint, or domain-layer-wide outer-layer
independence. Those live in the Domain Layer Standard and
[Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1).

Unified focused bundle entrypoint:

- `./gradlew checkDomainValueEnforcement --rerun-tasks --console=plain`
  runs the currently active Domain Value-focused Error Prone and
  documentation-coverage checks through one root task. Canonical compile-side
  blocking behavior remains at `./gradlew compileJava`; the focused bundle
  proof route adds the role-owned documentation coverage check without pulling
  the broader architecture aggregates.

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-value-top-level-type-shape` | Enforced | every top-level type under `src/domain/<context>/<named-module>/value/` | Error Prone `DomainValueShape` | `./gradlew compileJava` and `./gradlew checkDomainValueEnforcement` | Value role types are records, enums, sealed abstractions, or final classes. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-value-no-non-private-or-non-final-instance-state` | Enforced | every final class-shaped value type under `value/` | Error Prone `DomainValueShape` | `./gradlew compileJava` and `./gradlew checkDomainValueEnforcement` | Final value classes do not declare non-private or non-final instance fields. Class-shaped values keep instance state private and final. |

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
