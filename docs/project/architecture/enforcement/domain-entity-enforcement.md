Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-29
Source of Truth: Complete architecture-enforcement catalog for tactical
`entity/` role types in named domain modules.

# Domain Entity Enforcement

## Goal

This document owns the complete architecture-enforcement catalog for the
tactical `entity/` role itself.

It answers three questions for every domain entity role:

- what the role MUST contain
- what the role MUST NOT contain
- which direct communication seams the role itself MAY cross

This document does not own generic named-module topology, generic public type
shape constraints, generic named-module forbidden-content rules, or generic
named-module communication boundaries that also constrain `entity/`. Those
live in
[Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1).

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-entity-role-shape` | Enforced | every top-level type under `src/domain/<context>/<named-module>/entity/` | Error Prone `DomainRoleShape` | `./gradlew compileJava` | Entity role types are records, sealed abstractions, or final classes. |

### Must Not Contain

No mechanically enforced forbidden-content invariant is owned by this document
alone today. Entity code is still constrained by the generic named-module
forbidden-content rules owned by
[Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1);
this document does not duplicate those shared rows here.

### Communication Contract

No mechanically enforced communication invariant is owned by this document
alone today. Entity code is still constrained by the generic named-module and
model-role communication boundaries owned by
[Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1);
this document does not duplicate those shared rows here.

## Review-Owned

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-entity-business-identity-and-lifecycle-semantics` | Review-Owned | every entity role used in a named domain module | none | none | A legal entity role still represents meaningful business identity and lifecycle behavior rather than decorative type partitioning. |

## References

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1)
- [Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1)
