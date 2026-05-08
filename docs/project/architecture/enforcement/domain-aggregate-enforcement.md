Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-29
Source of Truth: Role-local enforcement inventory for tactical `aggregate/`
role types in named domain modules.

# Domain Aggregate Enforcement

## Goal

Architectural truth for the tactical `aggregate/` role lives only in the
[Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1).
This document owns only the role-local enforcement inventory and current
mechanical drift for that role.

It answers four questions for every domain aggregate role:

- when the role MAY exist and contain aggregate types at all
- what the role MUST contain
- what the role MUST NOT contain
- which direct communication seams the role itself MAY cross

This document does not own generic named-module shape rules, generic
named-module forbidden-content rules, or generic named-module communication
boundaries that also constrain `aggregate/`. Those live in the Domain Layer
Standard and
[Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1).

## Invariant Catalog

### May Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-aggregate-rich-consistency-boundary` | Review-Owned | every aggregate role used in a named domain module | none | none | A named domain module may contain an `aggregate/` role only when it clarifies real domain behavior and still represents a meaningful consistency boundary rather than ceremonial DDD labeling. |

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-aggregate-role-shape` | Enforced | every top-level type under `src/domain/<context>/<named-module>/aggregate/` | domain-aggregate bundle Error Prone `DomainAggregateRoleShape` | `./gradlew compileJava`, `./gradlew checkDomainAggregateEnforcement` | Aggregate role types are classes or records, and class-shaped aggregate roots are final. |

### Must Not Contain

No mechanically enforced forbidden-content invariant is owned by this document
alone today. Aggregate code is still constrained by the generic named-module
forbidden-content rules owned by
[Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1);
this document does not duplicate those shared rows as aggregate-local
invariants.

### Communication Contract

No mechanically enforced communication invariant is owned by this document
alone today. Aggregate code is still constrained by the generic named-module
and model-role communication boundaries owned by
[Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1);
this document does not duplicate those named-module or model-role rows as
aggregate-local invariants.

## References

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1)
- [Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1)
