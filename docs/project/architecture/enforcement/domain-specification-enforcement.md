Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-29
Source of Truth: Complete architecture-enforcement catalog for tactical
`specification/` role types in named domain modules.

# Domain Specification Enforcement

## Goal

This document owns the complete architecture-enforcement catalog for the
tactical `specification/` role itself.

It answers three questions for every domain specification role:

- what the role MUST contain
- what the role MUST NOT contain
- which direct communication seams the role itself MAY cross

This document does not own generic named-module shape rules, generic
named-module forbidden-content rules, or generic named-module communication
boundaries that also constrain `specification/`. Those live in
[Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1).

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-specification-role-shape` | Enforced | every top-level type under `src/domain/<context>/<named-module>/specification/` | Error Prone `DomainRoleShape` | `./gradlew compileJava` | Specification role types are interfaces or final classes whose names end with `Specification`. |

### Must Not Contain

No mechanically enforced forbidden-content invariant is owned by this document
alone today. Specification code is still constrained by the generic named-module
forbidden-content rules owned by
[Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1);
this document does not mirror those rows as role-local invariants.

### Communication Contract

No mechanically enforced communication invariant is owned by this document
alone today. Specification code is still constrained by the generic named-module
communication boundaries owned by
[Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1);
this document does not duplicate those named-module or model-role rows here.

## Review-Owned

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-specification-non-ceremonial-role-use` | Review-Owned | every specification role used in a named domain module | none | none | A legal specification role is used only when it clarifies real domain behavior or contracts rather than serving as ceremonial tactical partitioning. |

## References

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1)
- [Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1)
